const express = require('express');
const router  = express.Router();
const { aiCompleteFast, calcMaxTokens } = require('../../services/ai');
const { getAiConfigForAction }          = require('../../services/aiConfig');
const { LIMITS }                        = require('../../middleware/quota');
const { checkAndDeduct, refundJetons } = require('../../services/jetons');
const { logTokens }                     = require('../../services/tokens');
const logger                            = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, parseJsonResponse } = require('./helpers');
const { topicCacheKey, getCachedTopic, setCachedTopic }         = require('./topicCache');

// POST /api/topic — flashcards ou quiz sur un sujet libre (sans fichier)
router.post('/topic', async (req, res) => {
  const { topic, type, count: rawCount, lang: rawLang } = req.body || {};
  if (!topic || !['flashcards', 'quiz'].includes(type))
    return res.status(400).json({ error: 'Paramètres invalides.' });

  const lang   = VALID_LANGS.includes(rawLang) ? rawLang : 'fr';
  const inLang = langLabel(lang);
  const count  = Math.min(
    parseInt(rawCount) || (type === 'quiz' ? 5 : 8),
    type === 'quiz' ? LIMITS.quizMaxCount : LIMITS.flashMaxCount
  );
  const ctx = userContext(req.user);

  // Cache DB : si le contenu existe déjà, on le retourne gratuitement (sans déduire de jetons)
  const cacheKey = topicCacheKey(topic, type, lang, req.user);
  const cached   = await getCachedTopic(cacheKey);
  if (cached) return res.json(cached);

  // Contenu non en cache → déduire les jetons avant l'appel IA
  const jAction = type === 'flashcards' ? 'flashcards' : 'quiz';
  const jeton   = await checkAndDeduct(req.user?.id, jAction, req.user?.plan || 'free');
  if (!jeton.ok)
    return res.status(402).json({ error: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });

  const aiCfg = await getAiConfigForAction(jAction); // flashcards ou quiz → provider cheap

  try {
    if (type === 'flashcards') {
      const prompt = `${ctx}Tu es un tuteur pédagogique expert. Génère ${count} flashcards ${inLang} sur le sujet : "${topic}".

Consignes :
- Adapte le contenu au profil de l'étudiant indiqué dans [Profil] (niveau, domaine, spécialité)
- Couvre les notions clés les plus souvent évaluées en examen
- Varie les types : définitions, mécanismes, applications pratiques, exemples concrets
- Privilégie les liens avec la spécialité de l'étudiant quand c'est pertinent

Chaque flashcard :
- RECTO : terme, concept clé ou question courte et précise
- VERSO : réponse concise (2-3 phrases max) avec un exemple pratique si applicable

Réponds UNIQUEMENT avec ce JSON, sans texte autour :
{
  "flashcards": [
    { "front": "...", "back": "..." }
  ]
}`;

      const { text: raw, usage } = await aiCompleteFast(prompt, calcMaxTokens('flash', 0, count), aiCfg);
      logTokens(req.user?.id, 'flashcards', usage?.provider, usage?.input, usage?.output);

      const parsed = parseJsonResponse(raw, { flashcards: [] });
      const result = { flashcards: parsed.flashcards || [] };
      await setCachedTopic(cacheKey, result);
      return res.json(result);
    }

    // type === 'quiz'
    const prompt = `${ctx}Tu es un tuteur pédagogique expert. Génère ${count} QCM ${inLang} sur le sujet : "${topic}".

Consignes :
- Adapte les questions au profil indiqué dans [Profil] (niveau, domaine, spécialité)
- Varie les niveaux : connaissance pure, compréhension, application pratique
- Les distracteurs (mauvaises réponses) doivent être plausibles et correspondre aux erreurs fréquentes
- L'explication doit être pédagogique : pourquoi la bonne réponse est correcte ET pourquoi les autres sont fausses

Format JSON strict, sans texte autour :
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "..."
    }
  ]
}`;

    const { text: raw, usage } = await aiCompleteFast(prompt, calcMaxTokens('quiz', 0, count), aiCfg);
    logTokens(req.user?.id, 'quiz', usage?.provider, usage?.input, usage?.output);

    const parsed = parseJsonResponse(raw, { questions: [] });
    const result = { questions: parsed.questions || [] };
    await setCachedTopic(cacheKey, result);
    return res.json(result);
  } catch (err) {
    logger.error('AI topic error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, jAction, jeton.cost || 0);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

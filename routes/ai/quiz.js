const express = require('express');
const router  = express.Router();
const { aiComplete, calcMaxTokens, MODEL_LABEL } = require('../../services/ai');
const { checkQuota, LIMITS }                     = require('../../middleware/quota');
const { logTokens }                              = require('../../services/tokens');
const logger                                     = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse } = require('./helpers');

const VALID_DIFF = ['facile', 'moyen', 'difficile'];

// POST /api/quiz — génération de QCM (traitement parallèle par fichier)
router.post('/quiz', async (req, res) => {
  const quota = await checkQuota(req, 'quiz');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} quiz/jour). Revenez demain.` });

  try {
    const { files }  = req.body;
    const lang       = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang     = langLabel(lang);
    const difficulty = VALID_DIFF.includes(req.body.difficulty) ? req.body.difficulty : 'moyen';
    const count      = Math.min(parseInt(req.body.count) || 5, LIMITS.quizMaxCount);

    const results = await Promise.all(files.map(async file => {
      const text      = await getFileText(file);
      if (!text.trim()) throw new Error(`Contenu de "${file.name}" vide ou indisponible. Rechargez le fichier.`);
      const truncated = text.slice(0, LIMITS.quizChars);

      const difficultyGuide = {
        facile:    "Privilégie les questions de définition et de reconnaissance (ex: \"Qu'est-ce que X ?\").",
        moyen:     "Mélange questions de compréhension, d'application et de comparaison.",
        difficile: "Privilégie les cas pratiques, nuances, erreurs courantes et raisonnements multi-étapes.",
      }[difficulty];

      const questionTypes = `
Varie obligatoirement les types de questions parmi :
- Définition (ex: "Que signifie X ?")
- Application (ex: "Dans quel cas utilise-t-on X ?")
- Comparaison (ex: "Quelle est la différence entre X et Y ?")
- Vrai/faux déguisé (une seule option est vraie, les autres sont plausibles mais fausses)
- Cause/conséquence (ex: "Pourquoi X entraîne-t-il Y ?")
- Identification d'erreur (ex: "Laquelle de ces affirmations est incorrecte ?")
N'utilise pas deux fois le même type de question consécutivement.`;

      const prompt = `${userContext(req.user)}Génère ${count} questions QCM de niveau ${difficulty} ${inLang} basées sur ce cours.
${difficultyGuide}
${questionTypes}

Pour chaque question, donne exactement ce format JSON :
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "Explique clairement pourquoi la bonne réponse est correcte.",
      "sourceHint": "Rappelle la notion ou le passage du cours à revoir, sans inventer de citation exacte."
    }
  ]
}

Les explications doivent être pédagogiques, concrètes et utiles pour réviser.
Réponds UNIQUEMENT avec le JSON, sans texte autour.

---
Contenu du cours "${file.name}" :
${truncated}`;

      const { text: raw, model: fileModel, usage } = await aiComplete(
        prompt, calcMaxTokens('quiz', truncated.length, count)
      );
      logTokens(req.user?.id, 'quiz', usage?.provider, usage?.input, usage?.output);

      const parsed = parseJsonResponse(raw, { questions: [] });
      return { name: file.name, quiz: parsed, _model: fileModel };
    }));

    const quizModel = results[results.length - 1]?._model || MODEL_LABEL;
    results.forEach(r => delete r._model);
    res.json({ success: true, results, model: quizModel });
  } catch (err) {
    logger.error('AI quiz error', { userId: req.user?.id, message: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

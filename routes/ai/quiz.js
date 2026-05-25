const express = require('express');
const router  = express.Router();
const { aiStream, calcMaxTokens, MODEL_LABEL } = require('../../services/ai');
const { getJsonAiConfig }                      = require('../../services/aiConfig');
const { checkQuota, LIMITS }                   = require('../../middleware/quota');
const { logTokens }                            = require('../../services/tokens');
const logger                                   = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse } = require('./helpers');

const VALID_DIFF = ['facile', 'moyen', 'difficile'];

// POST /api/quiz — génération de QCM par streaming SSE (fichier par fichier)
router.post('/quiz', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const quota = await checkQuota(req, 'quiz');
  if (!quota.ok) {
    send({ type: 'error', message: `Quota journalier atteint (${quota.limit} quiz/jour). Revenez demain.` });
    return res.end();
  }

  try {
    const { files }  = req.body;
    const lang       = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang     = langLabel(lang);
    const difficulty = VALID_DIFF.includes(req.body.difficulty) ? req.body.difficulty : 'moyen';
    const count      = Math.min(parseInt(req.body.count) || 5, LIMITS.quizMaxCount);

    const allResults  = [];
    let   streamModel = MODEL_LABEL;
    const aiCfg       = getJsonAiConfig();

    for (const file of files) {
      const text = await getFileText(file);
      if (!text.trim()) {
        send({ type: 'file_error', name: file.name, message: `Contenu de "${file.name}" vide ou indisponible.` });
        continue;
      }
      const truncated = text.slice(0, LIMITS.quizChars);
      send({ type: 'start', name: file.name });

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
      "explanation": "Explique clairement pourquoi la bonne réponse est correcte (2-3 phrases).",
      "whyWrong": {
        "B": "Explication courte de pourquoi B est incorrect.",
        "C": "Explication courte de pourquoi C est incorrect.",
        "D": "Explication courte de pourquoi D est incorrect."
      },
      "sourceHint": "Indique la notion ou le passage du cours à revoir pour consolider la réponse."
    }
  ]
}

Règles :
- Les distracteurs (mauvaises réponses) doivent être plausibles mais clairement incorrects si on maîtrise le cours.
- Les explications doivent être pédagogiques, concrètes et utiles pour réviser.
- whyWrong doit contenir une entrée pour chaque mauvaise option (toutes sauf answer).
- Réponds UNIQUEMENT avec le JSON, sans texte autour.

---
Contenu du cours "${file.name}" :
${truncated}`;

      let raw = '';
      for await (const chunk of aiStream(prompt, calcMaxTokens('quiz', truncated.length, count), aiCfg)) {
        if (chunk.usage) {
          logTokens(req.user?.id, 'quiz', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
          continue;
        }
        raw += chunk.text;
        streamModel = chunk.model;
      }

      const parsed = parseJsonResponse(raw, { questions: [] });
      const result  = { name: file.name, quiz: parsed };
      allResults.push(result);
      send({ type: 'done', name: file.name, questions: parsed.questions || [] });
    }

    send({ type: 'end', model: streamModel, results: allResults });
  } catch (err) {
    logger.error('AI quiz error', { userId: req.user?.id, message: err.message });
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

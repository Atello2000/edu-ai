const express = require('express');
const router  = express.Router();
const { aiComplete }                    = require('../../services/ai');
const { getAiConfigForAction }          = require('../../services/aiConfig');
const { LIMITS }                        = require('../../middleware/quota');
const { checkAndDeduct }                = require('../../services/jetons');
const { logTokens }                     = require('../../services/tokens');
const logger                            = require('../../services/logger');
const { langLabel, getFileText, parseJsonResponse } = require('./helpers');

// POST /api/predict — prédicteur de questions d'examen (SSE streaming)
router.post('/predict', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = data => { res.write(`data: ${JSON.stringify(data)}\n\n`); res.flush?.(); };

  try {
    const { files, lang } = req.body;
    if (!files?.length) {
      send({ type: 'error', message: 'Aucun fichier sélectionné' });
      return res.end();
    }

    // Coût : 3 jetons par fichier
    const totalCost = files.length * 3;

    const jeton = await checkAndDeduct(req.user?.id, 'predict', req.user?.plan || 'free', totalCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }

    const inLang = langLabel(lang || 'fr');
    const aiCfg  = await getAiConfigForAction('predict');
    let   lastModel = '';

    for (const file of files) {
      send({ type: 'file_start', name: file.name });

      const text = await getFileText(file);
      const trimmed = text.slice(0, LIMITS.summaryChars);

      const prompt = `Tu es un expert en analyse de cours et prédiction d'examens ${inLang}.
Analyse ce cours et prédit les 5 à 8 questions les plus susceptibles d'apparaître à l'examen.

Retourne UNIQUEMENT ce JSON:
{
  "predictions": [
    {
      "question": "Question telle qu'elle pourrait être formulée à l'examen",
      "probability": "haute|moyenne|faible",
      "concept": "Concept clé testé",
      "type": "définition|application|analyse|calcul|comparaison"
    }
  ]
}

Cours "${file.name}":
${trimmed}`;

      const { text: raw, usage } = await aiComplete(prompt, 1200, aiCfg);
      if (usage) {
        logTokens(req.user?.id, 'predict', usage.provider, usage.input, usage.output);
        if (usage.model) lastModel = usage.model;
      }

      const parsed = parseJsonResponse(raw, { predictions: [] });
      send({ type: 'file_done', name: file.name, predictions: parsed.predictions ?? [] });
    }

    send({ type: 'end', model: lastModel });
  } catch (err) {
    logger.error('AI predict error', { userId: req.user?.id, message: err.message });
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

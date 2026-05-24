const express = require('express');
const router  = express.Router();
const { aiStream, MODEL_LABEL }  = require('../../services/ai');
const { getUserAiConfig }        = require('../../services/aiConfig');
const { checkQuota }             = require('../../middleware/quota');
const { logTokens }              = require('../../services/tokens');
const logger                     = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText } = require('./helpers');

const EXAM_MAX_CHARS_PER_FILE = 18000;
const EXAM_MAX_FILES          = 5;
const EXAM_MAX_TOKENS         = 4200;

// POST /api/exam-sheet — fiche de révision dense en streaming SSE
router.post('/exam-sheet', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const quota = await checkQuota(req, 'summarize');
  if (!quota.ok) {
    send({ type: 'error', message: `Quota journalier atteint (${quota.limit} fiches/jour). Revenez demain.` });
    return res.end();
  }

  try {
    const { files } = req.body;
    if (!files?.length) {
      send({ type: 'error', message: 'Aucun fichier sélectionné' });
      return res.end();
    }

    const lang   = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang = langLabel(lang);

    let context = '';
    for (const file of files.slice(0, EXAM_MAX_FILES)) {
      const text = await getFileText(file);
      context += `\n\n=== ${file.name} ===\n${text.slice(0, EXAM_MAX_CHARS_PER_FILE)}`;
    }

    const prompt = `${userContext(req.user)}Tu es un enseignant exigeant qui prépare une fiche d'examen ${inLang}.

À partir des cours fournis, produis une fiche de révision dense, claire et directement exploitable avant un contrôle.

Structure exactement la réponse en Markdown avec ces sections :

## Priorités de révision
Liste les notions à apprendre en premier, par ordre d'importance.

## Définitions à connaître
Tableau avec Terme | Définition courte | À ne pas confondre avec.

## Tableaux comparatifs
Ajoute les comparaisons utiles du cours. Si aucun tableau n'est pertinent, écris une synthèse en bullets.

## Pièges fréquents
Liste les erreurs probables, les confusions, les détails qui font perdre des points.

## Questions probables
Propose 8 à 12 questions d'examen, avec une réponse attendue concise.

## Mini plan de révision
Propose un plan sur 3 jours : quoi relire, quoi mémoriser, quoi tester.

Cours :
${context}`;

    const aiCfg     = await getUserAiConfig(req.user?.id);
    let streamModel = MODEL_LABEL;
    for await (const chunk of aiStream(prompt, EXAM_MAX_TOKENS, aiCfg)) {
      if (chunk.usage) {
        logTokens(req.user?.id, 'exam-sheet', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
        continue;
      }
      send({ type: 'delta', text: chunk.text });
      streamModel = chunk.model;
    }

    send({ type: 'end', model: streamModel });
  } catch (err) {
    logger.error('AI exam-sheet error', { userId: req.user?.id, message: err.message });
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

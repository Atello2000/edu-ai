const express = require('express');
const router  = express.Router();
const { aiStream, calcMaxTokens, MODEL_LABEL } = require('../../services/ai');
const { getJsonAiConfig }                      = require('../../services/aiConfig');
const { LIMITS }                               = require('../../middleware/quota');
const { checkAndDeduct }                       = require('../../services/jetons');
const { logTokens }                            = require('../../services/tokens');
const logger                                   = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse } = require('./helpers');

// POST /api/flashcards — génération de flashcards par streaming SSE (fichier par fichier)
router.post('/flashcards', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = data => { res.write(`data: ${JSON.stringify(data)}\n\n`); res.flush?.(); };

  try {
    const jeton = await checkAndDeduct(req.user?.id, 'flashcards', req.user?.plan || 'free');
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    const { files } = req.body;
    const lang      = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang    = langLabel(lang);
    const count     = Math.min(parseInt(req.body.count) || 10, LIMITS.flashMaxCount);

    const allResults  = [];
    let   streamModel = MODEL_LABEL;
    const aiCfg       = await getJsonAiConfig();

    for (const file of files) {
      const text = await getFileText(file);
      if (!text.trim()) {
        send({ type: 'file_error', name: file.name, message: `Contenu de "${file.name}" vide ou indisponible.` });
        continue;
      }
      const truncated = text.slice(0, LIMITS.flashChars);
      send({ type: 'start', name: file.name });

      const prompt = `${userContext(req.user)}Tu es un assistant pédagogique. Génère ${count} flashcards ${inLang} pour aider à mémoriser les concepts essentiels.

Chaque flashcard doit avoir :
- Un RECTO : une question courte, un terme, ou un concept clé
- Un VERSO : la réponse claire et concise (2-4 phrases max)

Réponds UNIQUEMENT avec ce JSON, sans texte autour :
{
  "flashcards": [
    { "front": "...", "back": "..." }
  ]
}

---
Contenu du cours "${file.name}" :
${truncated}`;

      let raw = '';
      for await (const chunk of aiStream(prompt, calcMaxTokens('flash', truncated.length, count), aiCfg)) {
        if (chunk.usage) {
          logTokens(req.user?.id, 'flashcards', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
          continue;
        }
        raw += chunk.text;
        streamModel = chunk.model;
      }

      const parsed = parseJsonResponse(raw, { flashcards: [] });
      const cards  = parsed.flashcards || [];
      const result = { name: file.name, flashcards: cards }; // même format que l'ancien JSON pour restoreFrom
      allResults.push(result);
      send({ type: 'done', name: file.name, cards });
    }

    send({ type: 'end', model: streamModel, results: allResults });
  } catch (err) {
    logger.error('AI flashcards error', { userId: req.user?.id, message: err.message });
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

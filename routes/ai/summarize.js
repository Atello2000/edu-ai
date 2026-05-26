const express = require('express');
const router  = express.Router();
const { aiStream, calcMaxTokens, MODEL_LABEL } = require('../../services/ai');
const { getAiConfigForAction }                 = require('../../services/aiConfig');
const { LIMITS }                               = require('../../middleware/quota');
const { checkAndDeduct }                       = require('../../services/jetons');
const { logTokens }                            = require('../../services/tokens');
const logger                                   = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText } = require('./helpers');

// POST /api/summarize — résumé pédagogique en streaming SSE
router.post('/summarize', async (req, res) => {
  // Disable TCP Nagle buffering and proxy buffering for true streaming
  req.socket?.setNoDelay(true);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Railway/nginx proxy buffering
  res.flushHeaders();

  const send = data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    res.flush?.(); // flush compression middleware buffer if present
  };

  try {
    const jeton = await checkAndDeduct(req.user?.id, 'summarize', req.user?.plan || 'free');
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }

    const { files } = req.body;
    const lang      = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang    = langLabel(lang);
    const aiCfg     = await getAiConfigForAction('summarize');
    let streamModel = MODEL_LABEL;

    for (const file of files) {
      const text      = await getFileText(file);
      const truncated = text.slice(0, LIMITS.summaryChars);
      send({ type: 'start', name: file.name });

      const prompt = `${userContext(req.user)}Tu es un assistant pédagogique expert. Produis un résumé pédagogique complet ${inLang}, structuré en Markdown, avec exactement ce plan :

## 🎯 Objectifs du cours
(2-3 phrases sur ce que l'étudiant va apprendre)

## 📌 Points clés
(liste des 5-8 idées essentielles à retenir, sous forme de bullets)

## 📖 Résumé détaillé
(développement structuré avec sous-titres si nécessaire, paragraphes clairs)

## 🔑 Concepts importants
(définitions brèves des termes ou notions fondamentales du cours)

## 💡 À retenir
(1 encadré blockquote avec la leçon principale en 2-3 phrases)

---
Contenu du cours "${file.name}" :
${truncated}`;

      for await (const chunk of aiStream(prompt, calcMaxTokens('summary', truncated.length), aiCfg)) {
        if (chunk.usage) {
          logTokens(req.user?.id, 'summarize', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
          continue;
        }
        send({ type: 'delta', name: file.name, text: chunk.text });
        streamModel = chunk.model;
      }
      send({ type: 'done', name: file.name });
    }

    send({ type: 'model', name: streamModel });
    send({ type: 'end' });
  } catch (err) {
    logger.error('AI summarize error', { userId: req.user?.id, message: err.message });
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

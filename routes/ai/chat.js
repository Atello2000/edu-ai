const express = require('express');
const router  = express.Router();
const { aiChatStream }         = require('../../services/ai');
const { getUserAiConfig }      = require('../../services/aiConfig');
const { checkQuota, LIMITS }   = require('../../middleware/quota');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { userContext, getFileText } = require('./helpers');

// POST /api/chat — chat contextuel avec le cours, réponse en streaming SSE
router.post('/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = data => { res.write(`data: ${JSON.stringify(data)}\n\n`); res.flush?.(); };

  const quota = await checkQuota(req, 'chat');
  if (!quota.ok) {
    send({ type: 'error', message: `Quota journalier atteint (${quota.limit} messages/jour). Revenez demain.` });
    return res.end();
  }

  try {
    const { files, messages } = req.body;

    // Contexte cours
    let context = '';
    for (const file of files) {
      const text = await getFileText(file);
      context += `\n\n=== COURS : ${file.name} ===\n${text.slice(0, LIMITS.chatChars)}`;
    }

    const courseNames = files.map(f => `"${f.name}"`).join(', ');
    const ctx = userContext(req.user);
    const systemPrompt = `${ctx}Tu es un assistant pédagogique expert et bienveillant. Tu réponds aux questions de l'étudiant uniquement à partir des cours fournis. Sois clair, concis et pédagogique. Réponds toujours en français. Utilise du markdown pour structurer tes réponses (listes, gras). Si la question sort du contexte des cours, dis-le poliment.

Règle de citation : à la fin de ta réponse, si tu as utilisé des informations d'un cours précis, ajoute une ligne de sources sous cette forme exacte :
> 📖 Source : [nom du fichier]

Si plusieurs cours sont utilisés : > 📖 Sources : [fichier1], [fichier2]
Si la question est générale et n'utilise pas le cours : n'ajoute pas de source.

Cours disponibles (${courseNames}) :${context}`;

    const finalMessages = messages.slice(-10);
    let   fullText  = '';
    let   chatModel = '';

    const aiCfg = await getUserAiConfig(req.user?.id);
    for await (const chunk of aiChatStream(systemPrompt, finalMessages, 1024, false, aiCfg)) {
      if (chunk.usage) {
        logTokens(req.user?.id, 'chat', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
        continue;
      }
      fullText  += chunk.text;
      chatModel  = chunk.model;
      send({ type: 'delta', text: chunk.text });
    }

    send({ type: 'end', model: chatModel });
  } catch (err) {
    logger.error('AI chat error', { userId: req.user?.id, message: err.message });
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

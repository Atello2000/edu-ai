const express = require('express');
const router  = express.Router();
const { aiChatStream }         = require('../../services/ai');
const { checkQuota, LIMITS }   = require('../../middleware/quota');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { userContext, getFileText } = require('./helpers');

// POST /api/chat — chat contextuel avec le cours, réponse en streaming SSE
router.post('/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const quota = await checkQuota(req, 'chat');
  if (!quota.ok) {
    send({ type: 'error', message: `Quota journalier atteint (${quota.limit} messages/jour). Revenez demain.` });
    return res.end();
  }

  try {
    const { files, messages, attachedFile, attachedImage } = req.body;

    // Contexte cours
    let context = '';
    for (const file of files) {
      const text = await getFileText(file);
      context += `\n\n=== COURS : ${file.name} ===\n${text.slice(0, LIMITS.chatChars)}`;
    }

    // Fichier joint par l'étudiant (devoir, QCM…)
    // Le texte est extrait lors de l'upload et stocké dans attachedFile.text
    let attachedContext = '';
    if (attachedFile) {
      const text = attachedFile.text || '';
      attachedContext = `\n\n=== DOCUMENT SOUMIS PAR L'ÉTUDIANT : ${attachedFile.name} ===\n${text.slice(0, 12000)}`;
    }

    const imageNote = attachedImage
      ? `\n\nL'étudiant a également joint une image. Analyse-la en lien avec les cours.`
      : '';

    const ctx = userContext(req.user);
    const systemPrompt = attachedFile
      ? `${ctx}Tu es un assistant pédagogique expert. L'étudiant a joint un document (devoir, QCM, liste de questions, exercices…). Réponds à chaque question ou exercice de ce document en t'appuyant UNIQUEMENT sur les cours fournis. Structure ta réponse clairement (une section par question si possible), explique ton raisonnement, cite les notions du cours. Réponds toujours en français. Utilise du markdown (titres, gras, listes).

Cours de référence :${context}${attachedContext}${imageNote}`
      : `${ctx}Tu es un assistant pédagogique expert et bienveillant. Tu réponds aux questions de l'étudiant uniquement à partir des cours fournis. Sois clair, concis et pédagogique. Réponds toujours en français. Utilise du markdown pour structurer tes réponses (listes, gras). Si la question sort du contexte des cours, dis-le poliment.

Cours disponibles :${context}${imageNote}`;

    let finalMessages = messages.slice(-10);

    if (attachedImage && finalMessages.length > 0) {
      const last = finalMessages[finalMessages.length - 1];
      finalMessages[finalMessages.length - 1] = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: attachedImage.mimeType, data: attachedImage.base64 } },
          { type: 'text', text: typeof last.content === 'string' ? last.content : '' }
        ]
      };
    }

    const maxTok = attachedFile ? 3000 : attachedImage ? 2000 : 1024;
    let   fullText  = '';
    let   chatModel = '';

    for await (const chunk of aiChatStream(systemPrompt, finalMessages, maxTok, !!attachedImage)) {
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

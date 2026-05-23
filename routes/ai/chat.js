const express = require('express');
const router  = express.Router();
const { aiChat }               = require('../../services/ai');
const { extractText }          = require('../../services/text');
const { checkQuota, LIMITS }   = require('../../middleware/quota');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { userContext, getFileText } = require('./helpers');

// POST /api/chat — chat contextuel avec le cours (+ support image et fichier joint)
router.post('/chat', async (req, res) => {
  const quota = await checkQuota(req, 'chat');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} messages/jour). Revenez demain.` });

  try {
    const { files, messages, attachedFile, attachedImage } = req.body;

    // Contexte cours
    let context = '';
    for (const file of files) {
      const text = await getFileText(file);
      context += `\n\n=== COURS : ${file.name} ===\n${text.slice(0, LIMITS.chatChars)}`;
    }

    // Fichier joint par l'étudiant (devoir, QCM…)
    let attachedContext = '';
    if (attachedFile) {
      const text = await extractText(attachedFile.path, attachedFile.name);
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
    const { text, model, usage } = await aiChat(systemPrompt, finalMessages, maxTok, !!attachedImage);
    logTokens(req.user?.id, 'chat', usage?.provider, usage?.input, usage?.output);
    res.json({ success: true, response: text, model });
  } catch (err) {
    logger.error('AI chat error', { userId: req.user?.id, message: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

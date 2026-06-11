const express = require('express');
const router  = express.Router();
const { aiChatStream }            = require('../../services/ai');
const { getAiConfigForAction }    = require('../../services/aiConfig');
const { LIMITS }               = require('../../middleware/quota');
const { checkAndDeduct, refundJetons } = require('../../services/jetons');
const { prepare }              = require('../../db');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { userContext, getFileText, sseSetup, clientErrorMessage } = require('./helpers');

// POST /api/chat — chat contextuel avec le cours, réponse en streaming SSE
router.post('/chat', async (req, res) => {
  const send = sseSetup(req, res);
  let deducted = 0; // jetons à rembourser si l'IA échoue après déduction

  try {
    const { files = [], messages } = req.body;
    // En local uniquement, le chat peut s'ouvrir sans fichiers (les documents
    // s'attachent ensuite depuis le chat). En production, un contexte de
    // cours reste obligatoire.
    const isLocalDev = process.env.NODE_ENV !== 'production';
    if (!files.length && !isLocalDev) {
      send({ type: 'error', message: 'Aucun fichier sélectionné' });
      return res.end();
    }

    // Coût dynamique : conversation longue = 2 jetons.
    // Compté côté serveur (appels chat facturés sur les 30 dernières minutes) :
    // le tableau `messages` est fourni par le client et donc falsifiable —
    // un client modifié pourrait tronquer l'historique pour payer 1 jeton à vie.
    let chatCost = 1;
    try {
      const recent = await prepare(`
        SELECT COUNT(*) AS n FROM jeton_transactions
        WHERE user_id = ? AND action = 'chat' AND created_at > NOW() - INTERVAL '30 minutes'
      `).get(req.user?.id);
      if (Number(recent?.n || 0) >= 2) chatCost = 2;
    } catch { /* en cas d'erreur DB, tarif de base */ }

    const jeton = await checkAndDeduct(req.user?.id, 'chat', req.user?.plan || 'free', chatCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    deducted = jeton.cost || 0;

    // Contexte cours
    let context = '';
    const isLocalOrAdmin = process.env.NODE_ENV !== 'production' || !!req.user?.is_admin;
    for (const file of files) {
      const text = await getFileText(file);
      if (isLocalOrAdmin) {
        context += `\n\n=== COURS : ${file.name} ===\n${text}`;
      } else {
        context += `\n\n=== COURS : ${file.name} ===\n${text.slice(0, LIMITS.chatChars)}`;
      }
    }

    const courseNames = files.map(f => `"${f.name}"`).join(', ');
    const ctx = userContext(req.user);
    const speedPromptStyle = isLocalOrAdmin
      ? "Sois clair, complet, précis et pédagogique, et n'hésite pas à détailler tes explications."
      : "Sois clair, concis et pédagogique.";

    // Sans fichiers (chat vide, local uniquement) : assistant général — le
    // prompt « uniquement à partir des cours fournis » ferait tout refuser.
    const systemPrompt = !files.length
      ? `${ctx}Tu es un assistant pédagogique expert et bienveillant. Tu réponds aux questions de l'étudiant. ${speedPromptStyle} Réponds toujours en français. Utilise du markdown pour structurer tes réponses (listes, gras).`
      : `${ctx}Tu es un assistant pédagogique expert et bienveillant. Tu réponds aux questions de l'étudiant uniquement à partir des cours fournis. ${speedPromptStyle} Réponds toujours en français. Utilise du markdown pour structurer tes réponses (listes, gras). Si la question sort du contexte des cours, dis-le poliment.

Règle de citation : à la fin de ta réponse, si tu as utilisé des informations d'un cours précis, ajoute une ligne de sources sous cette forme exacte :
> 📖 Source : [nom du fichier]

Si plusieurs cours sont utilisés : > 📖 Sources : [fichier1], [fichier2]
Si la question est générale et n'utilise pas le cours : n'ajoute pas de source.

Cours disponibles (${courseNames}) :${context}`;

    const finalMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10);
    let   fullText  = '';
    let   chatModel = '';

    const aiCfg = await getAiConfigForAction('chat');
    const maxTokens = isLocalOrAdmin ? 8192 : 2048;
    for await (const chunk of aiChatStream(systemPrompt, finalMessages, maxTokens, false, aiCfg)) {
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
    await refundJetons(req.user?.id, 'chat', deducted);
    send({ type: 'error', message: clientErrorMessage(err) });
  }
  res.end();
});

module.exports = router;

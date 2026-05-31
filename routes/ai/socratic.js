const express = require('express');
const router  = express.Router();
const { aiChatStream }            = require('../../services/ai');
const { getAiConfigForAction }    = require('../../services/aiConfig');
const { checkAndDeduct, refundJetons } = require('../../services/jetons');
const { logTokens }               = require('../../services/tokens');
const logger                      = require('../../services/logger');
const { userContext, getFileText, sseSetup } = require('./helpers');

// POST /api/socratic — mode socratique (SSE streaming, chat-like)
router.post('/socratic', async (req, res) => {
  const send = sseSetup(req, res);
  let deducted = 0; // jetons à rembourser si l'IA échoue après déduction

  try {
    const { files, history, lang } = req.body;

    // Validation : fichier obligatoire
    const fileItem = Array.isArray(files) ? files[0] : files;
    if (!fileItem) {
      send({ type: 'error', message: 'Aucun fichier sélectionné pour le mode socratique.' });
      return res.end();
    }

    // Coût dynamique : conversation longue (>= 6 échanges) = 2 jetons
    const historyLen   = Array.isArray(history) ? history.length : 0;
    const socraticCost = historyLen >= 6 ? 2 : 1;

    const jeton = await checkAndDeduct(req.user?.id, 'socratic', req.user?.plan || 'free', socraticCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    deducted = jeton.cost || 0;

    // Lire le texte du cours (premier fichier — déjà validé ci-dessus)
    const fullText = await getFileText(fileItem);

    let systemPrompt;

    if (historyLen === 0) {
      // Premier appel : générer la PREMIÈRE question
      const courseText = fullText.slice(0, 4000);
      systemPrompt = `Tu es un tuteur pédagogique utilisant la méthode socratique. À partir du cours fourni, engage un dialogue d'apprentissage en posant des questions ouvertes qui font réfléchir l'étudiant.

Règles STRICTES:
- Pose UNE SEULE question sur un concept fondamental du cours
- La question doit amener à réfléchir, pas juste réciter
- Commence DIRECTEMENT par la question (sans intro)
- Sois bienveillant et encourageant
- Max 3 phrases

Cours: ${courseText}`;
    } else {
      // Appel de suivi : évaluer la réponse + générer la prochaine question
      const courseText = fullText.slice(0, 2000);
      systemPrompt = `Tu es un tuteur pédagogique utilisant la méthode socratique.

Cours de référence: ${courseText}

Règles STRICTES:
1. Évalue la réponse de l'étudiant en 1-2 phrases (🟢 Correct / 🟡 Partiel / 🔴 Incorrect)
2. Si correct: approfondis avec une question de suivi ou un nouveau concept
3. Si partiel/incorrect: guide sans donner la réponse, reformule
4. Format: commence par l'évaluation, puis "**Question :**" suivi de la nouvelle question
5. Max 5 phrases au total`;
    }

    const messages   = Array.isArray(history) ? history.slice(-10) : [];
    let   chatModel  = '';

    const aiCfg = await getAiConfigForAction('socratic');
    for await (const chunk of aiChatStream(systemPrompt, messages, 512, false, aiCfg)) {
      if (chunk.usage) {
        logTokens(req.user?.id, 'socratic', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
        continue;
      }
      chatModel = chunk.model;
      send({ type: 'delta', text: chunk.text });
    }

    send({ type: 'end', model: chatModel });
  } catch (err) {
    logger.error('AI socratic error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'socratic', deducted);
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

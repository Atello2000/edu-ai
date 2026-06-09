/**
 * routes/jetons.js — solde et historique des jetons de l'utilisateur
 */
const express = require('express');
const router  = express.Router();
const { requireAuth }             = require('../middleware/auth');
const { getBalance, JETON_COSTS, MONTHLY_JETONS } = require('../services/jetons');
const { getAiConfigForAction } = require('../services/aiConfig');
const { chunkSizeFor } = require('../services/chunker');

const ACTIONS_WITH_CHUNKS = ['summarize', 'quiz', 'flashcards', 'exam-sheet', 'mindmap', 'glossary', 'predict'];

async function getActiveChunkSizes() {
  const chunkSizes = {};
  for (const act of ACTIONS_WITH_CHUNKS) {
    try {
      const cfg = await getAiConfigForAction(act, { lang: 'fr', textLength: 0 });
      chunkSizes[act] = chunkSizeFor(cfg.provider);
    } catch {
      chunkSizes[act] = 80000;
    }
  }
  return chunkSizes;
}

// GET /api/jetons/prices — coûts publics (pas d'auth, pour UI et landing)
router.get('/jetons/prices', async (req, res) => {
  try {
    const chunkSizes = await getActiveChunkSizes();
    res.json({
      costs: JETON_COSTS,
      session: (JETON_COSTS.summarize || 3) + (JETON_COSTS.quiz || 2) + (JETON_COSTS.flashcards || 2),
      chunkSizes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jetons — solde + historique + config des coûts
router.get('/jetons', requireAuth, async (req, res) => {
  try {
    const plan    = req.user.plan || 'free';
    const { balance, reset_date, history } = await getBalance(req.user.id);
    const monthly = MONTHLY_JETONS[plan] ?? MONTHLY_JETONS.free;
    const chunkSizes = await getActiveChunkSizes();

    res.json({
      balance,
      monthly_allocation: monthly,
      reset_date,
      costs: JETON_COSTS,
      chunkSizes,
      history,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


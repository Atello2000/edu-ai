/**
 * routes/jetons.js — solde et historique des jetons de l'utilisateur
 */
const express = require('express');
const router  = express.Router();
const { requireAuth }             = require('../middleware/auth');
const { getBalance, JETON_COSTS, MONTHLY_JETONS } = require('../services/jetons');

// GET /api/jetons/prices — coûts publics (pas d'auth, pour UI et landing)
router.get('/jetons/prices', (req, res) => {
  res.json({
    costs: JETON_COSTS,
    session: (JETON_COSTS.summarize || 3) + (JETON_COSTS.quiz || 2) + (JETON_COSTS.flashcards || 2),
  });
});

// GET /api/jetons — solde + historique + config des coûts
router.get('/jetons', requireAuth, async (req, res) => {
  try {
    const plan    = req.user.plan || 'free';
    const { balance, reset_date, history } = await getBalance(req.user.id);
    const monthly = MONTHLY_JETONS[plan] ?? MONTHLY_JETONS.free;

    res.json({
      balance,
      monthly_allocation: monthly,
      reset_date,
      costs: JETON_COSTS,
      history,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

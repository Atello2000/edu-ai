/**
 * services/jetons.js — système de crédits (jetons) par action
 *
 * Coûts identiques quel que soit le plan.
 * La différence entre plans = allocation mensuelle (free:30, pro:500, max:200).
 *
 * Rechargement automatique mensuel selon le plan.
 * Toutes les écritures sont atomiques (UPDATE … WHERE jetons >= cost).
 */

const { prepare } = require('../db');

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Coûts par action (mêmes pour tous les plans) ──────────────────────────────
const JETON_COSTS = {
  summarize:    3,
  quiz:         4,
  flashcards:   3,
  chat:         1,
  'exam-sheet': 3,
  glossary:     2,
  mindmap:      2,
};

// ── Allocation mensuelle par plan ─────────────────────────────────────────────
const MONTHLY_JETONS = {
  free: 30,   // ~7 quiz/mois
  pro:  200,  // ~50 quiz/mois
  max:  600,  // ~150 quiz/mois
};

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

/**
 * Recharge les jetons si le mois a changé.
 * Atomique : une seule requête par mois déclenche le rechargement.
 */
async function refillIfNeeded(userId, plan) {
  const month      = getCurrentMonth();
  const allocation = MONTHLY_JETONS[plan] ?? MONTHLY_JETONS.free;

  await prepare(`
    UPDATE users
    SET jetons = ?, jetons_reset_date = ?
    WHERE id = ? AND (jetons_reset_date IS NULL OR jetons_reset_date < ?)
  `).run(allocation, month, userId, month);
}

/**
 * Vérifie le solde et déduit le coût de l'action.
 * En développement : toujours OK.
 * Retourne { ok: true } ou { ok: false, needed, balance }.
 */
async function checkAndDeduct(userId, action, plan) {
  if (!IS_PROD) return { ok: true };

  const cost = JETON_COSTS[action] ?? 1;

  // Rechargement mensuel si besoin
  await refillIfNeeded(userId, plan);

  // Déduction atomique : échoue si solde insuffisant
  const row = await prepare(`
    UPDATE users
    SET jetons = jetons - ?
    WHERE id = ? AND jetons >= ?
    RETURNING jetons AS balance
  `).get(cost, userId, cost);

  if (!row) {
    const cur = await prepare('SELECT jetons FROM users WHERE id = ?').get(userId);
    return { ok: false, needed: cost, balance: cur?.jetons ?? 0 };
  }

  // Historique (non-bloquant)
  prepare(`
    INSERT INTO jeton_transactions (user_id, action, amount, balance_after)
    VALUES (?, ?, ?, ?)
  `).run(userId, action, -cost, row.balance).catch(() => {});

  return { ok: true, balance: row.balance };
}

/**
 * Ajoute des jetons à un utilisateur (admin ou rechargement commercial).
 */
async function addJetons(userId, amount, note = '') {
  const row = await prepare(`
    UPDATE users SET jetons = jetons + ? WHERE id = ? RETURNING jetons AS balance
  `).get(amount, userId);

  if (row) {
    prepare(`
      INSERT INTO jeton_transactions (user_id, action, amount, balance_after, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, 'admin_credit', amount, row.balance, note).catch(() => {});
  }
  return row?.balance ?? 0;
}

/**
 * Solde et historique récent d'un utilisateur.
 */
async function getBalance(userId) {
  const user = await prepare(
    'SELECT jetons, jetons_reset_date FROM users WHERE id = ?'
  ).get(userId);
  const history = await prepare(`
    SELECT action, amount, balance_after, note, created_at
    FROM jeton_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(userId);
  return {
    balance:     user?.jetons ?? 0,
    reset_date:  user?.jetons_reset_date,
    history,
  };
}

module.exports = { JETON_COSTS, MONTHLY_JETONS, checkAndDeduct, addJetons, getBalance, refillIfNeeded };

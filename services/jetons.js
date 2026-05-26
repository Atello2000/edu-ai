/**
 * services/jetons.js — système de crédits (jetons) par action et par plan
 *
 * Coûts :
 *   max  = 0 jetons (illimité)
 *   pro  = tarif réduit
 *   free = tarif plein
 *
 * Rechargement automatique mensuel selon le plan.
 * Toutes les écritures sont atomiques (UPDATE … WHERE jetons >= cost).
 */

const { prepare } = require('../db');

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Coûts par action et par plan ──────────────────────────────────────────────
const JETON_COSTS = {
  summarize:    { free: 3, pro: 2, max: 0 },
  quiz:         { free: 4, pro: 3, max: 0 },
  flashcards:   { free: 3, pro: 2, max: 0 },
  chat:         { free: 1, pro: 1, max: 0 },
  'exam-sheet': { free: 3, pro: 2, max: 0 },
  glossary:     { free: 2, pro: 1, max: 0 },
  mindmap:      { free: 2, pro: 1, max: 0 },
};

// ── Allocation mensuelle par plan ─────────────────────────────────────────────
const MONTHLY_JETONS = {
  free: 30,
  pro:  500,
  max:  -1,   // -1 = illimité (plan max ne consomme jamais)
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
  if (allocation === -1) return; // max plan = pas de gestion de solde

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

  const costs = JETON_COSTS[action] || {};
  const cost  = (plan in costs) ? costs[plan] : (costs.free ?? 1);

  // Plan max = gratuit, pas de déduction
  if (cost === 0) return { ok: true };

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

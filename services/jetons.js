/**
 * services/jetons.js — système de crédits (jetons) par action
 *
 * Coûts identiques quel que soit le plan.
 * La différence entre plans = allocation mensuelle (free:80, pro:150, max:400).
 *
 * Crédit des jetons à chaque paiement confirmé.
 * Toutes les écritures sont atomiques (UPDATE … WHERE jetons >= cost).
 */

const { prepare } = require('../db');

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Coûts par action (mêmes pour tous les plans) ──────────────────────────────
const JETON_COSTS = {
  summarize:       3,
  quiz:            2,   // augmenté (coût API comparable à résumé court)
  flashcards:      2,   // augmenté
  chat:            1,
  'exam-sheet':    3,
  glossary:        2,
  mindmap:         2,
  socratic:        1,   // per exchange (dynamic: 2 if history >= 6)
  'study-plan':    1,
  predict:         2,
  'error-analysis':1,
  compare:         4,
};

// ── Allocation par plan ───────────────────────────────────────────────────────
// Free : 80 jetons offerts une seule fois à l'inscription (pas de rechargement mensuel).
// Pro/Max : allocation créditée au paiement de chaque période.
const MONTHLY_JETONS = {
  free: 80,   // allocation unique à l'inscription
  pro:  150,  // ~75 quiz ou ~30 sessions complètes/mois
  max:  400,  // ~200 quiz ou ~80 sessions complètes/mois
};

// Credits are granted once by each confirmed payment, never by calendar month.
// Expiring an entitlement must not erase the remaining purchased balance.
async function refillIfNeeded(userId, plan) {
  await prepare("UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ? AND plan_expires_at <= NOW()")
    .run(userId);
  const user = await prepare('SELECT plan FROM users WHERE id = ?').get(userId);
  return user?.plan || plan || 'free';
}

/**
 * Vérifie le solde et déduit le coût de l'action.
 * En développement : toujours OK.
 * Retourne { ok: true } ou { ok: false, needed, balance }.
 */
/**
 * costOverride : passe un coût personnalisé (ex. chat long = 2 jetons).
 * Si null, utilise JETON_COSTS[action].
 */
async function checkAndDeduct(userId, action, plan, costOverride = null) {
  // Hors production : bypass systématique (test + dev local)
  if (!IS_PROD) return { ok: true };

  const cost = costOverride !== null ? Number(costOverride) : (JETON_COSTS[action] ?? 1);

  // Vérifier seulement l’expiration du plan, sans modifier les crédits
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

  // `cost` est renvoyé pour permettre un remboursement exact si l'IA échoue.
  return { ok: true, balance: row.balance, cost };
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
 * Rembourse des jetons après l'échec d'une action (erreur IA / serveur).
 * No-op en dev (rien n'a été déduit) ou si amount <= 0 / userId absent.
 * Tolérant aux erreurs : un échec de remboursement ne doit jamais casser la
 * réponse d'erreur déjà en cours d'envoi au client.
 */
async function refundJetons(userId, action, amount) {
  if (!IS_PROD || !userId || !(amount > 0)) return;
  try {
    const row = await prepare(`
      UPDATE users SET jetons = jetons + ? WHERE id = ? RETURNING jetons AS balance
    `).get(amount, userId);
    if (row) {
      prepare(`
        INSERT INTO jeton_transactions (user_id, action, amount, balance_after, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, `refund:${action}`, amount, row.balance, 'remboursement échec IA').catch(() => {});
    }
  } catch (_) { /* best-effort : ne jamais propager */ }
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

module.exports = { JETON_COSTS, MONTHLY_JETONS, checkAndDeduct, addJetons, refundJetons, getBalance, refillIfNeeded };

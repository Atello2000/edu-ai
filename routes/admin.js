const express = require('express');
const router  = express.Router();
const { prepare } = require('../db');
const { PROVIDERS, getAiConfig, setAiConfig, setUserAiConfig, getUserAiConfig } = require('../services/aiConfig');
const { addJetons, getBalance, JETON_COSTS, MONTHLY_JETONS } = require('../services/jetons');
const logger = require('../services/logger');

function parseId(str) {
  const n = parseInt(str, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function requireAdmin(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Accès refusé.' });
  next();
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const users = await prepare(`
    SELECT u.id, u.email, u.name, u.plan, u.created_at,
      COALESCE(q.summarize,  0) AS q_summarize,
      COALESCE(q.quiz,       0) AS q_quiz,
      COALESCE(q.flashcards, 0) AS q_flashcards,
      COALESCE(q.chat,       0) AS q_chat,
      COALESCE(t.total_tokens, 0) AS total_tokens,
      COALESCE(t.input_tokens,  0) AS input_tokens,
      COALESCE(t.output_tokens, 0) AS output_tokens
    FROM users u
    LEFT JOIN user_quota q ON q.user_id = u.id AND q.date = ?
    LEFT JOIN (
      SELECT user_id,
        SUM(input_tokens + output_tokens) AS total_tokens,
        SUM(input_tokens)  AS input_tokens,
        SUM(output_tokens) AS output_tokens
      FROM token_usage GROUP BY user_id
    ) t ON t.user_id = u.id
    ORDER BY u.created_at DESC
  `).all(today);
  res.json({ users });
});

// ── PATCH /api/admin/users/:id/plan ──────────────────────────────────────────
router.patch('/users/:id/plan', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide.' });
  const { plan } = req.body;
  if (!['free', 'pro', 'max'].includes(plan))
    return res.status(400).json({ error: 'Plan invalide.' });
  await prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, id);
  logger.info('ADMIN', { action: 'update_plan', adminId: req.user.id, targetId: id, plan });
  res.json({ ok: true });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide.' });
  await prepare('DELETE FROM users WHERE id = ?').run(id);
  logger.info('ADMIN', { action: 'delete_user', adminId: req.user.id, targetId: id });
  res.json({ ok: true });
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const totalRow   = await prepare('SELECT COUNT(*) AS n FROM users').get();
  const proRow     = await prepare("SELECT COUNT(*) AS n FROM users WHERE plan='pro'").get();
  const maxRow     = await prepare("SELECT COUNT(*) AS n FROM users WHERE plan='max'").get();
  const todayRow   = await prepare('SELECT COUNT(DISTINCT user_id) AS n FROM user_quota WHERE date = ?').get(today);
  const total = Number(totalRow?.n || 0);
  const pro   = Number(proRow?.n || 0);
  const max   = Number(maxRow?.n || 0);
  res.json({ total, pro, max, free: total - pro - max, active_today: Number(todayRow?.n || 0) });
});

// ── GET /api/admin/tokens ─────────────────────────────────────────────────────
router.get('/tokens', requireAdmin, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const todayRow = await prepare(`
    SELECT COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output,
           COALESCE(SUM(input_tokens+output_tokens),0) AS total
    FROM token_usage WHERE date = ?
  `).get(today);

  const allRow = await prepare(`
    SELECT COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output,
           COALESCE(SUM(input_tokens+output_tokens),0) AS total
    FROM token_usage
  `).get();

  const byProvider = await prepare(`
    SELECT provider, SUM(input_tokens) AS input, SUM(output_tokens) AS output
    FROM token_usage GROUP BY provider ORDER BY output DESC
  `).all();

  const byAction = await prepare(`
    SELECT action, SUM(input_tokens+output_tokens) AS total, SUM(output_tokens) AS output
    FROM token_usage GROUP BY action ORDER BY total DESC
  `).all();

  res.json({ today: todayRow, allTime: allRow, byProvider, byAction });
});

// ── GET /api/admin/messages ───────────────────────────────────────────────────
router.get('/messages', requireAdmin, async (req, res) => {
  const messages = await prepare(`
    SELECT m.id, m.message, m.created_at, m.is_read,
           u.name AS user_name, u.email AS user_email, u.plan AS user_plan
    FROM user_messages m
    JOIN users u ON u.id = m.user_id
    ORDER BY m.created_at DESC
    LIMIT 200
  `).all();
  const unread = messages.filter(m => !m.is_read).length;
  res.json({ messages, unread });
});

// ── PATCH /api/admin/messages/:id/read ───────────────────────────────────────
router.patch('/messages/:id/read', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide.' });
  await prepare('UPDATE user_messages SET is_read = 1 WHERE id = ?').run(id);
  logger.info('ADMIN', { action: 'mark_message_read', adminId: req.user.id, targetId: id });
  res.json({ ok: true });
});

// ── DELETE /api/admin/messages/:id ───────────────────────────────────────────
router.delete('/messages/:id', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide.' });
  await prepare('DELETE FROM user_messages WHERE id = ?').run(id);
  logger.info('ADMIN', { action: 'delete_message', adminId: req.user.id, targetId: id });
  res.json({ ok: true });
});

// ── GET /api/admin/ai-config ──────────────────────────────────────────────────
router.get('/ai-config', requireAdmin, async (req, res) => {
  const cfg = await getAiConfig(); // config globale
  const providers = Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label:     p.label,
    available: !!process.env[p.envKey],
    models:    p.models,
  }));
  res.json({ ...cfg, providers });
});

// ── PATCH /api/admin/ai-config ────────────────────────────────────────────────
router.patch('/ai-config', requireAdmin, async (req, res) => {
  const { provider, model } = req.body;
  if (!PROVIDERS[provider])
    return res.status(400).json({ error: 'Provider invalide.' });
  const validModels = PROVIDERS[provider].models.map(m => m.id);
  if (!validModels.includes(model))
    return res.status(400).json({ error: 'Modèle invalide pour ce provider.' });
  await setAiConfig(provider, model);
  logger.info('ADMIN', { action: 'update_ai_config', adminId: req.user.id, provider, model });
  res.json({ ok: true, provider, model });
});

// ── GET /api/admin/jetons — config et stats globales ─────────────────────────
router.get('/jetons', requireAdmin, async (req, res) => {
  const users = await prepare(`
    SELECT u.id, u.email, u.name, u.plan, u.jetons, u.jetons_reset_date,
           COALESCE(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 0) AS total_spent
    FROM users u
    LEFT JOIN jeton_transactions t ON t.user_id = u.id
    GROUP BY u.id, u.email, u.name, u.plan, u.jetons, u.jetons_reset_date
    ORDER BY u.created_at DESC
  `).all();
  res.json({ users, costs: JETON_COSTS, monthly: MONTHLY_JETONS });
});

// ── POST /api/admin/users/:id/jetons — ajouter/retirer des jetons ─────────────
router.post('/users/:id/jetons', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide.' });
  const { amount, note } = req.body;
  if (!amount || isNaN(amount))
    return res.status(400).json({ error: 'amount invalide' });
  const newBalance = await addJetons(id, Number(amount), note || '');
  logger.info('ADMIN', { action: 'adjust_jetons', adminId: req.user.id, targetId: id, amount: Number(amount), note });
  res.json({ ok: true, balance: newBalance });
});

// ── PATCH /api/admin/users/:id/jetons — définir un solde exact ───────────────
router.patch('/users/:id/jetons', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide.' });
  const { balance } = req.body;
  if (balance === undefined || isNaN(balance))
    return res.status(400).json({ error: 'balance invalide' });
  await prepare('UPDATE users SET jetons = ? WHERE id = ?').run(Number(balance), id);
  logger.info('ADMIN', { action: 'set_jetons', adminId: req.user.id, targetId: id, balance: Number(balance) });
  res.json({ ok: true, balance: Number(balance) });
});

// ── GET /api/admin/analytics ─────────────────────────────────────────────────
// Agrège 3 blocs : usage features, coût providers, conversion utilisateurs
router.get('/analytics', requireAdmin, async (req, res) => {
  const [features, providers, conversion, revenue, growth] = await Promise.all([

    // 1. Features les plus utilisées (7 derniers jours, depuis jeton_transactions)
    prepare(`
      SELECT action,
             COUNT(*)        AS nb_uses,
             SUM(-amount)    AS jetons_consumed
      FROM jeton_transactions
      WHERE amount < 0
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY action
      ORDER BY jetons_consumed DESC
    `).all(),

    // 2. Coût par provider IA (30 derniers jours)
    prepare(`
      SELECT provider,
             COUNT(*)                          AS nb_calls,
             COALESCE(SUM(input_tokens),  0)   AS tokens_in,
             COALESCE(SUM(output_tokens), 0)   AS tokens_out
      FROM token_usage
      WHERE date >= to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD')
      GROUP BY provider
      ORDER BY tokens_out DESC
    `).all(),

    // 3. Conversion funnel
    prepare(`
      SELECT
        COUNT(*)                                                    AS total,
        COUNT(*) FILTER (WHERE plan = 'free')                      AS free,
        COUNT(*) FILTER (WHERE plan = 'pro')                       AS pro,
        COUNT(*) FILTER (WHERE plan = 'max')                       AS max,
        COUNT(*) FILTER (WHERE email_verified = 1)                 AS verified,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')  AS new_7d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_30d
      FROM users
    `).get(),

    // 4. Revenu total des 30 derniers jours (depuis table payments)
    prepare(`
      SELECT
        COALESCE(SUM(amount), 0)    AS total_xof,
        COUNT(*)                    AS nb_transactions
      FROM payments
      WHERE created_at > NOW() - INTERVAL '30 days'
    `).get(),

    // 5. Croissance hebdomadaire des inscrits (4 dernières semaines)
    prepare(`
      SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
             COUNT(*) AS new_users
      FROM users
      WHERE created_at > NOW() - INTERVAL '4 weeks'
      GROUP BY 1 ORDER BY 1
    `).all(),
  ]);

  res.json({ features, providers, conversion, revenue, growth });
});

module.exports = router;

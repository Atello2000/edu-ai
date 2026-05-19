const express = require('express');
const router  = express.Router();
const { prepare } = require('../db');
const { requireAuth } = require('../middleware/auth');

function requireAdmin(req, res, next) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!adminEmail) return res.status(403).json({ error: 'Admin non configuré.' });
  if (req.user.email.toLowerCase() !== adminEmail)
    return res.status(403).json({ error: 'Accès refusé.' });
  next();
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const users = await prepare(`
    SELECT u.id, u.email, u.name, u.plan, u.created_at,
      COALESCE(q.summarize,  0) AS q_summarize,
      COALESCE(q.quiz,       0) AS q_quiz,
      COALESCE(q.flashcards, 0) AS q_flashcards,
      COALESCE(q.chat,       0) AS q_chat
    FROM users u
    LEFT JOIN user_quota q ON q.user_id = u.id AND q.date = ?
    ORDER BY u.created_at DESC
  `).all(today);
  res.json({ users });
});

// ── PATCH /api/admin/users/:id/plan ──────────────────────────────────────────
router.patch('/users/:id/plan', requireAuth, requireAdmin, async (req, res) => {
  const { plan } = req.body;
  if (!['free', 'pro', 'max'].includes(plan))
    return res.status(400).json({ error: 'Plan invalide.' });
  await prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.params.id);
  res.json({ ok: true });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  await prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
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
router.get('/tokens', requireAuth, requireAdmin, async (req, res) => {
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

module.exports = router;

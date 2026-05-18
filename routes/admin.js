const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

function requireAdmin(req, res, next) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!adminEmail) return res.status(403).json({ error: 'Admin non configuré.' });
  if (req.user.email.toLowerCase() !== adminEmail)
    return res.status(403).json({ error: 'Accès refusé.' });
  next();
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const users = db.prepare(`
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
router.patch('/users/:id/plan', requireAuth, requireAdmin, (req, res) => {
  const { plan } = req.body;
  if (!['free', 'pro', 'max'].includes(plan))
    return res.status(400).json({ error: 'Plan invalide.' });
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.params.id);
  res.json({ ok: true });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const total    = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const proCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE plan='pro'").get().n;
  const todayAct = db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM user_quota WHERE date = ?').get(today).n;
  res.json({ total, pro: proCount, free: total - proCount, active_today: todayAct });
});

// ── GET /api/admin/tokens ─────────────────────────────────────────────────────
router.get('/tokens', requireAuth, requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const todayRow = db.prepare(`
    SELECT COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output,
           COALESCE(SUM(input_tokens+output_tokens),0) AS total
    FROM token_usage WHERE date = ?
  `).get(today);

  const allRow = db.prepare(`
    SELECT COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output,
           COALESCE(SUM(input_tokens+output_tokens),0) AS total
    FROM token_usage
  `).get();

  const byProvider = db.prepare(`
    SELECT provider, SUM(input_tokens) AS input, SUM(output_tokens) AS output
    FROM token_usage GROUP BY provider ORDER BY output DESC
  `).all();

  const byAction = db.prepare(`
    SELECT action, SUM(input_tokens+output_tokens) AS total, SUM(output_tokens) AS output
    FROM token_usage GROUP BY action ORDER BY total DESC
  `).all();

  res.json({ today: todayRow, allTime: allRow, byProvider, byAction });
});

module.exports = router;

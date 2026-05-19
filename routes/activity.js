const express = require('express');
const router  = express.Router();
const db      = require('../db');

function calcStreak(userId) {
  const rows = db.prepare(
    `SELECT DISTINCT date(created_at) as d FROM activity WHERE user_id = ? ORDER BY d DESC`
  ).all(userId).map(r => r.d);

  if (!rows.length) return 0;

  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // If no activity today or yesterday, streak is broken
  if (rows[0] !== today && rows[0] !== yesterday) return 0;

  let streak  = 0;
  let current = rows[0];
  for (const d of rows) {
    if (d === current) {
      streak++;
      const dt = new Date(current);
      dt.setDate(dt.getDate() - 1);
      current = dt.toISOString().slice(0, 10);
    } else {
      break;
    }
  }
  return streak;
}

// ── POST /api/activity ────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { topic, type, score, total } = req.body || {};
  if (!topic || !['flashcards', 'quiz'].includes(type))
    return res.status(400).json({ error: 'Paramètres invalides.' });

  db.prepare(
    'INSERT INTO activity (user_id, topic, type, score, total) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, topic.trim().slice(0, 120), type, score ?? null, total ?? null);

  res.json({ ok: true });
});

// ── GET /api/activity/summary ─────────────────────────────────────────────────
router.get('/summary', (req, res) => {
  const uid = req.user.id;

  const totalSessions = db.prepare(
    'SELECT COUNT(*) as n FROM activity WHERE user_id = ?'
  ).get(uid).n;

  const recentActivity = db.prepare(
    `SELECT topic, type, score, total, created_at
     FROM activity WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 7`
  ).all(uid);

  // Top topics by frequency
  const topTopics = db.prepare(
    `SELECT topic, COUNT(*) as n FROM activity
     WHERE user_id = ?
     GROUP BY topic ORDER BY n DESC LIMIT 6`
  ).all(uid);

  const streak = calcStreak(uid);

  res.json({ streak, totalSessions, recentActivity, topTopics });
});

module.exports = router;

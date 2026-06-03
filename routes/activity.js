const express = require('express');
const router  = express.Router();
const { prepare } = require('../db');
const logger  = require('../services/logger');

async function calcStreak(userId) {
  const rows = (await prepare(
    `SELECT DISTINCT created_at::date AS d FROM activity WHERE user_id = ? ORDER BY d DESC`
  ).all(userId)).map(r => r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10));

  if (!rows.length) return 0;

  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

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
router.post('/', async (req, res, next) => {
  const { topic, type, score, total } = req.body || {};
  if (!topic || !['flashcards', 'quiz'].includes(type))
    return res.status(400).json({ error: 'Paramètres invalides.' });

  try {
    await prepare(
      'INSERT INTO activity (user_id, topic, type, score, total) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, topic.trim().slice(0, 120), type, score ?? null, total ?? null);
    res.json({ ok: true });
  } catch (err) {
    logger.error('POST /activity error', { message: err.message });
    next(err);
  }
});

// ── GET /api/activity/summary ─────────────────────────────────────────────────
router.get('/summary', async (req, res, next) => {
  try {
    const uid = req.user.id;

    const totalRow = await prepare(
      'SELECT COUNT(*) AS n FROM activity WHERE user_id = ?'
    ).get(uid);
    const totalSessions = Number(totalRow?.n || 0);

    const recentActivity = await prepare(
      `SELECT topic, type, score, total, created_at
       FROM activity WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 7`
    ).all(uid);

    const topTopics = await prepare(
      `SELECT topic, COUNT(*) AS n FROM activity
       WHERE user_id = ?
       GROUP BY topic ORDER BY n DESC LIMIT 6`
    ).all(uid);

    // Meilleur score quiz par topic (pour les cartes de révision)
    // PostgreSQL requires all selected columns to be either in GROUP BY
    // or wrapped in an aggregate — use MAX() for score and total.
    const bestScores = await prepare(
      `SELECT topic,
              MAX(CAST(score AS REAL) / total) AS best_pct,
              MAX(score) AS score,
              MAX(total) AS total
       FROM activity
       WHERE user_id = ? AND type = 'quiz' AND total > 0
       GROUP BY topic`
    ).all(uid);

    const streak = await calcStreak(uid);

    res.json({ streak, totalSessions, recentActivity, topTopics, bestScores });
  } catch (err) {
    logger.error('GET /activity/summary error', { message: err.message });
    next(err);
  }
});

// ── DELETE /api/activity — efface tout l'historique de l'utilisateur ─────────
router.delete('/', async (req, res, next) => {
  try {
    await prepare('DELETE FROM activity WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    logger.error('DELETE /activity error', { message: err.message });
    next(err);
  }
});

module.exports = router;

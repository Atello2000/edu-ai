/**
 * routes/srs.js — persistance PostgreSQL du SRS (SM-2)
 *
 * GET  /api/srs           → toutes les cartes de l'utilisateur
 * POST /api/srs/sync      → upsert batch (localStorage → DB)
 * GET  /api/srs/due-count → nombre de cartes dues
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const logger   = require('../services/logger');

// GET /api/srs — toutes les cartes SRS de l'utilisateur
router.get('/srs', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT card_hash, interval_days, ease_factor, repetitions,
              next_review, front, back, updated_at
       FROM srs_progress
       WHERE user_id = $1
       ORDER BY next_review ASC`,
      [req.user.id]
    );
    res.json({
      cards: rows.map(r => ({
        hash:        r.card_hash,
        interval:    r.interval_days,
        easeFactor:  r.ease_factor,
        repetitions: r.repetitions,
        nextReview:  Number(r.next_review),
        front:       r.front,
        back:        r.back,
        updatedAt:   Number(r.updated_at),
      })),
    });
  } catch (err) {
    logger.error('SRS GET error', { userId: req.user.id, message: err.message });
    next(err);
  }
});

// GET /api/srs/due-count — nombre de cartes dont la révision est due
router.get('/srs/due-count', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM srs_progress
       WHERE user_id = $1 AND next_review <= $2`,
      [req.user.id, Date.now()]
    );
    res.json({ count: Number(rows[0]?.count ?? 0) });
  } catch (err) {
    next(err);
  }
});

// POST /api/srs/sync — upsert batch depuis le client
router.post('/srs/sync', async (req, res, next) => {
  const rawCards = req.body.cards;
  if (!Array.isArray(rawCards) || !rawCards.length) return res.json({ synced: 0 });
  // Limiter à 500 cartes par sync, tronquer les champs texte (anti-abus)
  const cards = rawCards.slice(0, 500).map(c => ({
    ...c,
    front:       String(c.front || '').slice(0, 2000),
    back:        String(c.back  || '').slice(0, 2000),
    interval:    Math.min(Math.max(Number(c.interval)    || 1,   0.1),  365),
    easeFactor:  Math.min(Math.max(Number(c.easeFactor)  || 2.5, 1.3),  5.0),
    repetitions: Math.min(Math.max(Number(c.repetitions) || 0,   0),    9999),
    nextReview:  Math.min(Math.max(Number(c.nextReview)  || 0,   0),    Date.now() + 365 * 24 * 3600 * 1000),
  }));

  try {
    // Upsert en une seule requête avec VALUES multiples
    const values = [];
    const params = [];
    let   p      = 1;

    for (const c of cards) {
      if (!c.hash) continue;
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(
        req.user.id,
        String(c.hash),
        Number(c.interval)    || 1,
        Number(c.easeFactor)  || 2.5,
        Number(c.repetitions) || 0,
        Number(c.nextReview)  || 0,
        String(c.front || ''),
        String(c.back  || ''),
        Number(c.updatedAt)   || Date.now(),
      );
    }

    if (!values.length) return res.json({ synced: 0 });

    await pool.query(
      `INSERT INTO srs_progress
         (user_id, card_hash, interval_days, ease_factor, repetitions,
          next_review, front, back, updated_at)
       VALUES ${values.join(', ')}
       ON CONFLICT (user_id, card_hash) DO UPDATE SET
         interval_days = EXCLUDED.interval_days,
         ease_factor   = EXCLUDED.ease_factor,
         repetitions   = EXCLUDED.repetitions,
         next_review   = EXCLUDED.next_review,
         front         = EXCLUDED.front,
         back          = EXCLUDED.back,
         updated_at    = EXCLUDED.updated_at
       WHERE srs_progress.updated_at <= EXCLUDED.updated_at`,
      params
    );

    res.json({ synced: values.length });
  } catch (err) {
    logger.error('SRS sync error', { userId: req.user.id, message: err.message });
    next(err);
  }
});

module.exports = router;

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const { prepare } = require('../db');
const logger  = require('../services/logger');
const { requireAuth } = require('../middleware/auth');
const { doubleCsrfProtection } = require('../middleware/csrf');

const VALID_SHARE_TYPES = ['summary', 'quiz', 'flashcards', 'exam-sheet', 'mindmap', 'glossary'];
const MAX_SHARE_BYTES   = 200 * 1024; // 200 Ko par partage
const MAX_ACTIVE_SHARES = 20;         // liens actifs simultanés par utilisateur

// POST /api/share — crée un lien de partage (authentifié, 0 jeton)
router.post('/', requireAuth, doubleCsrfProtection, async (req, res, next) => {
  try {
    const { type = 'summary', title = '', content } = req.body;
    if (!content) return res.status(400).json({ error: 'Contenu manquant.' });
    if (!VALID_SHARE_TYPES.includes(type))
      return res.status(400).json({ error: 'Type de partage invalide.' });

    const serialized = JSON.stringify(content);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_SHARE_BYTES)
      return res.status(413).json({ error: 'Contenu trop volumineux pour être partagé (200 Ko max).' });

    const activeRow = await prepare(
      'SELECT COUNT(*) AS n FROM shared_content WHERE user_id = ? AND expires_at > NOW()'
    ).get(req.user.id);
    if (Number(activeRow?.n || 0) >= MAX_ACTIVE_SHARES)
      return res.status(403).json({ error: `Limite de ${MAX_ACTIVE_SHARES} liens de partage actifs atteinte. Les liens expirent après 7 jours.` });

    const token     = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    await prepare(
      'INSERT INTO shared_content (token, user_id, type, title, content, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(token, req.user.id, type, String(title).slice(0, 200), serialized, expiresAt);

    res.json({ token, url: `/share/${token}`, expires_at: expiresAt });
  } catch (err) {
    logger.error('POST /share error', { message: err.message });
    next(err);
  }
});

// GET /api/share/:token — lecture publique (pas d'auth)
router.get('/:token', async (req, res, next) => {
  try {
    const row = await prepare(
      'SELECT type, title, content, expires_at FROM shared_content WHERE token = ?'
    ).get(req.params.token);

    if (!row) return res.status(404).json({ error: 'Lien invalide ou expiré.' });
    if (new Date(row.expires_at) < new Date()) {
      await prepare('DELETE FROM shared_content WHERE token = ?').run(req.params.token);
      return res.status(410).json({ error: 'Ce lien a expiré.' });
    }

    res.json({ type: row.type, title: row.title, content: JSON.parse(row.content) });
  } catch (err) {
    logger.error('GET /share error', { message: err.message });
    next(err);
  }
});

module.exports = router;

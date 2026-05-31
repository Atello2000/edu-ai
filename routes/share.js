const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const { prepare } = require('../db');
const logger  = require('../services/logger');
const { requireAuth } = require('../middleware/auth');
const { doubleCsrfProtection } = require('../middleware/csrf');

// POST /api/share — crée un lien de partage (authentifié, 0 jeton)
router.post('/', requireAuth, doubleCsrfProtection, async (req, res) => {
  try {
    const { type = 'summary', title = '', content } = req.body;
    if (!content) return res.status(400).json({ error: 'Contenu manquant.' });

    const token     = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    await prepare(
      'INSERT INTO shared_content (token, user_id, type, title, content, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(token, req.user.id, type, String(title).slice(0, 200), JSON.stringify(content), expiresAt);

    res.json({ token, url: `/share/${token}`, expires_at: expiresAt });
  } catch (err) {
    logger.error('POST /share error', { message: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/share/:token — lecture publique (pas d'auth)
router.get('/:token', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

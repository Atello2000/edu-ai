const express     = require('express');
const router      = express.Router();
const { prepare } = require('../db');
const { requireAuth } = require('../middleware/auth');

// ── POST /api/feedback ────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim())
    return res.status(400).json({ error: 'Message requis.' });
  if (message.trim().length > 2000)
    return res.status(400).json({ error: 'Message trop long (2000 caractères max).' });

  await prepare(
    'INSERT INTO user_messages (user_id, message) VALUES (?, ?)'
  ).run(req.user.id, message.trim());

  res.json({ ok: true });
});

module.exports = router;

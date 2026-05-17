const express  = require('express');
const router   = express.Router();
const webpush  = require('web-push');
const db       = require('../db');
const { requireAuth } = require('../middleware/auth');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = `mailto:${process.env.ADMIN_EMAIL || 'admin@edu-ai.app'}`;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC) return res.status(503).json({ error: 'Push non configuré' });
  res.json({ publicKey: VAPID_PUBLIC });
});

// POST /api/push/subscribe
router.post('/subscribe', requireAuth, (req, res) => {
  const { endpoint, keys } = req.body?.subscription || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ error: 'Subscription invalide' });

  db.prepare(`
    INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
  `).run(req.user.id, endpoint, keys.p256dh, keys.auth);

  res.json({ ok: true });
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
      .run(req.user.id, endpoint);
  } else {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(req.user.id);
  }
  res.json({ ok: true });
});

// POST /api/push/notify-due — appelé par le client au login si cartes dues
router.post('/notify-due', requireAuth, async (req, res) => {
  if (!VAPID_PUBLIC) return res.json({ sent: false });
  const { dueCount } = req.body || {};
  if (!dueCount || dueCount < 1) return res.json({ sent: false });

  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(req.user.id);
  if (!subs.length) return res.json({ sent: false });

  const payload = JSON.stringify({
    title: 'EDU AI — Révision du jour',
    body:  `${dueCount} flashcard${dueCount > 1 ? 's' : ''} à réviser aujourd'hui !`,
    icon:  '/icon.svg',
    url:   '/app.html'
  });

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    ))
  );

  // Supprimer les subscriptions expirées
  results.forEach((r, i) => {
    if (r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode)) {
      db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(subs[i].id);
    }
  });

  res.json({ sent: true });
});

module.exports = router;

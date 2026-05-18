const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const db       = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   !!process.env.RAILWAY_ENVIRONMENT,
  sameSite: 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 jours
};

function setToken(res, userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('jangalai.token', token, COOKIE_OPTS);
}

function getTokenUser(req) {
  const token = req.cookies?.['jangalai.token'];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name)
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Email invalide.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum).' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const stmt = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)');
    const info = stmt.run(email.toLowerCase().trim(), hash, name.trim());
    const user = db.prepare('SELECT id, email, name, plan, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
    setToken(res, user.id);
    res.json({ user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    throw err;
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!row) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

  const match = await bcrypt.compare(password, row.password);
  if (!match) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

  setToken(res, row.id);
  res.json({ user: { id: row.id, email: row.email, name: row.name, plan: row.plan, created_at: row.created_at } });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('jangalai.token', { httpOnly: true, secure: !!process.env.RAILWAY_ENVIRONMENT, sameSite: 'lax' });
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const decoded = getTokenUser(req);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });
  const user = db.prepare('SELECT id, email, name, plan, created_at FROM users WHERE id = ?').get(decoded.userId);
  if (!user) return res.status(401).json({ error: 'Session invalide.' });
  res.json({ user });
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  const decoded = getTokenUser(req);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });

  const { name, currentPassword, newPassword } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
  if (!user) return res.status(401).json({ error: 'Session invalide.' });

  if (name && name.trim()) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), user.id);
  }

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Mot de passe actuel requis.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Nouveau mot de passe trop court (8 caractères minimum).' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
  }

  const updated = db.prepare('SELECT id, email, name, plan, created_at FROM users WHERE id = ?').get(user.id);
  res.json({ user: updated });
});

module.exports = router;

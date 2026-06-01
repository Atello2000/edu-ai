const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const router   = express.Router();
const db       = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { generateAndSetCsrfToken } = require('../middleware/csrf');
const { sendVerifyEmail, sendResetEmail } = require('../services/email');
const { doubleCsrfProtection } = require('../middleware/csrf');
const logger   = require('../services/logger');

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};
const APP_URL = process.env.APP_URL || 'http://localhost:3001';

function withAdminFlag(user) {
  if (!user) return null;
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  return {
    ...user,
    is_admin: !!(adminEmail && user.email.toLowerCase().trim() === adminEmail),
  };
}

function setToken(res, userId, req) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('jangalai.token', token, COOKIE_OPTS);
  // Générer aussi le token CSRF lié à la session (cookie lisible + cookie signé)
  if (req) generateAndSetCsrfToken(req, res);
}

async function getTokenUser(req) {
  const token = req.cookies?.['jangalai.token'];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name)
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Email invalide.' });

  const emailLower = email.toLowerCase().trim();
  if (password.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum).' });

  try {
    const hash        = await bcrypt.hash(password, 12);
    const verifyToken = genToken();
    const verifyExp   = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const currentMonth = new Date().toISOString().slice(0, 7);
    // HIGH-01 : inscription atomique — le INSERT échoue si la limite bêta est atteinte
    const info = await db.prepare(
      `INSERT INTO users (email, password, name, verify_token, verify_expires, jetons, jetons_reset_date)
       SELECT $1, $2, $3, $4, $5, 40, $6
       WHERE (SELECT COUNT(*) FROM users) < 100`
    ).run(emailLower, hash, name.trim(), verifyToken, verifyExp, currentMonth);
    if (!info.changes) {
      return res.status(403).json({ error: 'L\'accès est limité pendant la bêta. Revenez bientôt !' });
    }
    const user = await db.prepare('SELECT id, email, name, plan, email_verified, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);

    sendVerifyEmail(user.email, verifyToken).catch(err => logger.error('sendVerifyEmail failed', { email: user.email, message: err.message }));
    setToken(res, user.id, req);
    res.json({ user: withAdminFlag(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    throw err;
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });

  const emailLower = email.toLowerCase().trim();
  const row = await db.prepare('SELECT * FROM users WHERE email = ?').get(emailLower);
  if (!row) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

  if (row.google_id && !row.password)
    return res.status(401).json({ error: 'Ce compte utilise Google pour se connecter.' });

  const match = await bcrypt.compare(password, row.password);
  if (!match) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

  setToken(res, row.id, req);
  res.json({ user: withAdminFlag({ id: row.id, email: row.email, name: row.name, plan: row.plan, email_verified: row.email_verified, created_at: row.created_at }) });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', doubleCsrfProtection, (req, res) => {
  res.clearCookie('jangalai.token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const decoded = await getTokenUser(req);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });
  const user = await db.prepare('SELECT id, email, name, plan, email_verified, level, domains, specialty, onboarding_done, created_at FROM users WHERE id = ?').get(decoded.userId);
  if (!user) return res.status(401).json({ error: 'Session invalide.' });
  res.json({ user: withAdminFlag(user) });
});

// ── POST /api/auth/onboarding ─────────────────────────────────────────────────
router.post('/onboarding', doubleCsrfProtection, async (req, res) => {
  const decoded = await getTokenUser(req);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });

  const PRESET_LEVELS  = ['licence','master','doctorat','professionnel','autre'];
  const PRESET_DOMAINS = ['santé','informatique','droit','économie','sciences','langues','ingénierie','histoire','autre'];

  const { level, domains, specialty } = req.body || {};
  const lvl = (typeof level === 'string' && level.trim())
    ? level.trim().slice(0, 60)
    : null;
  const doms = Array.isArray(domains)
    ? JSON.stringify(
        domains
          .filter(d => typeof d === 'string' && d.trim())
          .map(d => d.trim().slice(0, 60))
          .slice(0, 4)
      )
    : '[]';
  const spec = (typeof specialty === 'string' && specialty.trim())
    ? specialty.trim().slice(0, 80)
    : null;

  await db.prepare('UPDATE users SET level = ?, domains = ?, specialty = ?, onboarding_done = 1 WHERE id = ?')
    .run(lvl, doms, spec, decoded.userId);

  const user = await db.prepare('SELECT id, email, name, plan, email_verified, level, domains, specialty, onboarding_done, created_at FROM users WHERE id = ?').get(decoded.userId);
  res.json({ user: withAdminFlag(user) });
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', doubleCsrfProtection, async (req, res) => {
  const decoded = await getTokenUser(req);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });

  const { name, currentPassword, newPassword } = req.body || {};
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
  if (!user) return res.status(401).json({ error: 'Session invalide.' });

  if (name && name.trim())
    await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), user.id);

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Mot de passe actuel requis.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Nouveau mot de passe trop court (8 caractères minimum).' });
    if (!user.password) return res.status(400).json({ error: 'Compte Google — définissez d\'abord un mot de passe via "Mot de passe oublié".' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    const hash = await bcrypt.hash(newPassword, 12);
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
  }

  const updated = await db.prepare('SELECT id, email, name, plan, email_verified, created_at FROM users WHERE id = ?').get(user.id);
  res.json({ user: withAdminFlag(updated) });
});

// ── GET /api/auth/verify/:token ───────────────────────────────────────────────
router.get('/verify/:token', async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE verify_token = ?').get(req.params.token);
  if (!user) return res.redirect(`${APP_URL}/login?error=invalid_token`);
  if (new Date(user.verify_expires) < new Date())
    return res.redirect(`${APP_URL}/login?error=token_expired`);

  await db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_expires = NULL WHERE id = ?').run(user.id);
  setToken(res, user.id, req);
  res.redirect(`${APP_URL}/app?verified=1`);
});

// ── POST /api/auth/resend-verify ──────────────────────────────────────────────
router.post('/resend-verify', doubleCsrfProtection, async (req, res) => {
  const decoded = await getTokenUser(req);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
  if (!user || user.email_verified) return res.json({ ok: true });

  const token = genToken();
  const exp   = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await db.prepare('UPDATE users SET verify_token = ?, verify_expires = ? WHERE id = ?').run(token, exp, user.id);
  sendVerifyEmail(user.email, token).catch(err => logger.error('sendVerifyEmail failed (resend)', { email: user.email, message: err.message }));
  res.json({ ok: true });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  // Always respond ok to avoid email enumeration
  if (user) {
    const token = genToken();
    const exp   = new Date(Date.now() + 3600 * 1000).toISOString();
    await db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, exp, user.id);
    sendResetEmail(user.email, token).catch(err => logger.error('sendResetEmail failed', { email: user.email, message: err.message }));
  }
  res.json({ ok: true });
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Données manquantes.' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum).' });

  const user = await db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré.' });
  if (new Date(user.reset_expires) < new Date()) return res.status(400).json({ error: 'Lien expiré.' });

  const hash = await bcrypt.hash(password, 12);
  await db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL, email_verified = 1 WHERE id = ?').run(hash, user.id);
  setToken(res, user.id, req);
  res.json({ ok: true });
});

// ── GOOGLE OAUTH ──────────────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google OAuth non configuré.' });
  const state = genToken();
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  process.env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope:         'email profile',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${APP_URL}/login?error=google_denied`);

  const savedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state');
  if (!state || state !== savedState) return res.redirect(`${APP_URL}/login?error=oauth_state`);

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  process.env.GOOGLE_CALLBACK_URL,
        grant_type:    'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) return res.redirect(`${APP_URL}/login?error=google_token`);

    // Get user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    // Find or create user
    let user = await db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
    if (!user) {
      const existing = await db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email?.toLowerCase());
      if (existing) {
        await db.prepare('UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?').run(profile.id, existing.id);
        user = await db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
      } else {
        // HIGH-01 : inscription atomique — empêche la race condition sur la limite bêta
        const currentMonth = new Date().toISOString().slice(0, 7);
        const r = await db.prepare(
          `INSERT INTO users (email, password, name, google_id, email_verified, jetons, jetons_reset_date)
           SELECT $1, $2, $3, $4, 1, 40, $5
           WHERE (SELECT COUNT(*) FROM users) < 100`
        ).run(profile.email?.toLowerCase(), '', profile.name || profile.email, profile.id, currentMonth);
        if (!r.changes) return res.redirect(`${APP_URL}/login?error=beta_full`);
        user = await db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
      }
    }

    setToken(res, user.id, req);
    res.redirect(`${APP_URL}/app`);
  } catch (err) {
    logger.error('Google OAuth error', { message: err.message, stack: err.stack });
    res.redirect(`${APP_URL}/login?error=google_error`);
  }
});

module.exports = router;

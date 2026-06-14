const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const router   = express.Router();
const db       = require('../db');
const { JWT_SECRET, REFRESH_SECRET, ACCESS_COOKIE_OPTS } = require('../middleware/auth');
const { generateAndSetCsrfToken } = require('../middleware/csrf');
const { sendVerifyEmail, sendResetEmail } = require('../services/email');
const { doubleCsrfProtection } = require('../middleware/csrf');
const logger   = require('../services/logger');

const { REFRESH_COOKIE_OPTS, issueRefreshToken, consumeRefreshToken, revokeAllForUser } = require('../services/refreshTokens');

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BETA_LIMIT = parseInt(process.env.BETA_USER_LIMIT || '100', 10);
const APP_URL = process.env.APP_URL || 'http://localhost:3001';

function withAdminFlag(user) {
  if (!user) return null;
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  return {
    ...user,
    is_admin: !!(adminEmail && user.email.toLowerCase().trim() === adminEmail),
  };
}

function getAppUrl(req) {
  const raw = process.env.CLIENT_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return raw.trim().replace(/\/+$/, ''); // retire juste les slashes finaux, pas de patch protocole
}

async function setToken(res, userId, req) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
  res.cookie('jangalai.token',   token, ACCESS_COOKIE_OPTS);
  res.cookie('jangalai.refresh', await issueRefreshToken(userId), REFRESH_COOKIE_OPTS);
  if (req) generateAndSetCsrfToken(req, res);
}

// Le token doit avoir été émis APRÈS session_invalidated_at (logout / reset),
// sinon un cookie volé resterait utilisable jusqu'à 7 jours sur ces routes.
async function rejectIfRevoked(decoded) {
  if (!decoded?.userId) return null;
  const row = await db.prepare('SELECT session_invalidated_at FROM users WHERE id = ?').get(decoded.userId);
  if (!row) return null;
  if (row.session_invalidated_at && decoded.iat) {
    if (decoded.iat * 1000 < new Date(row.session_invalidated_at).getTime()) return null;
  }
  return decoded;
}

async function getTokenUser(req, res) {
  const token = req.cookies?.['jangalai.token'];
  if (token) {
    try { return await rejectIfRevoked(jwt.verify(token, JWT_SECRET)); }
    catch (err) { if (err.name !== 'TokenExpiredError') return null; }
  }
  // Access token absent ou expiré — tenter le refresh (avec rotation)
  const rt = req.cookies?.['jangalai.refresh'];
  if (rt && res) {
    const result = await consumeRefreshToken(rt);
    if (!result) return null;
    if (!(await rejectIfRevoked({ userId: result.userId, iat: result.iat }))) return null;
    const newToken = jwt.sign({ userId: result.userId }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('jangalai.token', newToken, ACCESS_COOKIE_OPTS);
    if (result.newRefreshToken) res.cookie('jangalai.refresh', result.newRefreshToken, REFRESH_COOKIE_OPTS);
    return { userId: result.userId };
  }
  return null;
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }

// Seul le hash SHA256 des tokens verify/reset est stocké en base : en cas de
// fuite DB, les liens envoyés par email restent inutilisables par l'attaquant.
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Hash bcrypt factice — comparé quand l'email n'existe pas pour neutraliser
// la détection de comptes par mesure du temps de réponse.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('jangalai-timing-equalizer', 12);

function sendVerifyConfirmPage(res, token) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Confirmer votre email - Jangalai</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b14;color:#f8fafc;font-family:Arial,sans-serif}
    main{width:min(92vw,420px);text-align:center}
    h1{font-size:28px;margin:0 0 12px}
    p{color:#bac4d4;line-height:1.55;margin:0 0 24px}
    button{border:0;border-radius:8px;background:#3d7eff;color:white;font-weight:700;font-size:16px;padding:13px 22px;cursor:pointer}
    button:hover{background:#2f6fea}
  </style>
</head>
<body>
  <main>
    <h1>Confirmer votre email</h1>
    <p>Cliquez sur le bouton pour activer votre compte Jangalai.</p>
    <form method="post" action="/api/auth/verify/${token}">
      <button type="submit">Confirmer mon email</button>
    </form>
  </main>
</body>
</html>`);
}

async function verifyEmailToken(req, res) {
  const user = await db.prepare('SELECT * FROM users WHERE verify_token = ?').get(hashToken(req.params.token));
  if (!user) return res.redirect(`${getAppUrl(req)}/login?error=invalid_token`);
  if (new Date(user.verify_expires) < new Date())
    return res.redirect(`${getAppUrl(req)}/login?error=token_expired`);

  await db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_expires = NULL WHERE id = ?').run(user.id);
  await setToken(res, user.id, req);
  res.redirect(`${getAppUrl(req)}/app?verified=1`);
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
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
       SELECT $1, $2, $3, $4, $5, 80, $6
       WHERE (SELECT COUNT(*) FROM users) < ${BETA_LIMIT}`
    ).run(emailLower, hash, (name || '').trim(), hashToken(verifyToken), verifyExp, currentMonth);
    if (!info.changes) {
      return res.status(403).json({ error: 'L\'accès est limité pendant la bêta. Revenez bientôt !' });
    }
    const user = await db.prepare('SELECT id, email, name, plan, email_verified, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);

    try {
      await sendVerifyEmail(user.email, verifyToken);
    } catch (err) {
      logger.error('sendVerifyEmail failed', { email: user.email, message: err.message });
      try {
        await db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
      } catch (cleanupErr) {
        logger.error('Failed to clean up user after verification email failure', { userId: user.id, message: cleanupErr.message });
      }
      return res.status(502).json({ error: "Impossible d'envoyer l'e-mail de verification pour le moment. Reessayez dans quelques minutes." });
    }
    await setToken(res, user.id, req);
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

  // Message unique quel que soit le cas (email inconnu, compte Google, mauvais
  // mot de passe) + comparaison bcrypt systématique : pas d'énumération de
  // comptes par message d'erreur ni par timing.
  const hashToCompare = (row && row.password) ? row.password : DUMMY_BCRYPT_HASH;
  const match = await bcrypt.compare(password, hashToCompare);
  if (!row || !row.password || !match)
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

  await setToken(res, row.id, req);
  res.json({ user: withAdminFlag({ id: row.id, email: row.email, name: row.name, plan: row.plan, email_verified: row.email_verified, created_at: row.created_at }) });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', doubleCsrfProtection, async (req, res) => {
  const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' };
  // Révoque tous les tokens en cours pour cet utilisateur
  try {
    let userId = null;
    const token = req.cookies?.['jangalai.token'];
    const rt    = req.cookies?.['jangalai.refresh'];
    if (token)  { try { userId = jwt.verify(token, JWT_SECRET).userId; } catch {} }
    if (!userId && rt) {
      try { const d = jwt.verify(rt, REFRESH_SECRET); if (d.type === 'refresh') userId = d.userId; } catch {}
    }
    if (userId) {
      await revokeAllForUser(userId);
    }
  } catch {}
  res.clearCookie('jangalai.token',   base);
  res.clearCookie('jangalai.refresh', base);
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const decoded = await getTokenUser(req, res);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });
  const user = await db.prepare('SELECT id, email, name, plan, email_verified, level, domains, specialty, onboarding_done, created_at FROM users WHERE id = ?').get(decoded.userId);
  if (!user) return res.status(401).json({ error: 'Session invalide.' });
  res.json({ user: withAdminFlag(user) });
});

// ── POST /api/auth/onboarding ─────────────────────────────────────────────────
router.post('/onboarding', doubleCsrfProtection, async (req, res) => {
  const decoded = await getTokenUser(req, res);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });

  const PRESET_LEVELS  = ['licence','master','doctorat','professionnel','autre'];
  const PRESET_DOMAINS = ['santé','informatique','droit','économie','sciences','langues','ingénierie','histoire','autre'];

  const { level, domains, specialty, name } = req.body || {};
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
  const userName = (typeof name === 'string' && name.trim())
    ? name.trim().slice(0, 80)
    : null;

  if (userName) {
    await db.prepare('UPDATE users SET level = ?, domains = ?, specialty = ?, name = ?, onboarding_done = 1 WHERE id = ?')
      .run(lvl, doms, spec, userName, decoded.userId);
  } else {
    await db.prepare('UPDATE users SET level = ?, domains = ?, specialty = ?, onboarding_done = 1 WHERE id = ?')
      .run(lvl, doms, spec, decoded.userId);
  }

  const user = await db.prepare('SELECT id, email, name, plan, email_verified, level, domains, specialty, onboarding_done, created_at FROM users WHERE id = ?').get(decoded.userId);
  res.json({ user: withAdminFlag(user) });
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', doubleCsrfProtection, async (req, res) => {
  const decoded = await getTokenUser(req, res);
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
  const user = await db.prepare('SELECT id, verify_expires FROM users WHERE verify_token = ?').get(hashToken(req.params.token));
  if (!user) return res.redirect(`${getAppUrl(req)}/login?error=invalid_token`);
  if (new Date(user.verify_expires) < new Date())
    return res.redirect(`${getAppUrl(req)}/login?error=token_expired`);

  sendVerifyConfirmPage(res, req.params.token);
});

// ── POST /api/auth/verify/:token ── validation réelle après action utilisateur
router.post('/verify/:token', verifyEmailToken);

// ── POST /api/auth/resend-verify ──────────────────────────────────────────────
router.post('/resend-verify', doubleCsrfProtection, async (req, res) => {
  const decoded = await getTokenUser(req, res);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
  if (!user || user.email_verified) return res.json({ ok: true });

  const token = genToken();
  const exp   = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await db.prepare('UPDATE users SET verify_token = ?, verify_expires = ? WHERE id = ?').run(hashToken(token), exp, user.id);
  try {
    await sendVerifyEmail(user.email, token);
  } catch (err) {
    logger.error('sendVerifyEmail failed (resend)', { email: user.email, message: err.message });
    return res.status(502).json({ error: "Impossible d'envoyer l'e-mail de verification pour le moment." });
  }
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
    await db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(hashToken(token), exp, user.id);
    sendResetEmail(user.email, token).catch(err => logger.error('sendResetEmail failed', { email: user.email, message: err.message }));
  }
  res.json({ ok: true });
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Données manquantes.' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum).' });

  const user = await db.prepare('SELECT * FROM users WHERE reset_token = ?').get(hashToken(token));
  if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré.' });
  if (new Date(user.reset_expires) < new Date()) return res.status(400).json({ error: 'Lien expiré.' });

  const hash = await bcrypt.hash(password, 12);
  // Révoque toutes les sessions existantes en même temps que le reset
  await db.prepare(
    'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL, email_verified = 1, session_invalidated_at = NOW() WHERE id = ?'
  ).run(hash, user.id);
  await setToken(res, user.id, req);
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
    prompt:        'select_account',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${getAppUrl(req)}/login?error=google_denied`);

  const savedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state');
  if (!state || state !== savedState) return res.redirect(`${getAppUrl(req)}/login?error=oauth_state`);

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
    if (!tokens.access_token) return res.redirect(`${getAppUrl(req)}/login?error=google_token`);

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
           SELECT $1, $2, $3, $4, 1, 80, $5
           WHERE (SELECT COUNT(*) FROM users) < ${BETA_LIMIT}`
        ).run(profile.email?.toLowerCase(), '', profile.name || profile.email, profile.id, currentMonth);
        if (!r.changes) return res.redirect(`${getAppUrl(req)}/login?error=beta_full`);
        user = await db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
      }
    }

    await setToken(res, user.id, req);
    res.redirect(`${getAppUrl(req)}/app`);
  } catch (err) {
    logger.error('Google OAuth error', { message: err.message, stack: err.stack });
    res.redirect(`${getAppUrl(req)}/login?error=google_error`);
  }
});

// ── GET /api/auth/account/export ──────────────────────────────────────────────
// Export RGPD : toutes les données personnelles de l'utilisateur en un seul JSON
// téléchargeable. Lecture seule → pas de protection CSRF nécessaire, mais la
// session reste obligatoire.
router.get('/account/export', async (req, res) => {
  const decoded = await getTokenUser(req, res);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });
  const uid = decoded.userId;

  const user = await db.prepare(
    `SELECT id, email, name, plan, level, domains, specialty, jetons, jetons_reset_date,
            email_verified, onboarding_done, created_at, plan_expires_at
       FROM users WHERE id = ?`
  ).get(uid);
  if (!user) return res.status(401).json({ error: 'Session invalide.' });

  const [folders, files, activity, jetonTransactions, srsProgress, messages, payments, sharedContent, tokenUsage] =
    await Promise.all([
      db.prepare('SELECT id, name, icon, created_at FROM folders WHERE user_id = ? ORDER BY id').all(uid),
      db.prepare(
        `SELECT ff.id, ff.folder_id, ff.orig_name, ff.size, ff.text, ff.truncated, ff.created_at
           FROM folder_files ff JOIN folders f ON f.id = ff.folder_id
          WHERE f.user_id = ? ORDER BY ff.id`
      ).all(uid),
      db.prepare('SELECT topic, type, score, total, created_at FROM activity WHERE user_id = ? ORDER BY created_at').all(uid),
      db.prepare('SELECT action, amount, balance_after, note, created_at FROM jeton_transactions WHERE user_id = ? ORDER BY created_at').all(uid),
      db.prepare('SELECT card_hash, front, back, interval_days, ease_factor, repetitions, next_review, updated_at FROM srs_progress WHERE user_id = ?').all(uid),
      db.prepare('SELECT message, is_read, created_at FROM user_messages WHERE user_id = ? ORDER BY created_at').all(uid),
      db.prepare('SELECT ref_command, plan, amount, status, paid_at, created_at FROM payments WHERE user_id = ? ORDER BY created_at').all(uid),
      db.prepare('SELECT token, type, title, content, expires_at, created_at FROM shared_content WHERE user_id = ? ORDER BY created_at').all(uid),
      db.prepare('SELECT date, action, provider, input_tokens, output_tokens, created_at FROM token_usage WHERE user_id = ? ORDER BY created_at').all(uid),
    ]);

  const payload = {
    export_version: 1,
    exported_at: new Date().toISOString(),
    profile: user,
    library: { folders, files },
    activity,
    jeton_transactions: jetonTransactions,
    srs_progress: srsProgress,
    messages,
    payments,
    shared_content: sharedContent,
    token_usage: tokenUsage,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="jangalai-donnees-${stamp}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload, null, 2));
});

// ── DELETE /api/auth/account ──────────────────────────────────────────────────
// Suppression définitive du compte et de toutes les données associées.
// La cascade FK (ON DELETE CASCADE) efface dossiers, fichiers, activité,
// transactions, SRS, messages, paiements, partages, sessions et tokens.
router.delete('/account', doubleCsrfProtection, async (req, res) => {
  const decoded = await getTokenUser(req, res);
  if (!decoded) return res.status(401).json({ error: 'Non connecté.' });

  const user = await db.prepare('SELECT id, email, password FROM users WHERE id = ?').get(decoded.userId);
  if (!user) return res.status(401).json({ error: 'Session invalide.' });

  // Compte avec mot de passe → re-confirmation obligatoire (le compte Google
  // sans mot de passe est déjà protégé par la session + CSRF).
  if (user.password) {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  await revokeAllForUser(user.id).catch(() => {});
  await db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  logger.info('ACCOUNT', { action: 'self_delete', userId: user.id });

  const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' };
  res.clearCookie('jangalai.token',   base);
  res.clearCookie('jangalai.refresh', base);
  res.json({ ok: true });
});

module.exports = router;

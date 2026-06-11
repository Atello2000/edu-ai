const jwt = require('jsonwebtoken');
const { prepare } = require('../db');
const { REFRESH_SECRET, REFRESH_COOKIE_OPTS, consumeRefreshToken } = require('../services/refreshTokens');

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error('SESSION_SECRET non configuré');

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   60 * 60 * 1000, // 1h
};

// Retourne { userId, iat } ou null — iat sert à vérifier la révocation de session.
// Le refresh token est tourné à chaque usage (services/refreshTokens.js).
async function tryRefreshAccess(req, res) {
  const result = await consumeRefreshToken(req.cookies?.['jangalai.refresh']);
  if (!result) return null;
  const newToken = jwt.sign({ userId: result.userId }, JWT_SECRET, { expiresIn: '1h' });
  res.cookie('jangalai.token', newToken, ACCESS_COOKIE_OPTS);
  if (result.newRefreshToken) {
    res.cookie('jangalai.refresh', result.newRefreshToken, REFRESH_COOKIE_OPTS);
  }
  return { userId: result.userId, iat: result.iat };
}

async function requireAuth(req, res, next) {
  const token = req.cookies?.['jangalai.token'];
  let userId = null;
  let tokenIat = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId   = decoded.userId;
      tokenIat = decoded.iat;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        const refreshResult = await tryRefreshAccess(req, res);
        if (refreshResult) { userId = refreshResult.userId; tokenIat = refreshResult.iat; }
      }
    }
  } else {
    const refreshResult = await tryRefreshAccess(req, res);
    if (refreshResult) { userId = refreshResult.userId; tokenIat = refreshResult.iat; }
  }

  if (!userId) {
    return res.status(401).json({ error: 'Connexion requise.' });
  }

  const user = await prepare(
    'SELECT id, email, name, plan, level, domains, specialty, onboarding_done, jetons, jetons_reset_date, email_verified, is_admin, session_invalidated_at FROM users WHERE id = ?'
  ).get(userId);
  if (!user) return res.status(401).json({ error: 'Session expirée.' });

  // Vérification révocation — le token doit avoir été émis APRÈS session_invalidated_at
  if (user.session_invalidated_at && tokenIat) {
    const invalidatedMs = new Date(user.session_invalidated_at).getTime();
    if (tokenIat * 1000 < invalidatedMs) {
      return res.status(401).json({ error: 'Session révoquée. Veuillez vous reconnecter.' });
    }
  }

  if (user.email_verified === 0) {
    return res.status(403).json({ error: 'Veuillez valider votre adresse e-mail pour débloquer votre compte et utiliser cette fonctionnalité.' });
  }

  req.user = user;
  next();
}

module.exports = { requireAuth, JWT_SECRET, REFRESH_SECRET, ACCESS_COOKIE_OPTS };

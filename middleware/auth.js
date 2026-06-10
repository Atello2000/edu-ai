const jwt = require('jsonwebtoken');
const { prepare } = require('../db');

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error('SESSION_SECRET non configuré');

// Entropie indépendante obligatoire en production — un secret dérivé du
// SESSION_SECRET ferait tomber les refresh tokens 7 jours avec lui.
if (!process.env.REFRESH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('REFRESH_SECRET non configuré — variable obligatoire en production.');
}
const REFRESH_SECRET = process.env.REFRESH_SECRET || (JWT_SECRET + ':refresh');

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   60 * 60 * 1000, // 1h
};

// Retourne { userId, iat } ou null — iat sert à vérifier la révocation de session
function tryRefreshAccess(req, res) {
  const rt = req.cookies?.['jangalai.refresh'];
  if (!rt) return null;
  try {
    const decoded = jwt.verify(rt, REFRESH_SECRET);
    if (decoded.type !== 'refresh') return null;
    const newToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('jangalai.token', newToken, ACCESS_COOKIE_OPTS);
    return { userId: decoded.userId, iat: decoded.iat };
  } catch {
    return null;
  }
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
        const refreshResult = tryRefreshAccess(req, res);
        if (refreshResult) { userId = refreshResult.userId; tokenIat = refreshResult.iat; }
      }
    }
  } else {
    const refreshResult = tryRefreshAccess(req, res);
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

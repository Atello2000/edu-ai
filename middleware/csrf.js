/**
 * CSRF Protection — Double Submit Cookie Pattern (csrf-csrf v4)
 *
 * Flux :
 *   1. Client appelle GET /api/csrf-token → reçoit le token en JSON
 *      + cookie httpOnly __jcsrf (signé) + cookie lisible jangalai-csrf
 *   2. Client envoie X-CSRF-Token: <token> sur toutes les mutations
 *   3. doubleCsrfProtection valide que le header correspond au cookie signé
 *
 * Sécurité :
 *   - Le token CSRF est lié au userId JWT (getSessionIdentifier) pour empêcher
 *     la réutilisation cross-utilisateur.
 *   - Le secret HMAC est obligatoire en production (crash au démarrage sinon).
 */

const { doubleCsrf } = require('csrf-csrf');
const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';

// ── CRIT-03 : Secret CSRF obligatoire en production ─────────────────────────
const CSRF_SECRET = process.env.CSRF_SECRET;
if (!CSRF_SECRET && isProd) {
  throw new Error('CSRF_SECRET non configuré — variable obligatoire en production.');
}
if (!CSRF_SECRET) {
  console.warn('[CSRF] ⚠ CSRF_SECRET non défini — utilisation d\'un secret local de développement.');
}
const effectiveSecret = CSRF_SECRET || 'dev-only-local-csrf-secret-' + require('os').hostname();

const JWT_SECRET = process.env.SESSION_SECRET;

const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => effectiveSecret,

  // ── CRIT-02 : Liaison session → le token CSRF est propre à chaque userId ──
  getSessionIdentifier: (req) => {
    try {
      const token = req.cookies?.['jangalai.token'];
      if (!token || !JWT_SECRET) return '';
      const decoded = jwt.verify(token, JWT_SECRET);
      return String(decoded.userId || '');
    } catch {
      return '';
    }
  },

  // Cookie httpOnly qui stocke le hash (non accessible par le JS client)
  cookieName: '__jcsrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  },

  // Lire le token depuis l'en-tête X-CSRF-Token
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  size: 64,
});

/**
 * Génère un token CSRF et pose DEUX cookies :
 *   - __jcsrf    (httpOnly)  → vérifié par le serveur
 *   - jangalai-csrf (lisible) → lu par le client JS
 * Retourne la valeur plain du token.
 */
function generateAndSetCsrfToken(req, res) {
  const token = generateCsrfToken(req, res);
  res.cookie('jangalai-csrf', token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: isProd,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

module.exports = { generateAndSetCsrfToken, doubleCsrfProtection };

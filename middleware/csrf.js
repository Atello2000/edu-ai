/**
 * CSRF Protection — Double Submit Cookie Pattern (csrf-csrf v4)
 *
 * Flux :
 *   1. Client appelle GET /api/csrf-token → reçoit le token en JSON
 *      + cookie httpOnly __jcsrf (signé) + cookie lisible jangalai-csrf
 *   2. Client envoie X-CSRF-Token: <token> sur toutes les mutations
 *   3. doubleCsrfProtection valide que le header correspond au cookie signé
 */

const { doubleCsrf } = require('csrf-csrf');

const isProd = process.env.NODE_ENV === 'production';

const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  // Secret HMAC — mettre CSRF_SECRET dans les variables Railway
  getSecret: () => process.env.CSRF_SECRET || 'dev-csrf-secret-change-in-production',

  // Identifiant de session : user id si authentifié, chaîne vide sinon
  getSessionIdentifier: (req) => String(req.user?.id || ''),

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

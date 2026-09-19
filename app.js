require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const cookieParser = require('cookie-parser');
const { globalLimiter, aiLimiter, clientIpKey } = require('./middleware/rateLimit');
const { requireAuth } = require('./middleware/auth');
const { generateAndSetCsrfToken, doubleCsrfProtection } = require('./middleware/csrf');

const helmet = require('helmet');
const logger = require('./services/logger');

const app = express();
app.set('trust proxy', 1); // Railway reverse proxy
// CSP réactivée. Le bundle React est servi depuis 'self'. Seules exceptions :
//  - script-src cdn.jsdelivr.net  → d3 + markmap chargés à la volée (MindmapModal)
//  - style-src 'unsafe-inline'    → styles inline React + Google Fonts CSS
//  - font-src fonts.gstatic.com   → polices Google
// marked/jspdf sont désormais bundlés (npm), plus aucun CDN cdnjs.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // hash du script inline de détection de thème dans index.html
      'script-src':  ["'self'", "'sha256-xcAClzY7Nh5mMt63CkniY43Pmll/VUTMKQ/b/Bvi19w='"],
      'style-src':   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src':    ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src':     ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      'worker-src':  ["'self'", 'blob:'],
      'object-src':  ["'none'"],
    },
  },
}));
app.use(cors({
  origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : 'http://localhost:3001',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cookieParser());

// Sert sw.js avec la version du déploiement injectée + no-cache pour détection instantanée
const SW_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || String(Date.now());
app.get('/sw.js', (req, res) => {
  const swPath = path.join(__dirname, 'public', 'sw.js');
  const content = fs
    .readFileSync(swPath, 'utf8')
    .replace(/const CACHE = 'jangalai-[^']+';/, `const CACHE = 'jangalai-${SW_VERSION}';`)
    .replace('__CACHE_VERSION__', SW_VERSION);
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(content);
});

// The provider return is not proof of settlement; the app checks the purchase.
app.get('/payment-success', (req, res) => {
  const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
  res.setHeader('Cache-Control', 'no-store');
  res.redirect('/app?payment=return&reference=' + encodeURIComponent(reference));
});

// En production, sert le build React en priorité
const reactDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(reactDist)) {
  // HTML entry points must NEVER be browser-cached — hash-named assets change
  // on every deploy and a stale cached index.html causes a blank page.
  app.use(express.static(reactDist, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));
}

app.use(express.static('public'));
app.use('/api', globalLimiter);

['uploads', 'courses', 'data'].forEach(dir => {
  try {
    const p = path.join(__dirname, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  } catch (_) {}
});

// ── CSRF token endpoint (public — nécessaire avant login) ────────────────────
app.get('/api/csrf-token', (req, res) => {
  const token = generateAndSetCsrfToken(req, res);
  res.json({ token });
});

// ── Rate limit login/forgot — anti brute-force (10 req/15min par IP réelle) ──
const loginLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});
// ── Throttle par compte — anti brute-force distribué (10 échecs/15min/email) ─
// Complète le limiteur IP : x-vercel-forwarded-for est spoofable en accès API
// direct, mais l'email ciblé, lui, ne change pas. Seuls les échecs comptent.
const accountLoginLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: false, legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `acct:${String(req.body?.email || '').toLowerCase().trim()}`,
  message: { error: 'Trop de tentatives sur ce compte. Réessayez dans 15 minutes.' },
});
// ── Rate limit register — anti-spam comptes (5 req/heure par IP réelle) ──────
const registerLimiter = require('express-rate-limit')({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { error: 'Trop de tentatives d\'inscription. Réessayez dans une heure.' },
});
// ── Rate limit webhook PayTech — anti-flood IPN (20 req/min par IP) ──────────
// L'IPN arrive en direct (pas via Vercel) : req.ip est la bonne clé ici.
const ipnLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de requêtes IPN.' },
});
app.use('/api/auth/login',           loginLimiter, accountLoginLimiter);
app.use('/api/auth/forgot-password', loginLimiter);
app.use('/api/auth/register',        registerLimiter);
app.use('/api/payment/ipn',          ipnLimiter);

// ── Routes publiques (pas de CSRF — pas de cookie d'auth non plus) ───────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payment/ipn', require('./routes/payment').publicRouter);
app.use('/api',      require('./routes/misc'));

// ── CSRF sur les routes protégées (auth + token requis) ──────────────────────
// Les routes publiques (upload, ping, auth) sont exclues car elles ne
// consomment pas de ressources utilisateur et ne modifient pas d'état sensible.
const csrfAndAuth = [requireAuth, doubleCsrfProtection];

// Montés AVANT le bloc csrfAndAuth : ces routeurs gèrent leur propre auth
// (share : GET public + POST protégé ; push : tout protégé en interne).
// Un app.use('/api', csrfAndAuth, …) s'exécute pour TOUTE requête /api/*,
// même celles destinées aux routeurs montés après — le GET public de
// partage renvoyait donc 401 en production.
app.use('/api/share', require('./routes/share'));
app.use('/api/push',  require('./routes/push'));

app.use('/api',         csrfAndAuth, aiLimiter, require('./routes/ai'));
app.use('/api',         csrfAndAuth, require('./routes/jetons'));
app.use('/api/payment', csrfAndAuth, require('./routes/payment').protectedRouter);
app.use('/api',         csrfAndAuth, require('./routes/srs'));
app.use('/api/activity', csrfAndAuth, require('./routes/activity'));
app.use('/api/folders', csrfAndAuth, require('./routes/folders'));
app.use('/api/admin',    csrfAndAuth, require('./routes/admin'));
app.use('/api/feedback', csrfAndAuth, require('./routes/feedback'));

// ── MED-02 : Purge périodique des contenus partagés expirés ─────────────────
// Gérée désormais par le service de maintenance (services/maintenance.js)


// SPA fallback — toutes les routes non-API renvoient index.html.
// (Le SEO/prerendering est géré côté Vercel par scripts/prerender-landing.js,
// qui écrit le HTML rendu directement dans dist/. Le backend DO ne sert pas le
// front public, donc plus de dynamic-rendering par user-agent ici.)
if (fs.existsSync(reactDist)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(reactDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Jeton de sécurité invalide ou expiré (CSRF). Veuillez rafraîchir la page.' });
  }
  logger.error('Unhandled error', { method: req.method, url: req.url, userId: req.user?.id, message: err.message, stack: err.stack });
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? err.message : 'Erreur serveur' });
});

module.exports = app;

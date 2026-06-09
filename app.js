require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const cookieParser = require('cookie-parser');
const { globalLimiter, aiLimiter } = require('./middleware/rateLimit');
const { requireAuth } = require('./middleware/auth');
const { generateAndSetCsrfToken, doubleCsrfProtection } = require('./middleware/csrf');

const helmet = require('helmet');
const logger = require('./services/logger');
const { buildPaymentSuccessHtml } = require('./lib/payment-success-html');

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

// Route de succès de paiement avec détection intelligente (Mobile vs Desktop)
// - Sur PC : redirection automatique instantanée vers l'application principale
// - Sur Mobile : affichage d'une page de succès légère (lib/payment-success-html.js)
app.get('/payment-success', (req, res) => {
  const VALID_PLANS = ['pro', 'max'];
  const plan = VALID_PLANS.includes(req.query.plan) ? req.query.plan : 'pro';
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
  const hasToken = !!req.cookies?.['jangalai.token'];

  if (isMobile) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildPaymentSuccessHtml(plan, hasToken));
  } else {
    res.redirect(`/app?payment=success&plan=${plan}`);
  }
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

// ── Rate limit login/forgot — anti brute-force (10 req/15min par IP) ────────
const loginLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});
// ── Rate limit register — anti-spam comptes (5 req/heure par IP) ─────────────
const registerLimiter = require('express-rate-limit')({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de tentatives d\'inscription. Réessayez dans une heure.' },
});
// ── Rate limit webhook PayTech — anti-flood IPN (120 req/min par IP) ─────────
const ipnLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de requêtes IPN.' },
});
app.use('/api/auth/login',           loginLimiter);
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

app.use('/api',         csrfAndAuth, aiLimiter, require('./routes/ai'));
app.use('/api',         csrfAndAuth, require('./routes/jetons'));
app.use('/api/payment', csrfAndAuth, require('./routes/payment').protectedRouter);
app.use('/api',         csrfAndAuth, require('./routes/srs'));
app.use('/api/activity', csrfAndAuth, require('./routes/activity'));
app.use('/api/folders', csrfAndAuth, require('./routes/folders'));
app.use('/api/admin',    csrfAndAuth, require('./routes/admin'));
app.use('/api/feedback', csrfAndAuth, require('./routes/feedback'));
app.use('/api/share',   require('./routes/share')); // POST interne requireAuth+CSRF, GET public
app.use('/api/push',    require('./routes/push'));

// ── MED-02 : Purge périodique des contenus partagés expirés ─────────────────
// Gérée désormais par le service de maintenance (services/maintenance.js)


// SEO — Dynamic rendering : sert la landing pré-rendue aux crawlers
// Crawlers reçoivent landing-prerender.html (HTML statique complet).
// Les vrais utilisateurs reçoivent l'app React normale.
const PRERENDER_PATH = path.join(__dirname, 'public', 'landing-prerender.html');
const CRAWLER_RE = /googlebot|bingbot|yandexbot|duckduckbot|slurp|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|applebot/i;

if (fs.existsSync(reactDist)) {
  app.get('/', (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    if (CRAWLER_RE.test(ua) && fs.existsSync(PRERENDER_PATH)) {
      return res.sendFile(PRERENDER_PATH);
    }
    next();
  });

  // SPA fallback — toutes les routes non-API renvoient index.html
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

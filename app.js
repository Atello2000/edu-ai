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
      'script-src':  ["'self'"],
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
// - Sur Mobile : affichage d'une page de succès légère et ultra-rapide sans charger l'application React
app.get('/payment-success', (req, res) => {
  const plan = req.query.plan || 'pro';
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);

  if (isMobile) {
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Paiement réussi - Jangalai</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', sans-serif;
            background-color: #0b0f19;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
          }
          .card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 28px;
            padding: 40px 24px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(12px);
          }
          .icon {
            font-size: 64px;
            margin-bottom: 24px;
            display: inline-block;
            animation: pop 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          }
          h1 {
            font-size: 26px;
            margin: 0 0 12px 0;
            font-weight: 800;
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            font-size: 15px;
            color: #94a3b8;
            line-height: 1.6;
            margin: 0 0 28px 0;
          }
          .btn-close {
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
            color: white;
            border: none;
            padding: 14px 24px;
            font-weight: 600;
            border-radius: 14px;
            font-size: 14px;
            cursor: pointer;
            width: 100%;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
            transition: all 0.2s ease;
          }
          .btn-close:active {
            transform: scale(0.98);
            opacity: 0.9;
          }
          @keyframes pop {
            0% { transform: scale(0); }
            100% { transform: scale(1); }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🎉</div>
          <h1>Paiement Réussi !</h1>
          <p>Merci pour votre abonnement <strong>${plan.toUpperCase()}</strong>.<br><br>Vous pouvez maintenant fermer cet onglet en toute sécurité et continuer sur votre ordinateur.</p>
          <button class="btn-close" onclick="window.close();">Fermer la fenêtre</button>
        </div>
      </body>
      </html>
    `);
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
app.use('/api/auth/login',           loginLimiter);
app.use('/api/auth/forgot-password', loginLimiter);

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

// SPA fallback — toutes les routes non-API renvoient index.html
if (fs.existsSync(reactDist)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(reactDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { method: req.method, url: req.url, userId: req.user?.id, message: err.message, stack: err.stack });
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? err.message : 'Erreur serveur' });
});

module.exports = app;

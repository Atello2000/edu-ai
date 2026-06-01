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
  const hasToken = !!req.cookies?.['jangalai.token'];

  if (isMobile) {
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Abonnement Activé - Jangalai</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Outfit', sans-serif;
            background-color: #0b0f19;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 24px 16px;
            text-align: center;
            overflow-x: hidden;
          }
          .card {
            background: rgba(17, 24, 39, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 28px;
            padding: 40px 24px;
            max-width: 420px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.15);
            backdrop-filter: blur(16px);
            position: relative;
            animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .glow {
            position: absolute;
            top: -10%;
            left: 50%;
            transform: translateX(-50%);
            width: 180px;
            height: 180px;
            background: ${plan === 'max' ? 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0) 70%)' : 'radial-gradient(circle, rgba(245,166,35,0.3) 0%, rgba(245,166,35,0) 70%)'};
            pointer-events: none;
            z-index: 0;
          }
          .icon-wrap {
            position: relative;
            z-index: 1;
            width: 84px;
            height: 84px;
            border-radius: 50%;
            background: ${plan === 'max' ? 'rgba(168,85,247,0.1)' : 'rgba(245,166,35,0.1)'};
            border: ${plan === 'max' ? '1.5px solid rgba(168,85,247,0.3)' : '1.5px solid rgba(245,166,35,0.3)'};
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px auto;
            box-shadow: ${plan === 'max' ? '0 0 20px rgba(168,85,247,0.2)' : '0 0 20px rgba(245,166,35,0.2)'};
            animation: pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          }
          .star-icon {
            width: 44px;
            height: 44px;
          }
          h1 {
            font-size: clamp(22px, 6.5vw, 28px);
            margin: 0 0 12px 0;
            font-weight: 800;
            background: ${plan === 'max' ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : 'linear-gradient(135deg, #f5a623 0%, #f76b1c 100%)'};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.02em;
          }
          p {
            font-size: 15px;
            color: #94a3b8;
            line-height: 1.6;
            margin: 0 0 28px 0;
            padding: 0 8px;
          }
          .benefits-box {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 32px;
            text-align: left;
          }
          .benefits-title {
            margin: 0 0 10px 0;
            font-size: 12px;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.05em;
            font-weight: 700;
          }
          .benefits-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .benefits-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13.5px;
            color: #ffffff;
            margin-bottom: 8px;
          }
          .benefits-item:last-child {
            margin-bottom: 0;
          }
          .benefits-check {
            color: ${plan === 'max' ? '#a855f7' : '#f5a623'};
            font-weight: bold;
          }
          .btn-close {
            background: ${plan === 'max' ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : 'linear-gradient(135deg, #f5a623 0%, #f76b1c 100%)'};
            color: white;
            border: none;
            padding: 16px 28px;
            font-weight: 600;
            border-radius: 16px;
            font-size: 15px;
            cursor: pointer;
            width: 100%;
            box-shadow: ${plan === 'max' ? '0 10px 20px -5px rgba(168,85,247,0.4)' : '0 10px 20px -5px rgba(245,166,35,0.4)'};
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .btn-close:active {
            transform: scale(0.98);
            opacity: 0.95;
          }
          .btn-secondary {
            background: rgba(255,255,255,0.06) !important;
            box-shadow: none !important;
            color: #94a3b8 !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
          }
          @keyframes slideUp {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes pop {
            0% { transform: scale(0); }
            100% { transform: scale(1); }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="glow"></div>
          <div class="icon-wrap">
            <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#starGradient)" stroke="${plan === 'max' ? '#a855f7' : '#f5a623'}" stroke-width="1.5" />
              <defs>
                <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="${plan === 'max' ? '#c084fc' : '#ffb703'}" />
                  <stop offset="100%" stop-color="${plan === 'max' ? '#db2777' : '#fb8500'}" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>Abonnement Activé !</h1>
          <p>Félicitations ! Votre compte a été mis à niveau vers le plan <strong>${plan.toUpperCase()}</strong> avec succès.</p>
          
          <div class="benefits-box">
            <h4 class="benefits-title">Vos avantages débloqués :</h4>
            <ul class="benefits-list">
              <li class="benefits-item">
                <span class="benefits-check">✓</span>
                <strong>${plan === 'max' ? '400' : '150'} jetons</strong> alloués pour ce mois
              </li>
              <li class="benefits-item">
                <span class="benefits-check">✓</span>
                Outils d'IA avancés activés
              </li>
              <li class="benefits-item">
                <span class="benefits-check">✓</span>
                Taille maximale des fichiers augmentée
              </li>
            </ul>
          </div>

          ${hasToken ? `
          <button class="btn-close" onclick="window.location.href='/app'">
            Accéder à l'application 🚀
          </button>
          ` : `
          <button class="btn-close btn-secondary" onclick="window.location.href='/'">
            Retour au site
          </button>
          <p style="font-size:13px; color:#475569; margin:16px 0 0; line-height:1.6; padding:0 4px;">
            Votre plan est déjà actif.<br>
            Retournez sur l'onglet de votre PC —<br>
            l'application s'est débloquée automatiquement.
          </p>
          <a href="/login" style="display:inline-block; margin-top:14px; font-size:12.5px; color:#64748b; text-decoration:underline;">
            Se connecter sur ce mobile
          </a>
          `}
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

// ── MED-02 : Purge périodique des contenus partagés expirés ─────────────────
// Toutes les 6 heures, supprime les lignes dont expires_at < NOW().
setInterval(async () => {
  try {
    const { pool } = require('./db');
    const result = await pool.query('DELETE FROM shared_content WHERE expires_at < NOW()');
    if (result.rowCount > 0) {
      logger.info(`Purged ${result.rowCount} expired shared content(s)`);
    }
  } catch (err) {
    logger.warn('Shared content purge failed', { error: err.message });
  }
}, 6 * 3600 * 1000);

// SPA fallback — toutes les routes non-API renvoient index.html
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

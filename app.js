require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const cookieParser = require('cookie-parser');
const { globalLimiter, aiLimiter } = require('./middleware/rateLimit');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1); // Railway reverse proxy
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(cookieParser());

// Sert sw.js avec la version du déploiement injectée + no-cache pour détection instantanée
const SW_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RAILWAY_DEPLOYMENT_ID || String(Date.now());
app.get('/sw.js', (req, res) => {
  const swPath = path.join(__dirname, 'public', 'sw.js');
  const content = fs.readFileSync(swPath, 'utf8').replace('__CACHE_VERSION__', SW_VERSION);
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(content);
});

app.use(express.static('public'));
app.use('/api', globalLimiter);

['uploads', 'courses', 'data'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── Routes publiques ──────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api',      require('./routes/misc'));

// ── Routes protégées (auth requise) ──────────────────────────────────────────
app.use('/api',        requireAuth, aiLimiter, require('./routes/ai'));
app.use('/api/pharma', requireAuth, aiLimiter, require('./routes/pharma'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/push',   require('./routes/push'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

module.exports = app;

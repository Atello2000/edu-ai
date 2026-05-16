require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const session      = require('express-session');
const SQLiteStore  = require('connect-sqlite3')(session);
const { globalLimiter, aiLimiter } = require('./middleware/rateLimit');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1); // Railway reverse proxy
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Sessions ──────────────────────────────────────────────────────────────────
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: process.env.SESSION_SECRET || 'edu-ai-dev-secret-change-in-prod',
  name:   'edu.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   !!process.env.RAILWAY_ENVIRONMENT,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 jours
    sameSite: 'lax',
  },
}));

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

module.exports = app;

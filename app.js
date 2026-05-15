require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { globalLimiter, aiLimiter } = require('./middleware/rateLimit');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/api', globalLimiter);

['uploads', 'courses', 'data'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use('/api',        require('./routes/misc'));
app.use('/api',        aiLimiter, require('./routes/ai'));
app.use('/api/pharma', aiLimiter, require('./routes/pharma'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

module.exports = app;

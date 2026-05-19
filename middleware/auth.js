const jwt = require('jsonwebtoken');
const db  = require('../db');

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error('SESSION_SECRET non configuré');

function requireAuth(req, res, next) {
  const token = req.cookies?.['jangalai.token'];
  if (!token) return res.status(401).json({ error: 'Connexion requise.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, plan, level, domains, onboarding_done FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Session expirée.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
  }
}

module.exports = { requireAuth, JWT_SECRET };

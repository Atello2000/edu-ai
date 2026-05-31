const jwt = require('jsonwebtoken');
const { prepare } = require('../db');

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error('SESSION_SECRET non configuré');

async function requireAuth(req, res, next) {
  const token = req.cookies?.['jangalai.token'];
  if (!token) return res.status(401).json({ error: 'Connexion requise.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prepare('SELECT id, email, name, plan, level, domains, specialty, onboarding_done, jetons, jetons_reset_date, email_verified FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Session expirée.' });
    
    // Bloquer l'accès aux API fonctionnelles et sensibles si l'adresse email n'a pas été validée
    if (user.email_verified === 0) {
      return res.status(403).json({ error: 'Veuillez valider votre adresse e-mail pour débloquer votre compte et utiliser cette fonctionnalité.' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
  }
}

module.exports = { requireAuth, JWT_SECRET };

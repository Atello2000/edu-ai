const rateLimit = require('express-rate-limit');

// Limite globale : 200 req/15 min par IP (protection anti-scraping)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' }
});

// Limite stricte sur les endpoints IA coûteux : 30 req/15 min par IP
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de requêtes IA atteinte. Réessayez dans 15 minutes.' }
});

module.exports = { globalLimiter, aiLimiter };

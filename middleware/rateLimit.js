const { ipKeyGenerator, rateLimit } = require('express-rate-limit');

// Limite globale : 200 req/15 min par IP (protection anti-scraping)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' }
});

// Limite sur les endpoints IA coûteux : 100 req/15 min par userId (ou IP en fallback)
// userId évite le contournement via VPN/multi-interface — req.user est posé par requireAuth
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ? `uid:${req.user.id}` : ipKeyGenerator(req.ip),
  message: { error: 'Limite de requêtes IA atteinte. Réessayez dans 15 minutes.' }
});

module.exports = { globalLimiter, aiLimiter };

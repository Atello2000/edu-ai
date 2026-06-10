const { ipKeyGenerator, rateLimit } = require('express-rate-limit');

/**
 * IP réelle du client.
 * Le frontend Vercel proxifie /api/* vers Render (rewrites) : req.ip est alors
 * l'IP de sortie Vercel, partagée par TOUS les utilisateurs — un rate limit
 * par req.ip deviendrait un verrou collectif. Vercel transmet l'IP réelle dans
 * x-vercel-forwarded-for ; on l'utilise en priorité, avec req.ip en fallback
 * pour le trafic direct (PayTech IPN, crawlers, accès API direct).
 */
function getClientIp(req) {
  const xvff = req.headers['x-vercel-forwarded-for'];
  if (typeof xvff === 'string' && xvff.length) {
    const first = xvff.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip;
}

const clientIpKey = (req) => ipKeyGenerator(getClientIp(req));

// Limite globale : 1500 req/15 min par IP (protection anti-scraping)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' }
});

// Limite sur les endpoints IA coûteux : 100 req/15 min par userId (ou IP en fallback)
// userId évite le contournement via VPN/multi-interface — req.user est posé par requireAuth
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ? `uid:${req.user.id}` : clientIpKey(req),
  message: { error: 'Limite de requêtes IA atteinte. Réessayez dans 15 minutes.' }
});

module.exports = { globalLimiter, aiLimiter, getClientIp, clientIpKey };

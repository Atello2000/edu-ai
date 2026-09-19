const { timingSafeEqual } = require('crypto');
const { isIP } = require('net');
const { ipKeyGenerator, rateLimit } = require('express-rate-limit');

// Only an authenticated upstream may supply the original client address.
function getClientIp(req) {
  const secret = process.env.TRUSTED_PROXY_SECRET;
  const supplied = req.headers['x-jangalai-proxy-secret'];
  const authenticated = typeof secret === 'string' && secret.length >= 32 &&
    typeof supplied === 'string' && Buffer.byteLength(secret) === Buffer.byteLength(supplied) &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
  const forwarded = req.headers['x-vercel-forwarded-for'];
  if (authenticated && typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (isIP(first)) return first;
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

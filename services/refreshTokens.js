const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { prepare } = require('../db');
const logger = require('./logger');

// Entropie indépendante obligatoire en production — un secret dérivé du
// SESSION_SECRET ferait tomber les refresh tokens 7 jours avec lui.
if (!process.env.REFRESH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('REFRESH_SECRET non configuré — variable obligatoire en production.');
}
const REFRESH_SECRET = process.env.REFRESH_SECRET || ((process.env.SESSION_SECRET || '') + ':refresh');

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Deux requêtes parallèles (deux onglets) peuvent présenter le même refresh
// token : pendant cette fenêtre, l'ancien token reste accepté sans re-rotation.
const ROTATION_GRACE_MS = 60 * 1000;

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   REFRESH_TTL_MS,
};

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Émet un refresh token JWT et enregistre son hash en base. Seul un token
// présent en base est utilisable : un JWT signé mais absent (déjà tourné,
// purgé ou forgé après fuite partielle) est rejeté.
async function issueRefreshToken(userId) {
  const jti   = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ userId, type: 'refresh', jti }, REFRESH_SECRET, { expiresIn: '7d' });
  await prepare(
    'INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(hashToken(token), userId, new Date(Date.now() + REFRESH_TTL_MS).toISOString());
  return token;
}

/**
 * Vérifie et consomme un refresh token (rotation à chaque usage).
 * Retourne { userId, iat, newRefreshToken|null } ou null si invalide.
 *
 * Détection de réutilisation : un token déjà tourné (hors fenêtre de grâce)
 * signifie qu'un attaquant et l'utilisateur légitime se partagent le cookie →
 * révocation de TOUTES les sessions de l'utilisateur.
 */
async function consumeRefreshToken(token) {
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, REFRESH_SECRET);
  } catch { return null; }
  if (decoded.type !== 'refresh') return null;

  const row = await prepare(
    'SELECT user_id, rotated_at FROM refresh_tokens WHERE token_hash = ?'
  ).get(hashToken(token));

  // Inconnu en base : token d'avant la migration, ou déjà purgé. On le rejette
  // sans punir (les anciens cookies valides ne doivent pas déclencher une
  // fausse alerte de vol) — l'utilisateur se reconnecte simplement.
  if (!row) return null;

  if (row.rotated_at) {
    const rotatedMs = new Date(row.rotated_at).getTime();
    if (Date.now() - rotatedMs > ROTATION_GRACE_MS) {
      // Réutilisation d'un token déjà tourné → vol probable du cookie.
      logger.warn('Refresh token reuse detected — revoking all sessions', { userId: row.user_id });
      await revokeAllForUser(row.user_id);
      return null;
    }
    // Fenêtre de grâce (requêtes concurrentes) : accepté, pas de nouvelle rotation.
    return { userId: row.user_id, iat: decoded.iat, newRefreshToken: null };
  }

  // Rotation : l'ancien token est marqué consommé (conservé jusqu'à expiration
  // pour la détection de réutilisation), un nouveau est émis.
  await prepare('UPDATE refresh_tokens SET rotated_at = NOW() WHERE token_hash = ?')
    .run(hashToken(token));
  const newRefreshToken = await issueRefreshToken(row.user_id);
  return { userId: row.user_id, iat: decoded.iat, newRefreshToken };
}

async function revokeAllForUser(userId) {
  await prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  await prepare('UPDATE users SET session_invalidated_at = NOW() WHERE id = ?').run(userId);
}

module.exports = {
  REFRESH_SECRET,
  REFRESH_COOKIE_OPTS,
  issueRefreshToken,
  consumeRefreshToken,
  revokeAllForUser,
};

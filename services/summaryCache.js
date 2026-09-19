/**
 * summaryCache.js — clé + accès au cache des résumés (table ai_cache)
 *
 * Extrait de routes/ai/summarize.js pour être réutilisable : les routes
 * mindmap / glossary peuvent ainsi retrouver un résumé déjà généré (et déjà
 * payé) afin d'en DÉRIVER leur résultat localement, sans nouvel appel IA.
 *
 * ⚠️ La chaîne "summarize:v4:..." doit rester IDENTIQUE à celle utilisée
 *    historiquement par summarize.js, sinon les caches existants ne matchent plus.
 */
const crypto      = require('crypto');
const { prepare } = require('../db');

const CACHE_TTL_H = 24; // heures

function summarizeCacheKey(text, lang, user) {
  const profile = `${user?.level || ''}|${Array.isArray(user?.domains) ? user.domains.join(',') : (user?.domains || '')}`;
  return crypto.createHash('sha256').update(`summarize:v4:${lang}:${profile}:${text}`).digest('hex');
}

async function getCached(key) {
  try {
    const row = await prepare('SELECT result FROM ai_cache WHERE cache_key = ? AND expires_at > NOW()').get(key);
    return row?.result || null;
  } catch { return null; }
}

async function setCache(key, result) {
  try {
    const exp = new Date(Date.now() + CACHE_TTL_H * 3600 * 1000).toISOString();
    await prepare(
      `INSERT INTO ai_cache (cache_key, result, expires_at) VALUES (?, ?, ?)
       ON CONFLICT (cache_key) DO UPDATE SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at
       RETURNING cache_key`
    ).run(key, result, exp);
  } catch { /* best-effort */ }
}

module.exports = { CACHE_TTL_H, summarizeCacheKey, getCached, setCache };

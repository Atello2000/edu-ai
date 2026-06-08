/**
 * topicCache.js — cache DB pour les topics (flashcards/quiz sans fichier)
 * Durée : 3 jours. Non critique : les erreurs sont silencieuses.
 */
const crypto = require('crypto');
const db     = require('../../db');

function topicCacheKey(topic, type, lang, user) {
  const data = `${topic}|${type}|${lang}|${user?.level || ''}|${user?.specialty || ''}`;
  return 'topic:' + crypto.createHash('sha256').update(data).digest('hex').slice(0, 40);
}

async function getCachedTopic(key) {
  try {
    const row = await db.prepare(
      'SELECT result FROM ai_cache WHERE cache_key = ? AND expires_at > NOW()'
    ).get(key);
    return row ? JSON.parse(row.result) : null;
  } catch { return null; }
}

async function setCachedTopic(key, data) {
  try {
    const expiresAt = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    await db.prepare(
      `INSERT INTO ai_cache (cache_key, result, expires_at) VALUES (?, ?, ?)
       ON CONFLICT (cache_key) DO UPDATE SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at
       RETURNING cache_key`
    ).run(key, JSON.stringify(data), expiresAt);
  } catch { /* cache non critique */ }
}

module.exports = { topicCacheKey, getCachedTopic, setCachedTopic };

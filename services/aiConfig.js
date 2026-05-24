/**
 * services/aiConfig.js — configuration dynamique du provider IA
 * Lit/écrit dans la table app_config (PostgreSQL).
 * Cache 30 s pour éviter une requête DB à chaque appel.
 */
require('dotenv').config();
const { prepare } = require('../db');

let _cache = null;
const CACHE_TTL = 30_000; // 30 s

const PROVIDERS = {
  groq: {
    label: 'Groq',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — recommandé' },
      { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B — rapide / économique' },
    ],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku — économique' },
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet — équilibré' },
    ],
  },
  deepseek: {
    label: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
    ],
  },
};

async function getAiConfig() {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.cfg;
  const rows = await prepare(
    "SELECT key, value FROM app_config WHERE key IN (?, ?)"
  ).all('ai_provider', 'ai_model');
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const cfg = {
    provider: map.ai_provider || 'groq',
    model:    map.ai_model    || 'llama-3.3-70b-versatile',
  };
  _cache = { cfg, ts: Date.now() };
  return cfg;
}

async function setAiConfig(provider, model) {
  const upsert = "INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value";
  await prepare(upsert).run('ai_provider', provider);
  await prepare(upsert).run('ai_model',    model);
  _cache = null;
}

/**
 * Retourne la config IA de l'utilisateur si définie,
 * sinon la config globale (app_config).
 */
async function getUserAiConfig(userId) {
  if (userId) {
    const row = await prepare(
      'SELECT ai_provider, ai_model FROM users WHERE id = ? AND ai_provider IS NOT NULL'
    ).get(userId);
    if (row?.ai_provider && row?.ai_model) {
      return { provider: row.ai_provider, model: row.ai_model };
    }
  }
  return getAiConfig();
}

/**
 * Enregistre la config IA personnelle d'un utilisateur.
 */
async function setUserAiConfig(userId, provider, model) {
  await prepare('UPDATE users SET ai_provider = ?, ai_model = ? WHERE id = ?').run(provider, model, userId);
}

module.exports = { PROVIDERS, getAiConfig, setAiConfig, getUserAiConfig, setUserAiConfig };

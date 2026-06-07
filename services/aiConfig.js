/**
 * services/aiConfig.js — configuration dynamique du provider IA
 * Lit/écrit dans la table app_config (PostgreSQL).
 * Cache 30 s pour éviter une requête DB à chaque appel.
 */
require('dotenv').config();
const { prepare } = require('../db');
const { hasGeminiApiKey } = require('./geminiKey');

let _cache = null;
const CACHE_TTL = 30_000; // 30 s

const PROVIDERS = {
  mistral: {
    label: 'Mistral AI',
    envKey: 'MISTRAL_API_KEY',
    models: [
      { id: 'mistral-small-latest', label: 'Mistral Small — recommandé' },
      { id: 'open-mistral-7b',      label: 'Mistral 7B — économique' },
      { id: 'mistral-large-latest', label: 'Mistral Large — performant' },
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
  groq: {
    label: 'Groq',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — recommandé' },
      { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B — rapide / économique' },
    ],
  },
  deepseek: {
    label: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
    ],
  },
  gemini: {
    label: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-2.5-flash',        label: 'Gemini 2.5 Flash — recommandé' },
      { id: 'gemini-2.5-pro',          label: 'Gemini 2.5 Pro — performant' },
      { id: 'gemini-flash-latest',     label: 'Gemini 1.5 Flash — stable' },
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
    provider: map.ai_provider || 'mistral',
    model:    map.ai_model    || 'mistral-small-latest',
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
 * Config fixe pour les tâches JSON (quiz, flashcards, glossaire, topic, mindmap).
 * Utilise la config globale (identique au résumé) pour une fiabilité maximale.
 * Fallback vers Haiku si Anthropic est disponible et la config globale est vide.
 */
async function getJsonAiConfig() {
  return getAiConfig();
}

// ── Routing par action — providers économiques en priorité ───────────────────
//
// Ordre de préférence pour les actions standard :
//   1. Mistral Small  (~$0.001/action)   si MISTRAL_API_KEY disponible
//   2. Groq Llama 70B (~$0.00/action)    si GROQ_API_KEY* disponible
//   3. Fallback → config globale admin    (peut être Claude — dernier recours)
//
// Règle : Claude/DeepSeek ne sont jamais utilisés automatiquement pour les
// actions standard. Le x50 de surcoût par rapport à Mistral est trop risqué.

// Gemini en premier (tier gratuit généreux : 1M TPM) → Groq → Mistral en fallback
const CHEAP_PRIORITY = [
  { available: hasGeminiApiKey,
    provider: 'gemini',  model: 'gemini-2.5-flash' },
  { keys: ['GROQ_API_KEY', 'GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3'],
    provider: 'groq',    model: 'llama-3.3-70b-versatile' },
  { keys: ['MISTRAL_API_KEY'],
    provider: 'mistral', model: 'mistral-small-latest' },
];

// Actions JSON légères + conversationnelles → Groq ou Mistral Small (pas besoin de grand modèle).
// Inclut les sorties JSON analytiques (predict/study-plan/error-analysis) : Groq 70B les gère bien.
const CHEAP_ACTIONS = new Set([
  'chat', 'glossary', 'mindmap', 'flashcards', 'quiz',
  'socratic', 'predict', 'study-plan', 'error-analysis',
]);

// Actions Markdown structurées → Groq (70B, gratuit) si dispo, sinon provider principal (Claude)
// Mistral Small évité : trop petit pour produire du Markdown sectionné fiable
const STRUCTURED_ACTIONS = new Set(['summarize', 'exam-sheet', 'compare']);

/**
 * Retourne la config la moins chère disponible pour une action donnée.
 * Pour toutes les actions standard → Mistral Small > Groq.
 * Si aucun provider économique n'est configuré → erreur explicite.
 * Claude/DeepSeek ne sont JAMAIS utilisés en fallback automatique (risque x50 de coût).
 */
async function getAiConfigForAction(action) {
  if (CHEAP_ACTIONS.has(action)) {
    // Actions JSON légères : Groq → Mistral → erreur (jamais Claude)
    for (const { keys, available, provider, model } of CHEAP_PRIORITY) {
      if ((available && available()) || keys?.some(k => process.env[k])) return { provider, model };
    }
    throw new Error('Service temporairement indisponible. Réessayez dans quelques instants.');
  }

  if (STRUCTURED_ACTIONS.has(action)) {
    // Actions Markdown structurées : Groq 70B → Gemini 2.0 Flash → Claude (dernier recours)
    // Mistral Small exclu : trop petit pour du Markdown sectionné fiable
    for (const { keys, available, provider, model } of CHEAP_PRIORITY) {
      if ((available && available()) || keys?.some(k => process.env[k])) return { provider, model };
    }
    return getAiConfig(); // Claude ou provider admin
  }

  return getAiConfig();
}

/**
 * Enregistre la config IA personnelle d'un utilisateur.
 */
async function setUserAiConfig(userId, provider, model) {
  await prepare('UPDATE users SET ai_provider = ?, ai_model = ? WHERE id = ?').run(provider, model, userId);
}

module.exports = { PROVIDERS, getAiConfig, setAiConfig, getUserAiConfig, setUserAiConfig, getJsonAiConfig, getAiConfigForAction };

require('dotenv').config();
const { OpenAI }    = require('openai');
const Anthropic     = require('@anthropic-ai/sdk');
const logger        = require('./logger');
const { getAiConfig } = require('./aiConfig');
const {
  getGeminiApiKey,
  getGeminiCooldownMs,
  isGeminiCoolingDown,
  markGeminiRateLimited,
} = require('./geminiKey');

const IS_PROD = process.env.NODE_ENV === 'production';

// maxRetries: 0 — la cascade de fallback ci-dessous remplace les retries du
// SDK (2 par défaut, avec backoff) : basculer vers un autre provider est plus
// rapide que réessayer un provider rate-limité.
const CLIENT_OPTS = { maxRetries: 0, timeout: 120_000 };

// ── Clients ───────────────────────────────────────────────────────────────────

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const groqClients = ['GROQ_API_KEY', 'GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3']
  .map(k => process.env[k]).filter(Boolean)
  .map(apiKey => new OpenAI({ apiKey, baseURL: GROQ_BASE, ...CLIENT_OPTS }));

let _groqIdx = 0;

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...CLIENT_OPTS })
  : null;

const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1', ...CLIENT_OPTS })
  : null;

const mistral = process.env.MISTRAL_API_KEY
  ? new OpenAI({ apiKey: process.env.MISTRAL_API_KEY, baseURL: 'https://api.mistral.ai/v1', ...CLIENT_OPTS })
  : null;

// Gemini via endpoint compatible OpenAI (pas besoin de SDK séparé)
const geminiApiKey = getGeminiApiKey();
const gemini = geminiApiKey
  ? new OpenAI({
      apiKey:  geminiApiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      ...CLIENT_OPTS,
    })
  : null;

// GitHub Models
const github = process.env.GITHUB_TOKEN
  ? new OpenAI({
      apiKey:  process.env.GITHUB_TOKEN,
      baseURL: 'https://models.github.ai/inference',
      ...CLIENT_OPTS,
    })
  : null;

const MODEL_LABEL = 'IA';

function geminiCooldownError() {
  const seconds = Math.ceil(getGeminiCooldownMs() / 1000);
  const err = new Error(`Gemini temporarily cooling down (${seconds}s remaining)`);
  err.status = 429;
  return err;
}

// ── Labels ────────────────────────────────────────────────────────────────────

const ANTHROPIC_LABELS = {
  'claude-haiku-4-5-20251001': 'Claude Haiku',
  'claude-sonnet-4-6':         'Claude Sonnet',
  'claude-opus-4-7':           'Claude Opus',
};
function anthropicLabel(model) { return ANTHROPIC_LABELS[model] || `Claude (${model})`; }

const LABELS = {
  groq:     m => m.includes('8b') ? 'Groq · Llama 3.1-8b' : 'Groq · Llama 3.3',
  deepseek: () => 'DeepSeek · Chat',
  mistral:  m => m.includes('large') ? 'Mistral Large' : m.includes('small') ? 'Mistral Small' : 'Mistral 7B',
  gemini:   m => m.includes('2.5') ? 'Gemini 2.5 Flash' : m.includes('2.0') ? 'Gemini 2.0 Flash' : 'Gemini 1.5 Flash',
  github:   m => m === 'gpt-4o-mini' ? 'GitHub · GPT-4o Mini' : m === 'gpt-4o' ? 'GitHub · GPT-4o' : 'GitHub · Phi-4',
};

const USAGE_PROVIDERS = {
  groq: 'Groq', deepseek: 'DeepSeek', mistral: 'Mistral', gemini: 'Gemini', github: 'GitHub',
};

// ── Groq helpers (rotation multi-clés sur 429) ────────────────────────────────

async function groqRequest(params) {
  if (!groqClients.length) throw new Error('Aucune clé Groq configurée (GROQ_API_KEY)');
  let lastErr;
  for (let i = 0; i < groqClients.length; i++) {
    const idx = (_groqIdx + i) % groqClients.length;
    try {
      const result = await groqClients[idx].chat.completions.create(params);
      _groqIdx = (idx + 1) % groqClients.length; // round-robin réel
      return result;
    } catch (err) {
      lastErr = err;
      if (err?.status === 429) { logger.warn(`Groq key ${idx} rate-limited, trying next`); continue; }
      throw err;
    }
  }
  throw lastErr;
}

// ── Gemini helper (cooldown partagé + retry avec backoff) ─────────────────────

async function geminiRequest(params) {
  if (!gemini) throw new Error('Clé Gemini non configurée (GEMINI_API_KEY ou GOOGLE_API_KEY)');
  if (isGeminiCoolingDown()) throw geminiCooldownError();
  let delay = 1500;
  for (let attempt = 1; ; attempt++) {
    try {
      return await gemini.chat.completions.create(params);
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.status === 503;
      if (isRateLimit && attempt < 2) {
        logger.warn(`Gemini rate-limited (attempt ${attempt}/2). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      if (isRateLimit) markGeminiRateLimited();
      throw err;
    }
  }
}

// ── Registre des providers ────────────────────────────────────────────────────
// Chaque provider expose : available(), complete() et stream() avec la même
// signature ({ model, messages, maxTokens }) — `messages` au format OpenAI
// (system inclus comme premier message). Anthropic est traité à part (format
// différent) et n'apparaît jamais dans les cascades de fallback.

function usageOf(provider, u) {
  return { provider: USAGE_PROVIDERS[provider], input: u?.prompt_tokens || 0, output: u?.completion_tokens || 0 };
}

function makeOpenAIProvider(name, request) {
  return {
    available: () => true, // gardé par PROVIDERS[p] !== undefined côté cascade
    async complete({ model, messages, maxTokens }) {
      const r = await request({ model, max_tokens: maxTokens, messages });
      return { text: r.choices[0].message.content, model: LABELS[name](model), usage: usageOf(name, r.usage) };
    },
    async *stream({ model, messages, maxTokens }) {
      const stream = await request({
        model, max_tokens: maxTokens, messages,
        stream: true, stream_options: { include_usage: true },
      });
      const label = LABELS[name](model);
      try {
        for await (const chunk of stream) {
          const text = chunk.choices?.[0]?.delta?.content || '';
          if (text) yield { text, model: label };
          if (chunk.usage) yield { usage: usageOf(name, chunk.usage) };
        }
      } catch (err) {
        if (name === 'gemini' && (err?.status === 429 || err?.status === 503)) markGeminiRateLimited();
        throw err;
      }
    },
  };
}

function clientRequest(getClient, missingKeyMsg) {
  return (params) => {
    const client = getClient();
    if (!client) throw new Error(missingKeyMsg);
    return client.chat.completions.create(params);
  };
}

const PROVIDERS = {
  groq:     makeOpenAIProvider('groq',     groqRequest),
  gemini:   makeOpenAIProvider('gemini',   geminiRequest),
  mistral:  makeOpenAIProvider('mistral',  clientRequest(() => mistral,  'Clé Mistral non configurée (MISTRAL_API_KEY)')),
  deepseek: makeOpenAIProvider('deepseek', clientRequest(() => deepseek, 'Clé DeepSeek non configurée')),
  github:   makeOpenAIProvider('github',   clientRequest(() => github,   'Clé GitHub Models non configurée (GITHUB_TOKEN)')),
};

function providerConfigured(name) {
  if (name === 'groq')     return groqClients.length > 0;
  if (name === 'gemini')   return !!gemini;
  if (name === 'mistral')  return !!mistral;
  if (name === 'deepseek') return !!deepseek;
  if (name === 'github')   return !!github;
  return false;
}

// ── Anthropic (format propre : system séparé, messages bruts) ─────────────────

async function anthropicComplete({ model, messages, maxTokens, system }) {
  if (!anthropicClient) throw new Error('Clé Anthropic non configurée (ANTHROPIC_API_KEY)');
  const params = { model, max_tokens: maxTokens, messages };
  if (system) params.system = system;
  const r = await anthropicClient.messages.create(params);
  return {
    text:  r.content[0].text,
    model: anthropicLabel(model),
    usage: { provider: 'Anthropic', input: r.usage.input_tokens, output: r.usage.output_tokens },
  };
}

async function* anthropicStream({ model, messages, maxTokens, system }) {
  if (!anthropicClient) throw new Error('Clé Anthropic non configurée (ANTHROPIC_API_KEY)');
  const label = anthropicLabel(model);
  const params = { model, max_tokens: maxTokens, messages };
  if (system) params.system = system;
  const stream = anthropicClient.messages.stream(params);
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield { text: event.delta.text, model: label };
    }
  }
  const final = await stream.finalMessage();
  yield { usage: { provider: 'Anthropic', input: final.usage.input_tokens, output: final.usage.output_tokens } };
}

// ── Cascade de fallback (implémentation unique) ───────────────────────────────
// Erreur de quota sur le provider primaire → ordre de cascade dédié.
// Toute autre erreur → ordre par défaut, en sautant le provider qui a échoué.

const QUOTA_STATUSES = { groq: [429, 413], gemini: [429, 503], github: [429, 403] };
const CASCADES = {
  github:  ['gemini', 'groq', 'mistral'],
  gemini:  ['groq', 'github', 'mistral'],
  groq:    ['gemini', 'github', 'mistral'],
  default: ['groq', 'github', 'mistral'],
};
const FALLBACK_MODELS = {
  groq:    'llama-3.3-70b-versatile',
  gemini:  'gemini-2.5-flash',
  github:  'gpt-4o-mini',
  mistral: 'mistral-small-latest',
};
const ALL_DOWN_MSG = 'Tous les providers IA sont indisponibles. Réessayez dans quelques minutes.';

function isQuotaError(provider, err) {
  return (QUOTA_STATUSES[provider] || []).includes(err?.status);
}

function fallbackChain(provider, err) {
  const chain = isQuotaError(provider, err)
    ? CASCADES[provider]
    : CASCADES.default.filter(p => p !== provider);
  return chain.filter(providerConfigured);
}

async function completeWithFallback({ provider, model, messages, maxTokens, system }) {
  try {
    if (provider === 'anthropic') return await anthropicComplete({ model, messages, maxTokens, system });
    if (!PROVIDERS[provider]) provider = 'groq';
    return await PROVIDERS[provider].complete({ model, messages, maxTokens });
  } catch (err) {
    const quota = isQuotaError(provider, err);
    logger.warn(`Provider ${provider} failed (${err?.status || ''} ${err.message}), fallback cascade`);
    for (const p of fallbackChain(provider, err)) {
      try {
        return await PROVIDERS[p].complete({ model: FALLBACK_MODELS[p], messages, maxTokens });
      } catch (e) {
        logger.warn(`${p} fallback failed (${e.message})`);
      }
    }
    throw quota ? new Error(ALL_DOWN_MSG) : err;
  }
}

async function* streamWithFallback({ provider, model, messages, maxTokens, system, anthMessages }) {
  // Garde anti-duplication : si du texte a déjà été envoyé au client, on ne
  // relance pas la réponse depuis zéro sur un autre provider.
  let started = false;
  const track = async function* (gen) {
    for await (const chunk of gen) {
      if (chunk.text) started = true;
      yield chunk;
    }
  };

  try {
    if (provider === 'anthropic') {
      yield* track(anthropicStream({ model, messages: anthMessages || messages, maxTokens, system }));
      return;
    }
    if (!PROVIDERS[provider]) provider = 'groq';
    yield* track(PROVIDERS[provider].stream({ model, messages, maxTokens }));
    return;
  } catch (err) {
    if (started) throw err;
    const quota = isQuotaError(provider, err);
    logger.warn(`Provider ${provider} failed (stream, ${err?.status || ''} ${err.message}), fallback cascade`);
    for (const p of fallbackChain(provider, err)) {
      try {
        yield* track(PROVIDERS[p].stream({ model: FALLBACK_MODELS[p], messages, maxTokens }));
        return;
      } catch (e) {
        if (started) throw e;
        logger.warn(`${p} stream fallback failed (${e.message})`);
      }
    }
    throw quota ? new Error(ALL_DOWN_MSG) : err;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

async function* aiStream(prompt, maxTokens = 4096, config = null) {
  const { provider, model } = config || await getAiConfig();
  const messages = [{ role: 'user', content: prompt }];
  yield* streamWithFallback({ provider, model, messages, maxTokens });
}

async function aiComplete(prompt, maxTokens = 3000, config = null) {
  const { provider, model } = config || await getAiConfig();
  const messages = [{ role: 'user', content: prompt }];
  return completeWithFallback({ provider, model, messages, maxTokens });
}

async function aiCompleteFast(prompt, maxTokens = 2000, config = null) {
  // Provider personnel configuré → le respecter
  if (config) return aiComplete(prompt, maxTokens, config);
  // Sinon modèle Groq rapide en priorité, puis provider global actif
  if (groqClients.length) {
    try {
      const r = await groqRequest({ model: 'llama-3.1-8b-instant', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
      return { text: r.choices[0].message.content, model: 'Groq · Llama 3.1-8b', usage: usageOf('groq', r.usage) };
    } catch (err) {
      logger.warn('Groq fast fallback to active provider', { message: err?.message });
    }
  }
  return aiComplete(prompt, maxTokens);
}

// ── Chat (system prompt + historique + images éventuelles) ────────────────────

function toOpenAIMessages(messages) {
  return messages.map(msg => {
    if (typeof msg.content === 'string') return msg;
    const parts = msg.content.map(c => {
      if (c.type === 'text') return { type: 'text', text: c.text };
      if (c.type === 'image') {
        const { media_type, data } = c.source;
        return { type: 'image_url', image_url: { url: `data:${media_type};base64,${data}` } };
      }
      return c;
    });
    return { role: msg.role, content: parts };
  });
}

const IMAGE_MODEL = 'claude-haiku-4-5-20251001';

async function aiChat(systemPrompt, messages, maxTokens = 1024, hasImage = false, config = null) {
  const { provider, model } = config || await getAiConfig();

  // Requêtes avec image : Anthropic uniquement, pas de fallback possible
  if (hasImage) {
    return anthropicComplete({ model: IMAGE_MODEL, messages, maxTokens, system: systemPrompt });
  }

  const oaiMsgs = [{ role: 'system', content: systemPrompt }, ...toOpenAIMessages(messages)];
  if (provider === 'anthropic') {
    try {
      return await anthropicComplete({ model, messages, maxTokens, system: systemPrompt });
    } catch (err) {
      logger.warn(`Anthropic chat failed (${err.message}), fallback cascade`);
      return completeWithFallback({ provider: 'groq', model: FALLBACK_MODELS.groq, messages: oaiMsgs, maxTokens });
    }
  }
  return completeWithFallback({ provider, model, messages: oaiMsgs, maxTokens });
}

async function* aiChatStream(systemPrompt, messages, maxTokens = 1024, hasImage = false, config = null) {
  const { provider, model } = config || await getAiConfig();

  // Requêtes avec image : Anthropic uniquement, pas de fallback possible
  if (hasImage) {
    yield* anthropicStream({ model: IMAGE_MODEL, messages, maxTokens, system: systemPrompt });
    return;
  }

  const oaiMsgs = [{ role: 'system', content: systemPrompt }, ...toOpenAIMessages(messages)];
  yield* streamWithFallback({ provider, model, messages: oaiMsgs, maxTokens, system: systemPrompt, anthMessages: messages });
}

function calcMaxTokens(type, textLen, count = 0) {
  if (type === 'summary') {
    if (textLen < 5000)  return 1600;
    if (textLen < 15000) return 2600;
    if (textLen < 40000) return 3800;
    return 4500;
  }
  if (type === 'quiz')  return Math.min(count * 2000 + 1000, 8000);
  if (type === 'flash') return Math.min(count * 350 + 500, 6000);
  return 2048;
}

module.exports = {
  IS_PROD, MODEL_LABEL, deepseek, mistral, github,
  DEEPSEEK_MODEL: 'deepseek-chat',
  aiComplete, aiCompleteFast, aiStream, aiChat, aiChatStream, calcMaxTokens,
};

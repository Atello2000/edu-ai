require('dotenv').config();
const { OpenAI }    = require('openai');
const Anthropic     = require('@anthropic-ai/sdk');
const logger        = require('./logger');
const { getAiConfig } = require('./aiConfig');
const { getGeminiApiKey } = require('./geminiKey');

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Clients ───────────────────────────────────────────────────────────────────

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const groqClients = ['GROQ_API_KEY', 'GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3']
  .map(k => process.env[k]).filter(Boolean)
  .map(apiKey => new OpenAI({ apiKey, baseURL: GROQ_BASE }));

let _groqIdx = 0;

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1' })
  : null;

const mistral = process.env.MISTRAL_API_KEY
  ? new OpenAI({ apiKey: process.env.MISTRAL_API_KEY, baseURL: 'https://api.mistral.ai/v1' })
  : null;

// Gemini via endpoint compatible OpenAI (pas besoin de SDK séparé)
const geminiApiKey = getGeminiApiKey();
const gemini = geminiApiKey
  ? new OpenAI({
      apiKey:  geminiApiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  : null;

const MODEL_LABEL = 'IA';

// ── Label helpers ─────────────────────────────────────────────────────────────

const ANTHROPIC_LABELS = {
  'claude-haiku-4-5-20251001': 'Claude Haiku',
  'claude-sonnet-4-6':         'Claude Sonnet',
  'claude-opus-4-7':           'Claude Opus',
};
function anthropicLabel(model) { return ANTHROPIC_LABELS[model] || `Claude (${model})`; }

// ── Groq helpers (multi-key rotation + 429 retry) ─────────────────────────────

async function groqComplete(params) {
  if (!groqClients.length) throw new Error('Aucune clé Groq configurée (GROQ_API_KEY)');
  let lastErr;
  for (let i = 0; i < groqClients.length; i++) {
    const idx = (_groqIdx + i) % groqClients.length;
    const client = groqClients[idx];
    try {
      const result = await client.chat.completions.create(params);
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

async function groqStream(params) {
  if (!groqClients.length) throw new Error('Aucune clé Groq configurée (GROQ_API_KEY)');
  let lastErr;
  for (let i = 0; i < groqClients.length; i++) {
    const idx = (_groqIdx + i) % groqClients.length;
    const client = groqClients[idx];
    try {
      const stream = await client.chat.completions.create({ ...params, stream: true });
      _groqIdx = (idx + 1) % groqClients.length; // round-robin réel
      return stream;
    } catch (err) {
      lastErr = err;
      if (err?.status === 429) { logger.warn(`Groq key ${idx} rate-limited (stream), trying next`); continue; }
      throw err;
    }
  }
  throw lastErr;
}

// ── Provider stream generators ────────────────────────────────────────────────

async function* streamGroq(model, messages, maxTokens) {
  const stream = await groqStream({
    model, max_tokens: maxTokens, messages,
    stream_options: { include_usage: true },
  });
  const label = model.includes('8b') ? 'Groq · Llama 3.1-8b' : 'Groq · Llama 3.3';
  for await (const chunk of stream) {
    if (chunk.usage) {
      yield { usage: { provider: 'Groq', input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens } };
      continue;
    }
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) yield { text, model: label };
  }
}

async function* streamAnthropic(model, messages, maxTokens, system) {
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

async function* streamDeepSeek(model, messages, maxTokens) {
  if (!deepseek) throw new Error('Clé DeepSeek non configurée (DEEPSEEK_API_KEY)');
  const stream = await deepseek.chat.completions.create({
    model, max_tokens: maxTokens, stream: true, messages,
    stream_options: { include_usage: true },
  });
  for await (const chunk of stream) {
    if (chunk.usage) {
      yield { usage: { provider: 'DeepSeek', input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens } };
      continue;
    }
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) yield { text, model: 'DeepSeek · Chat' };
  }
}

async function* streamMistral(model, messages, maxTokens) {
  if (!mistral) throw new Error('Clé Mistral non configurée (MISTRAL_API_KEY)');
  const label = model.includes('large') ? 'Mistral Large'
              : model.includes('small') ? 'Mistral Small'
              : 'Mistral 7B';
  const stream = await mistral.chat.completions.create({
    model, max_tokens: maxTokens, stream: true, messages,
    stream_options: { include_usage: true },
  });
  for await (const chunk of stream) {
    if (chunk.usage) {
      yield { usage: { provider: 'Mistral', input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens } };
      continue;
    }
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) yield { text, model: label };
  }
}

async function* streamGemini(model, messages, maxTokens) {
  if (!gemini) throw new Error('Clé Gemini non configurée (GEMINI_API_KEY ou GOOGLE_API_KEY)');
  const label = model.includes('2.5') ? 'Gemini 2.5 Flash'
              : model.includes('2.0') ? 'Gemini 2.0 Flash'
              : 'Gemini 1.5 Flash';

  let stream;
  let retries = 3;
  let delay = 1000;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      stream = await gemini.chat.completions.create({
        model, max_tokens: maxTokens, stream: true, messages,
        stream_options: { include_usage: true },
      });
      break;
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.status === 503;
      if (isRateLimit && attempt < retries) {
        logger.warn(`Gemini stream creation rate-limited (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }

  for await (const chunk of stream) {
    if (chunk.usage) {
      yield { usage: { provider: 'Gemini', input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens } };
      continue;
    }
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) yield { text, model: label };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

async function* aiStream(prompt, maxTokens = 4096, config = null) {
  const { provider, model } = config || await getAiConfig();
  const messages = [{ role: 'user', content: prompt }];
  try {
    if (provider === 'anthropic') { yield* streamAnthropic(model, messages, maxTokens, null); return; }
    if (provider === 'deepseek')  { yield* streamDeepSeek(model, messages, maxTokens); return; }
    if (provider === 'mistral')   { yield* streamMistral(model, messages, maxTokens); return; }
    if (provider === 'gemini')    { yield* streamGemini(model, messages, maxTokens); return; }
    yield* streamGroq(model, messages, maxTokens);
  } catch (err) {
    const isGroqQuota   = provider === 'groq'   && (err?.status === 429 || err?.status === 413);
    const isGeminiQuota = provider === 'gemini' && (err?.status === 429 || err?.status === 503);

    // Gemini 429/503 (provider primaire) → cascade : Groq → Mistral
    if (isGeminiQuota) {
      logger.warn(`Gemini ${err.status} (quota), fallback cascade`);
      if (groqClients.length) {
        try { yield* streamGroq('llama-3.3-70b-versatile', messages, maxTokens); return; }
        catch (e) { logger.warn(`Groq fallback failed (${e.message}), trying Mistral`); }
      }
      if (mistral) {
        try { yield* streamMistral('mistral-small-latest', messages, maxTokens); return; }
        catch (e) { logger.warn(`Mistral fallback failed (${e.message})`); }
      }
      throw new Error('Tous les providers IA sont indisponibles. Réessayez dans quelques minutes.');
    }

    // Groq 429/413 → cascade : Gemini → Mistral
    if (isGroqQuota) {
      logger.warn(`Groq ${err.status} (quota/size), fallback cascade`);
      if (gemini) {
        try { yield* streamGemini('gemini-2.5-flash', messages, maxTokens); return; }
        catch (e) { logger.warn(`Gemini fallback failed (${e.message}), trying Mistral`); }
      }
      if (mistral) {
        try { yield* streamMistral('mistral-small-latest', messages, maxTokens); return; }
        catch (e) { logger.warn(`Mistral fallback failed (${e.message})`); }
      }
      throw new Error('Tous les providers IA sont indisponibles. Réessayez dans quelques minutes.');
    }

    // Autre provider échoue → Groq → Mistral en dernier recours
    if (provider !== 'groq' && groqClients.length) {
      logger.warn(`Provider ${provider} failed (${err.message}), fallback → Groq`);
      try { yield* streamGroq('llama-3.3-70b-versatile', messages, maxTokens); return; }
      catch (e) { logger.warn(`Groq fallback failed (${e.message}), trying Mistral`); }
    }
    if (provider !== 'mistral' && mistral) {
      try { yield* streamMistral('mistral-small-latest', messages, maxTokens); return; }
      catch (e) { logger.warn(`Mistral last-resort failed (${e.message})`); }
    }

    throw err;
  }
}

async function aiComplete(prompt, maxTokens = 3000, config = null) {
  const { provider, model } = config || await getAiConfig();
  const messages = [{ role: 'user', content: prompt }];

  async function tryGroqFallback() {
    if (!groqClients.length) throw new Error('Aucune clé Groq configurée');
    const r = await groqComplete({ model: 'llama-3.3-70b-versatile', max_tokens: maxTokens, messages });
    return { text: r.choices[0].message.content, model: 'Groq · Llama 3.3', usage: { provider: 'Groq', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
  }

  try {
    if (provider === 'anthropic') {
      if (!anthropicClient) throw new Error('Clé Anthropic non configurée');
      const r = await anthropicClient.messages.create({ model, max_tokens: maxTokens, messages });
      return {
        text:  r.content[0].text,
        model: anthropicLabel(model),
        usage: { provider: 'Anthropic', input: r.usage.input_tokens, output: r.usage.output_tokens },
      };
    }
    if (provider === 'deepseek') {
      if (!deepseek) throw new Error('Clé DeepSeek non configurée');
      const r = await deepseek.chat.completions.create({ model, max_tokens: maxTokens, messages });
      return { text: r.choices[0].message.content, model: 'DeepSeek · Chat', usage: { provider: 'DeepSeek', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
    }
    if (provider === 'mistral') {
      if (!mistral) throw new Error('Clé Mistral non configurée (MISTRAL_API_KEY)');
      const mistralLabel = model.includes('large') ? 'Mistral Large' : model.includes('small') ? 'Mistral Small' : 'Mistral 7B';
      const r = await mistral.chat.completions.create({ model, max_tokens: maxTokens, messages });
      return { text: r.choices[0].message.content, model: mistralLabel, usage: { provider: 'Mistral', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
    }
    if (provider === 'gemini') {
      if (!gemini) throw new Error('Clé Gemini non configurée (GEMINI_API_KEY ou GOOGLE_API_KEY)');
      const geminiLabel = model.includes('2.5') ? 'Gemini 2.5 Flash' : model.includes('2.0') ? 'Gemini 2.0 Flash' : 'Gemini 1.5 Flash';
      let r;
      let retries = 3;
      let delay = 1000;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          r = await gemini.chat.completions.create({ model, max_tokens: maxTokens, messages });
          break;
        } catch (err) {
          const isRateLimit = err?.status === 429 || err?.status === 503;
          if (isRateLimit && attempt < retries) {
            logger.warn(`Gemini complete rate-limited (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw err;
        }
      }
      return { text: r.choices[0].message.content, model: geminiLabel, usage: { provider: 'Gemini', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
    }
    // groq
    const r = await groqComplete({ model, max_tokens: maxTokens, messages });
    const label = model.includes('8b') ? 'Groq · Llama 3.1-8b' : 'Groq · Llama 3.3';
    return { text: r.choices[0].message.content, model: label, usage: { provider: 'Groq', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
  } catch (err) {
    const isGroqQuota   = provider === 'groq'   && (err?.status === 429 || err?.status === 413);
    const isGeminiQuota = provider === 'gemini' && (err?.status === 429 || err?.status === 503);

    // Gemini 429/503 (provider primaire) → cascade : Groq → Mistral
    if (isGeminiQuota) {
      logger.warn(`Gemini ${err.status} (quota), fallback cascade`);
      if (groqClients.length) {
        try { return await tryGroqFallback(); }
        catch (e) { logger.warn(`Groq fallback failed (${e.message}), trying Mistral`); }
      }
      if (mistral) {
        try {
          const r = await mistral.chat.completions.create({ model: 'mistral-small-latest', max_tokens: maxTokens, messages });
          return { text: r.choices[0].message.content, model: 'Mistral Small', usage: { provider: 'Mistral', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
        } catch (e) { logger.warn(`Mistral fallback failed (${e.message})`); }
      }
      throw new Error('Tous les providers IA sont indisponibles. Réessayez dans quelques minutes.');
    }

    // Groq 429/413 → cascade : Gemini → Mistral
    if (isGroqQuota) {
      logger.warn(`Groq ${err.status} (quota/size), fallback cascade`);
      if (gemini) {
        try {
          const r = await gemini.chat.completions.create({ model: 'gemini-2.5-flash', max_tokens: maxTokens, messages });
          return { text: r.choices[0].message.content, model: 'Gemini 2.5 Flash', usage: { provider: 'Gemini', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
        } catch (e) { logger.warn(`Gemini fallback failed (${e.message}), trying Mistral`); }
      }
      if (mistral) {
        try {
          const r = await mistral.chat.completions.create({ model: 'mistral-small-latest', max_tokens: maxTokens, messages });
          return { text: r.choices[0].message.content, model: 'Mistral Small', usage: { provider: 'Mistral', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
        } catch (e) { logger.warn(`Mistral fallback failed (${e.message})`); }
      }
      throw new Error('Tous les providers IA sont indisponibles. Réessayez dans quelques minutes.');
    }

    // Autre provider échoue → Groq → Mistral en dernier recours
    if (provider !== 'groq' && groqClients.length) {
      logger.warn(`Provider ${provider} failed (${err.message}), fallback → Groq`);
      try { return await tryGroqFallback(); }
      catch (e) { logger.warn(`Groq fallback failed (${e.message}), trying Mistral`); }
    }
    if (provider !== 'mistral' && mistral) {
      try {
        const r = await mistral.chat.completions.create({ model: 'mistral-small-latest', max_tokens: maxTokens, messages });
        return { text: r.choices[0].message.content, model: 'Mistral Small', usage: { provider: 'Mistral', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
      } catch (e) { logger.warn(`Mistral last-resort failed (${e.message})`); }
    }
    throw err;
  }
}

async function aiCompleteFast(prompt, maxTokens = 2000, config = null) {
  // If user has a personal provider configured, respect it
  if (config) return aiComplete(prompt, maxTokens, config);
  // Otherwise try fast Groq model first, then fallback to active global provider
  if (groqClients.length) {
    try {
      const r = await groqComplete({ model: 'llama-3.1-8b-instant', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
      return { text: r.choices[0].message.content, model: 'Groq · Llama 3.1-8b', usage: { provider: 'Groq', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
    } catch (err) {
      logger.warn('Groq fast fallback to active provider', { message: err?.message });
    }
  }
  return aiComplete(prompt, maxTokens);
}

// ── Chat (with system prompt + history + optional images) ─────────────────────

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

async function aiChat(systemPrompt, messages, maxTokens = 1024, hasImage = false, config = null) {
  const { provider, model } = config || await getAiConfig();

  // Requêtes avec image : Anthropic uniquement, pas de fallback possible
  if (hasImage) {
    if (!anthropicClient) throw new Error('Clé Anthropic non configurée (image requise)');
    const r = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      system: systemPrompt, max_tokens: maxTokens, messages,
    });
    return { text: r.content[0].text, model: anthropicLabel('claude-haiku-4-5-20251001'), usage: { provider: 'Anthropic', input: r.usage.input_tokens, output: r.usage.output_tokens } };
  }

  const oaiMsgs = [{ role: 'system', content: systemPrompt }, ...toOpenAIMessages(messages)];

  async function tryGroqChat() {
    const r = await groqComplete({ model: 'llama-3.3-70b-versatile', max_tokens: maxTokens, messages: oaiMsgs });
    return { text: r.choices[0].message.content, model: 'Groq · Llama 3.3', usage: { provider: 'Groq', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
  }

  try {
    if (provider === 'anthropic') {
      if (!anthropicClient) throw new Error('Clé Anthropic non configurée');
      const r = await anthropicClient.messages.create({
        model, system: systemPrompt, max_tokens: maxTokens, messages,
      });
      return { text: r.content[0].text, model: anthropicLabel(model), usage: { provider: 'Anthropic', input: r.usage.input_tokens, output: r.usage.output_tokens } };
    }
    if (provider === 'deepseek') {
      if (!deepseek) throw new Error('Clé DeepSeek non configurée');
      const r = await deepseek.chat.completions.create({ model, max_tokens: maxTokens, messages: oaiMsgs });
      return { text: r.choices[0].message.content, model: 'DeepSeek · Chat', usage: { provider: 'DeepSeek', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
    }
    if (provider === 'mistral') {
      if (!mistral) throw new Error('Clé Mistral non configurée (MISTRAL_API_KEY)');
      const mistralLabel = model.includes('large') ? 'Mistral Large' : model.includes('small') ? 'Mistral Small' : 'Mistral 7B';
      const r = await mistral.chat.completions.create({ model, max_tokens: maxTokens, messages: oaiMsgs });
      return { text: r.choices[0].message.content, model: mistralLabel, usage: { provider: 'Mistral', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
    }
    if (provider === 'gemini') {
      if (!gemini) throw new Error('Clé Gemini non configurée (GEMINI_API_KEY ou GOOGLE_API_KEY)');
      const geminiLabel = model.includes('2.5') ? 'Gemini 2.5 Flash' : model.includes('2.0') ? 'Gemini 2.0 Flash' : 'Gemini 1.5 Flash';
      let r;
      let retries = 3;
      let delay = 1000;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          r = await gemini.chat.completions.create({ model, max_tokens: maxTokens, messages: oaiMsgs });
          break;
        } catch (err) {
          const isRateLimit = err?.status === 429 || err?.status === 503;
          if (isRateLimit && attempt < retries) {
            logger.warn(`Gemini chat rate-limited (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw err;
        }
      }
      return { text: r.choices[0].message.content, model: geminiLabel, usage: { provider: 'Gemini', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
    }
    // groq (défaut)
    const r = await groqComplete({ model, max_tokens: maxTokens, messages: oaiMsgs });
    const label = model.includes('8b') ? 'Groq · Llama 3.1-8b' : 'Groq · Llama 3.3';
    return { text: r.choices[0].message.content, model: label, usage: { provider: 'Groq', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };

  } catch (err) {
    const isGroqQuota = provider === 'groq' && (err?.status === 429 || err?.status === 413);

    if (isGroqQuota) {
      logger.warn(`Groq ${err.status} (chat), fallback cascade`);
      if (gemini) {
        try {
          const r = await gemini.chat.completions.create({ model: 'gemini-2.5-flash', max_tokens: maxTokens, messages: oaiMsgs });
          return { text: r.choices[0].message.content, model: 'Gemini 2.5 Flash', usage: { provider: 'Gemini', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
        } catch (e) { logger.warn(`Gemini chat fallback failed (${e.message}), trying Mistral`); }
      }
      if (mistral) {
        try {
          const r = await mistral.chat.completions.create({ model: 'mistral-small-latest', max_tokens: maxTokens, messages: oaiMsgs });
          return { text: r.choices[0].message.content, model: 'Mistral Small', usage: { provider: 'Mistral', input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 } };
        } catch (e) { logger.warn(`Mistral chat fallback failed (${e.message})`); }
      }
      throw new Error('Tous les providers IA sont indisponibles. Réessayez dans quelques minutes.');
    }

    // Autre provider échoue → Groq
    if (provider !== 'groq' && groqClients.length) {
      logger.warn(`Provider ${provider} failed (chat, ${err.message}), fallback → Groq`);
      return tryGroqChat();
    }
    throw err;
  }
}

async function* aiChatStream(systemPrompt, messages, maxTokens = 1024, hasImage = false, config = null) {
  const { provider, model } = config || await getAiConfig();

  // Requêtes avec image : Anthropic uniquement, pas de fallback possible
  if (hasImage) {
    yield* streamAnthropic('claude-haiku-4-5-20251001', messages, maxTokens, systemPrompt);
    return;
  }

  const oaiMsgs = [{ role: 'system', content: systemPrompt }, ...toOpenAIMessages(messages)];

  try {
    if (provider === 'anthropic') {
      yield* streamAnthropic(model, messages, maxTokens, systemPrompt);
      return;
    }
    if (provider === 'deepseek') { yield* streamDeepSeek(model, oaiMsgs, maxTokens); return; }
    if (provider === 'mistral')  { yield* streamMistral(model, oaiMsgs, maxTokens); return; }
    if (provider === 'gemini')   { yield* streamGemini(model, oaiMsgs, maxTokens); return; }
    yield* streamGroq(model, oaiMsgs, maxTokens);
  } catch (err) {
    const isGroqQuota = provider === 'groq' && (err?.status === 429 || err?.status === 413);

    if (isGroqQuota) {
      logger.warn(`Groq ${err.status} (chat stream), fallback cascade`);
      if (gemini) {
        try { yield* streamGemini('gemini-2.5-flash', oaiMsgs, maxTokens); return; }
        catch (e) { logger.warn(`Gemini chat-stream fallback failed (${e.message}), trying Mistral`); }
      }
      if (mistral) {
        try { yield* streamMistral('mistral-small-latest', oaiMsgs, maxTokens); return; }
        catch (e) { logger.warn(`Mistral chat-stream fallback failed (${e.message})`); }
      }
      throw new Error('Tous les providers IA sont indisponibles. Réessayez dans quelques minutes.');
    }

    // Autre provider échoue → Groq
    if (provider !== 'groq' && groqClients.length) {
      logger.warn(`Provider ${provider} failed (chat stream, ${err.message}), fallback → Groq`);
      yield* streamGroq('llama-3.3-70b-versatile', oaiMsgs, maxTokens);
      return;
    }
    throw err;
  }
}

function calcMaxTokens(type, textLen, count = 0) {
  if (type === 'summary') {
    if (textLen < 5000)  return 1200;
    if (textLen < 15000) return 2000;
    if (textLen < 40000) return 3000;
    return 3500;
  }
  if (type === 'quiz')  return Math.min(count * 2000 + 1000, 8000);
  if (type === 'flash') return Math.min(count * 250 + 500, 4000);
  return 2048;
}

module.exports = {
  IS_PROD, MODEL_LABEL, deepseek, mistral,
  DEEPSEEK_MODEL: 'deepseek-chat',
  aiComplete, aiCompleteFast, aiStream, aiChat, aiChatStream, calcMaxTokens,
};

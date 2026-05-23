require('dotenv').config();
const { OpenAI } = require('openai');
const logger = require('./logger');

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Multi-key Groq rotation ───────────────────────────────────────────────────
// Supports GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, …
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const groqClients = ['GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3']
  .map(k => process.env[k])
  .filter(Boolean)
  .map(apiKey => new OpenAI({ apiKey, baseURL: GROQ_BASE }));

// Round-robin index (resets per serverless instance — good enough)
let _groqIdx = 0;
function nextGroq() {
  if (!groqClients.length) return null;
  const client = groqClients[_groqIdx % groqClients.length];
  _groqIdx++;
  return client;
}

// Try all Groq clients in order; skip to next on 429/rate-limit
async function groqComplete(params) {
  let lastErr;
  for (let i = 0; i < groqClients.length; i++) {
    const client = groqClients[(_groqIdx + i) % groqClients.length];
    try {
      return await client.chat.completions.create(params);
    } catch (err) {
      lastErr = err;
      if (err?.status === 429) {
        logger.warn(`Groq key ${(_groqIdx + i) % groqClients.length} rate-limited, trying next`);
        continue;
      }
      throw err; // non-429 errors bubble up immediately
    }
  }
  throw lastErr; // all keys exhausted
}

async function groqStream(params) {
  let lastErr;
  for (let i = 0; i < groqClients.length; i++) {
    const client = groqClients[(_groqIdx + i) % groqClients.length];
    try {
      return await client.chat.completions.create({ ...params, stream: true });
    } catch (err) {
      lastErr = err;
      if (err?.status === 429) {
        logger.warn(`Groq key ${(_groqIdx + i) % groqClients.length} rate-limited (stream), trying next`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

const groq = groqClients.length > 0 ? groqClients[0] : null; // kept for legacy checks

const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1' })
  : null;

const GROQ_MODEL      = 'llama-3.3-70b-versatile';
const GROQ_FAST_MODEL = 'llama-3.1-8b-instant';
const DEEPSEEK_MODEL  = 'deepseek-chat';

const MODEL_LABEL = groqClients.length ? `Groq · Llama 3.3 (${groqClients.length} clé${groqClients.length > 1 ? 's' : ''})` : 'DeepSeek · Chat';

function usage(r, provider) {
  return { provider, input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 };
}

async function primary(messages, maxTokens) {
  if (groqClients.length) {
    try {
      const r = await groqComplete({ model: GROQ_MODEL, max_tokens: maxTokens, messages });
      return { text: r.choices[0].message.content, model: 'Groq · Llama 3.3', usage: usage(r, 'Groq') };
    } catch (err) {
      logger.warn('Groq fallback (complete)', { status: err?.status, message: err?.message });
    }
  }
  if (!deepseek) throw new Error('Aucune clé IA configurée (GROQ_API_KEY ou DEEPSEEK_API_KEY requise)');
  const r = await deepseek.chat.completions.create({ model: DEEPSEEK_MODEL, max_tokens: maxTokens, messages });
  return { text: r.choices[0].message.content, model: 'DeepSeek · Chat', usage: usage(r, 'DeepSeek') };
}

async function aiComplete(prompt, maxTokens = 3000, cachedContent = null) {
  const fullPrompt = cachedContent ? `${cachedContent}\n\n${prompt}` : prompt;
  return primary([{ role: 'user', content: fullPrompt }], maxTokens);
}

// Modèle rapide pour tâches simples (génération de topics sans fichier)
async function aiCompleteFast(prompt, maxTokens = 2000) {
  if (groqClients.length) {
    try {
      const r = await groqComplete({ model: GROQ_FAST_MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
      return { text: r.choices[0].message.content, model: 'Groq · Llama 3.1-8b', usage: usage(r, 'Groq') };
    } catch (err) {
      logger.warn('Groq fast fallback to primary', { message: err?.message });
    }
  }
  return primary([{ role: 'user', content: prompt }], maxTokens);
}

// Yields { text, model } pour le contenu, puis { usage } en dernier chunk
async function* aiStream(prompt, maxTokens = 4096, cachedContent = null) {
  const fullPrompt = cachedContent ? `${cachedContent}\n\n${prompt}` : prompt;
  const msgs = [{ role: 'user', content: fullPrompt }];
  const streamOpts = { stream_options: { include_usage: true } };

  if (groqClients.length) {
    try {
      const stream = await groqStream({ model: GROQ_MODEL, max_tokens: maxTokens, ...streamOpts, messages: msgs });
      for await (const chunk of stream) {
        if (chunk.usage) { yield { usage: { provider: 'Groq', input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens } }; continue; }
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) yield { text, model: 'Groq · Llama 3.3' };
      }
      return;
    } catch (err) {
      logger.warn('Groq fallback (stream)', { status: err?.status, message: err?.message });
    }
  }

  if (!deepseek) throw new Error('Aucune clé IA configurée');
  const stream = await deepseek.chat.completions.create({ model: DEEPSEEK_MODEL, max_tokens: maxTokens, stream: true, ...streamOpts, messages: msgs });
  for await (const chunk of stream) {
    if (chunk.usage) { yield { usage: { provider: 'DeepSeek', input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens } }; continue; }
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) yield { text, model: 'DeepSeek · Chat' };
  }
}

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

async function aiChat(systemPrompt, messages, maxTokens = 1024, hasImage = false) {
  const oaiMessages = toOpenAIMessages(messages);
  const allMsgs = [{ role: 'system', content: systemPrompt }, ...oaiMessages];

  if (!hasImage && groqClients.length) {
    try {
      const r = await groqComplete({ model: GROQ_MODEL, max_tokens: maxTokens, messages: allMsgs });
      return { text: r.choices[0].message.content, model: 'Groq · Llama 3.3', usage: usage(r, 'Groq') };
    } catch (err) {
      logger.warn('Groq fallback (chat)', { status: err?.status, message: err?.message });
    }
  }

  if (!deepseek) throw new Error('Aucune clé IA configurée');
  const r = await deepseek.chat.completions.create({ model: DEEPSEEK_MODEL, max_tokens: maxTokens, messages: allMsgs });
  return { text: r.choices[0].message.content, model: 'DeepSeek · Chat', usage: usage(r, 'DeepSeek') };
}

// Streaming version of aiChat — yields { text, model } then { usage }
async function* aiChatStream(systemPrompt, messages, maxTokens = 1024, hasImage = false) {
  const oaiMessages = toOpenAIMessages(messages);
  const allMsgs    = [{ role: 'system', content: systemPrompt }, ...oaiMessages];
  const streamOpts  = { stream_options: { include_usage: true } };

  if (!hasImage && groqClients.length) {
    try {
      const stream = await groqStream({ model: GROQ_MODEL, max_tokens: maxTokens, ...streamOpts, messages: allMsgs });
      for await (const chunk of stream) {
        if (chunk.usage) { yield { usage: { provider: 'Groq', input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens } }; continue; }
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) yield { text, model: 'Groq · Llama 3.3' };
      }
      return;
    } catch (err) {
      logger.warn('Groq fallback (chat stream)', { status: err?.status, message: err?.message });
    }
  }

  if (!deepseek) throw new Error('Aucune clé IA configurée');
  const stream = await deepseek.chat.completions.create({ model: DEEPSEEK_MODEL, max_tokens: maxTokens, stream: true, ...streamOpts, messages: allMsgs });
  for await (const chunk of stream) {
    if (chunk.usage) { yield { usage: { provider: 'DeepSeek', input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens } }; continue; }
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) yield { text, model: 'DeepSeek · Chat' };
  }
}

function calcMaxTokens(type, textLen, count = 0) {
  if (type === 'summary') {
    if (textLen < 5000)  return 1200;
    if (textLen < 15000) return 2000;
    if (textLen < 40000) return 3000;
    return 3500;
  }
  if (type === 'quiz')  return Math.min(count * 350 + 400, 5000); // whyWrong adds ~150 tok/question
  if (type === 'flash') return Math.min(count * 100 + 300, 2200);
  return 2048;
}

module.exports = { IS_PROD, MODEL_LABEL, deepseek, DEEPSEEK_MODEL, aiComplete, aiCompleteFast, aiStream, aiChat, aiChatStream, calcMaxTokens };

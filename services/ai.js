require('dotenv').config();
const { OpenAI } = require('openai');
const logger = require('./logger');

const IS_PROD = !!process.env.RAILWAY_ENVIRONMENT;

const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1' })
  : null;

const GROQ_MODEL     = 'llama-3.3-70b-versatile';
const DEEPSEEK_MODEL = 'deepseek-chat';

const MODEL_LABEL = groq ? 'Groq · Llama 3.3' : 'DeepSeek · Chat';

function usage(r, provider) {
  return { provider, input: r.usage?.prompt_tokens || 0, output: r.usage?.completion_tokens || 0 };
}

async function primary(messages, maxTokens) {
  if (groq) {
    try {
      const r = await groq.chat.completions.create({ model: GROQ_MODEL, max_tokens: maxTokens, messages });
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

// Yields { text, model } pour le contenu, puis { usage } en dernier chunk
async function* aiStream(prompt, maxTokens = 4096, cachedContent = null) {
  const fullPrompt = cachedContent ? `${cachedContent}\n\n${prompt}` : prompt;
  const msgs = [{ role: 'user', content: fullPrompt }];
  const streamOpts = { stream_options: { include_usage: true } };

  if (groq) {
    try {
      const stream = await groq.chat.completions.create({ model: GROQ_MODEL, max_tokens: maxTokens, stream: true, ...streamOpts, messages: msgs });
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

  if (!hasImage && groq) {
    try {
      const r = await groq.chat.completions.create({ model: GROQ_MODEL, max_tokens: maxTokens, messages: allMsgs });
      return { text: r.choices[0].message.content, model: 'Groq · Llama 3.3', usage: usage(r, 'Groq') };
    } catch (err) {
      logger.warn('Groq fallback (chat)', { status: err?.status, message: err?.message });
    }
  }

  if (!deepseek) throw new Error('Aucune clé IA configurée');
  const r = await deepseek.chat.completions.create({ model: DEEPSEEK_MODEL, max_tokens: maxTokens, messages: allMsgs });
  return { text: r.choices[0].message.content, model: 'DeepSeek · Chat', usage: usage(r, 'DeepSeek') };
}

function calcMaxTokens(type, textLen, count = 0) {
  if (type === 'summary') {
    if (textLen < 5000)  return 1200;
    if (textLen < 15000) return 2000;
    if (textLen < 40000) return 3000;
    return 3500;
  }
  if (type === 'quiz')  return Math.min(count * 200 + 400, 3200);
  if (type === 'flash') return Math.min(count * 100 + 300, 2200);
  return 2048;
}

module.exports = { IS_PROD, MODEL_LABEL, deepseek, DEEPSEEK_MODEL, aiComplete, aiStream, aiChat, calcMaxTokens };

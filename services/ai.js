require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');

const IS_PROD = !!process.env.RAILWAY_ENVIRONMENT;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
});

const groq = IS_PROD && process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

const GROQ_MODEL  = 'llama-3.3-70b-versatile';
const CHAT_MODEL  = 'claude-haiku-4-5-20251001';
const MODEL_LABEL = groq ? 'Groq · Llama 3.3' : 'Claude Sonnet 4.6';

// cachedContent : mis en cache côté Claude (cache_control ephemeral).
// Pour Groq, le contenu est simplement concaténé au prompt (pas de support natif).
async function claudeComplete(prompt, maxTokens, cachedContent = null) {
  const content = cachedContent
    ? [
        { type: 'text', text: cachedContent, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: prompt }
      ]
    : prompt;
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6', max_tokens: maxTokens,
    messages: [{ role: 'user', content }]
  });
  const msg = await stream.finalMessage();
  return msg.content[0].text;
}

async function aiComplete(prompt, maxTokens = 3000, cachedContent = null) {
  if (groq) {
    try {
      const fullPrompt = cachedContent ? `${cachedContent}\n\n${prompt}` : prompt;
      const r = await groq.chat.completions.create({
        model: GROQ_MODEL, max_tokens: maxTokens,
        messages: [{ role: 'user', content: fullPrompt }]
      });
      return { text: r.choices[0].message.content, model: MODEL_LABEL };
    } catch (err) {
      console.warn('[Groq] erreur', err?.status ?? err?.message, '→ fallback Claude');
      const text = await claudeComplete(prompt, maxTokens, cachedContent);
      return { text, model: 'Claude Sonnet 4.6' };
    }
  }
  const text = await claudeComplete(prompt, maxTokens, cachedContent);
  return { text, model: 'Claude Sonnet 4.6' };
}

async function* aiStream(prompt, maxTokens = 4096, cachedContent = null) {
  if (groq) {
    try {
      const fullPrompt = cachedContent ? `${cachedContent}\n\n${prompt}` : prompt;
      const stream = await groq.chat.completions.create({
        model: GROQ_MODEL, max_tokens: maxTokens, stream: true,
        messages: [{ role: 'user', content: fullPrompt }]
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) yield { text, model: MODEL_LABEL };
      }
      return;
    } catch (err) {
      console.warn('[Groq] erreur stream', err?.status ?? err?.message, '→ fallback Claude');
    }
  }
  const content = cachedContent
    ? [
        { type: 'text', text: cachedContent, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: prompt }
      ]
    : prompt;
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6', max_tokens: maxTokens,
    messages: [{ role: 'user', content }]
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
      yield { text: event.delta.text, model: 'Claude Sonnet 4.6' };
  }
}

async function aiChat(systemPrompt, messages, maxTokens = 1024, hasImage = false) {
  if (!hasImage && groq) {
    try {
      const r = await groq.chat.completions.create({
        model: GROQ_MODEL, max_tokens: maxTokens,
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      });
      return { text: r.choices[0].message.content, model: MODEL_LABEL };
    } catch (err) {
      console.warn('[Groq] erreur chat', err?.status ?? err?.message, '→ fallback Claude');
    }
  }
  const msg = await anthropic.messages.create({
    model: CHAT_MODEL, max_tokens: maxTokens,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages
  });
  return { text: msg.content[0].text, model: 'Claude Haiku 4.5' };
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

module.exports = { IS_PROD, MODEL_LABEL, anthropic, claudeComplete, aiComplete, aiStream, aiChat, calcMaxTokens };

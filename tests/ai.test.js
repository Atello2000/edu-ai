/**
 * tests/ai.test.js
 * Cascade de fallback multi-provider de services/ai.js :
 * quota → cascade dédiée, anti-duplication en streaming.
 */
process.env.SESSION_SECRET   = 'test-session-secret-min32chars!!';
process.env.NODE_ENV         = 'test';
process.env.GROQ_API_KEY     = 'groq-key-test';
process.env.GEMINI_API_KEY   = 'gemini-key-test';
process.env.MISTRAL_API_KEY  = 'mistral-key-test';
delete process.env.GITHUB_TOKEN;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GROQ_API_KEY_1;
delete process.env.GROQ_API_KEY_2;
delete process.env.GROQ_API_KEY_3;

// Handlers par baseURL, pilotés depuis chaque test
const mockHandlers = {};
function setHandler(baseURLPart, fn) {
  mockHandlers[baseURLPart] = fn;
}
function mockDispatch(baseURL, params) {
  const key = Object.keys(mockHandlers).find(k => (baseURL || '').includes(k));
  if (!key) throw new Error(`No mock handler for ${baseURL}`);
  return mockHandlers[key](params);
}

jest.mock('openai', () => ({
  OpenAI: class {
    constructor({ baseURL }) {
      this.chat = { completions: { create: (params) => mockDispatch(baseURL, params) } };
    }
  },
}));
jest.mock('@anthropic-ai/sdk', () => class Anthropic {});
jest.mock('../db', () => ({ prepare: () => ({ get: async () => null, run: async () => ({}) }) }));
jest.mock('../services/aiConfig', () => ({ getAiConfig: async () => ({ provider: 'groq', model: 'llama-3.3-70b-versatile' }) }));

const { aiComplete, aiStream } = require('../services/ai');

function ok(text, provider = 'mock') {
  return {
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  };
}
function quotaError(status) {
  const err = new Error(`HTTP ${status}`);
  err.status = status;
  return err;
}
async function* streamOf(...texts) {
  for (const t of texts) yield { choices: [{ delta: { content: t } }] };
  yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } };
}
async function collect(gen) {
  const out = { text: '', labels: new Set(), usage: null };
  for await (const c of gen) {
    if (c.text) { out.text += c.text; out.labels.add(c.model); }
    if (c.usage) out.usage = c.usage;
  }
  return out;
}

const GROQ_CFG = { provider: 'groq', model: 'llama-3.3-70b-versatile' };

beforeEach(() => {
  for (const k of Object.keys(mockHandlers)) delete mockHandlers[k];
});

test('aiComplete : provider primaire OK, pas de fallback', async () => {
  setHandler('groq.com', () => ok('réponse groq'));
  const r = await aiComplete('test', 100, GROQ_CFG);
  expect(r.text).toBe('réponse groq');
  expect(r.model).toBe('Groq · Llama 3.3');
  expect(r.usage.provider).toBe('Groq');
});

test('aiComplete : Groq 429 → fallback Gemini', async () => {
  setHandler('groq.com', () => { throw quotaError(429); });
  setHandler('generativelanguage', () => ok('réponse gemini'));
  const r = await aiComplete('test', 100, GROQ_CFG);
  expect(r.text).toBe('réponse gemini');
  expect(r.usage.provider).toBe('Gemini');
});

test('aiComplete : Groq 413 + Gemini KO → Mistral (GitHub non configuré)', async () => {
  setHandler('groq.com', () => { throw quotaError(413); });
  setHandler('generativelanguage', () => { throw new Error('boom'); });
  setHandler('mistral.ai', () => ok('réponse mistral'));
  const r = await aiComplete('test', 100, GROQ_CFG);
  expect(r.text).toBe('réponse mistral');
  expect(r.usage.provider).toBe('Mistral');
});

test('aiComplete : tous les providers en quota → message générique', async () => {
  setHandler('groq.com', () => { throw quotaError(429); });
  setHandler('generativelanguage', () => { throw new Error('down'); });
  setHandler('mistral.ai', () => { throw new Error('down'); });
  await expect(aiComplete('test', 100, GROQ_CFG))
    .rejects.toThrow('Tous les providers IA sont indisponibles');
});

test('aiStream : échec avant le premier chunk → fallback transparent', async () => {
  setHandler('groq.com', () => { throw quotaError(429); });
  setHandler('generativelanguage', () => streamOf('par', 'tie'));
  const r = await collect(aiStream('test', 100, GROQ_CFG));
  expect(r.text).toBe('partie');
  expect(r.usage.provider).toBe('Gemini');
});

test('aiStream : erreur APRÈS du texte envoyé → pas de fallback (anti-duplication)', async () => {
  async function* failsMidStream() {
    yield { choices: [{ delta: { content: 'début' } }] };
    throw quotaError(429);
  }
  setHandler('groq.com', () => failsMidStream());
  setHandler('generativelanguage', () => streamOf('NE DOIT PAS APPARAÎTRE'));

  let received = '';
  await expect((async () => {
    for await (const c of aiStream('test', 100, GROQ_CFG)) {
      if (c.text) received += c.text;
    }
  })()).rejects.toThrow();
  expect(received).toBe('début');
});

test('aiComplete : erreur non-quota sur Mistral → cascade par défaut vers Groq', async () => {
  setHandler('mistral.ai', () => { throw new Error('réseau'); });
  setHandler('groq.com', () => ok('secours groq'));
  const r = await aiComplete('test', 100, { provider: 'mistral', model: 'mistral-small-latest' });
  expect(r.text).toBe('secours groq');
  expect(r.usage.provider).toBe('Groq');
});

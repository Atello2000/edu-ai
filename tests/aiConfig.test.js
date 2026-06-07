const { getAiConfigForAction } = require('../services/aiConfig');

// Provider keys can be loaded by dotenv. Clear them so routing tests stay
// deterministic, then restore them after each test.
const PROVIDER_KEYS = [
  'GROQ_API_KEY',
  'GROQ_API_KEY_1',
  'GROQ_API_KEY_2',
  'GROQ_API_KEY_3',
  'MISTRAL_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GITHUB_TOKEN',
];

let saved = {};

beforeEach(() => {
  saved = {};
  for (const key of PROVIDER_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of PROVIDER_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('getAiConfigForAction - cheap actions', () => {
  it('routes to Gemini when GOOGLE_API_KEY is present', async () => {
    process.env.GOOGLE_API_KEY = 'x';
    const cfg = await getAiConfigForAction('quiz');
    expect(cfg.provider).toBe('gemini');
    expect(cfg.model).toBe('gemini-2.5-flash');
  });

  it('routes to Gemini when GEMINI_API_KEY is present', async () => {
    process.env.GEMINI_API_KEY = 'x';
    const cfg = await getAiConfigForAction('quiz');
    expect(cfg.provider).toBe('gemini');
    expect(cfg.model).toBe('gemini-2.5-flash');
  });

  it('routes to Groq when Groq is present and Gemini is absent', async () => {
    process.env.GROQ_API_KEY = 'x';
    const cfg = await getAiConfigForAction('quiz');
    expect(cfg.provider).toBe('groq');
    expect(cfg.model).toBe('llama-3.3-70b-versatile');
  });

  it('routes to GitHub when GITHUB_TOKEN is present and Gemini/Groq are absent', async () => {
    process.env.GITHUB_TOKEN = 'x';
    const cfg = await getAiConfigForAction('quiz');
    expect(cfg.provider).toBe('github');
    expect(cfg.model).toBe('gpt-4o-mini');
  });

  it('falls back to Mistral when only MISTRAL_API_KEY is present', async () => {
    process.env.MISTRAL_API_KEY = 'x';
    const cfg = await getAiConfigForAction('flashcards');
    expect(cfg.provider).toBe('mistral');
    expect(cfg.model).toBe('mistral-small-latest');
  });

  it('throws an explicit error when no cheap provider is configured', async () => {
    await expect(getAiConfigForAction('chat')).rejects.toThrow(/indisponible/i);
  });

  it.each(['socratic', 'predict', 'study-plan', 'error-analysis'])(
    'classifies %s as cheap',
    async action => {
      process.env.GROQ_API_KEY = 'x';
      const cfg = await getAiConfigForAction(action);
      expect(cfg.provider).toBe('groq');
    }
  );

  it('never uses Claude automatically for a cheap action', async () => {
    process.env.ANTHROPIC_API_KEY = 'x';
    await expect(getAiConfigForAction('quiz')).rejects.toThrow(/indisponible/i);
  });
});

describe('getAiConfigForAction - structured actions', () => {
  it.each(['summarize', 'exam-sheet', 'compare'])(
    'routes %s to Gemini when available',
    async action => {
      process.env.GOOGLE_API_KEY = 'x';
      const cfg = await getAiConfigForAction(action);
      expect(cfg.provider).toBe('gemini');
      expect(cfg.model).toBe('gemini-2.5-flash');
    }
  );
});

const { getAiConfigForAction } = require('../services/aiConfig');

// Clés provider susceptibles d'avoir été chargées via dotenv → on les neutralise
// pour rendre le routing déterministe, puis on restaure après chaque test.
const PROVIDER_KEYS = [
  'GROQ_API_KEY', 'GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3',
  'MISTRAL_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY',
];

let saved = {};

beforeEach(() => {
  saved = {};
  for (const k of PROVIDER_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});

afterEach(() => {
  for (const k of PROVIDER_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ── Actions économiques (CHEAP) ──────────────────────────────────────────────────
describe('getAiConfigForAction — actions cheap', () => {
  it('route vers Groq en priorité quand GROQ_API_KEY est présent', async () => {
    process.env.GROQ_API_KEY = 'x';
    const cfg = await getAiConfigForAction('quiz');
    expect(cfg.provider).toBe('groq');
    expect(cfg.model).toBe('llama-3.3-70b-versatile');
  });

  it('retombe sur Mistral quand seul MISTRAL_API_KEY est présent', async () => {
    process.env.MISTRAL_API_KEY = 'x';
    const cfg = await getAiConfigForAction('flashcards');
    expect(cfg.provider).toBe('mistral');
    expect(cfg.model).toBe('mistral-small-latest');
  });

  it('jette une erreur explicite si aucun provider cheap n\'est configuré', async () => {
    await expect(getAiConfigForAction('chat')).rejects.toThrow(/indisponible/i);
  });

  it.each(['socratic', 'predict', 'study-plan', 'error-analysis'])(
    'classe %s comme cheap (Groq)', async (action) => {
      process.env.GROQ_API_KEY = 'x';
      const cfg = await getAiConfigForAction(action);
      expect(cfg.provider).toBe('groq');
    });

  it('n\'utilise JAMAIS Claude automatiquement pour une action cheap', async () => {
    process.env.ANTHROPIC_API_KEY = 'x'; // seul Claude dispo
    await expect(getAiConfigForAction('quiz')).rejects.toThrow(/indisponible/i);
  });
});

// ── Actions structurées (STRUCTURED) ─────────────────────────────────────────────
describe('getAiConfigForAction — actions structurées', () => {
  it.each(['summarize', 'exam-sheet', 'compare'])(
    'route %s vers Groq 70B quand disponible', async (action) => {
      process.env.GROQ_API_KEY = 'x';
      const cfg = await getAiConfigForAction(action);
      expect(cfg.provider).toBe('groq');
      expect(cfg.model).toBe('llama-3.3-70b-versatile');
    });
});

process.env.NODE_ENV = 'test';
const request = require('supertest');
const express = require('express');
let mockActive = 0, mockPeak = 0, mockFail = false;
jest.mock('../services/ai', () => ({
  MODEL_LABEL: 'test', calcMaxTokens: () => 100,
  aiComplete: jest.fn(async () => {
    mockActive++; mockPeak = Math.max(mockPeak, mockActive);
    try { await new Promise(resolve => setTimeout(resolve, 5)); if (mockFail) { const err = new Error('internal secret'); err.status = 429; throw err; } return { text: 'notes' }; }
    finally { mockActive--; }
  }),
  aiStream: async function* () { yield { text: 'objectifs structure points resume concepts liens retenir', model: 'test' }; },
}));
jest.mock('../services/aiConfig', () => ({ getAiConfigForAction: async () => ({ provider: 'groq' }) }));
jest.mock('../services/summaryCache', () => ({ summarizeCacheKey: text => text, getCached: async () => null, setCache: async () => {} }));
jest.mock('../services/tokens', () => ({ logTokens: () => {} }));
jest.mock('../services/jetons', () => ({ JETON_COSTS: { summarize: 3 }, checkAndDeduct: async () => ({ ok: true, cost: 10 }), refundJetons: jest.fn(async () => {}) }));
jest.mock('../services/chunker', () => ({ splitIntoChunks: text => text.split('|'), chunkSizeFor: () => 10, chunkCost: () => 5 }));
const app = express(); app.use(express.json()); app.use((req, res, next) => { req.user = { id: 1 }; next(); });
app.use(require('../routes/ai/summarize'));
beforeEach(() => { mockActive = 0; mockPeak = 0; mockFail = false; jest.clearAllMocks(); });
test('large files share one analysis slot and both complete', async () => {
  const result = await request(app).post('/summarize').send({ files: [{ name: 'one.pptx', text: 'a|b|c|d' }, { name: 'two.pdf', text: 'e|f' }] });
  expect(result.status).toBe(200); expect(mockPeak).toBe(1);
  expect(result.text.match(/"type":"done"/g)).toHaveLength(2);
  expect(result.text).toContain('"type":"end"');
});
test('provider failure stops further calls and refunds the deduction once', async () => {
  mockFail = true;
  const result = await request(app).post('/summarize').send({ files: [{ name: 'one.pptx', text: 'a|b|c|d' }, { name: 'two.pdf', text: 'e|f' }] });
  expect(result.text).toContain('temporairement saturé');
  expect(result.text).not.toContain('internal secret');
  expect(require('../services/ai').aiComplete).toHaveBeenCalledTimes(1);
  expect(require('../services/jetons').refundJetons).toHaveBeenCalledTimes(1);
  expect(require('../services/jetons').refundJetons).toHaveBeenCalledWith(1, 'summarize', 10);
});

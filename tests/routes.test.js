const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

// Désactive le vrai serveur listen pendant les tests
process.env.PORT = '0';

// ── Mocks middleware (hissés avant tout require par Jest) ─────────────────────
// Les tests vérifient la logique métier (validation fichier, path traversal…)
// — pas la protection auth/CSRF, qui est couverte séparément.
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 999, email: 'test@example.com', name: 'Test', plan: 'free', jetons: 50 };
    next();
  },
  JWT_SECRET: 'test-secret',
}));

jest.mock('../middleware/csrf', () => ({
  doubleCsrfProtection:    (req, res, next) => next(),
  generateAndSetCsrfToken: ()               => 'mock-csrf-token',
}));

let app;

beforeAll(() => {
  // Charge l'app sans démarrer le serveur (on exporte app séparément)
  app = require('../app');
});

// ── /api/upload ───────────────────────────────────────────────────────────────
describe('POST /api/upload', () => {
  it('rejette une requête sans fichier', async () => {
    const res = await request(app).post('/api/upload');
    expect(res.status).toBe(400);
  });

  it('rejette un type de fichier non autorisé', async () => {
    const tmp = path.join(__dirname, 'fixture.txt');
    fs.writeFileSync(tmp, 'test');
    const res = await request(app)
      .post('/api/upload')
      .attach('files', tmp);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PDF|PPT|DOCX/i);
    fs.unlinkSync(tmp);
  });

  it('rejette un PDF sans texte lisible', async () => {
    // Minimal PDF valide syntaxiquement, mais vide.
    const minPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
      '3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
      '0000000058 00000 n\n0000000115 00000 n\n' +
      'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
    );
    const tmp = path.join(__dirname, 'fixture.pdf');
    fs.writeFileSync(tmp, minPdf);
    const res = await request(app)
      .post('/api/upload')
      .attach('files', tmp);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/extraire le texte/i);
    // Nettoyage
    fs.unlinkSync(tmp);
  }, 20000); // pdf-parse cold-start peut dépasser 5 s
});

// ── /api/ping ─────────────────────────────────────────────────────────────────
describe('POST /api/ping', () => {
  it('retourne le nombre d\'utilisateurs en ligne', async () => {
    const res = await request(app)
      .post('/api/ping')
      .send({ clientId: 'test-client-1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('online');
    expect(typeof res.body.online).toBe('number');
  });
});

// ── /api/users/count ──────────────────────────────────────────────────────────
describe('GET /api/users/count', () => {
  it('retourne un compteur numérique', async () => {
    const res = await request(app).get('/api/users/count');
    expect(res.status).toBe(200);
    expect(typeof res.body.online).toBe('number');
  });
});

// ── Sécurité : path traversal ─────────────────────────────────────────────────
describe('Sécurité path traversal', () => {
  it('refuse un chemin hors uploads/', async () => {
    const res = await request(app)
      .post('/api/summarize')
      .send({ files: [{ path: '../../.env', name: 'hack.pdf' }] });
    // SSE → on lit le premier event
    const body = res.text;
    expect(body).toMatch(/non autorisé|error/i);
  });
});

// ── /api/mindmap/extend ───────────────────────────────────────────────────────
describe('POST /api/mindmap/extend', () => {
  it('rejette une requête sans fichier', async () => {
    const res = await request(app)
      .post('/api/mindmap/extend')
      .send({ nodeText: 'Concept' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fichier manquant/i);
  });

  it('rejette une requête sans concept à approfondir', async () => {
    const res = await request(app)
      .post('/api/mindmap/extend')
      .send({ file: { path: 'uploads/test.pdf', name: 'test.pdf' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/concept à approfondir manquant/i);
  });
});

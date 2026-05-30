const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

// Désactive le vrai serveur listen pendant les tests
process.env.PORT = '0';

// Mock the text extraction service
const textService = require('../services/text');
jest.mock('../services/text', () => {
  const originalModule = jest.requireActual('../services/text');
  return {
    ...originalModule,
    extractTextFromBuffer: jest.fn(),
  };
});

let app;

beforeAll(() => {
  app = require('../app');
});

describe('Troncation de fichier volumineux', () => {
  it('signale correctement un fichier comme tronqué si son texte dépasse MAX_TEXT_UPLOAD', async () => {
    // Renvoyer un texte très long (220 000 caractères)
    const longText = 'A'.repeat(220000);
    textService.extractTextFromBuffer.mockResolvedValue(longText);

    // Fichier PDF minimal fictif
    const minPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
      '3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
      '0000000058 00000 n\n0000000115 00000 n\n' +
      'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
    );

    const tmp = path.join(__dirname, 'fixture_trunc.pdf');
    fs.writeFileSync(tmp, minPdf);

    const res = await request(app)
      .post('/api/upload')
      .attach('files', tmp);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.files[0]).toHaveProperty('id');
    expect(res.body.files[0].truncated).toBe(true);
    expect(res.body.files[0].text.length).toBe(200000);
    expect(res.body.files[0].originalLength).toBe(220000);

    // Nettoyage
    fs.unlinkSync(tmp);
    const uploaded = path.join(__dirname, '..', 'uploads', res.body.files[0].id);
    if (fs.existsSync(uploaded)) fs.unlinkSync(uploaded);
  });

  it('ne tronque pas les fichiers dont la taille de texte est inférieure à MAX_TEXT_UPLOAD', async () => {
    const normalText = 'A'.repeat(150000);
    textService.extractTextFromBuffer.mockResolvedValue(normalText);

    const minPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
      '3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
      '0000000058 00000 n\n0000000115 00000 n\n' +
      'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
    );

    const tmp = path.join(__dirname, 'fixture_norm.pdf');
    fs.writeFileSync(tmp, minPdf);

    const res = await request(app)
      .post('/api/upload')
      .attach('files', tmp);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.files[0].truncated).toBe(false);
    expect(res.body.files[0].text.length).toBe(150000);

    fs.unlinkSync(tmp);
    const uploaded = path.join(__dirname, '..', 'uploads', res.body.files[0].id);
    if (fs.existsSync(uploaded)) fs.unlinkSync(uploaded);
  });
});

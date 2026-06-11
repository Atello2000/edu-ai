/**
 * tests/integration.pg.test.js — tests d'intégration contre un VRAI PostgreSQL.
 *
 * Ne tourne que si TEST_DATABASE_URL est défini (CI GitHub Actions : service
 * postgres éphémère). Skippé en local pour ne jamais toucher la base Neon de
 * production pointée par .env.
 *
 * Raison d'être : les mocks DB des autres suites ont laissé passer un bug réel
 * (RETURNING id sur des tables sans colonne id → login prod cassé, cf. f9b7a88).
 * Ici on exerce les vrais INSERT : register/login, rotation des refresh tokens,
 * détection de réutilisation, partage public.
 */
const TEST_DB = (process.env.TEST_DATABASE_URL || '').trim();
const maybeDescribe = TEST_DB ? describe : describe.skip;

if (TEST_DB) {
  process.env.DATABASE_URL  = TEST_DB;
  process.env.NODE_ENV      = 'test';
  process.env.SESSION_SECRET ||= 'integration-session-secret-32chars!';
  delete process.env.PAYMENTS_LOCKED;
}

jest.setTimeout(30000);

// Extrait les cookies d'une réponse supertest sous forme { nom: valeur }
function cookiesOf(res) {
  const out = {};
  for (const c of res.headers['set-cookie'] || []) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    out[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  return out;
}
function cookieHeader(jar) {
  return Object.entries(jar).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ');
}

maybeDescribe('Intégration PostgreSQL (flux réels, sans mock DB)', () => {
  let request, app, db;
  const email = `inttest-${Date.now()}@gmail.com`;
  const password = 'integration-pass-123';
  const jar = {}; // cookie jar simplifié
  let userId, csrfToken, shareToken;

  beforeAll(async () => {
    request = require('supertest');
    db  = require('../db');
    await db.initSchema();
    app = require('../app');
  });

  afterAll(async () => {
    // Nettoyage : l'utilisateur de test et ses données (CASCADE)
    if (userId) await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    await db.pool.end();
  });

  function absorb(res) {
    Object.assign(jar, cookiesOf(res));
  }

  it('register : crée le compte ET la ligne refresh_tokens (INSERT réel)', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email, password, name: 'Integration Test' });
    expect(res.status).toBe(200);
    absorb(res);
    expect(jar['jangalai.token']).toBeTruthy();
    expect(jar['jangalai.refresh']).toBeTruthy();

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    expect(user).toBeTruthy();
    userId = user.id;

    const rt = await db.prepare('SELECT COUNT(*) AS n FROM refresh_tokens WHERE user_id = ?').get(userId);
    expect(Number(rt.n)).toBe(1);
  });

  it('login : fonctionne avec le mot de passe (2e INSERT refresh_tokens)', async () => {
    await db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    absorb(res);
  });

  it('refresh : sans access token, le refresh token est consommé et TOURNÉ', async () => {
    const oldRefresh = jar['jangalai.refresh'];
    delete jar['jangalai.token'];

    const res = await request(app).get('/api/auth/me')
      .set('Cookie', cookieHeader(jar));
    expect(res.status).toBe(200);
    const fresh = cookiesOf(res);
    expect(fresh['jangalai.token']).toBeTruthy();          // nouvel access token
    expect(fresh['jangalai.refresh']).toBeTruthy();        // rotation
    expect(fresh['jangalai.refresh']).not.toBe(oldRefresh);
    absorb(res);
    jar._oldRefresh = oldRefresh; // gardé pour le test de réutilisation
  });

  it('réutilisation hors fenêtre de grâce : 401 + révocation totale', async () => {
    // Simule le vol : le token déjà tourné est rejoué après la grâce de 60 s
    await db.prepare(
      "UPDATE refresh_tokens SET rotated_at = NOW() - INTERVAL '5 minutes' WHERE user_id = ? AND rotated_at IS NOT NULL"
    ).run(userId);

    const res = await request(app).get('/api/auth/me')
      .set('Cookie', `jangalai.refresh=${jar._oldRefresh}`);
    expect(res.status).toBe(401);

    const rt = await db.prepare('SELECT COUNT(*) AS n FROM refresh_tokens WHERE user_id = ?').get(userId);
    expect(Number(rt.n)).toBe(0); // toutes les sessions révoquées

    const u = await db.prepare('SELECT session_invalidated_at FROM users WHERE id = ?').get(userId);
    expect(u.session_invalidated_at).toBeTruthy();
  });

  it('re-login après révocation, puis récupération du token CSRF', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    for (const k of Object.keys(jar)) delete jar[k];
    absorb(res);

    const csrfRes = await request(app).get('/api/csrf-token')
      .set('Cookie', cookieHeader(jar));
    expect(csrfRes.status).toBe(200);
    csrfToken = csrfRes.body.csrfToken || csrfRes.body.token;
    expect(csrfToken).toBeTruthy();
    absorb(csrfRes);
  });

  it('POST /api/share : INSERT réel dans shared_content (table sans colonne id)', async () => {
    const res = await request(app).post('/api/share')
      .set('Cookie', cookieHeader(jar))
      .set('X-CSRF-Token', csrfToken)
      .send({ type: 'summary', title: 'Partage intégration', content: [{ name: 'doc.pdf', summary: '## Titre\nContenu.' }] });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    shareToken = res.body.token;
  });

  it('GET /api/share/:token : lecture PUBLIQUE sans aucun cookie', async () => {
    const res = await request(app).get(`/api/share/${shareToken}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Partage intégration');
    expect(res.body.content[0].summary).toContain('Contenu');
  });

  it('logout : supprime tous les refresh tokens de l\'utilisateur', async () => {
    const res = await request(app).post('/api/auth/logout')
      .set('Cookie', cookieHeader(jar))
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    const rt = await db.prepare('SELECT COUNT(*) AS n FROM refresh_tokens WHERE user_id = ?').get(userId);
    expect(Number(rt.n)).toBe(0);
  });
});

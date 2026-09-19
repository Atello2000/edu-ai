/**
 * tests/auth.test.js
 * Tests unitaires des routes d'authentification.
 */
process.env.PORT           = '0';
process.env.SESSION_SECRET = 'test-session-secret-min32chars!!';
process.env.NODE_ENV       = 'test';

// Mocks DB — isole les tests de PostgreSQL
jest.mock('../db', () => {
  const users = new Map();
  let nextId = 1;
  return {
    prepare: (sql) => ({
      async get(...params) {
        const lower = sql.toLowerCase();
        // SELECT par token de vérification
        if (lower.includes('where verify_token')) {
          const token = params[0];
          for (const u of users.values()) if (u.verify_token === token) return { ...u };
          return null;
        }
        // SELECT par email
        if (lower.includes('where email')) {
          const email = params[0];
          for (const u of users.values()) if (u.email === email) return { ...u };
          return null;
        }
        // SELECT par id
        if (lower.includes('where id')) {
          return users.get(Number(params[0])) ? { ...users.get(Number(params[0])) } : null;
        }
        return null;
      },
      async run(...params) {
        const lower = sql.toLowerCase();
        // INSERT users
        if (lower.includes('insert into users')) {
          const [email, password, name, verifyToken, verifyExpires] = params;
          const id = nextId++;
          users.set(id, { id, email, password, name: name || '', plan: 'free',
            email_verified: 0, verify_token: verifyToken, verify_expires: verifyExpires,
            jetons: 80, is_admin: false, session_invalidated_at: null });
          return { lastInsertRowid: id, rowCount: 1, changes: 1 };
        }
        // UPDATE email verification
        if (lower.includes('email_verified = 1')) {
          const id = params[params.length - 1];
          const u = users.get(Number(id));
          if (u) {
            u.email_verified = 1;
            u.verify_token = null;
            u.verify_expires = null;
          }
          return { rowCount: u ? 1 : 0, changes: u ? 1 : 0 };
        }
        // UPDATE session_invalidated_at
        if (lower.includes('session_invalidated_at')) {
          const id = params[params.length - 1];
          const u = users.get(Number(id));
          if (u) u.session_invalidated_at = new Date().toISOString();
          return { rowCount: 1, changes: 1 };
        }
        if (lower.includes('delete from users')) {
          const id = Number(params[0]);
          const existed = users.delete(id);
          return { rowCount: existed ? 1 : 0, changes: existed ? 1 : 0 };
        }
        return { rowCount: 0, changes: 0 };
      },
      async all() { return []; },
    }),
    pool: { query: async () => ({ rows: [], rowCount: 0 }) },
    exec: async () => {},
  };
});

jest.mock('../middleware/csrf', () => ({
  doubleCsrfProtection:    (req, res, next) => next(),
  generateAndSetCsrfToken: ()               => 'mock-csrf',
}));

// Désactive tout rate-limiting : la suite enchaîne plus de 5 inscriptions et
// dépasserait sinon le registerLimiter (5/h/IP), faussant les tests de session.
// Le module est utilisé en appel direct (app.js) ET en export nommé { rateLimit }
// (middleware/rateLimit.js) → le mock doit supporter les deux formes.
jest.mock('express-rate-limit', () => {
  const passthrough = () => (req, res, next) => next();
  passthrough.rateLimit = passthrough;
  return passthrough;
});

jest.mock('../services/email', () => ({
  sendVerifyEmail: jest.fn(async () => {}),
  sendResetEmail:  jest.fn(async () => {}),
}));

const request = require('supertest');
const emailService = require('../services/email');
let app;
beforeAll(() => { app = require('../app'); });

beforeEach(() => {
  emailService.sendVerifyEmail.mockClear();
  emailService.sendResetEmail.mockClear();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CALLBACK_URL;
});

// ── Register ──────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('rejette si email manquant', async () => {
    const r = await request(app).post('/api/auth/register').send({ password: 'password123' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/email/i);
  });

  it('rejette un mot de passe trop court', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ email: 'a@b.com', password: '123' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/court/i);
  });

  it('crée un compte avec des données valides', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'securepass123', name: 'Test' });
    expect(r.status).toBe(200);
    expect(r.body.user).toBeDefined();
    expect(r.body.user.email).toBe('new@example.com');
  });
});

describe('Email verification', () => {
  it('ne consomme pas le token en GET et vérifie seulement en POST', async () => {
    const agent = request.agent(app);
    const register = await agent.post('/api/auth/register')
      .send({ email: 'verify@example.com', password: 'securepass123', name: 'Verify' });
    expect(register.status).toBe(200);

    const token = emailService.sendVerifyEmail.mock.calls.at(-1)[1];
    const preview = await agent.get(`/api/auth/verify/${token}`);
    expect(preview.status).toBe(200);
    expect(preview.text).toMatch(/Confirmer mon email/);

    const before = await agent.get('/api/auth/me');
    expect(before.body.user.email_verified).toBe(0);

    const verified = await agent.post(`/api/auth/verify/${token}`);
    expect(verified.status).toBe(302);

    const after = await agent.get('/api/auth/me');
    expect(after.body.user.email_verified).toBe(1);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('rejette si email ou mot de passe manquant', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'x@x.com' });
    expect(r.status).toBe(400);
  });

  it('rejette un compte inexistant', async () => {
    const r = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'anything' });
    expect(r.status).toBe(401);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('répond 200 et efface les cookies', async () => {
    const r = await request(app).post('/api/auth/logout');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});

describe('GET /api/auth/google', () => {
  it('force le choix du compte Google', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id.test';
    process.env.GOOGLE_CALLBACK_URL = 'https://app.example.com/api/auth/google/callback';

    const r = await request(app).get('/api/auth/google');
    expect(r.status).toBe(302);

    const redirect = new URL(r.headers.location);
    expect(redirect.searchParams.get('prompt')).toBe('select_account');
  });
});

// ── Forgot password ───────────────────────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
  it('répond 200 même pour un email inexistant (anti-énumération)', async () => {
    const r = await request(app).post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it('répond 400 si email absent', async () => {
    const r = await request(app).post('/api/auth/forgot-password').send({});
    expect(r.status).toBe(400);
  });
});

// ── Export des données (RGPD) ───────────────────────────────────────────────────
describe('GET /api/auth/account/export', () => {
  it('refuse sans session', async () => {
    const r = await request(app).get('/api/auth/account/export');
    expect(r.status).toBe(401);
  });

  it('exporte les données de l\'utilisateur connecté en pièce jointe JSON', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register')
      .send({ email: 'export@example.com', password: 'securepass123', name: 'Export' });

    const r = await agent.get('/api/auth/account/export');
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/attachment/);
    expect(r.headers['content-type']).toMatch(/application\/json/);

    const data = JSON.parse(r.text);
    expect(data.export_version).toBe(1);
    expect(data.profile.email).toBe('export@example.com');
    expect(Array.isArray(data.activity)).toBe(true);
    expect(data.library).toHaveProperty('folders');
  });
});

// ── Suppression de compte (RGPD) ────────────────────────────────────────────────
describe('DELETE /api/auth/account', () => {
  it('refuse sans session', async () => {
    const r = await request(app).delete('/api/auth/account').send({});
    expect(r.status).toBe(401);
  });

  it('refuse avec un mot de passe incorrect', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register')
      .send({ email: 'del-bad@example.com', password: 'securepass123', name: 'Del' });

    const r = await agent.delete('/api/auth/account').send({ password: 'mauvais-mdp' });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/incorrect/i);
  });

  it('refuse si le mot de passe est absent (compte avec mot de passe)', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register')
      .send({ email: 'del-empty@example.com', password: 'securepass123', name: 'Del' });

    const r = await agent.delete('/api/auth/account').send({});
    expect(r.status).toBe(400);
  });

  it('supprime le compte avec le bon mot de passe', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register')
      .send({ email: 'del-ok@example.com', password: 'securepass123', name: 'Del' });

    const r = await agent.delete('/api/auth/account').send({ password: 'securepass123' });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    // La session est invalidée et le compte n'existe plus.
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});

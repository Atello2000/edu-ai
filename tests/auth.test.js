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
          const [email, password, name] = params;
          const id = nextId++;
          users.set(id, { id, email, password, name: name || '', plan: 'free',
            email_verified: 0, jetons: 40, is_admin: false, session_invalidated_at: null });
          return { lastInsertRowid: id, rowCount: 1, changes: 1 };
        }
        // UPDATE session_invalidated_at
        if (lower.includes('session_invalidated_at')) {
          const id = params[params.length - 1];
          const u = users.get(Number(id));
          if (u) u.session_invalidated_at = new Date().toISOString();
          return { rowCount: 1, changes: 1 };
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

jest.mock('../services/email', () => ({
  sendVerifyEmail: async () => {},
  sendResetEmail:  async () => {},
}));

const request = require('supertest');
let app;
beforeAll(() => { app = require('../app'); });

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

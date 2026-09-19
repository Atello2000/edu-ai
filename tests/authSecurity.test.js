process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'audit-auth-secret-long-enough';
const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
let mockUser;
let mockRefreshCount;
let mockInserts = [];
jest.mock('../db', () => {
  const db = { prepare: sql => ({
    async get(...args) {
      if (sql.includes('google_id =')) return null;
      if (sql.includes('FROM refresh_tokens')) return null;
      if (sql.includes('WHERE email =')) return mockUser?.email === args[0] ? { ...mockUser } : null;
      if (sql.includes('FROM users')) return mockUser ? { ...mockUser } : null;
      return null;
    },
    async run(...args) {
      if (sql.includes('INSERT INTO users')) {
        mockInserts.push(sql);
        mockUser = { id: 1, email: args[0], password: args[1], name: args[2], plan: 'free', email_verified: 1 };
        return { lastInsertRowid: 1, changes: 1 };
      }
      if (sql.includes('INSERT INTO refresh_tokens')) mockRefreshCount++;
      if (sql.includes('DELETE FROM refresh_tokens')) mockRefreshCount = 0;
      if (sql.includes('SET password =')) {
        mockUser.password = args[0];
        mockUser.session_invalidated_at = new Date().toISOString();
      }
      return { changes: 1 };
    },
  }) };
  db.transaction = async work => work(db);
  return db;
});
jest.mock('../middleware/csrf', () => ({ doubleCsrfProtection: (req, res, next) => next(), generateAndSetCsrfToken: () => 'csrf' }));
jest.mock('../services/email', () => ({ sendVerifyEmail: async () => {}, sendResetEmail: async () => {} }));
const app = express(); app.use(express.json()); app.use(require('cookie-parser')());
app.use('/auth', require('../routes/auth'));
beforeEach(() => {
  mockUser = { id: 1, email: 'audit@example.com', password: bcrypt.hashSync('old-password', 4), name: 'Audit', plan: 'free', email_verified: 1 };
  mockRefreshCount = 2;
});
afterEach(() => jest.restoreAllMocks());
test('password change revokes old sessions and immediate login works', async () => {
  const old = jwt.sign({ userId: 1, iat: Math.floor(Date.now()/1000)-10 }, process.env.SESSION_SECRET, { expiresIn: '1h' });
  const response = await request(app).put('/auth/profile').set('Cookie', 'jangalai.token=' + old)
    .send({ currentPassword: 'old-password', newPassword: 'new-password' });
  expect(response.status).toBe(200);
  expect(response.body.requiresLogin).toBe(true);
  expect(mockRefreshCount).toBe(0);
  expect((await request(app).get('/auth/me').set('Cookie', 'jangalai.token=' + old)).status).toBe(401);
  const login = await request(app).post('/auth/login').send({ email: 'audit@example.com', password: 'new-password' });
  expect(login.status).toBe(200);
  const cookies = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  expect((await request(app).get('/auth/me').set('Cookie', cookies)).status).toBe(200);
});
test('wrong current password leaves other sessions active', async () => {
  const token = jwt.sign({ userId: 1 }, process.env.SESSION_SECRET, { expiresIn: '1h' });
  const response = await request(app).put('/auth/profile').set('Cookie', 'jangalai.token=' + token)
    .send({ currentPassword: 'wrong', newPassword: 'new-password' });
  expect(response.status).toBe(401);
  expect(mockRefreshCount).toBe(2);
  expect(mockUser.session_invalidated_at).toBeUndefined();
});
test('both signup paths use the same 80-credit allocation', async () => {
  mockUser = null; mockInserts = [];
  expect((await request(app).post('/auth/register').send({ email: 'email@example.com', password: 'password123', name: 'Email' })).status).toBe(200);
  mockUser = null;
  jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce({ json: async () => ({ access_token: 'fake-token' }) })
    .mockResolvedValueOnce({ json: async () => ({ id: 'google-id', email: 'google@example.com', name: 'Google' }) });
  const response = await request(app).get('/auth/google/callback?code=test&state=state').set('Cookie', 'oauth_state=state');
  expect(response.status).toBe(302);
  expect(response.headers.location).toContain('/app');
  expect(mockInserts).toHaveLength(2);
  expect(mockInserts.every(sql => /, 80,/.test(sql))).toBe(true);
});

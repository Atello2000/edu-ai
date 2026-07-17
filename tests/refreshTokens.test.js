/**
 * tests/refreshTokens.test.js
 * Rotation des refresh tokens : émission, rotation, fenêtre de grâce,
 * détection de réutilisation (vol de cookie).
 */
process.env.SESSION_SECRET = 'test-session-secret-min32chars!!';
process.env.NODE_ENV       = 'test';

// Mock DB — table refresh_tokens en mémoire + users.session_invalidated_at
jest.mock('../db', () => {
  const tokens = new Map(); // token_hash -> { user_id, expires_at, rotated_at }
  const users  = new Map(); // id -> { session_invalidated_at }
  return {
    __tokens: tokens,
    __users: users,
    prepare: (sql) => {
      const lower = sql.toLowerCase();
      return {
        async get(...params) {
          if (lower.includes('from refresh_tokens')) {
            const row = tokens.get(params[0]);
            return row ? { user_id: row.user_id, rotated_at: row.rotated_at } : null;
          }
          return null;
        },
        async run(...params) {
          if (lower.includes('insert into refresh_tokens')) {
            const [hash, userId, expiresAt] = params;
            tokens.set(hash, { user_id: userId, expires_at: expiresAt, rotated_at: null });
            return { rowCount: 1 };
          }
          if (lower.includes('set rotated_at')) {
            const row = tokens.get(params[0]);
            if (row) row.rotated_at = new Date().toISOString();
            return { rowCount: row ? 1 : 0 };
          }
          if (lower.includes('delete from refresh_tokens')) {
            const userId = params[0];
            for (const [k, v] of tokens) if (v.user_id === userId) tokens.delete(k);
            return { rowCount: 1 };
          }
          if (lower.includes('session_invalidated_at')) {
            users.set(Number(params[0]), { session_invalidated_at: new Date().toISOString() });
            return { rowCount: 1 };
          }
          return { rowCount: 0 };
        },
      };
    },
  };
});

const db = require('../db');
const { issueRefreshToken, consumeRefreshToken, issuedAtAfterRevocation } = require('../services/refreshTokens');

beforeEach(() => {
  db.__tokens.clear();
  db.__users.clear();
});

test('émission puis consommation : rotation avec nouveau token', async () => {
  const token = await issueRefreshToken(42);
  expect(db.__tokens.size).toBe(1);

  const result = await consumeRefreshToken(token);
  expect(result).not.toBeNull();
  expect(result.userId).toBe(42);
  expect(result.newRefreshToken).toBeTruthy();
  expect(result.newRefreshToken).not.toBe(token);
  // L'ancien est marqué tourné, le nouveau est actif
  expect(db.__tokens.size).toBe(2);
});

test('réutilisation dans la fenêtre de grâce : accepté sans nouvelle rotation', async () => {
  const token = await issueRefreshToken(42);
  await consumeRefreshToken(token);

  const second = await consumeRefreshToken(token);
  expect(second).not.toBeNull();
  expect(second.userId).toBe(42);
  expect(second.newRefreshToken).toBeNull();
});

test('réutilisation après la fenêtre de grâce : révocation totale', async () => {
  const token = await issueRefreshToken(42);
  const first = await consumeRefreshToken(token);
  expect(first).not.toBeNull();

  // Simule un rotated_at vieux de 5 minutes
  for (const row of db.__tokens.values()) {
    if (row.rotated_at) row.rotated_at = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  }

  const reuse = await consumeRefreshToken(token);
  expect(reuse).toBeNull();
  // Tous les tokens de l'utilisateur supprimés + sessions invalidées
  expect(db.__tokens.size).toBe(0);
  expect(db.__users.get(42)?.session_invalidated_at).toBeTruthy();
});

test('JWT valide mais inconnu en base : rejeté sans révocation', async () => {
  const token = await issueRefreshToken(42);
  db.__tokens.clear(); // simule un token d'avant la migration ou purgé

  const result = await consumeRefreshToken(token);
  expect(result).toBeNull();
  expect(db.__users.has(42)).toBe(false);
});

test('token invalide ou absent : rejeté', async () => {
  expect(await consumeRefreshToken(null)).toBeNull();
  expect(await consumeRefreshToken('not-a-jwt')).toBeNull();
});
test('reconnexion immédiate : iat est strictement postérieur à la révocation', () => {
  const invalidatedAt = '2026-07-17T12:00:00.900Z';
  const issuedAt = issuedAtAfterRevocation(invalidatedAt, Date.parse('2026-07-17T12:00:00.950Z'));

  expect(issuedAt * 1000).toBeGreaterThan(new Date(invalidatedAt).getTime());
});

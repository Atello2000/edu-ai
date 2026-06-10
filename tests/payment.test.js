/**
 * tests/payment.test.js
 * Tests de la route IPN PayTech (webhook de paiement).
 */
process.env.PORT             = '0';
process.env.SESSION_SECRET   = 'test-session-secret-min32chars!!';
process.env.NODE_ENV         = 'test';
process.env.PAYTECH_API_KEY    = 'test-api-key';
process.env.PAYTECH_API_SECRET = 'test-api-secret';
process.env.PAYMENTS_LOCKED    = 'true';

const crypto = require('crypto');

jest.mock('../db', () => {
  // Mini-store des paiements : l'IPN ne crédite que les ref_command
  // préalablement enregistrées en 'pending' par le checkout.
  const payments = new Map(); // ref_command -> { user_id, plan, amount, status }
  return {
    prepare: (sql) => ({
      async get(...params) {
        if (sql.includes('FROM payments WHERE ref_command')) {
          const p = payments.get(params[0]);
          return p ? { ...p } : null;
        }
        if (sql.includes("UPDATE payments SET status = 'paid'")) {
          const p = payments.get(params[0]);
          if (!p || p.status !== 'pending') return null;
          p.status = 'paid';
          return { id: 1 };
        }
        if (sql.includes('UPDATE users SET')) return { balance: 190 };
        if (sql.includes('WHERE id')) return { id: 1, plan: 'free' };
        return null;
      },
      async run(...params) {
        if (sql.includes('INSERT INTO payments')) {
          const [ref, userId, plan, amount] = params;
          payments.set(ref, { user_id: userId, plan, amount, status: 'pending' });
          return { rowCount: 1, changes: 1 };
        }
        return { rowCount: 1, changes: 1 };
      },
      async all()  { return []; },
    }),
    pool: { query: async () => ({ rows: [], rowCount: 0 }) },
    exec: async () => {},
  };
});

jest.mock('../middleware/csrf', () => ({
  doubleCsrfProtection:    (req, res, next) => next(),
  generateAndSetCsrfToken: ()               => 'mock',
}));

const request = require('supertest');
const express = require('express');
let app;
beforeAll(() => { app = require('../app'); });

function makeHashes(apiKey = 'test-api-key', apiSecret = 'test-api-secret') {
  return {
    api_key_sha256:    crypto.createHash('sha256').update(apiKey).digest('hex'),
    api_secret_sha256: crypto.createHash('sha256').update(apiSecret).digest('hex'),
  };
}

describe('POST /api/payment/ipn', () => {
  it('rejette une requête sans paramètres obligatoires', async () => {
    const r = await request(app).post('/api/payment/ipn').send({});
    expect(r.status).toBe(400);
  });

  it('rejette une signature invalide (timing-safe)', async () => {
    const r = await request(app).post('/api/payment/ipn').send({
      api_key_sha256:    'a'.repeat(64),
      api_secret_sha256: 'b'.repeat(64),
      ref_command:       'PAYTECH_sub_1_pro_123',
      item_price:        '2500',
      type_event:        'sale_complete',
    });
    expect(r.status).toBe(403);
  });

  it('rejette un ref_command avec format invalide', async () => {
    const { api_key_sha256, api_secret_sha256 } = makeHashes();
    const r = await request(app).post('/api/payment/ipn').send({
      api_key_sha256,
      api_secret_sha256,
      ref_command: 'INVALID_FORMAT',
      item_price:  '2500',
    });
    expect(r.status).toBe(400);
  });

  it('rejette un montant insuffisant', async () => {
    const { api_key_sha256, api_secret_sha256 } = makeHashes();
    const r = await request(app).post('/api/payment/ipn').send({
      api_key_sha256,
      api_secret_sha256,
      ref_command: 'PAYTECH_sub_1_pro_999',
      item_price:  '100', // < 2500 attendu
      type_event:  'sale_complete',
    });
    expect(r.status).toBe(400);
  });

  it('rejette un IPN dont la ref_command ne correspond à aucun checkout', async () => {
    const { api_key_sha256, api_secret_sha256 } = makeHashes();
    const r = await request(app).post('/api/payment/ipn').send({
      api_key_sha256,
      api_secret_sha256,
      ref_command: 'PAYTECH_sub_1_max_' + Date.now(), // jamais enregistrée en pending
      item_price:  '5000',
      type_event:  'sale_complete',
    });
    expect(r.status).toBe(400);
  });

  it('accepte un IPN valide (checkout pending enregistré) et répond 200', async () => {
    const db  = require('../db');
    const ref = 'PAYTECH_sub_1_pro_' + Date.now();
    await db.prepare(
      "INSERT INTO payments (ref_command, user_id, plan, amount, status) VALUES (?, ?, ?, ?, 'pending')"
    ).run(ref, 1, 'pro', 2500);

    const { api_key_sha256, api_secret_sha256 } = makeHashes();
    const r = await request(app).post('/api/payment/ipn').send({
      api_key_sha256,
      api_secret_sha256,
      ref_command: ref,
      item_price:  '2500',
      type_event:  'sale_complete',
    });
    expect(r.status).toBe(200);

    // Idempotence : un retry PayTech sur la même ref répond 200 sans recréditer
    const retry = await request(app).post('/api/payment/ipn').send({
      api_key_sha256,
      api_secret_sha256,
      ref_command: ref,
      item_price:  '2500',
      type_event:  'sale_complete',
    });
    expect(retry.status).toBe(200);
  });
});

describe('POST /api/payment/checkout', () => {
  it('bloque les nouveaux checkouts quand les paiements sont verrouilles', async () => {
    const { protectedRouter } = require('../routes/payment');
    const checkoutApp = express();

    checkoutApp.use(express.json());
    checkoutApp.use((req, res, next) => {
      req.user = { id: 1, email: 'test@example.com' };
      next();
    });
    checkoutApp.use('/api/payment', protectedRouter);

    const r = await request(checkoutApp)
      .post('/api/payment/checkout')
      .send({ plan: 'pro' });

    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ paymentsLocked: true });
  });
});

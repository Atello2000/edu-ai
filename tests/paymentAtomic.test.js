process.env.NODE_ENV = 'test';
process.env.PAYTECH_API_KEY = 'test-key';
process.env.PAYTECH_API_SECRET = 'test-secret';
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
let mockState;
let mockFailure;
jest.mock('../services/email', () => ({ sendAdminAlert: async () => {} }));
jest.mock('../db', () => {
  function adapter(state) {
    return { prepare: sql => ({
      async get(...args) {
        if (sql.includes('FROM payments')) {
          if (args[0] !== state.ref || (args.length === 2 && args[1] !== 1)) return null;
          return { ref_command: state.ref, user_id: 1, plan: state.plan, amount: state.amount, status: state.status };
        }
        if (sql.includes('UPDATE users SET')) {
          if (mockFailure === 'credit') throw new Error('credit failure');
          state.balance += state.plan === 'topup' ? args[0] : args[1];
          return { balance: state.balance };
        }
      },
      async run() {
        if (sql.includes('INSERT INTO jeton_transactions')) {
          if (mockFailure === 'ledger') throw new Error('ledger failure');
          state.entries++;
        }
        if (sql.includes("UPDATE payments SET status = 'paid'")) {
          if (mockFailure === 'status') throw new Error('status failure');
          state.status = 'paid';
        }
        return { changes: 1 };
      },
    }) };
  }
  return {
    prepare: sql => adapter(mockState).prepare(sql),
    transaction: async work => {
      const draft = { ...mockState };
      const result = await work(adapter(draft));
      mockState = draft;
      return result;
    },
  };
});
const { publicRouter, protectedRouter } = require('../routes/payment');
const app = express();
app.use(express.json());
app.use('/ipn', publicRouter);
app.use((req, res, next) => { req.user = { id: Number(req.headers['x-test-user'] || 1) }; next(); });
app.use('/payment', protectedRouter);
function notification() {
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  return request(app).post('/ipn').send({ api_key_sha256: hash('test-key'), api_secret_sha256: hash('test-secret'),
    ref_command: mockState.ref, item_price: mockState.amount, type_event: 'sale_complete' });
}
beforeEach(() => {
  mockFailure = null;
  mockState = { ref: 'PAYTECH_sub_1_pro_123', plan: 'pro', amount: 2500, status: 'pending', balance: 80, entries: 0 };
});
test.each(['credit', 'ledger', 'status'])('failure in %s leaves payment retryable, then credits once', async phase => {
  mockFailure = phase;
  expect((await notification()).status).toBe(500);
  expect(mockState).toMatchObject({ status: 'pending', balance: 80, entries: 0 });
  mockFailure = null;
  expect((await notification()).status).toBe(200);
  expect((await notification()).status).toBe(200);
  expect(mockState).toMatchObject({ status: 'paid', balance: 230, entries: 1 });
});
test('topup is tracked as an individual purchase', async () => {
  Object.assign(mockState, { ref: 'PAYTECH_topup_1_topup_123', plan: 'topup', amount: 1000 });
  expect((await notification()).status).toBe(200);
  const result = await request(app).get('/payment/status/' + mockState.ref);
  expect(result.body).toEqual({ reference: mockState.ref, plan: 'topup', status: 'paid' });
  expect(mockState.balance).toBe(130);
});
test('status does not expose another account purchase', async () => {
  expect((await request(app).get('/payment/status/' + mockState.ref).set('x-test-user', '2')).status).toBe(404);
});

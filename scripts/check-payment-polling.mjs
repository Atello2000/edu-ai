import assert from 'node:assert/strict';
import { watchPayment } from '../client/src/utils/paymentPolling.js';
async function scenario(responses, expected) {
  let next; const paid = [];
  watchPayment('purchase-A', {
    fetchStatus: async () => ({ ok: true, status: 200, json: async () => responses.shift() }),
    schedule: fn => { next = fn; return 1; }, cancel: () => {},
    onPaid: plan => paid.push(plan), onMissing: () => {}, onTimeout: () => {},
  });
  while (responses.length) { const run = next; next = null; await run(); }
  assert.deepEqual(paid, expected);
}
await scenario([{ reference: 'purchase-A', status: 'pending', plan: 'pro' }], []);
await scenario([{ reference: 'purchase-B', status: 'paid', plan: 'max' }], []);
await scenario([{ reference: 'purchase-A', status: 'pending', plan: 'topup' }, { reference: 'purchase-A', status: 'paid', plan: 'topup' }], ['topup']);
let resolve; let paid = false; let run;
const stop = watchPayment('purchase-A', { fetchStatus: () => new Promise(r => { resolve = r; }), schedule: f => { run = f; }, cancel: () => {}, onPaid: () => { paid = true; }, onMissing() {}, onTimeout() {} });
const pending = run(); stop(); resolve({ ok: true, status: 200, json: async () => ({ reference: 'purchase-A', status: 'paid', plan: 'max' }) }); await pending;
assert.equal(paid, false);
console.log('Payment polling: 4 scenarios passed');

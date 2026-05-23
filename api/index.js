require('express'); // required for Vercel @vercel/node Express detection
const { initSchema } = require('../db');
const app = require('../app');

let initialized = false;
let initError   = null;

// Initialize once; retry on the next request if it failed last time.
async function ensureInit() {
  if (initialized) return;
  try {
    await initSchema();
    initialized = true;
    initError   = null;
  } catch (err) {
    initError = err;
    throw err;
  }
}

module.exports = async (req, res) => {
  try {
    await ensureInit();
  } catch (err) {
    // DB init failed — still try to serve the request.
    // The app will return proper errors for DB-dependent routes.
    console.error('[api/index] DB init error:', err.message);
  }
  return app(req, res);
};

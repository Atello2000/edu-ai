const db = require('../db');

function logTokens(userId, action, provider, inputTokens, outputTokens) {
  if (!userId) return;
  try {
    const date = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO token_usage (user_id, date, action, provider, input_tokens, output_tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, date, action, provider || '', inputTokens || 0, outputTokens || 0);
  } catch (err) {
    console.warn('[tokens] log échoué', err.message);
  }
}

module.exports = { logTokens };

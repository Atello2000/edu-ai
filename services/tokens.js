const { prepare } = require('../db');
const logger = require('./logger');

async function logTokens(userId, action, provider, inputTokens, outputTokens) {
  if (!userId) return;
  try {
    const date = new Date().toISOString().slice(0, 10);
    await prepare(`
      INSERT INTO token_usage (user_id, date, action, provider, input_tokens, output_tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, date, action, provider || '', inputTokens || 0, outputTokens || 0);
  } catch (err) {
    logger.warn('Token log failed', { message: err.message });
  }
}

module.exports = { logTokens };

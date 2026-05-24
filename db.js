require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  require('./services/logger').error('PostgreSQL pool error', { message: err.message });
});

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const RETRYABLE = /connection timeout|terminating connection|Connection terminated|ECONNRESET|ENOTFOUND/i;

async function query(sql, params, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      if (i < retries && RETRYABLE.test(err.message)) {
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

function prepare(sql) {
  const pgSql = toPg(sql);
  const isInsert = /^\s*INSERT/i.test(pgSql);
  return {
    async get(...params) {
      const { rows } = await query(pgSql, params);
      return rows[0] || null;
    },
    async all(...params) {
      const { rows } = await query(pgSql, params);
      return rows;
    },
    async run(...params) {
      const finalSql = isInsert && !pgSql.toUpperCase().includes('RETURNING')
        ? pgSql + ' RETURNING id'
        : pgSql;
      const { rows, rowCount } = await query(finalSql, params);
      return { lastInsertRowid: rows[0]?.id, rowCount, changes: rowCount };
    },
  };
}

async function exec(sql) {
  await query(sql, []);
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL DEFAULT '',
      name       TEXT    NOT NULL DEFAULT '',
      plan       TEXT    NOT NULL DEFAULT 'free',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_quota (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date       TEXT    NOT NULL,
      summarize  INTEGER NOT NULL DEFAULT 0,
      quiz       INTEGER NOT NULL DEFAULT 0,
      flashcards INTEGER NOT NULL DEFAULT 0,
      chat       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, date)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      sid     TEXT PRIMARY KEY,
      data    TEXT NOT NULL,
      expires BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint   TEXT    NOT NULL UNIQUE,
      p256dh     TEXT    NOT NULL,
      auth       TEXT    NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS token_usage (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date          TEXT    NOT NULL,
      action        TEXT    NOT NULL,
      provider      TEXT    NOT NULL DEFAULT '',
      input_tokens  INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS folders (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      icon       TEXT    NOT NULL DEFAULT '📁',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS folder_files (
      id         SERIAL PRIMARY KEY,
      folder_id  INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      filename   TEXT    NOT NULL,
      orig_name  TEXT    NOT NULL,
      size       INTEGER NOT NULL DEFAULT 0,
      text       TEXT    NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(folder_id, filename)
    );
    CREATE TABLE IF NOT EXISTS activity (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic      TEXT    NOT NULL,
      type       TEXT    NOT NULL,
      score      INTEGER,
      total      INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ai_cache (
      cache_key  TEXT PRIMARY KEY,
      result     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_cache(expires_at);
    CREATE TABLE IF NOT EXISTS user_messages (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message    TEXT    NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_read    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_user_messages_read ON user_messages(is_read);
    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const migrations = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS level TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS domains TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_done INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT",
    "INSERT INTO app_config (key, value) VALUES ('ai_provider', 'groq') ON CONFLICT DO NOTHING",
    "INSERT INTO app_config (key, value) VALUES ('ai_model', 'llama-3.3-70b-versatile') ON CONFLICT DO NOTHING",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_provider TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model TEXT",
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch (_) {}
  }
  require('./services/logger').info('PostgreSQL schema ready');
}

module.exports = { prepare, exec, pool, initSchema };

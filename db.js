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
    // Migrer le provider global de groq → mistral si jamais touché
    "UPDATE app_config SET value = 'mistral' WHERE key = 'ai_provider' AND value = 'groq'",
    "UPDATE app_config SET value = 'mistral-small-latest' WHERE key = 'ai_model' AND value = 'llama-3.3-70b-versatile'",
    // ── Système de jetons ─────────────────────────────────────────────────────
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS jetons INTEGER NOT NULL DEFAULT 40",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS jetons_reset_date TEXT",
    `CREATE TABLE IF NOT EXISTS jeton_transactions (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action        TEXT    NOT NULL,
      amount        INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      note          TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // Allocation initiale pour les utilisateurs existants sans jetons_reset_date
    // Couvre tous les cas : jetons = 0 (anciens comptes) ET jetons = 40 (DEFAULT PostgreSQL)
    `UPDATE users SET jetons = CASE WHEN plan = 'max' THEN 400 WHEN plan = 'pro' THEN 150 ELSE 40 END,
       jetons_reset_date = to_char(NOW(), 'YYYY-MM')
     WHERE jetons_reset_date IS NULL`,
    // ── SRS / Flashcards — persistance PostgreSQL (Faille 2 audit) ──────────
    `CREATE TABLE IF NOT EXISTS srs_progress (
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_hash   TEXT    NOT NULL,
      interval_days REAL  NOT NULL DEFAULT 1,
      ease_factor REAL    NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0,
      next_review BIGINT  NOT NULL DEFAULT 0,
      front       TEXT    NOT NULL DEFAULT '',
      back        TEXT    NOT NULL DEFAULT '',
      updated_at  BIGINT  NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, card_hash)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_srs_next_review ON srs_progress(user_id, next_review)`,
    "ALTER TABLE folder_files ADD COLUMN IF NOT EXISTS truncated INTEGER NOT NULL DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS shared_content (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL DEFAULT 'summary',
      title      TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_shared_content_expires ON shared_content(expires_at)`,
  ];
  // MED-01 : Loguer les erreurs de migration au lieu de les avaler silencieusement.
  // Les codes 42701 (column already exists) et 42P07 (relation already exists) sont attendus.
  const EXPECTED_CODES = new Set(['42701', '42P07', '42710']);
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!EXPECTED_CODES.has(err.code)) {
        require('./services/logger').warn('Migration warning', {
          sql: sql.replace(/\s+/g, ' ').slice(0, 120),
          code: err.code,
          error: err.message,
        });
      }
    }
  }
  require('./services/logger').info('PostgreSQL schema ready');
}

module.exports = { prepare, exec, pool, initSchema };

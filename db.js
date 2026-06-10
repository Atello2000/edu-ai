require('dotenv').config();
const { Pool } = require('pg');

const rawDbUrl = process.env.DATABASE_URL || '';
const cleanDbUrl = rawDbUrl.replace(/^["']|["']$/g, '').trim();

const pool = new Pool({
  connectionString: cleanDbUrl,
  ssl: cleanDbUrl && !cleanDbUrl.includes('localhost')
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
    : false,
  max: 10,
  idleTimeoutMillis: 10000,
  // Neon (autosuspend) peut mettre 5-10 s à se réveiller à froid : 5 s de
  // timeout faisait échouer le démarrage (deploy failed sur Render).
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  require('./services/logger').error('PostgreSQL pool error', { message: err.message });
});

/**
 * Convertit les requêtes SQL avec marqueurs de substitution style SQLite (?) 
 * en marqueurs positionnels style PostgreSQL ($1, $2...).
 * 
 * ATTENTION : PostgreSQL utilise le caractère "?" comme opérateur natif pour les colonnes JSONB.
 * Pour utiliser un "?" littéral dans une requête sans qu'il ne soit converti en paramètre (ex. opérateur JSONB),
 * utilisez un double point d'interrogation "??". Cette fonction le convertira en un "?" unique.
 * Alternativement, préférez l'utilisation des fonctions PG standard (comme jsonb_exists(col, 'key'))
 * ou de l'opérateur de confinement (@>).
 */
function toPg(sql) {
  let i = 0;
  return sql
    .replace(/\?\?/g, '\uFFFD')
    .replace(/\?/g, () => `$${++i}`)
    .replace(/\uFFFD/g, '?');
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
    CREATE TABLE IF NOT EXISTS applied_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT name FROM applied_migrations');
  const applied = new Set(rows.map(r => r.name));

  const migrations = [
    { id: 'users_google_id', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT" },
    { id: 'users_email_verified', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0" },
    { id: 'users_verify_token', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT" },
    { id: 'users_verify_expires', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires TEXT" },
    { id: 'users_reset_token', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT" },
    { id: 'users_reset_expires', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TEXT" },
    { id: 'users_level', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS level TEXT" },
    { id: 'users_domains', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS domains TEXT NOT NULL DEFAULT '[]'" },
    { id: 'users_onboarding_done', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_done INTEGER NOT NULL DEFAULT 0" },
    { id: 'users_specialty', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT" },
    { id: 'config_ai_provider', sql: "INSERT INTO app_config (key, value) VALUES ('ai_provider', 'groq') ON CONFLICT DO NOTHING" },
    { id: 'config_ai_model', sql: "INSERT INTO app_config (key, value) VALUES ('ai_model', 'llama-3.3-70b-versatile') ON CONFLICT DO NOTHING" },
    { id: 'users_ai_provider', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_provider TEXT" },
    { id: 'users_ai_model', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model TEXT" },
    { id: 'migrate_to_mistral_provider', sql: "UPDATE app_config SET value = 'mistral' WHERE key = 'ai_provider' AND value = 'groq'" },
    { id: 'migrate_to_mistral_model', sql: "UPDATE app_config SET value = 'mistral-small-latest' WHERE key = 'ai_model' AND value = 'llama-3.3-70b-versatile'" },
    { id: 'migrate_to_gemini_provider', sql: "UPDATE app_config SET value = 'gemini' WHERE key = 'ai_provider' AND value IN ('groq', 'mistral')" },
    { id: 'migrate_to_gemini_model', sql: "UPDATE app_config SET value = 'gemini-2.5-flash' WHERE key = 'ai_model' AND value IN ('llama-3.3-70b-versatile', 'mistral-small-latest', 'gemini-2.0-flash')" },
    { id: 'users_jetons', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS jetons INTEGER NOT NULL DEFAULT 40" },
    { id: 'users_jetons_reset_date', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS jetons_reset_date TEXT" },
    { id: 'create_jeton_transactions', sql: `CREATE TABLE IF NOT EXISTS jeton_transactions (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action        TEXT    NOT NULL,
      amount        INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      note          TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
    { id: 'users_initial_jetons_allocation', sql: `UPDATE users SET jetons = CASE WHEN plan = 'max' THEN 400 WHEN plan = 'pro' THEN 150 ELSE 40 END,
       jetons_reset_date = to_char(NOW(), 'YYYY-MM')
     WHERE jetons_reset_date IS NULL` },
    { id: 'create_srs_progress', sql: `CREATE TABLE IF NOT EXISTS srs_progress (
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
    )` },
    { id: 'idx_srs_next_review', sql: `CREATE INDEX IF NOT EXISTS idx_srs_next_review ON srs_progress(user_id, next_review)` },
    { id: 'folder_files_truncated', sql: "ALTER TABLE folder_files ADD COLUMN IF NOT EXISTS truncated INTEGER NOT NULL DEFAULT 0" },
    { id: 'create_shared_content', sql: `CREATE TABLE IF NOT EXISTS shared_content (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL DEFAULT 'summary',
      title      TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
    { id: 'idx_shared_content_expires', sql: `CREATE INDEX IF NOT EXISTS idx_shared_content_expires ON shared_content(expires_at)` },
    { id: 'create_payments', sql: `CREATE TABLE IF NOT EXISTS payments (
      id          SERIAL PRIMARY KEY,
      ref_command TEXT    NOT NULL UNIQUE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan        TEXT    NOT NULL,
      amount      INTEGER NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
    { id: 'users_is_admin', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false" },
    // Cycle de vie des paiements : 'pending' à l'initiation du checkout,
    // 'paid' une fois l'IPN validé. Les lignes existantes sont des paiements
    // aboutis → DEFAULT 'paid' les couvre.
    { id: 'payments_status', sql: "ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid'" },
    { id: 'payments_paid_at', sql: "ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ" },
    { id: 'users_session_invalidated_at', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS session_invalidated_at TIMESTAMPTZ" },
    { id: 'users_plan_expires_at', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ" },
    { id: 'idx_users_google_id', sql: "CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)" },
    { id: 'alter_users_verify_expires_type', sql: "ALTER TABLE users ALTER COLUMN verify_expires TYPE TIMESTAMPTZ USING verify_expires::TIMESTAMPTZ" },
    { id: 'alter_users_reset_expires_type', sql: "ALTER TABLE users ALTER COLUMN reset_expires TYPE TIMESTAMPTZ USING reset_expires::TIMESTAMPTZ" },
    { id: 'alter_users_domains_type', sql: "ALTER TABLE users ALTER COLUMN domains DROP DEFAULT" },
    { id: 'alter_users_domains_type_jsonb', sql: "ALTER TABLE users ALTER COLUMN domains TYPE JSONB USING domains::JSONB" },
    { id: 'alter_users_domains_default_jsonb', sql: "ALTER TABLE users ALTER COLUMN domains SET DEFAULT '[]'::JSONB" }
  ];

  const EXPECTED_CODES = new Set(['42701', '42P07', '42710']);
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    try {
      await pool.query(m.sql);
      await pool.query('INSERT INTO applied_migrations (name) VALUES ($1)', [m.id]);
    } catch (err) {
      if (!EXPECTED_CODES.has(err.code)) {
        require('./services/logger').warn('Migration warning', {
          id: m.id,
          sql: m.sql.replace(/\s+/g, ' ').slice(0, 120),
          code: err.code,
          error: err.message,
        });
      } else {
        try {
          await pool.query('INSERT INTO applied_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [m.id]);
        } catch (_) {}
      }
    }
  }

  // Synchronise is_admin depuis ADMIN_EMAIL à chaque démarrage
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (adminEmail) {
    await pool.query('UPDATE users SET is_admin = true  WHERE LOWER(email) = $1', [adminEmail]);
    await pool.query('UPDATE users SET is_admin = false WHERE LOWER(email) != $1', [adminEmail]);
  }
  require('./services/logger').info('PostgreSQL schema ready');
}

module.exports = { prepare, exec, pool, initSchema };

const { prepare } = require('../db');

const IS_PROD = process.env.NODE_ENV === 'production';

const LIMITS = IS_PROD ? {
  fileSize:      20 * 1024 * 1024,
  maxFiles:      3,
  summaryChars:  80000,
  quizChars:     80000,
  quizMaxCount:  20,
  flashChars:    30000,
  flashMaxCount: 30,
  chatChars:     6000,
} : {
  fileSize:      50 * 1024 * 1024,
  maxFiles:      20,
  summaryChars:  60000,
  quizChars:     40000,
  quizMaxCount:  999,
  flashChars:    20000,
  flashMaxCount: 999,
  chatChars:     8000,
};

// Quotas journaliers par plan
const QUOTA_DAILY = {
  free: { summarize: 3,  quiz: 5,  flashcards: 5,  chat: 5  },
  pro:  { summarize: 15, quiz: 30, flashcards: 30, chat: 20 },
  max:  { summarize: 50, quiz: 100, flashcards: 100, chat: 60 },
};

const SAFE_FIELDS = { summarize: 'summarize', quiz: 'quiz', flashcards: 'flashcards', chat: 'chat' };

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

async function checkQuota(req, action) {
  if (!IS_PROD) return { ok: true };
  const user = req.user;
  if (!user) return { ok: true };

  const safeField = SAFE_FIELDS[action];
  if (!safeField) throw new Error('Action invalide');

  const today  = getTodayStr();
  const limits = QUOTA_DAILY[user.plan] || QUOTA_DAILY.free;
  const limit  = limits[action];

  // Atomic: insert row for today or increment only if still under limit.
  // ON CONFLICT DO UPDATE ... WHERE ensures the read-check-write is a single
  // operation — no race condition between concurrent requests.
  const row = await prepare(`
    INSERT INTO user_quota (user_id, date, ${safeField})
    VALUES (?, ?, 1)
    ON CONFLICT (user_id, date) DO UPDATE
      SET ${safeField} = user_quota.${safeField} + 1
      WHERE user_quota.${safeField} < ?
    RETURNING ${safeField} AS used
  `).get(user.id, today, limit);

  if (!row) {
    // WHERE blocked the update — quota reached
    const cur = await prepare(
      `SELECT ${safeField} AS used FROM user_quota WHERE user_id = ? AND date = ?`
    ).get(user.id, today);
    return { ok: false, used: cur?.used ?? limit, limit, action };
  }

  return { ok: true, used: row.used, limit };
}

async function getQuotaStatus(req) {
  if (!IS_PROD || !req.user) return null;
  const today  = getTodayStr();
  const limits = QUOTA_DAILY[req.user.plan] || QUOTA_DAILY.free;

  // .get() instead of .run() — user_quota has no "id" column so run()'s
  // auto-appended "RETURNING id" would crash; .get() sends the SQL as-is.
  await prepare(`
    INSERT INTO user_quota (user_id, date) VALUES (?, ?)
    ON CONFLICT (user_id, date) DO NOTHING
  `).get(req.user.id, today);

  const row = await prepare(
    'SELECT * FROM user_quota WHERE user_id = ? AND date = ?'
  ).get(req.user.id, today);

  return {
    summarize:  { used: row.summarize,  limit: limits.summarize },
    quiz:       { used: row.quiz,       limit: limits.quiz },
    flashcards: { used: row.flashcards, limit: limits.flashcards },
    chat:       { used: row.chat,       limit: limits.chat },
  };
}

module.exports = { IS_PROD, LIMITS, QUOTA_DAILY, checkQuota, getQuotaStatus };

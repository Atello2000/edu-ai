const db     = require('../db');

const IS_PROD = !!process.env.RAILWAY_ENVIRONMENT;

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

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

function checkQuota(req, action) {
  if (!IS_PROD) return { ok: true };
  const user = req.user;
  if (!user) return { ok: true }; // middleware auth gère ça avant

  const today  = getTodayStr();
  const limits = QUOTA_DAILY[user.plan] || QUOTA_DAILY.free;
  const limit  = limits[action];

  // Upsert la ligne du jour
  db.prepare(`
    INSERT INTO user_quota (user_id, date) VALUES (?, ?)
    ON CONFLICT (user_id, date) DO NOTHING
  `).run(user.id, today);

  const row = db.prepare('SELECT * FROM user_quota WHERE user_id = ? AND date = ?').get(user.id, today);
  const used = row[action] || 0;

  if (used >= limit) return { ok: false, used, limit, action };

  const safeField = { summarize: 'summarize', quiz: 'quiz', flashcards: 'flashcards', chat: 'chat' }[action];
  if (!safeField) throw new Error('Action invalide');
  db.prepare(`UPDATE user_quota SET ${safeField} = ${safeField} + 1 WHERE user_id = ? AND date = ?`).run(user.id, today);
  return { ok: true, used: used + 1, limit };
}

function getQuotaStatus(req) {
  if (!IS_PROD || !req.user) return null;
  const today = getTodayStr();
  const limits = QUOTA_DAILY[req.user.plan] || QUOTA_DAILY.free;

  db.prepare(`
    INSERT INTO user_quota (user_id, date) VALUES (?, ?)
    ON CONFLICT (user_id, date) DO NOTHING
  `).run(req.user.id, today);

  const row = db.prepare('SELECT * FROM user_quota WHERE user_id = ? AND date = ?').get(req.user.id, today);
  return {
    summarize:  { used: row.summarize,  limit: limits.summarize },
    quiz:       { used: row.quiz,       limit: limits.quiz },
    flashcards: { used: row.flashcards, limit: limits.flashcards },
    chat:       { used: row.chat,       limit: limits.chat },
  };
}

module.exports = { IS_PROD, LIMITS, QUOTA_DAILY, checkQuota, getQuotaStatus };

const fs   = require('fs');
const path = require('path');

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

const QUOTA_DAILY  = { summarize: 10, quiz: 20, flashcards: 20, chat: 15 };
const QUOTA_FILE   = path.join(__dirname, '..', 'data', 'quota.json');
const ipQuotaMap   = new Map();

// ── Persistance ───────────────────────────────────────────────────────────────

function loadQuota() {
  try {
    if (!fs.existsSync(QUOTA_FILE)) return;
    const raw   = fs.readFileSync(QUOTA_FILE, 'utf8');
    const today = new Date().toDateString();
    for (const [ip, q] of Object.entries(JSON.parse(raw))) {
      if (q.date === today) ipQuotaMap.set(ip, q); // ignore les entrées d'hier
    }
  } catch { /* fichier corrompu → on repart de zéro */ }
}

function saveQuota() {
  try {
    const dir = path.dirname(QUOTA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = {};
    for (const [ip, q] of ipQuotaMap) obj[ip] = q;
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(obj), 'utf8');
  } catch { /* écriture non critique */ }
}

loadQuota();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : null) || req.socket?.remoteAddress || 'unknown';
}

function isLocalIP(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function checkQuota(req, action) {
  if (!IS_PROD) return { ok: true };
  const ip = getClientIP(req);
  if (isLocalIP(ip)) return { ok: true };

  const today = new Date().toDateString();
  let q = ipQuotaMap.get(ip);
  if (!q || q.date !== today) {
    q = { date: today, summarize: 0, quiz: 0, flashcards: 0, chat: 0 };
    ipQuotaMap.set(ip, q);
  }

  const limit = QUOTA_DAILY[action];
  if (q[action] >= limit) return { ok: false, used: q[action], limit, action };
  q[action]++;
  saveQuota();
  return { ok: true, used: q[action], limit };
}

function localOnly(req, res, next) {
  if (IS_PROD && !isLocalIP(getClientIP(req)))
    return res.status(403).json({ error: 'Fonctionnalité disponible uniquement en local.' });
  next();
}

// Nettoyage horaire : purge les IPs d'hier + sauvegarde
setInterval(() => {
  const today = new Date().toDateString();
  for (const [ip, q] of ipQuotaMap) if (q.date !== today) ipQuotaMap.delete(ip);
  saveQuota();
}, 3600000);

module.exports = { IS_PROD, LIMITS, QUOTA_DAILY, ipQuotaMap, getClientIP, isLocalIP, checkQuota, localOnly };

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { LIMITS } = require('../middleware/quota');
const { extractTextFromBuffer } = require('../services/text');
const { requireAuth } = require('../middleware/auth');
const { doubleCsrfProtection } = require('../middleware/csrf');

const MAX_TEXT_UPLOAD = 200000; // ~40 000 mots — couvre les cours très longs

const COURSE_EXTS = ['.pdf', '.ppt', '.pptx'];
const coursesDir  = path.join(__dirname, '..', 'courses');

// Limite upload par plan (en production)
const PLAN_FILE_LIMITS = {
  free: 5  * 1024 * 1024,
  pro:  10 * 1024 * 1024,
  max:  20 * 1024 * 1024,
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.ppt', '.pptx', '.docx'].includes(ext)) {
      cb(null, true);
    } else {
      req.fileTypeError = 'Seuls les fichiers PDF, PPT/PPTX et DOCX sont acceptés';
      cb(null, false);
    }
  },
  limits: { fileSize: LIMITS.fileSize }, // 20 Mo max global (= plan Max)
});


// Upload multiple files
router.post('/upload', requireAuth, doubleCsrfProtection, (req, res, next) => {
  upload.array('files', LIMITS.maxFiles)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (req.fileTypeError) return res.status(400).json({ error: req.fileTypeError });
    next();
  });
}, async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'Aucun fichier reçu' });

  // Vérification de la limite par plan (production uniquement)
  if (process.env.NODE_ENV === 'production') {
    const plan      = req.user?.plan || 'free';
    const planLimit = PLAN_FILE_LIMITS[plan] ?? PLAN_FILE_LIMITS.free;
    const tooLarge  = req.files.filter(f => f.size > planLimit);
    if (tooLarge.length) {
      const mb = Math.round(planLimit / 1024 / 1024);
      return res.status(400).json({
        error: `Fichier trop volumineux pour votre plan ${plan} (limite : ${mb} Mo). Passez à un plan supérieur pour uploader des fichiers plus grands.`,
      });
    }
  }
  const files = await Promise.all(req.files.map(async f => {
    let text = '';
    let truncated = false;
    let originalLength = 0;
    try {
      const raw = await extractTextFromBuffer(f.buffer, f.originalname);
      truncated = raw.length > MAX_TEXT_UPLOAD;
      text = truncated ? raw.slice(0, MAX_TEXT_UPLOAD) : raw;
      originalLength = raw.length;
    } catch (e) {}
    const id = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // multer lit les noms de fichiers UTF-8 en Latin-1 par défaut →
    // re-décoder les octets latin1 comme UTF-8 pour restaurer les accents
    let name = f.originalname;
    try { name = Buffer.from(f.originalname, 'latin1').toString('utf8'); } catch {}
    const fileResult = { id, name, size: f.size, text, truncated, originalLength };
    return fileResult;
  }));
  res.json({ success: true, files });
});

// Compteur d'utilisateurs en ligne
const onlineUsers    = new Map();
const ONLINE_TIMEOUT = 90000;

router.post('/ping', (req, res) => {
  const { clientId } = req.body;
  if (clientId) onlineUsers.set(clientId, Date.now());
  const cutoff = Date.now() - ONLINE_TIMEOUT;
  for (const [id, ts] of onlineUsers) if (ts < cutoff) onlineUsers.delete(id);
  res.json({ online: onlineUsers.size });
});

router.get('/users/count', (req, res) => {
  const cutoff = Date.now() - ONLINE_TIMEOUT;
  for (const [id, ts] of onlineUsers) if (ts < cutoff) onlineUsers.delete(id);
  res.json({ online: onlineUsers.size });
});

// GET /api/health — diagnostic rapide (no auth)
// En production, seul le statut est exposé pour éviter le fingerprinting.
router.get('/health', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.json({ status: 'ok' });
    }
    const { getAiConfig } = require('../services/aiConfig');
    const cfg = await getAiConfig().catch(e => ({ error: e.message }));
    res.json({
      status: 'ok',
      env: process.env.NODE_ENV || 'development',
      ai_config: cfg,
      providers_configured: {
        groq:      !!(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3),
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        mistral:   !!process.env.MISTRAL_API_KEY,
        deepseek:  !!process.env.DEEPSEEK_API_KEY,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;

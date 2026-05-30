const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { LIMITS } = require('../middleware/quota');
const { extractTextFromBuffer } = require('../services/text');

const MAX_TEXT_UPLOAD = 150000; // ~28 000 mots — couvre les cours longs sans couper silencieusement

const COURSE_EXTS = ['.pdf', '.ppt', '.pptx'];
const coursesDir  = path.join(__dirname, '..', 'courses');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.ppt', '.pptx', '.docx'].includes(ext)) {
      cb(null, true);
    } else {
      // cb(null, false) évite le ECONNRESET de multer ; on stocke l'erreur sur req
      req.fileTypeError = 'Seuls les fichiers PDF, PPT/PPTX et DOCX sont acceptés';
      cb(null, false);
    }
  },
  limits: { fileSize: LIMITS.fileSize }
});


// Upload multiple files
router.post('/upload', (req, res, next) => {
  upload.array('files', LIMITS.maxFiles)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (req.fileTypeError) return res.status(400).json({ error: req.fileTypeError });
    next();
  });
}, async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const files = await Promise.all(req.files.map(async f => {
    let text = '';
    try {
      const raw = await extractTextFromBuffer(f.buffer, f.originalname);
      const truncated = raw.length > MAX_TEXT_UPLOAD;
      text = truncated ? raw.slice(0, MAX_TEXT_UPLOAD) : raw;
      if (truncated) {
        // Faille 3 : avertir le client que le contenu a été tronqué
        Object.assign(fileResult, { truncated: true, originalLength: raw.length });
      }
    } catch (e) {}
    const id = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // multer lit les noms de fichiers UTF-8 en Latin-1 par défaut →
    // re-décoder les octets latin1 comme UTF-8 pour restaurer les accents
    let name = f.originalname;
    try { name = Buffer.from(f.originalname, 'latin1').toString('utf8'); } catch {}
    const fileResult = { id, name, size: f.size, text };
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
router.get('/health', async (req, res) => {
  try {
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

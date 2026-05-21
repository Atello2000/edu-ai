const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { IS_PROD, LIMITS, getQuotaStatus } = require('../middleware/quota');
const { requireAuth } = require('../middleware/auth');
const { extractText, extractTextFromBuffer } = require('../services/text');

const MAX_TEXT_UPLOAD = 80000;

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
      text = raw.slice(0, MAX_TEXT_UPLOAD);
    } catch (e) {}
    const id = Date.now() + '-' + Math.round(Math.random() * 1e9);
    return { id, name: f.originalname, size: f.size, text };
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

router.get('/quota', requireAuth, async (req, res) => {
  if (!IS_PROD) return res.json({ unlimited: true });
  const status = await getQuotaStatus(req);
  if (!status) return res.json({ unlimited: true });
  res.json({ unlimited: false, ...status });
});

module.exports = router;

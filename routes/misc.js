const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { IS_PROD, LIMITS, getQuotaStatus } = require('../middleware/quota');
const { requireAuth } = require('../middleware/auth');
const { extractText } = require('../services/text');

const MAX_TEXT_UPLOAD = 80000;

const COURSE_EXTS = ['.pdf', '.ppt', '.pptx'];
const uploadsDir  = path.join(__dirname, '..', 'uploads');
const coursesDir  = path.join(__dirname, '..', 'courses');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.pdf', '.ppt', '.pptx', '.docx'].includes(ext) ? ext : '';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + safeExt);
  }
});

const upload = multer({
  storage,
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

// Bibliothèque de cours permanents (2 niveaux : section → matière → fichiers)
router.get('/library', (req, res) => {
  if (!fs.existsSync(coursesDir)) return res.json({ sections: [] });

  function getFiles(dir, sectionName, subjectName) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => COURSE_EXTS.includes(path.extname(f).toLowerCase()))
      .map(f => ({
        id:      `lib__${sectionName}__${subjectName}__${f}`,
        name:    f,
        path:    path.join('courses', sectionName, subjectName, f),
        subject: subjectName,
        section: sectionName
      }));
  }

  const sections = [];
  for (const sEntry of fs.readdirSync(coursesDir, { withFileTypes: true })) {
    if (!sEntry.isDirectory()) continue;
    const subjects = [];
    for (const mEntry of fs.readdirSync(path.join(coursesDir, sEntry.name), { withFileTypes: true })) {
      if (!mEntry.isDirectory()) continue;
      subjects.push({
        name:  mEntry.name,
        files: getFiles(path.join(coursesDir, sEntry.name, mEntry.name), sEntry.name, mEntry.name)
      });
    }
    sections.push({ name: sEntry.name, subjects });
  }
  res.json({ sections });
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
      const raw = await extractText(f.path, f.originalname);
      text = raw.slice(0, MAX_TEXT_UPLOAD);
    } catch (e) {}
    return { id: f.filename, name: f.originalname, path: f.path, size: f.size, text };
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

router.get('/quota', requireAuth, (req, res) => {
  if (!IS_PROD) return res.json({ unlimited: true });
  const status = getQuotaStatus(req);
  if (!status) return res.json({ unlimited: true });
  res.json({ unlimited: false, ...status });
});

module.exports = router;

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { LIMITS } = require('../middleware/quota');
const { extractText } = require('../services/text');
const { requireAuth } = require('../middleware/auth');
const { doubleCsrfProtection } = require('../middleware/csrf');
const logger   = require('../services/logger');

const uploadsAbsDir = path.resolve(__dirname, '..', 'uploads');

function checkMagicBytes(filePath, ext) {
  try {
    const buf = Buffer.alloc(8);
    const fd  = fs.openSync(filePath, 'r');
    try { fs.readSync(fd, buf, 0, 8, 0); }
    finally { fs.closeSync(fd); }
    if (ext === '.pdf')                     return buf.slice(0, 4).toString() === '%PDF';
    if (ext === '.pptx' || ext === '.docx') return buf[0] === 0x50 && buf[1] === 0x4B; // ZIP/PK
    if (ext === '.ppt')                     return buf[0] === 0xD0 && buf[1] === 0xCF; // OLE2
    return false;
  } catch { return false; }
}

const MAX_TEXT_UPLOAD = 200000; // ~40 000 mots — couvre les cours très longs

const coursesDir = path.join(__dirname, '..', 'courses');

// Limite upload par plan (en production)
const PLAN_FILE_LIMITS = {
  free: 5  * 1024 * 1024,
  pro:  10 * 1024 * 1024,
  max:  20 * 1024 * 1024,
};

const upload = multer({
  dest: uploadsAbsDir + path.sep,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.ppt', '.pptx', '.docx'].includes(ext)) {
      cb(null, true);
    } else {
      req.fileTypeError = 'Seuls les fichiers PDF, PPT, PPTX et DOCX sont acceptés.';
      cb(null, false);
    }
  },
  limits: { fileSize: LIMITS.fileSize }, // 20 Mo max global (= plan Max)
});


// Upload multiple files
router.post('/upload', requireAuth, doubleCsrfProtection, (req, res, next) => {
  upload.array('files', LIMITS.maxFiles)(req, res, err => {
    if (err) {
      if (req.files) {
        req.files.forEach(f => {
          try { fs.unlinkSync(f.path); } catch (_) {}
        });
      }
      return res.status(400).json({ error: err.message });
    }
    if (req.fileTypeError) {
      if (req.files) {
        req.files.forEach(f => {
          try { fs.unlinkSync(f.path); } catch (_) {}
        });
      }
      return res.status(400).json({ error: req.fileTypeError });
    }
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
      // Clean up uploaded files before returning error
      req.files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch (_) {}
      });
      const mb = Math.round(planLimit / 1024 / 1024);
      return res.status(400).json({
        error: `Fichier trop volumineux pour votre plan ${plan} (limite : ${mb} Mo). Passez à un plan supérieur pour uploader des fichiers plus grands.`,
      });
    }
  }

  const files = [];
  const failedFiles = [];
  // Traitement séquentiel pour optimiser et aplatir l'usage de la mémoire RAM
  for (const f of req.files) {
    let text = '';
    let truncated = false;
    let originalLength = 0;
    try {
      // f.path est relatif (multer) → on le résout en absolu pour éviter
      // le rejet de sécurité dans extractText sur Railway (Linux)
      const absPath = path.resolve(f.path);
      const ext = path.extname(f.originalname).toLowerCase();
      if (!checkMagicBytes(absPath, ext)) {
        failedFiles.push({ name: f.originalname, reason: 'Format invalide (contenu ne correspond pas à l\'extension)' });
        continue;
      }
      const raw = await extractText(absPath, f.originalname);
      if (!raw || !raw.trim()) {
        failedFiles.push({
          name: f.originalname,
          reason: 'Aucun texte lisible extrait',
        });
        continue;
      }
      truncated = raw.length > MAX_TEXT_UPLOAD;
      text = truncated ? raw.slice(0, MAX_TEXT_UPLOAD) : raw;
      originalLength = raw.length;
    } catch (e) {
      logger.error('Failed to extract text from file', { file: f.originalname, error: e.message });
      failedFiles.push({
        name: f.originalname,
        reason: e.message || 'Extraction impossible',
      });
    } finally {
      // Nettoyage immédiat sur le disque
      const absPath = path.resolve(f.path);
      try {
        fs.unlinkSync(absPath);
      } catch (err) {
        logger.warn('Failed to delete temp file', { path: absPath, error: err.message });
      }
    }
    if (!text.trim()) continue;
    const id = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // multer lit les noms de fichiers UTF-8 en Latin-1 par défaut →
    // re-décoder les octets latin1 comme UTF-8 pour restaurer les accents
    let name = f.originalname;
    try { name = Buffer.from(f.originalname, 'latin1').toString('utf8'); } catch {}
    files.push({ id, name, size: f.size, text, truncated, originalLength });
  }

  if (!files.length) {
    const first = failedFiles[0];
    let hint;
    if (first?.reason === 'Aucun texte lisible extrait') {
      hint = 'Le fichier semble scanné (image), vide ou protégé. '
           + 'Utilisez un PDF avec texte sélectionnable, un DOCX, PPT ou PPTX. '
           + 'Si votre PDF est scanné, l\'OCR Mistral peut l\'analyser — vérifiez que MISTRAL_API_KEY est configuré sur le serveur.';
    } else if (first?.reason?.includes('Accès non autorisé')) {
      hint = 'Erreur interne de chemin de fichier. Contactez le support.';
      logger.error('Security path check failed during upload', { reason: first?.reason });
    } else {
      hint = `Détail : ${first?.reason || 'inconnu'}. Le fichier est peut-être corrompu ou protégé par un mot de passe.`;
    }
    return res.status(422).json({
      error: `Impossible d'extraire le texte du fichier. ${hint}`,
      files: failedFiles,
    });
  }

  res.json({ success: true, files, warnings: failedFiles });
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
        gemini:    !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        groq:      !!(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3),
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        mistral:   !!process.env.MISTRAL_API_KEY,
        deepseek:  !!process.env.DEEPSEEK_API_KEY,
        github:    !!process.env.GITHUB_TOKEN,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;

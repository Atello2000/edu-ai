require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const pdfParse = require('pdf-parse');
const officeParser = require('officeparser');

const { OpenAI } = require('openai');

// Limites selon l'environnement (production = Railway)
const IS_PROD = !!process.env.RAILWAY_ENVIRONMENT;

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// En production → Groq pour résumés/quiz/flashcards (gratuit)
// En local     → Claude pour tout
const groq = IS_PROD && process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function aiComplete(prompt, maxTokens = 3000) {
  if (groq) {
    const r = await groq.chat.completions.create({
      model: GROQ_MODEL, max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });
    return r.choices[0].message.content;
  }
  const r = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });
  return r.content[0].text;
}

async function* aiStream(prompt, maxTokens = 4096) {
  if (groq) {
    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL, max_tokens: maxTokens, stream: true,
      messages: [{ role: 'user', content: prompt }]
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) yield text;
    }
  } else {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6', max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
        yield event.delta.text;
    }
  }
}
const LIMITS = IS_PROD ? {
  fileSize:       20 * 1024 * 1024,  // 20 Mo
  maxFiles:       3,
  summaryChars:   50000,
  quizChars:      50000,
  quizMaxCount:   20,
  flashChars:     15000,
  flashMaxCount:  15,
  chatChars:      4000,
} : {
  fileSize:       50 * 1024 * 1024,  // 50 Mo
  maxFiles:       20,
  summaryChars:   60000,
  quizChars:      40000,
  quizMaxCount:   999,
  flashChars:     20000,
  flashMaxCount:  999,
  chatChars:      8000,
};

// ── Quota par IP (production uniquement) ─────────────────────────────────────
const QUOTA_DAILY = { summarize: 3, quiz: 10, flashcards: 10, chat: 10 };
const ipQuotaMap  = new Map(); // ip → { date, summarize, quiz, flashcards, chat }

function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : null) || req.socket?.remoteAddress || 'unknown';
}

function isLocalIP(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// Retourne true si l'action est autorisée et incrémente le compteur
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
  if (q[action] >= limit) {
    return { ok: false, used: q[action], limit, action };
  }
  q[action]++;
  return { ok: true, used: q[action], limit };
}

// Nettoyage nocturne des IPs obsolètes
setInterval(() => {
  const today = new Date().toDateString();
  for (const [ip, q] of ipQuotaMap) if (q.date !== today) ipQuotaMap.delete(ip);
}, 3600000); // toutes les heures

// Créer les dossiers nécessaires s'ils n'existent pas
['uploads', 'courses'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.ppt', '.pptx', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Seuls les fichiers PDF, PPT/PPTX et DOCX sont acceptés'));
  },
  limits: { fileSize: LIMITS.fileSize }
});

async function extractText(filePath, originalName) {
  const normalized = path.normalize(filePath);
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.pdf') {
    const buffer = fs.readFileSync(normalized);
    const data = await pdfParse(buffer);
    return data.text;
  } else {
    return new Promise((resolve, reject) => {
      officeParser.parseOffice(normalized, (data, err) => {
        if (err) reject(new Error(String(err)));
        else resolve(data);
      });
    });
  }
}

// Bibliothèque de cours permanents (2 niveaux : section → matière → fichiers)
app.get('/api/library', (req, res) => {
  const coursesDir = path.join(__dirname, 'courses');
  if (!fs.existsSync(coursesDir)) return res.json({ sections: [] });

  const EXTS = ['.pdf', '.ppt', '.pptx'];

  function getFiles(dir, sectionName, subjectName) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => EXTS.includes(path.extname(f).toLowerCase()))
      .map(f => ({
        id: `lib__${sectionName}__${subjectName}__${f}`,
        name: f,
        path: path.join('courses', sectionName, subjectName, f),
        subject: subjectName,
        section: sectionName
      }));
  }

  const sections = [];
  for (const sEntry of fs.readdirSync(coursesDir, { withFileTypes: true })) {
    if (!sEntry.isDirectory()) continue;
    const sectionPath = path.join(coursesDir, sEntry.name);
    const subjects = [];
    for (const mEntry of fs.readdirSync(sectionPath, { withFileTypes: true })) {
      if (!mEntry.isDirectory()) continue;
      const files = getFiles(path.join(sectionPath, mEntry.name), sEntry.name, mEntry.name);
      subjects.push({ name: mEntry.name, files });
    }
    sections.push({ name: sEntry.name, subjects });
  }
  res.json({ sections });
});

// Upload multiple files
app.post('/api/upload', (req, res, next) => {
  upload.array('files', LIMITS.maxFiles)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const files = req.files.map(f => ({
      id: f.filename,
      name: f.originalname,
      path: f.path,
      size: f.size
    }));
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Résumer avec streaming SSE
app.post('/api/summarize', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const quota = checkQuota(req, 'summarize');
  if (!quota.ok) {
    send({ type: 'error', message: `Quota journalier atteint (${quota.limit} résumés/jour). Revenez demain.` });
    res.end(); return;
  }

  try {
    const { files } = req.body;
    for (const file of files) {
      const text = await extractText(file.path, file.name);
      const truncated = text.slice(0, LIMITS.summaryChars);
      send({ type: 'start', name: file.name });

      const prompt = `Tu es un assistant pédagogique expert. Voici le contenu complet d'un cours intitulé **"${file.name}"**.

Produis un résumé pédagogique complet en français, structuré en Markdown, avec exactement ce plan :

## 🎯 Objectifs du cours
(2-3 phrases sur ce que l'étudiant va apprendre)

## 📌 Points clés
(liste des 5-8 idées essentielles à retenir, sous forme de bullets)

## 📖 Résumé détaillé
(développement structuré avec sous-titres si nécessaire, paragraphes clairs)

## 🔑 Concepts importants
(définitions brèves des termes ou notions fondamentales du cours)

## 💡 À retenir
(1 encadré blockquote avec la leçon principale en 2-3 phrases)

---
Contenu du cours :
${truncated}`;

      for await (const text of aiStream(prompt, 4096)) {
        send({ type: 'delta', name: file.name, text });
      }

      send({ type: 'done', name: file.name });
    }
    send({ type: 'end' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }
  res.end();
});

// Générer un test — traitement parallèle
app.post('/api/quiz', async (req, res) => {
  const quota = checkQuota(req, 'quiz');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} quiz/jour). Revenez demain.` });
  try {
    const { files, difficulty = 'moyen' } = req.body;
    const count = Math.min(parseInt(req.body.count) || 5, LIMITS.quizMaxCount);

    const results = await Promise.all(files.map(async file => {
      const text = await extractText(file.path, file.name);
      const truncated = text.slice(0, LIMITS.quizChars);

      const difficultyGuide = {
        facile:   'Privilégie les questions de définition et de reconnaissance (ex: "Qu\'est-ce que X ?").',
        moyen:    'Mélange questions de compréhension, d\'application et de comparaison.',
        difficile:'Privilégie les cas pratiques, nuances, erreurs courantes et raisonnements multi-étapes.',
      }[difficulty] || '';

      const questionTypes = `
Varie obligatoirement les types de questions parmi :
- Définition (ex: "Que signifie X ?")
- Application (ex: "Dans quel cas utilise-t-on X ?")
- Comparaison (ex: "Quelle est la différence entre X et Y ?")
- Vrai/faux déguisé (une seule option est vraie, les autres sont plausibles mais fausses)
- Cause/conséquence (ex: "Pourquoi X entraîne-t-il Y ?")
- Identification d'erreur (ex: "Laquelle de ces affirmations est incorrecte ?")
N'utilise pas deux fois le même type de question consécutivement.`;

      const rawQuiz = await aiComplete(`Génère ${count} questions QCM de niveau ${difficulty} en français basées sur ce cours "${file.name}".
${difficultyGuide}
${questionTypes}

Pour chaque question, donne exactement ce format JSON :
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "..."
    }
  ]
}

Contenu du cours :
${truncated}

Réponds UNIQUEMENT avec le JSON, sans texte autour.`, 3000);

      let quiz;
      try {
        const raw = rawQuiz.trim();
        const match = raw.match(/\{[\s\S]*\}/);
        quiz = JSON.parse(match ? match[0] : raw);
      } catch {
        quiz = { questions: [] };
      }

      return { name: file.name, quiz };
    }));

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Générer des flashcards — traitement parallèle
app.post('/api/flashcards', async (req, res) => {
  const quota = checkQuota(req, 'flashcards');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} flashcards/jour). Revenez demain.` });
  try {
    const { files } = req.body;
    const count = Math.min(parseInt(req.body.count) || 10, LIMITS.flashMaxCount);

    const results = await Promise.all(files.map(async file => {
      const text = await extractText(file.path, file.name);
      const truncated = text.slice(0, LIMITS.flashChars);

      const rawFlash = await aiComplete(`Tu es un assistant pédagogique. À partir du cours ci-dessous, génère ${count} flashcards en français pour aider à mémoriser les concepts essentiels.

Chaque flashcard doit avoir :
- Un RECTO : une question courte, un terme, ou un concept clé
- Un VERSO : la réponse claire et concise (2-4 phrases max)

Réponds UNIQUEMENT avec ce JSON, sans texte autour :
{
  "flashcards": [
    { "front": "...", "back": "..." }
  ]
}

Contenu du cours "${file.name}" :
${truncated}`, 2048);

      let data;
      try {
        const raw = rawFlash.trim();
        const match = raw.match(/\{[\s\S]*\}/);
        data = JSON.parse(match ? match[0] : raw);
      } catch {
        data = { flashcards: [] };
      }

      return { name: file.name, flashcards: data.flashcards || [] };
    }));

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat avec le cours
app.post('/api/chat', async (req, res) => {
  const quota = checkQuota(req, 'chat');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} messages/jour). Revenez demain.` });
  try {
    const { files, messages, attachedFile } = req.body;

    let context = '';
    for (const file of files) {
      const text = await extractText(file.path, file.name);
      context += `\n\n=== COURS : ${file.name} ===\n${text.slice(0, LIMITS.chatChars)}`;
    }

    let attachedContext = '';
    if (attachedFile) {
      const text = await extractText(attachedFile.path, attachedFile.name);
      attachedContext = `\n\n=== DOCUMENT SOUMIS PAR L'ÉTUDIANT : ${attachedFile.name} ===\n${text.slice(0, 12000)}`;
    }

    const systemPrompt = attachedFile
      ? `Tu es un assistant pédagogique expert. L'étudiant a joint un document (devoir, QCM, liste de questions, exercices…). Réponds à chaque question ou exercice de ce document en t'appuyant UNIQUEMENT sur les cours fournis. Structure ta réponse clairement (une section par question si possible), explique ton raisonnement, cite les notions du cours. Réponds toujours en français. Utilise du markdown (titres, gras, listes).

Cours de référence :${context}${attachedContext}`
      : `Tu es un assistant pédagogique expert et bienveillant. Tu réponds aux questions de l'étudiant uniquement à partir des cours fournis. Sois clair, concis et pédagogique. Réponds toujours en français. Utilise du markdown pour structurer tes réponses (listes, gras). Si la question sort du contexte des cours, dis-le poliment.

Cours disponibles :${context}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: attachedFile ? 3000 : 1024,
      system: systemPrompt,
      messages
    });
    res.json({ success: true, response: message.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
// ── Compteur d'utilisateurs en ligne ─────────────────────────────────────────
const onlineUsers = new Map(); // clientId → lastSeen timestamp
const ONLINE_TIMEOUT = 90000; // 90 secondes sans ping = hors ligne

app.post('/api/ping', (req, res) => {
  const { clientId } = req.body;
  if (clientId) onlineUsers.set(clientId, Date.now());
  // Nettoyer les clients inactifs
  const cutoff = Date.now() - ONLINE_TIMEOUT;
  for (const [id, ts] of onlineUsers) if (ts < cutoff) onlineUsers.delete(id);
  res.json({ online: onlineUsers.size });
});

app.get('/api/users/count', (req, res) => {
  const cutoff = Date.now() - ONLINE_TIMEOUT;
  for (const [id, ts] of onlineUsers) if (ts < cutoff) onlineUsers.delete(id);
  res.json({ online: onlineUsers.size });
});

// Gestionnaire d'erreurs global — toujours renvoyer du JSON
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

app.listen(PORT, () => console.log(`EDU AI démarré sur http://localhost:${PORT}`));

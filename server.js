require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const pdfParse = require('pdf-parse');
const officeParser = require('officeparser');

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Limites selon l'environnement (production = Railway)
const IS_PROD = !!process.env.RAILWAY_ENVIRONMENT;
const LIMITS = IS_PROD ? {
  fileSize:       10 * 1024 * 1024,  // 10 Mo
  maxFiles:       3,
  summaryChars:   30000,
  quizChars:      20000,
  quizMaxCount:   10,
  flashChars:     15000,
  flashMaxCount:  15,
  chatChars:      4000,
} : {
  fileSize:       20 * 1024 * 1024,  // 20 Mo
  maxFiles:       20,
  summaryChars:   60000,
  quizChars:      40000,
  quizMaxCount:   999,
  flashChars:     20000,
  flashMaxCount:  999,
  chatChars:      8000,
};

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
    const allowed = ['.pdf', '.ppt', '.pptx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Seuls les fichiers PDF et PPT/PPTX sont acceptés'));
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

  try {
    const { files } = req.body;
    for (const file of files) {
      const text = await extractText(file.path, file.name);
      const truncated = text.slice(0, LIMITS.summaryChars);
      send({ type: 'start', name: file.name });

      const stream = client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Tu es un assistant pédagogique expert. Voici le contenu complet d'un cours intitulé **"${file.name}"**.

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
${truncated}`
        }]
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          send({ type: 'delta', name: file.name, text: event.delta.text });
        }
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

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Génère ${count} questions QCM de niveau ${difficulty} en français basées sur ce cours "${file.name}".
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

Réponds UNIQUEMENT avec le JSON, sans texte autour.`
        }]
      });

      let quiz;
      try {
        const raw = message.content[0].text.trim();
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
  try {
    const { files } = req.body;
    const count = Math.min(parseInt(req.body.count) || 10, LIMITS.flashMaxCount);

    const results = await Promise.all(files.map(async file => {
      const text = await extractText(file.path, file.name);
      const truncated = text.slice(0, LIMITS.flashChars);

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Tu es un assistant pédagogique. À partir du cours ci-dessous, génère ${count} flashcards en français pour aider à mémoriser les concepts essentiels.

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
${truncated}`
        }]
      });

      let data;
      try {
        const raw = message.content[0].text.trim();
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

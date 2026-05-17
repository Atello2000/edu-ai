const express = require('express');
const router  = express.Router();
const { aiComplete, aiStream, aiChat, calcMaxTokens, MODEL_LABEL } = require('../services/ai');
const { extractText } = require('../services/text');
const { checkQuota, LIMITS } = require('../middleware/quota');

const VALID_LANGS = ['fr', 'en', 'ar'];
function langLabel(lang) {
  return { fr: 'en français', en: 'in English', ar: 'باللغة العربية' }[lang] || 'en français';
}

async function getFileText(file) {
  if (file.text) return file.text;
  if (!file.path) throw new Error(`Contenu du fichier "${file.name}" indisponible. Veuillez le re-charger.`);
  return extractText(file.path, file.name);
}

// ── Résumé (SSE streaming) ────────────────────────────────────────────────────
router.post('/summarize', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const quota = checkQuota(req, 'summarize');
  if (!quota.ok) {
    send({ type: 'error', message: `Quota journalier atteint (${quota.limit} résumés/jour). Revenez demain.` });
    return res.end();
  }

  try {
    const { files } = req.body;
    const lang = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang = langLabel(lang);
    let streamModel = MODEL_LABEL;

    for (const file of files) {
      const text     = await getFileText(file);
      const truncated = text.slice(0, LIMITS.summaryChars);
      send({ type: 'start', name: file.name });

      const cachedContent = `Contenu du cours "${file.name}" :\n${truncated}`;
      const prompt = `Tu es un assistant pédagogique expert. Produis un résumé pédagogique complet ${inLang}, structuré en Markdown, avec exactement ce plan :

## 🎯 Objectifs du cours
(2-3 phrases sur ce que l'étudiant va apprendre)

## 📌 Points clés
(liste des 5-8 idées essentielles à retenir, sous forme de bullets)

## 📖 Résumé détaillé
(développement structuré avec sous-titres si nécessaire, paragraphes clairs)

## 🔑 Concepts importants
(définitions brèves des termes ou notions fondamentales du cours)

## 💡 À retenir
(1 encadré blockquote avec la leçon principale en 2-3 phrases)`;

      for await (const chunk of aiStream(prompt, calcMaxTokens('summary', truncated.length), cachedContent)) {
        send({ type: 'delta', name: file.name, text: chunk.text });
        streamModel = chunk.model;
      }
      send({ type: 'done', name: file.name });
    }

    send({ type: 'model', name: streamModel });
    send({ type: 'end' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }
  res.end();
});

// ── Quiz (traitement parallèle) ───────────────────────────────────────────────
router.post('/quiz', async (req, res) => {
  const quota = checkQuota(req, 'quiz');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} quiz/jour). Revenez demain.` });

  try {
    const { files } = req.body;
    const lang       = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang     = langLabel(lang);
    const VALID_DIFF = ['facile', 'moyen', 'difficile'];
    const difficulty = VALID_DIFF.includes(req.body.difficulty) ? req.body.difficulty : 'moyen';
    const count      = Math.min(parseInt(req.body.count) || 5, LIMITS.quizMaxCount);

    const results = await Promise.all(files.map(async file => {
      const text      = await getFileText(file);
      if (!text.trim()) throw new Error(`Contenu de "${file.name}" vide ou indisponible. Rechargez le fichier.`);
      const truncated = text.slice(0, LIMITS.quizChars);

      const difficultyGuide = {
        facile:   "Privilégie les questions de définition et de reconnaissance (ex: \"Qu'est-ce que X ?\").",
        moyen:    "Mélange questions de compréhension, d'application et de comparaison.",
        difficile:"Privilégie les cas pratiques, nuances, erreurs courantes et raisonnements multi-étapes.",
      }[difficulty];

      const questionTypes = `
Varie obligatoirement les types de questions parmi :
- Définition (ex: "Que signifie X ?")
- Application (ex: "Dans quel cas utilise-t-on X ?")
- Comparaison (ex: "Quelle est la différence entre X et Y ?")
- Vrai/faux déguisé (une seule option est vraie, les autres sont plausibles mais fausses)
- Cause/conséquence (ex: "Pourquoi X entraîne-t-il Y ?")
- Identification d'erreur (ex: "Laquelle de ces affirmations est incorrecte ?")
N'utilise pas deux fois le même type de question consécutivement.`;

      const cachedContent = `Contenu du cours "${file.name}" :\n${truncated}`;
      const prompt = `Génère ${count} questions QCM de niveau ${difficulty} ${inLang} basées sur ce cours.
${difficultyGuide}
${questionTypes}

Pour chaque question, donne exactement ce format JSON :
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "Explique clairement pourquoi la bonne réponse est correcte.",
      "whyWrong": {
        "B": "Explique pourquoi cette option est fausse ou insuffisante.",
        "C": "Explique pourquoi cette option est fausse ou insuffisante.",
        "D": "Explique pourquoi cette option est fausse ou insuffisante."
      },
      "sourceHint": "Rappelle la notion ou le passage du cours à revoir, sans inventer de citation exacte."
    }
  ]
}

Dans "whyWrong", inclue aussi la lettre correcte si nécessaire avec une phrase courte du type "C'est la bonne réponse".
Les explications doivent être pédagogiques, concrètes et utiles pour réviser.

Réponds UNIQUEMENT avec le JSON, sans texte autour.`;

      const { text: rawQuizText, model: fileQuizModel } = await aiComplete(
        prompt, calcMaxTokens('quiz', truncated.length, count), cachedContent
      );

      let quiz;
      try {
        const raw   = rawQuizText.trim();
        const match = raw.match(/\{[\s\S]*\}/);
        quiz = JSON.parse(match ? match[0] : raw);
      } catch {
        quiz = { questions: [] };
      }

      return { name: file.name, quiz, _model: fileQuizModel };
    }));

    const quizModel = results[results.length - 1]?._model || MODEL_LABEL;
    results.forEach(r => delete r._model);
    res.json({ success: true, results, model: quizModel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fiche d'examen ────────────────────────────────────────────────────────────
router.post('/exam-sheet', async (req, res) => {
  const quota = checkQuota(req, 'summarize');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} fiches/jour). Revenez demain.` });

  try {
    const { files } = req.body;
    if (!files || !files.length) return res.status(400).json({ error: 'Aucun fichier sélectionné' });

    const lang   = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang = langLabel(lang);
    let context = '';
    for (const file of files.slice(0, 5)) {
      const text = await getFileText(file);
      context += `\n\n=== ${file.name} ===\n${text.slice(0, 18000)}`;
    }

    const { text, model } = await aiComplete(`Tu es un enseignant exigeant qui prépare une fiche d'examen ${inLang}.

À partir des cours fournis, produis une fiche de révision dense, claire et directement exploitable avant un contrôle.

Structure exactement la réponse en Markdown avec ces sections :

## Priorités de révision
Liste les notions à apprendre en premier, par ordre d'importance.

## Définitions à connaître
Tableau avec Terme | Définition courte | À ne pas confondre avec.

## Tableaux comparatifs
Ajoute les comparaisons utiles du cours. Si aucun tableau n'est pertinent, écris une synthèse en bullets.

## Pièges fréquents
Liste les erreurs probables, les confusions, les détails qui font perdre des points.

## Questions probables
Propose 8 à 12 questions d'examen, avec une réponse attendue concise.

## Mini plan de révision
Propose un plan sur 3 jours : quoi relire, quoi mémoriser, quoi tester.

Cours :
${context}`, 4200);

    res.json({ success: true, sheet: text, model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Flashcards (traitement parallèle) ────────────────────────────────────────
router.post('/flashcards', async (req, res) => {
  const quota = checkQuota(req, 'flashcards');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} flashcards/jour). Revenez demain.` });

  try {
    const { files } = req.body;
    const lang      = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang    = langLabel(lang);
    const count     = Math.min(parseInt(req.body.count) || 10, LIMITS.flashMaxCount);

    const results = await Promise.all(files.map(async file => {
      const text      = await getFileText(file);
      if (!text.trim()) throw new Error(`Contenu de "${file.name}" vide ou indisponible. Rechargez le fichier.`);
      const truncated = text.slice(0, LIMITS.flashChars);

      const cachedContent = `Contenu du cours "${file.name}" :\n${truncated}`;
      const prompt = `Tu es un assistant pédagogique. Génère ${count} flashcards ${inLang} pour aider à mémoriser les concepts essentiels.

Chaque flashcard doit avoir :
- Un RECTO : une question courte, un terme, ou un concept clé
- Un VERSO : la réponse claire et concise (2-4 phrases max)

Réponds UNIQUEMENT avec ce JSON, sans texte autour :
{
  "flashcards": [
    { "front": "...", "back": "..." }
  ]
}`;

      const { text: rawFlashText, model: fileFlashModel } = await aiComplete(
        prompt, calcMaxTokens('flash', truncated.length, count), cachedContent
      );

      let data;
      try {
        const raw   = rawFlashText.trim();
        const match = raw.match(/\{[\s\S]*\}/);
        data = JSON.parse(match ? match[0] : raw);
      } catch {
        data = { flashcards: [] };
      }

      return { name: file.name, flashcards: data.flashcards || [], _model: fileFlashModel };
    }));

    const flashModel = results[results.length - 1]?._model || MODEL_LABEL;
    results.forEach(r => delete r._model);
    res.json({ success: true, results, model: flashModel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chat avec le cours ────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const quota = checkQuota(req, 'chat');
  if (!quota.ok) return res.status(429).json({ error: `Quota journalier atteint (${quota.limit} messages/jour). Revenez demain.` });

  try {
    const { files, messages, attachedFile, attachedImage } = req.body;

    let context = '';
    for (const file of files) {
      const text = await getFileText(file);
      context += `\n\n=== COURS : ${file.name} ===\n${text.slice(0, LIMITS.chatChars)}`;
    }

    let attachedContext = '';
    if (attachedFile) {
      const text = await extractText(attachedFile.path, attachedFile.name);
      attachedContext = `\n\n=== DOCUMENT SOUMIS PAR L'ÉTUDIANT : ${attachedFile.name} ===\n${text.slice(0, 12000)}`;
    }

    const imageNote = attachedImage
      ? `\n\nL'étudiant a également joint une image. Analyse-la en lien avec les cours.`
      : '';

    const systemPrompt = attachedFile
      ? `Tu es un assistant pédagogique expert. L'étudiant a joint un document (devoir, QCM, liste de questions, exercices…). Réponds à chaque question ou exercice de ce document en t'appuyant UNIQUEMENT sur les cours fournis. Structure ta réponse clairement (une section par question si possible), explique ton raisonnement, cite les notions du cours. Réponds toujours en français. Utilise du markdown (titres, gras, listes).

Cours de référence :${context}${attachedContext}${imageNote}`
      : `Tu es un assistant pédagogique expert et bienveillant. Tu réponds aux questions de l'étudiant uniquement à partir des cours fournis. Sois clair, concis et pédagogique. Réponds toujours en français. Utilise du markdown pour structurer tes réponses (listes, gras). Si la question sort du contexte des cours, dis-le poliment.

Cours disponibles :${context}${imageNote}`;

    let finalMessages = messages.slice(-10);

    if (attachedImage && finalMessages.length > 0) {
      const last = finalMessages[finalMessages.length - 1];
      finalMessages[finalMessages.length - 1] = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: attachedImage.mimeType, data: attachedImage.base64 } },
          { type: 'text', text: typeof last.content === 'string' ? last.content : '' }
        ]
      };
    }

    const maxTok = attachedFile ? 3000 : attachedImage ? 2000 : 1024;
    const { text, model } = await aiChat(systemPrompt, finalMessages, maxTok, !!attachedImage);
    res.json({ success: true, response: text, model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

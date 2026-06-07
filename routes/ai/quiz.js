const express = require('express');
const router  = express.Router();
const { aiStream, calcMaxTokens, MODEL_LABEL } = require('../../services/ai');
const { getAiConfigForAction }                 = require('../../services/aiConfig');
const { LIMITS }                               = require('../../middleware/quota');
const { checkAndDeduct, refundJetons, JETON_COSTS } = require('../../services/jetons');
const { logTokens }                            = require('../../services/tokens');
const logger                                   = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse, sseSetup } = require('./helpers');
const { splitIntoChunks, chunkCost, chunkSizeFor } = require('../../services/chunker');

const VALID_DIFF = ['facile', 'moyen', 'difficile'];

// POST /api/quiz — génération de QCM par streaming SSE (avec chunking)
router.post('/quiz', async (req, res) => {
  const send = sseSetup(req, res);
  let deducted = 0; // jetons à rembourser si l'IA échoue après déduction

  try {
    const { files, focus_topics }  = req.body;
    const lang       = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang     = langLabel(lang);
    const difficulty = VALID_DIFF.includes(req.body.difficulty) ? req.body.difficulty : 'moyen';
    const count      = Math.min(parseInt(req.body.count) || 5, LIMITS.quizMaxCount);

    // Focus optionnel : si des topics sont fournis (prédicteur → quiz), on les met en avant
    const focusPart = Array.isArray(focus_topics) && focus_topics.length
      ? `\nFocus OBLIGATOIRE sur ces concepts détectés comme probables à l'examen : ${focus_topics.slice(0, 8).map(t => String(t).slice(0, 150)).join(', ')}.`
      : '';

    const aiCfg      = await getAiConfigForAction('quiz');
    const cSize      = chunkSizeFor(aiCfg.provider);

    // ── 1. Charger textes + calculer coût total ───────────────────────────
    const fileData  = [];
    let   totalCost = 0;

    for (const file of files) {
      const text = await getFileText(file);
      if (!text.trim()) {
        send({ type: 'file_error', name: file.name, message: `Contenu de "${file.name}" vide ou indisponible.` });
        continue;
      }
      const chunks = splitIntoChunks(text, cSize);
      totalCost += chunkCost(JETON_COSTS.quiz, chunks.length);
      fileData.push({ file, chunks });
    }

    if (!fileData.length) { send({ type: 'end' }); return res.end(); }

    // ── 2. Vérifier et déduire les jetons ─────────────────────────────────
    const jeton = await checkAndDeduct(req.user?.id, 'quiz', req.user?.plan || 'free', totalCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    deducted = jeton.cost || 0;

    // ── 3. Traiter chaque fichier ──────────────────────────────────────────
    const allResults  = [];
    let   streamModel = MODEL_LABEL;

    const difficultyGuide = {
      facile:    "Privilégie les questions de définition et de reconnaissance (ex: \"Qu'est-ce que X ?\").",
      moyen:     "Mélange questions de compréhension, d'application et de comparaison.",
      difficile: "Privilégie les cas pratiques, nuances, erreurs courantes et raisonnements multi-étapes.",
    }[difficulty];

    const CHUNK_PARALLEL = aiCfg.provider === 'gemini' ? 1 : 3;

    for (const { file, chunks } of fileData) {
      send({ type: 'start', name: file.name });

      const allQuestions = new Array(chunks.length);
      const perChunk = Math.ceil(count / chunks.length);

      // Chunks traités en parallèle (CHUNK_PARALLEL simultanés)
      for (let i = 0; i < chunks.length; i += CHUNK_PARALLEL) {
        await Promise.all(
          chunks.slice(i, i + CHUNK_PARALLEL).map(async (chunk, j) => {
            const idx = i + j;
            if (chunks.length > 1) {
              send({ type: 'progress', name: file.name, step: idx + 1, total: chunks.length,
                     message: `${idx + 1}/${chunks.length} parties…` });
            }

            const chunkLabel    = chunks.length > 1 ? ` (partie ${idx + 1}/${chunks.length})` : '';
            const questionTypes = `
Varie obligatoirement les types de questions parmi :
- Définition (ex: "Que signifie X ?")
- Application (ex: "Dans quel cas utilise-t-on X ?")
- Comparaison (ex: "Quelle est la différence entre X et Y ?")
- Vrai/faux déguisé (une seule option est vraie, les autres sont plausibles mais fausses)
- Cause/conséquence (ex: "Pourquoi X entraîne-t-il Y ?")
- Identification d'erreur (ex: "Laquelle de ces affirmations est incorrecte ?")
N'utilise pas deux fois le même type de question consécutivement.`;

            const prompt = `${userContext(req.user)}Génère ${perChunk} questions QCM de niveau ${difficulty} ${inLang} basées sur ce contenu de cours${chunkLabel}.${focusPart}
${difficultyGuide}
${questionTypes}

Pour chaque question, donne exactement ce format JSON :
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "1-2 phrases max : pourquoi la bonne réponse est correcte.",
      "whyWrong": {
        "B": "Erreur en 10 mots max.",
        "C": "Erreur en 10 mots max.",
        "D": "Erreur en 10 mots max."
      },
      "sourceHint": "Notion clé à revoir (5-8 mots)."
    }
  ]
}

Règles :
- Les distracteurs doivent être plausibles mais incorrects si on maîtrise le cours.
- whyWrong doit contenir une entrée pour chaque mauvaise option (toutes sauf answer).
- Sois très concis : chaque question complète doit tenir en 150 mots max.
- Réponds UNIQUEMENT avec le JSON, sans texte autour.

---
Contenu du cours "${file.name}"${chunkLabel} :
${chunk}`;

            let raw = '';
            for await (const c of aiStream(prompt, calcMaxTokens('quiz', chunk.length, perChunk), aiCfg)) {
              if (c.usage) { logTokens(req.user?.id, 'quiz', c.usage.provider, c.usage.input, c.usage.output); continue; }
              raw += c.text;
              streamModel = c.model;
            }

            let parsed = parseJsonResponse(raw, { questions: [] });

            if (!parsed.questions?.length) {
              logger.warn('Quiz: 0 questions parsed, retrying with simple prompt', { file: file.name });
              const simplePrompt = `Génère ${perChunk} QCM ${inLang} sur ce cours.${focusPart}
JSON strict, sans texte autour :
{"questions":[{"question":"?","options":["A. ","B. ","C. ","D. "],"answer":"A","explanation":""}]}

Cours :
${chunk.slice(0, 12000)}`;
              let rawRetry = '';
              for await (const c of aiStream(simplePrompt, calcMaxTokens('quiz', 0, perChunk), aiCfg)) {
                if (c.usage) continue;
                rawRetry += c.text;
                streamModel = c.model;
              }
              parsed = parseJsonResponse(rawRetry, { questions: [] });
            }

            allQuestions[idx] = parsed.questions || [];
          })
        );
      }

      // Aplatir en préservant l'ordre des chunks

      const finalQuestions = allQuestions.flat().slice(0, count);
      const result = { name: file.name, quiz: { questions: finalQuestions } };
      allResults.push(result);
      send({ type: 'done', name: file.name, questions: finalQuestions });
    }

    // Faille 4 : si AUCUNE question générée sur l'ensemble des fichiers → rembourser
    const totalGenerated = allResults.reduce((n, r) => n + r.quiz.questions.length, 0);
    if (totalGenerated === 0) {
      throw new Error('Aucune question n\'a pu être générée. Vérifiez le contenu du fichier et réessayez.');
    }

    send({ type: 'end', model: streamModel, results: allResults });

  } catch (err) {
    logger.error('AI quiz error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'quiz', deducted);
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

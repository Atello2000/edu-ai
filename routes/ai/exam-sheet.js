const express = require('express');
const router  = express.Router();
const { aiStream, aiComplete, MODEL_LABEL } = require('../../services/ai');
const { getAiConfigForAction }   = require('../../services/aiConfig');
const { checkAndDeduct, JETON_COSTS } = require('../../services/jetons');
const { logTokens }              = require('../../services/tokens');
const logger                     = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText } = require('./helpers');
const { splitIntoChunks, chunkCost, chunkSizeFor } = require('../../services/chunker');

const EXAM_MAX_FILES  = 5;
const EXAM_MAX_TOKENS = 4200;

// POST /api/exam-sheet — fiche de révision dense en streaming SSE (avec chunking)
router.post('/exam-sheet', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = data => { res.write(`data: ${JSON.stringify(data)}\n\n`); res.flush?.(); };

  try {
    const { files } = req.body;
    if (!files?.length) {
      send({ type: 'error', message: 'Aucun fichier sélectionné' });
      return res.end();
    }

    const lang   = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang = langLabel(lang);
    const ctx    = userContext(req.user);
    const aiCfg  = await getAiConfigForAction('exam-sheet');
    const cSize  = chunkSizeFor(aiCfg.provider); // 30K pour Groq, 80K sinon

    // ── 1. Charger textes + calculer coût total ───────────────────────────
    const fileData  = [];
    let   totalCost = 0;

    for (const file of files.slice(0, EXAM_MAX_FILES)) {
      const text   = await getFileText(file);
      const chunks = splitIntoChunks(text, cSize);
      totalCost += chunkCost(JETON_COSTS['exam-sheet'], chunks.length);
      fileData.push({ file, chunks });
    }

    // ── 2. Vérifier et déduire les jetons ─────────────────────────────────
    const jeton = await checkAndDeduct(req.user?.id, 'exam-sheet', req.user?.plan || 'free', totalCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }

    // ── 3. Construire le contexte (avec chunking si nécessaire) ───────────
    // Pour la fiche d'examen, on collecte les extraits de TOUS les fichiers
    // puis on génère une fiche unique qui couvre l'ensemble.

    let context       = '';
    let hasMultiChunk = false;

    for (const { file, chunks } of fileData) {
      if (chunks.length === 1) {
        context += `\n\n=== ${file.name} ===\n${chunks[0]}`;
      } else {
        // Fichier long : résumés partiels → contexte condensé
        hasMultiChunk = true;
        const partials = [];
        for (let i = 0; i < chunks.length; i++) {
          send({ type: 'progress', step: i + 1, total: chunks.length,
                 message: `${file.name} — partie ${i + 1}/${chunks.length}…` });

          const { text: partial, usage } = await aiComplete(
            `Voici la partie ${i + 1}/${chunks.length} du cours "${file.name}".
Extrais les points essentiels : définitions, notions clés, formules, exemples importants.
Sois concis (max 200 mots), bullets sans introduction.

${chunks[i]}`,
            800, aiCfg,
          );
          if (usage) logTokens(req.user?.id, 'exam-sheet', usage.provider, usage.input, usage.output);
          partials.push(partial);
        }
        context += `\n\n=== ${file.name} (synthèse de ${chunks.length} parties) ===\n${partials.join('\n\n')}`;
      }
    }

    // ── 4. Générer et streamer la fiche d'examen ──────────────────────────
    if (hasMultiChunk) {
      send({ type: 'progress', step: 0, total: 0, message: 'Génération de la fiche…' });
    }

    const prompt = `${ctx}Tu es un enseignant exigeant qui prépare une fiche d'examen ${inLang}.

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
${context}`;

    let streamModel = MODEL_LABEL;
    for await (const chunk of aiStream(prompt, EXAM_MAX_TOKENS, aiCfg)) {
      if (chunk.usage) {
        logTokens(req.user?.id, 'exam-sheet', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
        continue;
      }
      send({ type: 'delta', text: chunk.text });
      streamModel = chunk.model;
    }

    send({ type: 'end', model: streamModel });

  } catch (err) {
    logger.error('AI exam-sheet error', { userId: req.user?.id, message: err.message });
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

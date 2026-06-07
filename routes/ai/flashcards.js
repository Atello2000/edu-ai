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

// POST /api/flashcards — génération de flashcards par streaming SSE (avec chunking)
router.post('/flashcards', async (req, res) => {
  const send = sseSetup(req, res);
  let deducted = 0; // jetons à rembourser si l'IA échoue après déduction

  try {
    const { files } = req.body;
    const lang      = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang    = langLabel(lang);
    const count     = Math.min(parseInt(req.body.count) || 10, LIMITS.flashMaxCount);

    const aiCfg       = await getAiConfigForAction('flashcards');
    const cSize       = chunkSizeFor(aiCfg.provider);

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
      totalCost += chunkCost(JETON_COSTS.flashcards, chunks.length);
      fileData.push({ file, chunks });
    }

    if (!fileData.length) { send({ type: 'end' }); return res.end(); }

    // ── 2. Vérifier et déduire les jetons ─────────────────────────────────
    const jeton = await checkAndDeduct(req.user?.id, 'flashcards', req.user?.plan || 'free', totalCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    deducted = jeton.cost || 0;

    // ── 3. Traiter chaque fichier ──────────────────────────────────────────
    const allResults  = [];
    let   streamModel = MODEL_LABEL;

    for (const { file, chunks } of fileData) {
      send({ type: 'start', name: file.name });

      const allCards = new Array(chunks.length);
      // Distribuer les cartes entre les chunks
      const perChunk = Math.ceil(count / chunks.length);
      const CHUNK_PARALLEL = aiCfg.provider === 'gemini' ? 1 : 3;

      for (let i = 0; i < chunks.length; i += CHUNK_PARALLEL) {
        await Promise.all(
          chunks.slice(i, i + CHUNK_PARALLEL).map(async (chunk, j) => {
            const idx = i + j;
            if (chunks.length > 1) {
              send({ type: 'progress', name: file.name, step: idx + 1, total: chunks.length,
                     message: `Partie ${idx + 1}/${chunks.length}…` });
            }

            const chunkLabel = chunks.length > 1 ? ` (partie ${idx + 1}/${chunks.length})` : '';

            const prompt = `${userContext(req.user)}Tu es un assistant pédagogique. Génère ${perChunk} flashcards ${inLang} pour aider à mémoriser les concepts essentiels de ce contenu de cours${chunkLabel}.

Chaque flashcard doit avoir :
- Un RECTO : une question courte, un terme, ou un concept clé
- Un VERSO : la réponse claire et concise (2-4 phrases max)

Réponds UNIQUEMENT avec ce JSON, sans texte autour :
{
  "flashcards": [
    { "front": "...", "back": "..." }
  ]
}

---
Contenu du cours "${file.name}"${chunkLabel} :
${chunk}`;

            let raw = '';
            for await (const c of aiStream(prompt, calcMaxTokens('flash', chunk.length, perChunk), aiCfg)) {
              if (c.usage) { logTokens(req.user?.id, 'flashcards', c.usage.provider, c.usage.input, c.usage.output); continue; }
              raw += c.text;
              streamModel = c.model;
            }

            const parsed = parseJsonResponse(raw, { flashcards: [] });
            allCards[idx] = parsed.flashcards || [];
          })
        );
      }

      // Trimmer au nombre demandé
      const cards  = allCards.flat().slice(0, count);
      const result = { name: file.name, flashcards: cards };
      allResults.push(result);
      send({ type: 'done', name: file.name, cards });
    }

    // Vérifier qu'au moins une carte a été générée (comme quiz.js)
    const totalGenerated = allResults.reduce((n, r) => n + r.flashcards.length, 0);
    if (totalGenerated === 0) {
      throw new Error('Aucune flashcard n\'a pu être générée. Vérifiez le contenu du fichier et réessayez.');
    }

    send({ type: 'end', model: streamModel, results: allResults });

  } catch (err) {
    logger.error('AI flashcards error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'flashcards', deducted);
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

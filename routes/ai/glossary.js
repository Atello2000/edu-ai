const express = require('express');
const router  = express.Router();
const { aiComplete }           = require('../../services/ai');
const { getAiConfigForAction } = require('../../services/aiConfig');
const { checkAndDeduct, refundJetons, JETON_COSTS } = require('../../services/jetons');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse, sseSetup, clientErrorMessage } = require('./helpers');
const { splitIntoChunks, chunkCost } = require('../../services/chunker');
const { summarizeCacheKey, getCached } = require('../../services/summaryCache');
const { deriveGlossaryFromSummary } = require('../../services/derive');

const GLOSSARY_MAX_TOKENS = 4500;

// POST /api/glossary — extraction de termes avec chunking + SSE streaming
router.post('/glossary', async (req, res) => {
  const send = sseSetup(req, res);
  let deducted = 0;

  try {
    const { files } = req.body;
    if (!files?.length) {
      send({ type: 'error', message: 'Aucun fichier fourni.' });
      return res.end();
    }

    const lang   = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang = langLabel(lang);
    const ctx    = userContext(req.user);

    // ── 0. Dérivation locale (0 appel IA) si TOUS les fichiers sont déjà résumés ──
    // La section "Concepts importants" du résumé fournit déjà term + définition.
    // Le résumé a déjà été payé : cette dérivation locale ne coûte aucun jeton.
    if (!req.body.force) {
      const derived = [];
      let allDerivable = true;
      for (const file of files) {
        const text    = await getFileText(file);
        const summary = await getCached(summarizeCacheKey(text, lang, req.user));
        const terms   = summary ? deriveGlossaryFromSummary(summary) : null;
        if (!terms) { allDerivable = false; break; }
        derived.push(...terms);
      }
      if (allDerivable && derived.length) {
        const seen  = new Set();
        const terms = derived
          .filter(t => {
            const key = t.term.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => a.term.localeCompare(b.term, 'fr', { sensitivity: 'base' }));
        send({ type: 'end', terms, derived: true, cost: 0 });
        return res.end();
      }
    }

    // ── 1. Charger textes + calculer coût total ───────────────────────────
    const fileData  = [];
    let   totalCost = 0;

    for (const file of files) {
      const text   = await getFileText(file);
      const chunks = splitIntoChunks(text);
      totalCost += chunkCost(JETON_COSTS.glossary, chunks.length);
      fileData.push({ file, chunks });
    }

    // ── 2. Vérifier et déduire les jetons ─────────────────────────────────
    const jeton = await checkAndDeduct(req.user?.id, 'glossary', req.user?.plan || 'free', totalCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    deducted = jeton.cost || 0;

    // ── 3. Extraire les termes chunk par chunk (avec progression SSE) ─────
    const aiCfg    = await getAiConfigForAction('glossary');
    const allTerms = [];
    let   total    = fileData.reduce((n, { chunks }) => n + chunks.length, 0);
    let   step     = 0;

    for (const { file, chunks } of fileData) {
      for (let i = 0; i < chunks.length; i++) {
        step++;
        const chunkLabel = chunks.length > 1 ? ` (partie ${i + 1}/${chunks.length})` : '';
        send({ type: 'progress', step, total,
               message: `${file.name}${chunkLabel} — extraction des termes…` });

        const prompt = `${ctx}Tu es un assistant pédagogique expert. Extrais les termes techniques et concepts clés de ce contenu de cours${chunkLabel} ${inLang}.

Pour chaque terme :
- "term" : le nom exact du concept (court, précis)
- "definition" : explication claire en 1-2 phrases, accessible à un étudiant
- "category" : domaine/thème auquel appartient le terme (1-3 mots, ex: "Statistiques", "Droit civil")

Consignes :
- Vise 10 à 20 termes selon la richesse du contenu
- Prioritise les termes spécifiques au domaine, les acronymes définis et les notions clés
- Évite les termes trop généraux ("cours", "chapitre", "exemple")
- Réponds UNIQUEMENT avec le JSON, sans texte autour

{
  "terms": [
    { "term": "...", "definition": "...", "category": "..." }
  ]
}

---
${file.name}${chunkLabel} :
${chunks[i]}`;

        const { text: raw, usage } = await aiComplete(prompt, GLOSSARY_MAX_TOKENS, aiCfg);
        if (usage) logTokens(req.user?.id, 'glossary', usage.provider, usage.input, usage.output);

        const parsed = parseJsonResponse(raw, { terms: [] });
        const newTerms = parsed.terms || [];
        allTerms.push(...newTerms);

        // Émettre les termes de ce chunk dès qu'ils sont prêts
        if (newTerms.length > 0) {
          send({ type: 'terms_chunk', terms: newTerms });
        }
      }
    }

    // ── 4. Dédupliquer + trier ────────────────────────────────────────────
    const seen  = new Set();
    const terms = allTerms
      .filter(t => {
        if (!t.term || !t.definition) return false;
        const key = t.term.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.term.localeCompare(b.term, 'fr', { sensitivity: 'base' }));

    send({ type: 'end', terms });

  } catch (err) {
    logger.error('AI glossary error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'glossary', deducted);
    send({ type: 'error', message: clientErrorMessage(err) });
  }
  res.end();
});

module.exports = router;

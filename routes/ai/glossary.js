const express = require('express');
const router  = express.Router();
const { aiComplete }           = require('../../services/ai');
const { getAiConfigForAction } = require('../../services/aiConfig');
const { checkAndDeduct, refundJetons, JETON_COSTS } = require('../../services/jetons');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse } = require('./helpers');
const { splitIntoChunks, chunkCost } = require('../../services/chunker');

const GLOSSARY_MAX_TOKENS = 3000;

// POST /api/glossary — extraction de termes avec chunking
router.post('/glossary', async (req, res) => {
  let deducted = 0; // jetons à rembourser si l'IA échoue après déduction
  try {
    const { files } = req.body;
    if (!files?.length)
      return res.status(400).json({ error: 'Aucun fichier fourni.' });

    const lang   = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang = langLabel(lang);
    const ctx    = userContext(req.user);

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
    if (!jeton.ok)
      return res.status(402).json({ error: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
    deducted = jeton.cost || 0;

    // ── 3. Extraire les termes de chaque chunk ────────────────────────────
    const aiCfg    = await getAiConfigForAction('glossary');
    const allTerms = [];

    for (const { file, chunks } of fileData) {
      for (let i = 0; i < chunks.length; i++) {
        const chunkLabel = chunks.length > 1 ? ` (partie ${i + 1}/${chunks.length})` : '';

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
        allTerms.push(...(parsed.terms || []));
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

    res.json({ terms });

  } catch (err) {
    logger.error('AI glossary error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'glossary', deducted);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

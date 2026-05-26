const express = require('express');
const router  = express.Router();
const { aiComplete }        = require('../../services/ai');
const { getJsonAiConfig }   = require('../../services/aiConfig');
const { LIMITS }             = require('../../middleware/quota');
const { checkAndDeduct }     = require('../../services/jetons');
const { logTokens }         = require('../../services/tokens');
const logger                = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse } = require('./helpers');

const GLOSSARY_MAX_CHARS   = 60000;
const GLOSSARY_MAX_TOKENS  = 3000;

// POST /api/glossary
router.post('/glossary', async (req, res) => {
  const jeton = await checkAndDeduct(req.user?.id, 'glossary', req.user?.plan || 'free');
  if (!jeton.ok)
    return res.status(402).json({ error: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });

  try {
    const { files } = req.body;
    if (!files?.length)
      return res.status(400).json({ error: 'Aucun fichier fourni.' });

    const lang   = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang = langLabel(lang);
    const ctx    = userContext(req.user);

    let context = '';
    for (const file of files) {
      const text = await getFileText(file);
      context += `\n\n=== ${file.name} ===\n${text.slice(0, GLOSSARY_MAX_CHARS)}`;
    }

    const prompt = `${ctx}Tu es un assistant pédagogique expert. Extrais les termes techniques et concepts clés de ces cours ${inLang}.

Pour chaque terme :
- "term" : le nom exact du concept (court, précis)
- "definition" : explication claire en 1-2 phrases, accessible à un étudiant
- "category" : domaine/thème auquel appartient le terme (1-3 mots, ex: "Statistiques", "Droit civil")

Consignes :
- Vise 15 à 30 termes selon la richesse du cours
- Prioritise les termes spécifiques au domaine, les acronymes définis et les notions clés
- Évite les termes trop généraux ("cours", "chapitre", "exemple")
- Réponds UNIQUEMENT avec le JSON, sans texte autour

{
  "terms": [
    { "term": "...", "definition": "...", "category": "..." }
  ]
}

---
${context}`;

    const aiCfg = await getJsonAiConfig();
    const { text: raw, usage } = await aiComplete(prompt, GLOSSARY_MAX_TOKENS, aiCfg);

    if (usage) logTokens(req.user?.id, 'summarize', usage.provider, usage.input, usage.output);

    const parsed = parseJsonResponse(raw, { terms: [] });
    const terms  = (parsed.terms || [])
      .filter(t => t.term && t.definition)
      .sort((a, b) => a.term.localeCompare(b.term, 'fr', { sensitivity: 'base' }));

    res.json({ terms });
  } catch (err) {
    logger.error('AI glossary error', { userId: req.user?.id, message: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

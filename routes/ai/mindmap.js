const express = require('express');
const router  = express.Router();
const { aiComplete } = require('../../services/ai');
const { getAiConfigForAction }  = require('../../services/aiConfig');
const { checkAndDeduct, JETON_COSTS } = require('../../services/jetons');
const { logTokens }             = require('../../services/tokens');
const logger                    = require('../../services/logger');
const { userContext, getFileText } = require('./helpers');
const { splitIntoChunks, chunkCost } = require('../../services/chunker');

// POST /api/mindmap — génère un markdown hiérarchique pour markmap (avec chunking)
router.post('/mindmap', async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'Fichier manquant' });

    const text   = await getFileText(file);
    const chunks = splitIntoChunks(text);
    const cost   = chunkCost(JETON_COSTS.mindmap, chunks.length);

    const jeton = await checkAndDeduct(req.user?.id, 'mindmap', req.user?.plan || 'free', cost);
    if (!jeton.ok)
      return res.status(402).json({ error: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });

    const aiCfg = await getAiConfigForAction('mindmap');
    const ctx   = userContext(req.user);
    let   md    = '';

    if (chunks.length === 1) {
      // ── Fichier court : génération directe ────────────────────────────
      const { text: result, usage } = await aiComplete(promptMindmap(ctx, file.name, chunks[0]), 1200, aiCfg);
      if (usage) logTokens(req.user?.id, 'mindmap', usage.provider, usage.input, usage.output);
      md = result.trim();

    } else {
      // ── Fichier long : résumés partiels → mindmap fusionné ────────────
      const partials = [];
      for (let i = 0; i < chunks.length; i++) {
        const { text: partial, usage } = await aiComplete(
          promptPartial(ctx, file.name, chunks[i], i + 1, chunks.length),
          800,
          aiCfg,
        );
        if (usage) logTokens(req.user?.id, 'mindmap', usage.provider, usage.input, usage.output);
        partials.push(partial);
      }
      const combined = partials
        .map((p, i) => `--- Partie ${i + 1}/${partials.length} ---\n${p}`)
        .join('\n\n');

      const { text: result, usage } = await aiComplete(
        promptMindmapFromSummary(ctx, file.name, combined, partials.length),
        1200,
        aiCfg,
      );
      if (usage) logTokens(req.user?.id, 'mindmap', usage.provider, usage.input, usage.output);
      md = result.trim();
    }

    res.json({ markdown: md });

  } catch (err) {
    logger.error('AI mindmap error', { userId: req.user?.id, message: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers de prompt ──────────────────────────────────────────────────────────

function promptMindmap(ctx, name, text) {
  return `${ctx}Tu dois générer une carte mentale structurée du cours ci-dessous.

RÈGLES STRICTES :
- Réponds uniquement avec du Markdown pur, aucun texte avant ou après
- Structure en 3 niveaux maximum : ## grandes thématiques → ### sous-concepts → - points clés
- Les labels doivent être courts (3-7 mots max), jamais des phrases entières
- 4 à 7 branches principales (##), 2 à 5 sous-branches (###) par thématique
- Pas d'émojis, pas de gras/italique, pas de numérotation
- Pas de section "Introduction" ou "Conclusion" générique

FORMAT ATTENDU :
## Thématique 1
### Sous-concept A
- Point clé 1
- Point clé 2
## Thématique 2
### Sous-concept B
- Point clé 3

---
Cours "${name}" :
${text}`;
}

function promptPartial(ctx, name, text, part, total) {
  return `${ctx}Voici la partie ${part}/${total} du cours "${name}".
Liste les thématiques et concepts clés de CETTE PARTIE UNIQUEMENT, organisés par thème (3-6 mots par point). Max 150 mots.

Partie ${part}/${total} :
${text}`;
}

function promptMindmapFromSummary(ctx, name, combined, numParts) {
  return `${ctx}À partir des notes extraites des ${numParts} parties du cours "${name}", génère une carte mentale complète.

RÈGLES STRICTES :
- Réponds uniquement avec du Markdown pur, aucun texte avant ou après
- Structure en 3 niveaux : ## grandes thématiques → ### sous-concepts → - points clés
- Labels courts (3-7 mots max)
- 4 à 7 branches principales (##), 2 à 5 sous-branches par thématique
- Pas d'émojis, pas de gras/italique, pas de numérotation
- Regroupe les thèmes similaires de toutes les parties

---
Notes du cours "${name}" :
${combined}`;
}

module.exports = router;

const express = require('express');
const router  = express.Router();
const { aiComplete } = require('../../services/ai');
const { getAiConfigForAction }  = require('../../services/aiConfig');
const { checkAndDeduct, refundJetons, JETON_COSTS } = require('../../services/jetons');
const { logTokens }             = require('../../services/tokens');
const logger                    = require('../../services/logger');
const { userContext, getFileText, clientErrorMessage } = require('./helpers');
const { splitIntoChunks, chunkCost } = require('../../services/chunker');

// POST /api/mindmap — génère un markdown hiérarchique pour markmap (avec chunking)
router.post('/mindmap', async (req, res) => {
  let deducted = 0; // jetons à rembourser si l'IA échoue après déduction
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'Fichier manquant' });

    const text   = await getFileText(file);
    const chunks = splitIntoChunks(text);
    const cost   = chunkCost(JETON_COSTS.mindmap, chunks.length);

    const jeton = await checkAndDeduct(req.user?.id, 'mindmap', req.user?.plan || 'free', cost);
    if (!jeton.ok)
      return res.status(402).json({ error: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
    deducted = jeton.cost || 0;

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
        1800,
        aiCfg,
      );
      if (usage) logTokens(req.user?.id, 'mindmap', usage.provider, usage.input, usage.output);
      md = result.trim();
    }

    res.json({ markdown: md });

  } catch (err) {
    logger.error('AI mindmap error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'mindmap', deducted);
    res.status(500).json({ error: clientErrorMessage(err) });
  }
});

// POST /api/mindmap/extend — approfondit un nœud de la carte mentale (coût: 1 jeton)
router.post('/mindmap/extend', async (req, res) => {
  let deducted = 0;
  try {
    const { file, nodeText } = req.body;
    if (!file) return res.status(400).json({ error: 'Fichier manquant' });
    if (!nodeText) return res.status(400).json({ error: 'Concept à approfondir manquant' });

    const text = await getFileText(file);
    const chunks = splitIntoChunks(text);

    // Isoler les chunks pertinents qui parlent du nœud
    let relevantText = '';
    const matchingChunks = chunks.filter(c => c.toLowerCase().includes(nodeText.toLowerCase()));
    if (matchingChunks.length > 0) {
      relevantText = matchingChunks.slice(0, 2).join('\n\n');
    } else {
      // Fallback sur le premier chunk s'il n'y a pas de correspondance textuelle brute
      relevantText = chunks[0] || '';
    }

    // Déduction unitaire fixe de 1 jeton pour l'approfondissement ciblé
    const jeton = await checkAndDeduct(req.user?.id, 'mindmap', req.user?.plan || 'free', 1);
    if (!jeton.ok) {
      return res.status(402).json({ error: `Solde insuffisant : ${jeton.needed} jeton requis, vous en avez ${jeton.balance}.` });
    }
    deducted = jeton.cost || 0;

    const aiCfg = await getAiConfigForAction('mindmap');
    const ctx = userContext(req.user);

    const { text: result, usage } = await aiComplete(
      promptExtendNode(ctx, file.name, nodeText, relevantText),
      600,
      aiCfg
    );

    if (usage) logTokens(req.user?.id, 'mindmap', usage.provider, usage.input, usage.output);

    res.json({ markdown: result.trim() });

  } catch (err) {
    logger.error('AI mindmap extend error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'mindmap', deducted);
    res.status(500).json({ error: clientErrorMessage(err) });
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

function promptExtendNode(ctx, name, nodeText, text) {
  return `${ctx}Tu es un tuteur expert. Tu devez approfondir et détailler le concept/thématique "${nodeText}" à partir de l'extrait du cours "${name}" ci-dessous.

RÈGLES STRICTES :
- Génère exactement entre 3 et 5 sous-éléments directs pour détailler ce concept.
- Les sous-éléments doivent être concis (3 à 7 mots maximum chacun).
- Réponds uniquement sous forme d'une liste simple en Markdown avec des tirets "- ", sans aucun sous-niveau (pas d'indentation interne).
- Ne mets aucune phrase d'introduction ni de conclusion, aucun titre, réponds uniquement avec la liste de puces en Markdown pur.

---
Extrait du cours pertinent pour le contexte :
${text}

---
Concept à approfondir : ${nodeText}`;
}

module.exports = router;

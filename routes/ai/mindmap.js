const express = require('express');
const router  = express.Router();
const { aiComplete } = require('../../services/ai');
const { getAiConfigForAction }  = require('../../services/aiConfig');
const { LIMITS }                = require('../../middleware/quota');
const { checkAndDeduct }        = require('../../services/jetons');
const { logTokens }             = require('../../services/tokens');
const logger                    = require('../../services/logger');
const { userContext, getFileText } = require('./helpers');

// POST /api/mindmap — génère un markdown hiérarchique pour markmap
// Utilise le texte original du fichier, pas un résumé.
router.post('/mindmap', async (req, res) => {
  const jeton = await checkAndDeduct(req.user?.id, 'mindmap', req.user?.plan || 'free');
  if (!jeton.ok) return res.status(402).json({ error: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });

  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'Fichier manquant' });

    const text     = await getFileText(file);
    const truncated = text.slice(0, LIMITS.summaryChars);

    const prompt = `${userContext(req.user)}Tu dois générer une carte mentale structurée du cours ci-dessous.

RÈGLES STRICTES :
- Réponds uniquement avec du Markdown pur, aucun texte avant ou après
- Structure en 3 niveaux maximum : ## grandes thématiques → ### sous-concepts → - points clés
- Les labels doivent être courts (3-7 mots max), jamais des phrases entières
- 4 à 7 branches principales (##), 2 à 5 sous-branches (###) par thématique
- Pas d'émojis, pas de gras/italique, pas de numérotation
- Pas de section "Introduction" ou "Conclusion" générique

FORMAT ATTENDU (remplace par le contenu réel) :
## Thématique 1
### Sous-concept A
- Point clé 1
- Point clé 2
### Sous-concept B
- Point clé 3
## Thématique 2
### Sous-concept C
- Point clé 4

---
Cours "${file.name}" :
${truncated}`;

    const aiCfg = await getAiConfigForAction('mindmap');
    const { text: md, usage } = await aiComplete(prompt, 1200, aiCfg);

    if (usage) logTokens(req.user?.id, 'mindmap', usage.provider, usage.input, usage.output);

    res.json({ markdown: md.trim() });
  } catch (err) {
    logger.error('AI mindmap error', { userId: req.user?.id, message: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

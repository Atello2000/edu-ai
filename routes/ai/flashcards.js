const express = require('express');
const router  = express.Router();
const { aiComplete, calcMaxTokens, MODEL_LABEL } = require('../../services/ai');
const { checkQuota, LIMITS }                     = require('../../middleware/quota');
const { logTokens }                              = require('../../services/tokens');
const logger                                     = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse } = require('./helpers');

// POST /api/flashcards — génération de flashcards (traitement parallèle par fichier)
router.post('/flashcards', async (req, res) => {
  const quota = await checkQuota(req, 'flashcards');
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

      const prompt = `${userContext(req.user)}Tu es un assistant pédagogique. Génère ${count} flashcards ${inLang} pour aider à mémoriser les concepts essentiels.

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
Contenu du cours "${file.name}" :
${truncated}`;

      const { text: raw, model: fileModel, usage } = await aiComplete(
        prompt, calcMaxTokens('flash', truncated.length, count)
      );
      logTokens(req.user?.id, 'flashcards', usage?.provider, usage?.input, usage?.output);

      const parsed = parseJsonResponse(raw, { flashcards: [] });
      return { name: file.name, flashcards: parsed.flashcards || [], _model: fileModel };
    }));

    const flashModel = results[results.length - 1]?._model || MODEL_LABEL;
    results.forEach(r => delete r._model);
    res.json({ success: true, results, model: flashModel });
  } catch (err) {
    logger.error('AI flashcards error', { userId: req.user?.id, message: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

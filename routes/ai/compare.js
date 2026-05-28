const express = require('express');
const router  = express.Router();
const { aiStream }             = require('../../services/ai');
const { getAiConfigForAction } = require('../../services/aiConfig');
const { checkAndDeduct }       = require('../../services/jetons');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { langLabel, getFileText } = require('./helpers');

// POST /api/compare — confrontation multi-sources (SSE streaming)
router.post('/compare', async (req, res) => {
  req.socket?.setNoDelay(true);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = data => { res.write(`data: ${JSON.stringify(data)}\n\n`); res.flush?.(); };

  try {
    const { files, lang } = req.body;

    if (!Array.isArray(files) || files.length < 2) {
      send({ type: 'error', message: 'Au moins 2 fichiers sont requis pour la comparaison.' });
      return res.end();
    }

    if (files.length > 4) {
      send({ type: 'error', message: 'Maximum 4 fichiers pour la comparaison.' });
      return res.end();
    }

    // Coût fixe : 4 jetons
    const jeton = await checkAndDeduct(req.user?.id, 'compare', req.user?.plan || 'free', 4);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }

    const inLang = langLabel(lang || 'fr');

    // Charger et tronquer chaque fichier à 3000 chars
    const sources = [];
    for (const file of files) {
      const text = await getFileText(file);
      sources.push({ name: file.name, text: text.slice(0, 3000) });
    }

    const sourcesText = sources
      .map((s, i) => `=== Source ${i + 1}: ${s.name} ===\n${s.text}`)
      .join('\n\n');

    const prompt = `Tu es un expert en analyse comparative de cours universitaires ${inLang}.
Compare les ${sources.length} sources suivantes sur le même sujet.

Structure ta réponse en markdown avec ces sections EXACTES:
## 🤝 Points communs
[Ce que toutes les sources s'accordent à dire - bullets]

## ⚡ Contradictions ou divergences
[Ce qui diffère entre les sources, en citant quelle source dit quoi]

## ➕ Apports spécifiques
[Ce que chaque source apporte d'unique que les autres n'ont pas]

## 💡 Synthèse recommandée
[Vision unifiée, quelle source approfondir pour quel aspect]

Sources à comparer:
${sourcesText}`;

    const aiCfg     = await getAiConfigForAction('compare');
    let   lastModel = '';

    for await (const chunk of aiStream(prompt, 2000, aiCfg)) {
      if (chunk.usage) {
        logTokens(req.user?.id, 'compare', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
        continue;
      }
      lastModel = chunk.model;
      send({ type: 'delta', text: chunk.text });
    }

    send({ type: 'end', model: lastModel });
  } catch (err) {
    logger.error('AI compare error', { userId: req.user?.id, message: err.message });
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

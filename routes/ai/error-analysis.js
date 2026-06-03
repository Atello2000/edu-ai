const express = require('express');
const router  = express.Router();
const { aiComplete }           = require('../../services/ai');
const { getAiConfigForAction } = require('../../services/aiConfig');
const { checkAndDeduct, refundJetons } = require('../../services/jetons');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { langLabel, parseJsonResponse } = require('./helpers');

// POST /api/error-analysis — analyse des erreurs récurrentes (JSON response)
router.post('/error-analysis', async (req, res) => {
  let deducted = 0; // jetons à rembourser si l'IA échoue après déduction
  try {
    if (!['pro', 'max'].includes(req.user?.plan)) {
      return res.status(403).json({ error: 'Cette fonctionnalité est réservée aux plans Pro et Max.' });
    }

    const { wrong_answers, lang } = req.body;

    if (!Array.isArray(wrong_answers) || wrong_answers.length < 3) {
      return res.json({ patterns: [], message: 'Pas assez de données' });
    }

    const jeton = await checkAndDeduct(req.user?.id, 'error-analysis', req.user?.plan || 'free');
    if (!jeton.ok) {
      return res.status(402).json({ error: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
    }
    deducted = jeton.cost || 0;

    // Limiter à 30 réponses incorrectes maximum
    const answers = wrong_answers.slice(0, 30);
    const inLang  = langLabel(lang || 'fr');

    const answersText = answers
      .map(a => `Q: ${a.question}\nBonne réponse: ${a.correct}\nRéponse donnée: ${a.given}\nExplication: ${a.explanation || ''}\n---`)
      .join('\n');

    const prompt = `Tu es un expert en analyse d'erreurs d'apprentissage ${inLang}.
Voici les réponses incorrectes d'un étudiant lors de quiz:

${answersText}

Identifie 2 à 4 patterns d'erreurs récurrents (confusions, lacunes, malentendus).

Retourne UNIQUEMENT ce JSON:
{
  "patterns": [
    {
      "type": "confusion|lacune|malentendu|erreur_calcul",
      "title": "Titre court du pattern (ex: Confusion cinétique/dynamique)",
      "description": "Description détaillée en 1-2 phrases",
      "frequency": 2,
      "advice": "Conseil concret pour corriger en 1 phrase",
      "flashcard_hint": "Un exemple de flashcard recto|verso pour mémoriser"
    }
  ]
}`;

    const aiCfg = await getAiConfigForAction('error-analysis');
    const { text: raw, usage } = await aiComplete(prompt, 1200, aiCfg);
    if (usage) logTokens(req.user?.id, 'error-analysis', usage.provider, usage.input, usage.output);

    const parsed = parseJsonResponse(raw, { patterns: [] });

    res.json({ patterns: parsed.patterns ?? [] });
  } catch (err) {
    logger.error('AI error-analysis error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'error-analysis', deducted);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

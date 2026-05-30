const express = require('express');
const router  = express.Router();
const { aiStream }             = require('../../services/ai');
const { getAiConfigForAction } = require('../../services/aiConfig');
const { checkAndDeduct, refundJetons } = require('../../services/jetons');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { langLabel, parseJsonResponse, sseSetup } = require('./helpers');

// POST /api/study-plan — plan de révision intelligent (SSE streaming)
router.post('/study-plan', async (req, res) => {
  const send = sseSetup(req, res);
  let deducted = 0;

  try {
    const { exam_date, topics, srs_count, lang } = req.body;

    const jeton = await checkAndDeduct(req.user?.id, 'study-plan', req.user?.plan || 'free');
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    deducted = jeton.cost || 0;

    send({ type: 'progress', message: 'Génération du plan de révision…' });

    // Calculer le nombre de jours disponibles (cap à 14)
    const examDateObj    = new Date(exam_date);
    const days_available = !isNaN(examDateObj)
      ? Math.min(14, Math.max(1, Math.ceil((examDateObj - Date.now()) / 86400000)))
      : 7;

    const inLang     = langLabel(lang || 'fr');
    const topicsText = Array.isArray(topics)
      ? topics.map(t => `- ${t.name} (moyenne: ${t.avg}%, sessions: ${t.sessions})`).join('\n')
      : 'Aucun sujet fourni';

    const prompt = `Tu es un expert en planification de révisions. Génère un plan jour par jour pour un étudiant.

Données:
- Date d'examen: ${exam_date}
- Jours disponibles: ${days_available}
- Points faibles (triés du plus faible):
${topicsText}
- Cartes SRS dues: ${srs_count ?? 0}
- Langue: ${inLang}

Retourne UNIQUEMENT ce JSON (sans markdown):
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "label": "Lundi 3 juin",
      "tasks": [
        { "type": "weak_topic|srs|quiz|review|rest", "topic": "nom du sujet ou null", "duration": 30, "action": "description courte de l'action" }
      ],
      "total_minutes": 60
    }
  ],
  "advice": "Conseil général en 1-2 phrases ${inLang}"
}

Règles:
- Max 2h de travail par jour
- Prioritise les points faibles (avg < 60%)
- Intègre les révisions SRS si srs_count > 0
- Laisse au moins 1 jour de repos si plus de 5 jours
- Jour avant l'examen: uniquement révision légère et SRS`;

    const aiCfg = await getAiConfigForAction('study-plan');
    let raw = '';
    for await (const chunk of aiStream(prompt, 2000, aiCfg)) {
      if (chunk.usage) {
        logTokens(req.user?.id, 'study-plan', chunk.usage.provider, chunk.usage.input, chunk.usage.output);
        continue;
      }
      raw += chunk.text;
    }

    const plan = parseJsonResponse(raw, { days: [], advice: raw });
    if (!plan.days?.length) {
      throw new Error('Plan vide généré — réessayez avec une date d\'examen valide.');
    }

    send({ type: 'end', plan });

  } catch (err) {
    logger.error('AI study-plan error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'study-plan', deducted);
    send({ type: 'error', message: err.message });
  }
  res.end();
});

module.exports = router;

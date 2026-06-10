const express = require('express');
const router  = express.Router();
const { aiStream }             = require('../../services/ai');
const { getAiConfigForAction } = require('../../services/aiConfig');
const { checkAndDeduct, refundJetons } = require('../../services/jetons');
const { logTokens }            = require('../../services/tokens');
const logger                   = require('../../services/logger');
const { langLabel, parseJsonResponse, sseSetup, clientErrorMessage } = require('./helpers');

// POST /api/study-plan — plan de révision intelligent (SSE streaming)
router.post('/study-plan', async (req, res) => {
  const send = sseSetup(req, res);
  let deducted = 0;

  try {
    if (!['pro', 'max'].includes(req.user?.plan)) {
      send({ type: 'error', message: 'Cette fonctionnalité est réservée aux plans Pro et Max.' });
      return res.end();
    }

    const { exam_date, files = [], topics = [], srs_due_fronts = [], lang } = req.body;

    const jeton = await checkAndDeduct(req.user?.id, 'study-plan', req.user?.plan || 'free');
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    deducted = jeton.cost || 0;

    send({ type: 'progress', message: 'Génération du plan de révision…' });

    // Nombre de jours disponibles (cap à 14)
    const examDateObj    = new Date(exam_date);
    const days_available = !isNaN(examDateObj)
      ? Math.min(14, Math.max(1, Math.ceil((examDateObj - Date.now()) / 86400000)))
      : 7;

    const inLang = langLabel(lang || 'fr');

    // ── Cours chargés ──────────────────────────────────────────────────────────
    const filesSection = files.length > 0
      ? files.map(f =>
          `• ${f.name}${f.excerpt ? `\n  Extrait : "${f.excerpt}"` : ''}`
        ).join('\n')
      : 'Aucun cours chargé (plan générique)';

    // ── Stats quiz filtrées par cours ─────────────────────────────────────────
    const topicsSection = topics.length > 0
      ? topics.map(t =>
          `• ${t.name} — moyenne ${t.avg}% (${t.sessions} session${t.sessions > 1 ? 's' : ''})`
        ).join('\n')
      : 'Aucune donnée de quiz disponible pour ces cours';

    // ── Cartes SRS dues ───────────────────────────────────────────────────────
    // L'IA doit filtrer et ne garder que les cartes en rapport avec les cours chargés.
    const srsSection = srs_due_fronts.length > 0
      ? srs_due_fronts.map((f, i) => `  ${i + 1}. "${f}"`).join('\n')
      : null;

    const srsPart = srsSection
      ? `\nCartes SRS dues (${srs_due_fronts.length} cartes) :\n${srsSection}\n\nIMPORTANT : N'inclure des tâches SRS que pour les cartes clairement en rapport avec les cours chargés ci-dessus. Ignorer les cartes d'autres matières.`
      : '\nAucune carte SRS due.';

    const prompt = `Tu es un expert en planification de révisions. Génère un plan jour par jour CENTRÉ sur les cours chargés par l'étudiant.

=== COURS CHARGÉS (priorité absolue) ===
${filesSection}

=== STATISTIQUES QUIZ (pour ces cours) ===
${topicsSection}
${srsPart}

=== PARAMÈTRES ===
- Date d'examen : ${exam_date}
- Jours disponibles : ${days_available}
- Langue : ${inLang}

=== INSTRUCTIONS ===
- Chaque tâche doit être DIRECTEMENT liée au contenu des cours chargés
- Les tâches "weak_topic" ciblent les sujets avec une moyenne quiz < 60%
- Les tâches "review" couvrent le contenu des cours chargés (titre, thèmes clés vus dans l'extrait)
- Les tâches "quiz" proposent de tester la compréhension sur les cours chargés
- Les tâches "srs" uniquement si des cartes dues concernent ces cours
- Max 2h de travail par jour (120 min)
- Laisse 1 jour de repos si > 5 jours disponibles
- Dernier jour avant l'examen : révision légère uniquement

Retourne UNIQUEMENT ce JSON (sans markdown, sans explication) :
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "label": "Lundi 3 juin",
      "tasks": [
        {
          "type": "weak_topic|srs|quiz|review|rest",
          "topic": "nom du sujet ou null",
          "duration": 30,
          "action": "description courte et actionnable de la tâche"
        }
      ],
      "total_minutes": 60
    }
  ],
  "advice": "Conseil personnalisé en 1-2 phrases basé sur les cours chargés (${inLang})"
}`;

    const aiCfg = await getAiConfigForAction('study-plan');
    let raw = '';
    for await (const chunk of aiStream(prompt, 2500, aiCfg)) {
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
    send({ type: 'error', message: clientErrorMessage(err) });
  }
  res.end();
});

module.exports = router;

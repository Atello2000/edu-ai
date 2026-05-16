const express = require('express');
const router  = express.Router();
const { anthropic, aiComplete } = require('../services/ai');

const PHARMA_SYSTEM = `Tu es un expert senior en régulation pharmaceutique avec 20 ans d'expérience. Tu maîtrises :
- La réglementation européenne (EMA, directives, règlements)
- La réglementation française (ANSM, AMM, ATU/AAP)
- Les guidelines ICH (Q1-Q14, E1-E16, S1-S12, M1-M8)
- Les Bonnes Pratiques de Fabrication (BPF/GMP) et toutes les annexes
- Les essais cliniques (phases I-IV, ICH E6 BPC)
- La pharmacovigilance (EudraVigilance, PSUR, SUSAR, PASS/PAES)
- Le dossier CTD/eCTD et ses 5 modules
- La bioéquivalence et les médicaments génériques
- Les médicaments biologiques et biosimilaires
- Les dispositifs médicaux (MDR 2017/745, IVDR 2017/746)

Réponds toujours en français. Structure tes réponses avec Markdown (titres, listes, tableaux si utile). Cite les textes réglementaires précis (numéros de guidelines ICH, numéros d'articles de directives/règlements EU). Adapte le niveau à un étudiant de Master 1 en régulation pharmaceutique : rigoureux mais pédagogique.`;

router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const stream = anthropic.messages.stream({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system:     [{ type: 'text', text: PHARMA_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages:   (messages || []).slice(-10)
    });
    const message = await stream.finalMessage();
    res.json({ success: true, response: message.content[0].text, model: 'Claude Sonnet 4.6' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/quiz', async (req, res) => {
  try {
    const { topic } = req.body;
    const VALID_DIFF = ['facile', 'moyen', 'difficile'];
    const difficulty = VALID_DIFF.includes(req.body.difficulty) ? req.body.difficulty : 'moyen';
    const count      = Math.min(parseInt(req.body.count) || 5, 15);

    const diffGuide = {
      facile:    'Privilégie les questions de définition et de reconnaissance basique.',
      moyen:     'Mélange compréhension, application réglementaire et comparaison de procédures.',
      difficile: 'Privilégie les cas pratiques, nuances réglementaires, erreurs courantes et scénarios multi-étapes.',
    }[difficulty];

    const { text: raw, model } = await aiComplete(
      `Génère ${count} questions QCM de niveau ${difficulty} sur le thème "${topic}" en régulation pharmaceutique.
${diffGuide}

Varie les types de questions : définition réglementaire, identification de procédure, comparaison de guidelines, application dans un cas pratique, vrai/faux réglementaire, interprétation d'un texte.

IMPORTANT : dans le texte des questions, options et explications, n'utilise PAS de guillemets doubles. Utilise uniquement des apostrophes ou reformule. Le JSON doit être strictement valide.

Réponds UNIQUEMENT avec ce JSON valide, sans balises markdown, sans texte autour :
{"questions":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]}`,
      Math.min(count * 500 + 800, 6000)
    );

    let quiz = { questions: [] };
    try {
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
      const match   = cleaned.match(/\{[\s\S]*\}/);
      let jsonStr   = match ? match[0] : cleaned;
      jsonStr = jsonStr.replace(/\r?\n/g, ' ').replace(/\r/g, ' ');
      quiz = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[pharma/quiz] JSON parse error:', e.message);
    }

    res.json({ success: true, questions: quiz.questions || [], model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fiche', async (req, res) => {
  try {
    const { topic } = req.body;
    const { text, model } = await aiComplete(
      `Tu es un expert en régulation pharmaceutique. Génère une fiche de référence complète et synthétique pour un étudiant de Master 1 sur : "${topic}".

Structure la fiche en Markdown avec exactement ce plan :

## 🎯 Définition / Objectif
(2-3 phrases claires)

## 📌 Points essentiels
(liste des 5-8 points clés à retenir)

## ⚖️ Textes réglementaires applicables
(liste des directives, règlements, guidelines pertinents avec leurs numéros exacts)

## 🔑 Concepts clés
(définitions brèves des termes fondamentaux du sujet)

## ⚠️ Points d'attention
(erreurs courantes, exceptions importantes, pièges réglementaires)

## 💡 À retenir
(1-2 phrases de synthèse essentielles)

Réponds en français. Sois précis, cite les références exactes (ex : Règlement (CE) n°726/2004, ICH Q10, GMP Annexe 11...).`,
      2200
    );

    res.json({ success: true, content: text, model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

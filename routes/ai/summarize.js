const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { aiStream, aiComplete, calcMaxTokens, MODEL_LABEL } = require('../../services/ai');
const { getAiConfigForAction }                 = require('../../services/aiConfig');
const { checkAndDeduct, refundJetons, JETON_COSTS } = require('../../services/jetons');
const { logTokens }                            = require('../../services/tokens');
const logger                                   = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText, sseSetup } = require('./helpers');
const { splitIntoChunks, chunkCost, chunkSizeFor } = require('../../services/chunker');
const { prepare }                              = require('../../db');

const CACHE_TTL_H    = 24; // heures
const CHUNK_PARALLEL = 1;  // chunks traités séquentiellement pour respecter les quotas

function summarizeCacheKey(text, lang, user) {
  const profile = `${user?.level || ''}|${Array.isArray(user?.domains) ? user.domains.join(',') : (user?.domains || '')}`;
  return crypto.createHash('sha256').update(`summarize:v4:${lang}:${profile}:${text}`).digest('hex');
}

async function getCached(key) {
  try {
    const row = await prepare('SELECT result FROM ai_cache WHERE cache_key = ? AND expires_at > NOW()').get(key);
    return row?.result || null;
  } catch { return null; }
}

async function setCache(key, result) {
  try {
    const exp = new Date(Date.now() + CACHE_TTL_H * 3600 * 1000).toISOString();
    await prepare(
      `INSERT INTO ai_cache (cache_key, result, expires_at) VALUES (?, ?, ?)
       ON CONFLICT (cache_key) DO UPDATE SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at
       RETURNING cache_key`
    ).run(key, result, exp);
  } catch { /* best-effort */ }
}

// POST /api/summarize — résumé pédagogique en streaming SSE
router.post('/summarize', async (req, res) => {
  const send = sseSetup(req, res);
  let deducted = 0;

  try {
    const { files } = req.body;
    if (!files?.length) {
      send({ type: 'error', message: 'Aucun fichier sélectionné' });
      return res.end();
    }

    const lang   = VALID_LANGS.includes(req.body.lang) ? req.body.lang : 'fr';
    const inLang = langLabel(lang);
    const ctx    = userContext(req.user);
    // Calculer la longueur totale des textes source pour le routing par contexte
    const totalTextLength = (await Promise.all(files.map(async f => {
      try { return (await getFileText(f)).length; } catch { return 0; }
    }))).reduce((a, b) => a + b, 0);
    const aiCfg  = await getAiConfigForAction('summarize', { lang, textLength: totalTextLength });
    const cSize  = chunkSizeFor(aiCfg.provider);

    // ── 1. Séparer fichiers cachés / fichiers à générer ───────────────────
    const cached   = [];
    const fileData = [];

    for (const file of files) {
      const text = await getFileText(file);
      if (!text.trim()) {
        send({ type: 'file_error', name: file.name, message: `Contenu de "${file.name}" vide ou indisponible.` });
        continue;
      }
      const key  = summarizeCacheKey(text, lang, req.user);
      const hit  = await getCached(key);
      if (hit) {
        cached.push({ file, hit });
      } else {
        const chunks = splitIntoChunks(text, cSize);
        fileData.push({ file, text, chunks, key });
      }
    }

    // ── 2. Retourner les résultats cachés immédiatement (0 jeton) ─────────
    for (const { file, hit } of cached) {
      send({ type: 'start',  name: file.name, cached: true });
      send({ type: 'delta',  name: file.name, text: hit });
      send({ type: 'done',   name: file.name });
    }

    if (!fileData.length) { send({ type: 'end' }); return res.end(); }

    // ── 3. Déduire les jetons pour les fichiers non cachés ────────────────
    const totalCost = fileData.reduce((s, { chunks }) => s + chunkCost(JETON_COSTS.summarize, chunks.length), 0);
    const jeton = await checkAndDeduct(req.user?.id, 'summarize', req.user?.plan || 'free', totalCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }
    deducted = jeton.cost || 0;

    // ── 4. Traiter tous les fichiers en parallèle ─────────────────────────
    let streamModel = MODEL_LABEL;

    await Promise.all(fileData.map(async ({ file, text, chunks, key }) => {

      if (chunks.length === 1) {
        // Fichier court : streaming direct
        send({ type: 'start', name: file.name });
        let fullText = '';
        for await (const c of aiStream(promptSummaryFull(ctx, inLang, file.name, chunks[0], file.truncated), calcMaxTokens('summary', chunks[0].length), aiCfg)) {
          if (c.usage) { logTokens(req.user?.id, 'summarize', c.usage.provider, c.usage.input, c.usage.output); continue; }
          fullText += c.text;
          send({ type: 'delta', name: file.name, text: c.text });
          streamModel = c.model;
        }

        // Validation post-génération : relance silencieuse si 2+ sections manquent
        const missing1 = missingSections(fullText);
        if (missing1.length >= 2) {
          logger.warn('summarize: sections manquantes, relance repair', { file: file.name, missing: missing1 });
          try {
            const { text: repaired, usage: ru } = await aiComplete(
              promptSummaryRepair(ctx, inLang, file.name, fullText, missing1), 2500, aiCfg
            );
            if (ru) logTokens(req.user?.id, 'summarize', ru.provider, ru.input, ru.output);
            fullText = fullText + '\n\n' + repaired;
            send({ type: 'patch', name: file.name, text: repaired });
          } catch (repairErr) {
            logger.warn('summarize: repair échoué', { file: file.name, error: repairErr.message });
          }
        }

        send({ type: 'done', name: file.name });
        setCache(key, fullText); // fire-and-forget

      } else {
        // Fichier long : chunks analysés en parallèle
        send({ type: 'progress', name: file.name, step: 0, total: chunks.length,
               message: `Cours volumineux — analyse en ${chunks.length} parties…` });

        const partials = new Array(chunks.length);
        const chunkParallel = aiCfg.provider === 'gemini' ? 1 : 3;
        for (let i = 0; i < chunks.length; i += chunkParallel) {
          await Promise.all(
            chunks.slice(i, i + chunkParallel).map(async (chunk, j) => {
              const idx = i + j;
              const { text: partial, usage } = await aiComplete(
                promptSummaryPartial(ctx, inLang, file.name, chunk, idx + 1, chunks.length),
                1200, aiCfg,
              );
              if (usage) logTokens(req.user?.id, 'summarize', usage.provider, usage.input, usage.output);
              partials[idx] = partial;
              send({ type: 'progress', name: file.name, step: idx + 1, total: chunks.length,
                     message: `${idx + 1}/${chunks.length} parties analysées…` });
            })
          );
        }

        // Fusion et streaming du résumé final
        send({ type: 'start', name: file.name });
        let fullText = '';
        for await (const c of aiStream(promptSummaryMerge(ctx, inLang, file.name, partials, file.truncated), 4500, aiCfg)) {
          if (c.usage) { logTokens(req.user?.id, 'summarize', c.usage.provider, c.usage.input, c.usage.output); continue; }
          fullText += c.text;
          send({ type: 'delta', name: file.name, text: c.text });
          streamModel = c.model;
        }

        // Validation post-fusion : relance silencieuse si 2+ sections manquent
        const missing2 = missingSections(fullText);
        if (missing2.length >= 2) {
          logger.warn('summarize: sections manquantes post-fusion, relance repair', { file: file.name, missing: missing2 });
          try {
            const { text: repaired, usage: ru } = await aiComplete(
              promptSummaryRepair(ctx, inLang, file.name, fullText, missing2), 2500, aiCfg
            );
            if (ru) logTokens(req.user?.id, 'summarize', ru.provider, ru.input, ru.output);
            fullText = fullText + '\n\n' + repaired;
            send({ type: 'patch', name: file.name, text: repaired });
          } catch (repairErr) {
            logger.warn('summarize: repair post-fusion échoué', { file: file.name, error: repairErr.message });
          }
        }

        send({ type: 'done', name: file.name });
        setCache(key, fullText); // fire-and-forget
      }
    }));

    send({ type: 'model', name: streamModel });
    send({ type: 'end' });

  } catch (err) {
    logger.error('AI summarize error', { userId: req.user?.id, message: err.message });
    await refundJetons(req.user?.id, 'summarize', deducted);
    send({ type: 'error', message: err.message });
  }
  res.end();
});

// ── Helpers de prompt ──────────────────────────────────────────────────────────

/**
 * Vérifie que les 7 sections obligatoires sont présentes dans le résumé généré.
 * Retourne la liste des titres manquants (comparaison insensible à la casse).
 */
const REQUIRED_SECTION_KEYS = [
  'objectifs', 'structure', 'points', 'resum', 'concepts', 'liens', 'retenir',
];
function missingSections(md) {
  const lower = md.toLowerCase();
  return REQUIRED_SECTION_KEYS.filter(k => !lower.includes(k));
}

/**
 * Prompt de réparation : demande au modèle de compléter les sections manquantes
 * sans réécrire celles qui existent déjà.
 */
function promptSummaryRepair(ctx, inLang, name, partial, missing) {
  return `${ctx}Le résumé du cours "${name}" est incomplet. Il manque les sections suivantes ${inLang} :
${missing.map(m => `- ## ${m}`).join('\n')}

Résumé partiel existant (NE PAS réécrire les sections déjà présentes) :
${partial}

---
Complète UNIQUEMENT les sections manquantes en respectant le même format Markdown (## Titre).
Si une section n'est vraiment pas applicable au contenu de ce cours, écris une ligne courte sous le titre.`;
}

function extractionNote(truncated) {
  return truncated
    ? "Le texte a ete tronque par la limite technique de l'application. Indique-le dans \"A retenir\" en une phrase factuelle et courte (ex: \"Note : le cours a ete partiellement analyse en raison de sa longueur.\"). N'ajoute rien d'autre sur la qualite."
    : "N'ajoute une note de qualite dans \"A retenir\" QUE si le texte est clairement illisible, corrompu ou trop fragmentaire pour produire un resume utile. Si le contenu semble complet, utilisable ou seulement partiel, n'ecris aucune note de qualite.";
}

function summaryFormatRules(truncated) {
  return `Objectif: donner une comprehension structuree et actionnable du cours pour un etudiant.
Ne remplace pas les modules quiz, flashcards ou fiche d'examen — reste sur la comprehension.

Regles de forme:
- Chaque section commence par une ligne "## " (deux dieses + espace + titre).
- N'utilise pas d'emojis dans les titres de section.
- Ne cree pas de section "References" ni de conclusion generique.
- Regle anti-remplissage : si le cours ne fournit pas de matiere suffisante pour une section, reduis-la a 1-2 lignes plutot que d'inventer du contenu.
- Adapte la densite : cours court ou simple = concis ; cours long ou theorique = structure et explicatif.
- ${extractionNote(truncated)}

Les 7 sections obligatoires, dans l'ordre:
1. "## Objectifs du cours" — 2-3 phrases sur ce que l'etudiant va comprendre et savoir faire apres ce cours.
2. "## Structure du cours" — plan logique du document en 3-7 points refletant la progression reelle, sans inventer de partie absente.
3. "## Points cles" — 5-8 idees essentielles en bullets; chaque bullet = 1 idee complete (pas un mot seul).
4. "## Resume detaille" — developpement en paragraphes couvrant tout le cours. Utilise obligatoirement des sous-titres ### pour chaque theme ou partie si le contenu depasse 3 paragraphes.
5. "## Concepts importants" — pour chaque notion: **Terme** : definition simple + pourquoi c'est important + exemple concret si disponible dans le cours.
6. "## Liens entre les idees" — 3-5 relations causales ou logiques entre notions, chacune au format "**A → B** : explication en 1 phrase" (ex: "**Loi de l'offre → prix d'equilibre** : une hausse de l'offre fait baisser le prix si la demande reste stable").
7. "## A retenir" — blockquote (ligne commencant par >) avec la lecon principale en 2-3 phrases, puis si necessaire la note de qualite d'extraction.`;
}

function promptSummaryFull(ctx, inLang, name, text, truncated = false) {
  return `${ctx}Tu es un assistant pedagogique expert. Resume le cours ci-dessous ${inLang} en 7 sections Markdown.

${summaryFormatRules(truncated)}

Cours "${name}" :
${text}

---
Resume :`;
}

function promptSummaryPartial(ctx, inLang, name, text, part, total) {
  return `${ctx}Voici la partie ${part}/${total} du cours "${name}".
Extrais les points essentiels de CETTE PARTIE UNIQUEMENT ${inLang}.

Ce que tu dois capturer:
- Titres ou structure visible de cette partie
- Definitions et termes techniques introduits
- Concepts cles, mecanismes ou principes expliques
- Exemples concrets mentionnes dans le texte
- Relations logiques ou causales entre notions (format "A → B")

Contraintes:
- Max 350 mots, structure en bullets numerotes
- Commence directement par le contenu, sans phrase d'introduction ni conclusion
- Si une notion est incomplete dans cette partie (suite probable dans la suivante), note-le avec [suite...]
- N'invente rien : reste strictement sur le contenu de cette partie

Partie ${part}/${total} :
${text}`;
}

function promptSummaryMerge(ctx, inLang, name, partials, truncated = false) {
  const body = partials
    .map((p, i) => `--- Partie ${i + 1}/${partials.length} ---\n${p}`)
    .join('\n\n');

  return `${ctx}Tu es un assistant pedagogique expert. A partir des notes extraites des ${partials.length} parties du cours "${name}", produis un resume final unifie ${inLang} en 7 sections Markdown.

${summaryFormatRules(truncated)}

Instructions de fusion (applique-les dans l'ordre):
1. Deduplication : si la meme notion apparait dans plusieurs parties, n'ecris qu'une seule definition, la plus complete.
2. Regroupement : rassemble les idees du meme theme sous le meme sous-titre ### dans le Resume detaille, meme si elles viennent de parties differentes.
3. Couverture : verifie que chaque partie contribue au moins 1 element au resume — n'oublie aucune section du cours.
4. Coherence : assure-toi que les Liens entre les idees couvrent des relations entre parties differentes (pas seulement intra-partie).
5. Longueur cible par section : Objectifs=3-5 lignes, Structure=5-10 lignes, Points cles=8-12 lignes, Resume detaille=40-80% du total, Concepts=5-12 notions, Liens=3-5 relations, A retenir=2-4 lignes.

Notes des ${partials.length} parties :

${body}

---
Resume :`;
}

/*
function promptFull(ctx, inLang, name, text) {
  return `${ctx}Tu es un assistant pédagogique expert. Résume le cours ci-dessous ${inLang} en 5 sections Markdown.

Chaque section commence par une ligne "## " (deux dièses + espace + emoji + titre).
Les 5 sections obligatoires, dans l'ordre :
1. "## 🎯 Objectifs du cours" — 2-3 phrases sur ce que l'étudiant va apprendre
2. "## 📌 Points clés" — 5-8 bullets des idées essentielles
3. "## 📖 Résumé détaillé" — développement en paragraphes, sous-titres ### si besoin
4. "## 🔑 Concepts importants" — définitions courtes des notions clés
5. "## 💡 À retenir" — blockquote (ligne commençant par >) avec la leçon principale

Cours "${name}" :
${text}

---
Résumé :`;
}

function promptPartial(ctx, inLang, name, text, part, total) {
  return `${ctx}Voici la partie ${part}/${total} du cours "${name}".
Extrais les points essentiels de CETTE PARTIE UNIQUEMENT ${inLang} : définitions, concepts clés, mécanismes, exemples importants.
Sois concis (max 250 mots), structure en bullets sans introduction ni conclusion générique.

Partie ${part}/${total} :
${text}`;
}

function promptMerge(ctx, inLang, name, partials) {
  const body = partials
    .map((p, i) => `--- Partie ${i + 1}/${partials.length} ---\n${p}`)
    .join('\n\n');

  return `${ctx}Tu es un assistant pédagogique expert. À partir des notes ci-dessous, produis un résumé final complet et cohérent ${inLang} en 5 sections Markdown.

Chaque section commence par une ligne "## " (deux dièses + espace + emoji + titre).
Les 5 sections obligatoires, dans l'ordre :
1. "## 🎯 Objectifs du cours" — 2-3 phrases sur ce que l'étudiant va apprendre
2. "## 📌 Points clés" — 5-8 bullets des idées essentielles
3. "## 📖 Résumé détaillé" — développement en paragraphes, couvre TOUTES les parties
4. "## 🔑 Concepts importants" — définitions courtes des notions clés
5. "## 💡 À retenir" — blockquote (ligne commençant par >) avec la leçon principale

Notes des ${partials.length} parties du cours "${name}" :

${body}

---
Résumé :`;
}

*/
module.exports = router;

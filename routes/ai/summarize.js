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
const CHUNK_PARALLEL = 3;  // chunks traités simultanément

function summarizeCacheKey(text, lang, user) {
  const profile = `${user?.level || ''}|${Array.isArray(user?.domains) ? user.domains.join(',') : (user?.domains || '')}`;
  return crypto.createHash('sha256').update(`summarize:v1:${lang}:${profile}:${text}`).digest('hex');
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
       ON CONFLICT (cache_key) DO UPDATE SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at`
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
    const aiCfg  = await getAiConfigForAction('summarize');
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
        fileData.push({ file, chunks, key });
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

    await Promise.all(fileData.map(async ({ file, chunks, key }) => {

      if (chunks.length === 1) {
        // Fichier court : streaming direct
        send({ type: 'start', name: file.name });
        let fullText = '';
        for await (const c of aiStream(promptFull(ctx, inLang, file.name, chunks[0]), calcMaxTokens('summary', chunks[0].length), aiCfg)) {
          if (c.usage) { logTokens(req.user?.id, 'summarize', c.usage.provider, c.usage.input, c.usage.output); continue; }
          fullText += c.text;
          send({ type: 'delta', name: file.name, text: c.text });
          streamModel = c.model;
        }
        send({ type: 'done', name: file.name });
        setCache(key, fullText); // fire-and-forget

      } else {
        // Fichier long : chunks analysés en parallèle (CHUNK_PARALLEL simultanés)
        send({ type: 'progress', name: file.name, step: 0, total: chunks.length,
               message: `Cours volumineux — analyse en ${chunks.length} parties…` });

        const partials = new Array(chunks.length);
        for (let i = 0; i < chunks.length; i += CHUNK_PARALLEL) {
          await Promise.all(
            chunks.slice(i, i + CHUNK_PARALLEL).map(async (chunk, j) => {
              const idx = i + j;
              const { text: partial, usage } = await aiComplete(
                promptPartial(ctx, inLang, file.name, chunk, idx + 1, chunks.length),
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
        for await (const c of aiStream(promptMerge(ctx, inLang, file.name, partials), 3500, aiCfg)) {
          if (c.usage) { logTokens(req.user?.id, 'summarize', c.usage.provider, c.usage.input, c.usage.output); continue; }
          fullText += c.text;
          send({ type: 'delta', name: file.name, text: c.text });
          streamModel = c.model;
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

module.exports = router;

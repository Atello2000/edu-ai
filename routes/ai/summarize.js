const express = require('express');
const router  = express.Router();
const { aiStream, aiComplete, calcMaxTokens, MODEL_LABEL } = require('../../services/ai');
const { getAiConfigForAction }                 = require('../../services/aiConfig');
const { checkAndDeduct, JETON_COSTS }          = require('../../services/jetons');
const { logTokens }                            = require('../../services/tokens');
const logger                                   = require('../../services/logger');
const { VALID_LANGS, langLabel, userContext, getFileText } = require('./helpers');
const { splitIntoChunks, chunkCost }           = require('../../services/chunker');

// POST /api/summarize — résumé pédagogique en streaming SSE (avec chunking)
router.post('/summarize', async (req, res) => {
  req.socket?.setNoDelay(true);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    res.flush?.();
  };

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

    // ── 1. Charger textes + calculer coût total ───────────────────────────
    const fileData  = [];
    let   totalCost = 0;

    for (const file of files) {
      const text   = await getFileText(file);
      const chunks = splitIntoChunks(text);
      totalCost += chunkCost(JETON_COSTS.summarize, chunks.length);
      fileData.push({ file, chunks });
    }

    // ── 2. Vérifier et déduire les jetons ─────────────────────────────────
    const jeton = await checkAndDeduct(req.user?.id, 'summarize', req.user?.plan || 'free', totalCost);
    if (!jeton.ok) {
      send({ type: 'error', message: `Solde insuffisant : ${jeton.needed} jeton${jeton.needed > 1 ? 's' : ''} requis, vous en avez ${jeton.balance}.` });
      return res.end();
    }

    // ── 3. Traiter chaque fichier ──────────────────────────────────────────
    let streamModel = MODEL_LABEL;

    for (const { file, chunks } of fileData) {

      // Texte d'amorce injecté dans la réponse (le prompt se termine par ce header)
      const PRIME = '## 🎯 Objectifs du cours\n';

      if (chunks.length === 1) {
        // ── Fichier court : streaming direct ──────────────────────────────
        send({ type: 'start', name: file.name });
        send({ type: 'delta', name: file.name, text: PRIME }); // header amorcé
        const prompt = promptFull(ctx, inLang, file.name, chunks[0]);
        for await (const c of aiStream(prompt, calcMaxTokens('summary', chunks[0].length), aiCfg)) {
          if (c.usage) { logTokens(req.user?.id, 'summarize', c.usage.provider, c.usage.input, c.usage.output); continue; }
          send({ type: 'delta', name: file.name, text: c.text });
          streamModel = c.model;
        }
        send({ type: 'done', name: file.name });

      } else {
        // ── Fichier long : résumés partiels → fusion streamée ─────────────
        send({ type: 'progress', name: file.name, step: 0, total: chunks.length,
               message: `Cours volumineux — analyse en ${chunks.length} parties…` });

        // Passe 1 : résumer chaque chunk (non-streamé, collecte)
        const partials = [];
        for (let i = 0; i < chunks.length; i++) {
          send({ type: 'progress', name: file.name, step: i + 1, total: chunks.length,
                 message: `Partie ${i + 1}/${chunks.length}…` });

          const { text: partial, usage } = await aiComplete(
            promptPartial(ctx, inLang, file.name, chunks[i], i + 1, chunks.length),
            1200,
            aiCfg,
          );
          if (usage) logTokens(req.user?.id, 'summarize', usage.provider, usage.input, usage.output);
          partials.push(partial);
        }

        // Passe 2 : fusionner et streamer le résumé final
        send({ type: 'start', name: file.name });
        send({ type: 'delta', name: file.name, text: PRIME }); // header amorcé
        const mergeP = promptMerge(ctx, inLang, file.name, partials);
        for await (const c of aiStream(mergeP, 3500, aiCfg)) {
          if (c.usage) { logTokens(req.user?.id, 'summarize', c.usage.provider, c.usage.input, c.usage.output); continue; }
          send({ type: 'delta', name: file.name, text: c.text });
          streamModel = c.model;
        }
        send({ type: 'done', name: file.name });
      }
    }

    send({ type: 'model', name: streamModel });
    send({ type: 'end' });

  } catch (err) {
    logger.error('AI summarize error', { userId: req.user?.id, message: err.message });
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
Résumé :

## 🎯 Objectifs du cours`;
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
Résumé :

## 🎯 Objectifs du cours`;
}

module.exports = router;

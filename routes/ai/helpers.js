/**
 * helpers.js — utilitaires partagés entre toutes les routes IA
 */
const { extractText } = require('../../services/text');

const VALID_LANGS = ['fr', 'en', 'ar'];

function langLabel(lang) {
  return { fr: 'en français', en: 'in English', ar: 'باللغة العربية' }[lang] || 'en français';
}

function userContext(user) {
  if (!user?.level && !user?.domains && !user?.specialty) return '';
  const levelLabels = {
    licence:       'étudiant en Licence (Bac+3)',
    master:        'étudiant en Master (Bac+5)',
    doctorat:      'doctorant (PhD)',
    professionnel: 'professionnel en activité',
    autre:         'apprenant',
  };
  const level = levelLabels[user.level] || '';
  let domains = [];
  try {
    const raw = user.domains;
    domains = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
  } catch {}
  const domStr    = domains.length ? domains.join(', ') : '';
  const specialty = user.specialty?.trim() || '';
  if (!level && !domStr && !specialty) return '';
  const parts = [
    level,
    domStr    ? `spécialisé en ${domStr}` : '',
    specialty ? `avec une spécialité en ${specialty}` : '',
  ].filter(Boolean).join(', ');
  return `[Profil : ${parts}. Adapte ton vocabulaire, tes exemples et ton niveau d'explication en conséquence.]\n\n`;
}

async function getFileText(file) {
  if (file.text) return file.text;
  throw new Error(`Contenu du fichier "${file.name}" indisponible. Veuillez le re-charger.`);
}

/** Extrait le premier objet JSON d'une réponse brute du modèle. */
function parseJsonResponse(raw, fallback) {
  try {
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : stripped);
  } catch { return fallback; }
}

/**
 * Configure les headers SSE, active le nodelay TCP et retourne une fonction `send`.
 * Remplace les 7 lignes de boilerplate répétées dans chaque route SSE.
 *
 * Usage : const send = sseSetup(req, res);
 */
function sseSetup(req, res) {
  req.socket?.setNoDelay(true);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  return (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); res.flush?.(); };
}

module.exports = { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse, sseSetup };

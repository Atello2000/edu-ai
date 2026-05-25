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
  try { domains = JSON.parse(user.domains || '[]'); } catch {}
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
  if (!file.path) throw new Error(`Contenu du fichier "${file.name}" indisponible. Veuillez le re-charger.`);
  return extractText(file.path, file.name);
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

module.exports = { VALID_LANGS, langLabel, userContext, getFileText, parseJsonResponse };

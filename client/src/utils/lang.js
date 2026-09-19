/**
 * lang.js — langue choisie par l'utilisateur (préférences locales).
 *
 * Source unique de vérité côté client : `jangalai-prefs.lang`, alimentée par
 * le SettingsDrawer. Repli sur 'fr' si rien n'est stocké.
 */

const SUPPORTED = ['fr', 'en', 'ar', 'es'];

export function getLang() {
  try {
    const stored = JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang;
    if (stored) return stored;
  } catch { /* prefs illisibles */ }
  // Aucune préférence enregistrée : on suit la langue du navigateur si elle est
  // supportée, sinon français. (Le SettingsDrawer permet de la changer ensuite.)
  try {
    const nav = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(nav)) return nav;
  } catch { /* pas de navigator */ }
  return 'fr';
}

/** Code BCP-47 pour la synthèse vocale / Intl (ex. 'fr' → 'fr-FR', 'ar' → 'ar-SA'). */
const BCP47 = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA', es: 'es-ES' };
export function getSpeechLang() {
  const l = getLang();
  return BCP47[l] || `${l}-${l.toUpperCase()}`;
}

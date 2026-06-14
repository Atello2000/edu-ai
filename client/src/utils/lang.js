/**
 * lang.js — langue choisie par l'utilisateur (préférences locales).
 *
 * Source unique de vérité côté client : `jangalai-prefs.lang`, alimentée par
 * le SettingsDrawer. Repli sur 'fr' si rien n'est stocké.
 */

export function getLang() {
  try {
    return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr';
  } catch {
    return 'fr';
  }
}

/** Code BCP-47 pour la synthèse vocale / Intl (ex. 'fr' → 'fr-FR', 'ar' → 'ar-SA'). */
const BCP47 = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA', es: 'es-ES' };
export function getSpeechLang() {
  const l = getLang();
  return BCP47[l] || `${l}-${l.toUpperCase()}`;
}

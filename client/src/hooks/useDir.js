/**
 * useDir — applique dir="rtl" sur <html> quand la langue est l'arabe.
 *
 * Écoute les changements de préférences utilisateur (localStorage + custom event)
 * et met à jour l'attribut dir + lang de l'élément racine en conséquence.
 */
import { useEffect } from 'react';

const RTL_LANGS = new Set(['ar']);

function applyDir(lang) {
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
  document.documentElement.dir  = dir;
  document.documentElement.lang = lang || 'fr';
}

function getStoredLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

export function useDir() {
  useEffect(() => {
    // Application initiale
    applyDir(getStoredLang());

    // Écouter les changements de langue (via storage event cross-tab ou custom event)
    function onStorage(e) {
      if (e.key === 'jangalai-prefs') applyDir(getStoredLang());
    }
    function onLangChange(e) {
      applyDir(e.detail?.lang || getStoredLang());
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('jangalai:lang', onLangChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('jangalai:lang', onLangChange);
    };
  }, []);
}

/** Utilitaire — à appeler quand l'utilisateur change de langue dans les Settings. */
export function setLang(lang) {
  try {
    const prefs = JSON.parse(localStorage.getItem('jangalai-prefs') || '{}');
    localStorage.setItem('jangalai-prefs', JSON.stringify({ ...prefs, lang }));
  } catch {}
  window.dispatchEvent(new CustomEvent('jangalai:lang', { detail: { lang } }));
  applyDir(lang);
}

/**
 * i18n léger, sans dépendance.
 *
 * - La langue active vient des préférences locales (utils/lang.js), alimentées
 *   par le SettingsDrawer, et se met à jour en direct via l'événement
 *   'jangalai:lang' (déjà émis par setLang) — pas besoin de recharger la page.
 * - Les clés absentes de la langue active retombent sur le français (référence).
 * - Interpolation simple : t('clé', { name: 'Awa' }) remplace {name}.
 *
 * Usage :
 *   const { t, lang } = useT();
 *   t('auth.login')                      // "Se connecter"
 *   t('auth.preview.greeting', { name }) // "Bonjour, Awa — …"
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getLang } from '../utils/lang';
import { translate, FALLBACK } from './translate';

const LangContext = createContext({ lang: FALLBACK, t: (k) => k });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => getLang());

  useEffect(() => {
    const onChange = (e) => setLang(e?.detail?.lang || getLang());
    window.addEventListener('jangalai:lang', onChange);
    window.addEventListener('storage', onChange); // changement de langue cross-onglet
    return () => {
      window.removeEventListener('jangalai:lang', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  return <LangContext.Provider value={{ lang, t }}>{children}</LangContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT() {
  return useContext(LangContext);
}

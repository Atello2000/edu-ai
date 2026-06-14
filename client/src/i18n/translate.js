/**
 * Cœur de traduction (pur, sans React) — séparé du provider pour permettre le
 * fast-refresh côté composants et être réutilisable hors React si besoin.
 */
import fr from './locales/fr';
import en from './locales/en';

export const DICTS = { fr, en };
export const FALLBACK = 'fr';

function resolve(dict, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

export function translate(lang, key, vars) {
  const dict = DICTS[lang] || DICTS[FALLBACK];
  let val = resolve(dict, key);
  if (val == null) val = resolve(DICTS[FALLBACK], key);
  if (val == null) return key;
  if (typeof val === 'string' && vars) {
    return val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
  }
  return val;
}

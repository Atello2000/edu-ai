/**
 * Sélecteur de langue compact pour les écrans publics (landing, connexion).
 * Persiste le choix via setLang (prefs + événement 'jangalai:lang'), ce qui
 * met à jour useT et le sens d'écriture (dir) en direct.
 *
 * On n'expose que les langues dont l'UI est traduite (FR, EN). Les autres
 * langues d'IA restent réglables dans les paramètres une fois connecté.
 */
import { useT } from '../i18n';
import { setLang } from '../hooks/useDir';

const UI_LANGS = [['fr', 'FR'], ['en', 'EN']];

export default function LanguageSwitcher({ className = '' }) {
  const { lang } = useT();
  const current = UI_LANGS.some(([code]) => code === lang) ? lang : 'fr';
  return (
    <select
      className={`lang-switcher ${className}`.trim()}
      value={current}
      onChange={(e) => setLang(e.target.value)}
      aria-label="Langue / Language"
    >
      {UI_LANGS.map(([code, label]) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
}

import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import UserMenu from './UserMenu.jsx';
import JetonWidget from './JetonWidget.jsx';
import { apiFetch } from '../utils/apiFetch';
import eventBus from '../utils/eventBus';
import { useT } from '../i18n';

/**
 * AppHeader — barre supérieure de l'app : retour tableau de bord, logo, jetons, menu.
 *
 * @param {object}   p
 * @param {string}   p.activePanel       — panneau actif (masque le bouton retour sur le dashboard)
 * @param {object}   p.user
 * @param {Function} p.onHome            — retour au tableau de bord
 * @param {Function} p.onOpenSettings
 * @param {Function} p.onTogglePomodoro  - basculer le minuteur Pomodoro
 * @param {boolean}  p.showPomodoro      - si le Pomodoro est affiché
 */
export default function AppHeader({
  activePanel,
  user,
  onHome,
  onOpenSettings,
  onTogglePomodoro,
  showPomodoro,
}) {
  const { t } = useT();
  const [streak, setStreak] = useState(0);
  const [theme, setTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('jangalai-theme') || 'light';
  });

  // Synchroniser le thème si modifié ailleurs (ex: tiroir paramètres)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(currentTheme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('jangalai-theme', nextTheme);
    eventBus.emit('theme:changed', nextTheme);
  }

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function fetchStreak() {
      try {
        const res = await apiFetch('/api/activity/summary');
        if (res.ok && active) {
          const data = await res.json();
          setStreak(data.streak || 0);
        }
      } catch {
        /* Silencieux en production */
      }
    }

    fetchStreak();

    // S'abonner aux rafraîchissements d'activité du dashboard pour actualiser le streak
    const unsubscribe = eventBus.on('dashboard:refresh', fetchStreak);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  return (
    <header className="app-header">
      <button
        className={`back-home-btn${activePanel === 'dashboard-panel' ? ' hidden' : ''}`}
        id="back-home-btn"
        title={t('app.header.home')}
        onClick={onHome}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div className="header-logo" id="header-logo" onClick={onHome} style={{ cursor: 'pointer' }}>
        <Logo />
      </div>
      <div className="header-right">
        {streak > 0 && (
          <div className="streak-badge" title={t('app.header.streak', { n: streak })}>
            🔥 {streak}
          </div>
        )}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? t('app.header.toDark') : t('app.header.toLight')}
        >
          {theme === 'light' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          )}
        </button>
        <button
          className={`pomo-toggle-btn${showPomodoro ? ' active' : ''}`}
          onClick={onTogglePomodoro}
          title={showPomodoro ? t('app.header.pomoClose') : t('app.header.pomoOpen')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="14" r="8" />
            <path d="M10 3h4" />
            <path d="M12 3v3" />
            <path d="M12 10v4l2.5 2.5" />
          </svg>
        </button>
        <JetonWidget user={user} />
        <UserMenu user={user} onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
}


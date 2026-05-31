import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import UserMenu from './UserMenu.jsx';
import JetonWidget from './JetonWidget.jsx';
import { apiFetch } from '../utils/apiFetch';
import eventBus from '../utils/eventBus';

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
  const [streak, setStreak] = useState(0);

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
      } catch (err) {
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
    <header>
      <button
        className={`back-home-btn${activePanel === 'dashboard-panel' ? ' hidden' : ''}`}
        id="back-home-btn"
        title="Tableau de bord"
        onClick={onHome}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div className="header-logo" id="header-logo" onClick={onHome} style={{ cursor: 'pointer' }}>
        <Logo />
      </div>
      <div className="header-right">
        {streak > 0 && (
          <div className="streak-badge" title={`Série d'étude de ${streak} jours ! Gardez le rythme ! 🔥`}>
            🔥 {streak}
          </div>
        )}
        <button
          className={`pomo-toggle-btn${showPomodoro ? ' active' : ''}`}
          onClick={onTogglePomodoro}
          title={showPomodoro ? 'Fermer le minuteur Focus' : 'Ouvrir le minuteur Focus'}
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


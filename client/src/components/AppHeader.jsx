import Logo from './Logo.jsx';
import UserMenu from './UserMenu.jsx';
import JetonWidget from './JetonWidget.jsx';

/**
 * AppHeader — barre supérieure de l'app : retour tableau de bord, logo, jetons, menu.
 *
 * @param {object}   p
 * @param {string}   p.activePanel     — panneau actif (masque le bouton retour sur le dashboard)
 * @param {object}   p.user
 * @param {Function} p.onHome          — retour au tableau de bord
 * @param {Function} p.onOpenSettings
 */
export default function AppHeader({ activePanel, user, onHome, onOpenSettings }) {
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
        <JetonWidget />
        <UserMenu user={user} onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
}

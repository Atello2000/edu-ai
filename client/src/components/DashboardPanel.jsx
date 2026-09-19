import DashboardStats from './DashboardStats.jsx';
import ForYouSection from './ForYouSection.jsx';
import ActivitySection from './ActivitySection.jsx';
import TopicStatsWidget from './TopicStatsWidget.jsx';
import eventBus from '../utils/eventBus';

/**
 * DashboardPanel — contenu du tableau de bord (accueil) : salutation, actions
 * rapides, progression, widgets « pour vous » / SRS / topics, liens du bas.
 * Le wrapper `.panel` (visibilité) reste géré par AppPage.
 */
export default function DashboardPanel({
  greeting, user, lastSession, activityKey,
  onUpload, onContinue, onFolders, onLibrary, onHistory, onStats,
  onLastSession, onActivity, onSRSReview,
}) {
  return (
    <>
      <div className="dash-greeting">
        <h1 className="dash-greeting-title">
          {greeting}{user ? <>, <em>{user.name.split(' ')[0]}</em></> : null}
        </h1>
        <p className="dash-greeting-sub">Que souhaitez-vous réviser aujourd&apos;hui ?</p>
      </div>
      <div className="dash-quick-actions">
        <button className="dash-qaction dq-purple" onClick={onUpload}>
          <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
          <span className="dash-qaction-label">Charger un cours</span>
          <span className="dash-qaction-hint">PDF, PPT, DOCX</span>
        </button>
        <button className="dash-qaction dq-blue" disabled={!lastSession} onClick={onContinue}>
          <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
          <span className="dash-qaction-label">Continuer</span>
          <span className="dash-qaction-hint">{lastSession?.files?.[0] || 'Aucune session'}</span>
        </button>
        <button className="dash-qaction dq-gold" onClick={onFolders}>
          <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
          <span className="dash-qaction-label">Mes matières</span>
          <span className="dash-qaction-hint">Cours classés</span>
        </button>
        <button className="dash-qaction dq-teal" onClick={onLibrary}>
          <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
          <span className="dash-qaction-label">Bibliothèque</span>
          <span className="dash-qaction-hint">Tous les cours</span>
        </button>
      </div>
      <div className="dash-stats-row">
        <div className="panel-header" style={{ marginBottom: '.5rem' }}>
          <div className="panel-label">Progression</div>
          <button className="ghost-btn" onClick={() => eventBus.emit('dashboard:refresh')}>Actualiser</button>
        </div>
        <DashboardStats onLastSession={onLastSession} />
      </div>
      <ForYouSection onActivity={onActivity} onUpload={onUpload} onSRSReview={onSRSReview} />
      <TopicStatsWidget />
      <div className="dash-bottom-links">
        <button className="dash-link" onClick={onHistory}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Mes cours récents
        </button>
        <button className="dash-link" onClick={onStats}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7" rx="1"/><rect x="12" y="7" width="3" height="11" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></svg>
          Statistiques
        </button>
      </div>
      <ActivitySection refreshKey={activityKey} />
    </>
  );
}

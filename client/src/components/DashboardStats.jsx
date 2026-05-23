import { useState, useEffect, useCallback } from 'react';

const QUIZ_STATS_KEY = 'jangalai-quiz-stats';
const SRS_KEY        = 'jangalai-srs';
const HISTORY_KEY    = 'jangalai-sessions';

function readStats() {
  const sessions  = JSON.parse(localStorage.getItem(HISTORY_KEY)    || '[]');
  const quizStats = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY)  || '[]');
  const srsValues = Object.values(JSON.parse(localStorage.getItem(SRS_KEY) || '{}'));
  const dueCards  = srsValues.filter(c => c.nextReview <= Date.now()).length;
  const avgPct    = quizStats.length
    ? Math.round(quizStats.reduce((s, q) => s + q.pct, 0) / quizStats.length)
    : null;
  return { sessions, quizStats, dueCards, avgPct, lastSession: sessions[0] || null };
}

/* ── SVG icons ──────────────────────────────────────────────────────────────── */
const SessionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const QuizIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/>
  </svg>
);
const SrsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/>
  </svg>
);

/**
 * Props :
 *   onLastSession  (session | null) => void  — notifie le parent à chaque refresh
 */
export default function DashboardStats({ onLastSession }) {
  const [stats, setStats] = useState(readStats);

  const refresh = useCallback(() => setStats(readStats()), []);

  // Expose le bridge pour app.js / hooks
  useEffect(() => {
    window.__renderDashboard = refresh;
    return () => { delete window.__renderDashboard; };
  }, [refresh]);

  // Notifie le parent du lastSession courant
  useEffect(() => {
    onLastSession?.(stats.lastSession);
  }, [stats.lastSession, onLastSession]);

  const { dueCards, avgPct, lastSession, quizStats } = stats;

  const cards = [
    {
      label: 'Dernière session',
      icon:  <SessionIcon />,
      value: lastSession ? lastSession.files.slice(0, 2).join(' · ') : 'Aucune',
      note:  lastSession
        ? new Date(lastSession.timestamp).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })
        : 'Chargez un cours pour commencer',
      cls: 'blue',
    },
    {
      label: 'Quiz',
      icon:  <QuizIcon />,
      value: avgPct !== null ? `${avgPct}%` : '—',
      note:  `${quizStats.length} quiz complété${quizStats.length > 1 ? 's' : ''}`,
      cls:   avgPct === null ? 'muted' : avgPct >= 80 ? 'green' : avgPct >= 60 ? 'gold' : 'rose',
    },
    {
      label: 'Révision espacée',
      icon:  <SrsIcon />,
      value: dueCards,
      note:  dueCards ? "cartes dues aujourd'hui" : 'aucune carte due',
      cls:   dueCards ? 'rose' : 'green',
    },
  ];

  return (
    <div className="dashboard-grid">
      {cards.map(c => (
        <div key={c.label} className={`dash-card dash-${c.cls}`}>
          <div className="dash-card-top">
            <span className="dash-card-icon">{c.icon}</span>
            <span className="dash-label">{c.label}</span>
          </div>
          <div className="dash-value" title={String(c.value)}>{c.value}</div>
          <div className="dash-note">{c.note}</div>
        </div>
      ))}
    </div>
  );
}

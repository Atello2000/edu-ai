import { useEffect, useState } from 'react';
import './ActivitySection.css';

const IconChart   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7" rx="1"/><rect x="12" y="7" width="3" height="11" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></svg>;
const IconFlame   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c0 6-6 8-6 13a6 6 0 0 0 12 0c0-5-6-7-6-13z"/><path d="M10 17.5a2.5 2.5 0 0 0 4 0c.5-1-1-2.5-2-3-1 .5-2.5 2-2 3z"/></svg>;
const IconMoon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IconBooks   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
const IconCards   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 2H8a2 2 0 0 0-2 2v2h12V4a2 2 0 0 0-2-2z"/></svg>;
const IconQuiz    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'à l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'hier';
  return `il y a ${days}j`;
}

export default function ActivitySection({ refreshKey }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetch('/api/activity/summary', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.totalSessions !== undefined) setSummary(data); })
      .catch(() => {});
  }, [refreshKey]);

  if (!summary) return null;
  if (summary.totalSessions === 0) return (
    <div className="activity-section activity-empty">
      <div className="act-empty-icon"><IconChart /></div>
      <p>Révisez un sujet pour voir votre progression ici.</p>
    </div>
  );

  const { streak = 0, totalSessions = 0, recentActivity = [], topTopics = [] } = summary;

  return (
    <div className="activity-section">
      <div className="act-stats-row">
        <div className={`act-stat-card act-streak ${streak > 0 ? 'active' : ''}`}>
          <span className="act-stat-icon">{streak > 0 ? <IconFlame /> : <IconMoon />}</span>
          <div>
            <span className="act-stat-val">{streak}</span>
            <span className="act-stat-lbl">jour{streak !== 1 ? 's' : ''} de suite</span>
          </div>
        </div>
        <div className="act-stat-card">
          <span className="act-stat-icon"><IconBooks /></span>
          <div>
            <span className="act-stat-val">{totalSessions}</span>
            <span className="act-stat-lbl">session{totalSessions !== 1 ? 's' : ''} au total</span>
          </div>
        </div>
      </div>

      <div className="act-recent">
        <div className="act-recent-title">Révisions récentes</div>
        <div className="act-recent-list">
          {recentActivity.map((a, i) => (
            <div key={i} className="act-item">
              <span className="act-item-icon">{a.type === 'flashcards' ? <IconCards /> : <IconQuiz />}</span>
              <span className="act-item-topic">{a.topic}</span>
              {a.type === 'quiz' && a.score != null && (
                <span className={`act-item-score ${a.score / a.total >= 0.7 ? 'good' : 'low'}`}>
                  {a.score}/{a.total}
                </span>
              )}
              <span className="act-item-time">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      </div>

      {topTopics.length > 0 && (
        <div className="act-top-topics">
          {topTopics.map((t, i) => (
            <span key={i} className="act-topic-badge">
              {t.topic} <em>{t.n}</em>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

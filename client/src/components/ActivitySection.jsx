import { useEffect, useState } from 'react';
import './ActivitySection.css';

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
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});
  }, [refreshKey]);

  if (!summary) return null;
  if (summary.totalSessions === 0) return (
    <div className="activity-section activity-empty">
      <span className="act-empty-icon">📊</span>
      <p>Révisez un sujet pour voir votre progression ici.</p>
    </div>
  );

  const { streak, totalSessions, recentActivity, topTopics } = summary;

  return (
    <div className="activity-section">
      <div className="act-stats-row">
        <div className={`act-stat-card act-streak ${streak > 0 ? 'active' : ''}`}>
          <span className="act-stat-icon">{streak > 0 ? '🔥' : '💤'}</span>
          <div>
            <span className="act-stat-val">{streak}</span>
            <span className="act-stat-lbl">jour{streak !== 1 ? 's' : ''} de suite</span>
          </div>
        </div>
        <div className="act-stat-card">
          <span className="act-stat-icon">📚</span>
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
              <span className="act-item-icon">{a.type === 'flashcards' ? '🃏' : '❓'}</span>
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

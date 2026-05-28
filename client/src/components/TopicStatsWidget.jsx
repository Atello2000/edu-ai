import { useState, useEffect } from 'react';
import eventBus from '../utils/eventBus';

const TOPIC_KEY = 'jangalai-topic-stats';

function loadTopics() {
  try {
    const raw = JSON.parse(localStorage.getItem(TOPIC_KEY) || '{}');
    return Object.entries(raw).map(([name, { sessions }]) => {
      const avg = Math.round(sessions.reduce((s, x) => s + x.pct, 0) / sessions.length);
      const last = sessions[0];
      return { name: name.replace(/\.[^.]+$/, ''), avg, last: last?.pct ?? avg, sessions: sessions.length };
    }).sort((a, b) => a.avg - b.avg); // tri du plus faible au plus fort
  } catch { return []; }
}

function Badge({ pct }) {
  const color = pct >= 75 ? 'var(--green, #4caf50)' : pct >= 50 ? 'var(--gold, #f5a623)' : 'var(--red, #e53935)';
  return (
    <span className="topic-badge" style={{ background: color }}>
      {pct}%
    </span>
  );
}

/**
 * Widget dashboard — progression par sujet (groupé par fichier source des quiz).
 * N'apparaît que si au moins 2 sujets ont été testés.
 */
export default function TopicStatsWidget() {
  const [topics, setTopics] = useState(loadTopics);

  useEffect(() => {
    const unsub = eventBus.on('stats:refresh', () => setTopics(loadTopics()));
    return unsub;
  }, []);

  if (topics.length < 2) return null;

  const weak   = topics.slice(0, Math.min(3, Math.floor(topics.length / 2)));
  const strong = topics.slice(-Math.min(3, Math.ceil(topics.length / 2))).reverse();

  return (
    <div className="topic-stats-widget">
      <div className="panel-label" style={{ marginBottom: '.6rem' }}>Progression par sujet</div>

      {weak.length > 0 && (
        <div className="topic-group">
          <div className="topic-group-label weak">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3"/></svg>
            À retravailler
          </div>
          {weak.map(t => (
            <div key={t.name} className="topic-row">
              <span className="topic-name" title={t.name}>{t.name}</span>
              <div className="topic-bar-wrap">
                <div className="topic-bar" style={{ width: `${t.avg}%`, background: t.avg < 50 ? 'var(--red,#e53935)' : 'var(--gold,#f5a623)' }} />
              </div>
              <Badge pct={t.avg} />
            </div>
          ))}
        </div>
      )}

      {strong.length > 0 && (
        <div className="topic-group" style={{ marginTop: '.75rem' }}>
          <div className="topic-group-label strong">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Maîtrisé
          </div>
          {strong.map(t => (
            <div key={t.name} className="topic-row">
              <span className="topic-name" title={t.name}>{t.name}</span>
              <div className="topic-bar-wrap">
                <div className="topic-bar" style={{ width: `${t.avg}%`, background: 'var(--green,#4caf50)' }} />
              </div>
              <Badge pct={t.avg} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

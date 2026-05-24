import { useState, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';

const HISTORY_KEY = 'jangalai-sessions';

const TAG_LABELS = [
  { key: 'summaries',  label: 'Résumés',    cls: 'hs' },
  { key: 'quiz',       label: 'Quiz',        cls: 'hq' },
  { key: 'flashcards', label: 'Flashcards',  cls: 'hf' },
  { key: 'examSheet',  label: 'Fiche',       cls: 'he' },
];

export default function HistoryPanel() {
  const [sessions, setSessions] = useState(() =>
    JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  );

  const refresh = useCallback(() =>
    setSessions(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')),
  []);

  useEffect(() => eventBus.on('history:refresh', refresh), [refresh]);

  function deleteSession(id) {
    const updated = sessions.filter(s => s.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setSessions(updated);
    eventBus.emit('dashboard:refresh');
  }

  function clearAll() {
    localStorage.removeItem(HISTORY_KEY);
    setSessions([]);
    eventBus.emit('dashboard:refresh');
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-label">Sessions récentes</div>
          <h2 className="panel-title">Mes <em>cours</em></h2>
        </div>
        <button className="ghost-btn" onClick={clearAll}>Tout effacer</button>
      </div>

      <div id="history-list">
        {sessions.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
            Aucune session sauvegardée.
          </p>
        ) : (
          sessions.map(s => {
            const date = new Date(s.timestamp).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            });
            return (
              <div
                key={s.id}
                className="history-item"
                onClick={() => window.__restoreSession?.(s)}
              >
                <div className="history-left">
                  <div className="history-files">{s.files.join(' · ')}</div>
                  <div className="history-meta">{date}</div>
                  <div className="history-tags">
                    {TAG_LABELS.filter(t => s[t.key]).map(t => (
                      <span key={t.key} className={`htag ${t.cls}`}>{t.label}</span>
                    ))}
                  </div>
                </div>
                <button
                  className="history-del"
                  title="Supprimer"
                  onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                >✕</button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

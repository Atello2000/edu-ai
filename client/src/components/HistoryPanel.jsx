import { useState, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';
import { idb } from '../utils/idb';
import { getSessions } from '../hooks/useSessions';

const HISTORY_KEY = 'jangalai-sessions';

const TAG_LABELS = [
  { key: 'summaries',  label: 'Résumés',    cls: 'hs' },
  { key: 'quiz',       label: 'Quiz',        cls: 'hq' },
  { key: 'flashcards', label: 'Flashcards',  cls: 'hf' },
  { key: 'examSheet',  label: 'Fiche',       cls: 'he' },
];

const MAX_SESSIONS = { free: 10, pro: 30, max: Infinity };

export default function HistoryPanel({ onRestore, userPlan }) {
  // Init synchrone depuis localStorage (rendu immédiat), puis IDB prend le relai
  const [sessions, setSessions] = useState(() => getSessions());

  const refresh = useCallback(async () => {
    try {
      const rows = await idb.getAll('sessions');
      setSessions(rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    } catch {
      setSessions(getSessions());
    }
  }, []);

  // Charger depuis IDB au montage + écouter les rafraîchissements
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => eventBus.on('history:refresh', refresh), [refresh]);

  async function deleteSession(id) {
    try {
      await idb.delete('sessions', id);
      // Miroir localStorage
      const updated = getSessions().filter(s => s.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      const updated = getSessions().filter(s => s.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    }
    setSessions(prev => prev.filter(s => s.id !== id));
    eventBus.emit('dashboard:refresh');
  }

  async function clearAll() {
    try {
      await idb.clear('sessions');
    } catch { /* silencieux */ }
    localStorage.removeItem(HISTORY_KEY);
    setSessions([]);
    eventBus.emit('dashboard:refresh');
  }

  const limit    = MAX_SESSIONS[userPlan] ?? 10;
  const count    = sessions.length;
  const atLimit  = limit !== Infinity && count >= limit;
  const nearLimit= limit !== Infinity && count >= Math.floor(limit * 0.8);

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-label">Sessions récentes</div>
          <h2 className="panel-title">Mes <em>cours</em></h2>
        </div>
        <button className="ghost-btn" onClick={clearAll}>Tout effacer</button>
      </div>

      {/* Compteur de sessions par plan */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '.5rem',
        marginBottom: '.75rem', fontSize: '.78rem',
        color: atLimit ? 'var(--danger, #ef4444)' : nearLimit ? 'var(--warning, #f59e0b)' : 'var(--muted)',
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v4"/>
        </svg>
        {limit === Infinity
          ? <span>{count} session{count !== 1 ? 's' : ''} sauvegardée{count !== 1 ? 's' : ''}</span>
          : <span>{count} / {limit} sessions{atLimit ? ' — limite atteinte' : nearLimit ? ' — presque plein' : ''}</span>
        }
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
                onClick={() => onRestore?.(s)}
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

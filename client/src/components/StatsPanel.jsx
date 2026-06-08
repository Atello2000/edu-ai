import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch';
import eventBus from '../utils/eventBus';
import { useConfirm } from './ConfirmModal';

const QUIZ_STATS_KEY  = 'jangalai-quiz-stats';
const HISTORY_KEY     = 'jangalai-sessions';
const SRS_KEY         = 'jangalai-srs';
const TOPIC_STATS_KEY = 'jangalai-topic-stats';

function scoreClass(p) { return p >= 80 ? 'good' : p >= 60 ? 'mid' : 'low'; }

function readData() {
  const quizStats  = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '[]');
  const sessions   = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const srsCards   = Object.values(JSON.parse(localStorage.getItem(SRS_KEY) || '{}'));
  const topicRaw   = JSON.parse(localStorage.getItem(TOPIC_STATS_KEY) || '{}');

  const parCours = Object.entries(topicRaw).map(([name, { sessions: s }]) => {
    const avg  = Math.round(s.reduce((acc, x) => acc + x.pct, 0) / s.length);
    const best = Math.max(...s.map(x => x.pct));
    return { name: name.replace(/\.[^.]+$/, ''), sessions: s.length, avg, best };
  }).sort((a, b) => a.avg - b.avg);

  return {
    quiz: {
      done:    quizStats.length,
      avg:     quizStats.length ? Math.round(quizStats.reduce((s, x) => s + x.pct, 0) / quizStats.length) : null,
      best:    quizStats.length ? Math.max(...quizStats.map(x => x.pct)) : null,
      history: quizStats.slice(0, 6),
    },
    srs: {
      seen:     srsCards.length,
      mastered: srsCards.filter(c => c.interval >= 7).length,
      due:      srsCards.filter(c => c.nextReview <= Date.now()).length,
    },
    sessions: {
      total:      sessions.length,
      summaries:  sessions.filter(s => s.summaries).length,
      quizzes:    sessions.filter(s => s.quiz).length,
      flashcards: sessions.filter(s => s.flashcards).length,
    },
    parCours,
  };
}

export default function StatsPanel() {
  const [data,    setData]    = useState(() => readData());
  const [mastery, setMastery] = useState([]);
  const confirm = useConfirm();

  const refresh = useCallback(() => setData(readData()), []);

  useEffect(() => eventBus.on('stats:refresh', refresh), [refresh]);

  useEffect(() => {
    apiFetch('/api/activity/summary')
      .then(r => r.json())
      .then(d => setMastery(d.bestScores || []))
      .catch(() => {});
  }, []);

  async function reset() {
    const ok = await confirm("Réinitialiser l'historique des quiz ?", { confirmLabel: 'Réinitialiser', danger: true });
    if (!ok) return;
    localStorage.removeItem(QUIZ_STATS_KEY);
    refresh();
    eventBus.emit('dashboard:refresh');
  }

  const { quiz, srs, sessions, parCours } = data;

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-label">Progression</div>
          <h2 className="panel-title">Mes <em>statistiques</em></h2>
        </div>
        <button className="ghost-btn" onClick={reset}>Réinitialiser quiz</button>
      </div>

      <div className="stats-section">
        <div className="stats-section-title">Quiz</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number stat-blue">{quiz.done}</div>
            <div className="stat-label">quiz complétés</div>
          </div>
          <div className="stat-card">
            <div className={`stat-number stat-${quiz.avg !== null ? scoreClass(quiz.avg) : 'muted-num'}`}>
              {quiz.avg !== null ? `${quiz.avg}%` : '—'}
            </div>
            <div className="stat-label">score moyen</div>
          </div>
          <div className="stat-card">
            <div className={`stat-number stat-${quiz.best !== null ? scoreClass(quiz.best) : 'muted-num'}`}>
              {quiz.best !== null ? `${quiz.best}%` : '—'}
            </div>
            <div className="stat-label">meilleur score</div>
          </div>
        </div>
        <div className="quiz-history">
          {quiz.history.map((s, i) => {
            const d = new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={i} className="quiz-history-item">
                <span>{d}</span>
                <span>{s.correct}/{s.total} correctes</span>
                <span className={`quiz-score-badge quiz-score-${scoreClass(s.pct)}`}>{s.pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stats-section">
        <div className="stats-section-title">Flashcards · révision espacée</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number stat-purple">{srs.seen}</div>
            <div className="stat-label">cartes vues</div>
          </div>
          <div className="stat-card">
            <div className="stat-number stat-good">{srs.mastered}</div>
            <div className="stat-label">maîtrisées (≥7j)</div>
          </div>
          <div className="stat-card">
            <div className={`stat-number stat-${srs.due > 0 ? 'low' : 'good'}`}>{srs.due}</div>
            <div className="stat-label">dues aujourd'hui</div>
          </div>
        </div>
      </div>

      {parCours.length > 0 && (
        <div className="stats-section">
          <div className="stats-section-title">Progression par cours (quiz)</div>
          <div className="mastery-list">
            {parCours.map((c, i) => {
              const cls = c.avg >= 80 ? 'good' : c.avg >= 60 ? 'mid' : 'low';
              return (
                <div key={i} className="mastery-row">
                  <div className="mastery-topic" title={c.name}>{c.name}</div>
                  <div className="mastery-track">
                    <div className={`mastery-fill mastery-${cls}`} style={{ width: `${c.avg}%` }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <div className={`mastery-pct mastery-pct-${cls}`}>{c.avg}%</div>
                    <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>{c.sessions}×</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mastery.length > 0 && (
        <div className="stats-section">
          <div className="stats-section-title">Meilleur score par cours</div>
          <div className="mastery-list">
            {mastery.slice(0, 8).map((s, i) => {
              const pct = Math.round((parseFloat(s.best_pct) || 0) * 100);
              const cls = pct >= 80 ? 'good' : pct >= 60 ? 'mid' : 'low';
              const name = s.topic.replace(/\.[^.]+$/, '');
              return (
                <div key={i} className="mastery-row">
                  <div className="mastery-topic" title={s.topic}>{name}</div>
                  <div className="mastery-track">
                    <div className={`mastery-fill mastery-${cls}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={`mastery-pct mastery-pct-${cls}`}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="stats-section">
        <div className="stats-section-title">Sessions</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number stat-blue">{sessions.total}</div>
            <div className="stat-label">sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-number stat-muted-num">{sessions.summaries}</div>
            <div className="stat-label">résumés</div>
          </div>
          <div className="stat-card">
            <div className="stat-number stat-muted-num">{sessions.quizzes}</div>
            <div className="stat-label">quiz</div>
          </div>
          <div className="stat-card">
            <div className="stat-number stat-muted-num">{sessions.flashcards}</div>
            <div className="stat-label">flashcards</div>
          </div>
        </div>
      </div>
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';
import { useConfirm } from './ConfirmModal';

const QUIZ_STATS_KEY = 'jangalai-quiz-stats';
const HISTORY_KEY    = 'jangalai-sessions';
const SRS_KEY        = 'jangalai-srs';

function scoreClass(p) { return p >= 80 ? 'good' : p >= 60 ? 'mid' : 'low'; }

function readData() {
  const quizStats = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '[]');
  const sessions  = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const srsCards  = Object.values(JSON.parse(localStorage.getItem(SRS_KEY) || '{}'));
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
  };
}

export default function StatsPanel() {
  const [data, setData] = useState(() => readData());
  const confirm = useConfirm();

  const refresh = useCallback(() => setData(readData()), []);

  useEffect(() => eventBus.on('stats:refresh', refresh), [refresh]);

  async function reset() {
    const ok = await confirm("Réinitialiser l'historique des quiz ?", { confirmLabel: 'Réinitialiser', danger: true });
    if (!ok) return;
    localStorage.removeItem(QUIZ_STATS_KEY);
    refresh();
    eventBus.emit('dashboard:refresh');
  }

  const { quiz, srs, sessions } = data;

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

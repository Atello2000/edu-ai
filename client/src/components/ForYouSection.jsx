import { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../utils/apiFetch';
import { getLang } from '../utils/lang';
import toast from '../utils/toast';
import { useAuth } from '../hooks/useAuth';
import { sm2Update, cardHash } from '../hooks/useFlashcards.js';
import './ForYouSection.css';

const IconCards  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 2H8a2 2 0 0 0-2 2v2h12V4a2 2 0 0 0-2-2z"/></svg>;
const IconQuiz   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>;
const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
const IconDoc    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;

const HISTORY_KEY   = 'jangalai-sessions';
const SRS_KEY       = 'jangalai-srs';
const EXAM_DATE_KEY = 'jangalai-exam-date';

/** Supprime les marqueurs Markdown courants (gras, italique, code) du texte affiché. */
function stripMd(text = '') {
  return String(text)
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/\*(.*?)\*/gs,     '$1')
    .replace(/__(.*?)__/gs,     '$1')
    .replace(/_(.*?)_/gs,       '$1')
    .replace(/`([^`]+)`/g,      '$1');
}

function cleanName(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')       // supprimer extension
    .replace(/[_-]+/g, ' ')        // _ et - → espace
    .replace(/\s+/g, ' ')
    .trim();
}

function timeAgo(ts) {
  const h = (Date.now() - ts) / 3600000;
  if (h < 1)   return "il y a moins d'1h";
  if (h < 24)  return `il y a ${Math.floor(h)}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'hier';
  if (d < 7)   return `il y a ${d} jours`;
  if (d < 14)  return 'il y a 1 semaine';
  return `il y a ${Math.floor(d / 7)} semaines`;
}

async function postActivity(topic, type, score = null, total = null) {
  await apiFetch('/api/activity', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, type, score, total }),
  }).catch(() => {});
}

export default function ForYouSection({ onActivity, onUpload, onSRSReview }) {
  const { user } = useAuth();
  const [custom, setCustom]           = useState('');
  const [loadingKey, setLoadingKey]   = useState('');
  const [result, setResult]           = useState(null);
  const [resultType, setResultType]   = useState('');
  const [resultTopic, setResultTopic] = useState('');
  const [fcIdx, setFcIdx]             = useState(0);
  const [flipped, setFlipped]         = useState(false);
  const touchStartX = useRef(null);
  const [activityData, setActivityData] = useState(null);
  const [examDate, setExamDate] = useState(() => localStorage.getItem(EXAM_DATE_KEY) || '');
  const activitySummaryUrl = `/api/activity/summary${examDate ? `?examDate=${encodeURIComponent(examDate)}` : ''}`;
  const [historyKey, setHistoryKey]   = useState(0); // incrémenté pour forcer un recalcul
  const cache = useRef(new Map());

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    cache.current.clear();
    setResult(null);
    setHistoryKey(k => k + 1);
  }

  // ── Sujets récents depuis l'historique localStorage ───────────────
  const recentTopics = useMemo(() => {
    try {
      const sessions = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const seen = new Set();
      const topics = [];
      for (const s of sessions) {
        for (const fname of (s.files || [])) {
          const name = cleanName(fname);
          if (name && !seen.has(name)) {
            seen.add(name);
            topics.push({ name, timestamp: s.timestamp || 0 });
          }
        }
        if (topics.length >= 6) break;
      }
      return topics;
    } catch { return []; }
  }, [historyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Charger les scores d'activité ─────────────────────────────────
  useEffect(() => {
    if (!user?.onboarding_done) return;
    apiFetch(activitySummaryUrl)
      .then(r => r.json())
      .then(d => setActivityData(d))
      .catch(() => {});
  }, [user?.id, user?.onboarding_done, activitySummaryUrl]);

  // Meilleur score pour un topic donné
  function getBestScore(topicName) {
    if (!activityData?.bestScores?.length) return null;
    const key = topicName.toLowerCase().slice(0, 20);
    const match = activityData.bestScores.find(b =>
      b.topic.toLowerCase().includes(key) ||
      key.includes(b.topic.toLowerCase().slice(0, 15))
    );
    if (!match || !match.total) return null;
    return {
      score: match.score,
      total: match.total,
      pct: Math.round(match.best_pct * 100),
    };
  }

  // ── Générer flashcards ou quiz ────────────────────────────────────
  async function generate(topic, type) {
    const key = `${topic}|${type}`;
    if (cache.current.has(key)) {
      const cached = cache.current.get(key);
      setResult(cached); setResultType(type); setResultTopic(topic);
      setFcIdx(0); setFlipped(false);
      return;
    }
    setLoadingKey(key); setResult(null);
    try {
      const r = await apiFetch('/api/topic', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, type, count: type === 'quiz' ? 5 : 8, lang: getLang() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      cache.current.set(key, data);
      setResult(data); setResultType(type); setResultTopic(topic);
      setFcIdx(0); setFlipped(false);
      if (type === 'flashcards') postActivity(topic, 'flashcards').then(() => onActivity?.());
    } catch (err) { toast.error(err.message); }
    finally { setLoadingKey(''); }
  }

  function handleQuizComplete(score, total) {
    postActivity(resultTopic, 'quiz', score, total).then(() => {
      onActivity?.();
      setActivityData(null);
      apiFetch(activitySummaryUrl)
        .then(r => r.json()).then(d => setActivityData(d)).catch(() => {});
    });
  }

  if (!user?.onboarding_done) return null;
  const isLoading = loadingKey !== '';

  let dueCards = 0;
  try {
    dueCards = Object.values(JSON.parse(localStorage.getItem(SRS_KEY) || '{}'))
      .filter(card => card.nextReview <= Date.now() && card.front).length;
  } catch { /* stockage local illisible */ }

  const masteryTopics = activityData?.mastery || [];
  const weakestTopic = masteryTopics.find(topic => topic.mastery < 75);
  const testedNames = new Set(masteryTopics.map(topic => topic.topic.toLocaleLowerCase('fr')));
  const untestedTopic = recentTopics.find(topic => !testedNames.has(topic.name.toLocaleLowerCase('fr')));
  const dailyPlan = activityData?.dailyPlan;

  let examDays = null;
  if (examDate) {
    const end = new Date(`${examDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDays = Math.max(0, Math.round((end.getTime() - today.getTime()) / 86400000));
  }

  const priority = dueCards > 0
    ? {
        eyebrow: 'Mémoire à consolider',
        title: `Réviser ${dueCards} carte${dueCards > 1 ? 's' : ''} due${dueCards > 1 ? 's' : ''}`,
        detail: 'Commencez par les notions que vous risquez d’oublier aujourd’hui.',
        action: 'Lancer la révision',
        tone: 'teal',
        run: onSRSReview,
      }
    : weakestTopic
      ? {
          eyebrow: 'Point faible détecté',
          title: `Retravailler ${weakestTopic.topic}`,
          detail: `Votre maîtrise est estimée à ${weakestTopic.mastery} %. Un quiz ciblé est prioritaire.`,
          action: 'Faire un quiz ciblé',
          tone: 'rose',
          run: () => generate(weakestTopic.topic, 'quiz'),
        }
      : untestedTopic
        ? {
            eyebrow: 'Diagnostic recommandé',
            title: `Tester ${untestedTopic.name}`,
            detail: 'Ce cours n’a pas encore été évalué. Mesurez votre maîtrise avant de le relire.',
            action: 'Lancer le diagnostic',
            tone: 'blue',
            run: () => generate(untestedTopic.name, 'quiz'),
          }
        : {
            eyebrow: 'Commencer une session',
            title: 'Ajoutez votre prochain cours',
            detail: 'Jangalai pourra ensuite identifier les notions à réviser en priorité.',
            action: 'Charger un cours',
            tone: 'gold',
            run: onUpload,
          };

  function updateExamDate(value) {
    setExamDate(value);
    if (value) localStorage.setItem(EXAM_DATE_KEY, value);
    else localStorage.removeItem(EXAM_DATE_KEY);
  }

  return (
    <div className="foryou-section">

      <section className={`daily-priority daily-${priority.tone}`} aria-labelledby="daily-priority-title">
        <div className="daily-priority-copy">
          <span className="daily-eyebrow">{priority.eyebrow}</span>
          <h2 id="daily-priority-title">{priority.title}</h2>
          <p>{priority.detail}</p>
        </div>
        <button className="daily-primary-action" onClick={priority.run} disabled={!priority.run || isLoading}>
          {isLoading ? 'Préparation…' : priority.action}
        </button>
      </section>

      <div className="daily-exam-row">
        <div>
          <span className="daily-exam-label">Prochain examen</span>
          <span className="daily-exam-status">
            {examDays === null ? 'Ajoutez une date pour rythmer votre préparation' : examDays === 0 ? "Aujourd’hui" : `J-${examDays}`}
          </span>
        </div>
        <input
          type="date"
          value={examDate}
          min={new Date().toISOString().slice(0, 10)}
          onChange={event => updateExamDate(event.target.value)}
          aria-label="Date du prochain examen"
        />
      </div>

      {dailyPlan?.tasks?.length > 0 && (
        <div className="daily-plan" aria-label="Programme de révision du jour">
          <div className="daily-plan-header">
            <div>
              <span className="daily-plan-title">Programme du jour</span>
              <span className="daily-plan-meta">
                {dailyPlan.plannedMinutes} min planifiées · objectif {dailyPlan.targetMinutes} min
              </span>
            </div>
            {dailyPlan.examDays !== null && <span className="daily-plan-countdown">J-{dailyPlan.examDays}</span>}
          </div>
          <ol className="daily-plan-list">
            {dailyPlan.tasks.map((task, index) => (
              <li key={`${task.type}-${task.topic || index}`}>
                <span className="daily-plan-index">{index + 1}</span>
                <button
                  onClick={() => task.type === 'srs' ? onSRSReview?.() : generate(task.topic, 'quiz')}
                  disabled={isLoading}
                >
                  <span className="daily-plan-task">{task.title}</span>
                  <span className="daily-plan-reason">{task.reason}</span>
                </button>
                <span className="daily-plan-minutes">{task.minutes} min</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Révisions secondaires */}
      <div className="foryou-header">
        <span className="foryou-title">Mes cours à réviser</span>
        {recentTopics.length > 0 && (
          <button className="fy-clear-btn" onClick={clearHistory} title="Effacer l'historique">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Effacer
          </button>
        )}
      </div>

      {/* Cartes fichiers récents */}
      {recentTopics.length > 0 ? (
        <div className="fy-courses-list">
          {recentTopics.map(t => {
            const sc = getBestScore(t.name);
            const metaCls = sc ? (sc.pct >= 70 ? 'good' : 'low') : 'neutral';
            return (
              <div key={t.name} className="fy-course-card">
                <div className="fy-course-left">
                  <span className="fy-course-icon"><IconDoc /></span>
                  <div className="fy-course-info">
                    <span className="fy-course-name">{t.name}</span>
                    <span className={`fy-course-meta ${metaCls}`}>
                      {sc
                        ? `${sc.score}/${sc.total} · ${sc.pct}%${sc.pct < 70 ? ' · à retravailler' : ''}`
                        : `Jamais testé · ${timeAgo(t.timestamp)}`}
                    </span>
                  </div>
                </div>
                <div className="fy-course-actions">
                  <button
                    className="fy-card-btn fy-flash"
                    disabled={isLoading}
                    onClick={() => generate(t.name, 'flashcards')}
                  >
                    {loadingKey === `${t.name}|flashcards`
                      ? <span className="fy-btn-spinner" />
                      : <IconCards />} Flash
                  </button>
                  <button
                    className="fy-card-btn fy-quiz"
                    disabled={isLoading}
                    onClick={() => generate(t.name, 'quiz')}
                  >
                    {loadingKey === `${t.name}|quiz`
                      ? <span className="fy-btn-spinner" />
                      : <IconQuiz />} Quiz
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="fy-empty">
          <IconDoc />
          <span>Chargez un cours pour voir vos révisions ici</span>
        </div>
      )}

      {/* Recherche libre */}
      <div className="foryou-search">
        <div className="fy-search-wrap">
          <span className="fy-search-icon"><IconSearch /></span>
          <input
            className="fy-search-input"
            type="text"
            placeholder="Réviser un autre sujet…"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) generate(custom.trim(), 'quiz'); }}
          />
        </div>
        {custom.trim() && (
          <div className="fy-action-bar">
            <button
              className="fy-action-btn fy-flash"
              disabled={isLoading}
              onClick={() => generate(custom.trim(), 'flashcards')}
            >
              {loadingKey === `${custom.trim()}|flashcards` ? <span className="fy-btn-spinner" /> : <IconCards />} Flashcards
            </button>
            <button
              className="fy-action-btn fy-quiz"
              disabled={isLoading}
              onClick={() => generate(custom.trim(), 'quiz')}
            >
              {loadingKey === `${custom.trim()}|quiz` ? <span className="fy-btn-spinner" /> : <IconQuiz />} Quiz
            </button>
          </div>
        )}
      </div>

      {/* Modal résultat */}
      {result && (
        <div className="fy-result-overlay" onClick={e => { if (e.target === e.currentTarget) setResult(null); }}>
          <div className="fy-result-modal">
            <div className="fy-result-header">
              <div>
                <span className="fy-result-type">
                  {resultType === 'flashcards' ? <><IconCards /> Flashcards</> : <><IconQuiz /> Quiz</>}
                </span>
                <span className="fy-result-topic">{resultTopic}</span>
              </div>
              <button className="fy-close-btn" onClick={() => setResult(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {resultType === 'flashcards' && result.flashcards?.length > 0 && (
              <div className="fy-fc-area">
                <div
                  className={`fy-fc-card ${flipped ? 'flipped' : ''}`}
                  onClick={() => setFlipped(f => !f)}
                  onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                  onTouchEnd={e => {
                    if (touchStartX.current === null) return;
                    const dx = e.changedTouches[0].clientX - touchStartX.current;
                    touchStartX.current = null;
                    if (Math.abs(dx) < 40) return; // tap → retourner la carte
                    if (dx < 0 && fcIdx < result.flashcards.length - 1) {
                      setFcIdx(i => i + 1); setFlipped(false); // swipe gauche → suivante
                    } else if (dx > 0 && fcIdx > 0) {
                      setFcIdx(i => i - 1); setFlipped(false); // swipe droite → précédente
                    }
                  }}
                >
                  <div className="fy-fc-front">
                    <span className="fy-fc-hint">Question — cliquez pour retourner</span>
                    <p>{stripMd(result.flashcards[fcIdx]?.front)}</p>
                  </div>
                  <div className="fy-fc-back">
                    <span className="fy-fc-hint">Réponse</span>
                    <p>{stripMd(result.flashcards[fcIdx]?.back)}</p>
                  </div>
                </div>
                <div className="fy-fc-nav">
                  <button onClick={() => { setFcIdx(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={fcIdx === 0}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  </button>
                  <span>{fcIdx + 1} / {result.flashcards.length}</span>
                  <button onClick={() => { setFcIdx(i => Math.min(result.flashcards.length - 1, i + 1)); setFlipped(false); }} disabled={fcIdx === result.flashcards.length - 1}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </button>
                  <button
                    className="fy-srs-btn"
                    title="Ajouter toutes les cartes au SRS (révision espacée)"
                    onClick={() => {
                      result.flashcards.forEach(c => {
                        if (c.front) sm2Update(cardHash(c.front), 0, c);
                      });
                      toast.success(`${result.flashcards.length} carte${result.flashcards.length > 1 ? 's' : ''} ajoutée${result.flashcards.length > 1 ? 's' : ''} au SRS`);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                    SRS
                  </button>
                </div>
              </div>
            )}

            {resultType === 'quiz' && result.questions?.length > 0 && (
              <QuizArea questions={result.questions} onComplete={handleQuizComplete} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composants Quiz ───────────────────────────────────────────────────────────

/**
 * QuizArea — une question à la fois.
 * L'utilisateur choisit une réponse → feedback immédiat → bouton "Suivant".
 */
function QuizArea({ questions, onComplete }) {
  const [current,  setCurrent]  = useState(0);
  const [selected, setSelected] = useState(null); // lettre choisie
  const [history,  setHistory]  = useState([]);   // [{s: choix, c: correct}]
  const [finished, setFinished] = useState(false);

  const total   = questions.length;
  const q       = questions[current];
  const correct = q?.answer?.charAt(0);

  function handleSelect(letter) {
    if (selected !== null) return;
    setSelected(letter);
  }

  function handleNext() {
    const newHistory = [...history, { s: selected, c: correct }];
    if (current + 1 < total) {
      setHistory(newHistory);
      setCurrent(c => c + 1);
      setSelected(null);
    } else {
      setHistory(newHistory);
      setFinished(true);
      const score = newHistory.filter(r => r.s === r.c).length;
      onComplete?.(score, total);
    }
  }

  if (finished) {
    const score = history.filter(r => r.s === r.c).length;
    const pct   = Math.round(score / total * 100);
    return (
      <div className="fy-quiz-area">
        <div className="fy-quiz-score">
          <span className={pct >= 70 ? 'good' : 'low'}>
            {score} / {total} — {pct} %
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fy-quiz-area">
      <div className="fy-quiz-progress">{current + 1} / {total}</div>
      <QuizQuestion q={q} idx={current} selected={selected} onSelect={handleSelect} />
      {selected && (
        <button className="fy-quiz-next" onClick={handleNext}>
          {current + 1 < total ? 'Question suivante →' : 'Voir les résultats'}
        </button>
      )}
    </div>
  );
}

function QuizQuestion({ q, idx, selected, onSelect }) {
  const correct = q.answer?.charAt(0);
  return (
    <div className="fy-quiz-q">
      <p className="fy-quiz-question">
        <strong>{idx + 1}.</strong> {stripMd(q.question)}
      </p>
      <div className="fy-quiz-options">
        {q.options?.map((opt, i) => {
          const letter     = String.fromCharCode(65 + i);
          const isCorrect  = letter === correct;
          const isSelected = selected === letter;
          let cls = 'fy-quiz-opt';
          if (selected) cls += isCorrect ? ' correct' : isSelected ? ' wrong' : '';
          return (
            <button key={i} className={cls} onClick={() => !selected && onSelect(letter)}>
              {stripMd(opt)}
            </button>
          );
        })}
      </div>
      {selected && <p className="fy-quiz-expl">{stripMd(q.explanation)}</p>}
    </div>
  );
}

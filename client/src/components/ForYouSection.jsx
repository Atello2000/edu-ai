import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import './ForYouSection.css';

const IconCards  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 2H8a2 2 0 0 0-2 2v2h12V4a2 2 0 0 0-2-2z"/></svg>;
const IconQuiz   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>;
const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
const IconDoc    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;

const HISTORY_KEY = 'jangalai-sessions';

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
  await fetch('/api/activity', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, type, score, total }),
  }).catch(() => {});
}

export default function ForYouSection({ onActivity }) {
  const { user } = useAuth();
  const [custom, setCustom]           = useState('');
  const [loadingKey, setLoadingKey]   = useState('');
  const [result, setResult]           = useState(null);
  const [resultType, setResultType]   = useState('');
  const [resultTopic, setResultTopic] = useState('');
  const [fcIdx, setFcIdx]             = useState(0);
  const [flipped, setFlipped]         = useState(false);
  const [activityData, setActivityData] = useState(null);
  const cache = useRef(new Map());

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
  }, []);

  // ── Charger les scores d'activité ─────────────────────────────────
  useEffect(() => {
    if (!user?.onboarding_done) return;
    fetch('/api/activity/summary', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setActivityData(d))
      .catch(() => {});
  }, [user?.id]);

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
      const r = await fetch('/api/topic', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, type, count: type === 'quiz' ? 5 : 8, lang: 'fr' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      cache.current.set(key, data);
      setResult(data); setResultType(type); setResultTopic(topic);
      setFcIdx(0); setFlipped(false);
      if (type === 'flashcards') postActivity(topic, 'flashcards').then(() => onActivity?.());
    } catch (err) { alert(err.message); }
    finally { setLoadingKey(''); }
  }

  function handleQuizComplete(score, total) {
    postActivity(resultTopic, 'quiz', score, total).then(() => {
      onActivity?.();
      setActivityData(null);
      fetch('/api/activity/summary', { credentials: 'include' })
        .then(r => r.json()).then(d => setActivityData(d)).catch(() => {});
    });
  }

  if (!user?.onboarding_done) return null;
  const isLoading = loadingKey !== '';

  return (
    <div className="foryou-section">

      {/* Titre */}
      <div className="foryou-header">
        <span className="foryou-title">Révision rapide</span>
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
              <button className="fy-close-btn" onClick={() => setResult(null)}>✕</button>
            </div>

            {resultType === 'flashcards' && result.flashcards?.length > 0 && (
              <div className="fy-fc-area">
                <div
                  className={`fy-fc-card ${flipped ? 'flipped' : ''}`}
                  onClick={() => setFlipped(f => !f)}
                >
                  <div className="fy-fc-front">
                    <span className="fy-fc-hint">Question — cliquez pour retourner</span>
                    <p>{result.flashcards[fcIdx]?.front}</p>
                  </div>
                  <div className="fy-fc-back">
                    <span className="fy-fc-hint">Réponse</span>
                    <p>{result.flashcards[fcIdx]?.back}</p>
                  </div>
                </div>
                <div className="fy-fc-nav">
                  <button onClick={() => { setFcIdx(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={fcIdx === 0}>←</button>
                  <span>{fcIdx + 1} / {result.flashcards.length}</span>
                  <button onClick={() => { setFcIdx(i => Math.min(result.flashcards.length - 1, i + 1)); setFlipped(false); }} disabled={fcIdx === result.flashcards.length - 1}>→</button>
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
function QuizArea({ questions, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [logged, setLogged]   = useState(false);

  function handleSelect(idx, letter) {
    if (answers[idx] !== undefined) return;
    const newAnswers = { ...answers, [idx]: letter };
    setAnswers(newAnswers);
    if (!logged && Object.keys(newAnswers).length === questions.length) {
      setLogged(true);
      const score = questions.filter((q, i) => q.answer?.charAt(0) === newAnswers[i]).length;
      onComplete?.(score, questions.length);
    }
  }

  const answered = Object.keys(answers).length;
  const total    = questions.length;

  return (
    <div className="fy-quiz-area">
      {answered === total && (
        <div className="fy-quiz-score">
          {(() => {
            const score = questions.filter((q, i) => q.answer?.charAt(0) === answers[i]).length;
            const pct   = Math.round(score / total * 100);
            return <span className={pct >= 70 ? 'good' : 'low'}>{score}/{total} — {pct}%</span>;
          })()}
        </div>
      )}
      {questions.map((q, i) => (
        <QuizQuestion key={i} q={q} idx={i} selected={answers[i]} onSelect={l => handleSelect(i, l)} />
      ))}
    </div>
  );
}

function QuizQuestion({ q, idx, selected, onSelect }) {
  const correct = q.answer?.charAt(0);
  return (
    <div className="fy-quiz-q">
      <p className="fy-quiz-question"><strong>{idx + 1}.</strong> {q.question}</p>
      <div className="fy-quiz-options">
        {q.options?.map((opt, i) => {
          const letter     = String.fromCharCode(65 + i);
          const isCorrect  = letter === correct;
          const isSelected = selected === letter;
          let cls = 'fy-quiz-opt';
          if (selected) cls += isCorrect ? ' correct' : isSelected ? ' wrong' : '';
          return (
            <button key={i} className={cls} onClick={() => !selected && onSelect(letter)}>
              {opt}
            </button>
          );
        })}
      </div>
      {selected && <p className="fy-quiz-expl">{q.explanation}</p>}
    </div>
  );
}

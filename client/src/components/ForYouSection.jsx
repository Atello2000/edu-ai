import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './ForYouSection.css';

const IconCards  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 2H8a2 2 0 0 0-2 2v2h12V4a2 2 0 0 0-2-2z"/></svg>;
const IconQuiz   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>;
const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
const IconSpark  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.8 5.5H20l-4.6 3.4 1.8 5.5L12 13l-5.2 3.4 1.8-5.5L4 7.5h6.2z"/></svg>;
const IconPin    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;

const DOMAIN_TOPICS = {
  'santé':        ['Anatomie','Physiologie','Pharmacologie','Biochimie','Séméiologie','Pathologie générale'],
  'informatique': ['Algorithmique','Structures de données','Réseaux','Base de données','Programmation objet','Sécurité'],
  'droit':        ['Droit civil','Droit pénal','Droit constitutionnel','Droit des contrats','Procédure civile'],
  'économie':     ['Microéconomie','Macroéconomie','Finance d\'entreprise','Comptabilité','Management','Marketing'],
  'sciences':     ['Mathématiques','Physique','Chimie organique','Biologie cellulaire','Thermodynamique','Statistiques'],
  'langues':      ['Grammaire','Conjugaison','Vocabulaire','Littérature','Phonétique','Linguistique'],
  'ingénierie':   ['Mécanique des fluides','Électronique','Résistance des matériaux','Thermodynamique','Automatique'],
  'histoire':     ['Histoire moderne','Géopolitique','Sociologie','Philosophie','Relations internationales','Anthropologie'],
};

const TOPIC_ICONS = {
  'Algorithmique':'⚙️','Structures de données':'🗂️','Réseaux':'🌐','Base de données':'🗄️',
  'Programmation objet':'📦','Sécurité':'🔒','Anatomie':'🦴','Physiologie':'💓',
  'Pharmacologie':'💊','Biochimie':'🧬','Séméiologie':'🩺','Pathologie générale':'🔬',
  'Droit civil':'📋','Droit pénal':'⚖️','Droit constitutionnel':'🏛️','Droit des contrats':'✍️',
  'Procédure civile':'📜','Microéconomie':'📈','Macroéconomie':'🌍','Finance d\'entreprise':'💰',
  'Comptabilité':'🔢','Management':'👔','Marketing':'📣','Mathématiques':'📐',
  'Physique':'⚡','Chimie organique':'⚗️','Biologie cellulaire':'🔬','Thermodynamique':'🌡️',
  'Statistiques':'📊','Grammaire':'📝','Conjugaison':'✏️','Vocabulaire':'📖',
  'Littérature':'📚','Phonétique':'🎙️','Linguistique':'🗣️','Mécanique des fluides':'💧',
  'Électronique':'⚡','Résistance des matériaux':'🏗️','Automatique':'🤖',
  'Histoire moderne':'📜','Géopolitique':'🗺️','Sociologie':'👥','Philosophie':'🧠',
  'Relations internationales':'🤝','Anthropologie':'🏺',
};

function getTopics(domains) {
  const topics = [];
  for (const d of domains) {
    const list = DOMAIN_TOPICS[d];
    if (list) topics.push(...list.slice(0, 4));
    else topics.push(d);
  }
  return [...new Set(topics)].slice(0, 8);
}

function levelLabel(level) {
  const map = { licence:'Licence', master:'Master', doctorat:'Doctorat', professionnel:'Pro' };
  return map[level] || level || '';
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

  if (!user?.onboarding_done) return null;

  let domains = [];
  try { domains = JSON.parse(user.domains || '[]'); } catch {}
  const topics = getTopics(domains);
  const featuredTopic = topics[0] || null;

  async function generate(topic, type) {
    const key = `${topic}|${type}`;
    setLoadingKey(key);
    setResult(null);
    try {
      const r = await fetch('/api/topic', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, type, count: type === 'quiz' ? 5 : 8, lang: 'fr' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(data);
      setResultType(type);
      setResultTopic(topic);
      setFcIdx(0); setFlipped(false);
      if (type === 'flashcards') {
        postActivity(topic, 'flashcards').then(() => onActivity?.());
      }
    } catch (err) { alert(err.message); }
    finally { setLoadingKey(''); }
  }

  function handleQuizComplete(score, total) {
    postActivity(resultTopic, 'quiz', score, total).then(() => onActivity?.());
  }

  const isLoading = loadingKey !== '';

  return (
    <div className="foryou-section">

      {/* Header */}
      <div className="foryou-header">
        <div className="foryou-title">
          <span>Pour vous</span>
          <div className="foryou-badges">
            {user.level && <span className="fy-badge fy-level">{levelLabel(user.level)}</span>}
            {domains.slice(0,2).map(d => <span key={d} className="fy-badge fy-domain">{d}</span>)}
            {user.specialty && <span className="fy-badge fy-specialty">{user.specialty}</span>}
          </div>
        </div>
        <button className="fy-edit-btn" onClick={() => window.__editProfile?.()}>
          Modifier le profil
        </button>
      </div>

      {/* Custom search */}
      <div className="foryou-search">
        <div className="fy-search-wrap">
          <span className="fy-search-icon"><IconSearch /></span>
          <input
            className="fy-search-input"
            type="text"
            placeholder="Tapez un sujet personnalisé…"
            value={custom}
            onChange={e => setCustom(e.target.value)}
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

      {/* Featured topic */}
      {featuredTopic && !custom.trim() && (
        <div className="fy-featured">
          <div className="fy-featured-label"><IconSpark /> Suggestion du jour</div>
          <div className="fy-featured-body">
            <span className="fy-featured-icon">{TOPIC_ICONS[featuredTopic] || <IconPin />}</span>
            <span className="fy-featured-name">{featuredTopic}</span>
          </div>
          <div className="fy-featured-actions">
            <button
              className="fy-action-btn fy-flash"
              disabled={isLoading}
              onClick={() => generate(featuredTopic, 'flashcards')}
            >
              {loadingKey === `${featuredTopic}|flashcards` ? <span className="fy-btn-spinner" /> : <IconCards />} Flashcards
            </button>
            <button
              className="fy-action-btn fy-quiz"
              disabled={isLoading}
              onClick={() => generate(featuredTopic, 'quiz')}
            >
              {loadingKey === `${featuredTopic}|quiz` ? <span className="fy-btn-spinner" /> : <IconQuiz />} Quiz
            </button>
          </div>
        </div>
      )}

      {/* Topic cards grid */}
      {topics.length > 1 && (
        <div className="foryou-grid">
          {topics.slice(1).map(t => (
            <div key={t} className="fy-card">
              <div className="fy-card-top">
                <span className="fy-card-icon">{TOPIC_ICONS[t] || '📌'}</span>
                <span className="fy-card-name">{t}</span>
              </div>
              <div className="fy-card-actions">
                <button
                  className="fy-card-btn fy-flash"
                  disabled={isLoading}
                  onClick={() => generate(t, 'flashcards')}
                >
                  {loadingKey === `${t}|flashcards` ? <span className="fy-btn-spinner" /> : <IconCards />} Flash
                </button>
                <button
                  className="fy-card-btn fy-quiz"
                  disabled={isLoading}
                  onClick={() => generate(t, 'quiz')}
                >
                  {loadingKey === `${t}|quiz` ? <span className="fy-btn-spinner" /> : <IconQuiz />} Quiz
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result modal */}
      {result && (
        <div className="fy-result-overlay" onClick={e => { if (e.target === e.currentTarget) setResult(null); }}>
          <div className="fy-result-modal">
            <div className="fy-result-header">
              <div>
                <span className="fy-result-type">{resultType === 'flashcards' ? <><IconCards /> Flashcards</> : <><IconQuiz /> Quiz</>}</span>
                <span className="fy-result-topic">{resultTopic}</span>
              </div>
              <button className="fy-close-btn" onClick={() => setResult(null)}>✕</button>
            </div>

            {resultType === 'flashcards' && result.flashcards?.length > 0 && (
              <div className="fy-fc-area">
                <div className={`fy-fc-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
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
                  <button onClick={() => { setFcIdx(i => Math.max(0, i-1)); setFlipped(false); }} disabled={fcIdx === 0}>←</button>
                  <span>{fcIdx + 1} / {result.flashcards.length}</span>
                  <button onClick={() => { setFcIdx(i => Math.min(result.flashcards.length-1, i+1)); setFlipped(false); }} disabled={fcIdx === result.flashcards.length-1}>→</button>
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
          {answers && (() => {
            const score = questions.filter((q, i) => q.answer?.charAt(0) === answers[i]).length;
            const pct   = Math.round(score / total * 100);
            return (
              <span className={pct >= 70 ? 'good' : 'low'}>
                {score}/{total} — {pct}%
              </span>
            );
          })()}
        </div>
      )}
      {questions.map((q, i) => (
        <QuizQuestion
          key={i} q={q} idx={i}
          selected={answers[i]}
          onSelect={letter => handleSelect(i, letter)}
        />
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
          const letter    = String.fromCharCode(65 + i);
          const isCorrect = letter === correct;
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

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './ForYouSection.css';

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

function getTopics(domains) {
  const topics = [];
  for (const d of domains) {
    const list = DOMAIN_TOPICS[d];
    if (list) topics.push(...list.slice(0, 4));
    else topics.push(d); // custom domain
  }
  return [...new Set(topics)].slice(0, 8);
}

function levelLabel(level) {
  const map = { licence:'Licence', master:'Master', doctorat:'Doctorat', professionnel:'Pro', autre: level };
  return map[level] || level || '';
}

export default function ForYouSection() {
  const { user } = useAuth();
  const [active, setActive]       = useState(null);
  const [custom, setCustom]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [resultType, setResultType] = useState('');
  const [resultTopic, setResultTopic] = useState('');
  const [fcIdx, setFcIdx]         = useState(0);
  const [flipped, setFlipped]     = useState(false);

  if (!user?.onboarding_done) return null;

  let domains = [];
  try { domains = JSON.parse(user.domains || '[]'); } catch {}
  const topics = getTopics(domains);

  async function generate(topic, type) {
    setLoading(true); setResult(null);
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
    } catch (err) { alert(err.message); }
    finally { setLoading(false); setActive(null); }
  }

  function handleTopicClick(t) {
    setActive(active === t ? null : t);
    setCustom('');
  }

  return (
    <div className="foryou-section">
      <div className="foryou-header">
        <div className="foryou-title">
          <span>Pour vous</span>
          <div className="foryou-badges">
            {user.level && <span className="fy-badge fy-level">{levelLabel(user.level)}</span>}
            {domains.slice(0, 2).map(d => <span key={d} className="fy-badge fy-domain">{d}</span>)}
          </div>
        </div>
        <button className="fy-edit-btn" onClick={() => window.__editProfile?.()}>
          Modifier le profil
        </button>
      </div>

      <div className="foryou-search">
        <input
          className="fy-search-input"
          type="text"
          placeholder="🔍  Tapez un sujet personnalisé…"
          value={custom}
          onChange={e => { setCustom(e.target.value); setActive(null); }}
          onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) setActive('__custom__'); }}
        />
        {custom.trim() && (
          <div className="fy-action-bar">
            <button className="fy-action-btn fy-flash" onClick={() => generate(custom.trim(), 'flashcards')}>
              🃏 Flashcards
            </button>
            <button className="fy-action-btn fy-quiz" onClick={() => generate(custom.trim(), 'quiz')}>
              ❓ Quiz
            </button>
          </div>
        )}
      </div>

      <div className="foryou-chips">
        {topics.map(t => (
          <div key={t} className="fy-chip-wrap">
            <button
              className={`fy-chip ${active === t ? 'active' : ''}`}
              onClick={() => handleTopicClick(t)}
            >
              {t}
            </button>
            {active === t && (
              <div className="fy-action-bar">
                <button className="fy-action-btn fy-flash" onClick={() => generate(t, 'flashcards')}>
                  🃏 Flashcards
                </button>
                <button className="fy-action-btn fy-quiz" onClick={() => generate(t, 'quiz')}>
                  ❓ Quiz
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && (
        <div className="fy-loading">
          <span className="fy-spinner" />
          Génération en cours…
        </div>
      )}

      {result && (
        <div className="fy-result-overlay" onClick={e => { if (e.target === e.currentTarget) setResult(null); }}>
          <div className="fy-result-modal">
            <div className="fy-result-header">
              <div>
                <span className="fy-result-type">{resultType === 'flashcards' ? '🃏 Flashcards' : '❓ Quiz'}</span>
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
              <div className="fy-quiz-area">
                {result.questions.map((q, i) => (
                  <QuizQuestion key={i} q={q} idx={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuizQuestion({ q, idx }) {
  const [selected, setSelected] = useState(null);
  const correct = q.answer?.charAt(0);
  return (
    <div className="fy-quiz-q">
      <p className="fy-quiz-question"><strong>{idx + 1}.</strong> {q.question}</p>
      <div className="fy-quiz-options">
        {q.options?.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const isCorrect = letter === correct;
          const isSelected = selected === letter;
          let cls = 'fy-quiz-opt';
          if (selected) cls += isCorrect ? ' correct' : isSelected ? ' wrong' : '';
          return (
            <button key={i} className={cls} onClick={() => !selected && setSelected(letter)}>
              {opt}
            </button>
          );
        })}
      </div>
      {selected && <p className="fy-quiz-expl">{q.explanation}</p>}
    </div>
  );
}

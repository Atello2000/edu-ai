import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

/**
 * Props :
 *   questions            [{question, options, answer, explanation, whyWrong, sourceHint, sourceName}]
 *   answers              { [idx]: letter }
 *   idx                  number  — question courante
 *   submitted            bool
 *   score                { correct, total, pct, timeTaken } | null
 *   examMode             bool
 *   examMins             number
 *   onSelect             (idx, letter) => void
 *   onGoTo               (idx) => void
 *   onSubmit             (timeTaken) => void
 *   onRetryWrong         () => void
 *   onErrorsToFlashcards (wrongQuestions) => void
 */
export default function QuizSection({
  questions, answers, idx, submitted, score,
  examMode, examMins,
  onSelect, onGoTo, onSubmit,
  onRetryWrong, onErrorsToFlashcards,
}) {
  const [timeLeft,    setTimeLeft]    = useState(null);
  const [timerWarn,   setTimerWarn]   = useState(false);
  const intervalRef = useRef(null);
  const startTs     = useRef(null);

  // ── Exam timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!examMode || submitted || questions.length === 0) return;
    const totalSec = (examMins || 10) * 60;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(totalSec);
    startTs.current = Date.now();
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          const taken = Math.round((Date.now() - startTs.current) / 1000);
          onSubmit(taken);
          return 0;
        }
        if (t <= 60) setTimerWarn(true);
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [examMode, examMins, questions.length, submitted]); // eslint-disable-line

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    if (submitted) return;
    function handler(e) {
      if (e.key === 'ArrowRight' && idx < questions.length - 1) onGoTo(idx + 1);
      if (e.key === 'ArrowLeft'  && idx > 0)                    onGoTo(idx - 1);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [idx, questions.length, submitted, onGoTo]);

  if (!questions.length) return null;

  const total  = questions.length;
  const isLast = idx === total - 1;

  function handleSubmit() {
    clearInterval(intervalRef.current);
    const taken = startTs.current ? Math.round((Date.now() - startTs.current) / 1000) : null;
    onSubmit(taken);
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── Score screen ───────────────────────────────────────────────────────────
  if (submitted && score) {
    const { correct, total: tot, pct, timeTaken } = score;
    const msg    = pct >= 80 ? '// Excellent travail' : pct >= 60 ? '// Bien, continuez ainsi' : '// Révisez encore un peu';
    const timeStr = timeTaken
      ? ` · ${Math.floor(timeTaken / 60)}:${String(timeTaken % 60).padStart(2, '0')} min`
      : '';
    const wrongQs = questions.filter((q, i) => answers[i] !== q.answer);

    return (
      <>
        <div id="quiz-score">
          <div className="score-number">{correct}/{tot}</div>
          <div className="score-label">{pct}% de bonnes réponses{timeStr}</div>
          <div className="score-msg">{msg}</div>
          {wrongQs.length > 0 && (
            <div className="score-actions">
              <button className="act-btn blue" onClick={onRetryWrong}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
                Revoir les {wrongQs.length} erreur{wrongQs.length > 1 ? 's' : ''}
              </button>
              <button className="act-btn teal" onClick={() => onErrorsToFlashcards?.(wrongQs)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}><rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg>
                Erreurs → Flashcards
              </button>
            </div>
          )}
        </div>
        <div id="quiz-container">
          {questions.map((q, i) => {
            const userLetter = answers[i];
            const isCorrect  = userLetter === q.answer;
            return (
              <div key={i} className="quiz-question">
                <div className="quiz-file-title">{q.sourceName}</div>
                <div className="question-num">Question {i + 1}</div>
                <div className="question-text">{q.question}</div>
                <div className="options-grid">
                  {q.options.map(opt => {
                    const letter = opt.charAt(0);
                    let cls = 'option';
                    if (letter === q.answer) cls += ' correct';
                    else if (letter === userLetter) cls += ' wrong';
                    return (
                      <div key={letter} className={cls} data-letter={letter}>
                        <span className="option-letter">{letter}</span>
                        <span>{opt.slice(3)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="quiz-review-card">
                  <div className="quiz-review-title">{isCorrect ? '✓ Bonne réponse' : 'À revoir'}</div>
                  <div className="quiz-review-line"><strong>Votre réponse :</strong> {userLetter || 'Non répondu'}</div>
                  <div className="quiz-review-line"><strong>Réponse attendue :</strong> {q.answer}</div>
                  {q.explanation && (
                    <div className="explanation"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize('💡 ' + (window.marked?.parseInline(q.explanation) ?? q.explanation)) }}
                    />
                  )}
                  {q.whyWrong && userLetter && !isCorrect && q.whyWrong[userLetter] && (
                    <div className="quiz-why-wrong"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize('<strong>Pourquoi ce choix bloque :</strong> ' + (window.marked?.parseInline(q.whyWrong[userLetter]) ?? q.whyWrong[userLetter])) }}
                    />
                  )}
                  {q.sourceHint && (
                    <div className="quiz-source-hint"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize('<strong>À revoir :</strong> ' + (window.marked?.parseInline(q.sourceHint) ?? q.sourceHint)) }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // ── Active quiz screen ─────────────────────────────────────────────────────
  const q = questions[idx];

  return (
    <>
      {/* Step header */}
      <div className="quiz-step-header" id="quiz-step-header">
        {examMode && timeLeft !== null && (
          <div className={`exam-timer${timerWarn ? ' timer-warning' : ''}`} id="exam-timer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span id="timer-display">{fmtTime(timeLeft)}</span>
          </div>
        )}
        <div className="quiz-step-track">
          <div className="quiz-step-fill" id="quiz-step-fill" style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>
        <div className="quiz-step-nav">
          <button className="quiz-nav-btn" id="quiz-prev-btn" disabled={idx === 0} onClick={() => onGoTo(idx - 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Précédent
          </button>
          <span className="quiz-step-label" id="quiz-step-label">{idx + 1} / {total}</span>
          <button className="quiz-nav-btn" id="quiz-next-btn" disabled={isLast} onClick={() => onGoTo(idx + 1)}>
            Suivant
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Question */}
      <div id="quiz-container">
        <div className="quiz-question">
          <div className="quiz-file-title">{q.sourceName}</div>
          <div className="question-num">
            Question {idx + 1}<span style={{ color: 'var(--muted)', fontWeight: 400 }}> / {total}</span>
          </div>
          <div className="question-text">{q.question}</div>
          <div className="options-grid">
            {q.options.map(opt => {
              const letter = opt.charAt(0);
              return (
                <div
                  key={letter}
                  className={`option${answers[idx] === letter ? ' selected' : ''}`}
                  data-letter={letter}
                  onClick={() => onSelect(idx, letter)}
                >
                  <span className="option-letter">{letter}</span>
                  <span>{opt.slice(3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer submit */}
      {isLast && (
        <div className="quiz-footer" id="quiz-footer">
          <button className="act-btn blue large" id="submit-quiz" onClick={handleSubmit}>
            Valider mes réponses
          </button>
        </div>
      )}
    </>
  );
}

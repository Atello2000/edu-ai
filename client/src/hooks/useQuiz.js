import { useState, useCallback } from 'react';

function getLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

/**
 * Gère la génération et l'état du quiz QCM.
 *
 * questions : [{ question, options, answer, explanation, whyWrong, sourceHint, sourceName }]
 * answers   : { [idx]: letter }
 * idx       : numéro de question courante
 * submitted : bool — correction affichée ?
 * score     : { correct, total, pct, timeTaken } | null
 */
export function useQuiz() {
  const [questions, setQuestions] = useState([]);
  const [answers,   setAnswers]   = useState({});
  const [idx,       setIdx]       = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [score,     setScore]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [model,     setModel]     = useState('');

  function reset() {
    setQuestions([]); setAnswers({}); setIdx(0);
    setSubmitted(false); setScore(null); setError(null); setModel('');
  }

  function restoreFrom(results) {
    const qs = [];
    results.forEach(r => (r.quiz?.questions || []).forEach(q => qs.push({ ...q, sourceName: r.name })));
    if (qs.length) { setQuestions(qs); setAnswers({}); setIdx(0); setSubmitted(false); setScore(null); }
  }

  const generate = useCallback(async (files, { count = 5, difficulty = 'moyen' } = {}) => {
    if (!files.length) return;
    reset();
    setLoading(true);
    try {
      const res  = await fetch('/api/quiz', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, count, difficulty, lang: getLang() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const qs = [];
      data.results.forEach(r => (r.quiz?.questions || []).forEach(q => qs.push({ ...q, sourceName: r.name })));
      if (!qs.length) throw new Error('Aucune question générée');

      setQuestions(qs);
      setAnswers({}); setIdx(0); setSubmitted(false); setScore(null);
      if (data.model) setModel(data.model);

      window.__saveSession?.({ quiz: data.results });
      window.__fetchQuota?.();
      window.__addGeneratedSection?.('quiz-section');
      window.__refreshFloatNav?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectAnswer(questionIdx, letter) {
    setAnswers(prev => ({ ...prev, [questionIdx]: letter }));
  }

  function goTo(newIdx) {
    if (newIdx >= 0 && newIdx < questions.length) setIdx(newIdx);
  }

  function submit(timeTaken = null) {
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.answer) correct++; });
    const pct = Math.round(correct / questions.length * 100);
    setScore({ correct, total: questions.length, pct, timeTaken });
    setSubmitted(true);
    window.__saveQuizStat?.(pct, correct, questions.length);
  }

  return {
    questions, answers, idx, submitted, score,
    loading, error, model,
    generate, reset, restoreFrom,
    selectAnswer, goTo, submit,
  };
}

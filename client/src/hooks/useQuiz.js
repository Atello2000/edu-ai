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
      const res = await fetch('/api/quiz', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, count, difficulty, lang: getLang() }),
      });
      if (!res.ok) throw new Error('Erreur serveur');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      const allResults = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          let data; try { data = JSON.parse(part.slice(6)); } catch { continue; }

          if (data.type === 'done') {
            // Questions d'un fichier prêtes — les ajouter au fur et à mesure
            const newQs = (data.questions || []).map(q => ({ ...q, sourceName: data.name }));
            if (newQs.length) {
              setQuestions(prev => [...prev, ...newQs]);
              allResults.push({ name: data.name, quiz: { questions: data.questions } });
            }
          } else if (data.type === 'end') {
            if (data.model) setModel(data.model);
            if (!allResults.length) throw new Error('Aucune question générée');
            window.__saveSession?.({ quiz: allResults });
            window.__fetchQuota?.();
            window.__addGeneratedSection?.('quiz-section');
            window.__refreshFloatNav?.();
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

    const QUIZ_STATS_KEY = 'jangalai-quiz-stats';
    const stats = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '[]');
    stats.unshift({ date: Date.now(), pct, correct, total: questions.length });
    localStorage.setItem(QUIZ_STATS_KEY, JSON.stringify(stats.slice(0, 50)));
    window.__refreshStats?.();
    window.__renderDashboard?.();
  }

  return {
    questions, answers, idx, submitted, score,
    loading, error, model,
    generate, reset, restoreFrom,
    selectAnswer, goTo, submit,
  };
}

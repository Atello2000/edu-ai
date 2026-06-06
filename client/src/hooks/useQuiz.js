import { useState, useCallback } from 'react';
import toast from '../utils/toast';
import eventBus from '../utils/eventBus';
import { apiFetch } from '../utils/apiFetch';

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
export function useQuiz({ saveSession } = {}) {
  const [questions, setQuestions] = useState([]);
  const [answers,   setAnswers]   = useState({});
  const [idx,       setIdx]       = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [score,     setScore]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [model,     setModel]     = useState('');
  const [progress,  setProgress]  = useState(null);

  function reset() {
    setQuestions([]); setAnswers({}); setIdx(0);
    setSubmitted(false); setScore(null); setError(null); setModel(''); setProgress(null);
  }

  function restoreFrom(results) {
    const qs = [];
    results.forEach(r => (r.quiz?.questions || []).forEach(q => qs.push({ ...q, sourceName: r.name })));
    if (qs.length) { setQuestions(qs); setAnswers({}); setIdx(0); setSubmitted(false); setScore(null); }
  }

  const generate = useCallback(async (files, { count = 5, difficulty = 'moyen', focus_topics } = {}) => {
    if (!files.length) return;
    reset();
    setLoading(true);
    setProgress({ phase: 'preparing', message: 'Préparation du cours...', generated: 0 });
    try {
      const res = await apiFetch('/api/quiz', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, count, difficulty, lang: getLang(), focus_topics }),
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

          if (data.type === 'start') {
            setProgress({
              phase: 'generating',
              name: data.name,
              message: `Analyse de ${data.name}...`,
              generated: allResults.reduce((n, r) => n + (r.quiz?.questions?.length || 0), 0),
            });
          } else if (data.type === 'progress') {
            setProgress(prev => ({
              ...(prev || {}),
              phase: 'generating',
              name: data.name,
              step: data.step,
              total: data.total,
              message: data.message || `Génération ${data.step}/${data.total}...`,
              generated: allResults.reduce((n, r) => n + (r.quiz?.questions?.length || 0), 0),
            }));
          } else if (data.type === 'done') {
            // Questions d'un fichier prêtes — les ajouter au fur et à mesure
            const newQs = (data.questions || []).map(q => ({ ...q, sourceName: data.name }));
            if (newQs.length) {
              setQuestions(prev => [...prev, ...newQs]);
              allResults.push({ name: data.name, quiz: { questions: data.questions } });
              const generated = allResults.reduce((n, r) => n + (r.quiz?.questions?.length || 0), 0);
              setProgress({
                phase: 'received',
                name: data.name,
                message: `${generated} question${generated > 1 ? 's' : ''} prête${generated > 1 ? 's' : ''}`,
                generated,
              });
            }
          } else if (data.type === 'end') {
            if (data.model) setModel(data.model);
            if (!allResults.length) throw new Error('Aucune question générée');
            saveSession?.({ quiz: allResults });
            eventBus.emit('quota:refresh');
            eventBus.emit('nav:section', 'quiz-section');
            setProgress(null);
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
  }, [saveSession]);

  function retryWrong() {
    const wrong = questions.filter((q, i) => answers[i] !== q.answer);
    if (!wrong.length) { toast.info('Aucune erreur à revoir !'); return; }
    setQuestions(wrong);
    setAnswers({});
    setIdx(0);
    setSubmitted(false);
    setScore(null);
  }

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

    const now = Date.now();

    // Stats globales
    const QUIZ_STATS_KEY = 'jangalai-quiz-stats';
    const stats = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '[]');
    stats.unshift({ date: now, pct, correct, total: questions.length });
    localStorage.setItem(QUIZ_STATS_KEY, JSON.stringify(stats.slice(0, 50)));

    // Stats par sujet (sourceName = nom du fichier source)
    const TOPIC_KEY = 'jangalai-topic-stats';
    const topicData = JSON.parse(localStorage.getItem(TOPIC_KEY) || '{}');
    const byTopic   = {};
    questions.forEach((q, i) => {
      const src = q.sourceName || 'Inconnu';
      if (!byTopic[src]) byTopic[src] = { correct: 0, total: 0 };
      byTopic[src].total++;
      if (answers[i] === q.answer) byTopic[src].correct++;
    });
    Object.entries(byTopic).forEach(([name, { correct: c, total: t }]) => {
      if (!topicData[name]) topicData[name] = { sessions: [] };
      topicData[name].sessions.unshift({ date: now, pct: Math.round(c / t * 100), correct: c, total: t });
      topicData[name].sessions = topicData[name].sessions.slice(0, 20);
    });
    localStorage.setItem(TOPIC_KEY, JSON.stringify(topicData));

    // Stocker les mauvaises réponses pour l'analyse d'erreurs
    const WRONG_KEY = 'jangalai-wrong-answers';
    const wrongAnswers = questions
      .filter((q, i) => answers[i] !== q.answer)
      .map((q, i) => ({
        date: now,
        question: q.question,
        correct: q.answer,
        given: answers[i],
        sourceName: q.sourceName || 'Inconnu',
        explanation: q.explanation || '',
      }));
    if (wrongAnswers.length) {
      const existing = JSON.parse(localStorage.getItem(WRONG_KEY) || '[]');
      localStorage.setItem(WRONG_KEY, JSON.stringify([...wrongAnswers, ...existing].slice(0, 200)));
    }

    eventBus.emit('stats:refresh');
    eventBus.emit('dashboard:refresh');
  }

  return {
    questions, answers, idx, submitted, score,
    loading, error, model, progress,
    generate, reset, restoreFrom,
    selectAnswer, goTo, submit, retryWrong,
  };
}

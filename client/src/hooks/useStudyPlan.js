import { useState, useCallback } from 'react';
import eventBus from '../utils/eventBus';

function getLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

function loadTopics() {
  try {
    const raw = JSON.parse(localStorage.getItem('jangalai-topic-stats') || '{}');
    return Object.entries(raw).map(([name, { sessions }]) => ({
      name: name.replace(/\.[^.]+$/, ''),
      avg: Math.round(sessions.reduce((s, x) => s + x.pct, 0) / sessions.length),
      sessions: sessions.length,
    })).sort((a, b) => a.avg - b.avg);
  } catch { return []; }
}

function loadSrsCount() {
  try {
    const data = JSON.parse(localStorage.getItem('jangalai-srs') || '{}');
    return Object.values(data).filter(c => c.nextReview <= Date.now()).length;
  } catch { return 0; }
}

export function useStudyPlan() {
  const [plan,    setPlan]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  function reset() { setPlan(null); setError(null); }

  const generate = useCallback(async (examDate) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_date: examDate,
          topics: loadTopics(),
          srs_count: loadSrsCount(),
          lang: getLang(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      setPlan(data.plan);
      eventBus.emit('quota:refresh');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { plan, loading, error, generate, reset };
}

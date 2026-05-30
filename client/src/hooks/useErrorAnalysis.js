import { useState, useCallback } from 'react';
import eventBus from '../utils/eventBus';
import { apiFetch } from '../utils/apiFetch';

function getLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

const WRONG_KEY = 'jangalai-wrong-answers';

export function useErrorAnalysis() {
  const [patterns, setPatterns] = useState(null); // null = not loaded
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  function reset() { setPatterns(null); setMessage(''); setError(null); }

  function getWrongAnswers() {
    try { return JSON.parse(localStorage.getItem(WRONG_KEY) || '[]'); }
    catch { return []; }
  }

  const analyze = useCallback(async () => {
    const wrongAnswers = getWrongAnswers();
    if (wrongAnswers.length < 3) {
      setPatterns([]);
      setMessage('Pas assez de données. Faites au moins quelques quiz pour identifier vos erreurs récurrentes.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/error-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wrong_answers: wrongAnswers.slice(0, 30), lang: getLang() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      setPatterns(data.patterns || []);
      setMessage(data.message || '');
      eventBus.emit('quota:refresh');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { patterns, message, loading, error, analyze, reset, getWrongAnswers };
}

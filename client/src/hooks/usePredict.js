import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch';
import eventBus from '../utils/eventBus';

function getLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

export function usePredict() {
  const [results, setResults] = useState([]); // [{ name, predictions }]
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  function reset() { setResults([]); setError(null); }

  const generate = useCallback(async (files) => {
    if (!files.length) return;
    reset();
    setLoading(true);
    try {
      const res = await apiFetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, lang: getLang() }),
      });
      if (!res.ok) throw new Error('Erreur serveur');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          let data; try { data = JSON.parse(part.slice(6)); } catch { continue; }
          if (data.type === 'file_done') {
            setResults(prev => [...prev, { name: data.name, predictions: data.predictions || [] }]);
          } else if (data.type === 'end') {
            eventBus.emit('quota:refresh');
            eventBus.emit('nav:section', 'predict-section');
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

  return { results, loading, error, generate, reset };
}

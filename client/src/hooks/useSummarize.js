import { useState, useRef, useCallback } from 'react';
import eventBus from '../utils/eventBus';

function getLang() {
  try {
    return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr';
  } catch { return 'fr'; }
}

/**
 * Gère le streaming SSE de POST /api/summarize.
 *
 * streaming : { [fileName]: partialText }  — texte en cours de génération
 * results   : [{ name, summary }]          — résultats finaux
 */
export function useSummarize() {
  const [results,   setResults]   = useState([]);
  const [streaming, setStreaming] = useState({}); // { [name]: string }
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  // ref pour accumuler le texte en dehors du cycle React (évite les closures périmées)
  const partials = useRef({});

  // accumulate results outside React state to read final list in finally block
  const accumulated = useRef([]);

  function reset() {
    setResults([]);
    setStreaming({});
    setError(null);
    partials.current  = {};
    accumulated.current = [];
  }

  /** Restore saved summaries from session history (no API call). */
  function restoreFrom(savedResults) {
    if (!Array.isArray(savedResults) || !savedResults.length) return;
    setResults(savedResults);
    accumulated.current = savedResults;
  }

  const summarize = useCallback(async (files) => {
    if (!files.length) return;
    reset();
    setLoading(true);

    try {
      const res = await fetch('/api/summarize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, lang: getLang() }),
      });
      if (!res.ok) throw new Error('Erreur serveur');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          let data;
          try { data = JSON.parse(part.slice(6)); } catch { continue; }

          if (data.type === 'start') {
            partials.current[data.name] = '';
            setStreaming(prev => ({ ...prev, [data.name]: '' }));

          } else if (data.type === 'delta') {
            partials.current[data.name] = (partials.current[data.name] || '') + data.text;
            const snap = partials.current[data.name];
            setStreaming(prev => ({ ...prev, [data.name]: snap }));

          } else if (data.type === 'done') {
            const full = partials.current[data.name] || '';
            delete partials.current[data.name];
            const entry = { name: data.name, summary: full };
            accumulated.current = [...accumulated.current, entry];
            setResults(r => [...r, entry]);
            setStreaming(prev => { const n = { ...prev }; delete n[data.name]; return n; });

          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
          // 'model' and 'end' events are informational — ignored here
        }
      }
      // Save completed summaries to session history
      if (accumulated.current.length) {
        window.__saveSession?.({ summaries: accumulated.current });
        eventBus.emit('quota:refresh');
        eventBus.emit('nav:section', 'summary-section');
        eventBus.emit('dashboard:refresh');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, streaming, loading, error, summarize, reset, restoreFrom };
}

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
  const [streaming, setStreaming] = useState({});
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const partials    = useRef({});
  const accumulated = useRef([]);
  const navigated   = useRef(false);

  // Ticker : flush partials → React state toutes les 80ms (contourne le batching React 18)
  const ticker = useRef(null);

  function startTicker() {
    if (ticker.current) return;
    ticker.current = setInterval(() => {
      const snap = { ...partials.current };
      if (Object.keys(snap).length > 0) setStreaming(snap);
    }, 80);
  }

  function stopTicker() {
    if (ticker.current) { clearInterval(ticker.current); ticker.current = null; }
  }

  function reset() {
    stopTicker();
    setResults([]);
    setStreaming({});
    setError(null);
    partials.current    = {};
    accumulated.current = [];
    navigated.current   = false;
  }

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
            if (!navigated.current) {
              navigated.current = true;
              eventBus.emit('nav:section', 'summary-section');
            }
            startTicker();

          } else if (data.type === 'delta') {
            // Accumule dans le ref — le ticker flush vers React toutes les 80ms
            partials.current[data.name] = (partials.current[data.name] || '') + data.text;

          } else if (data.type === 'done') {
            const full  = partials.current[data.name] || '';
            delete partials.current[data.name];
            const entry = { name: data.name, summary: full };
            accumulated.current = [...accumulated.current, entry];

            // Affiche le texte complet dans la streaming card, puis transite vers le résultat final
            setStreaming(prev => ({ ...prev, [data.name]: full }));
            setTimeout(() => {
              setResults(r => [...r, entry]);
              setStreaming(prev => { const n = { ...prev }; delete n[data.name]; return n; });
            }, 250);

          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        }
      }

      if (accumulated.current.length) {
        window.__saveSession?.({ summaries: accumulated.current });
        eventBus.emit('quota:refresh');
        eventBus.emit('dashboard:refresh');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      stopTicker();
      setLoading(false);
    }
  }, []);

  return { results, streaming, loading, error, summarize, reset, restoreFrom };
}

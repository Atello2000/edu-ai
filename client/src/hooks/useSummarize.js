import { useState, useRef, useCallback } from 'react';
import eventBus from '../utils/eventBus';

function getLang() {
  try {
    return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr';
  } catch { return 'fr'; }
}

function getCsrfToken() {
  // Read cookie jangalai-csrf if present (set by auth middleware)
  const m = document.cookie.match(/(?:^|;\s*)jangalai-csrf=([^;]+)/);
  return m ? m[1] : null;
}

/**
 * Parse SSE buffer and call onEvent for each complete event.
 * Returns remaining incomplete buffer.
 */
function parseSseBuffer(buffer, onEvent) {
  const parts = buffer.split('\n\n');
  const remaining = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data:')) continue;
    try {
      onEvent(JSON.parse(line.slice(5).trim()));
    } catch { /* skip malformed */ }
  }
  return remaining;
}

export function useSummarize() {
  const [results,   setResults]   = useState([]);
  const [streaming, setStreaming] = useState({});
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const partials    = useRef({});
  const accumulated = useRef([]);
  const navigated   = useRef(false);
  const xhrRef      = useRef(null);

  function reset() {
    xhrRef.current?.abort();
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

  const summarize = useCallback((files) => {
    if (!files.length) return;
    reset();
    setLoading(true);

    let buffer = '';

    function handleEvent(data) {
      if (data.type === 'start') {
        partials.current[data.name] = '';
        setStreaming(prev => ({ ...prev, [data.name]: '' }));
        if (!navigated.current) {
          navigated.current = true;
          eventBus.emit('nav:section', 'summary-section');
        }

      } else if (data.type === 'delta') {
        const next = (partials.current[data.name] || '') + (data.text || '');
        partials.current[data.name] = next;
        setStreaming(prev => ({ ...prev, [data.name]: next }));

      } else if (data.type === 'done') {
        const full  = partials.current[data.name] || '';
        delete partials.current[data.name];
        const entry = { name: data.name, summary: full };
        accumulated.current = [...accumulated.current, entry];
        setResults(r => [...r, entry]);
        setStreaming(prev => { const n = { ...prev }; delete n[data.name]; return n; });

      } else if (data.type === 'end') {
        if (accumulated.current.length) {
          window.__saveSession?.({ summaries: accumulated.current });
          eventBus.emit('quota:refresh');
          eventBus.emit('dashboard:refresh');
        }
        setLoading(false);

      } else if (data.type === 'progress') {
        // Cours volumineux — mise à jour du message de chargement
        setStreaming(prev => ({
          ...prev,
          [`__progress__${data.name}`]: data.message || `Partie ${data.step}/${data.total}…`,
        }));

      } else if (data.type === 'error') {
        setError(data.message);
        setLoading(false);
      }
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/summarize', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    const csrf = getCsrfToken();
    if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);

    let processedLen = 0;

    xhr.onprogress = () => {
      const chunk = xhr.responseText.slice(processedLen);
      processedLen = xhr.responseText.length;
      buffer = parseSseBuffer(buffer + chunk, handleEvent);
    };

    xhr.onload = () => {
      // Flush any remaining buffer
      if (buffer.trim()) parseSseBuffer(buffer + '\n\n', handleEvent);
      if (!accumulated.current.length) setLoading(false);
    };

    xhr.onerror = () => {
      setError('Erreur réseau');
      setLoading(false);
    };

    xhr.onabort = () => setLoading(false);

    xhr.withCredentials = true;
    xhr.send(JSON.stringify({ files, lang: getLang() }));
  }, []);

  return { results, streaming, loading, error, summarize, reset, restoreFrom };
}

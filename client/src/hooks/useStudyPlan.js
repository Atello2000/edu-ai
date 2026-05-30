import { useState, useCallback, useRef } from 'react';
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
  const [plan,     setPlan]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(null);
  const [error,    setError]    = useState(null);
  const xhrRef = useRef(null);

  function reset() {
    xhrRef.current?.abort();
    setPlan(null);
    setError(null);
    setLoading(false);
    setProgress(null);
  }

  const generate = useCallback((examDate) => {
    xhrRef.current?.abort();
    setLoading(true);
    setError(null);
    setProgress(null);
    setPlan(null);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    let buf = '';

    xhr.open('POST', '/api/study-plan', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    const csrf = document.cookie.match(/(?:^|;\s*)jangalai-csrf=([^;]+)/)?.[1];
    if (csrf) xhr.setRequestHeader('X-CSRF-Token', decodeURIComponent(csrf));

    function parseEvents(chunk) {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim());
          if (ev.type === 'progress') {
            setProgress(ev.message || null);
          } else if (ev.type === 'end') {
            setPlan(ev.plan);
            setProgress(null);
            setLoading(false);
            eventBus.emit('quota:refresh');
          } else if (ev.type === 'error') {
            setError(ev.message || 'Erreur lors de la génération');
            setProgress(null);
            setLoading(false);
          }
        } catch {}
      }
    }

    let lastLen = 0;
    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(lastLen);
      lastLen = xhr.responseText.length;
      if (newText) parseEvents(newText);
    };

    xhr.onload = () => {
      if (xhr.responseText.length > lastLen) parseEvents(xhr.responseText.slice(lastLen));
      setLoading(false);
      setProgress(null);
    };

    xhr.onerror = () => { setError('Erreur réseau'); setLoading(false); setProgress(null); };
    xhr.onabort = () => { setLoading(false); setProgress(null); };

    xhr.send(JSON.stringify({
      exam_date: examDate,
      topics:    loadTopics(),
      srs_count: loadSrsCount(),
      lang:      getLang(),
    }));
  }, []);

  return { plan, loading, progress, error, generate, reset };
}

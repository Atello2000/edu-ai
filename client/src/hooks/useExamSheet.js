import { useState, useCallback } from 'react';

function getLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

/**
 * Gère le streaming SSE de POST /api/exam-sheet.
 *
 * md        : string  — texte final (vide tant que streaming)
 * streaming : string  — texte partiel en cours de génération
 */
export function useExamSheet() {
  const [md,        setMd]        = useState('');
  const [streaming, setStreaming] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  function reset()         { setMd(''); setStreaming(''); setError(null); }
  function restoreFrom(md) { setMd(md); setStreaming(''); setError(null); }

  const generate = useCallback(async (files) => {
    if (!files.length) return;
    reset();
    setLoading(true);
    try {
      const res = await fetch('/api/exam-sheet', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, lang: getLang() }),
      });
      if (!res.ok) throw new Error('Erreur serveur');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   text    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          let data; try { data = JSON.parse(part.slice(6)); } catch { continue; }
          if (data.type === 'delta') {
            text += data.text;
            setStreaming(text);
          } else if (data.type === 'end') {
            setMd(text);
            setStreaming('');
            // Notify app.js bridges
            window.__saveSession?.({ examSheet: { sheet: text } });
            window.__fetchQuota?.();
            window.__addGeneratedSection?.('exam-sheet-section');
            window.__refreshFloatNav?.();
            window.__renderDashboard?.();
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

  return { md, streaming, loading, error, generate, reset, restoreFrom };
}

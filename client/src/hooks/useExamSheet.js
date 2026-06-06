import { useState, useCallback } from 'react';
import eventBus from '../utils/eventBus';
import { apiFetch } from '../utils/apiFetch';

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
export function useExamSheet({ saveSession } = {}) {
  const [md,        setMd]        = useState('');
  const [streaming, setStreaming] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [progress,  setProgress]  = useState(null);
  const [error,     setError]     = useState(null);

  function reset()         { setMd(''); setStreaming(''); setError(null); setProgress(null); }
  function restoreFrom(md) { setMd(md); setStreaming(''); setError(null); setProgress(null); }

  const generate = useCallback(async (files) => {
    if (!files.length) return;
    reset();
    setLoading(true);
    eventBus.emit('nav:section', 'exam-sheet-section');
    setProgress({ phase: 'preparing', message: 'Préparation du cours...', step: 0, total: 0 });
    try {
      const res = await apiFetch('/api/exam-sheet', {
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
          if (data.type === 'progress') {
            setProgress({
              phase: 'generating',
              step: data.step,
              total: data.total,
              message: data.message || `Synthèse ${data.step}/${data.total}...`,
            });
          } else if (data.type === 'delta') {
            text += data.text;
            setStreaming(text);
            setProgress({
              phase: 'streaming',
              message: 'Création de la fiche de révision...',
            });
          } else if (data.type === 'end') {
            setMd(text);
            setStreaming('');
            setProgress(null);
            saveSession?.({ examSheet: { sheet: text } });
            eventBus.emit('quota:refresh');
            eventBus.emit('nav:section', 'exam-sheet-section');
            eventBus.emit('dashboard:refresh');
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [saveSession]);

  return { md, streaming, loading, progress, error, generate, reset, restoreFrom };
}

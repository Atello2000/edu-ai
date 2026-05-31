import { useState, useCallback, useRef } from 'react';
import eventBus from '../utils/eventBus';

/**
 * useGlossary — extraction de termes via SSE (streaming progressif).
 * Les termes s'affichent dès réception de chaque chunk, sans attendre la fin.
 */
export function useGlossary() {
  const [terms,    setTerms]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(null); // message de progression
  const [error,    setError]    = useState(null);
  const xhrRef = useRef(null);

  const generate = useCallback((files, lang = 'fr') => {
    if (!files?.length) return;

    // Annuler une génération en cours
    xhrRef.current?.abort();

    setLoading(true);
    setError(null);
    setProgress(null);
    setTerms([]);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    let buf = '';

    xhr.open('POST', '/api/glossary', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');


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
          } else if (ev.type === 'terms_chunk' && Array.isArray(ev.terms)) {
            // Affichage progressif — on ajoute les termes au fur et à mesure
            setTerms(prev => [...prev, ...ev.terms]);
          } else if (ev.type === 'end') {
            if (Array.isArray(ev.terms)) setTerms(ev.terms);
            setProgress(null);
            setLoading(false);
            eventBus.emit('quota:refresh');
          } else if (ev.type === 'error') {
            setError(ev.message || 'Erreur lors de l\'extraction');
            setProgress(null);
            setLoading(false);
          }
        } catch { /* SSE malformé — on ignore */ }
      }
    }

    let lastLen = 0;
    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(lastLen);
      lastLen = xhr.responseText.length;
      if (newText) parseEvents(newText);
    };

    xhr.onload = () => {
      if (xhr.responseText.length > lastLen) {
        parseEvents(xhr.responseText.slice(lastLen));
      }
      setLoading(false);
      setProgress(null);
    };

    xhr.onerror = () => {
      setError('Erreur réseau');
      setLoading(false);
      setProgress(null);
    };

    xhr.onabort = () => {
      setLoading(false);
      setProgress(null);
    };

    xhr.send(JSON.stringify({ files, lang }));
  }, []);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    setTerms([]);
    setError(null);
    setLoading(false);
    setProgress(null);
  }, []);

  return { terms, loading, progress, error, generate, reset };
}

import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch';
import eventBus from '../utils/eventBus';

function getLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

/**
 * Hook Mode Socratique — dialogue Q&R avec l'IA sur un cours.
 * history : [{ role: 'assistant'|'user', content: string }]
 * streaming: string — réponse en cours
 * loading  : bool
 */
export function useSocratic() {
  const [history,   setHistory]   = useState([]); // full conversation
  const [streaming, setStreaming] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [started,   setStarted]   = useState(false);

  function reset() {
    setHistory([]); setStreaming(''); setError(null); setStarted(false);
  }

  // Start session (history empty) or submit answer (history has messages)
  const send = useCallback(async (files, userMessage = null) => {
    setLoading(true);
    setError(null);

    // Build messages to send
    const messagesToSend = userMessage
      ? [...history, { role: 'user', content: userMessage }]
      : [];

    try {
      const res = await apiFetch('/api/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          history: messagesToSend,
          lang: getLang(),
        }),
      });
      if (!res.ok) throw new Error('Erreur serveur');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiText = '';

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
            aiText += data.text;
            setStreaming(aiText);
          } else if (data.type === 'end') {
            // Finalize: add to history
            const newHistory = userMessage
              ? [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: aiText }]
              : [{ role: 'assistant', content: aiText }];
            setHistory(newHistory);
            setStreaming('');
            setStarted(true);
            eventBus.emit('quota:refresh');
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
  }, [history]);

  return { history, streaming, loading, error, started, send, reset };
}

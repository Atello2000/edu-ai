import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch';

/**
 * Gère l'historique et l'envoi des messages du chat.
 * messages : [{ role:'user'|'ai', text, model?, time }]
 * history  : [{ role:'user'|'assistant', content }]  — format API
 */
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  function reset() {
    setMessages([]);
    setHistory([]);
  }

  const send = useCallback(async (text, { files = [] } = {}) => {
    const t = text?.trim();
    if (!t) return;

    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', text: t, time };
    const aiMsgId = Date.now();

    setMessages(prev => [...prev, userMsg, { role: 'typing', id: aiMsgId }]);
    setHistory(prev => [...prev, { role: 'user', content: t }]);
    setLoading(true);

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, messages: [...history, { role: 'user', content: t }] }),
      });
      if (!res.ok) throw new Error('Erreur serveur');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   fullText  = '';
      let   chatModel = '';
      const aiTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      let   bubbleCreated = false;

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
            fullText += data.text;
            if (!bubbleCreated) {
              bubbleCreated = true;
              setMessages(prev => [
                ...prev.filter(m => m.id !== aiMsgId),
                { role: 'ai', id: aiMsgId, text: fullText, time: aiTime, streaming: true },
              ]);
            } else {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, text: fullText } : m
              ));
            }
          } else if (data.type === 'end') {
            chatModel = data.model || '';
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? { ...m, text: fullText, model: chatModel, streaming: false } : m
            ));
            setHistory(prev => [...prev, { role: 'assistant', content: fullText }]);
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      const aiTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [
        ...prev.filter(m => m.id !== aiMsgId),
        { role: 'ai', text: '❌ ' + err.message, time: aiTime },
      ]);
    } finally {
      setLoading(false);
    }
  }, [history]);

  return { messages, history, loading, send, reset };
}

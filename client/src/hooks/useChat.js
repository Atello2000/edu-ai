import { useState, useCallback } from 'react';

/**
 * Gère l'historique et l'envoi des messages du chat.
 *
 * messages : [{ role:'user'|'ai', text, attachName?, imgSrc?, model?, time }]
 * history  : [{ role:'user'|'assistant', content }]  — format API
 */
export function useChat() {
  const [messages,      setMessages]      = useState([]);
  const [history,       setHistory]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [attachedFile,  setAttachedFile]  = useState(null); // { id, name, path }
  const [attachedImage, setAttachedImage] = useState(null); // { name, base64, mimeType }

  function reset() {
    setMessages([]); setHistory([]);
    setAttachedFile(null); setAttachedImage(null);
  }

  async function uploadAttachment(file) {
    const fd = new FormData();
    fd.append('files', file);
    const res  = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur upload');
    return data.files[0]; // { id, name, path, ... }
  }

  function readImageAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve({ name: file.name, base64: reader.result.split(',')[1], mimeType: file.type });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const send = useCallback(async (text, { files = [], attachedFileSnap = null, attachedImageSnap = null } = {}) => {
    const msgText = text ||
      `Analyse et réponds au document joint : **${attachedFileSnap?.name || attachedImageSnap?.name}**`;
    if (!msgText && !attachedFileSnap && !attachedImageSnap) return;

    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', text: msgText, time,
      attachName: attachedFileSnap?.name || null,
      imgSrc: attachedImageSnap ? `data:${attachedImageSnap.mimeType};base64,${attachedImageSnap.base64}` : null,
      imgName: attachedImageSnap?.name || null,
    };
    setMessages(prev => [...prev, userMsg]);
    setHistory(prev => [...prev, { role: 'user', content: msgText }]);
    setLoading(true);

    // Typing bubble
    const typingId = Date.now();
    setMessages(prev => [...prev, { role: 'typing', id: typingId }]);

    try {
      const body = { files, messages: [...history, { role: 'user', content: msgText }] };
      if (attachedFileSnap)  body.attachedFile  = attachedFileSnap;
      if (attachedImageSnap) body.attachedImage = attachedImageSnap;

      const res  = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const aiTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        { role: 'ai', text: data.response, model: data.model, time: aiTime },
      ]);
      setHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      const aiTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        { role: 'ai', text: '❌ ' + err.message, time: aiTime },
      ]);
    } finally {
      setLoading(false);
    }
  }, [history]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages, history, loading,
    attachedFile, setAttachedFile,
    attachedImage, setAttachedImage,
    send, reset, uploadAttachment, readImageAsBase64,
  };
}

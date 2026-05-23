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

    // ID stable pour la bulle IA en cours de streaming
    const aiMsgId = Date.now();
    setMessages(prev => [...prev, userMsg, { role: 'typing', id: aiMsgId }]);
    setHistory(prev => [...prev, { role: 'user', content: msgText }]);
    setLoading(true);

    try {
      const body = { files, messages: [...history, { role: 'user', content: msgText }] };
      if (attachedFileSnap)  body.attachedFile  = attachedFileSnap;
      if (attachedImageSnap) body.attachedImage = attachedImageSnap;

      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Erreur serveur');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   fullText = '';
      let   chatModel = '';
      const aiTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // Remplacer la bulle de typing par une bulle IA vide dès le premier chunk
      let bubbleCreated = false;

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
              // Premier delta : remplacer typing par bulle IA en cours
              bubbleCreated = true;
              setMessages(prev => [
                ...prev.filter(m => m.id !== aiMsgId),
                { role: 'ai', id: aiMsgId, text: fullText, time: aiTime, streaming: true },
              ]);
            } else {
              // Mises à jour suivantes : mettre à jour le texte en place
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, text: fullText } : m
              ));
            }
          } else if (data.type === 'end') {
            chatModel = data.model || '';
            // Finaliser — retirer le flag streaming, ajouter le modèle
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

  return {
    messages, history, loading,
    attachedFile, setAttachedFile,
    attachedImage, setAttachedImage,
    send, reset, uploadAttachment, readImageAsBase64,
  };
}

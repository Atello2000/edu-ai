import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

const SUGGESTIONS = [
  'Quels sont les points clés ?',
  'Donne un exemple concret',
  'Explique le concept principal',
  'Quelles sont les définitions importantes ?',
];

const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

/* ── Bulle de message ─────────────────────────────────────────────────────── */
function ChatBubble({ msg }) {
  const [copied, setCopied] = useState(false);

  if (msg.role === 'typing') {
    return (
      <div className="chat-msg ai">
        <div className="chat-bubble chat-typing">
          <div className="chat-dot" /><div className="chat-dot" /><div className="chat-dot" />
        </div>
      </div>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(msg.text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  }

  if (msg.role === 'user') {
    return (
      <div className="chat-msg user">
        <div className="chat-bubble"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(window.marked?.parse(msg.text) ?? msg.text) }}
        />
        <div className="chat-time">{msg.time}</div>
      </div>
    );
  }

  // AI message
  const isGroq = msg.model && msg.model.toLowerCase().includes('groq');
  const badge  = msg.model && isLocal
    ? `<span class="chat-model-badge ${isGroq ? 'groq' : 'claude'}">${msg.model}</span>`
    : '';
  const streamingCursor = msg.streaming ? '<span class="chat-cursor">▋</span>' : '';

  return (
    <div className="chat-msg ai">
      <div className="chat-bubble"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(window.marked?.parse(msg.text) ?? msg.text) + streamingCursor }}
      />
      {!msg.streaming && (
        <div className="chat-meta">
          {badge && <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(badge) }} />}
          <button className="chat-copy-btn" title="Copier" onClick={handleCopy}>
            {copied
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            }
          </button>
          <span className="chat-time">{msg.time}</span>
        </div>
      )}
    </div>
  );
}

/* ── Composant principal ──────────────────────────────────────────────────── */
export default function ChatSection({ files, messages, loading, onSend, onClear }) {
  const [input,       setInput]       = useState('');
  const [activeFiles, setActiveFiles] = useState(() => new Set(files.map((_, i) => i)));

  const messagesRef = useRef(null);

  useEffect(() => {
    setActiveFiles(new Set(files.map((_, i) => i)));
  }, [files]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  function getActiveChatFiles() {
    if (!activeFiles.size) return files;
    return [...activeFiles].map(i => files[i]).filter(Boolean);
  }

  function toggleChip(i) {
    setActiveFiles(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function activateAll() {
    setActiveFiles(new Set(files.map((_, i) => i)));
  }

  function handleSend(text) {
    const t = text ?? input.trim();
    if (!t) return;
    onSend(t, { files: getActiveChatFiles() });
    setInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-label">IA conversationnelle</div>
          <h2 className="panel-title">Chat <em>avec le cours</em></h2>
        </div>
        <button className="ghost-btn" id="chat-clear-btn" onClick={onClear}>Effacer</button>
      </div>

      {/* File chips */}
      <div id="chat-file-select" style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
        {files.map((f, i) => (
          <button
            key={i}
            className={`chat-file-chip${activeFiles.has(i) ? ' active' : ''}`}
            onClick={() => toggleChip(i)}
          >
            {f.name}
          </button>
        ))}
        {files.length > 1 && (
          <button className="chat-file-chip" onClick={activateAll}>Tous</button>
        )}
      </div>

      {/* Messages */}
      <div id="chat-messages" ref={messagesRef} style={{ flex: 1, overflowY: 'auto' }}>
        {isEmpty && (
          <div className="chat-welcome" id="chat-welcome">
            <div className="chat-welcome-icon">💬</div>
            <p>Posez une question sur vos cours chargés.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="chat-sug" onClick={() => handleSend(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
      </div>

      {/* Input row */}
      <div className="chat-input-row">
        <textarea
          id="chat-input"
          rows={1}
          placeholder="Posez votre question…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          id="chat-send-btn"
          className="chat-send-btn"
          disabled={loading}
          onClick={() => handleSend()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </>
  );
}

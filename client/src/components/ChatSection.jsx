import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import toast from '../utils/toast';

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
        {msg.attachName && (
          <div className="chat-attach-preview">
            <span className="file-ext" style={{ fontSize: '.5rem', padding: '.1rem .3rem' }}>
              {msg.attachName.split('.').pop().toUpperCase()}
            </span>
            <span>{msg.attachName}</span>
          </div>
        )}
        {msg.imgSrc && (
          <div className="chat-image-preview">
            <img src={msg.imgSrc} alt={msg.imgName} />
          </div>
        )}
        <div className="chat-bubble"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(window.marked?.parse(msg.text) ?? msg.text) }}
        />
        <div className="chat-time">{msg.time}</div>
      </div>
    );
  }

  // AI message
  const isGroq  = msg.model && msg.model.toLowerCase().includes('groq');
  const badge   = msg.model && isLocal
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
/**
 * Props :
 *   files          [{ name, path, text, ... }]  — fichiers chargés
 *   messages       [{ role, text, ... }]
 *   loading        bool
 *   attachedFile   { id, name, path } | null
 *   attachedImage  { name, base64, mimeType } | null
 *   onSend         (text, opts) => void
 *   onClear        () => void
 *   onAttachFile   (file) => void
 *   onRemoveFile   () => void
 *   onAttachImage  (file) => void
 *   onRemoveImage  () => void
 */
export default function ChatSection({
  files, messages, loading,
  attachedFile, attachedImage,
  onSend, onClear,
  onAttachFile, onRemoveFile,
  onAttachImage, onRemoveImage,
}) {
  const [input,       setInput]       = useState('');
  const [activeFiles, setActiveFiles] = useState(() => new Set(files.map((_, i) => i)));
  const messagesRef  = useRef(null);
  const fileInputRef = useRef(null);
  const imgInputRef  = useRef(null);

  // Keep all chips active when files change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveFiles(new Set(files.map((_, i) => i)));
  }, [files]);

  // Auto scroll
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
    if (!t && !attachedFile && !attachedImage) return;
    const snap  = attachedFile;
    const isnap = attachedImage;
    onSend(t, { files: getActiveChatFiles(), attachedFileSnap: snap, attachedImageSnap: isnap });
    setInput('');
    if (snap)  onRemoveFile();
    if (isnap) onRemoveImage();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'ppt', 'pptx', 'docx'].includes(ext)) {
      return toast.warn('Seuls PDF, PPT/PPTX et DOCX sont acceptés.');
    }
    onAttachFile(file);
  }

  async function handleImageChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast.warn('Image trop lourde (max 4 Mo).');
    onAttachImage(file);
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
            data-idx={i}
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

      {/* Attachment bars */}
      {attachedFile && (
        <div id="chat-attach-bar" className="chat-attach-bar">
          <span className="file-ext" style={{ fontSize: '.55rem' }}>
            {attachedFile.name.split('.').pop().toUpperCase()}
          </span>
          <span id="chat-attach-name">{attachedFile.name}</span>
          <button id="chat-attach-remove" onClick={onRemoveFile}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}
      {attachedImage && (
        <div id="chat-image-bar" className="chat-image-bar">
          <img id="chat-image-thumb" src={`data:${attachedImage.mimeType};base64,${attachedImage.base64}`} alt={attachedImage.name} />
          <span id="chat-image-name">{attachedImage.name}</span>
          <button id="chat-image-remove" onClick={onRemoveImage}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}

      {/* Input row */}
      <div className="chat-input-row">
        <button
          id="chat-attach-btn"
          className={`chat-tool-btn${attachedFile ? ' active' : ''}`}
          title="Joindre un document"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <button
          id="chat-image-btn"
          className={`chat-tool-btn${attachedImage ? ' active' : ''}`}
          title="Joindre une image"
          onClick={() => imgInputRef.current?.click()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
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

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept=".pdf,.ppt,.pptx,.docx" hidden onChange={handleFileChange} />
        <input ref={imgInputRef}  type="file" accept="image/*" hidden onChange={handleImageChange} />
      </div>
    </>
  );
}

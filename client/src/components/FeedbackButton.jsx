import { useState } from 'react';

export default function FeedbackButton() {
  const [open,    setOpen]    = useState(false);
  const [text,    setText]    = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text.trim() }),
      });
      if (res.ok) {
        setSent(true);
        setText('');
        setTimeout(() => { setSent(false); setOpen(false); }, 2200);
      }
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        className={`feedback-fab${open ? ' feedback-fab--open' : ''}`}
        title="Envoyer un message à l'équipe"
        onClick={() => { setOpen(o => !o); setSent(false); }}
        aria-label="Feedback"
      >
        {open
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        }
      </button>

      {/* Panel */}
      {open && (
        <div className="feedback-panel" role="dialog" aria-label="Envoyer un message">
          <div className="feedback-panel-header">
            <span className="feedback-panel-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Contacter l&apos;équipe
            </span>
            <span className="feedback-panel-hint">Bugs, suggestions, questions…</span>
          </div>

          {sent ? (
            <div className="feedback-success">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Message envoyé !</span>
            </div>
          ) : (
            <>
              <textarea
                className="feedback-textarea"
                placeholder="Décrivez votre remarque, bug ou suggestion…"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                rows={4}
                autoFocus
              />
              <div className="feedback-panel-footer">
                <span className="feedback-char-count">{text.length}/2000</span>
                <button
                  className="feedback-send-btn"
                  disabled={!text.trim() || sending}
                  onClick={handleSend}
                >
                  {sending
                    ? <span className="feedback-spinner" />
                    : <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Envoyer
                      </>
                  }
                </button>
              </div>
              <p className="feedback-kbd-hint">Ctrl+Entrée pour envoyer</p>
            </>
          )}
        </div>
      )}
    </>
  );
}

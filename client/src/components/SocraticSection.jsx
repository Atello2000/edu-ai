import { useState, useRef, useEffect } from 'react';

function renderMd(text) {
  if (window.marked) return { __html: window.marked.parse(text) };
  return null;
}

export default function SocraticSection({ files, history, streaming, loading, error, started, onSend, onReset }) {
  const [answer, setAnswer] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, streaming]);

  const questionCount = history.filter(m => m.role === 'assistant').length;

  function handleSubmit() {
    if (!answer.trim() || loading) return;
    const a = answer.trim();
    setAnswer('');
    onSend(files, a);
  }

  return (
    <div className="socratic-section">
      <div className="panel-header">
        <div>
          <div className="panel-label">Mode Socratique</div>
          <h2 className="panel-title">Dialogue <em>guidé</em></h2>
        </div>
        {started && (
          <button className="ghost-btn" onClick={onReset}>Recommencer</button>
        )}
      </div>

      {error && <div className="error-notice">{error}</div>}

      {!started && !loading && (
        <div className="socratic-start">
          <p>L&apos;IA va vous poser des questions sur votre cours pour tester votre compréhension, comme un examinateur.</p>
          <button className="act-btn blue large" onClick={() => onSend(files, null)}>
            Démarrer le dialogue
          </button>
        </div>
      )}

      {/* History */}
      <div className="socratic-history">
        {history.map((msg, i) => (
          <div key={i} className={`socratic-msg socratic-msg--${msg.role}`}>
            <span className="socratic-role">{msg.role === 'assistant' ? '🎓 IA' : '👤 Moi'}</span>
            {msg.role === 'assistant' && renderMd(msg.content)
              ? <div className="socratic-content" dangerouslySetInnerHTML={renderMd(msg.content)} />
              : <div className="socratic-content">{msg.content}</div>
            }
          </div>
        ))}

        {/* Streaming current response */}
        {streaming && (
          <div className="socratic-msg socratic-msg--assistant">
            <span className="socratic-role">🎓 IA</span>
            {renderMd(streaming)
              ? <div className="socratic-content" dangerouslySetInnerHTML={renderMd(streaming)} />
              : <div className="socratic-content">{streaming}</div>
            }
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Answer input — show if started and last message is from assistant */}
      {started && !loading && (history[history.length - 1]?.role === 'assistant') && (
        <div className="socratic-input-area">
          <textarea
            className="socratic-textarea"
            placeholder="Votre réponse…"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
            rows={3}
          />
          <div className="socratic-input-footer">
            <span className="socratic-hint">Ctrl+Entrée pour envoyer · Question {questionCount}</span>
            <button className="act-btn blue" disabled={!answer.trim() || loading} onClick={handleSubmit}>
              Répondre →
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loader-inline">
          <div className="spinner" style={{width:16,height:16}} />
          <span>{started ? 'Évaluation en cours…' : 'Préparation du dialogue…'}</span>
        </div>
      )}
    </div>
  );
}

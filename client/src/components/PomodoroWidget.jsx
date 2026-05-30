import { useState, useEffect, useRef, useCallback } from 'react';
import toast from '../utils/toast';

const TIME_STUDY = 25 * 60;
const TIME_BREAK = 5 * 60;

function playChime(isBreak) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isBreak ? 523.25 : 659.25, ctx.currentTime);
    osc.frequency.setValueAtTime(isBreak ? 659.25 : 880.00, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch { /* silencieux */ }
}

function useDrag(initialPos) {
  const [pos, setPos]       = useState(initialPos);
  const dragging            = useRef(false);
  const offset              = useRef({ x: 0, y: 0 });
  const widgetRef           = useRef(null);

  const clamp = useCallback((x, y) => {
    const el = widgetRef.current;
    if (!el) return { x, y };
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return {
      x: Math.max(0, Math.min(window.innerWidth  - w, x)),
      y: Math.max(0, Math.min(window.innerHeight - h, y)),
    };
  }, []);

  const onMove = useCallback((cx, cy) => {
    if (!dragging.current) return;
    setPos(clamp(cx - offset.current.x, cy - offset.current.y));
  }, [clamp]);

  const onUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    const mm = e => onMove(e.clientX, e.clientY);
    const tm = e => onMove(e.touches[0].clientX, e.touches[0].clientY);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup',  onUp);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend',  onUp);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup',  onUp);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend',  onUp);
    };
  }, [onMove, onUp]);

  const startDrag = useCallback((cx, cy) => {
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    offset.current = { x: cx - rect.left, y: cy - rect.top };
    dragging.current = true;
  }, []);

  const onMouseDown = useCallback(e => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const onTouchStart = useCallback(e => {
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [startDrag]);

  return { pos, widgetRef, onMouseDown, onTouchStart, isDragging: dragging };
}

export default function PomodoroWidget({ onClose }) {
  const [mode,      setMode]      = useState('study');
  const [timeLeft,  setTimeLeft]  = useState(TIME_STUDY);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted,   setIsMuted]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const timerRef   = useRef(null);
  const modeRef    = useRef(mode);
  const isMutedRef = useRef(isMuted);

  // Position initiale : bas-droite
  const initPos = {
    x: window.innerWidth  - 260,
    y: window.innerHeight - 340,
  };
  const { pos, widgetRef, onMouseDown, onTouchStart } = useDrag(initPos);

  useEffect(() => { modeRef.current   = mode;    }, [mode]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const totalTime = mode === 'study' ? TIME_STUDY : TIME_BREAK;

  const tick = useCallback(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        setIsRunning(false);
        const next = modeRef.current === 'study' ? 'break' : 'study';
        setMode(next);
        setTimeLeft(next === 'study' ? TIME_STUDY : TIME_BREAK);
        if (!isMutedRef.current) playChime(next === 'break');
        toast.success(
          next === 'break'
            ? 'Session terminée ! Profitez de votre pause bien méritée ☕'
            : 'La pause est finie. Prêt à vous replonger dans vos cours ? 📚'
        );
        return next === 'study' ? TIME_STUDY : TIME_BREAK;
      }
      return prev - 1;
    });
  }, []);

  useEffect(() => {
    if (isRunning) { timerRef.current = setInterval(tick, 1000); }
    else           { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [isRunning, tick]);

  const toggle = () => setIsRunning(r => !r);
  const reset  = () => { setIsRunning(false); setTimeLeft(totalTime); };
  const skip   = () => {
    setIsRunning(false);
    const next = mode === 'study' ? 'break' : 'study';
    setMode(next);
    setTimeLeft(next === 'study' ? TIME_STUDY : TIME_BREAK);
  };

  const radius         = 54;
  const stroke         = 4;
  const normalized     = radius - stroke * 2;
  const circumference  = normalized * 2 * Math.PI;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;

  const fmt = s => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const floatStyle = {
    position: 'fixed',
    left: pos.x,
    top:  pos.y,
    zIndex: 1000,
  };

  const chronoIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="14" r="8" />
      <path d="M10 3h4" /><path d="M12 3v3" />
      <path d="M12 10v4l2.5 2.5" />
    </svg>
  );

  if (collapsed) {
    return (
      <div
        ref={widgetRef}
        style={floatStyle}
        className={`pomo-pill pomo-mode-${mode}`}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onClick={() => setCollapsed(false)}
        title="Agrandir le minuteur"
      >
        {chronoIcon}
        <span className="pomo-pill-time">{fmt(timeLeft)}</span>
        {isRunning && <span className="pomo-pill-dot" />}
      </div>
    );
  }

  return (
    <div ref={widgetRef} style={floatStyle} className={`pomo-widget pomo-mode-${mode}`}>
      <div
        className="pomo-header pomo-drag-handle"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <span className="pomo-title">
          Focus <em>{mode === 'study' ? 'Étude' : 'Pause'}</em>
        </span>
        <div style={{ display: 'flex', gap: '.25rem' }}>
          <button className="pomo-close" onMouseDown={e => e.stopPropagation()} onClick={() => setCollapsed(true)} title="Réduire">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="pomo-close" onMouseDown={e => e.stopPropagation()} onClick={onClose} title="Fermer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div className="pomo-circle-wrap">
        <svg className="pomo-svg" viewBox="0 0 120 120">
          <circle className="pomo-bg-circle" cx="60" cy="60" r={normalized} strokeWidth={stroke} />
          <circle
            className="pomo-progress-circle"
            cx="60" cy="60" r={normalized}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="pomo-time">{fmt(timeLeft)}</div>
      </div>

      <div className="pomo-controls">
        <button className={`act-btn pomo-btn-start ${mode === 'study' ? 'gold' : 'teal'}`} onClick={toggle} title={isRunning ? 'Pause' : 'Démarrer'}>
          {isRunning
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
          }
          <span>{isRunning ? 'Pause' : 'Focus'}</span>
        </button>

        <button className="ghost-btn" onClick={reset} title="Réinitialiser">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </button>

        <button className="ghost-btn" onClick={skip} title="Passer à l'étape suivante">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>

        <button className={`ghost-btn pomo-mute-btn ${isMuted ? 'muted' : ''}`} onClick={() => setIsMuted(m => !m)} title={isMuted ? 'Activer le son' : 'Désactiver le son'}>
          {isMuted
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

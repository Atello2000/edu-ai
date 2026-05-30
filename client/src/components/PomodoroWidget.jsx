import { useState, useEffect, useRef, useCallback } from 'react';
import toast from '../utils/toast';

const TIME_STUDY = 25 * 60;
const TIME_BREAK = 5 * 60;

/**
 * Synthétise un signal sonore agréable sans fichier audio statique.
 */
function playChime(isBreak) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Fréquences douces harmonieuses (Mi et La)
    osc.frequency.setValueAtTime(isBreak ? 523.25 : 659.25, ctx.currentTime); // C5 ou E5
    osc.frequency.setValueAtTime(isBreak ? 659.25 : 880.00, ctx.currentTime + 0.15); // E5 ou A5

    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    /* Silencieux si non supporté ou bloqué */
  }
}

export default function PomodoroWidget({ onClose }) {
  const [mode,      setMode]      = useState('study'); // 'study' | 'break'
  const [timeLeft,  setTimeLeft]  = useState(TIME_STUDY);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted,   setIsMuted]   = useState(false);

  const timerRef = useRef(null);

  const totalTime = mode === 'study' ? TIME_STUDY : TIME_BREAK;

  const tick = useCallback(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        setIsRunning(false);
        const nextMode = mode === 'study' ? 'break' : 'study';
        setMode(nextMode);
        setTimeLeft(nextMode === 'study' ? TIME_STUDY : TIME_BREAK);
        if (!isMuted) playChime(nextMode === 'break');
        toast.success(
          nextMode === 'break'
            ? 'Session terminée ! Profitez de votre pause bien méritée ☕'
            : 'La pause est finie. Prêt à vous replonger dans vos cours ? 📚'
        );
        return nextMode === 'study' ? TIME_STUDY : TIME_BREAK;
      }
      return prev - 1;
    });
  }, [mode, isMuted]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, tick]);

  const toggle = () => setIsRunning(!isRunning);

  const reset = () => {
    setIsRunning(false);
    setTimeLeft(totalTime);
  };

  const skip = () => {
    setIsRunning(false);
    const nextMode = mode === 'study' ? 'break' : 'study';
    setMode(nextMode);
    setTimeLeft(nextMode === 'study' ? TIME_STUDY : TIME_BREAK);
  };

  // Calcul du cercle de progression SVG
  const radius      = 54;
  const stroke      = 4;
  const normalized  = radius - stroke * 2;
  const circumference = normalized * 2 * Math.PI;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className={`pomo-widget pomo-mode-${mode}`}>
      <div className="pomo-header">
        <span className="pomo-title">
          ⏱️ Focus <em>{mode === 'study' ? 'Étude' : 'Pause'}</em>
        </span>
        <button className="pomo-close" onClick={onClose} title="Masquer le minuteur">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="pomo-circle-wrap">
        <svg className="pomo-svg" viewBox="0 0 120 120">
          {/* Cercle d'arrière-plan neutre */}
          <circle
            className="pomo-bg-circle"
            cx="60" cy="60" r={normalized}
            strokeWidth={stroke}
          />
          {/* Cercle de progression dynamique */}
          <circle
            className="pomo-progress-circle"
            cx="60" cy="60" r={normalized}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="pomo-time">{formatTime(timeLeft)}</div>
      </div>

      <div className="pomo-controls">
        <button
          className={`act-btn pomo-btn-start ${mode === 'study' ? 'gold' : 'teal'}`}
          onClick={toggle}
          title={isRunning ? 'Pause' : 'Démarrer'}
        >
          {isRunning ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
          )}
          <span>{isRunning ? 'Pause' : 'Focus'}</span>
        </button>

        <button className="ghost-btn" onClick={reset} title="Réinitialiser">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </button>

        <button className="ghost-btn" onClick={skip} title="Passer à l'étape suivante">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>

        <button className={`ghost-btn pomo-mute-btn ${isMuted ? 'muted' : ''}`} onClick={() => setIsMuted(!isMuted)} title={isMuted ? 'Activer le son' : 'Désactiver le son'}>
          {isMuted ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          )}
        </button>
      </div>
    </div>
  );
}

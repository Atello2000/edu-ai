import { useState, useEffect, useRef, useCallback } from 'react';
import toast from '../utils/toast';

/* ── Modes prédéfinis ─────────────────────────────────────────────────────── */
const PRESETS = {
  classic:  { label: 'Classic',    sub: '25 / 5',   focus: 25, brk: 5  },
  sprint:   { label: 'Sprint',     sub: '15 / 3',   focus: 15, brk: 3  },
  long:     { label: 'Long Focus', sub: '50 / 10',  focus: 50, brk: 10 },
  deepwork: { label: 'Deep Work',  sub: '90 / 20',  focus: 90, brk: 20 },
  custom:   { label: 'Custom',     sub: '—',        focus: 25, brk: 5  },
};

const POMO_KEY = 'jangalai-pomo-settings';

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(POMO_KEY) || '{}');
    return {
      presetKey:   s.presetKey   || 'classic',
      customFocus: s.customFocus || 25,
      customBreak: s.customBreak || 5,
    };
  } catch { return { presetKey: 'classic', customFocus: 25, customBreak: 5 }; }
}

function saveSettings(s) {
  try { localStorage.setItem(POMO_KEY, JSON.stringify(s)); } catch { /* best-effort */ }
}

function getMinutes(presetKey, customFocus, customBreak) {
  if (presetKey === 'custom') return { focus: customFocus, brk: customBreak };
  const p = PRESETS[presetKey] || PRESETS.classic;
  return { focus: p.focus, brk: p.brk };
}

/* ── Audio ────────────────────────────────────────────────────────────────── */
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
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.8);
  } catch { /* silencieux */ }
}

/* ── Drag ─────────────────────────────────────────────────────────────────── */
function useDrag(initialPos) {
  const [pos, setPos]   = useState(initialPos);
  const dragging        = useRef(false);
  const offset          = useRef({ x: 0, y: 0 });
  const widgetRef       = useRef(null);

  const clamp = useCallback((x, y) => {
    const el = widgetRef.current;
    if (!el) return { x, y };
    return {
      x: Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  x)),
      y: Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y)),
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
    const r = el.getBoundingClientRect();
    offset.current = { x: cx - r.left, y: cy - r.top };
    dragging.current = true;
  }, []);

  const onMouseDown  = useCallback(e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }, [startDrag]);
  const onTouchStart = useCallback(e => { startDrag(e.touches[0].clientX, e.touches[0].clientY); }, [startDrag]);

  return { pos, widgetRef, onMouseDown, onTouchStart };
}

/* ── Icône Réglages (hors du composant pour éviter la recréation) ────────── */
const IcoGear = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

/* ── Composant principal ─────────────────────────────────────────────────── */
export default function PomodoroWidget({ onClose }) {
  const initSettings              = loadSettings();
  const [presetKey,   setPresetKey]   = useState(initSettings.presetKey);
  const [customFocus, setCustomFocus] = useState(initSettings.customFocus);
  const [customBreak, setCustomBreak] = useState(initSettings.customBreak);
  const [showSettings, setShowSettings] = useState(false);

  const { focus: focusMin, brk: breakMin } = getMinutes(presetKey, customFocus, customBreak);

  const [mode,      setMode]      = useState('study');
  const [timeLeft,  setTimeLeft]  = useState(focusMin * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted,   setIsMuted]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const timerRef   = useRef(null);
  const modeRef    = useRef(mode);
  const isMutedRef = useRef(isMuted);
  const focusRef   = useRef(focusMin);
  const breakRef   = useRef(breakMin);

  const initPos = { x: window.innerWidth - 270, y: window.innerHeight - 400 };
  const { pos, widgetRef, onMouseDown, onTouchStart } = useDrag(initPos);

  useEffect(() => { modeRef.current  = mode;    }, [mode]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { focusRef.current = focusMin; }, [focusMin]);
  useEffect(() => { breakRef.current = breakMin; }, [breakMin]);

  // Mettre à jour le timer quand les réglages changent (si arrêté)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isRunning && mode === 'study') setTimeLeft(focusMin * 60);
  }, [focusMin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isRunning && mode === 'break') setTimeLeft(breakMin * 60);
  }, [breakMin]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalTime = mode === 'study' ? focusMin * 60 : breakMin * 60;

  const tick = useCallback(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        setIsRunning(false);
        const next = modeRef.current === 'study' ? 'break' : 'study';
        setMode(next);
        const nextTime = next === 'study' ? focusRef.current * 60 : breakRef.current * 60;
        setTimeLeft(nextTime);
        if (!isMutedRef.current) playChime(next === 'break');
        toast.success(
          next === 'break'
            ? 'Session terminée ! Profitez de votre pause bien méritée ☕'
            : 'Pause terminée. Prêt à reprendre ? 📚'
        );
        return nextTime;
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
    setTimeLeft(next === 'study' ? focusMin * 60 : breakMin * 60);
  };

  /* Appliquer un preset */
  function applyPreset(key) {
    setPresetKey(key);
    setShowSettings(false);
    const { focus } = key === 'custom'
      ? { focus: customFocus }
      : PRESETS[key];
    const settings = { presetKey: key, customFocus, customBreak };
    saveSettings(settings);
    if (!isRunning) {
      setMode('study');
      setTimeLeft(focus * 60);
    }
  }

  function applyCustom(newFocus, newBreak) {
    const f = Math.max(1, Math.min(120, newFocus));
    const b = Math.max(1, Math.min(60,  newBreak));
    setCustomFocus(f);
    setCustomBreak(b);
    saveSettings({ presetKey: 'custom', customFocus: f, customBreak: b });
    if (!isRunning) {
      setMode('study');
      setTimeLeft(f * 60);
    }
  }

  /* Cercle SVG */
  const radius         = 54;
  const stroke         = 4;
  const normalized     = radius - stroke * 2;
  const circumference  = normalized * 2 * Math.PI;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;

  const fmt = s => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const floatStyle = { position: 'fixed', left: pos.x, top: pos.y, zIndex: 'var(--z-modal)' };


  /* ── Pill réduite ──────────────────────────────────────────────────────── */
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="14" r="8"/><path d="M10 3h4"/><path d="M12 3v3"/><path d="M12 10v4l2.5 2.5"/></svg>
        <span className="pomo-pill-time">{fmt(timeLeft)}</span>
        {isRunning && <span className="pomo-pill-dot" />}
      </div>
    );
  }

  /* ── Widget complet ────────────────────────────────────────────────────── */
  const currentPreset = PRESETS[presetKey] || PRESETS.classic;

  return (
    <div ref={widgetRef} style={floatStyle} className={`pomo-widget pomo-mode-${mode}`}>

      {/* Header */}
      <div className="pomo-header pomo-drag-handle" onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
        <span className="pomo-title">
          Focus <em>{mode === 'study' ? 'Étude' : 'Pause'}</em>
          <span className="pomo-preset-label">{currentPreset.label}</span>
        </span>
        <div style={{ display: 'flex', gap: '.2rem' }}>
          <button
            className={`pomo-close${showSettings ? ' pomo-close-active' : ''}`}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setShowSettings(s => !s)}
            title="Réglages"
          ><IcoGear /></button>
          <button className="pomo-close" onMouseDown={e => e.stopPropagation()} onClick={() => setCollapsed(true)} title="Réduire">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="pomo-close" onMouseDown={e => e.stopPropagation()} onClick={onClose} title="Fermer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Panneau réglages */}
      {showSettings && (
        <div className="pomo-settings">
          <div className="pomo-settings-title">Mode de travail</div>
          <div className="pomo-preset-grid">
            {Object.entries(PRESETS).filter(([k]) => k !== 'custom').map(([key, p]) => (
              <button
                key={key}
                className={`pomo-preset-btn${presetKey === key ? ' active' : ''}`}
                onClick={() => applyPreset(key)}
              >
                <span className="pomo-preset-name">{p.label}</span>
                <span className="pomo-preset-sub">{p.sub} min</span>
              </button>
            ))}
          </div>

          <div className="pomo-settings-title" style={{ marginTop: '.7rem' }}>Personnalisé</div>
          <div className="pomo-custom-row">
            <div className="pomo-custom-field">
              <span className="pomo-custom-label">Focus</span>
              <div className="pomo-custom-ctrl">
                <button className="pomo-adj-btn" onClick={() => applyCustom(customFocus - 5, customBreak)}>−</button>
                <input
                  type="number"
                  className="pomo-custom-input"
                  value={customFocus}
                  min={1} max={120}
                  onChange={e => applyCustom(Number(e.target.value), customBreak)}
                />
                <button className="pomo-adj-btn" onClick={() => applyCustom(customFocus + 5, customBreak)}>+</button>
              </div>
              <span className="pomo-custom-unit">min</span>
            </div>
            <div className="pomo-custom-field">
              <span className="pomo-custom-label">Pause</span>
              <div className="pomo-custom-ctrl">
                <button className="pomo-adj-btn" onClick={() => applyCustom(customFocus, customBreak - 1)}>−</button>
                <input
                  type="number"
                  className="pomo-custom-input"
                  value={customBreak}
                  min={1} max={60}
                  onChange={e => applyCustom(customFocus, Number(e.target.value))}
                />
                <button className="pomo-adj-btn" onClick={() => applyCustom(customFocus, customBreak + 1)}>+</button>
              </div>
              <span className="pomo-custom-unit">min</span>
            </div>
            <button
              className={`pomo-preset-btn pomo-custom-apply${presetKey === 'custom' ? ' active' : ''}`}
              onClick={() => applyPreset('custom')}
            >
              Appliquer
            </button>
          </div>
          {isRunning && (
            <p className="pomo-settings-warn">⚠ Changement actif à la prochaine session</p>
          )}
        </div>
      )}

      {/* Timer */}
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
        <div className="pomo-time-wrap">
          <div className="pomo-time">{fmt(timeLeft)}</div>
          <div className="pomo-mode-badge">{mode === 'study' ? 'Focus' : 'Pause'}</div>
        </div>
      </div>

      {/* Durées affichées */}
      <div className="pomo-durations">
        <span className={`pomo-dur-chip${mode === 'study' ? ' active' : ''}`}>
          {focusMin} min focus
        </span>
        <span className="pomo-dur-sep">·</span>
        <span className={`pomo-dur-chip${mode === 'break' ? ' active' : ''}`}>
          {breakMin} min pause
        </span>
      </div>

      {/* Contrôles */}
      <div className="pomo-controls">
        <button
          className={`act-btn pomo-btn-start ${mode === 'study' ? 'gold' : 'teal'}`}
          onClick={toggle}
          title={isRunning ? 'Pause' : 'Démarrer'}
        >
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

        <button
          className={`ghost-btn pomo-mute-btn${isMuted ? ' muted' : ''}`}
          onClick={() => setIsMuted(m => !m)}
          title={isMuted ? 'Activer le son' : 'Désactiver le son'}
        >
          {isMuted
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import toast from '../utils/toast';
import eventBus from '../utils/eventBus';
import { getLang, getSpeechLang } from '../utils/lang';

/**
 * Barre de synthèse vocale (Text-to-Speech).
 *
 * Écoute l'événement eventBus 'tts:speak' avec payload = markdown string.
 * Démarre / pause / reprend la lecture selon l'état courant.
 */

const TTS_KEY = 'jangalai-tts';

function readSaved() {
  try { return JSON.parse(localStorage.getItem(TTS_KEY) || '{}'); } catch { return {}; }
}

/** Convertit du markdown en texte brut lisible à voix haute. */
function ttsPlainText(summaryMd) {
  const result = [];
  for (const raw of summaryMd.split('\n')) {
    let l = raw.trim();
    if (!l) continue;
    if (/^[-=*_]{3,}$/.test(l)) continue;
    l = l.replace(/^#{1,6}\s*/, '').replace(/^>\s*/, '').replace(/^[-*+]\s*/, '').replace(/^\d+\.\s*/, '');
    l = l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/\[(.+?)\]\(.+?\)/g, '$1');
    l = l
      .replace(/°C/g, 'degrés Celsius').replace(/°F/g, 'degrés Fahrenheit')
      .replace(/≤/g, 'inférieur ou égal à').replace(/≥/g, 'supérieur ou égal à')
      .replace(/±/g, 'plus ou moins').replace(/×/g, 'fois')
      .replace(/→/g, 'donne').replace(/←/g, 'provient de').replace(/↔/g, 'est en équilibre avec')
      .replace(/α/g, 'alpha').replace(/β/g, 'bêta').replace(/γ/g, 'gamma')
      .replace(/δ/g, 'delta').replace(/λ/g, 'lambda').replace(/σ/g, 'sigma').replace(/μ/g, 'micro')
      .replace(/([A-Za-z])(\d+)/g, '$1 $2')
      .replace(/(\d+)\s*mg\/kg/gi, '$1 milligrammes par kilogramme')
      .replace(/(\d+)\s*mg\/L/gi, '$1 milligrammes par litre')
      .replace(/(\d+)\s*µg/gi, '$1 microgrammes')
      .replace(/(\d+)\s*mL/gi, '$1 millilitres')
      .replace(/pH/g, 'pH');
    l = l.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[🎯📌📖🔑💡✦●▶•◆■□]/gu, '')
         .replace(/[^\w\sàâäéèêëîïôùûüçœæ.,;:!?()''\-/°%+=/]/g, ' ')
         .replace(/\s+/g, ' ').trim();
    if (l.length > 3) result.push(l);
  }
  return result.join('. ');
}

export default function TTSBar() {
  const saved = readSaved();

  const [visible,   setVisible]   = useState(false);
  const [voices,    setVoices]    = useState([]);
  const [rate,      setRate]      = useState(saved.rate  || '0.9');
  const [voiceName, setVoiceName] = useState(saved.voice || '');

  // Refs for stable closures (bridge, setTimeout callbacks)
  const rateRef       = useRef(rate);
  const voiceNameRef  = useRef(voiceName);
  const currentMdRef  = useRef('');
  const playStateRef  = useRef('stopped'); // 'stopped' | 'speaking' | 'paused'
  const keepAliveRef  = useRef(null);

  // Keep refs in sync
  useEffect(() => { rateRef.current      = rate;      }, [rate]);
  useEffect(() => { voiceNameRef.current = voiceName; }, [voiceName]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(TTS_KEY, JSON.stringify({ rate, voice: voiceName }));
  }, [rate, voiceName]);

  // Load voices on mount (and when browser populates them async)
  useEffect(() => {
    function loadVoices() {
      const vs = speechSynthesis.getVoices();
      if (!vs.length) return;
      setVoices(vs);
      setVoiceName(prev => {
        if (prev) return prev;
        const pref = getLang();
        const match = vs.find(v => v.lang.startsWith(pref));
        return match ? match.name : (vs[0]?.name ?? '');
      });
    }
    loadVoices();
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Core: speak the loaded text
  function applySpeak(md) {
    const text = ttsPlainText(md);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = getSpeechLang();
    utter.rate = parseFloat(rateRef.current);
    const v = speechSynthesis.getVoices().find(vv => vv.name === voiceNameRef.current);
    if (v) utter.voice = v;

    playStateRef.current = 'speaking';

    keepAliveRef.current = setInterval(() => {
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 9000);

    utter.onend = utter.onerror = () => {
      if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
      currentMdRef.current = '';
      playStateRef.current = 'stopped';
      setVisible(false);
    };

    speechSynthesis.speak(utter);
  }

  // Speed change — restart if currently speaking
  function handleRateChange(newRate) {
    setRate(newRate);
    rateRef.current = newRate;
    if (playStateRef.current === 'speaking' && currentMdRef.current) {
      speechSynthesis.cancel();
      if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
      const md = currentMdRef.current;
      setTimeout(() => applySpeak(md), 100);
    }
  }

  // Écoute l'événement eventBus — stable (lit via refs, pas de stale closure)
  useEffect(() => {
    return eventBus.on('tts:speak', (markdown) => {
      if (typeof speechSynthesis === 'undefined') {
        toast.error("La synthèse vocale n'est pas supportée par ce navigateur.");
        return;
      }

      const ps  = playStateRef.current;
      const cur = currentMdRef.current;

      if (ps === 'speaking' && cur === markdown) {
        speechSynthesis.pause();
        if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
        playStateRef.current = 'paused';
        return;
      }

      if (ps === 'paused' && cur === markdown) {
        speechSynthesis.resume();
        playStateRef.current = 'speaking';
        keepAliveRef.current = setInterval(() => {
          if (speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
            speechSynthesis.resume();
          }
        }, 9000);
        return;
      }

      // Start fresh (possibly interrupting another text)
      speechSynthesis.cancel();
      if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
      speechSynthesis.getVoices(); // ensure voices loaded
      currentMdRef.current = markdown;
      setVisible(true);
      setTimeout(() => applySpeak(markdown), 50);
    });
  }, []); // stable — reads via refs only

  if (!visible) return null;

  const pref          = getLang();
  const prefVoices    = voices.filter(v => v.lang.startsWith(pref));
  const otherVoices   = voices.filter(v => !v.lang.startsWith(pref));
  const allVoices     = [...prefVoices, ...otherVoices];

  return (
    <div className="tts-bar" id="tts-bar">
      <span className="tts-bar-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </span>
      <select
        id="tts-voice-select"
        className="tts-select"
        value={voiceName}
        onChange={e => setVoiceName(e.target.value)}
      >
        {allVoices.map(v => (
          <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
        ))}
      </select>
      <div className="tts-speed-wrap">
        <span className="tts-speed-lbl">Vitesse</span>
        <input
          id="tts-speed"
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={rate}
          onChange={e => handleRateChange(e.target.value)}
          className="tts-slider"
        />
        <span id="tts-speed-val">{rate}×</span>
      </div>
    </div>
  );
}

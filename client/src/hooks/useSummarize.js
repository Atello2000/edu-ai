import { useState, useRef, useCallback } from 'react';
import eventBus from '../utils/eventBus';

function getLang() {
  try {
    return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr';
  } catch { return 'fr'; }
}


/**
 * Parse SSE buffer and call onEvent for each complete event.
 * Returns remaining incomplete buffer.
 */
function parseSseBuffer(buffer, onEvent) {
  const parts = buffer.split('\n\n');
  const remaining = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data:')) continue;
    try {
      onEvent(JSON.parse(line.slice(5).trim()));
    } catch { /* skip malformed */ }
  }
  return remaining;
}

// ── Cadence d'affichage (effet machine à écrire) ──────────────────────────────
// Le streaming réel d'un provider rapide (Groq) peut arriver en < 1 s, trop vite
// pour être visible. On révèle le texte accumulé à un rythme borné : visible mais
// jamais en retard sur un stream réellement lent (Claude/Mistral).
const MIN_STEP   = 4;   // caractères minimum révélés par frame (≈240 c/s à 60fps)
const MAX_FRAMES = 90;  // un burst complet est révélé en ≤ ~1,5 s (90 frames)
const MAX_STEP   = 60;  // garde-fou : jamais plus de 60 c/frame

export function useSummarize({ saveSession } = {}) {
  const [results,   setResults]   = useState([]);
  const [streaming, setStreaming] = useState({}); // {[name]: texte AFFICHÉ (révélé)}
  const [progress,  setProgress]  = useState({}); // {[name]: message} — cours volumineux (passe 1)
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const targets     = useRef({});  // {[name]: texte brut accumulé (cible à révéler)}
  const shownLen    = useRef({});  // {[name]: nb de caractères déjà révélés}
  const finished    = useRef({});  // {[name]: true quand le serveur a émis 'done'}
  const accumulated = useRef([]);  // entrées finales (pour save/restore)
  const endReceived = useRef(false);
  const navigated   = useRef(false);
  const xhrRef      = useRef(null);
  const rafRef      = useRef(null);

  function cancelRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function reset() {
    xhrRef.current?.abort();
    cancelRaf();
    setResults([]);
    setStreaming({});
    setProgress({});
    setError(null);
    targets.current     = {};
    shownLen.current    = {};
    finished.current    = {};
    accumulated.current = [];
    endReceived.current = false;
    navigated.current   = false;
  }

  function restoreFrom(savedResults) {
    if (!Array.isArray(savedResults) || !savedResults.length) return;
    setResults(savedResults);
    accumulated.current = savedResults;
  }

  const summarize = useCallback((files) => {
    if (!files.length) return;
    reset();
    setLoading(true);

    let buffer = '';

    // ── Boucle de révélation progressive ─────────────────────────────────────
    function ensureRaf() {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
    }

    function tick() {
      rafRef.current = null;

      const display = {};   // mises à jour du texte affiché
      const commits = [];   // noms entièrement révélés ET terminés → carte finale
      let animating = false;

      for (const name of Object.keys(targets.current)) {
        const full = targets.current[name];
        const sl   = shownLen.current[name] ?? 0;

        if (sl < full.length) {
          const remaining = full.length - sl;
          const step = Math.min(MAX_STEP, Math.max(MIN_STEP, Math.ceil(remaining / MAX_FRAMES)));
          const next = Math.min(full.length, sl + step);
          shownLen.current[name] = next;
          display[name] = full.slice(0, next);
          if (next < full.length) animating = true;
        } else if (finished.current[name]) {
          commits.push(name);
        }
        // sinon : révélé mais pas encore 'done' → on attend les prochains deltas
      }

      if (Object.keys(display).length || commits.length) {
        setStreaming(prev => {
          const n = { ...prev, ...display };
          for (const name of commits) delete n[name];
          return n;
        });
      }

      // Commit des cartes finales (texte intégral déjà affiché + serveur 'done')
      if (commits.length) {
        const entries = commits.map(name => ({ name, summary: targets.current[name] }));
        for (const name of commits) {
          delete targets.current[name];
          delete shownLen.current[name];
          delete finished.current[name];
        }
        accumulated.current = [...accumulated.current, ...entries];
        setResults(r => [...r, ...entries]);
      }

      const active = Object.keys(targets.current).length > 0;
      if (animating || (active && Object.values(finished.current).some(Boolean))) {
        // encore du texte à révéler, ou des cartes terminées en attente de rattrapage
        ensureRaf();
      } else if (!active && endReceived.current) {
        finalize();
      }
      // si actif mais aucune anim (révélé, pas encore 'done') → la boucle s'arrête,
      // un prochain delta la relancera via ensureRaf().
    }

    function finalize() {
      if (accumulated.current.length) {
        saveSession?.({ summaries: accumulated.current });
        eventBus.emit('quota:refresh');
        eventBus.emit('dashboard:refresh');
      }
      setProgress({});
      setLoading(false);
    }

    function handleEvent(data) {
      if (data.type === 'start') {
        targets.current[data.name]  = '';
        shownLen.current[data.name] = 0;
        finished.current[data.name] = false;
        setStreaming(prev => ({ ...prev, [data.name]: '' }));
        if (!navigated.current) {
          navigated.current = true;
          eventBus.emit('nav:section', 'summary-section');
        }

      } else if (data.type === 'delta') {
        targets.current[data.name] = (targets.current[data.name] || '') + (data.text || '');
        // Le streaming réel a commencé → on retire le message de progression
        setProgress(prev => {
          if (!(data.name in prev)) return prev;
          const n = { ...prev }; delete n[data.name]; return n;
        });
        ensureRaf();

      } else if (data.type === 'done') {
        finished.current[data.name] = true;
        ensureRaf();

      } else if (data.type === 'end') {
        endReceived.current = true;
        setProgress({});
        // Si plus rien à révéler/commiter, finaliser immédiatement ; sinon la
        // boucle de révélation appellera finalize() une fois rattrapée.
        if (Object.keys(targets.current).length === 0) finalize();
        else ensureRaf();

      } else if (data.type === 'progress') {
        // Cours volumineux (passe 1) — message lisible affiché dans la carte en cours
        setProgress(prev => ({
          ...prev,
          [data.name]: data.message || `Partie ${data.step}/${data.total}…`,
        }));

      } else if (data.type === 'error') {
        cancelRaf();
        setError(data.message);
        setLoading(false);
      }
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/summarize', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let processedLen = 0;

    xhr.onprogress = () => {
      const chunk = xhr.responseText.slice(processedLen);
      processedLen = xhr.responseText.length;
      buffer = parseSseBuffer(buffer + chunk, handleEvent);
    };

    xhr.onload = () => {
      // Flush any remaining buffer
      if (buffer.trim()) parseSseBuffer(buffer + '\n\n', handleEvent);
      // Si le serveur n'a jamais émis 'end' (réseau coupé après done), garantir la fin.
      if (!endReceived.current && Object.keys(targets.current).length === 0
          && !accumulated.current.length) {
        setLoading(false);
      }
    };

    xhr.onerror = () => {
      cancelRaf();
      setError('Erreur réseau');
      setLoading(false);
    };

    xhr.onabort = () => { cancelRaf(); setLoading(false); };

    xhr.withCredentials = true;
    xhr.send(JSON.stringify({ files, lang: getLang() }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSession]);

  return { results, streaming, progress, loading, error, summarize, reset, restoreFrom };
}

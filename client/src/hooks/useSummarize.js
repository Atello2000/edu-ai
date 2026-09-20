import { useState, useRef, useCallback, useEffect } from 'react';
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
  const parts = buffer.split(/\r?\n\r?\n/);
  const remaining = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data:')) continue;
    let data;
    try { data = JSON.parse(line.slice(5).trim()); } catch { continue; }
    onEvent(data);
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
    const previous = xhrRef.current;
    xhrRef.current = null;
    previous?.abort();
    cancelRaf();
    setResults([]);
    setStreaming({});
    setProgress({});
    setError(null);
    setLoading(false);
    targets.current     = {};
    shownLen.current    = {};
    finished.current    = {};
    accumulated.current = [];
    endReceived.current = false;
    navigated.current   = false;
  }

  useEffect(() => () => {
    const xhr = xhrRef.current;
    xhrRef.current = null;
    xhr?.abort();
    cancelRaf();
  }, []);

  function restoreFrom(savedResults) {
    if (!Array.isArray(savedResults) || !savedResults.length) return;
    setResults(savedResults);
    accumulated.current = savedResults;
  }

  const summarize = useCallback((files) => {
    if (!files.length) return;
    reset();
    setLoading(true);
    eventBus.emit('nav:section', 'summary-section');


    let buffer = '';
    let settled = false;

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
      if (settled) return;
      settled = true;
      if (accumulated.current.length) {
        saveSession?.({ summaries: accumulated.current });
        eventBus.emit('quota:refresh');
        eventBus.emit('dashboard:refresh');
      }
      setProgress({});
      setLoading(false);
    }

    function fail(message) {
      if (settled) return;
      settled = true;
      cancelRaf();
      // Keep only files which the server explicitly completed, even if the
      // typewriter animation had not yet caught up. Never save a partial result.
      const completed = Object.keys(targets.current)
        .filter(name => finished.current[name])
        .map(name => ({ name, summary: targets.current[name] }));
      accumulated.current = [...accumulated.current, ...completed];
      setResults(accumulated.current);
      if (accumulated.current.length) saveSession?.({ summaries: accumulated.current });
      targets.current = {};
      shownLen.current = {};
      finished.current = {};
      setStreaming({});
      setProgress({});
      setError(message || 'La génération a échoué. Veuillez réessayer.');
      setLoading(false);
      eventBus.emit('quota:refresh');
    }

    function handleEvent(data) {
      if (settled) return;
      if (data.type === 'start') {
        targets.current[data.name]  = '';
        shownLen.current[data.name] = 0;
        finished.current[data.name] = false;
        setStreaming(prev => ({ ...prev, [data.name]: '' }));
        if (!navigated.current) {
          navigated.current = true;
          eventBus.emit('nav:section', 'summary-section');
        }

      } else if (data.type === 'delta' || data.type === 'patch') {
        targets.current[data.name] = (targets.current[data.name] || '') + (data.type === 'patch' ? '\n\n' : '') + (data.text || '');
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
        if (Object.keys(targets.current).some(name => !finished.current[name])) {
          fail('La génération a été interrompue avant la fin. Veuillez réessayer.');
          return;
        }
        endReceived.current = true;
        setProgress({});
        // Si plus rien à révéler/commiter, finaliser immédiatement ; sinon la
        // boucle de révélation appellera finalize() une fois rattrapée.
        if (Object.keys(targets.current).length === 0) finalize();
        else ensureRaf();

      } else if (data.type === 'progress') {
        if (!(data.name in targets.current)) {
          targets.current[data.name] = '';
          shownLen.current[data.name] = 0;
          finished.current[data.name] = false;
        }
        // Cours volumineux (passe 1) — message lisible affiché dans la carte en cours
        setProgress(prev => ({
          ...prev,
          [data.name]: data.message || `Partie ${data.step}/${data.total}…`,
        }));

      } else if (data.type === 'file_error') {
        delete targets.current[data.name];
        delete shownLen.current[data.name];
        delete finished.current[data.name];
        setStreaming(prev => { const next = { ...prev }; delete next[data.name]; return next; });
        setProgress(prev => { const next = { ...prev }; delete next[data.name]; return next; });
        setError(data.message || 'Un fichier n’a pas pu être analysé.');
      } else if (data.type === 'error') {
        fail(data.message);
      }
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/summarize', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let processedLen = 0;

    function consumeResponse() {
      const chunk = xhr.responseText.slice(processedLen);
      processedLen = xhr.responseText.length;
      buffer = parseSseBuffer(buffer + chunk, handleEvent);
    }
    xhr.onprogress = () => {
      if (xhrRef.current !== xhr || settled || xhr.status >= 400) return;
      consumeResponse();
    };
    xhr.onload = () => {
      if (xhrRef.current !== xhr || settled) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        let message;
        try { message = JSON.parse(xhr.responseText).error; } catch { /* proxy HTML response */ }
        fail(message || (xhr.status === 401 ? 'Votre session a expiré. Reconnectez-vous.' :
          xhr.status === 429 ? 'Trop de demandes. Patientez un instant puis réessayez.' :
          'Le serveur n’a pas pu terminer la génération. Veuillez réessayer.'));
        return;
      }
      consumeResponse();
      if (buffer.trim()) { parseSseBuffer(buffer + '\n\n', handleEvent); buffer = ''; }
      if (settled) return;
      const incomplete = Object.keys(targets.current).some(name => !finished.current[name]);
      if (incomplete || (!endReceived.current && !accumulated.current.length && !Object.keys(targets.current).length)) {
        fail('La génération a été interrompue avant la fin. Veuillez réessayer.');
        return;
      }
      // A completed file is valid even if the final end frame was lost.
      endReceived.current = true;
      if (Object.keys(targets.current).length) ensureRaf();
      else finalize();
    };
    xhr.onerror = () => {
      if (xhrRef.current === xhr) fail('Connexion interrompue. Vérifiez votre réseau puis réessayez.');
    };
    xhr.ontimeout = () => {
      if (xhrRef.current === xhr) fail('Le délai de génération est dépassé. Veuillez réessayer.');
    };
    xhr.onabort = () => {
      if (xhrRef.current === xhr) fail('Génération annulée.');
    };

    xhr.withCredentials = true;
    xhr.send(JSON.stringify({ files, lang: getLang() }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSession]);

  return { results, streaming, progress, loading, error, summarize, reset, restoreFrom };
}

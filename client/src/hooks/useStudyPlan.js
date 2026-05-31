import { useState, useCallback, useRef } from 'react';
import eventBus from '../utils/eventBus';

function getLang() {
  try { return JSON.parse(localStorage.getItem('jangalai-prefs') || '{}').lang || 'fr'; }
  catch { return 'fr'; }
}

/**
 * Retourne les stats de quiz FILTRÉES par les fichiers chargés.
 * Si aucun fichier, retourne tout l'historique (comportement ancien).
 */
function loadTopicsForFiles(files = []) {
  try {
    const raw = JSON.parse(localStorage.getItem('jangalai-topic-stats') || '{}');
    const all = Object.entries(raw).map(([name, { sessions }]) => ({
      name:     name.replace(/\.[^.]+$/, ''),
      raw_name: name,
      avg:      Math.round(sessions.reduce((s, x) => s + x.pct, 0) / sessions.length),
      sessions: sessions.length,
    })).sort((a, b) => a.avg - b.avg);

    if (!files.length) return all;

    // Noms de base des fichiers chargés (sans extension, minuscule)
    const fileKeys = files.map(f => f.name.replace(/\.[^.]+$/, '').toLowerCase());

    const filtered = all.filter(t => {
      const tKey = t.raw_name.replace(/\.[^.]+$/, '').toLowerCase();
      return fileKeys.some(fk =>
        tKey === fk ||
        tKey.includes(fk) ||
        fk.includes(tKey)
      );
    });

    // Si aucun match (jamais fait de quiz sur ces fichiers) → retourner vide plutôt que tout
    return filtered;
  } catch { return []; }
}

/**
 * Retourne les fronts des cartes SRS dues (pas juste un compte).
 * Max 40 cartes pour limiter les tokens.
 */
function loadSrsDueFronts() {
  try {
    const data = JSON.parse(localStorage.getItem('jangalai-srs') || '{}');
    const now  = Date.now();
    return Object.values(data)
      .filter(c => c.nextReview <= now && c.front)
      .map(c => c.front.slice(0, 120))   // tronquer les fronts trop longs
      .slice(0, 40);
  } catch { return []; }
}

/**
 * Prépare un résumé court de chaque fichier chargé :
 * nom + premier extrait (600 chars max) — suffit pour que l'IA comprenne le sujet.
 */
function buildFilesSummary(files = []) {
  return files.map(f => ({
    name:    f.name,
    excerpt: (f.text || '').slice(0, 600).replace(/\s+/g, ' ').trim(),
  }));
}

export function useStudyPlan() {
  const [plan,     setPlan]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(null);
  const [error,    setError]    = useState(null);
  const xhrRef = useRef(null);

  function reset() {
    xhrRef.current?.abort();
    setPlan(null);
    setError(null);
    setLoading(false);
    setProgress(null);
  }

  /**
   * @param {string} examDate  — date YYYY-MM-DD
   * @param {Array}  files     — uploadedFiles depuis AppPage [{id, name, text, ...}]
   */
  const generate = useCallback((examDate, files = []) => {
    xhrRef.current?.abort();
    setLoading(true);
    setError(null);
    setProgress(null);
    setPlan(null);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    let buf = '';

    xhr.open('POST', '/api/study-plan', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');

    function parseEvents(chunk) {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim());
          if (ev.type === 'progress') {
            setProgress(ev.message || null);
          } else if (ev.type === 'end') {
            setPlan(ev.plan);
            setProgress(null);
            setLoading(false);
            eventBus.emit('quota:refresh');
          } else if (ev.type === 'error') {
            setError(ev.message || 'Erreur lors de la génération');
            setProgress(null);
            setLoading(false);
          }
        } catch { /* SSE malformé — on ignore */ }
      }
    }

    let lastLen = 0;
    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(lastLen);
      lastLen = xhr.responseText.length;
      if (newText) parseEvents(newText);
    };
    xhr.onload = () => {
      if (xhr.responseText.length > lastLen) parseEvents(xhr.responseText.slice(lastLen));
      setLoading(false);
      setProgress(null);
    };
    xhr.onerror = () => { setError('Erreur réseau'); setLoading(false); setProgress(null); };
    xhr.onabort = () => { setLoading(false); setProgress(null); };

    xhr.send(JSON.stringify({
      exam_date:      examDate,
      files:          buildFilesSummary(files),        // ← NOUVEAU: cours chargés
      topics:         loadTopicsForFiles(files),        // ← filtré par fichiers chargés
      srs_due_fronts: loadSrsDueFronts(),              // ← fronts des cartes dues
      lang:           getLang(),
    }));
  }, []);

  return { plan, loading, progress, error, generate, reset };
}

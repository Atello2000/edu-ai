import { useEffect, useCallback, useRef } from 'react';
import eventBus from '../utils/eventBus';
import { idb } from '../utils/idb';

const HISTORY_KEY  = 'jangalai-sessions'; // localStorage — gardé pour migration
const MAX_SESSIONS = 10;

// ── Lecture synchrone depuis localStorage (fallback + migration) ──────────────
export function getSessions() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

// ── Lecture async depuis IDB (source de vérité après migration) ───────────────
export async function getSessionsAsync() {
  try {
    const rows = await idb.getAll('sessions');
    // Trier par timestamp décroissant (le plus récent en premier)
    return rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch {
    return getSessions(); // fallback localStorage si IDB indisponible
  }
}

// ── Migration one-shot localStorage → IDB ────────────────────────────────────
async function migrateFromLocalStorage() {
  try {
    const migrated = localStorage.getItem('jangalai-idb-migrated');
    if (migrated) return;
    const sessions = getSessions();
    if (sessions.length) {
      await Promise.all(sessions.map(s => idb.put('sessions', s)));
    }
    localStorage.setItem('jangalai-idb-migrated', '1');
  } catch { /* silencieux */ }
}

/**
 * Gère l'historique de sessions (IndexedDB, avec fallback localStorage).
 *
 * Reçoit des refs pour les fonctions restore (créées dans AppPage avant les hooks AI),
 * ce qui évite la dépendance circulaire.
 */
export function useSessions({
  uploadedFiles,
  setUploadedFiles,
  setActivePanel,
  restoreSummaryRef,
  restoreExamRef,
  restoreQuizRef,
  restoreFcRef,
}) {
  const filesRef = useRef(uploadedFiles);
  useEffect(() => { filesRef.current = uploadedFiles; }, [uploadedFiles]);

  // Migration one-shot au montage
  useEffect(() => { migrateFromLocalStorage(); }, []);

  // ── saveSession ───────────────────────────────────────────────────────────
  const saveSession = useCallback((update) => {
    const files = filesRef.current;
    if (!files.length) return;

    const fileKey = files.map(f => f.name).sort().join('|');

    (async () => {
      try {
        // Charger toutes les sessions depuis IDB
        let sessions = await getSessionsAsync();
        let idx = sessions.findIndex(s => s.fileKey === fileKey);

        if (idx === -1) {
          sessions.unshift({
            id: Date.now(), fileKey, timestamp: Date.now(),
            files:     files.map(f => f.name),
            filesMeta: files.map(f => ({ name: f.name, text: f.text || '' })),
          });
          idx = 0;
        }
        if (!sessions[idx].filesMeta && files.some(f => f.text)) {
          sessions[idx].filesMeta = files.map(f => ({ name: f.name, text: f.text || '' }));
        }
        Object.assign(sessions[idx], update, { timestamp: Date.now() });

        // Écrire la session mise à jour dans IDB
        await idb.put('sessions', sessions[idx]);

        // Garder au plus MAX_SESSIONS — supprimer les plus anciennes
        const sorted = sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const toDelete = sorted.slice(MAX_SESSIONS);
        await Promise.all(toDelete.map(s => idb.delete('sessions', s.id)));

        // Miroir localStorage pour getSessions() synchrone (HistoryPanel initial render)
        localStorage.setItem(HISTORY_KEY, JSON.stringify(sorted.slice(0, MAX_SESSIONS)));

        eventBus.emit('history:refresh');
        eventBus.emit('dashboard:refresh');
      } catch {
        // Fallback : écriture localStorage seule
        let sessions = getSessions();
        const idx2 = sessions.findIndex(s => s.fileKey === fileKey);
        if (idx2 === -1) {
          sessions.unshift({
            id: Date.now(), fileKey, timestamp: Date.now(),
            files:     files.map(f => f.name),
            filesMeta: files.map(f => ({ name: f.name, text: f.text || '' })),
          });
        }
        const i = idx2 === -1 ? 0 : idx2;
        Object.assign(sessions[i], update, { timestamp: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
        eventBus.emit('history:refresh');
        eventBus.emit('dashboard:refresh');
      }
    })();
  }, []); // stable grâce au ref

  // ── restoreSession ────────────────────────────────────────────────────────
  const restoreSession = useCallback((s) => {
    if (s.filesMeta?.length) {
      const files = s.filesMeta.map((f, i) => ({
        id: `restored-${i}`, name: f.name, path: '', text: f.text || '', size: 0,
      }));
      setUploadedFiles(files);
    }

    let firstPanel = 'actions-section';

    if (s.summaries) {
      restoreSummaryRef.current?.(s.summaries);
      eventBus.emit('nav:section', 'summary-section');
      firstPanel = 'summary-section';
    }
    if (s.quiz) {
      restoreQuizRef.current?.(s.quiz);
      eventBus.emit('nav:section', 'quiz-section');
      if (firstPanel === 'actions-section') firstPanel = 'quiz-section';
    }
    if (s.flashcards) {
      restoreFcRef.current?.(s.flashcards);
      eventBus.emit('nav:section', 'flashcard-section');
      if (firstPanel === 'actions-section') firstPanel = 'flashcard-section';
    }
    if (s.examSheet) {
      restoreExamRef.current?.(s.examSheet.sheet || '');
      eventBus.emit('nav:section', 'exam-sheet-section');
      if (firstPanel === 'actions-section') firstPanel = 'exam-sheet-section';
    }

    setActivePanel(firstPanel);
  }, [setUploadedFiles, setActivePanel, restoreSummaryRef, restoreExamRef, restoreQuizRef, restoreFcRef]);

  return { saveSession, restoreSession };
}

import { useEffect, useCallback, useRef } from 'react';
import eventBus from '../utils/eventBus';

const HISTORY_KEY = 'jangalai-sessions';

export function getSessions() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
}

/**
 * Gère l'historique de sessions (localStorage).
 *
 * Reçoit des refs pour les fonctions restore (créées dans AppPage avant les hooks AI),
 * ce qui évite la dépendance circulaire et le bridge window.__saveSession.
 *
 * Expose window.__restoreSession pour HistoryPanel.
 * saveSession est retourné directement et passé aux hooks AI (useSummarize, etc.).
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

  // ── saveSession ───────────────────────────────────────────────────────────
  const saveSession = useCallback((update) => {
    const files = filesRef.current;
    if (!files.length) return;

    let sessions = getSessions();
    const fileKey = files.map(f => f.name).sort().join('|');
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
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, 10)));
    eventBus.emit('history:refresh');
    eventBus.emit('dashboard:refresh');
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

  // Bridge pour HistoryPanel (composant qui n'a pas accès direct à restoreSession)
  useEffect(() => {
    window.__restoreSession = restoreSession;
    return () => { delete window.__restoreSession; };
  }, [restoreSession]);

  return { saveSession, restoreSession };
}

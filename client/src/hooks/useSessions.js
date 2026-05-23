import { useEffect, useCallback, useRef } from 'react';

const HISTORY_KEY = 'jangalai-sessions';

export function getSessions() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
}

/**
 * Gère l'historique de sessions (localStorage).
 * Expose window.__saveSession + window.__restoreSession pour les hooks AI et HistoryPanel.
 */
export function useSessions({
  uploadedFiles,
  setUploadedFiles,
  setActivePanel,
  restoreSummaryFrom,
  restoreExamFrom,
  restoreQuizFrom,
  restoreFcFrom,
}) {
  // ── Refs pour éviter des deps instables dans useCallback ─────────────────
  const filesRef          = useRef(uploadedFiles);

  const restoreSummaryRef = useRef(restoreSummaryFrom);
  const restoreExamRef    = useRef(restoreExamFrom);
  const restoreQuizRef    = useRef(restoreQuizFrom);
  const restoreFcRef      = useRef(restoreFcFrom);

  useEffect(() => {
    filesRef.current = uploadedFiles;
    restoreSummaryRef.current = restoreSummaryFrom;
    restoreExamRef.current = restoreExamFrom;
    restoreQuizRef.current = restoreQuizFrom;
    restoreFcRef.current = restoreFcFrom;
  }, [uploadedFiles, restoreSummaryFrom, restoreExamFrom, restoreQuizFrom, restoreFcFrom]);

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
    // Sauvegarde le texte extrait si pas encore enregistré
    if (!sessions[idx].filesMeta && files.some(f => f.text)) {
      sessions[idx].filesMeta = files.map(f => ({ name: f.name, text: f.text || '' }));
    }
    Object.assign(sessions[idx], update, { timestamp: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, 10)));
    window.__refreshHistory?.();
    window.__renderDashboard?.();
  }, []); // stable grâce au ref

  // ── restoreSession ────────────────────────────────────────────────────────
  const restoreSession = useCallback((s) => {
    // Restaure les fichiers dans React
    if (s.filesMeta?.length) {
      const files = s.filesMeta.map((f, i) => ({
        id: `restored-${i}`, name: f.name, path: '', text: f.text || '', size: 0,
      }));
      setUploadedFiles(files);
    }

    // Restaure les résultats IA dans leurs hooks React respectifs
    let firstPanel = 'actions-section';

    if (s.summaries) {
      restoreSummaryRef.current(s.summaries);
      window.__addGeneratedSection?.('summary-section');
      firstPanel = 'summary-section';
    }
    if (s.quiz) {
      restoreQuizRef.current(s.quiz);
      window.__addGeneratedSection?.('quiz-section');
      if (firstPanel === 'actions-section') firstPanel = 'quiz-section';
    }
    if (s.flashcards) {
      restoreFcRef.current(s.flashcards);
      window.__addGeneratedSection?.('flashcard-section');
      if (firstPanel === 'actions-section') firstPanel = 'flashcard-section';
    }
    if (s.examSheet) {
      restoreExamRef.current(s.examSheet.sheet || '');
      window.__addGeneratedSection?.('exam-sheet-section');
      if (firstPanel === 'actions-section') firstPanel = 'exam-sheet-section';
    }

    setActivePanel(firstPanel);
  }, [setUploadedFiles, setActivePanel]); // setters stables ; restore* via refs

  // ── Bridges pour les hooks AI et HistoryPanel ────────────────────────────
  useEffect(() => {
    window.__saveSession    = saveSession;
    window.__restoreSession = restoreSession;
    return () => {
      delete window.__saveSession;
      delete window.__restoreSession;
    };
  }, [saveSession, restoreSession]);

  return { saveSession, restoreSession };
}

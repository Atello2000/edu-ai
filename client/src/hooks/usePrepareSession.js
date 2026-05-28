import { useState, useCallback } from 'react';
import { getGoalParams } from '../utils/goalParams.js';
import toast from '../utils/toast';

/**
 * Gère la modal d'objectif et le lancement groupé de session.
 *
 * showGoalModal        : bool
 * sessionGoal          : string | null
 * prepLoading          : bool
 * handlePrepareSession : ouvre la modal (vérifie que des fichiers sont chargés)
 * handleGoalSelect     : reçoit l'objectif choisi, lance summarize + quiz + flashcards
 */
export function usePrepareSession({
  uploadedFiles,
  summarize,
  generateQuiz,
  generateFlashcards,
  summarizing,
  quizLoading,
  fcLoading,
  setActivePanel,
}) {
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [sessionGoal,   setSessionGoal]   = useState(null);

  const prepLoading = summarizing || quizLoading || fcLoading;

  const handlePrepareSession = useCallback(() => {
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (!files.length) { toast.warn('Chargez d\'abord des fichiers.'); return; }
    setShowGoalModal(true);
  }, [uploadedFiles]);

  const handleGoalSelect = useCallback((goal) => {
    setSessionGoal(goal);
    setShowGoalModal(false);
    // Lancer immédiatement avec `goal` direct (pas sessionGoal qui est async)
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (!files.length) return;
    const { quizCount, quizDiff, fcCount } = getGoalParams(goal);
    setActivePanel('summary-section');
    summarize(files);
    generateQuiz(files, { count: quizCount, difficulty: quizDiff });
    generateFlashcards(files, { count: fcCount });
  }, [uploadedFiles, summarize, generateQuiz, generateFlashcards, setActivePanel]);

  return {
    showGoalModal,
    sessionGoal,
    prepLoading,
    handlePrepareSession,
    handleGoalSelect,
  };
}

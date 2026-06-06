import { useState, useCallback } from 'react';
import { getGoalParams } from '../utils/goalParams.js';
import toast from '../utils/toast';

/**
 * Gère la modal d'objectif et le lancement groupé de session.
 *
 * showGoalModal        : bool
 * sessionGoal          : string | null
 * prepLoading          : bool
 * handlePrepareSession : ouvre la modal (vérifie fichiers + solde minimum)
 * handleGoalSelect     : reçoit l'objectif choisi, lance les générations selon les flags
 */
export function usePrepareSession({
  uploadedFiles,
  selectedFilesRef,  // ref vers les fichiers sélectionnés (évite dépendances stales)
  balance,           // solde jetons courant (null = inconnu)
  summarize,
  generateExam,
  generateQuiz,
  generateFlashcards,
  summarizing,
  examLoading,
  quizLoading,
  fcLoading,
  setActivePanel,
}) {
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [sessionGoal,   setSessionGoal]   = useState(null);

  const prepLoading = summarizing || examLoading || quizLoading || fcLoading;

  /** Retourne les fichiers effectivement sélectionnés. */
  function getFiles() {
    return selectedFilesRef?.current?.length
      ? selectedFilesRef.current
      : uploadedFiles;
  }

  const handlePrepareSession = useCallback(() => {
    const files = getFiles();
    if (!files.length) { toast.warn('Chargez d\'abord des fichiers.'); return; }
    setShowGoalModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles]);

  const handleGoalSelect = useCallback((goal) => {
    setSessionGoal(goal);
    setShowGoalModal(false);

    const files = getFiles();
    if (!files.length) return;

    // Utiliser `goal` directement (pas sessionGoal qui est async)
    const { genSummary, genExam, genQuiz, genFlashcards,
            quizCount, quizDiff, fcCount, cost } = getGoalParams(goal);

    // Vérification du solde (balance null = dev/inconnu → on laisse passer)
    if (balance !== null && balance < cost) {
      toast.error(`Solde insuffisant (${balance} ⚡). Cette session coûte ${cost} ⚡.`);
      return;
    }

    // Navigation vers le premier panneau qui sera généré
    if (genSummary)         setActivePanel('summary-section');
    else if (genQuiz)       setActivePanel('quiz-section');
    else if (genFlashcards) setActivePanel('flashcard-section');

    let delay = 0;
    if (genSummary) {
      summarize(files);
      delay += 1500;
    }
    if (genExam) {
      const d = delay;
      setTimeout(() => generateExam(files), d);
      delay += 1500;
    }
    if (genQuiz) {
      const d = delay;
      setTimeout(() => generateQuiz(files, { count: quizCount, difficulty: quizDiff }), d);
      delay += 1500;
    }
    if (genFlashcards) {
      const d = delay;
      setTimeout(() => generateFlashcards(files, { count: fcCount }), d);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles, balance, summarize, generateExam, generateQuiz, generateFlashcards, setActivePanel]);

  return {
    showGoalModal,
    sessionGoal,
    prepLoading,
    handlePrepareSession,
    handleGoalSelect,
  };
}

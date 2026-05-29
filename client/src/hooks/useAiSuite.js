import { useEffect } from 'react';
import { useSummarize } from './useSummarize.js';
import { useExamSheet } from './useExamSheet.js';
import { useQuiz } from './useQuiz.js';
import { useFlashcards } from './useFlashcards.js';
import { useChat } from './useChat.js';
import { useGlossary } from './useGlossary.js';
import { useSocratic } from './useSocratic.js';
import { useStudyPlan } from './useStudyPlan.js';
import { usePredict } from './usePredict.js';
import { useErrorAnalysis } from './useErrorAnalysis.js';

/**
 * useAiSuite — agrège tous les hooks IA de l'app (résumé, fiche, quiz, flashcards,
 * glossaire, chat, socratique, plan, prédiction, analyse d'erreurs, comparaison)
 * et maintient les refs de restauration utilisées par useSessions.
 *
 * Sépare la couche « données IA » du composant AppPage (contrôleur + vue).
 *
 * @param {object}  p
 * @param {Function} p.saveSession        — fourni par useSessions
 * @param {object}   p.restoreSummaryRef  — refs partagées avec useSessions
 * @param {object}   p.restoreExamRef
 * @param {object}   p.restoreQuizRef
 * @param {object}   p.restoreFcRef
 * @returns {object} état + actions de tous les hooks IA (noms à plat)
 */
export function useAiSuite({ saveSession, restoreSummaryRef, restoreExamRef, restoreQuizRef, restoreFcRef }) {
  // ── Hooks AI ───────────────────────────────────────────────────────────────
  const { results: summaryResults, streaming: summaryStreaming, progress: summaryProgress,
          loading: summarizing, summarize, reset: resetSummary,
          restoreFrom: restoreSummaryFrom } = useSummarize({ saveSession });

  const { md: examMd, streaming: examStreaming, loading: examLoading,
          generate: generateExam, reset: resetExam,
          restoreFrom: restoreExamFrom } = useExamSheet({ saveSession });

  const {
    questions, answers: quizAnswers, idx: quizIdx, submitted: quizSubmitted,
    score: quizScore, loading: quizLoading,
    generate: generateQuiz, reset: resetQuiz, restoreFrom: restoreQuizFrom,
    selectAnswer, goTo: quizGoTo, submit: submitQuiz, retryWrong,
  } = useQuiz({ saveSession });

  const {
    decks, deckIdx, cards, cardStates, srsOnlyDue,
    loading: fcLoading,
    generate: generateFlashcards, reset: resetFlashcards, restoreFrom: restoreFcFrom,
    markCard, shuffle, restart, redoWrong, switchDeck, toggleSrs,
  } = useFlashcards({ saveSession });

  // Maintient les refs à jour pour useSessions
  useEffect(() => {
    restoreSummaryRef.current = restoreSummaryFrom;
    restoreExamRef.current    = restoreExamFrom;
    restoreQuizRef.current    = restoreQuizFrom;
    restoreFcRef.current      = restoreFcFrom;
  }, [restoreSummaryFrom, restoreExamFrom, restoreQuizFrom, restoreFcFrom,
      restoreSummaryRef, restoreExamRef, restoreQuizRef, restoreFcRef]);

  // ── Glossaire ──────────────────────────────────────────────────────────────
  const { terms: glossaryTerms, loading: glossaryLoading, error: glossaryError,
          generate: generateGlossary, reset: resetGlossary } = useGlossary();

  // ── Chat ───────────────────────────────────────────────────────────────────
  const { messages: chatMessages, loading: chatLoading,
          send: sendChat, reset: resetChat } = useChat();

  // ── Nouvelles features ─────────────────────────────────────────────────────
  const { history: socraticHistory, streaming: socraticStreaming, loading: socraticLoading,
          error: socraticError, started: socraticStarted, send: sendSocratic, reset: resetSocratic } = useSocratic();

  const { plan: studyPlan, loading: studyPlanLoading, error: studyPlanError,
          generate: generateStudyPlan, reset: resetStudyPlan } = useStudyPlan();

  const { results: predictResults, loading: predictLoading, error: predictError,
          generate: generatePredict, reset: resetPredict } = usePredict();

  const { patterns: errorPatterns, message: errorMessage, loading: errorLoading,
          error: errorAnalysisError, analyze: analyzeErrors, reset: resetErrorAnalysis,
          getWrongAnswers } = useErrorAnalysis();

  return {
    // résumé
    summaryResults, summaryStreaming, summaryProgress, summarizing, summarize, resetSummary, restoreSummaryFrom,
    // fiche d'examen
    examMd, examStreaming, examLoading, generateExam, resetExam, restoreExamFrom,
    // quiz
    questions, quizAnswers, quizIdx, quizSubmitted, quizScore, quizLoading,
    generateQuiz, resetQuiz, restoreQuizFrom, selectAnswer, quizGoTo, submitQuiz, retryWrong,
    // flashcards
    decks, deckIdx, cards, cardStates, srsOnlyDue, fcLoading,
    generateFlashcards, resetFlashcards, restoreFcFrom,
    markCard, shuffle, restart, redoWrong, switchDeck, toggleSrs,
    // glossaire
    glossaryTerms, glossaryLoading, glossaryError, generateGlossary, resetGlossary,
    // chat
    chatMessages, chatLoading, sendChat, resetChat,
    // socratique
    socraticHistory, socraticStreaming, socraticLoading, socraticError, socraticStarted,
    sendSocratic, resetSocratic,
    // plan de révision
    studyPlan, studyPlanLoading, studyPlanError, generateStudyPlan, resetStudyPlan,
    // prédicteur
    predictResults, predictLoading, predictError, generatePredict, resetPredict,
    // analyse d'erreurs
    errorPatterns, errorMessage, errorLoading, errorAnalysisError,
    analyzeErrors, resetErrorAnalysis, getWrongAnswers,
  };
}

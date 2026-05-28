// Coûts fixes côté serveur (services/jetons.js) — jamais modifiés sans mise à jour ici
export const COSTS = { summarize: 3, quiz: 2, flashcards: 1, examSheet: 3 };

/**
 * Retourne les paramètres de génération pour chaque objectif.
 *
 * genSummary   : bool — lance /api/summarize
 * genExam      : bool — lance /api/exam-sheet
 * genQuiz      : bool — lance /api/quiz
 * genFlashcards: bool — lance /api/flashcards
 * quizCount    : nombre de questions
 * quizDiff     : 'facile' | 'moyen' | 'difficile'
 * fcCount      : nombre de flashcards
 * cost         : coût total en jetons
 */
export function getGoalParams(goal) {
  switch (goal) {
    case 'exam':
      return {
        genSummary: true, genExam: true, genQuiz: true, genFlashcards: true,
        quizCount: 10, quizDiff: 'difficile', fcCount: 8,
        cost: COSTS.summarize + COSTS.examSheet + COSTS.quiz + COSTS.flashcards, // 9
      };
    case 'understand':
      return {
        genSummary: true, genExam: false, genQuiz: true, genFlashcards: true,
        quizCount: 5, quizDiff: 'moyen', fcCount: 20,
        cost: COSTS.summarize + COSTS.quiz + COSTS.flashcards, // 6
      };
    case 'memorize':
      return {
        genSummary: true, genExam: false, genQuiz: false, genFlashcards: true,
        quizCount: 0, quizDiff: 'moyen', fcCount: 30,
        cost: COSTS.summarize + COSTS.flashcards, // 4
      };
    case 'practice':
      return {
        genSummary: true, genExam: false, genQuiz: true, genFlashcards: true,
        quizCount: 15, quizDiff: 'moyen', fcCount: 10,
        cost: COSTS.summarize + COSTS.quiz + COSTS.flashcards, // 6
      };
    default:
      return {
        genSummary: true, genExam: false, genQuiz: true, genFlashcards: true,
        quizCount: 5, quizDiff: 'moyen', fcCount: 10,
        cost: COSTS.summarize + COSTS.quiz + COSTS.flashcards, // 6
      };
  }
}

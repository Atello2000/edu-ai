export function getGoalParams(goal) {
  switch (goal) {
    case 'exam':       return { quizCount: 10, quizDiff: 'difficile', fcCount: 8  };
    case 'understand': return { quizCount: 5,  quizDiff: 'moyen',     fcCount: 20 };
    case 'memorize':   return { quizCount: 5,  quizDiff: 'moyen',     fcCount: 30 };
    case 'practice':   return { quizCount: 15, quizDiff: 'moyen',     fcCount: 10 };
    default:           return { quizCount: 5,  quizDiff: 'moyen',     fcCount: 10 };
  }
}

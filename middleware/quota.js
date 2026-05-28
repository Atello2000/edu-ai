/**
 * middleware/quota.js — limites techniques de traitement (taille fichiers,
 * troncature de texte, nombre max de quiz/flashcards).
 *
 * NB : le rationnement par usage est géré par le système de jetons
 * (services/jetons.js), PAS ici. L'ancien quota journalier par action
 * (checkQuota / QUOTA_DAILY) a été retiré — il faisait doublon avec les
 * jetons et n'était plus appelé.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

const LIMITS = IS_PROD ? {
  fileSize:      20 * 1024 * 1024,
  maxFiles:      3,
  summaryChars:  80000,
  quizChars:     80000,
  quizMaxCount:  20,
  flashChars:    30000,
  flashMaxCount: 30,
  chatChars:     6000,
} : {
  fileSize:      50 * 1024 * 1024,
  maxFiles:      20,
  summaryChars:  60000,
  quizChars:     40000,
  quizMaxCount:  999,
  flashChars:    20000,
  flashMaxCount: 999,
  chatChars:     8000,
};

module.exports = { IS_PROD, LIMITS };

/**
 * routes/ai/index.js — point d'entrée des routes IA
 * Chaque feature dans son propre fichier pour la lisibilité et la maintenabilité.
 */
const express = require('express');
const router  = express.Router();

router.use(require('./summarize'));
router.use(require('./quiz'));
router.use(require('./exam-sheet'));
router.use(require('./flashcards'));
router.use(require('./chat'));
router.use(require('./topic'));

module.exports = router;

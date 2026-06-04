import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import Onboarding from './Onboarding.jsx';
import AppHeader from '../components/AppHeader.jsx';
import DashboardPanel from '../components/DashboardPanel.jsx';
import PomodoroWidget from '../components/PomodoroWidget.jsx';
import FoldersPanel from '../components/FoldersPanel.jsx';
import StatsPanel from '../components/StatsPanel.jsx';
import HistoryPanel from '../components/HistoryPanel.jsx';
import SettingsDrawer from '../components/SettingsDrawer.jsx';
import UploadZone from '../components/UploadZone.jsx';
import FloatNav from '../components/FloatNav.jsx';
import SaveFolderModal from '../components/SaveFolderModal.jsx';
import LibraryPanel from '../components/LibraryPanel.jsx';
const MindmapModal = lazy(() => import('../components/MindmapModal.jsx'));
import TTSBar from '../components/TTSBar.jsx';
import ActionsPanel from '../components/ActionsPanel.jsx';
import GoalModal from '../components/GoalModal.jsx';
import FeedbackButton from '../components/FeedbackButton.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { getDueCards } from '../hooks/useFlashcards.js';
import { useSessions } from '../hooks/useSessions.js';
import { usePrepareSession } from '../hooks/usePrepareSession.js';
import { useJetons } from '../hooks/useJetons.js';
import { useAiSuite } from '../hooks/useAiSuite.js';

// Sections lourdes — chargées à la demande (lazy, mount-once)
const SummaryResults       = lazy(() => import('../components/SummarySection.jsx'));
const ExamSheetSection     = lazy(() => import('../components/ExamSheetSection.jsx'));
const QuizSection          = lazy(() => import('../components/QuizSection.jsx'));
const FlashcardSection     = lazy(() => import('../components/FlashcardSection.jsx'));
const ChatSection          = lazy(() => import('../components/ChatSection.jsx'));
const GlossarySection      = lazy(() => import('../components/GlossarySection.jsx'));
const SocraticSection      = lazy(() => import('../components/SocraticSection.jsx'));
const StudyPlanSection     = lazy(() => import('../components/StudyPlanSection.jsx'));
const PredictSection       = lazy(() => import('../components/PredictSection.jsx'));
const ErrorAnalysisSection = lazy(() => import('../components/ErrorAnalysisSection.jsx'));
import toast from '../utils/toast';
import PlansModal from '../components/PlansModal';
import eventBus from '../utils/eventBus';
import { apiFetch } from '../utils/apiFetch';

// ── Préférences utilisateur (localStorage) ───────────────────────────────────
const PREFS_KEY = 'jangalai-prefs';
function getPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
  catch { return {}; }
}

export default function AppPage() {
  const { user, refreshSession } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [congratsPlan, setCongratsPlan] = useState('');
  const [activityKey,    setActivityKey]    = useState(0);
  const [showPomodoro,   setShowPomodoro]   = useState(false);

  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const pollingIntervalRef = useRef(null);

  // Écouter l'ouverture des plans depuis n'importe quel widget
  useEffect(() => {
    const showPlansFn = () => setShowPlansModal(true);
    eventBus.on('plans:open', showPlansFn);
    return () => eventBus.off('plans:open', showPlansFn);
  }, []);

  // Nettoyage du poller sur démontage
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Intercepter les retours de paiement (PayTech success/cancel)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const plan = params.get('plan');

    if (payment === 'success') {
      const selectedPlan = plan || 'pro';
      setTimeout(() => {
        setCongratsPlan(selectedPlan);
        setShowCongratsModal(true);
      }, 0);
      
      // Mettre à jour la session utilisateur et le quota de jetons
      if (typeof refreshSession === 'function') refreshSession();
      eventBus.emit('quota:refresh');

      // Nettoyer l'URL propre sans recharger la page
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (payment === 'cancel') {
      toast.warn('Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refreshSession]);

  // ── État upload ────────────────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // ── Loader mindmap (React state — ne jamais toucher le DOM directement) ────
  const [mindmapLoading, setMindmapLoading] = useState(false);

  // ── Sélection de fichiers (levé depuis ActionsPanel) ──────────────────────
  // null = tous sélectionnés, Set = sélection partielle
  const [selectedFileIds, setSelectedFileIds] = useState(null);

  // Fichiers effectivement sélectionnés (mémoïsé)
  const selectedFiles = useMemo(() => {
    if (!selectedFileIds || selectedFileIds.size === uploadedFiles.length) return uploadedFiles;
    if (selectedFileIds.size === 0) return [];
    return uploadedFiles.filter(f => selectedFileIds.has(f.id));
  }, [uploadedFiles, selectedFileIds]);

  // Ref stable pour les callbacks (évite de recréer tous les handlers à chaque sélection)
  const selectedFilesRef = useRef(selectedFiles);
  useEffect(() => { selectedFilesRef.current = selectedFiles; }, [selectedFiles]);

  // ── Paramètres Quiz / Flashcards (levés depuis ActionsPanel) ──────────────
  const [quizCount,      setQuizCount]      = useState(() => Number(getPrefs().quizCount)     || 5);
  const [quizDifficulty, setQuizDifficulty] = useState(() => getPrefs().quizDifficulty        || 'moyen');
  const [fcCount,        setFcCount]        = useState(() => Number(getPrefs().fcCount)        || 10);
  const [examMode,       setExamMode]       = useState(false);
  const [examMins,       setExamMins]       = useState(10);

  // Synchroniser avec les prefs modifiées depuis SettingsDrawer
  useEffect(() => {
    return eventBus.on('prefs:changed', () => {
      const p = getPrefs();
      if (p.quizCount)      setQuizCount(Number(p.quizCount));
      if (p.quizDifficulty) setQuizDifficulty(p.quizDifficulty);
      if (p.fcCount)        setFcCount(Number(p.fcCount));
      if (p.reduceMotion)   document.documentElement.classList.add('reduce-motion');
      else                  document.documentElement.classList.remove('reduce-motion');
    });
  }, []);

  // ── Panel navigation ──────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState('dashboard-panel');

  // Mount-once : les sections lazy ne sont montées qu'à leur première visite,
  // puis restent dans le DOM (CSS hidden) pour préserver leur état.
  const [mountedPanels, setMountedPanels] = useState(
    () => new Set(['dashboard-panel', 'actions-section', 'upload-section'])
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMountedPanels(prev => {
      if (prev.has(activePanel)) return prev;
      return new Set([...prev, activePanel]);
    });
  }, [activePanel]);

  // ── Refs pour restore — créées avant useSessions ET avant les hooks AI ────
  const restoreSummaryRef = useRef(null);
  const restoreExamRef    = useRef(null);
  const restoreQuizRef    = useRef(null);
  const restoreFcRef      = useRef(null);

  // ── Session history ────────────────────────────────────────────────────────
  const { saveSession, restoreSession } = useSessions({
    uploadedFiles, setUploadedFiles, setActivePanel,
    restoreSummaryRef, restoreExamRef, restoreQuizRef, restoreFcRef,
    userPlan: user?.plan,
  });

  // ── Hooks AI (agrégés dans useAiSuite) ──────────────────────────────────────
  const {
    // résumé
    summaryResults, summaryStreaming, summaryProgress, summarizing, summaryError, summarize, resetSummary,
    // fiche d'examen
    examMd, examStreaming, examLoading, generateExam, resetExam,
    // quiz
    questions, quizAnswers, quizIdx, quizSubmitted, quizScore, quizLoading, quizError,
    generateQuiz, resetQuiz, selectAnswer, quizGoTo, submitQuiz, retryWrong,
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
    studyPlan, studyPlanLoading, studyPlanProgress, studyPlanError, generateStudyPlan, resetStudyPlan,
    // prédicteur
    predictResults, predictLoading, predictError, generatePredict,
    // analyse d'erreurs
    errorPatterns, errorMessage, errorLoading, errorAnalysisError,
    analyzeErrors, getWrongAnswers,
  } = useAiSuite({ saveSession, restoreSummaryRef, restoreExamRef, restoreQuizRef, restoreFcRef });

  // ── Chat (état local de fichiers) ───────────────────────────────────────────
  const [chatFiles, setChatFiles] = useState([]);

  // ── Jetons ─────────────────────────────────────────────────────────────────
  const { balance, costs: jetonCosts } = useJetons();

  // ── Session prep ───────────────────────────────────────────────────────────
  const { showGoalModal, sessionGoal, prepLoading, handlePrepareSession, handleGoalSelect } =
    usePrepareSession({
      uploadedFiles, selectedFilesRef, balance,
      summarize, generateExam, generateQuiz, generateFlashcards,
      summarizing, examLoading, quizLoading, fcLoading, setActivePanel,
    });

  const [pendingFolderId, setPendingFolderId] = useState(null);
  const [lastSession,     setLastSession]     = useState(null);
  const [filesToSave,     setFilesToSave]     = useState(null);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const hasFiles = uploadedFiles.some(f => f.text || f.path);

  // ── Handlers dashboard ─────────────────────────────────────────────────────
  const handleDashUpload   = useCallback(() => setActivePanel('upload-section'), []);
  const handleDashContinue = useCallback(() => {
    if (lastSession) restoreSession(lastSession);
  }, [lastSession, restoreSession]);
  const handleDashHistory  = useCallback(() => setActivePanel('history-panel'), []);
  const handleDashStats    = useCallback(() => setActivePanel('stats-panel'), []);
  const handleDashFolders  = useCallback(() => setActivePanel('folders-panel'), []);
  const handleDashLibrary  = useCallback(() => setActivePanel('library-panel'), []);

  // ── Révision SRS depuis le dashboard ──────────────────────────────────────
  const handleSRSReview = useCallback(() => {
    const due = getDueCards();
    if (!due.length) {
      toast.warn('Aucune carte SRS disponible. Générez d\'abord des flashcards depuis vos cours.');
      return;
    }
    restoreFcFrom([{ name: 'Révision du jour', flashcards: due }]);
    setActivePanel('flashcard-section');
  }, [restoreFcFrom]);

  const handleCancelWaiting = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setIsWaitingPayment(false);
    toast.info("Attente du paiement annulée.");
  }, []);

  const handleSelectPlan = useCallback(async (planKey) => {
    try {
      const res = await apiFetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey })
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.redirectUrl) {
        setShowPlansModal(false);
        window.location.assign(data.redirectUrl);

        // 4. Lancer le poller en tâche de fond (toutes les 3 secondes)
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        const start = Date.now();
        
        pollingIntervalRef.current = setInterval(async () => {
          // Timeout de sécurité après 15 minutes
          if (Date.now() - start > 15 * 60 * 1000) {
            clearInterval(pollingIntervalRef.current);
            setIsWaitingPayment(false);
            toast.warn("Délai de paiement dépassé. Vous pouvez réessayer.");
            return;
          }

          try {
            const checkRes = await fetch('/api/auth/me');
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.user && checkData.user.plan !== 'free') {
                // Le webhook IPN a validé la transaction !
                clearInterval(pollingIntervalRef.current);
                setIsWaitingPayment(false);
                setCongratsPlan(checkData.user.plan);
                setShowCongratsModal(true);

                // Rafraîchir les informations
                if (typeof refreshSession === 'function') refreshSession();
                eventBus.emit('quota:refresh');
              }
            }
          } catch { /* polling silencieux */ }
        }, 3000);

      } else {
        toast.error("Impossible d'initier le paiement.");
      }
    } catch {
      toast.error('Erreur lors du lancement du paiement.');
    }
  }, [refreshSession]);

  // ── Handlers features avancées (utilisent selectedFilesRef — pas de deps stales) ──
  const handleSocratic = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Chargez d\'abord un fichier.'); return; }
    setActivePanel('socratic-section');
    if (!socraticStarted) sendSocratic(files, null);
  }, [socraticStarted, sendSocratic]);

  const handlePredict = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Chargez d\'abord un fichier.'); return; }
    setActivePanel('predict-section');
    if (!predictResults.length) generatePredict(files);
  }, [predictResults, generatePredict]);

  const handleStudyPlan    = useCallback(() => setActivePanel('study-plan-section'), []);

  // ── Exécuter une tâche du plan de révision ────────────────────────────────
  const handlePlanLaunch = useCallback((action, task) => {
    const files = selectedFilesRef.current;
    const topic = task?.topic;
    const focusTopics = topic ? [topic] : undefined;

    switch (action) {
      case 'quiz': {
        if (!files.length) { toast.warn('Chargez un fichier pour lancer le quiz.'); return; }
        const diff = task?.type === 'weak_topic' ? 'difficile' : 'moyen';
        generateQuiz(files, { count: 8, difficulty: diff, focus_topics: focusTopics });
        setActivePanel('quiz-section');
        break;
      }
      case 'summarize': {
        if (!files.length) { toast.warn('Chargez un fichier pour générer le résumé.'); return; }
        setActivePanel('summary-section');
        if (!summaryResults.length) summarize(files);
        break;
      }
      case 'srs': {
        handleSRSReview();
        break;
      }
      default: break;
    }
  }, [generateQuiz, summarize, summaryResults, handleSRSReview]);
  const handleErrorAnalysis = useCallback(() => setActivePanel('error-analysis-section'), []);

  // ── Quiz ciblé depuis le prédicteur ──────────────────────────────────────
  const handleQuizFromPredict = useCallback((focusTopics) => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Chargez un fichier pour générer le quiz ciblé.'); return; }
    generateQuiz(files, { count: 8, difficulty: 'moyen', focus_topics: focusTopics });
    setActivePanel('quiz-section');
  }, [generateQuiz]);

  // ── Nouveau quiz sur les erreurs d'un quiz précédent ─────────────────────
  const handleGenerateFromErrors = useCallback((wrongQs) => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Rechargez le fichier pour générer le quiz.'); return; }
    const concepts = [...new Set(wrongQs.map(q => q.sourceHint || q.question.slice(0, 40)).filter(Boolean))].slice(0, 8);
    generateQuiz(files, { count: wrongQs.length, difficulty: 'difficile', focus_topics: concepts });
    setActivePanel('quiz-section');
  }, [generateQuiz]);

  // ── Mode J-1 examen ───────────────────────────────────────────────────────
  const handleJMoins1 = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Chargez un fichier pour générer le plan J-1.'); return; }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    generateStudyPlan(tomorrowStr, files);
    setActivePanel('study-plan-section');
  }, [generateStudyPlan]);

  const handleErrorsToFlashcardsFromAnalysis = useCallback((patterns) => {
    const cards = patterns.map(p => ({
      front: p.title,
      back:  `${p.description}\n\n${p.advice}${p.flashcard_hint ? '\n\nExemple : ' + p.flashcard_hint : ''}`,
    }));
    restoreFcFrom([{ name: 'Erreurs récurrentes', flashcards: cards }]);
    setActivePanel('flashcard-section');
  }, [restoreFcFrom]);

  // ── Effets secondaires onboarding ─────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user && !user.onboarding_done) setShowOnboarding(true);
  }, [user]);

  // ── Callback LibraryPanel → charger des cours depuis la bibliothèque ──────
  const handleUseFiles = useCallback((files) => {
    setUploadedFiles(files);
    setSelectedFileIds(null);  // réinitialiser la sélection
    resetSummary();
    setActivePanel('actions-section');
  }, [resetSummary]);

  // ── Effets secondaires lors du changement de panneau ──────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (activePanel === 'folders-panel') eventBus.emit('folders:refresh');
  }, [activePanel]);

  // ── Quand upload réussit ───────────────────────────────────────────────────
  const handleUploaded = useCallback(async (files) => {
    setUploadedFiles(files);
    setSelectedFileIds(null);  // réinitialiser la sélection
    resetSummary(); resetExam(); resetQuiz(); resetFlashcards(); resetChat();

    if (pendingFolderId) {
      try {
        await apiFetch(`/api/folders/${pendingFolderId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: files.map(f => ({ id: f.id || f.path, name: f.name, size: f.size || 0, text: f.text || '' })) }),
        });
        eventBus.emit('folders:refresh');
        toast.success('Cours ajouté à la matière.');
      } catch {
        toast.error('Erreur lors de l\'ajout à la matière.');
      }
      setPendingFolderId(null);
      setActivePanel('folders-panel');
    } else {
      setActivePanel('actions-section');
      setFilesToSave(files);
    }
  }, [pendingFolderId, resetSummary, resetExam, resetQuiz, resetFlashcards, resetChat]);

  // ── Aller à l'upload depuis une matière ───────────────────────────────────
  const handleGoUploadForFolder = useCallback((folderId) => {
    setPendingFolderId(folderId);
    setActivePanel('upload-section');
  }, []);

  // ── Erreurs quiz → Flashcards ──────────────────────────────────────────────
  const handleErrorsToFlashcards = useCallback((wrongQs) => {
    const cards = wrongQs.map(q => ({
      front: q.question,
      back:  `Bonne réponse : ${q.answer}${q.explanation ? '\n\n' + q.explanation : ''}`,
    }));
    restoreFcFrom([{ name: 'Erreurs quiz', flashcards: cards }]);
    setActivePanel('flashcard-section');
  }, [restoreFcFrom]);

  // ── Actions principales (utilisent selectedFilesRef) ──────────────────────
  const handleSummarize = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Sélectionnez au moins un fichier.'); return; }
    setActivePanel('summary-section');
    if (summaryResults.length > 0) return;
    summarize(files);
  }, [summaryResults, summarize]);

  const handleSummaryRegen = useCallback(() => {
    resetSummary();
    const files = selectedFilesRef.current;
    if (files.length) { setActivePanel('summary-section'); summarize(files); }
  }, [resetSummary, summarize]);

  // ── Partager un résumé via lien ──────────────────────────────────────────
  const handleShareSummary = useCallback(async (results) => {
    try {
      const title = results[0]?.name?.replace(/\.[^.]+$/, '') || 'Résumé';
      const res = await apiFetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'summary', title, content: results }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      const link = `${window.location.origin}/share/${data.token}`;
      await navigator.clipboard.writeText(link);
      toast.success('Lien copié ! Valable 7 jours.');
    } catch (err) {
      toast.error('Impossible de créer le lien : ' + err.message);
    }
  }, []);

  const handleExamSheet = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Sélectionnez au moins un fichier.'); return; }
    setActivePanel('exam-sheet-section');
    if (examMd) return;
    generateExam(files);
  }, [examMd, generateExam]);

  const handleExamRegen = useCallback(() => {
    resetExam();
    const files = selectedFilesRef.current;
    if (files.length) { setActivePanel('exam-sheet-section'); generateExam(files); }
  }, [resetExam, generateExam]);

  // handleQuiz : utilise directement l'état React — plus de document.getElementById
  const handleQuiz = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Sélectionnez au moins un fichier.'); return; }
    setActivePanel('quiz-section');
    generateQuiz(files, { count: quizCount, difficulty: quizDifficulty });
  }, [quizCount, quizDifficulty, generateQuiz]);

  // handleFlashcards : idem
  const handleFlashcards = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Sélectionnez au moins un fichier.'); return; }
    setActivePanel('flashcard-section');
    generateFlashcards(files, { count: fcCount });
  }, [fcCount, generateFlashcards]);

  const handleGlossary = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Sélectionnez au moins un fichier.'); return; }
    eventBus.emit('nav:section', 'glossary-section');
    setActivePanel('glossary-section');
    if (glossaryTerms.length > 0) return;
    generateGlossary(files);
  }, [glossaryTerms, generateGlossary]);

  const handleGlossaryRegen = useCallback(() => {
    resetGlossary();
    const files = selectedFilesRef.current;
    if (files.length) { setActivePanel('glossary-section'); generateGlossary(files); }
  }, [resetGlossary, generateGlossary]);

  const handleOpenChat = useCallback(() => {
    const files = selectedFilesRef.current;
    if (!files.length) { toast.warn('Chargez d\'abord des fichiers.'); return; }
    setChatFiles(files);
    eventBus.emit('nav:section', 'chat-section');
    setActivePanel('chat-section');
  }, []);

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      {showGoalModal  && <GoalModal onSelect={handleGoalSelect} balance={balance} />}
      {showPlansModal && <PlansModal currentPlan={user?.plan || 'free'} onClose={() => setShowPlansModal(false)} onSelectPlan={handleSelectPlan} />}
      
      {showCongratsModal && (() => {
        const isTopup  = congratsPlan === 'topup';
        const isMax    = congratsPlan === 'max';
        const accent   = isMax ? '#a855f7' : isTopup ? '#3d7eff' : '#f5a623';
        const accentTo = isMax ? '#ec4899' : isTopup ? '#7c3aed' : '#f76b1c';
        const glowRgb  = isMax ? '168,85,247' : isTopup ? '61,126,255' : '245,166,35';
        const jetons   = isMax ? 400 : isTopup ? 50 : 150;
        const planLabel = isMax ? 'MAX' : isTopup ? null : 'PRO';
        const benefits = isTopup ? [
          <><strong>+{jetons} jetons</strong> ajoutés à votre solde</>,
          <>Votre plan reste inchangé</>,
          <>Disponible à tout moment, sans engagement</>,
        ] : [
          <><strong>{jetons} jetons</strong> alloués pour ce mois</>,
          <>Rechargement automatique chaque mois</>,
          <>Espace de cours et sessions illimités</>,
        ];
        return (
          <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowCongratsModal(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#0d1117',
              border: `1px solid rgba(${glowRgb},0.25)`,
              borderRadius: '24px',
              padding: '40px 28px 32px',
              maxWidth: '420px',
              width: '92%',
              boxSizing: 'border-box',
              textAlign: 'center',
              boxShadow: `0 32px 64px -12px rgba(0,0,0,0.7), 0 0 48px rgba(${glowRgb},0.15)`,
              position: 'relative',
              overflow: 'hidden',
              animation: 'modalSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              {/* Glow */}
              <div style={{
                position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
                width: '240px', height: '240px', pointerEvents: 'none', zIndex: 0,
                background: `radial-gradient(circle, rgba(${glowRgb},0.25) 0%, transparent 70%)`,
              }} />

              {/* SVG Star */}
              <div style={{
                position: 'relative', zIndex: 1,
                width: '80px', height: '80px', borderRadius: '50%',
                background: `rgba(${glowRgb},0.12)`,
                border: `1.5px solid rgba(${glowRgb},0.35)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: `0 0 28px rgba(${glowRgb},0.25)`,
                animation: 'modalSlideUp 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both',
              }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={accent} />
                      <stop offset="100%" stopColor={accentTo} />
                    </linearGradient>
                  </defs>
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    fill="url(#starGrad)"
                    stroke="none"
                  />
                </svg>
              </div>

              {/* Title */}
              <h2 style={{
                position: 'relative', zIndex: 1,
                fontSize: 'clamp(20px,6.5vw,26px)', fontWeight: '800',
                margin: '0 0 10px',
                background: `linear-gradient(135deg, ${accent} 0%, ${accentTo} 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}>
                {isTopup ? 'Recharge effectuée' : 'Abonnement activé'}
              </h2>

              <p style={{
                position: 'relative', zIndex: 1,
                color: '#94a3b8', fontSize: '14.5px', lineHeight: '1.65',
                margin: '0 0 24px', padding: '0 8px',
              }}>
                {isTopup
                  ? <>+{jetons} jetons ajoutés à votre solde instantanément.</>
                  : <>Votre compte est maintenant sur le plan <strong style={{ color: '#e2e8f0' }}>{planLabel}</strong>. Vos jetons ont été rechargés instantanément.</>
                }
              </p>

              {/* Benefits */}
              <div style={{
                position: 'relative', zIndex: 1,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px', padding: '16px 18px',
                marginBottom: '28px', textAlign: 'left',
              }}>
                <p style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em', fontWeight: '700' }}>
                  Vos nouveaux avantages
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {benefits.map((b, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13.5px', color: '#e2e8f0' }}>
                      <span style={{ color: accent, fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <button
                onClick={() => setShowCongratsModal(false)}
                style={{
                  position: 'relative', zIndex: 1,
                  width: '100%',
                  background: `linear-gradient(135deg, ${accent} 0%, ${accentTo} 100%)`,
                  color: '#fff', border: 'none',
                  padding: '14px 28px', borderRadius: '14px',
                  fontSize: '15px', fontWeight: '600', cursor: 'pointer',
                  boxShadow: `0 10px 24px -5px rgba(${glowRgb},0.45)`,
                  transition: 'opacity .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                C&apos;est parti →
              </button>
            </div>
          </div>
        );
      })()}

      {isWaitingPayment && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="payment-waiting-wrap" onClick={e => e.stopPropagation()}>
            <div className="payment-waiting-icon">
              <svg viewBox="0 0 100 100" width="80" height="80">
                <circle cx="50" cy="50" r="40" stroke="rgba(61, 126, 255, 0.15)" strokeWidth="6" fill="none" />
                <circle cx="50" cy="50" r="40" stroke="var(--blue, #3d7eff)" strokeWidth="6" fill="none"
                  strokeDasharray="250" strokeDashoffset="180" className="payment-waiting-spinner" />
              </svg>
              <div className="payment-waiting-pulse"></div>
            </div>
            <h3 className="payment-waiting-h3">Attente du paiement...</h3>
            <p className="payment-waiting-p">
              Votre lien de paiement sécurisé PayTech a été ouvert dans un nouvel onglet.<br/>
              Si vous utilisez votre téléphone pour valider (Wave, Orange Money), complétez simplement la transaction sur votre mobile.
            </p>
            <span className="payment-waiting-hint">
              Cette fenêtre s&apos;actualisera automatiquement dès la validation de la transaction.
            </span>
            <button className="act-btn rose" style={{ marginTop: '1.2rem', padding: '.5rem 1.8rem', fontSize: '.85rem' }} onClick={handleCancelWaiting}>
              Annuler
            </button>
          </div>
        </div>
      )}
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onResetOnboarding={() => setShowOnboarding(true)}
      />

      {user && user.email_verified === 0 && (
        <div className="verify-email-banner" style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '15px',
          color: '#fca5a5',
          fontSize: '14px',
          fontWeight: '500',
          textAlign: 'center',
          position: 'relative',
          zIndex: 99
        }}>
          <span>📧 <strong>Action requise :</strong> Veuillez valider votre adresse e-mail pour débloquer votre compte.</span>
          <button
            onClick={async (e) => {
              e.preventDefault();
              try {
                const res = await apiFetch('/api/auth/resend-verify', { method: 'POST' });
                if (res.ok) {
                  toast.success("E-mail de validation renvoyé avec succès ! Vérifiez vos spams.");
                } else {
                  toast.error("Impossible de renvoyer l'e-mail.");
                }
              } catch {
                toast.error("Une erreur est survenue.");
              }
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
          >
            Renvoyer le lien
          </button>
        </div>
      )}

      <AppHeader
        activePanel={activePanel}
        user={user}
        onHome={() => setActivePanel('dashboard-panel')}
        onOpenSettings={() => setShowSettings(true)}
        onTogglePomodoro={() => setShowPomodoro(p => !p)}
        showPomodoro={showPomodoro}
      />

      <main>

        {/* DASHBOARD */}
        <div className={`panel dashboard-panel${activePanel !== 'dashboard-panel' ? ' hidden' : ''}`} id="dashboard-panel">
          <DashboardPanel
            greeting={greeting}
            user={user}
            lastSession={lastSession}
            activityKey={activityKey}
            onUpload={handleDashUpload}
            onContinue={handleDashContinue}
            onFolders={handleDashFolders}
            onLibrary={handleDashLibrary}
            onHistory={handleDashHistory}
            onStats={handleDashStats}
            onLastSession={setLastSession}
            onActivity={() => setActivityKey(k => k + 1)}
            onSRSReview={handleSRSReview}
          />
        </div>

        {/* STATISTIQUES */}
        <div className={`panel${activePanel !== 'stats-panel' ? ' hidden' : ''}`} id="stats-panel">
          <ErrorBoundary><StatsPanel /></ErrorBoundary>
        </div>

        {/* HISTORIQUE */}
        <div className={`panel${activePanel !== 'history-panel' ? ' hidden' : ''}`} id="history-panel">
          <ErrorBoundary>
            <HistoryPanel onRestore={restoreSession} userPlan={user?.plan} />
          </ErrorBoundary>
        </div>

        {/* MES MATIÈRES */}
        <div className={`panel${activePanel !== 'folders-panel' ? ' hidden' : ''}`} id="folders-panel">
          <ErrorBoundary>
            <FoldersPanel onGoUpload={handleGoUploadForFolder} onUseFiles={handleUseFiles} userPlan={user?.plan} />
          </ErrorBoundary>
        </div>

        {/* BIBLIOTHÈQUE */}
        <div className={`panel${activePanel !== 'library-panel' ? ' hidden' : ''}`} id="library-panel">
          <ErrorBoundary>
            <LibraryPanel onUseFiles={handleUseFiles} userPlan={user?.plan} />
          </ErrorBoundary>
        </div>

        {/* UPLOAD */}
        <div className={`panel${activePanel !== 'upload-section' ? ' hidden' : ''}`} id="upload-section">
          <ErrorBoundary><UploadZone onUploaded={handleUploaded} userPlan={user?.plan} /></ErrorBoundary>
        </div>

        {/* ACTIONS */}
        <div className={`panel${activePanel !== 'actions-section' ? ' hidden' : ''}`} id="actions-section">
          <ActionsPanel
            user={user}
            jetonCosts={jetonCosts}
            hasFiles={hasFiles}
            uploadedFiles={uploadedFiles}
            onGoUpload={() => setActivePanel('upload-section')}
            onMindmapLoading={setMindmapLoading}
            summaryResults={summaryResults}
            examMd={examMd}
            questions={questions}
            decks={decks}
            quizLoading={quizLoading}
            examLoading={examLoading}
            fcLoading={fcLoading}
            onSummarize={handleSummarize}
            onSummaryRegen={handleSummaryRegen}
            onExamSheet={handleExamSheet}
            onExamRegen={handleExamRegen}
            onQuiz={handleQuiz}
            onFlashcards={handleFlashcards}
            onOpenChat={handleOpenChat}
            onGlossary={handleGlossary}
            glossaryTerms={glossaryTerms}
            glossaryLoading={glossaryLoading}
            onPrepareSession={handlePrepareSession}
            prepLoading={prepLoading}
            sessionGoal={sessionGoal}
            onSocratic={handleSocratic}
            onPredict={handlePredict}
            onStudyPlan={handleStudyPlan}
            onJMoins1={handleJMoins1}
            onErrorAnalysis={handleErrorAnalysis}
            predictLoading={predictLoading}
            predictResults={predictResults}
            selectedFileIds={selectedFileIds}
            onSelectionChange={setSelectedFileIds}
            quizCount={quizCount}
            onQuizCountChange={setQuizCount}
            quizDifficulty={quizDifficulty}
            onQuizDiffChange={setQuizDifficulty}
            fcCount={fcCount}
            onFcCountChange={setFcCount}
            examMode={examMode}
            onExamModeChange={setExamMode}
            examMins={examMins}
            onExamMinsChange={setExamMins}
          />
        </div>

        {/* RÉSUMÉS */}
        {mountedPanels.has('summary-section') && <div className={`panel${activePanel !== 'summary-section' ? ' hidden' : ''}`} id="summary-section">
          {summarizing && (
            <div className="loader-inline">
              <div className="spinner" style={{ width: 20, height: 20 }}></div>
              <span>Génération en cours…</span>
            </div>
          )}
          {summaryError && !summarizing && (
            <div className="error-banner" role="alert">⚠ {summaryError}</div>
          )}
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <SummaryResults
                results={summaryResults}
                streaming={summaryStreaming}
                progress={summaryProgress}
                onCopyAll={() => {
                  const all = summaryResults.map(r => `## ${r.name}\n\n${r.summary}`).join('\n\n---\n\n');
                  navigator.clipboard.writeText(all);
                }}
                onRegen={handleSummaryRegen}
                onShare={handleShareSummary}
              />
            </Suspense>
            <TTSBar />
          </ErrorBoundary>
        </div>}

        {/* FICHE D'EXAMEN */}
        {mountedPanels.has('exam-sheet-section') && <div className={`panel${activePanel !== 'exam-sheet-section' ? ' hidden' : ''}`} id="exam-sheet-section">
          {examLoading && (
            <div className="loader-inline">
              <div className="spinner" style={{ width: 20, height: 20 }}></div>
              <span>Création de la fiche…</span>
            </div>
          )}
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <ExamSheetSection
                md={examMd}
                streaming={examStreaming}
                fileName={uploadedFiles[0]?.name?.replace(/\.[^.]+$/, '') || 'fiche'}
                onRegen={examMd ? handleExamRegen : undefined}
                userPlan={user?.plan}
                onUpgrade={() => setShowPlansModal(true)}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

        {/* QUIZ */}
        {mountedPanels.has('quiz-section') && <div className={`panel${activePanel !== 'quiz-section' ? ' hidden' : ''}`} id="quiz-section">
          <div className="panel-header">
            <div>
              <div className="panel-label">Évaluation</div>
              <h2 className="panel-title">Quiz <em>QCM</em></h2>
            </div>
            <span className="mono-tag" id="quiz-progress-info">
              {questions.length > 0 && `${questions.length} question${questions.length > 1 ? 's' : ''}`}
            </span>
          </div>
          {quizLoading && (
            <div className="loader-inline">
              <div className="spinner" style={{ width: 20, height: 20 }}></div>
              <span>{questions.length > 0 ? `${questions.length} question${questions.length > 1 ? 's' : ''} générée${questions.length > 1 ? 's' : ''}…` : 'Génération du quiz…'}</span>
            </div>
          )}
          {quizError && !quizLoading && (
            <div className="error-banner" role="alert">⚠ {quizError}</div>
          )}
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <QuizSection
                questions={questions}
                answers={quizAnswers}
                idx={quizIdx}
                submitted={quizSubmitted}
                score={quizScore}
                examMode={examMode}
                examMins={examMins}
                onSelect={selectAnswer}
                onGoTo={quizGoTo}
                onSubmit={submitQuiz}
                onRetryWrong={retryWrong}
                onErrorsToFlashcards={handleErrorsToFlashcards}
                onGenerateFromErrors={handleGenerateFromErrors}
                quizTitle={uploadedFiles[0]?.name?.replace(/\.[^.]+$/, '') || 'Quiz'}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

        {/* FLASHCARDS */}
        {mountedPanels.has('flashcard-section') && <div className={`panel${activePanel !== 'flashcard-section' ? ' hidden' : ''}`} id="flashcard-section">
          <div className="panel-header">
            <div>
              <div className="panel-label">Mémorisation</div>
              <h2 className="panel-title">Flash<em>cards</em></h2>
            </div>
          </div>
          {fcLoading && (
            <div className="loader-inline">
              <div className="spinner" style={{ width: 20, height: 20 }}></div>
              <span>Génération des flashcards…</span>
            </div>
          )}
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <FlashcardSection
                decks={decks}
                deckIdx={deckIdx}
                cards={cards}
                cardStates={cardStates}
                srsOnlyDue={srsOnlyDue}
                onMark={markCard}
                onShuffle={shuffle}
                onRestart={restart}
                onRedoWrong={redoWrong}
                onSwitchDeck={switchDeck}
                onToggleSrs={toggleSrs}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

        {/* GLOSSAIRE */}
        {mountedPanels.has('glossary-section') && <div className={`panel${activePanel !== 'glossary-section' ? ' hidden' : ''}`} id="glossary-section">
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <GlossarySection
                terms={glossaryTerms}
                loading={glossaryLoading}
                error={glossaryError}
                onRegen={glossaryTerms.length > 0 ? handleGlossaryRegen : undefined}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

        {/* CHAT */}
        {mountedPanels.has('chat-section') && <div className={`panel${activePanel !== 'chat-section' ? ' hidden' : ''}`} id="chat-section">
          {chatLoading && (
            <div className="loader-inline" style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
              <div className="spinner" style={{ width: 14, height: 14 }}></div>
            </div>
          )}
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <ChatSection
                files={chatFiles}
                messages={chatMessages}
                loading={chatLoading}
                onSend={sendChat}
                onClear={resetChat}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

        {/* MODE SOCRATIQUE */}
        {mountedPanels.has('socratic-section') && <div className={`panel${activePanel !== 'socratic-section' ? ' hidden' : ''}`} id="socratic-section">
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <SocraticSection
                files={selectedFiles}
                history={socraticHistory}
                streaming={socraticStreaming}
                loading={socraticLoading}
                error={socraticError}
                started={socraticStarted}
                onSend={sendSocratic}
                onReset={resetSocratic}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

        {/* PLAN DE RÉVISION */}
        {mountedPanels.has('study-plan-section') && <div className={`panel${activePanel !== 'study-plan-section' ? ' hidden' : ''}`} id="study-plan-section">
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <StudyPlanSection
                plan={studyPlan}
                loading={studyPlanLoading}
                progress={studyPlanProgress}
                error={studyPlanError}
                files={uploadedFiles}
                onGenerate={generateStudyPlan}
                onReset={resetStudyPlan}
                onLaunch={handlePlanLaunch}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

        {/* PRÉDICTEUR */}
        {mountedPanels.has('predict-section') && <div className={`panel${activePanel !== 'predict-section' ? ' hidden' : ''}`} id="predict-section">
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <PredictSection
                results={predictResults}
                loading={predictLoading}
                error={predictError}
                onQuizFromPredict={handleQuizFromPredict}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

        {/* ERREURS RÉCURRENTES */}
        {mountedPanels.has('error-analysis-section') && <div className={`panel${activePanel !== 'error-analysis-section' ? ' hidden' : ''}`} id="error-analysis-section">
          <ErrorBoundary>
            <Suspense fallback={<div className="loader-inline"><div className="spinner" style={{width:20,height:20}}/></div>}>
              <ErrorAnalysisSection
                patterns={errorPatterns}
                message={errorMessage}
                loading={errorLoading}
                error={errorAnalysisError}
                wrongCount={getWrongAnswers().length}
                onAnalyze={analyzeErrors}
                onCreateFlashcards={handleErrorsToFlashcardsFromAnalysis}
              />
            </Suspense>
          </ErrorBoundary>
        </div>}

      </main>

      <FloatNav hasFiles={uploadedFiles.length > 0} activePanel={activePanel} onNavigate={setActivePanel} />

      <Suspense fallback={null}><MindmapModal /></Suspense>

      {/* Loader global mindmap — piloté par état React (pas par DOM) */}
      {mindmapLoading && (
        <div className="loader">
          <div className="loader-box">
            <div className="spinner"></div>
            <p>Génération du mindmap…</p>
            <span className="loader-hint">Cela peut prendre quelques secondes</span>
          </div>
        </div>
      )}

      <SaveFolderModal filesToSave={filesToSave} onClose={() => setFilesToSave(null)} />
      <FeedbackButton />
      {showPomodoro && (
        <div className="pomo-sidebar-container">
          <PomodoroWidget onClose={() => setShowPomodoro(false)} />
        </div>
      )}
    </>
  );
}

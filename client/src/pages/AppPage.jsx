import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import Logo from '../components/Logo.jsx';
import Onboarding from './Onboarding.jsx';
import ForYouSection from '../components/ForYouSection.jsx';
import ActivitySection from '../components/ActivitySection.jsx';
import FoldersPanel from '../components/FoldersPanel.jsx';
import StatsPanel from '../components/StatsPanel.jsx';
import HistoryPanel from '../components/HistoryPanel.jsx';
import SettingsDrawer from '../components/SettingsDrawer.jsx';
import UploadZone from '../components/UploadZone.jsx';
import SummaryResults from '../components/SummarySection.jsx';
import ExamSheetSection from '../components/ExamSheetSection.jsx';
import QuizSection from '../components/QuizSection.jsx';
import FlashcardSection from '../components/FlashcardSection.jsx';
import ChatSection from '../components/ChatSection.jsx';
import GlossarySection from '../components/GlossarySection.jsx';
import DashboardStats from '../components/DashboardStats.jsx';
import FloatNav from '../components/FloatNav.jsx';
import SaveFolderModal from '../components/SaveFolderModal.jsx';
import LibraryPanel from '../components/LibraryPanel.jsx';
import MindmapModal from '../components/MindmapModal.jsx';
import TTSBar from '../components/TTSBar.jsx';
import UserMenu from '../components/UserMenu.jsx';
import JetonWidget from '../components/JetonWidget.jsx';
import ActionsPanel from '../components/ActionsPanel.jsx';
import GoalModal from '../components/GoalModal.jsx';
import FeedbackButton from '../components/FeedbackButton.jsx';
import SRSReviewWidget from '../components/SRSReviewWidget.jsx';
import TopicStatsWidget from '../components/TopicStatsWidget.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { getDueCards } from '../hooks/useFlashcards.js';
import { useSummarize } from '../hooks/useSummarize.js';
import { useExamSheet } from '../hooks/useExamSheet.js';
import { useQuiz } from '../hooks/useQuiz.js';
import { useFlashcards } from '../hooks/useFlashcards.js';
import { useChat } from '../hooks/useChat.js';
import { useGlossary } from '../hooks/useGlossary.js';
import { useSessions } from '../hooks/useSessions.js';
import { usePrepareSession } from '../hooks/usePrepareSession.js';
import { useJetons } from '../hooks/useJetons.js';
import { useSocratic } from '../hooks/useSocratic.js';
import { useStudyPlan } from '../hooks/useStudyPlan.js';
import { usePredict } from '../hooks/usePredict.js';
import { useErrorAnalysis } from '../hooks/useErrorAnalysis.js';
import { useCompare } from '../hooks/useCompare.js';
import SocraticSection from '../components/SocraticSection.jsx';
import StudyPlanSection from '../components/StudyPlanSection.jsx';
import PredictSection from '../components/PredictSection.jsx';
import ErrorAnalysisSection from '../components/ErrorAnalysisSection.jsx';
import CompareSection from '../components/CompareSection.jsx';
import toast from '../utils/toast';
import eventBus from '../utils/eventBus';

// ── Préférences utilisateur (localStorage) ───────────────────────────────────
const PREFS_KEY = 'jangalai-prefs';
function getPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
  catch { return {}; }
}

export default function AppPage() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [activityKey,    setActivityKey]    = useState(0);

  // ── État upload ────────────────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState([]);

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

  // ── Refs pour restore — créées avant useSessions ET avant les hooks AI ────
  const restoreSummaryRef = useRef(null);
  const restoreExamRef    = useRef(null);
  const restoreQuizRef    = useRef(null);
  const restoreFcRef      = useRef(null);

  // ── Session history ────────────────────────────────────────────────────────
  const { saveSession, restoreSession } = useSessions({
    uploadedFiles, setUploadedFiles, setActivePanel,
    restoreSummaryRef, restoreExamRef, restoreQuizRef, restoreFcRef,
  });

  // ── Hooks AI ───────────────────────────────────────────────────────────────
  const { results: summaryResults, streaming: summaryStreaming,
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
  const [chatFiles, setChatFiles] = useState([]);
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

  const { md: compareMd, streaming: compareStreaming, loading: compareLoading,
          error: compareError, generate: generateCompare, reset: resetCompare } = useCompare();

  // ── Jetons ─────────────────────────────────────────────────────────────────
  const { balance } = useJetons();

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
    if (!due.length) return;
    restoreFcFrom([{ name: 'Révision du jour', flashcards: due }]);
    setActivePanel('flashcard-section');
  }, [restoreFcFrom]);

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

  const handleCompare = useCallback(() => {
    const files = selectedFilesRef.current;
    if (files.length < 2) { toast.warn('Sélectionnez au moins 2 fichiers pour la comparaison.'); return; }
    setActivePanel('compare-section');
    if (!compareMd) generateCompare(files);
  }, [compareMd, generateCompare]);

  const handleStudyPlan    = useCallback(() => setActivePanel('study-plan-section'), []);
  const handleErrorAnalysis = useCallback(() => setActivePanel('error-analysis-section'), []);

  const handleErrorsToFlashcardsFromAnalysis = useCallback((patterns) => {
    const cards = patterns.map(p => ({
      front: p.title,
      back:  `${p.description}\n\n${p.advice}${p.flashcard_hint ? '\n\nExemple : ' + p.flashcard_hint : ''}`,
    }));
    restoreFcFrom([{ name: 'Erreurs récurrentes', flashcards: cards }]);
    setActivePanel('flashcard-section');
  }, [restoreFcFrom]);

  const handleCompareRegen = useCallback(() => {
    resetCompare();
    const files = selectedFilesRef.current;
    if (files.length >= 2) generateCompare(files);
  }, [resetCompare, generateCompare]);

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
        await fetch(`/api/folders/${pendingFolderId}/files`, {
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
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onResetOnboarding={() => setShowOnboarding(true)}
      />

      <header>
        <button
          className={`back-home-btn${activePanel === 'dashboard-panel' ? ' hidden' : ''}`}
          id="back-home-btn"
          title="Tableau de bord"
          onClick={() => setActivePanel('dashboard-panel')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="header-logo" id="header-logo" onClick={() => setActivePanel('dashboard-panel')} style={{ cursor: 'pointer' }}>
          <Logo />
        </div>
        <div className="header-right">
          <JetonWidget />
          <UserMenu user={user} onOpenSettings={() => setShowSettings(true)} />
        </div>
      </header>

      <main>

        {/* DASHBOARD */}
        <div className={`panel dashboard-panel${activePanel !== 'dashboard-panel' ? ' hidden' : ''}`} id="dashboard-panel">
          <div className="dash-greeting">
            <h1 className="dash-greeting-title">
              {greeting}{user ? <>, <em>{user.name.split(' ')[0]}</em></> : null}
            </h1>
            <p className="dash-greeting-sub">Que souhaitez-vous réviser aujourd&apos;hui ?</p>
          </div>
          <div className="dash-quick-actions">
            <button className="dash-qaction dq-purple" onClick={handleDashUpload}>
              <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
              <span className="dash-qaction-label">Charger un cours</span>
              <span className="dash-qaction-hint">PDF, PPT, DOCX</span>
            </button>
            <button className="dash-qaction dq-blue" disabled={!lastSession} onClick={handleDashContinue}>
              <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
              <span className="dash-qaction-label">Continuer</span>
              <span className="dash-qaction-hint">{lastSession?.files?.[0] || 'Aucune session'}</span>
            </button>
            <button className="dash-qaction dq-gold" onClick={handleDashFolders}>
              <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
              <span className="dash-qaction-label">Mes matières</span>
              <span className="dash-qaction-hint">Cours classés</span>
            </button>
            <button className="dash-qaction dq-teal" onClick={handleDashLibrary}>
              <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
              <span className="dash-qaction-label">Bibliothèque</span>
              <span className="dash-qaction-hint">Tous les cours</span>
            </button>
          </div>
          <div className="dash-stats-row">
            <div className="panel-header" style={{ marginBottom: '.5rem' }}>
              <div className="panel-label">Progression</div>
              <button className="ghost-btn" onClick={() => eventBus.emit('dashboard:refresh')}>Actualiser</button>
            </div>
            <DashboardStats onLastSession={setLastSession} />
          </div>
          <ForYouSection onActivity={() => setActivityKey(k => k + 1)} />
          <SRSReviewWidget onReview={handleSRSReview} />
          <TopicStatsWidget />
          <div className="dash-bottom-links">
            <button className="dash-link" onClick={handleDashHistory}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              Mes cours récents
            </button>
            <button className="dash-link" onClick={handleDashStats}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7" rx="1"/><rect x="12" y="7" width="3" height="11" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></svg>
              Statistiques
            </button>
          </div>
          <ActivitySection refreshKey={activityKey} />
        </div>

        {/* STATISTIQUES */}
        <div className={`panel${activePanel !== 'stats-panel' ? ' hidden' : ''}`} id="stats-panel">
          <ErrorBoundary><StatsPanel /></ErrorBoundary>
        </div>

        {/* HISTORIQUE */}
        <div className={`panel${activePanel !== 'history-panel' ? ' hidden' : ''}`} id="history-panel">
          <ErrorBoundary>
            <HistoryPanel onRestore={restoreSession} />
          </ErrorBoundary>
        </div>

        {/* MES MATIÈRES */}
        <div className={`panel${activePanel !== 'folders-panel' ? ' hidden' : ''}`} id="folders-panel">
          <ErrorBoundary>
            <FoldersPanel onGoUpload={handleGoUploadForFolder} onUseFiles={handleUseFiles} />
          </ErrorBoundary>
        </div>

        {/* BIBLIOTHÈQUE */}
        <div className={`panel${activePanel !== 'library-panel' ? ' hidden' : ''}`} id="library-panel">
          <ErrorBoundary>
            <LibraryPanel onUseFiles={handleUseFiles} />
          </ErrorBoundary>
        </div>

        {/* UPLOAD */}
        <div className={`panel${activePanel !== 'upload-section' ? ' hidden' : ''}`} id="upload-section">
          <ErrorBoundary><UploadZone onUploaded={handleUploaded} /></ErrorBoundary>
        </div>

        {/* ACTIONS */}
        <div className={`panel${activePanel !== 'actions-section' ? ' hidden' : ''}`} id="actions-section">
          <ActionsPanel
            hasFiles={hasFiles}
            uploadedFiles={uploadedFiles}
            onGoUpload={() => setActivePanel('upload-section')}
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
            onCompare={handleCompare}
            onStudyPlan={handleStudyPlan}
            onErrorAnalysis={handleErrorAnalysis}
            predictLoading={predictLoading}
            compareLoading={compareLoading}
            predictResults={predictResults}
            compareMd={compareMd}
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
        <div className={`panel${activePanel !== 'summary-section' ? ' hidden' : ''}`} id="summary-section">
          {summarizing && (
            <div className="loader-inline">
              <div className="spinner" style={{ width: 20, height: 20 }}></div>
              <span>Génération en cours…</span>
            </div>
          )}
          <ErrorBoundary>
            <SummaryResults
              results={summaryResults}
              streaming={summaryStreaming}
              onCopyAll={() => {
                const all = summaryResults.map(r => `## ${r.name}\n\n${r.summary}`).join('\n\n---\n\n');
                navigator.clipboard.writeText(all);
              }}
              onRegen={handleSummaryRegen}
            />
            <TTSBar />
          </ErrorBoundary>
        </div>

        {/* FICHE D'EXAMEN */}
        <div className={`panel${activePanel !== 'exam-sheet-section' ? ' hidden' : ''}`} id="exam-sheet-section">
          {examLoading && (
            <div className="loader-inline">
              <div className="spinner" style={{ width: 20, height: 20 }}></div>
              <span>Création de la fiche…</span>
            </div>
          )}
          <ErrorBoundary>
            <ExamSheetSection
              md={examMd}
              streaming={examStreaming}
              fileName={uploadedFiles[0]?.name?.replace(/\.[^.]+$/, '') || 'fiche'}
              onRegen={examMd ? handleExamRegen : undefined}
            />
          </ErrorBoundary>
        </div>

        {/* QUIZ */}
        <div className={`panel${activePanel !== 'quiz-section' ? ' hidden' : ''}`} id="quiz-section">
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
          <ErrorBoundary>
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
            />
          </ErrorBoundary>
        </div>

        {/* FLASHCARDS */}
        <div className={`panel${activePanel !== 'flashcard-section' ? ' hidden' : ''}`} id="flashcard-section">
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
          </ErrorBoundary>
        </div>

        {/* GLOSSAIRE */}
        <div className={`panel${activePanel !== 'glossary-section' ? ' hidden' : ''}`} id="glossary-section">
          <ErrorBoundary>
            <GlossarySection
              terms={glossaryTerms}
              loading={glossaryLoading}
              error={glossaryError}
              onRegen={glossaryTerms.length > 0 ? handleGlossaryRegen : undefined}
            />
          </ErrorBoundary>
        </div>

        {/* CHAT */}
        <div className={`panel${activePanel !== 'chat-section' ? ' hidden' : ''}`} id="chat-section">
          {chatLoading && (
            <div className="loader-inline" style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
              <div className="spinner" style={{ width: 14, height: 14 }}></div>
            </div>
          )}
          <ErrorBoundary>
            <ChatSection
              files={chatFiles}
              messages={chatMessages}
              loading={chatLoading}
              onSend={sendChat}
              onClear={resetChat}
            />
          </ErrorBoundary>
        </div>

        {/* MODE SOCRATIQUE */}
        <div className={`panel${activePanel !== 'socratic-section' ? ' hidden' : ''}`} id="socratic-section">
          <ErrorBoundary>
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
          </ErrorBoundary>
        </div>

        {/* PLAN DE RÉVISION */}
        <div className={`panel${activePanel !== 'study-plan-section' ? ' hidden' : ''}`} id="study-plan-section">
          <ErrorBoundary>
            <StudyPlanSection
              plan={studyPlan}
              loading={studyPlanLoading}
              error={studyPlanError}
              onGenerate={generateStudyPlan}
              onReset={resetStudyPlan}
            />
          </ErrorBoundary>
        </div>

        {/* PRÉDICTEUR */}
        <div className={`panel${activePanel !== 'predict-section' ? ' hidden' : ''}`} id="predict-section">
          <ErrorBoundary>
            <PredictSection
              results={predictResults}
              loading={predictLoading}
              error={predictError}
            />
          </ErrorBoundary>
        </div>

        {/* ERREURS RÉCURRENTES */}
        <div className={`panel${activePanel !== 'error-analysis-section' ? ' hidden' : ''}`} id="error-analysis-section">
          <ErrorBoundary>
            <ErrorAnalysisSection
              patterns={errorPatterns}
              message={errorMessage}
              loading={errorLoading}
              error={errorAnalysisError}
              wrongCount={getWrongAnswers().length}
              onAnalyze={analyzeErrors}
              onCreateFlashcards={handleErrorsToFlashcardsFromAnalysis}
            />
          </ErrorBoundary>
        </div>

        {/* COMPARAISON MULTI-SOURCES */}
        <div className={`panel${activePanel !== 'compare-section' ? ' hidden' : ''}`} id="compare-section">
          <ErrorBoundary>
            <CompareSection
              md={compareMd}
              streaming={compareStreaming}
              loading={compareLoading}
              error={compareError}
              fileNames={selectedFiles.map(f => f.name)}
              onRegen={compareMd ? handleCompareRegen : undefined}
            />
          </ErrorBoundary>
        </div>

      </main>

      <FloatNav hasFiles={uploadedFiles.length > 0} activePanel={activePanel} onNavigate={setActivePanel} />

      <MindmapModal />

      {/* Loader global (utilisé par handleMindmap dans ActionsPanel) */}
      <div className="loader hidden" id="loader">
        <div className="loader-box">
          <div className="spinner"></div>
          <p id="loader-text">Traitement en cours…</p>
          <span className="loader-hint">Cela peut prendre quelques secondes</span>
        </div>
      </div>

      <SaveFolderModal filesToSave={filesToSave} onClose={() => setFilesToSave(null)} />
      <FeedbackButton />
    </>
  );
}

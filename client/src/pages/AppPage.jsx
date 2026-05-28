import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import Onboarding from './Onboarding.jsx';
import AppHeader from '../components/AppHeader.jsx';
import DashboardPanel from '../components/DashboardPanel.jsx';
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
import FloatNav from '../components/FloatNav.jsx';
import SaveFolderModal from '../components/SaveFolderModal.jsx';
import LibraryPanel from '../components/LibraryPanel.jsx';
import MindmapModal from '../components/MindmapModal.jsx';
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

  // ── Hooks AI (agrégés dans useAiSuite) ──────────────────────────────────────
  const {
    // résumé
    summaryResults, summaryStreaming, summarizing, summarize, resetSummary,
    // fiche d'examen
    examMd, examStreaming, examLoading, generateExam, resetExam,
    // quiz
    questions, quizAnswers, quizIdx, quizSubmitted, quizScore, quizLoading,
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
    studyPlan, studyPlanLoading, studyPlanError, generateStudyPlan, resetStudyPlan,
    // prédicteur
    predictResults, predictLoading, predictError, generatePredict,
    // analyse d'erreurs
    errorPatterns, errorMessage, errorLoading, errorAnalysisError,
    analyzeErrors, getWrongAnswers,
    // comparaison
    compareMd, compareStreaming, compareLoading, compareError, generateCompare, resetCompare,
  } = useAiSuite({ saveSession, restoreSummaryRef, restoreExamRef, restoreQuizRef, restoreFcRef });

  // ── Chat (état local de fichiers) ───────────────────────────────────────────
  const [chatFiles, setChatFiles] = useState([]);

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

      <AppHeader
        activePanel={activePanel}
        user={user}
        onHome={() => setActivePanel('dashboard-panel')}
        onOpenSettings={() => setShowSettings(true)}
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

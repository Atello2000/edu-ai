import { useEffect, useRef, useState, useCallback } from 'react';
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
import { useSummarize } from '../hooks/useSummarize.js';
import { useExamSheet } from '../hooks/useExamSheet.js';
import { useQuiz } from '../hooks/useQuiz.js';
import { useFlashcards } from '../hooks/useFlashcards.js';
import { useChat } from '../hooks/useChat.js';

const CDN_SCRIPTS = [
  { src: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js',                                     id: 'cdn-marked' },
  { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',                   id: 'cdn-jspdf' },
  { src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',            id: 'cdn-html2canvas' },
];

function loadScript({ src, id }) {
  return new Promise((resolve) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement('script');
    s.id = id; s.src = src;
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

export default function AppPage() {
  const { user } = useAuth();
  const initialized = useRef(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [activityKey,    setActivityKey]    = useState(0);

  // ── État partagé Upload + Summary (React-owned) ────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const { results: summaryResults, streaming: summaryStreaming,
          loading: summarizing, summarize, reset: resetSummary,
          restoreFrom: restoreSummaryFrom } = useSummarize();

  // ── Fiche d'examen ─────────────────────────────────────────────────────────
  const { md: examMd, streaming: examStreaming, loading: examLoading,
          generate: generateExam, reset: resetExam,
          restoreFrom: restoreExamFrom } = useExamSheet();

  // ── Quiz ───────────────────────────────────────────────────────────────────
  const {
    questions, answers: quizAnswers, idx: quizIdx, submitted: quizSubmitted,
    score: quizScore, loading: quizLoading,
    generate: generateQuiz, reset: resetQuiz, restoreFrom: restoreQuizFrom,
    selectAnswer, goTo: quizGoTo, submit: submitQuiz,
  } = useQuiz();

  // ── Flashcards ─────────────────────────────────────────────────────────────
  const {
    decks, deckIdx, cards, cardStates, srsOnlyDue,
    loading: fcLoading,
    generate: generateFlashcards, reset: resetFlashcards, restoreFrom: restoreFcFrom,
    markCard, shuffle, restart, redoWrong, switchDeck, toggleSrs,
  } = useFlashcards();

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [chatFiles, setChatFiles] = useState([]);
  const {
    messages: chatMessages, loading: chatLoading,
    attachedFile, setAttachedFile, attachedImage, setAttachedImage,
    send: sendChat, reset: resetChat,
    uploadAttachment, readImageAsBase64,
  } = useChat();

  // Quiz exam-mode settings (managed via DOM refs from JSX)
  const [examMode, setExamMode] = useState(false);
  const [examMins, setExamMins] = useState(10);

  useEffect(() => {
    if (user && !user.onboarding_done) setShowOnboarding(true);
    window.__editProfile = () => setShowOnboarding(true);
  }, [user]);

  // ── Bridges pour les parties de app.js non encore migrées ─────────────────
  useEffect(() => {
    // FoldersPanel charge des fichiers existants → sync vers React + app.js
    window.__setFolderFiles = (files) => {
      setUploadedFiles(files);
      resetSummary();
      // app.js encore responsable de la nav vers actions-section
      window.__appShowPanel?.('actions-section');
    };
    return () => { delete window.__setFolderFiles; };
  }, [resetSummary]);

  // ── Sync uploadedFiles → window pour les features non-migrées (quiz, etc.) ─
  useEffect(() => {
    window.uploadedFilesMeta = uploadedFiles;
    // Re-render la liste dans la section actions (gérée par app.js)
    window.__renderUploadedFiles?.();
  }, [uploadedFiles]);

  // ── Sync summaryResults → window pour le code mindmap non-migré ────────────
  useEffect(() => {
    window._setSummaryResults?.(summaryResults);
  }, [summaryResults]);

  // ── Bridges session restore (app.js → React) ──────────────────────────────
  useEffect(() => {
    window._setSummaryData    = arr  => restoreSummaryFrom(arr);
    window._setExamSheetMd    = md   => restoreExamFrom(md);
    window._setQuizData       = data => restoreQuizFrom(data);
    window._setFlashcardsData = data => restoreFcFrom(data);
    return () => {
      delete window._setSummaryData;
      delete window._setExamSheetMd;
      delete window._setQuizData;
      delete window._setFlashcardsData;
    };
  }, [restoreSummaryFrom, restoreExamFrom, restoreQuizFrom, restoreFcFrom]);

  // ── Quand upload réussit ───────────────────────────────────────────────────
  const handleUploaded = useCallback((files) => {
    setUploadedFiles(files);
    resetSummary(); resetExam(); resetQuiz(); resetFlashcards(); resetChat();
    window.__appShowPanel?.('actions-section');
    window.__showSaveFolderModal?.();
  }, [resetSummary, resetExam, resetQuiz, resetFlashcards, resetChat]);

  // ── Lancement du résumé (bouton dans actions-section) ─────────────────────
  const handleSummarize = useCallback(() => {
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (!files.length) { alert('Sélectionnez au moins un fichier.'); return; }
    if (summaryResults.length > 0) {
      window.__appShowPanel?.('summary-section');
      return;
    }
    window.__appShowPanel?.('summary-section');
    summarize(files);
  }, [uploadedFiles, summaryResults, summarize]);

  const handleSummaryRegen = useCallback(() => {
    resetSummary();
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (files.length) {
      window.__appShowPanel?.('summary-section');
      summarize(files);
    }
  }, [uploadedFiles, resetSummary, summarize]);

  // ── Fiche d'examen ─────────────────────────────────────────────────────────
  const handleExamSheet = useCallback(() => {
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (!files.length) { alert('Sélectionnez au moins un fichier.'); return; }
    if (examMd) { window.__appShowPanel?.('exam-sheet-section'); return; }
    window.__appShowPanel?.('exam-sheet-section');
    generateExam(files);
  }, [uploadedFiles, examMd, generateExam]);

  const handleExamRegen = useCallback(() => {
    resetExam();
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (files.length) {
      window.__appShowPanel?.('exam-sheet-section');
      generateExam(files);
    }
  }, [uploadedFiles, resetExam, generateExam]);

  // ── Quiz ───────────────────────────────────────────────────────────────────
  const handleQuiz = useCallback(() => {
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (!files.length) { alert('Sélectionnez au moins un fichier.'); return; }
    const count      = parseInt(document.getElementById('quiz-count')?.value) || 5;
    const difficulty = document.getElementById('quiz-difficulty')?.value || 'moyen';
    const em         = document.getElementById('exam-mode-cb')?.checked || false;
    const emins      = parseInt(document.getElementById('exam-duration')?.value) || 10;
    setExamMode(em);
    setExamMins(emins);
    window.__appShowPanel?.('quiz-section');
    generateQuiz(files, { count, difficulty });
  }, [uploadedFiles, generateQuiz]);

  // ── Flashcards ─────────────────────────────────────────────────────────────
  const handleFlashcards = useCallback(() => {
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (!files.length) { alert('Sélectionnez au moins un fichier.'); return; }
    const count = parseInt(document.getElementById('fc-count')?.value) || 10;
    window.__appShowPanel?.('flashcard-section');
    generateFlashcards(files, { count });
  }, [uploadedFiles, generateFlashcards]);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const handleOpenChat = useCallback(() => {
    const files = window.__getSelectedFiles?.() || uploadedFiles;
    if (!files.length) { alert('Chargez d\'abord des fichiers.'); return; }
    setChatFiles(files);
    window.__appShowPanel?.('chat-section');
  }, [uploadedFiles]);

  const handleChatAttachFile = useCallback(async (file) => {
    try {
      const result = await uploadAttachment(file);
      setAttachedFile(result);
    } catch (err) { alert('Erreur : ' + err.message); }
  }, [uploadAttachment, setAttachedFile]);

  const handleChatAttachImage = useCallback(async (file) => {
    try {
      const result = await readImageAsBase64(file);
      setAttachedImage(result);
    } catch (err) { alert('Erreur : ' + err.message); }
  }, [readImageAsBase64, setAttachedImage]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    window.__reactApp  = true;
    window.__reactUser = user;

    (async () => {
      for (const s of CDN_SCRIPTS) await loadScript(s);

      if (window.startApp) {
        window.startApp();
        return;
      }

      const appScript = document.getElementById('script-app-logic');
      if (appScript) { window.startApp?.(); return; }

      const s = document.createElement('script');
      s.id   = 'script-app-logic';
      s.src  = '/app.js';
      s.onload = () => window.startApp?.();
      document.body.appendChild(s);
    })();
  }, [user]);

  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onResetOnboarding={() => setShowOnboarding(true)}
      />
      <header>
        <button className="back-home-btn hidden" id="back-home-btn" title="Tableau de bord">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="header-logo" id="header-logo">
          <Logo />
        </div>
        <div className="header-right">
<button className="settings-btn" id="settings-btn" title="Paramètres" onClick={() => setShowSettings(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </header>

      <main>

        {/* DASHBOARD */}
        <div className="panel dashboard-panel" id="dashboard-panel">
          <div className="dash-greeting">
            <h1 className="dash-greeting-title" id="dash-greeting-title">Bonjour</h1>
            <p className="dash-greeting-sub">Que souhaitez-vous réviser aujourd&apos;hui ?</p>
          </div>
          <div className="dash-quick-actions">
            <button className="dash-qaction dq-purple" id="dash-upload-btn">
              <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
              <span className="dash-qaction-label">Charger un cours</span>
              <span className="dash-qaction-hint">PDF, PPT, DOCX</span>
            </button>
            <button className="dash-qaction dq-blue" id="dash-continue-btn">
              <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
              <span className="dash-qaction-label">Continuer</span>
              <span className="dash-qaction-hint">Reprendre la session</span>
            </button>
            <button className="dash-qaction dq-gold" id="dash-folders-btn">
              <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
              <span className="dash-qaction-label">Mes matières</span>
              <span className="dash-qaction-hint">Cours classés</span>
            </button>
          </div>
          <div className="dash-stats-row">
            <div className="panel-header" style={{marginBottom:'.5rem'}}>
              <div className="panel-label">Progression</div>
              <button className="ghost-btn" id="dashboard-refresh-btn">Actualiser</button>
            </div>
            <div className="dashboard-grid" id="dashboard-grid"></div>
          </div>
          <ForYouSection onActivity={() => setActivityKey(k => k + 1)} />
          <div className="dash-bottom-links">
            <button className="dash-link" id="dash-history-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              Mes cours récents
            </button>
            <button className="dash-link" id="dash-stats-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7" rx="1"/><rect x="12" y="7" width="3" height="11" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></svg>
              Statistiques
            </button>
          </div>
          <ActivitySection refreshKey={activityKey} />
        </div>

        {/* STATISTIQUES */}
        <div className="panel hidden" id="stats-panel">
          <StatsPanel />
        </div>

        {/* HISTORIQUE */}
        <div className="panel hidden" id="history-panel">
          <HistoryPanel />
        </div>

        {/* MES MATIÈRES */}
        <div className="panel hidden" id="folders-panel">
          <FoldersPanel />
        </div>

        {/* UPLOAD — composant React */}
        <div className="panel hidden" id="upload-section">
          <UploadZone onUploaded={handleUploaded} />
        </div>

        {/* ACTIONS */}
        <div className="panel hidden" id="actions-section">
          <h2 className="panel-title">Choisir une <em>action</em></h2>
          <div className="quota-bar hidden" id="quota-bar"></div>
          <div className="no-files-notice hidden" id="no-files-notice">
            <span className="no-files-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="9" y1="13" x2="15" y2="13"/></svg></span>
            <div>
              <strong>Aucun fichier en mémoire</strong>
              <p>Les fichiers de la session précédente ne sont plus disponibles. Rechargez votre cours pour utiliser ces actions.</p>
            </div>
            <button className="act-btn gold" id="no-files-upload-btn">Charger un fichier</button>
          </div>
          <div className="file-select-area">
            <div className="fsa-header">
              <span>Fichiers chargés</span>
              <label className="sel-all"><input type="checkbox" id="select-all" /> Tout sélectionner</label>
            </div>
            <div id="uploaded-files"></div>
          </div>
          <div className="action-trio">
            <div className="act-card" data-color="purple">
              <div className="act-card-icon purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Résumer</strong>
                <span>Résumé structuré en 5 sections</span>
              </div>
              <button className="act-btn purple" id="summarize-btn" onClick={handleSummarize}>
                {summaryResults.length > 0 ? 'Voir le résumé' : 'Lancer'}
              </button>
              {summaryResults.length > 0 && (
                <button className="regen-link" id="summarize-regen-btn" onClick={handleSummaryRegen}>↺ Régénérer</button>
              )}
            </div>
            <div className="act-card" data-color="blue">
              <div className="act-card-icon blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Quiz QCM</strong>
                <label>
                  <input type="number" id="quiz-count" defaultValue="5" min="1" max="20" /> questions ·{' '}
                  <select id="quiz-difficulty">
                    <option value="moyen">Moyen</option>
                    <option value="facile">Facile</option>
                    <option value="difficile">Difficile</option>
                  </select>
                </label>
                <label className="exam-toggle-label">
                  <input type="checkbox" id="exam-mode-cb" /> ⏱ Mode examen{' '}
                  <select id="exam-duration" className="hidden">
                    <option value="5">5 min</option>
                    <option value="10">10 min</option>
                    <option value="15">15 min</option>
                    <option value="20">20 min</option>
                    <option value="30">30 min</option>
                  </select>
                </label>
              </div>
              <button className="act-btn blue" id="quiz-btn" onClick={handleQuiz}>
                {quizLoading ? 'Génération…' : questions.length > 0 ? 'Voir le quiz' : 'Lancer'}
              </button>
            </div>
            <div className="act-card" data-color="teal">
              <div className="act-card-icon teal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Flashcards</strong>
                <label><input type="number" id="fc-count" defaultValue="10" min="3" max="30" /> cartes</label>
              </div>
              <button className="act-btn teal" id="flashcard-btn" onClick={handleFlashcards}>
                {fcLoading ? 'Génération…' : decks.length > 0 ? 'Voir les cartes' : 'Lancer'}
              </button>
            </div>
            <div className="act-card act-card-wide" data-color="gold">
              <div className="act-card-icon gold">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="11" r=".6" fill="currentColor"/><circle cx="12" cy="11" r=".6" fill="currentColor"/><circle cx="15" cy="11" r=".6" fill="currentColor"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Chat avec le cours</strong>
                <span>Posez n&apos;importe quelle question sur vos fichiers chargés</span>
              </div>
              <button className="act-btn gold" id="chat-open-btn" onClick={handleOpenChat}>Ouvrir</button>
            </div>
            <div className="act-card act-card-wide" data-color="purple">
              <div className="act-card-icon purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Fiche d&apos;examen</strong>
                <span>Définitions, pièges, tableaux et questions probables</span>
              </div>
              <button className="act-btn purple" id="exam-sheet-btn" onClick={handleExamSheet}>
                {examLoading ? 'Génération…' : examMd ? 'Voir la fiche' : 'Créer'}
              </button>
              {examMd && (
                <button className="regen-link" id="exam-sheet-regen-btn" onClick={handleExamRegen}>↺ Régénérer</button>
              )}
            </div>
            <div className="act-card act-card-wide" data-color="teal">
              <div className="act-card-icon teal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="13" x2="5" y2="17"/><line x1="12" y1="13" x2="19" y2="17"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Carte mentale</strong>
                <span>Visualise le cours sous forme d&apos;arbre interactif</span>
              </div>
              <button className="act-btn teal" id="mindmap-action-btn">Créer</button>
            </div>
          </div>
        </div>

        {/* RÉSUMÉS — composant React */}
        <div className="panel hidden" id="summary-section">
          {summarizing && (
            <div className="loader-inline">
              <div className="spinner" style={{width:20,height:20}}></div>
              <span>Génération en cours…</span>
            </div>
          )}
          <SummaryResults
            results={summaryResults}
            streaming={summaryStreaming}
            onCopyAll={() => {
              const all = summaryResults.map(r => `## ${r.name}\n\n${r.summary}`).join('\n\n---\n\n');
              navigator.clipboard.writeText(all);
            }}
            onRegen={handleSummaryRegen}
          />
          {/* TTS bar : toujours dans le DOM pour app.js (sera migrée plus tard) */}
          <div className="tts-bar hidden" id="tts-bar">
            <span className="tts-bar-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></span>
            <select id="tts-voice-select" className="tts-select"></select>
            <div className="tts-speed-wrap">
              <span className="tts-speed-lbl">Vitesse</span>
              <input type="range" id="tts-speed" min="0.5" max="2" step="0.1" defaultValue="0.9" className="tts-slider" />
              <span id="tts-speed-val">0.9×</span>
            </div>
          </div>
        </div>

        {/* FICHE D'EXAMEN — composant React */}
        <div className="panel hidden" id="exam-sheet-section">
          {examLoading && (
            <div className="loader-inline">
              <div className="spinner" style={{width:20,height:20}}></div>
              <span>Création de la fiche…</span>
            </div>
          )}
          <ExamSheetSection
            md={examMd}
            streaming={examStreaming}
            fileName={uploadedFiles[0]?.name?.replace(/\.[^.]+$/, '') || 'fiche'}
            onRegen={examMd ? handleExamRegen : undefined}
          />
        </div>

        {/* QUIZ — composant React */}
        <div className="panel hidden" id="quiz-section">
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
              <div className="spinner" style={{width:20,height:20}}></div>
              <span>Génération du quiz…</span>
            </div>
          )}
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
          />
        </div>

        {/* FLASHCARDS — composant React */}
        <div className="panel hidden" id="flashcard-section">
          <div className="panel-header">
            <div>
              <div className="panel-label">Mémorisation</div>
              <h2 className="panel-title">Flash<em>cards</em></h2>
            </div>
          </div>
          {fcLoading && (
            <div className="loader-inline">
              <div className="spinner" style={{width:20,height:20}}></div>
              <span>Génération des flashcards…</span>
            </div>
          )}
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
        </div>

        {/* CHAT — composant React */}
        <div className="panel hidden" id="chat-section">
          {chatLoading && (
            <div className="loader-inline" style={{position:'absolute',top:'1rem',right:'1rem'}}>
              <div className="spinner" style={{width:14,height:14}}></div>
            </div>
          )}
          <ChatSection
            files={chatFiles}
            messages={chatMessages}
            loading={chatLoading}
            attachedFile={attachedFile}
            attachedImage={attachedImage}
            onSend={sendChat}
            onClear={resetChat}
            onAttachFile={handleChatAttachFile}
            onRemoveFile={() => setAttachedFile(null)}
            onAttachImage={handleChatAttachImage}
            onRemoveImage={() => setAttachedImage(null)}
          />
        </div>

      </main>

      {/* Float Nav */}
      <nav className="float-nav hidden" id="float-nav">
        <button className="fnav-btn fnav-home" data-target="dashboard-panel">
          <span className="fnav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
          <span className="fnav-label">Accueil</span>
        </button>
        <button className="fnav-btn fnav-actions" data-target="actions-section">
          <span className="fnav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg></span>
          <span className="fnav-label">Actions</span>
        </button>
        <div className="fnav-divider"></div>
        <button className="fnav-btn fnav-generated" data-target="summary-section">
          <span className="fnav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
          <span className="fnav-label">Résumés</span>
        </button>
        <button className="fnav-btn fnav-generated" data-target="quiz-section">
          <span className="fnav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg></span>
          <span className="fnav-label">Quiz</span>
        </button>
        <button className="fnav-btn fnav-generated" data-target="flashcard-section">
          <span className="fnav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg></span>
          <span className="fnav-label">Flashcards</span>
        </button>
        <button className="fnav-btn fnav-generated" data-target="chat-section">
          <span className="fnav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
          <span className="fnav-label">Chat</span>
        </button>
        <button className="fnav-btn fnav-generated" data-target="exam-sheet-section">
          <span className="fnav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
          <span className="fnav-label">Fiche</span>
        </button>
      </nav>


      {/* Mindmap Modal */}
      <div className="mindmap-overlay hidden" id="mindmap-overlay">
        <div className="mindmap-modal">
          <div className="mindmap-header">
            <span className="mindmap-course-name" id="mindmap-course-name">Carte mentale</span>
            <div className="mindmap-header-actions">
              <button className="ghost-btn" id="mindmap-fit-btn">Centrer</button>
              <button className="mindmap-close-btn" id="mindmap-close">✕</button>
            </div>
          </div>
          <svg id="mindmap-svg"></svg>
        </div>
      </div>

      {/* Loader */}
      <div className="loader hidden" id="loader">
        <div className="loader-box">
          <div className="spinner"></div>
          <p id="loader-text">Traitement en cours…</p>
          <span className="loader-hint">Cela peut prendre quelques secondes</span>
        </div>
      </div>

      {/* Save to Folder Modal */}
      <div className="modal-overlay hidden" id="save-folder-modal">
        <div className="modal-box modal-sm">
          <div className="modal-header">
            <h2>Enregistrer dans une <em>matière</em></h2>
            <p>Classez ces fichiers pour les retrouver facilement</p>
          </div>
          <div id="save-folder-list"></div>
          <div className="save-folder-new">
            <input type="text" id="save-folder-new-name" placeholder="Nouvelle matière..." className="input-field" />
            <button className="ghost-btn" id="save-folder-new-btn">Créer</button>
          </div>
          <div className="modal-footer">
            <button className="ghost-btn" id="save-folder-skip">Passer</button>
          </div>
        </div>
      </div>

      {/* Onboarding Modal */}
      <div className="modal-overlay hidden" id="onboarding-modal">
        <div className="modal-box">
          <div className="modal-header">
            <h2>Bienvenue sur <Logo size={20} /> 👋</h2>
            <p>Voici comment tirer le meilleur parti de la plateforme</p>
          </div>
          <div className="onboarding-steps">
            <div className="ob-step">
              <div className="ob-icon purple"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
              <div><strong>1. Chargez vos cours</strong><br /><span>PDF, PowerPoint ou Word — jusqu&apos;à 20 Mo</span></div>
            </div>
            <div className="ob-step">
              <div className="ob-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
              <div><strong>2. Choisissez une action</strong><br /><span>Résumé, Quiz, Flashcards ou Chat avec le cours</span></div>
            </div>
            <div className="ob-step">
              <div className="ob-icon teal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7.5S12 20 12 22c0-2-1-2.5-3-4.5S5 12 5 9a7 7 0 0 1 7-7z"/></svg></div>
              <div><strong>3. Révisez intelligemment</strong><br /><span>Les flashcards utilisent la révision espacée (SM-2)</span></div>
            </div>
            <div className="ob-step">
              <div className="ob-icon gold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="4" width="3" height="13" rx="1"/></svg></div>
              <div><strong>4. Suivez votre progression</strong><br /><span>Consultez vos stats depuis le bouton en haut à gauche</span></div>
            </div>
          </div>
          <button className="act-btn blue full" id="onboarding-close">C&apos;est parti !</button>
        </div>
      </div>
    </>
  );
}

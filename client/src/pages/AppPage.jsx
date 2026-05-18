import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import Logo from '../components/Logo.jsx';

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
      <header>
        <button className="back-home-btn hidden" id="back-home-btn" title="Tableau de bord">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="header-logo" id="header-logo">
          <Logo />
        </div>
        <div className="header-right">
          <button className="stats-toggle" id="stats-toggle" title="Statistiques">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="4" width="3" height="13" rx="1"/></svg>
          </button>
          <button className="settings-btn" id="settings-btn" title="Paramètres">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button className="theme-toggle" id="theme-toggle" title="Changer de thème">🌙</button>
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
            <button className="dash-qaction dq-teal" id="dash-library-btn">
              <span className="dash-qaction-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
              <span className="dash-qaction-label">Bibliothèque</span>
              <span className="dash-qaction-hint">Cours partagés</span>
            </button>
          </div>
          <div className="dash-stats-row">
            <div className="panel-header" style={{marginBottom:'.5rem'}}>
              <div className="panel-label">Progression</div>
              <button className="ghost-btn" id="dashboard-refresh-btn">Actualiser</button>
            </div>
            <div className="dashboard-grid" id="dashboard-grid"></div>
          </div>
          <div className="dash-bottom-links">
            <button className="dash-link" id="dash-history-btn">Mes cours récents →</button>
            <button className="dash-link" id="dash-stats-btn">Statistiques détaillées →</button>
          </div>
        </div>

        {/* STATISTIQUES */}
        <div className="panel hidden" id="stats-panel">
          <div className="panel-header">
            <div>
              <div className="panel-label">Progression</div>
              <h2 className="panel-title">Mes <em>statistiques</em></h2>
            </div>
            <button className="ghost-btn" id="stats-reset-btn">Réinitialiser quiz</button>
          </div>
          <div id="stats-content"></div>
        </div>

        {/* HISTORIQUE */}
        <div className="panel hidden" id="history-panel">
          <div className="panel-header">
            <div>
              <div className="panel-label">Sessions récentes</div>
              <h2 className="panel-title">Mes <em>cours</em></h2>
            </div>
            <button className="ghost-btn" id="history-clear-all">Tout effacer</button>
          </div>
          <div id="history-list"></div>
        </div>

        {/* MES MATIÈRES */}
        <div className="panel hidden" id="folders-panel">
          <div className="panel-header">
            <div>
              <div className="panel-label">Organisation</div>
              <h2 className="panel-title">Mes <em>matières</em></h2>
            </div>
            <button className="ghost-btn" id="folder-create-btn">+ Nouvelle matière</button>
          </div>
          <p className="panel-desc">Classez vos cours par matière pour les retrouver et les réutiliser facilement</p>
          <div id="folders-list"></div>
          <div className="hidden" id="folder-detail">
            <div className="folder-detail-header">
              <button className="ghost-btn" id="folder-back-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Retour
              </button>
              <h3 className="folder-detail-title" id="folder-detail-title"></h3>
              <div className="folder-detail-actions">
                <button className="ghost-btn" id="folder-rename-btn" title="Renommer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                <button className="ghost-btn" id="folder-delete-btn" title="Supprimer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
              </div>
            </div>
            <div id="folder-files-list"></div>
            <div className="folder-actions-bar hidden" id="folder-actions-bar">
              <button className="act-btn purple" id="folder-use-btn">Utiliser ces cours →</button>
            </div>
          </div>
        </div>

        {/* BIBLIOTHÈQUE */}
        <div className="panel hidden" id="library-panel">
          <div className="panel-header">
            <div>
              <div className="panel-label">Bibliothèque</div>
              <h2 className="panel-title">Cours <em>disponibles</em></h2>
            </div>
            <span className="mono-tag" id="lib-count"></span>
          </div>
          <p className="panel-desc">Cochez les cours à utiliser — ils sont immédiatement disponibles pour les résumés, quiz et flashcards</p>
          <div className="library-search-row">
            <input className="library-search" id="library-search" type="search" placeholder="Rechercher un cours, une matière, une section..." />
            <button className="ghost-btn" id="library-clear-search">Effacer</button>
          </div>
          <div id="library-subjects"></div>
          <div className="lib-selection-bar hidden" id="lib-selection-bar">
            <span id="lib-selection-label">0 cours sélectionné</span>
            <button className="act-btn gold" id="lib-go-btn">Utiliser ↓</button>
          </div>
        </div>

        {/* UPLOAD */}
        <div className="panel hidden" id="upload-section">
          <h2 className="panel-title">Charger vos <em>fichiers</em></h2>
          <p className="panel-desc">Importez vos cours en PDF, PPT, PPTX ou DOCX — jusqu&apos;à <span id="upload-size-hint">20 Mo</span> par fichier</p>
          <div className="drop-zone" id="drop-zone">
            <div className="drop-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
            <p className="drop-main">Glissez vos fichiers ici</p>
            <p className="drop-or">ou</p>
            <label className="dz-btn" htmlFor="file-input">Parcourir</label>
            <input type="file" id="file-input" multiple accept=".pdf,.ppt,.pptx,.docx" hidden />
            <p className="drop-hint">PDF · PPT · PPTX · DOCX</p>
          </div>
          <div id="file-list"></div>
          <button className="act-btn gold full" id="upload-btn" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Charger les fichiers
          </button>
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
              <button className="act-btn purple" id="summarize-btn">Lancer</button>
              <button className="regen-link hidden" id="summarize-regen-btn">↺ Régénérer</button>
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
              <button className="act-btn blue" id="quiz-btn">Lancer</button>
            </div>
            <div className="act-card" data-color="teal">
              <div className="act-card-icon teal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Flashcards</strong>
                <label><input type="number" id="fc-count" defaultValue="10" min="3" max="30" /> cartes</label>
              </div>
              <button className="act-btn teal" id="flashcard-btn">Lancer</button>
            </div>
            <div className="act-card act-card-wide" data-color="gold">
              <div className="act-card-icon gold">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="11" r=".6" fill="currentColor"/><circle cx="12" cy="11" r=".6" fill="currentColor"/><circle cx="15" cy="11" r=".6" fill="currentColor"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Chat avec le cours</strong>
                <span>Posez n&apos;importe quelle question sur vos fichiers chargés</span>
              </div>
              <button className="act-btn gold" id="chat-open-btn">Ouvrir</button>
            </div>
            <div className="act-card act-card-wide" data-color="purple">
              <div className="act-card-icon purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <div className="act-card-body">
                <strong>Fiche d&apos;examen</strong>
                <span>Définitions, pièges, tableaux et questions probables</span>
              </div>
              <button className="act-btn purple" id="exam-sheet-btn">Créer</button>
              <button className="regen-link hidden" id="exam-sheet-regen-btn">↺ Régénérer</button>
            </div>
          </div>
        </div>

        {/* RÉSUMÉS */}
        <div className="panel hidden" id="summary-section">
          <div className="panel-header">
            <div>
              <div className="panel-label">Résultats</div>
              <h2 className="panel-title">Résumés <em>générés</em></h2>
            </div>
            <button className="ghost-btn" id="copy-all-btn">Copier tout</button>
          </div>
          <div className="tts-bar hidden" id="tts-bar">
            <span className="tts-bar-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></span>
            <select id="tts-voice-select" className="tts-select"></select>
            <div className="tts-speed-wrap">
              <span className="tts-speed-lbl">Vitesse</span>
              <input type="range" id="tts-speed" min="0.5" max="2" step="0.1" defaultValue="0.9" className="tts-slider" />
              <span id="tts-speed-val">0.9×</span>
            </div>
          </div>
          <div className="summary-tabs hidden" id="summary-tabs"></div>
          <div id="summary-results"></div>
        </div>

        {/* FICHE D'EXAMEN */}
        <div className="panel hidden" id="exam-sheet-section">
          <div className="panel-header">
            <div>
              <div className="panel-label">Révision ciblée</div>
              <h2 className="panel-title">Fiche <em>d&apos;examen</em></h2>
            </div>
            <button className="ghost-btn" id="exam-sheet-copy-btn">Copier</button>
          </div>
          <div id="exam-sheet-result"></div>
        </div>

        {/* QUIZ */}
        <div className="panel hidden" id="quiz-section">
          <div className="panel-header">
            <div>
              <div className="panel-label">Évaluation</div>
              <h2 className="panel-title">Quiz <em>QCM</em></h2>
            </div>
            <span className="mono-tag" id="quiz-progress-info"></span>
          </div>
          <div className="quiz-step-header hidden" id="quiz-step-header">
            <div className="exam-timer hidden" id="exam-timer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span id="timer-display">00:00</span>
            </div>
            <div className="quiz-step-track"><div className="quiz-step-fill" id="quiz-step-fill"></div></div>
            <div className="quiz-step-nav">
              <button className="quiz-nav-btn" id="quiz-prev-btn" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                Précédent
              </button>
              <span className="quiz-step-label" id="quiz-step-label">1 / 5</span>
              <button className="quiz-nav-btn" id="quiz-next-btn">
                Suivant
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
          <div id="quiz-container"></div>
          <div className="quiz-footer hidden" id="quiz-footer">
            <button className="act-btn blue large" id="submit-quiz">Valider mes réponses</button>
          </div>
          <div id="quiz-score" className="hidden"></div>
        </div>

        {/* FLASHCARDS */}
        <div className="panel hidden" id="flashcard-section">
          <div className="panel-header">
            <div>
              <div className="panel-label">Mémorisation</div>
              <h2 className="panel-title">Flash<em>cards</em></h2>
            </div>
            <span className="mono-tag" id="fc-progress-info"></span>
          </div>
          <div id="fc-viewer">
            <div className="fc-topbar">
              <div className="fc-stats" id="fc-stats">
                <div className="fc-stat green"><span id="fc-known-count">0</span><small>Acquises</small></div>
                <div className="fc-stat red"><span id="fc-review-count">0</span><small>À revoir</small></div>
                <div className="fc-stat grey"><span id="fc-remaining-count">0</span><small>Non évaluées</small></div>
              </div>
              <div className="fc-top-actions">
                <button className="ghost-btn srs-mode-btn" id="srs-mode-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7.5S12 20 12 22c0-2-1-2.5-3-4.5S5 12 5 9a7 7 0 0 1 7-7z"/></svg> Révision espacée
                </button>
                <button className="ghost-btn" id="fc-shuffle">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg> Mélanger
                </button>
                <button className="ghost-btn" id="fc-restart">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Réinitialiser
                </button>
              </div>
            </div>
            <div className="fc-srs-bar hidden" id="fc-srs-bar">
              <span id="srs-due-label" className="srs-due-label"></span>
              <span className="srs-hint">Cartes dues pour révision aujourd&apos;hui</span>
            </div>
            <div className="fc-progress-bar"><div id="fc-bar"></div></div>
            <div id="fc-file-tabs"></div>
            <div id="fc-grid"></div>
          </div>
          <div className="fc-done hidden" id="fc-done">
            <div className="fc-done-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
            <h3>Session terminée !</h3>
            <div id="fc-done-stats"></div>
            <div className="fc-done-btns">
              <button className="act-btn purple" id="fc-redo-wrong">Revoir les cartes ratées</button>
              <button className="act-btn teal" id="fc-redo-all">Tout réinitialiser</button>
            </div>
          </div>
        </div>

        {/* CHAT */}
        <div className="panel hidden" id="chat-section">
          <div className="panel-header">
            <div>
              <div className="panel-label">Assistant IA</div>
              <h2 className="panel-title">Chat avec le <em>cours</em></h2>
            </div>
            <button className="ghost-btn" id="chat-clear-btn">Effacer</button>
          </div>
          <div className="chat-file-select" id="chat-file-select"></div>
          <div className="chat-messages" id="chat-messages">
            <div className="chat-welcome" id="chat-welcome">
              <div className="chat-welcome-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
              <p>Posez une question ou joignez un devoir / QCM à corriger.</p>
              <div className="chat-suggestions">
                <button className="chat-sug">Quels sont les points clés ?</button>
                <button className="chat-sug">Donne un exemple concret</button>
                <button className="chat-sug">Explique le concept principal</button>
                <button className="chat-sug">Quelles sont les définitions importantes ?</button>
              </div>
            </div>
          </div>
          <div className="chat-attach-bar hidden" id="chat-attach-bar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span id="chat-attach-name"></span>
            <button className="chat-attach-remove" id="chat-attach-remove" title="Retirer">✕</button>
          </div>
          <div className="chat-image-bar hidden" id="chat-image-bar">
            <img id="chat-image-thumb" className="chat-image-thumb" alt="" />
            <span id="chat-image-name"></span>
            <button className="chat-attach-remove" id="chat-image-remove" title="Retirer">✕</button>
          </div>
          <div className="chat-input-row">
            <input type="file" id="chat-file-input" accept=".pdf,.ppt,.pptx,.docx" style={{display:'none'}} />
            <input type="file" id="chat-image-input" accept="image/jpeg,image/png,image/webp,image/gif" style={{display:'none'}} />
            <button className="chat-attach-btn" id="chat-attach-btn" title="Joindre un devoir / document">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <button className="chat-attach-btn" id="chat-image-btn" title="Joindre une image">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>
            <input className="chat-input" id="chat-input" placeholder="Posez une question, joignez un devoir ou une image…" />
            <button className="act-btn gold" id="chat-send-btn">↑</button>
          </div>
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

      {/* Settings Drawer */}
      <div className="drawer-overlay hidden" id="settings-overlay"></div>
      <aside className="settings-drawer hidden" id="settings-drawer">
        <div className="drawer-header">
          <h2>Paramètres</h2>
          <button className="drawer-close" id="settings-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="drawer-body">
          <section className="settings-section">
            <h3 className="settings-section-title">Mon compte</h3>
            <div className="settings-account-card" id="settings-account-card">
              <div className="sac-avatar" id="sac-avatar">?</div>
              <div className="sac-info">
                <strong id="sac-name">—</strong>
                <span id="sac-email">—</span>
                <span className="sac-plan" id="sac-plan"></span>
              </div>
              <a href="/profile" className="sac-edit-btn">Modifier</a>
            </div>
          </section>
          <section className="settings-section">
            <h3 className="settings-section-title">Apparence</h3>
            <div className="settings-row">
              <div className="settings-row-label"><span>Thème</span><small>Clair ou sombre</small></div>
              <div className="theme-switch" id="theme-switch">
                <button className="ts-btn" data-theme="light">☀️ Clair</button>
                <button className="ts-btn" data-theme="dark">🌙 Sombre</button>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-label"><span>Réduire les animations</span><small>Désactive les transitions</small></div>
              <label className="toggle-switch">
                <input type="checkbox" id="pref-reduce-motion" />
                <span className="toggle-track"></span>
              </label>
            </div>
          </section>
          <section className="settings-section">
            <h3 className="settings-section-title">Préférences IA</h3>
            <div className="settings-row">
              <div className="settings-row-label"><span>Langue des réponses</span><small>Langue utilisée par l&apos;IA</small></div>
              <select className="settings-select" id="pref-lang">
                <option value="fr">🇫🇷 Français</option>
                <option value="en">🇬🇧 English</option>
                <option value="ar">🇸🇦 العربية</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-row-label"><span>Questions quiz par défaut</span><small>Nombre pré-rempli au lancement</small></div>
              <input type="number" className="settings-number" id="pref-quiz-count" min="3" max="20" defaultValue="5" />
            </div>
            <div className="settings-row">
              <div className="settings-row-label"><span>Difficulté par défaut</span><small>Niveau pré-sélectionné</small></div>
              <select className="settings-select" id="pref-quiz-difficulty">
                <option value="facile">Facile</option>
                <option value="moyen">Moyen</option>
                <option value="difficile">Difficile</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-row-label"><span>Flashcards par défaut</span><small>Nombre de cartes générées</small></div>
              <input type="number" className="settings-number" id="pref-fc-count" min="5" max="40" defaultValue="10" />
            </div>
          </section>
          <section className="settings-section">
            <h3 className="settings-section-title">Notifications</h3>
            <div className="settings-row">
              <div className="settings-row-label"><span>Rappels de révision</span><small>Notification quand des flashcards sont dues</small></div>
              <label className="toggle-switch">
                <input type="checkbox" id="pref-push-notif" />
                <span className="toggle-track"></span>
              </label>
            </div>
          </section>
          <section className="settings-section">
            <h3 className="settings-section-title">Données &amp; vie privée</h3>
            <div className="settings-danger-row">
              <div className="settings-row-label"><span>Historique des sessions</span><small>Sessions sauvegardées localement</small></div>
              <button className="settings-danger-btn" id="clear-history-btn">Effacer</button>
            </div>
            <div className="settings-danger-row">
              <div className="settings-row-label"><span>Statistiques quiz</span><small>Scores et progression</small></div>
              <button className="settings-danger-btn" id="clear-stats-btn">Réinitialiser</button>
            </div>
            <div className="settings-danger-row">
              <div className="settings-row-label"><span>Tutoriel d&apos;accueil</span><small>Réafficher le guide de démarrage</small></div>
              <button className="settings-neutral-btn" id="reset-onboarding-btn">Réafficher</button>
            </div>
          </section>
          <section className="settings-section settings-section-last">
            <h3 className="settings-section-title">À propos</h3>
            <div className="settings-about">
              <span className="about-logo"><Logo /></span>
              <span className="about-version">v1.0 · Plateforme IA pédagogique</span>
              <a href="/" className="about-link">Page d&apos;accueil ↗</a>
            </div>
          </section>
        </div>
      </aside>

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

      {/* Create/Rename Folder Modal */}
      <div className="modal-overlay hidden" id="folder-modal">
        <div className="modal-box modal-sm">
          <div className="modal-header">
            <h2 id="folder-modal-title">Nouvelle <em>matière</em></h2>
          </div>
          <div className="folder-modal-body">
            <label className="folder-modal-label">Nom</label>
            <input type="text" id="folder-modal-name" placeholder="Ex : Biochimie S3" className="input-field" autoComplete="off" />
            <label className="folder-modal-label" id="folder-modal-icon-label">Icône</label>
            <div className="folder-icon-grid" id="folder-icon-grid"></div>
          </div>
          <div className="folder-modal-actions">
            <button className="ghost-btn" id="folder-modal-cancel">Annuler</button>
            <button className="act-btn purple" id="folder-modal-confirm">Créer</button>
          </div>
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

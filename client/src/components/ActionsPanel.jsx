import { useState, useEffect, useRef } from 'react';
import QuotaBar from './QuotaBar.jsx';
import toast from '../utils/toast';
// Coûts par action — identiques pour tous les plans (miroir de services/jetons.js)
const COSTS = {
  summarize:    3,
  quiz:         4,
  flashcards:   3,
  chat:         1,
  'exam-sheet': 3,
  glossary:     2,
  mindmap:      2,
  session:      10, // résumé + quiz + flashcards
};

/**
 * Hexagone SVG — forme d'un jeton physique / crédit chip.
 * Symbolise "ce que coûte l'action" (unité consommée).
 */
function TokenHexSvg() {
  return (
    <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"
      width="11" height="11" style={{ display: 'block', flexShrink: 0 }}>
      {/* Hexagone (pointy-top) */}
      <path
        d="M7 1.4 L11.6 4 V10 L7 12.6 L2.4 10 V4 Z"
        fill="currentColor" fillOpacity="0.2"
        stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"
      />
      {/* Point central — marque du jeton */}
      <circle cx="7" cy="7" r="1.4" fill="currentColor" />
    </svg>
  );
}

function JetonBadge({ action, color = 'purple' }) {
  const cost = COSTS[action] ?? 1;
  return (
    <span className={`jeton-badge jeton-badge-${color}`}>
      <TokenHexSvg />
      {cost} jeton{cost > 1 ? 's' : ''}
    </span>
  );
}

const PREFS_KEY = 'jangalai-prefs';
function getPrefs() { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }

export default function ActionsPanel({
  hasFiles,
  uploadedFiles = [],
  onGoUpload,
  summaryResults,
  examMd,
  questions,
  decks,
  quizLoading,
  examLoading,
  fcLoading,
  glossaryTerms,
  glossaryLoading,
  onSummarize,
  onSummaryRegen,
  onExamSheet,
  onExamRegen,
  onQuiz,
  onFlashcards,
  onOpenChat,
  onGlossary,
  onPrepareSession,
  prepLoading,
  sessionGoal,
}) {
  // ── Sélection de fichiers (React-owned) ───────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(null);

  // Refs stables pour le bridge (évite une re-registration à chaque rendu)
  const uploadedFilesRef = useRef(uploadedFiles);
  const selectedIdsRef   = useRef(selectedIds);

  // Quand les fichiers changent (nouvel upload ou restore), tout sélectionner
  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // Bridge pour les hooks AI (résumé, quiz…) qui ont besoin des fichiers sélectionnés
  useEffect(() => {
    window.__getSelectedFiles = () => {
      const files = uploadedFilesRef.current;
      const ids   = selectedIdsRef.current;
      if (ids === null || ids.size === files.length) return files;
      if (!ids.size) return [];
      return files.filter(f => ids.has(f.id));
    };
    return () => { delete window.__getSelectedFiles; };
  }, []);

  async function handleMindmap() {
    const files = window.__getSelectedFiles?.() || uploadedFilesRef.current;
    if (!files.length) { toast.warn('Sélectionnez au moins un fichier.'); return; }

    const loader     = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    if (loaderText) loaderText.textContent = 'Génération du mindmap…';
    loader?.classList.remove('hidden');

    try {
      // Un mindmap par fichier — on prend le premier fichier sélectionné
      const file = files[0];
      const res  = await fetch('/api/mindmap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erreur serveur');
      window.__openMindmap?.(file.name, data.markdown);
    } catch (err) { toast.error(err.message); }
    finally { loader?.classList.add('hidden'); }
  }

  const [examModeOn,    setExamModeOn]    = useState(false);
  const [quizCount,     setQuizCount]     = useState(() => getPrefs().quizCount     || 5);
  const [quizDifficulty,setQuizDifficulty]= useState(() => getPrefs().quizDifficulty|| 'moyen');
  const [fcCount,       setFcCount]       = useState(() => getPrefs().fcCount       || 10);
  const [showMore,      setShowMore]      = useState(false);

  // Bridge : SettingsDrawer appelle window.__applyPrefs() après un changement de prefs
  useEffect(() => {
    window.__applyPrefs = () => {
      const p = getPrefs();
      if (p.quizCount)      setQuizCount(p.quizCount);
      if (p.quizDifficulty) setQuizDifficulty(p.quizDifficulty);
      if (p.fcCount)        setFcCount(p.fcCount);
      if (p.reduceMotion)   document.documentElement.classList.add('reduce-motion');
      else                  document.documentElement.classList.remove('reduce-motion');
    };
    return () => { delete window.__applyPrefs; };
  }, []);

  const allSelected = uploadedFiles.length > 0 && (
    selectedIds === null || selectedIds.size === uploadedFiles.length
  );

  function toggleOne(id, checked) {
    setSelectedIds(prev => {
      const next = new Set(prev ?? uploadedFiles.map(f => f.id));
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  return (
    <>
      <h2 className="panel-title">Choisir une <em>action</em></h2>

      <QuotaBar />

      {/* Avertissement si aucun fichier en mémoire */}
      <div className={`no-files-notice${hasFiles ? ' hidden' : ''}`} id="no-files-notice">
        <span className="no-files-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
          </svg>
        </span>
        <div>
          <strong>Aucun fichier en mémoire</strong>
          <p>Les fichiers de la session précédente ne sont plus disponibles. Rechargez votre cours pour utiliser ces actions.</p>
        </div>
        <button className="act-btn gold" id="no-files-upload-btn" onClick={onGoUpload}>
          Charger un fichier
        </button>
      </div>

      {/* Liste des fichiers chargés — React-owned */}
      <div className={`file-select-area${!hasFiles ? ' hidden' : ''}`}>
        <div className="fsa-header">
          <span>Fichiers chargés</span>
          <label className="sel-all">
            <input
              type="checkbox"
              id="select-all"
              checked={allSelected}
              onChange={e => setSelectedIds(
                e.target.checked ? null : new Set()
              )}
            />
            Tout sélectionner
          </label>
        </div>
        <div>
          {uploadedFiles.map(f => (
            <div key={f.id} className="file-checkbox">
              <input
                type="checkbox"
                value={f.id}
                checked={selectedIds === null || selectedIds.has(f.id)}
                onChange={e => toggleOne(f.id, e.target.checked)}
              />
              <span className="file-ext">{f.name.split('.').pop().toUpperCase()}</span>
              <span className="file-item-name">{f.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cartes d'action */}
      <div className="action-trio">

        {/* ── Actions principales (toujours visibles) ─────────────────── */}
        <div className="act-card act-card-wide act-card-prepare" data-color="blue">
          <div className="act-card-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div className="act-card-body">
            <strong>Préparer ma session</strong>
            <span>
              Résumé + quiz + flashcards en une fois
              {sessionGoal && <> · <span className="prep-goal-tag">{
                sessionGoal === 'exam' ? 'Examen demain' :
                sessionGoal === 'understand' ? 'Comprendre' :
                sessionGoal === 'memorize' ? 'Mémoriser' : "S'entraîner"
              }</span></>}
            </span>
            <JetonBadge action="session" color="blue" />
          </div>
          <button className="act-btn blue large" disabled={!hasFiles || prepLoading} onClick={onPrepareSession}>
            {prepLoading ? 'En cours…' : 'Lancer'}
          </button>
        </div>

        <div className="act-card" data-color="blue">
          <div className="act-card-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/>
            </svg>
          </div>
          <div className="act-card-body">
            <strong>Quiz QCM</strong>
            <label>
              <input type="number" id="quiz-count" value={quizCount} min="1" max="20"
                onChange={e => setQuizCount(parseInt(e.target.value) || 5)} /> questions ·{' '}
              <select id="quiz-difficulty" value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)}>
                <option value="moyen">Moyen</option>
                <option value="facile">Facile</option>
                <option value="difficile">Difficile</option>
              </select>
            </label>
            <label className="exam-toggle-label">
              <input type="checkbox" id="exam-mode-cb" onChange={e => setExamModeOn(e.target.checked)} /> ⏱ Mode examen{' '}
              <select id="exam-duration" className={examModeOn ? '' : 'hidden'}>
                <option value="5">5 min</option><option value="10">10 min</option>
                <option value="15">15 min</option><option value="20">20 min</option>
                <option value="30">30 min</option>
              </select>
            </label>
            <JetonBadge action="quiz" color="blue" />
          </div>
          <button className="act-btn blue" id="quiz-btn" disabled={!hasFiles} onClick={onQuiz}>
            {quizLoading ? 'Génération…' : questions.length > 0 ? 'Voir le quiz' : 'Lancer'}
          </button>
        </div>

        <div className="act-card" data-color="teal">
          <div className="act-card-icon teal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/>
            </svg>
          </div>
          <div className="act-card-body">
            <strong>Flashcards</strong>
            <label><input type="number" id="fc-count" value={fcCount} min="3" max="30"
              onChange={e => setFcCount(parseInt(e.target.value) || 10)} /> cartes</label>
            <JetonBadge action="flashcards" color="teal" />
          </div>
          <button className="act-btn teal" id="flashcard-btn" disabled={!hasFiles} onClick={onFlashcards}>
            {fcLoading ? 'Génération…' : decks.length > 0 ? 'Voir les cartes' : 'Lancer'}
          </button>
        </div>

        {/* ── Actions secondaires (repliées par défaut) ────────────────── */}
        {showMore && <>
          <div className="act-card" data-color="purple">
            <div className="act-card-icon purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Résumer</strong>
              <span>Résumé structuré en 5 sections</span>
              <JetonBadge action="summarize" color="purple" />
            </div>
            <button className="act-btn purple" id="summarize-btn" disabled={!hasFiles} onClick={onSummarize}>
              {summaryResults.length > 0 ? 'Voir le résumé' : 'Lancer'}
            </button>
            {summaryResults.length > 0 && (
              <button className="regen-link" id="summarize-regen-btn" onClick={onSummaryRegen}>↺ Régénérer</button>
            )}
          </div>

          <div className="act-card act-card-wide" data-color="gold">
            <div className="act-card-icon gold">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <circle cx="9" cy="11" r=".6" fill="currentColor"/><circle cx="12" cy="11" r=".6" fill="currentColor"/><circle cx="15" cy="11" r=".6" fill="currentColor"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Chat avec le cours</strong>
              <span>Posez n&apos;importe quelle question sur vos fichiers chargés</span>
              <JetonBadge action="chat" color="gold" />
            </div>
            <button className="act-btn gold" id="chat-open-btn" disabled={!hasFiles} onClick={onOpenChat}>Ouvrir</button>
          </div>

          <div className="act-card act-card-wide" data-color="purple">
            <div className="act-card-icon purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Fiche d&apos;examen</strong>
              <span>Définitions, pièges, tableaux et questions probables</span>
              <JetonBadge action="exam-sheet" color="purple" />
            </div>
            <button className="act-btn purple" id="exam-sheet-btn" disabled={!hasFiles} onClick={onExamSheet}>
              {examLoading ? 'Génération…' : examMd ? 'Voir la fiche' : 'Créer'}
            </button>
            {examMd && <button className="regen-link" id="exam-sheet-regen-btn" onClick={onExamRegen}>↺ Régénérer</button>}
          </div>

          <div className="act-card act-card-wide" data-color="teal">
            <div className="act-card-icon teal">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                <line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="13" x2="5" y2="17"/><line x1="12" y1="13" x2="19" y2="17"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Carte mentale</strong>
              <span>Visualise le cours sous forme d&apos;arbre interactif</span>
              <JetonBadge action="mindmap" color="teal" />
            </div>
            <button className="act-btn teal" id="mindmap-action-btn" disabled={!hasFiles} onClick={handleMindmap}>Créer</button>
          </div>

          <div className="act-card act-card-wide" data-color="gold">
            <div className="act-card-icon gold">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Glossaire automatique</strong>
              <span>Extrait les termes clés et leur définition</span>
              <JetonBadge action="glossary" color="gold" />
            </div>
            <button className="act-btn gold" disabled={!hasFiles} onClick={onGlossary}>
              {glossaryLoading ? 'Extraction…' : glossaryTerms?.length > 0 ? 'Voir le glossaire' : 'Lancer'}
            </button>
          </div>
        </>}

        {/* Bouton + / − */}
        <div className="act-more-row">
          <button className="act-more-btn" onClick={() => setShowMore(m => !m)}>
            {showMore ? '− Moins d\'options' : '+ Plus d\'options'}
          </button>
        </div>

      </div>
    </>
  );
}

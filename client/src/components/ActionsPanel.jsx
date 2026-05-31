import { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import toast from '../utils/toast';
import eventBus from '../utils/eventBus';
// Coûts par défaut (fallback si les coûts dynamiques ne sont pas encore chargés)
const DEFAULT_COSTS = {
  summarize: 3, quiz: 2, flashcards: 2, chat: 1,
  'exam-sheet': 3, glossary: 2, mindmap: 2, session: 7,
  socratic: 1, predict: 2, 'study-plan': 1, 'error-analysis': 1,
};

/**
 * Hexagone SVG — forme d'un jeton physique / crédit chip.
 */
function TokenHexSvg() {
  return (
    <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"
      width="11" height="11" style={{ display: 'block', flexShrink: 0 }}>
      <path
        d="M7 1.4 L11.6 4 V10 L7 12.6 L2.4 10 V4 Z"
        fill="currentColor" fillOpacity="0.2"
        stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" />
    </svg>
  );
}

function jetonColor(cost) {
  if (cost <= 1) return 'teal';
  if (cost <= 3) return 'gold';
  if (cost <= 6) return 'purple';
  return 'rose';
}

function JetonBadge({ action, costs }) {
  const cost  = (costs ?? DEFAULT_COSTS)[action] ?? DEFAULT_COSTS[action] ?? 1;
  const color = jetonColor(cost);
  return (
    <span className={`jeton-badge jeton-badge-${color}`}>
      <TokenHexSvg />
      {cost} jeton{cost > 1 ? 's' : ''}
    </span>
  );
}

export default function ActionsPanel({
  user,
  jetonCosts,
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
  onSocratic,
  onPredict,
  onStudyPlan,
  onJMoins1,
  onErrorAnalysis,
  predictLoading,
  predictResults,
  // ── Sélection de fichiers (levé dans AppPage) ─────────────────────────────
  selectedFileIds,         // Set | null (null = tous sélectionnés)
  onSelectionChange,       // (Set | null) => void
  // ── Paramètres quiz / flashcards (levés dans AppPage) ─────────────────────
  quizCount,
  onQuizCountChange,
  quizDifficulty,
  onQuizDiffChange,
  fcCount,
  onFcCountChange,
  examMode,
  onExamModeChange,
  examMins,
  onExamMinsChange,
  // ── Loader mindmap (piloté par React state dans AppPage) ──────────────────
  onMindmapLoading,         // (loading: boolean) => void
}) {
  const [showMore,  setShowMore]  = useState(false);
  const isPro = user?.plan === 'pro' || user?.plan === 'max';

  // ── Sélection de fichiers ─────────────────────────────────────────────────
  const allSelected = uploadedFiles.length > 0 && (
    selectedFileIds === null || selectedFileIds.size === uploadedFiles.length
  );

  function toggleAll(checked) {
    onSelectionChange?.(checked ? null : new Set());
  }

  function toggleOne(id, checked) {
    const current = selectedFileIds === null
      ? new Set(uploadedFiles.map(f => f.id))
      : new Set(selectedFileIds);
    if (checked) current.add(id); else current.delete(id);
    onSelectionChange?.(current);
  }

  // ── Mindmap (inline, sans bridge window) ─────────────────────────────────
  async function handleMindmap() {
    const files = !selectedFileIds || selectedFileIds.size === uploadedFiles.length
      ? uploadedFiles
      : uploadedFiles.filter(f => selectedFileIds?.has(f.id));

    if (!files.length) { toast.warn('Sélectionnez au moins un fichier.'); return; }

    onMindmapLoading?.(true);

    try {
      const file = files[0];
      const res  = await apiFetch('/api/mindmap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erreur serveur');
      eventBus.emit('mindmap:open', { name: file.name, markdown: data.markdown });
    } catch (err) { toast.error(err.message); }
    finally { onMindmapLoading?.(false); }
  }

  return (
    <>
      <h2 className="panel-title">Choisir une <em>action</em></h2>

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

      {/* Liste des fichiers chargés */}
      <div className={`file-select-area${!hasFiles ? ' hidden' : ''}`}>
        <div className="fsa-header">
          <span>Fichiers chargés</span>
          <label className="sel-all">
            <input
              type="checkbox"
              id="select-all"
              checked={allSelected}
              onChange={e => toggleAll(e.target.checked)}
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
                checked={selectedFileIds === null || selectedFileIds.has(f.id)}
                onChange={e => toggleOne(f.id, e.target.checked)}
              />
              <span className="file-ext">{f.name.split('.').pop().toUpperCase()}</span>
              <span className="file-item-name">{f.name}</span>
              {f.truncated && (
                <span className="file-truncated-badge" title="Fichier très volumineux — seuls les 200 000 premiers caractères ont été traités">
                  ⚠ tronqué
                </span>
              )}
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
                sessionGoal === 'exam'       ? 'Examen demain' :
                sessionGoal === 'understand' ? 'Comprendre' :
                sessionGoal === 'memorize'   ? 'Mémoriser' : "S'entraîner"
              }</span></>}
            </span>
            <JetonBadge costs={jetonCosts} action="session" />
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
              <input
                type="number"
                id="quiz-count"
                value={quizCount}
                min="1" max="20"
                onChange={e => onQuizCountChange?.(parseInt(e.target.value) || 5)}
              /> questions ·{' '}
              <select
                id="quiz-difficulty"
                value={quizDifficulty}
                onChange={e => onQuizDiffChange?.(e.target.value)}
              >
                <option value="moyen">Moyen</option>
                <option value="facile">Facile</option>
                <option value="difficile">Difficile</option>
              </select>
            </label>
            <label className="exam-toggle-label">
              <input
                type="checkbox"
                id="exam-mode-cb"
                checked={examMode}
                onChange={e => onExamModeChange?.(e.target.checked)}
              /> ⏱ Mode examen{' '}
              <select
                id="exam-duration"
                className={examMode ? '' : 'hidden'}
                value={examMins}
                onChange={e => onExamMinsChange?.(parseInt(e.target.value) || 10)}
              >
                <option value="5">5 min</option>
                <option value="10">10 min</option>
                <option value="15">15 min</option>
                <option value="20">20 min</option>
                <option value="30">30 min</option>
              </select>
            </label>
            <JetonBadge costs={jetonCosts} action="quiz" />
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
            <label>
              <input
                type="number"
                id="fc-count"
                value={fcCount}
                min="3" max="30"
                onChange={e => onFcCountChange?.(parseInt(e.target.value) || 10)}
              /> cartes
            </label>
            <JetonBadge costs={jetonCosts} action="flashcards" />
          </div>
          <button className="act-btn teal" id="flashcard-btn" disabled={!hasFiles} onClick={onFlashcards}>
            {fcLoading ? 'Génération…' : decks.length > 0 ? 'Voir les cartes' : 'Lancer'}
          </button>
        </div>

        {/* ── 4e carte : Résumer (toujours visible) ─────────────────────── */}
        <div className="act-card act-card-wide" data-color="purple">
          <div className="act-card-icon purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div className="act-card-body">
            <strong>Résumer</strong>
            <span>Résumé structuré en 5 sections</span>
            <JetonBadge costs={jetonCosts} action="summarize" />
          </div>
          <button className="act-btn purple" id="summarize-btn" disabled={!hasFiles} onClick={onSummarize}>
            {summaryResults.length > 0 ? 'Voir le résumé' : 'Lancer'}
          </button>
          {summaryResults.length > 0 && (
            <button className="regen-link" id="summarize-regen-btn" onClick={onSummaryRegen}>↺ Régénérer</button>
          )}
        </div>

        {/* ── Voir plus : Chat, Fiche, Carte mentale, Glossaire ─────────── */}
        {showMore && <>
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
              <JetonBadge costs={jetonCosts} action="chat" />
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
              <JetonBadge costs={jetonCosts} action="exam-sheet" />
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
              <JetonBadge costs={jetonCosts} action="mindmap" />
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
              <JetonBadge costs={jetonCosts} action="glossary" />
            </div>
            <button className="act-btn gold" disabled={!hasFiles} onClick={onGlossary}>
              {glossaryLoading ? 'Extraction…' : glossaryTerms?.length > 0 ? 'Voir le glossaire' : 'Lancer'}
            </button>
          </div>
        </>}

        {/* Bouton Voir plus / Voir moins */}
        <div className="act-more-row">
          <button className="act-more-btn" onClick={() => setShowMore(m => !m)}>
            {showMore ? '− Voir moins' : '+ Voir plus'}
          </button>
        </div>

      </div>

      {/* ════════════════ Outils avancés — section séparée ════════════════ */}
      <div className={`act-advanced-section${!isPro ? ' act-advanced-locked' : ''}`}>
        <div className="act-section-label">
          Outils avancés
          {!isPro && (
            <span className="act-pro-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 1L9 9H1l6.5 5-2.5 8L12 17l7 5-2.5-8L23 9h-8z"/></svg>
              Pro
            </span>
          )}
        </div>

        {/* Overlay de verrouillage */}
        {!isPro && (
          <div className="act-lock-overlay" onClick={() => eventBus.emit('plans:open')}>
            <div className="act-lock-box">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <p className="act-lock-title">Disponible à partir du plan Pro</p>
              <p className="act-lock-sub">Mode Socratique, Prédicteur, Plan de révision et Analyse d&apos;erreurs</p>
              <button className="act-btn gold" onClick={e => { e.stopPropagation(); eventBus.emit('plans:open'); }}>
                Voir les plans
              </button>
            </div>
          </div>
        )}

        <div className="action-trio">

          <div className="act-card act-card-wide" data-color="blue">
            <div className="act-card-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Mode Socratique</strong>
              <span>L&apos;IA vous interroge sur votre cours comme un examinateur</span>
              <JetonBadge costs={jetonCosts} action="socratic" />
            </div>
            <button className="act-btn blue" disabled={!hasFiles} onClick={onSocratic}>Démarrer</button>
          </div>

          <div className="act-card act-card-wide" data-color="purple">
            <div className="act-card-icon purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Questions probables</strong>
              <span>Prédit les questions susceptibles de tomber à l&apos;examen</span>
              <JetonBadge costs={jetonCosts} action="predict" />
            </div>
            <button className="act-btn purple" disabled={!hasFiles} onClick={onPredict}>
              {predictLoading ? 'Analyse…' : predictResults?.length > 0 ? 'Voir les prédictions' : 'Analyser'}
            </button>
          </div>

          <div className="act-card act-card-wide" data-color="gold">
            <div className="act-card-icon gold">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Plan de révision</strong>
              <span>Planning jour par jour jusqu&apos;à votre examen, basé sur vos points faibles</span>
              <JetonBadge costs={jetonCosts} action="study-plan" />
            </div>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button className="act-btn gold" onClick={onStudyPlan}>Planifier</button>
              {onJMoins1 && hasFiles && (
                <button className="act-btn rose" onClick={onJMoins1} title="Révision d'urgence — plan sur 1 jour">J-1</button>
              )}
            </div>
          </div>

          <div className="act-card act-card-wide" data-color="rose">
            <div className="act-card-icon rose">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3"/>
              </svg>
            </div>
            <div className="act-card-body">
              <strong>Erreurs récurrentes</strong>
              <span>Analyse vos confusions et lacunes à partir de l&apos;historique de quiz</span>
              <JetonBadge costs={jetonCosts} action="error-analysis" />
            </div>
            <button className="act-btn rose" onClick={onErrorAnalysis}>Analyser</button>
          </div>

        </div>
      </div>
    </>
  );
}

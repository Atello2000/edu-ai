import GenerationCard from './GenerationCard.jsx';

const TYPE_ICONS = {
  confusion: '🔄',
  lacune: '⚠️',
  malentendu: '💭',
  erreur_calcul: '🔢',
};

export default function ErrorAnalysisSection({ patterns, message, loading, error, wrongCount, onAnalyze, onCreateFlashcards }) {
  return (
    <div className="error-analysis-section">
      <div className="panel-header">
        <div>
          <div className="panel-label">Analyse d&apos;apprentissage</div>
          <h2 className="panel-title">Erreurs <em>récurrentes</em></h2>
        </div>
        <span className="mono-tag">{wrongCount} réponses analysées</span>
      </div>

      {error && <div className="error-notice">{error}</div>}

      {message && patterns?.length === 0 && (
        <div className="error-analysis-empty">
          <p>{message}</p>
        </div>
      )}

      {!patterns && !loading && (
        <div className="error-analysis-start">
          <p style={{color:'var(--muted)',fontSize:'.88rem',marginBottom:'1rem'}}>
            Jangalai analyse vos réponses incorrectes et identifie vos confusions et lacunes récurrentes.
          </p>
          <button
            className="act-btn purple large"
            disabled={wrongCount < 3}
            onClick={onAnalyze}
            title={wrongCount < 3 ? 'Faites au moins quelques quiz d\'abord' : ''}
          >
            {wrongCount < 3 ? `Pas assez de données (${wrongCount}/3 min)` : 'Analyser mes erreurs'}
          </button>
        </div>
      )}

      {loading && (
        <GenerationCard
          title="Analyse des erreurs récurrentes"
          subtitle="Recherche des confusions et lacunes dans votre historique..."
          phase="generating"
          steps={['Collecte', 'Analyse', 'Conseils']}
          activeStepIndex={1}
        />
      )}

      {patterns && patterns.length > 0 && (
        <>
          <div className="error-pattern-list">
            {patterns.map((p, i) => (
              <div key={i} className="error-pattern-card">
                <div className="error-pattern-header">
                  <span className="error-pattern-icon">{TYPE_ICONS[p.type] || '❓'}</span>
                  <strong className="error-pattern-title">{p.title}</strong>
                  {p.frequency > 1 && (
                    <span className="error-pattern-freq">×{p.frequency}</span>
                  )}
                </div>
                <p className="error-pattern-desc">{p.description}</p>
                <div className="error-pattern-advice">💡 {p.advice}</div>
                {p.flashcard_hint && (
                  <div className="error-pattern-fc">
                    <span>Flashcard suggérée :</span>
                    <code>{p.flashcard_hint}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
          {onCreateFlashcards && (
            <button className="act-btn teal" style={{marginTop:'1rem'}} onClick={() => onCreateFlashcards(patterns)}>
              Créer des flashcards sur ces erreurs
            </button>
          )}
        </>
      )}
    </div>
  );
}

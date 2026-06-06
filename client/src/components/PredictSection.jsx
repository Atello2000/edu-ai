import GenerationCard from './GenerationCard.jsx';

const PROB_COLORS = { haute: '#e53935', moyenne: '#f5a623', faible: '#9e9e9e' };
const PROB_LABELS = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', faible: '⚪ Faible' };

export default function PredictSection({ results, loading, progress, error, onQuizFromPredict }) {
  // Concepts haute/moyenne probabilité pour le quiz ciblé
  const hotConcepts = results.flatMap(r =>
    (r.predictions || [])
      .filter(p => p.probability !== 'faible' && p.concept)
      .map(p => p.concept)
  ).slice(0, 8);

  return (
    <div className="predict-section">
      <div className="panel-header">
        <div>
          <div className="panel-label">Analyse prédictive</div>
          <h2 className="panel-title">Questions <em>probables</em></h2>
        </div>
        {results.length > 0 && onQuizFromPredict && hotConcepts.length > 0 && (
          <button
            className="act-btn gold"
            onClick={() => onQuizFromPredict(hotConcepts)}
            title="Générer un quiz ciblé sur les concepts les plus probables"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg>
            Quiz ciblé
          </button>
        )}
      </div>

      {error && <div className="error-notice">{error}</div>}

      {loading && (
        <GenerationCard
          title="Prédiction des questions d'examen"
          subtitle={progress?.message || 'Analyse du cours en cours...'}
          phase={progress?.phase || 'preparing'}
          steps={['Préparation', 'Analyse', 'Prédictions']}
          activeStepIndex={
            progress?.phase === 'receiving' ? 2 :
            progress?.phase === 'generating' ? 1 : 0
          }
        />
      )}

      {results.map(({ name, predictions }) => (
        <div key={name} className="predict-file">
          <div className="predict-file-name">{name}</div>
          {predictions.map((p, i) => (
            <div key={i} className="predict-card">
              <div className="predict-card-header">
                <span className="predict-prob" style={{ color: PROB_COLORS[p.probability] || '#999' }}>
                  {PROB_LABELS[p.probability] || p.probability}
                </span>
                <span className="predict-type">{p.type}</span>
                {p.concept && <span className="predict-concept">{p.concept}</span>}
              </div>
              <p className="predict-question">{p.question}</p>
            </div>
          ))}
        </div>
      ))}

      {results.length === 0 && !loading && !error && (
        <p style={{color:'var(--muted)',textAlign:'center',padding:'2rem'}}>
          Sélectionnez un cours et lancez l&apos;analyse pour voir les questions probables.
        </p>
      )}
    </div>
  );
}

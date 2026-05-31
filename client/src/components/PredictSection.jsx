const PROB_COLORS = { haute: '#e53935', moyenne: '#f5a623', faible: '#9e9e9e' };
const PROB_LABELS = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', faible: '⚪ Faible' };

export default function PredictSection({ results, loading, error }) {
  return (
    <div className="predict-section">
      <div className="panel-header">
        <div>
          <div className="panel-label">Analyse prédictive</div>
          <h2 className="panel-title">Questions <em>probables</em></h2>
        </div>
      </div>

      {error && <div className="error-notice">{error}</div>}

      {loading && results.length === 0 && (
        <div className="loader-inline">
          <div className="spinner" style={{width:16,height:16}} />
          <span>Analyse du cours en cours…</span>
        </div>
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

export default function CompareSection({ md, streaming, loading, error, fileNames = [], onRegen }) {
  const content = streaming || md;

  function renderMd(text) {
    if (!text) return null;
    if (window.marked) return <div className="md-body" dangerouslySetInnerHTML={{ __html: window.marked.parse(text) }} />;
    return <pre style={{whiteSpace:'pre-wrap',fontSize:'.85rem'}}>{text}</pre>;
  }

  return (
    <div className="compare-section">
      <div className="panel-header">
        <div>
          <div className="panel-label">Confrontation de sources</div>
          <h2 className="panel-title">Analyse <em>comparative</em></h2>
        </div>
        {md && onRegen && (
          <button className="ghost-btn" onClick={onRegen}>↺ Régénérer</button>
        )}
      </div>

      {error && <div className="error-notice">{error}</div>}

      {fileNames.length > 0 && (
        <div className="compare-sources">
          {fileNames.map((n, i) => (
            <span key={i} className="compare-source-chip">{n}</span>
          ))}
        </div>
      )}

      {loading && !content && (
        <div className="loader-inline">
          <div className="spinner" style={{width:16,height:16}} />
          <span>Analyse comparative en cours…</span>
        </div>
      )}

      {content && renderMd(content)}

      {!content && !loading && !error && (
        <p style={{color:'var(--muted)',textAlign:'center',padding:'2rem'}}>
          Sélectionnez au moins 2 fichiers et lancez la comparaison.
        </p>
      )}
    </div>
  );
}

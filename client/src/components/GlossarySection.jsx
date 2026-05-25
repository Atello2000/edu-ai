import { useState, useMemo } from 'react';

function groupByLetter(terms) {
  const groups = {};
  for (const t of terms) {
    const letter = t.term[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(t);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'fr'));
}

export default function GlossarySection({ terms, loading, error, onRegen }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return terms;
    const q = search.trim().toLowerCase();
    return terms.filter(t =>
      t.term.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  }, [terms, search]);

  const groups = useMemo(() => groupByLetter(filtered), [filtered]);

  function handleCopyAll() {
    const txt = terms.map(t => `${t.term}\n${t.definition}`).join('\n\n');
    navigator.clipboard.writeText(txt);
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-label">Vocabulaire</div>
          <h2 className="panel-title">Glossaire <em>automatique</em></h2>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          {terms.length > 0 && (
            <button className="ghost-btn" onClick={handleCopyAll} title="Copier tout">Copier</button>
          )}
          {onRegen && (
            <button className="ghost-btn" onClick={onRegen}>↺ Régénérer</button>
          )}
        </div>
      </div>

      {loading && (
        <div className="loader-inline">
          <div className="spinner" style={{ width: 20, height: 20 }} />
          <span>Extraction du vocabulaire…</span>
        </div>
      )}

      {error && (
        <div className="error-banner">{error}</div>
      )}

      {!loading && terms.length > 0 && (
        <>
          <div className="glossary-meta">
            <span>{terms.length} terme{terms.length > 1 ? 's' : ''}</span>
            <input
              className="glossary-search"
              type="search"
              placeholder="Rechercher un terme…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="glossary-empty">Aucun résultat pour «&nbsp;{search}&nbsp;»</p>
          ) : (
            <div className="glossary-list">
              {groups.map(([letter, group]) => (
                <div key={letter} className="glossary-group">
                  <div className="glossary-letter">{letter}</div>
                  {group.map((t, i) => (
                    <div key={i} className="glossary-item">
                      <div className="glossary-item-header">
                        <span className="glossary-term">{t.term}</span>
                        {t.category && (
                          <span className="glossary-category">{t.category}</span>
                        )}
                      </div>
                      <p className="glossary-definition">{t.definition}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && terms.length === 0 && (
        <div className="glossary-placeholder">
          <p>Le glossaire extrait automatiquement les termes techniques et concepts clés de vos cours.</p>
        </div>
      )}
    </>
  );
}

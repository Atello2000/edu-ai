import { useState, useMemo } from 'react';
import GenerationCard from './GenerationCard.jsx';

const CONF_KEY = 'jangalai-glossary-conf';

function termKey(term) {
  return term.toLowerCase().trim().replace(/\s+/g, '_');
}
function loadConf() {
  try { return JSON.parse(localStorage.getItem(CONF_KEY) || '{}'); } catch { return {}; }
}
function saveConf(c) {
  try { localStorage.setItem(CONF_KEY, JSON.stringify(c)); } catch { /* best-effort */ }
}

const CONF_STATES = [
  { key: 'unknown',  label: '?',  title: 'À apprendre',   cls: 'conf-unknown'  },
  { key: 'learning', label: '~',  title: 'En cours',       cls: 'conf-learning' },
  { key: 'known',    label: '✓',  title: 'Maîtrisé',       cls: 'conf-known'    },
];

function ConfidenceBadge({ termStr, conf, onToggle }) {
  const state = CONF_STATES.find(s => s.key === (conf[termKey(termStr)] || 'unknown')) || CONF_STATES[0];
  return (
    <button
      type="button"
      className={`glossary-conf ${state.cls}`}
      title={state.title}
      onClick={() => onToggle(termStr)}
    >{state.label}</button>
  );
}

function groupByLetter(terms) {
  const groups = {};
  for (const t of terms) {
    const letter = t.term[0]?.toUpperCase() || '#';
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(t);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'fr'));
}

export default function GlossarySection({ terms = [], loading, progress, error, onRegen }) {
  const [search,   setSearch]   = useState('');
  const [conf,     setConf]     = useState(loadConf);
  const [filterK,  setFilterK]  = useState('all'); // 'all' | 'unknown' | 'learning' | 'known'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return terms.filter(t => {
      const matchSearch = !q ||
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q);
      const matchFilter = filterK === 'all' || (conf[termKey(t.term)] || 'unknown') === filterK;
      return matchSearch && matchFilter;
    });
  }, [terms, search, conf, filterK]);

  const groups = useMemo(() => groupByLetter(filtered), [filtered]);

  function toggleConf(termStr) {
    const key = termKey(termStr);
    const cur = conf[key] || 'unknown';
    const idx = CONF_STATES.findIndex(s => s.key === cur);
    const next = CONF_STATES[(idx + 1) % CONF_STATES.length].key;
    const updated = { ...conf, [key]: next };
    setConf(updated);
    saveConf(updated);
  }

  function handleCopyAll() {
    const txt = terms.map(t => `${t.term}\n${t.definition}`).join('\n\n');
    navigator.clipboard.writeText(txt);
  }

  const counts = useMemo(() => {
    const c = { unknown: 0, learning: 0, known: 0 };
    terms.forEach(t => { c[conf[termKey(t.term)] || 'unknown']++; });
    return c;
  }, [terms, conf]);

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
        <GenerationCard
          title="Extraction du vocabulaire"
          subtitle={progress || 'Extraction des termes en cours...'}
          phase={progress ? 'generating' : 'preparing'}
          steps={['Préparation', 'Extraction', 'Définitions']}
          activeStepIndex={progress ? 1 : 0}
        />
      )}

      {error && <div className="error-banner">{error}</div>}

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

          {/* Filtre par confiance */}
          <div className="glossary-conf-bar">
            {[
              { k: 'all',      label: `Tous (${terms.length})` },
              { k: 'unknown',  label: `? À apprendre (${counts.unknown})` },
              { k: 'learning', label: `~ En cours (${counts.learning})` },
              { k: 'known',    label: `✓ Maîtrisés (${counts.known})` },
            ].map(f => (
              <button
                key={f.k}
                className={`glossary-filter-btn${filterK === f.k ? ' active' : ''}`}
                onClick={() => setFilterK(f.k)}
              >{f.label}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="glossary-empty">Aucun résultat{search ? ` pour « ${search} »` : ''}</p>
          ) : (
            <div className="glossary-list">
              {groups.map(([letter, group]) => (
                <div key={letter} className="glossary-group">
                  <div className="glossary-letter">{letter}</div>
                  {group.map((t, i) => (
                    <div key={i} className="glossary-item">
                      <div className="glossary-item-header">
                        <ConfidenceBadge termStr={t.term} conf={conf} onToggle={toggleConf} />
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

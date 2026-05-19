import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './Onboarding.css';

const LEVELS = [
  { value: 'licence',       icon: '🎓', label: 'Licence',       sub: 'Bac+3' },
  { value: 'master',        icon: '🎓', label: 'Master',        sub: 'Bac+5' },
  { value: 'doctorat',      icon: '🔬', label: 'Doctorat',      sub: 'PhD' },
  { value: 'professionnel', icon: '💼', label: 'Professionnel', sub: 'En activité' },
  { value: 'autre',         icon: '📚', label: 'Autre',         sub: 'Précisez…' },
];

const DOMAINS = [
  { value: 'santé',        icon: '🏥', label: 'Santé & Médecine' },
  { value: 'informatique', icon: '💻', label: 'Informatique' },
  { value: 'droit',        icon: '⚖️', label: 'Droit' },
  { value: 'économie',     icon: '📊', label: 'Économie & Gestion' },
  { value: 'sciences',     icon: '🔬', label: 'Sciences' },
  { value: 'langues',      icon: '🌍', label: 'Langues & Lettres' },
  { value: 'ingénierie',   icon: '🏗️', label: 'Ingénierie' },
  { value: 'histoire',     icon: '📜', label: 'Histoire & SHS' },
  { value: 'autre',        icon: '➕', label: 'Autre' },
];

const SPECIALTY_SUGGESTIONS = {
  'santé':        ['Médecine générale', 'Chirurgie', 'Pharmacie', 'Soins infirmiers', 'Kinésithérapie', 'Odontologie', 'Médecine vétérinaire', 'Sage-femme'],
  'informatique': ['Développement web', 'Intelligence artificielle', 'Cybersécurité', 'Data Science', 'Réseaux & systèmes', 'Génie logiciel', 'Cloud & DevOps'],
  'droit':        ['Droit des affaires', 'Droit pénal', 'Droit international', 'Droit du travail', 'Droit civil', 'Droit public', 'Droit notarial'],
  'économie':     ['Finance de marché', 'Comptabilité & Audit', 'Marketing', 'Management', 'Commerce international', 'Ressources humaines', 'Contrôle de gestion'],
  'sciences':     ['Mathématiques', 'Physique', 'Chimie', 'Biologie', 'Sciences de la Terre', 'Biochimie', 'Statistiques'],
  'langues':      ['Anglais', 'Arabe', 'Espagnol', 'Traduction & Interprétation', 'Littérature', 'Linguistique', 'FLE'],
  'ingénierie':   ['Génie civil', 'Génie électrique', 'Génie mécanique', 'Génie industriel', 'Génie informatique', 'Architecture', 'Génie chimique'],
  'histoire':     ['Histoire contemporaine', 'Philosophie', 'Sociologie', 'Géographie', 'Sciences politiques', 'Anthropologie', 'Psychologie'],
};

function getSpecialtySuggestions(selectedDomains) {
  const seen = new Set();
  const result = [];
  for (const d of selectedDomains) {
    for (const s of (SPECIALTY_SUGGESTIONS[d] || [])) {
      if (!seen.has(s)) { seen.add(s); result.push(s); }
    }
  }
  return result.slice(0, 9);
}

export default function Onboarding({ onDone }) {
  const { setUser } = useAuth();
  const [step, setStep]                   = useState(1);
  const [level, setLevel]                 = useState('');
  const [levelCustom, setLevelCustom]     = useState('');
  const [domains, setDomains]             = useState([]);
  const [domainCustom, setDomainCustom]   = useState('');
  const [specialty, setSpecialty]         = useState('');
  const [specCustom, setSpecCustom]       = useState('');
  const [loading, setLoading]             = useState(false);

  function toggleDomain(d) {
    setDomains(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : prev.length < 4 ? [...prev, d] : prev
    );
  }

  function getFinalLevel() {
    if (level === 'autre') return levelCustom.trim() || 'autre';
    return level;
  }

  function getFinalDomains() {
    return domains.map(d => d === 'autre' ? (domainCustom.trim() || 'autre') : d);
  }

  function getFinalSpecialty() {
    if (specialty === '__autre__') return specCustom.trim() || '';
    return specialty;
  }

  const canProceedStep1 = level && (level !== 'autre' || levelCustom.trim());
  const canProceedStep2 = domains.length > 0 && (!domains.includes('autre') || domainCustom.trim());
  const canProceedStep3 = specialty && (specialty !== '__autre__' || specCustom.trim());

  const suggestions = getSpecialtySuggestions(
    domains.filter(d => d !== 'autre').length > 0
      ? domains.filter(d => d !== 'autre')
      : domains
  );

  async function submit(skip = false) {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/onboarding', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skip ? { level: null, domains: [], specialty: null } : {
          level:     getFinalLevel(),
          domains:   getFinalDomains(),
          specialty: getFinalSpecialty() || null,
        }),
      });
      const data = await r.json();
      if (data.user) setUser(data.user);
      onDone?.();
    } catch { onDone?.(); }
    finally { setLoading(false); }
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="ob-progress">
          <div className={`ob-dot ${step >= 1 ? 'active' : ''}`} />
          <div className={`ob-dot ${step >= 2 ? 'active' : ''}`} />
          <div className={`ob-dot ${step >= 3 ? 'active' : ''}`} />
        </div>

        {/* ── Step 1 : Niveau ── */}
        {step === 1 && (
          <>
            <div className="ob-header">
              <h2>Quel est votre <em>niveau</em> ?</h2>
              <p>Jangalai adaptera le contenu généré à votre profil.</p>
            </div>
            <div className="ob-grid">
              {LEVELS.map(l => (
                <div
                  key={l.value}
                  className={`ob-card ${level === l.value ? 'selected' : ''}`}
                  onClick={() => setLevel(l.value)}
                >
                  <div className="ob-icon">{l.icon}</div>
                  <div className="ob-label">{l.label}</div>
                  <div className="ob-sub">{l.sub}</div>
                </div>
              ))}
            </div>
            {level === 'autre' && (
              <input
                className="ob-custom-input"
                type="text"
                placeholder="Ex : BTS, Terminale, Formation pro…"
                value={levelCustom}
                onChange={e => setLevelCustom(e.target.value)}
                autoFocus
                maxLength={60}
              />
            )}
            <div className="ob-actions">
              <button className="ob-btn-skip" onClick={() => submit(true)}>Passer</button>
              <button className="ob-btn-primary" disabled={!canProceedStep1} onClick={() => setStep(2)}>
                Continuer →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2 : Domaines ── */}
        {step === 2 && (
          <>
            <div className="ob-header">
              <h2>Votre <em>domaine</em> ?</h2>
              <p>Choisissez jusqu'à 4 domaines — l'IA s'adaptera à votre spécialité.</p>
            </div>
            <div className="ob-grid ob-grid-3">
              {DOMAINS.map(d => (
                <div
                  key={d.value}
                  className={`ob-card ${domains.includes(d.value) ? 'selected' : ''}`}
                  onClick={() => toggleDomain(d.value)}
                >
                  <div className="ob-icon">{d.icon}</div>
                  <div className="ob-label">{d.label}</div>
                </div>
              ))}
            </div>
            {domains.includes('autre') && (
              <input
                className="ob-custom-input"
                type="text"
                placeholder="Ex : Architecture, Pharmacie, Marketing…"
                value={domainCustom}
                onChange={e => setDomainCustom(e.target.value)}
                autoFocus
                maxLength={60}
              />
            )}
            {domains.length > 0 && (
              <p className="ob-hint">{domains.length} domaine{domains.length > 1 ? 's' : ''} sélectionné{domains.length > 1 ? 's' : ''}</p>
            )}
            <div className="ob-actions">
              <button className="ob-btn-back" onClick={() => setStep(1)}>← Retour</button>
              <button className="ob-btn-primary" disabled={!canProceedStep2} onClick={() => setStep(3)}>
                Continuer →
              </button>
            </div>
          </>
        )}

        {/* ── Step 3 : Spécialité ── */}
        {step === 3 && (
          <>
            <div className="ob-header">
              <h2>Votre <em>spécialité</em> ?</h2>
              <p>Précisez votre filière pour que l'IA cible ses exemples et explications.</p>
            </div>

            <div className="ob-spec-chips">
              {suggestions.map(s => (
                <button
                  key={s}
                  className={`ob-spec-chip ${specialty === s ? 'selected' : ''}`}
                  onClick={() => { setSpecialty(s); setSpecCustom(''); }}
                >
                  {s}
                </button>
              ))}
              <button
                className={`ob-spec-chip ob-spec-other ${specialty === '__autre__' ? 'selected' : ''}`}
                onClick={() => setSpecialty('__autre__')}
              >
                ✏️ Autre…
              </button>
            </div>

            {specialty === '__autre__' && (
              <input
                className="ob-custom-input"
                type="text"
                placeholder="Ex : Neurochirurgie, Finance islamique, Cyberdroit…"
                value={specCustom}
                onChange={e => setSpecCustom(e.target.value)}
                autoFocus
                maxLength={80}
              />
            )}

            <div className="ob-actions">
              <button className="ob-btn-back" onClick={() => setStep(2)}>← Retour</button>
              <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
                <button className="ob-btn-skip" onClick={() => submit(false)}>
                  Passer
                </button>
                <button
                  className="ob-btn-primary"
                  disabled={!canProceedStep3 || loading}
                  onClick={() => submit(false)}
                >
                  {loading ? 'Enregistrement…' : 'Commencer →'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

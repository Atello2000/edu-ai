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

export default function Onboarding({ onDone }) {
  const { setUser } = useAuth();
  const [step, setStep]               = useState(1);
  const [level, setLevel]             = useState('');
  const [levelCustom, setLevelCustom] = useState('');
  const [domain, setDomain]           = useState('');
  const [domainCustom, setDomainCustom] = useState('');
  const [specialty, setSpecialty]     = useState('');
  const [specCustom, setSpecCustom]   = useState('');
  const [loading, setLoading]         = useState(false);

  function selectDomain(d) {
    if (domain === d) return;
    setDomain(d);
    setSpecialty('');
    setSpecCustom('');
  }

  function getFinalLevel() {
    return level === 'autre' ? (levelCustom.trim() || 'autre') : level;
  }

  function getFinalDomain() {
    return domain === 'autre' ? (domainCustom.trim() || 'autre') : domain;
  }

  function getFinalSpecialty() {
    if (!specialty) return null;
    return specialty === '__autre__' ? (specCustom.trim() || null) : specialty;
  }

  const canProceedStep1 = level && (level !== 'autre' || levelCustom.trim());
  const canProceedStep2 = domain && (domain !== 'autre' || domainCustom.trim());

  const suggestions = SPECIALTY_SUGGESTIONS[domain] || [];

  async function submit(skip = false) {
    setLoading(true);
    try {
      const finalDomain = getFinalDomain();
      const r = await fetch('/api/auth/onboarding', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skip ? { level: null, domains: [], specialty: null } : {
          level:     getFinalLevel(),
          domains:   finalDomain ? [finalDomain] : [],
          specialty: getFinalSpecialty(),
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

        {/* ── Step 2 : Domaine principal + Spécialité ── */}
        {step === 2 && (
          <>
            <div className="ob-header">
              <h2>Votre <em>domaine</em> principal ?</h2>
              <p>Choisissez celui qui correspond le mieux à vos études.</p>
            </div>

            <div className="ob-grid ob-grid-3">
              {DOMAINS.map(d => (
                <div
                  key={d.value}
                  className={`ob-card ${domain === d.value ? 'selected' : ''}`}
                  onClick={() => selectDomain(d.value)}
                >
                  <div className="ob-icon">{d.icon}</div>
                  <div className="ob-label">{d.label}</div>
                </div>
              ))}
            </div>

            {domain === 'autre' && (
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

            {/* Spécialité — apparaît si le domaine a des suggestions */}
            {suggestions.length > 0 && (
              <div className="ob-spec-section">
                <div className="ob-spec-label">
                  Spécialité <span className="ob-spec-optional">(optionnel)</span>
                </div>
                <div className="ob-spec-chips">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      className={`ob-spec-chip ${specialty === s ? 'selected' : ''}`}
                      onClick={() => { setSpecialty(specialty === s ? '' : s); setSpecCustom(''); }}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    className={`ob-spec-chip ob-spec-other ${specialty === '__autre__' ? 'selected' : ''}`}
                    onClick={() => setSpecialty(specialty === '__autre__' ? '' : '__autre__')}
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
              </div>
            )}

            <div className="ob-actions">
              <button className="ob-btn-back" onClick={() => setStep(1)}>← Retour</button>
              <button
                className="ob-btn-primary"
                disabled={!canProceedStep2 || loading}
                onClick={() => submit(false)}
              >
                {loading ? 'Enregistrement…' : 'Commencer →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

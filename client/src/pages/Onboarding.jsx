import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../utils/apiFetch';
import './Onboarding.css';

const LEVELS = [
  { value: 'licence',       icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>, label: 'Licence',       sub: 'Bac+3' },
  { value: 'master',        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>, label: 'Master',        sub: 'Bac+5' },
  { value: 'doctorat',      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>, label: 'Doctorat',      sub: 'PhD' },
  { value: 'professionnel', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12" strokeWidth="3"/><path d="M2 12h20"/></svg>, label: 'Professionnel', sub: 'En activité' },
  { value: 'autre',         icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, label: 'Autre',         sub: 'Précisez…' },
];

const DOMAINS = [
  { value: 'santé',        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, label: 'Santé & Médecine' },
  { value: 'informatique', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>, label: 'Informatique' },
  { value: 'droit',        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, label: 'Droit' },
  { value: 'économie',     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><polyline points="18 9 12 15 9 12 3 18"/></svg>, label: 'Économie & Gestion' },
  { value: 'sciences',     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><path d="M9 3v11l3-3 3 3V3"/><path d="M18 9h3a2 2 0 0 1 0 4h-3"/></svg>, label: 'Sciences' },
  { value: 'langues',      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, label: 'Langues & Lettres' },
  { value: 'ingénierie',   icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, label: 'Ingénierie' },
  { value: 'histoire',     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>, label: 'Histoire & SHS' },
  { value: 'autre',        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, label: 'Autre' },
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
  const { user, setUser } = useAuth();
  const modalRef = useRef(null);
  const [step, setStep]               = useState(1);
  const [name, setName]               = useState(user?.name || '');
  const [level, setLevel]             = useState('');
  const [levelCustom, setLevelCustom] = useState('');
  const [domain, setDomain]           = useState('');
  const [domainCustom, setDomainCustom] = useState('');
  const [specialty, setSpecialty]     = useState('');
  const [specCustom, setSpecCustom]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [showScrollCue, setShowScrollCue] = useState(false);

  function updateScrollCue() {
    const modal = modalRef.current;
    if (!modal) return;
    const remaining = modal.scrollHeight - modal.scrollTop - modal.clientHeight;
    setShowScrollCue(remaining > 18);
  }

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return undefined;

    const update = () => updateScrollCue();
    const frame = requestAnimationFrame(update);
    modal.addEventListener('scroll', update, { passive: true });

    let resizeObserver = null;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(modal);
    }

    return () => {
      cancelAnimationFrame(frame);
      modal.removeEventListener('scroll', update);
      resizeObserver?.disconnect();
    };
  }, [step, domain, specialty, level, levelCustom, domainCustom, specCustom]);

  function scrollModalDown() {
    modalRef.current?.scrollBy({ top: Math.round(window.innerHeight * 0.42), behavior: 'smooth' });
  }

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

  const canProceedStep2 = level && (level !== 'autre' || levelCustom.trim());
  const canProceedStep3 = domain && (domain !== 'autre' || domainCustom.trim());

  const suggestions = SPECIALTY_SUGGESTIONS[domain] || [];

  async function submit(skip = false) {
    setLoading(true);
    try {
      const finalDomain = getFinalDomain();
      const r = await apiFetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skip ? { level: null, domains: [], specialty: null, name: null } : {
          level:     getFinalLevel(),
          domains:   finalDomain ? [finalDomain] : [],
          specialty: getFinalSpecialty(),
          name:      name.trim() || null,
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
      <div className="onboarding-modal" ref={modalRef}>
        <div className="ob-progress">
          <div className={`ob-dot ${step >= 1 ? 'active' : ''}`} />
          <div className={`ob-dot ${step >= 2 ? 'active' : ''}`} />
          <div className={`ob-dot ${step >= 3 ? 'active' : ''}`} />
        </div>

        {/* ── Step 1 : Nom et Prénom ── */}
        {step === 1 && (
          <>
            <div className="ob-header">
              <h2>Comment devrions-nous vous <em>appeler</em> ?</h2>
              <p>Entrez votre prénom et nom pour personnaliser votre espace Jangalai.</p>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '.5rem', margin: '2rem 0' }}>
              <input
                className="ob-custom-input"
                type="text"
                placeholder="Ex : Aminata Diop"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                maxLength={60}
                style={{ width: '100%', margin: 0 }}
              />
            </div>
            <div className="ob-actions">
              <button className="ob-btn-skip" onClick={() => submit(true)}>Passer</button>
              <button className="ob-btn-primary" disabled={!name.trim()} onClick={() => setStep(2)}>
                Continuer <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>
          </>
        )}

        {/* ── Step 2 : Niveau ── */}
        {step === 2 && (
          <>
            <div className="ob-header">
              <h2>Quel est votre <em>niveau</em> d&apos;études ?</h2>
              <p>Jangalai adaptera le contenu généré à votre profil académique.</p>
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
              <button className="ob-btn-back" onClick={() => setStep(1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Retour
              </button>
              <button className="ob-btn-primary" disabled={!canProceedStep2} onClick={() => setStep(3)}>
                Continuer <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>
          </>
        )}

        {/* ── Step 3 : Domaine principal + Spécialité ── */}
        {step === 3 && (
          <>
            <div className="ob-header">
              <h2>Votre <em>domaine</em> d&apos;études ?</h2>
              <p>Choisissez celui qui correspond le mieux à votre filière.</p>
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
                    + Autre…
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
              <button className="ob-btn-back" onClick={() => setStep(2)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Retour
              </button>
              <button
                className="ob-btn-primary"
                disabled={!canProceedStep3 || loading}
                onClick={() => submit(false)}
              >
                {loading ? 'Enregistrement…' : <>Commencer <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>}
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          className={`ob-scroll-cue ${showScrollCue ? 'visible' : ''}`}
          onClick={scrollModalDown}
          aria-label="Faire défiler vers le bas"
        >
          <span>Plus bas</span>
          <span className="ob-scroll-cue-arrow" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

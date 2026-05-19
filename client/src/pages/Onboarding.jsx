import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './Onboarding.css';

const LEVELS = [
  { value: 'licence',       icon: '🎓', label: 'Licence',       sub: 'Bac+3' },
  { value: 'master',        icon: '🎓', label: 'Master',        sub: 'Bac+5' },
  { value: 'doctorat',      icon: '🔬', label: 'Doctorat',      sub: 'PhD' },
  { value: 'professionnel', icon: '💼', label: 'Professionnel', sub: 'En activité' },
  { value: 'autre',         icon: '📚', label: 'Autre',         sub: 'Autodidacte…' },
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

export default function Onboarding({ onDone }) {
  const { setUser } = useAuth();
  const [step, setStep]       = useState(1);
  const [level, setLevel]     = useState('');
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);

  function toggleDomain(d) {
    setDomains(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : prev.length < 4 ? [...prev, d] : prev
    );
  }

  async function submit(skip = false) {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/onboarding', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skip ? { level: null, domains: [] } : { level, domains }),
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
            <div className="ob-actions">
              <button className="ob-btn-skip" onClick={() => submit(true)}>Passer</button>
              <button className="ob-btn-primary" disabled={!level} onClick={() => setStep(2)}>
                Continuer →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ob-header">
              <h2>Votre <em>domaine</em> ?</h2>
              <p>Choisissez jusqu'à 4 domaines — l'IA s'adaptera à votre spécialité.</p>
            </div>
            <div className={`ob-grid ob-grid-3`}>
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
            {domains.length > 0 && (
              <p className="ob-hint">{domains.length} domaine{domains.length > 1 ? 's' : ''} sélectionné{domains.length > 1 ? 's' : ''}</p>
            )}
            <div className="ob-actions">
              <button className="ob-btn-back" onClick={() => setStep(1)}>← Retour</button>
              <button className="ob-btn-primary" disabled={domains.length === 0 || loading} onClick={() => submit(false)}>
                {loading ? 'Enregistrement…' : 'Commencer →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

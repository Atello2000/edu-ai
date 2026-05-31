import { useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import toast from '../utils/toast';

const PLANS = [
  {
    key:     'free',
    name:    'Gratuit',
    price:   '0',
    jetons:  40,
    accent:  '#1dd1a1',
    accentBg:'rgba(29,209,161,.1)',
    features:[
      'Résumés, quiz, flashcards',
      'Chat avec le cours',
      'Carte mentale & fiche exam',
      'Fichiers jusqu\'à 5 Mo · 10 sessions',
    ],
  },
  {
    key:     'pro',
    name:    'Pro',
    price:   '2 500',
    jetons:  150,
    accent:  '#f5a623',
    accentBg:'rgba(245,166,35,.1)',
    best:    true,
    features:[
      'Outils avancés déverrouillés',
      'Prédicteur & plan de révision',
      'Mode socratique & analyse erreurs',
      'Fichiers jusqu\'à 10 Mo · 30 sessions',
    ],
  },
  {
    key:     'max',
    name:    'Max',
    price:   '5 000',
    jetons:  400,
    accent:  '#a855f7',
    accentBg:'rgba(168,85,247,.1)',
    features:[
      'Tout le plan Pro inclus',
      '10× plus de jetons qu\'en gratuit',
      'Export PDF fiche d\'examen',
      'Fichiers jusqu\'à 20 Mo · sessions illimitées',
    ],
  },
];

const Check = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink:0, marginTop:2 }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function PlansModal({ currentPlan = 'free', onClose, onSelectPlan }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const displayedPlans = currentPlan && currentPlan !== 'free'
    ? PLANS.filter(plan => plan.key !== 'free')
    : PLANS;

  const handleInternalSelectPlan = async (planKey) => {
    console.log("PlansModal - handleInternalSelectPlan called for plan:", planKey);
    
    // If a custom handler was provided in props, use it
    if (onSelectPlan) {
      console.log("PlansModal - Custom onSelectPlan handler found, delegating...");
      onSelectPlan(planKey);
      return;
    }

    // Default self-contained checkout logic
    console.log("PlansModal - No custom handler, running self-contained checkout API call...");
    try {
      const res = await apiFetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey })
      });
      console.log("PlansModal - Response status:", res.status);
      const data = await res.json();
      console.log("PlansModal - Response data:", data);
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.redirectUrl) {
        console.log("PlansModal - Redirecting to PayTech:", data.redirectUrl);
        window.location.href = data.redirectUrl;
      } else {
        console.error("PlansModal - No redirectUrl in response!");
        toast.error("Impossible d'initier le paiement.");
      }
    } catch (err) {
      console.error("PlansModal - Checkout error:", err);
      toast.error('Erreur lors du lancement du paiement.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="plans-modal-wrap" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="plans-modal-top">
          <div>
            <h2 className="plans-modal-h2">Choisir un plan</h2>
            <p className="plans-modal-p">Prix en francs CFA · Paiement instantané sécurisé par Wave & Orange Money</p>
          </div>
          <button className="plans-close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Cartes ── */}
        <div className="plans-cards-row">
          {displayedPlans.map(plan => {
            const isCurrent = plan.key === (currentPlan || 'free');
            return (
              <div
                key={plan.key}
                className={`plan-tile${plan.best ? ' plan-tile-best' : ''}${isCurrent ? ' plan-tile-current' : ''}`}
                style={{ '--accent': plan.accent, '--accent-bg': plan.accentBg, display:'flex', flexDirection:'column', borderRadius:'12px', border: isCurrent ? '1.5px solid var(--accent)' : plan.best ? '2px solid var(--accent)' : '1.5px solid var(--border)', background:'var(--surface)', overflow:'hidden' }}
              >
                {/* Header coloré */}
                <div className="plan-tile-head">
                  <div className="plan-tile-name-row">
                     <span className="plan-tile-name">{plan.name}</span>
                    {isCurrent && <span className="plan-tile-pill" style={{ background: plan.accent }}>Actuel</span>}
                    {plan.best && !isCurrent && <span className="plan-tile-pill" style={{ background: plan.accent }}>Meilleure valeur</span>}
                  </div>
                  <div className="plan-tile-price-row">
                    <span className="plan-tile-price">{plan.price}</span>
                    <span className="plan-tile-currency">CFA<br/>/ mois</span>
                  </div>
                </div>

                {/* Body */}
                <div className="plan-tile-body">
                  {/* Jetons */}
                  <div className="plan-tile-jetons" style={{ color: plan.accent }}>
                    <svg viewBox="0 0 14 14" fill="none" width="13" height="13">
                      <path d="M7 1.4L11.6 4V10L7 12.6L2.4 10V4Z"
                        fill="currentColor" fillOpacity=".2"
                        stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                      <circle cx="7" cy="7" r="1.4" fill="currentColor"/>
                    </svg>
                    <strong>{plan.jetons}</strong> jetons / mois
                  </div>

                  {/* Séparateur */}
                  <div className="plan-tile-sep" style={{ background: plan.accent }}/>

                  {/* Features */}
                  <ul className="plan-tile-features">
                    {plan.features.map(f => (
                      <li key={f}>
                        <Check color={plan.accent} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    className="plan-tile-cta"
                    style={isCurrent && plan.key === 'free' ? {} : {
                      background: plan.accent, color: '#fff', borderColor: plan.accent,
                    }}
                    disabled={isCurrent && plan.key === 'free'}
                    onClick={() => {
                      handleInternalSelectPlan(plan.key);
                    }}
                  >
                    {isCurrent 
                      ? (plan.key === 'free' ? '✓ Plan actuel' : 'Renouveler le plan') 
                      : `S'abonner au plan ${plan.name}`
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import toast from '../utils/toast';

const PLANS = [
  {
    key:     'free',
    name:    'Gratuit',
    price:   '0',
    jetons:  40,
    jetonsLabel: 'jetons à l\'inscription',
    accent:  '#1dd1a1',
    accentBg:'rgba(29,209,161,.1)',
    features:[
      'Résumés, quiz, flashcards',
      'Chat avec le cours',
      'Carte mentale & fiche exam',
      'Fichiers jusqu\'à 5 Mo',
    ],
  },
  {
    key:     'pro',
    name:    'Pro',
    price:   '2 500',
    jetons:  150,
    jetonsLabel: 'jetons / mois',
    accent:  '#f5a623',
    accentBg:'rgba(245,166,35,.1)',
    best:    true,
    features:[
      'Prédicteur & plan de révision',
      'Mode socratique & analyse erreurs',
      'Résumés, quiz, flashcards, chat',
      'Fichiers jusqu\'à 10 Mo',
    ],
  },
  {
    key:     'max',
    name:    'Max',
    price:   '5 000',
    jetons:  400,
    jetonsLabel: 'jetons / mois',
    accent:  '#a855f7',
    accentBg:'rgba(168,85,247,.1)',
    features:[
      'Tout le plan Pro inclus',
      'Export PDF fiche d\'examen',
      'Fichiers jusqu\'à 20 Mo',
      'Sessions illimitées',
    ],
  },
];

// Carte recharge ponctuelle — ne change pas le plan, ajoute juste des jetons
const TOPUP = {
  key:     'topup',
  price:   '1 000',
  jetons:  50,
  accent:  '#3d7eff',
  accentBg:'rgba(61,126,255,.1)',
};

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
    if (onSelectPlan) {
      onSelectPlan(planKey);
      return;
    }

    try {
      const res = await apiFetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey })
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
      } else {
        toast.error("Impossible d'initier le paiement.");
      }
    } catch {
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

        {/* ── Cartes abonnements ── */}
        <div className="plans-cards-row">
          {displayedPlans.map(plan => {
            const isCurrent = plan.key === (currentPlan || 'free');
            return (
              <div
                key={plan.key}
                className={`plan-tile${plan.best ? ' plan-tile-best' : ''}${isCurrent ? ' plan-tile-current' : ''}`}
                style={{ '--accent': plan.accent, '--accent-bg': plan.accentBg, display:'flex', flexDirection:'column', borderRadius:'12px', border: isCurrent ? '1.5px solid var(--accent)' : plan.best ? '2px solid var(--accent)' : '1.5px solid var(--border)', background:'var(--surface)', overflow:'hidden' }}
              >
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
                <div className="plan-tile-body">
                  <div className="plan-tile-jetons" style={{ color: plan.accent }}>
                    <svg viewBox="0 0 14 14" fill="none" width="13" height="13">
                      <path d="M7 1.4L11.6 4V10L7 12.6L2.4 10V4Z" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                      <circle cx="7" cy="7" r="1.4" fill="currentColor"/>
                    </svg>
                    <strong>{plan.jetons}</strong> {plan.jetonsLabel}
                  </div>
                  <div className="plan-tile-sep" style={{ background: plan.accent }}/>
                  <ul className="plan-tile-features">
                    {plan.features.map(f => (
                      <li key={f}><Check color={plan.accent}/><span>{f}</span></li>
                    ))}
                  </ul>
                  <button
                    className="plan-tile-cta"
                    style={isCurrent && plan.key === 'free' ? {} : { background: plan.accent, color: '#fff', borderColor: plan.accent }}
                    disabled={isCurrent && plan.key === 'free'}
                    onClick={() => handleInternalSelectPlan(plan.key)}
                  >
                    {isCurrent
                      ? (plan.key === 'free' ? '✓ Plan actuel' : 'Renouveler le plan')
                      : `S'abonner au plan ${plan.name}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Recharge ponctuelle ── */}
        <div style={{
          marginTop: '20px',
          padding: '16px 20px',
          border: `1px solid ${TOPUP.accentBg.replace('.1)', '.25)')}`,
          borderRadius: '12px',
          background: TOPUP.accentBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <span style={{ fontSize:'22px' }}>⚡</span>
            <div>
              <div style={{ fontWeight:600, fontSize:'15px', color:'var(--text)' }}>
                Recharge ponctuelle
              </div>
              <div style={{ fontSize:'13px', color:'var(--muted)', marginTop:'2px' }}>
                +{TOPUP.jetons} jetons · sans changer ton plan · disponible à tout moment
              </div>
            </div>
          </div>
          <button
            onClick={() => handleInternalSelectPlan(TOPUP.key)}
            style={{
              background: TOPUP.accent, color: '#fff', border: 'none',
              borderRadius: '10px', padding: '10px 20px',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {TOPUP.price} CFA
          </button>
        </div>

      </div>
    </div>
  );
}

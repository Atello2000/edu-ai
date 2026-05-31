import { useEffect } from 'react';

const ACCENT = {
  teal:   'var(--teal)',
  gold:   'linear-gradient(90deg,#f5a623,#f06c1a)',
  purple: 'linear-gradient(90deg,var(--purple),#a855f7)',
};

const PLANS = [
  {
    key:      'free',
    name:     'Gratuit',
    price:    '0',
    period:   'CFA / mois',
    jetons:   40,
    color:    'teal',
    desc:     'Pour découvrir',
    features: [
      'Résumés, quiz, flashcards',
      'Chat avec le cours',
      'Carte mentale & fiche exam',
      'Formats PDF, PPT, DOCX',
    ],
    cta: 'Plan actuel',
  },
  {
    key:      'pro',
    name:     'Pro',
    price:    '2 500',
    period:   'CFA / mois',
    jetons:   150,
    color:    'gold',
    desc:     'Périodes d\'examen',
    features: [
      'Outils avancés déverrouillés',
      'Prédicteur & plan de révision',
      'Mode socratique & analyse erreurs',
      '3,75× plus de jetons',
    ],
    cta: 'Passer à Pro',
  },
  {
    key:      'max',
    name:     'Max',
    price:    '5 000',
    period:   'CFA / mois',
    jetons:   400,
    color:    'purple',
    desc:     'Réviser sans limites',
    features: [
      'Tout le plan Pro',
      '10× plus de jetons',
      'Export PDF fiche d\'examen',
      'Accès prioritaire aux nouvelles features',
    ],
    cta: 'Passer à Max',
  },
];

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const TokenIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" width="12" height="12" style={{ flexShrink: 0 }}>
    <path d="M7 1.4 L11.6 4 V10 L7 12.6 L2.4 10 V4 Z"
      fill="currentColor" fillOpacity=".2"
      stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    <circle cx="7" cy="7" r="1.4" fill="currentColor"/>
  </svg>
);

export default function PlansModal({ currentPlan = 'free', onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box plans-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="pm-header">
          <div>
            <h2 className="pm-title">Choisir un plan</h2>
            <p className="pm-sub">Prix en francs CFA · Rechargement mensuel automatique</p>
          </div>
          <button className="pomo-close" onClick={onClose} title="Fermer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Grille */}
        <div className="pm-grid">
          {PLANS.map(plan => {
            const isCurrent = plan.key === (currentPlan || 'free');
            const isBest    = plan.key === 'max';
            const soon      = plan.key !== 'free';

            return (
              <div
                key={plan.key}
                className={`pm-card pm-card-${plan.color}${isCurrent ? ' pm-card-current' : ''}${isBest ? ' pm-card-best' : ''}`}
              >
                {/* Bande couleur */}
                <div className="pm-card-band" style={{ background: ACCENT[plan.color] }} />

                {/* Corps */}
                <div className="pm-card-body">

                  {/* Nom + badge */}
                  <div className="pm-card-row">
                    <span className="pm-plan-name">{plan.name}</span>
                    {isCurrent && <span className="pm-badge pm-badge-current">Actuel</span>}
                    {isBest && !isCurrent && <span className="pm-badge pm-badge-best">⭐ Meilleure valeur</span>}
                  </div>

                  {/* Prix */}
                  <div className="pm-price-row">
                    <span className="pm-price">{plan.price}</span>
                    <span className="pm-period">{plan.period}</span>
                  </div>
                  <p className="pm-desc">{plan.desc}</p>

                  {/* Jetons */}
                  <div className={`pm-jetons pm-jetons-${plan.color}`}>
                    <TokenIcon />
                    <strong>{plan.jetons}</strong> jetons / mois
                  </div>

                  {/* Features */}
                  <ul className="pm-features">
                    {plan.features.map(f => (
                      <li key={f}>
                        <CheckIcon />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    className={`pm-cta act-btn ${plan.color}`}
                    disabled={isCurrent || soon}
                    title={soon && !isCurrent ? 'Paiement disponible bientôt' : ''}
                  >
                    {isCurrent ? '✓ Plan actuel' : soon ? 'Bientôt disponible' : plan.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="pm-footer">Les paiements seront disponibles très prochainement.</p>
      </div>
    </div>
  );
}

import { useEffect } from 'react';

const PLANS = [
  {
    key: 'free',
    name: 'Gratuit',
    price: '0 CFA',
    period: '/ mois',
    jetons: 40,
    color: 'teal',
    desc: 'Pour découvrir sans engagement',
    features: [
      'Résumés, quiz, flashcards',
      'Chat avec le cours',
      'Carte mentale & fiche exam',
      'PDF, PPT, DOCX',
    ],
    cta: 'Plan actuel',
    soon: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '2 500 CFA',
    period: '/ mois',
    jetons: 150,
    color: 'gold',
    desc: 'Pour les périodes d\'examen',
    features: [
      'Outils avancés déverrouillés',
      'Prédicteur & plan de révision',
      'Mode socratique & analyse erreurs',
      '3,75× plus de jetons',
    ],
    cta: 'Passer à Pro',
    soon: true,
  },
  {
    key: 'max',
    name: 'Max',
    price: '5 000 CFA',
    period: '/ mois',
    jetons: 400,
    color: 'purple',
    desc: 'Pour réviser sans limites',
    features: [
      'Tout le plan Pro',
      '10× plus de jetons qu\'en gratuit',
      'Export PDF fiche d\'examen',
      'Accès prioritaire aux nouvelles features',
    ],
    cta: 'Passer à Max',
    soon: true,
  },
];

export default function PlansModal({ currentPlan = 'free', onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box plans-modal" onClick={e => e.stopPropagation()}>

        <div className="plans-modal-header">
          <div>
            <h2 className="plans-modal-title">Choisir un plan</h2>
            <p className="plans-modal-sub">Plus de jetons = plus de résumés, quiz et flashcards. Prix en francs CFA.</p>
          </div>
          <button className="pomo-close" onClick={onClose} title="Fermer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="plans-grid">
          {PLANS.map(plan => {
            const isCurrent  = plan.key === (currentPlan || 'free');
            const isFeatured = plan.key === 'pro';
            return (
              <div
                key={plan.key}
                className={[
                  'plan-card',
                  `plan-card-${plan.color}`,
                  isCurrent  ? 'plan-card-current'  : '',
                  isFeatured ? 'plan-card-featured'  : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="plan-card-inner">

                  {/* En-tête */}
                  <div className="plan-card-top">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className={`plan-card-name color-${plan.color}`}>{plan.name}</span>
                      {isCurrent && (
                        <span className="plan-card-badge" style={{ position: 'static', transform: 'none', background: 'var(--teal)' }}>
                          Actuel
                        </span>
                      )}
                      {isFeatured && !isCurrent && (
                        <span className="plan-card-badge" style={{ position: 'static', transform: 'none' }}>
                          ⭐ Recommandé
                        </span>
                      )}
                    </div>
                    <div className="plan-card-price">
                      <strong>{plan.price}</strong>
                      <span>{plan.period}</span>
                    </div>
                    <p className="plan-card-desc">{plan.desc}</p>
                  </div>

                  <hr className="plan-card-divider" />

                  {/* Jetons */}
                  <div className={`plan-card-jetons color-${plan.color}`}>
                    <svg viewBox="0 0 14 14" fill="none" width="13" height="13">
                      <path d="M7 1.4 L11.6 4 V10 L7 12.6 L2.4 10 V4 Z"
                        fill="currentColor" fillOpacity="0.25"
                        stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                      <circle cx="7" cy="7" r="1.4" fill="currentColor"/>
                    </svg>
                    <strong>{plan.jetons}</strong>&nbsp;jetons / mois
                  </div>

                  {/* Features */}
                  <ul className="plan-card-features">
                    {plan.features.map(f => (
                      <li key={f}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    className={`plan-card-cta act-btn ${plan.color}${isCurrent || plan.soon ? ' disabled' : ''}`}
                    disabled={isCurrent || plan.soon}
                    title={plan.soon ? 'Paiement disponible bientôt' : ''}
                  >
                    {isCurrent ? '✓ Plan actuel' : plan.soon ? 'Bientôt disponible' : plan.cta}
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

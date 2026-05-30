import { useEffect, useState } from 'react';
import { useJetons } from '../hooks/useJetons';

/**
 * Icône jauge — étoile 4 branches (✦) dans un disque double-anneau.
 * Symbolise la "valeur / solde" — adapté pour un indicateur de crédit.
 */
function GaugeCenterSvg() {
  return (
    <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"
      width="13" height="13">
      <path
        d="M7 1.4 L11.6 4 V10 L7 12.6 L2.4 10 V4 Z"
        fill="currentColor" fillOpacity="0.2"
        stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" />
    </svg>
  );
}

/**
 * JetonWidget — arc SVG animé + icône pièce + compteur.
 * Affiché dans le header. Couleur réactive : teal > 55 % · gold 20–55 % · rose < 20 %
 */
export default function JetonWidget() {
  const { balance, monthly_allocation } = useJetons();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (balance === null) return;
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, [balance]);

  if (balance === null) return null;

  const total = monthly_allocation || 30;
  const pct   = Math.max(0, Math.min(100, (balance / total) * 100));

  const R    = 12;
  const circ = 2 * Math.PI * R;
  const fill = mounted ? (pct / 100) * circ : 0;

  const color =
    pct > 55 ? 'var(--teal)' :
    pct > 20 ? 'var(--gold)' :
               'var(--rose)';

  const urgency = pct <= 20 ? ' jeton-urgent' : '';

  return (
    <div
      className={`jeton-widget${urgency}`}
      title={`${balance} / ${total} jetons restants ce mois`}
    >
      {/* Jauge circulaire */}
      <div className="jw-gauge">
        <svg className="jw-arc" viewBox="0 0 32 32" width="32" height="32">
          <circle className="jw-track" cx="16" cy="16" r={R} />
          <circle
            className="jw-fill"
            cx="16" cy="16" r={R}
            stroke={color}
            strokeDasharray={`${fill} ${circ - fill}`}
          />
        </svg>
        {/* Icône centrée dans l'arc */}
        <div className="jw-coin-icon" style={{ color }}>
          <GaugeCenterSvg />
        </div>
      </div>

      {/* Compteur texte */}
      <div className="jw-text">
        <span className="jw-count">{balance}</span>
        <span className="jw-label">jetons</span>
      </div>
    </div>
  );
}

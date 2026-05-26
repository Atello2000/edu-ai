import { useEffect, useState } from 'react';
import { useJetons } from '../hooks/useJetons';

/**
 * Icône jauge — étoile 4 branches (✦) dans un disque double-anneau.
 * Symbolise la "valeur / solde" — adapté pour un indicateur de crédit.
 */
function GaugeCenterSvg() {
  return (
    <svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"
      width="14" height="14">
      {/* Disque principal */}
      <circle cx="11" cy="11" r="10.1" fill="currentColor" fillOpacity="0.15"
        stroke="currentColor" strokeWidth="1.3" />
      {/* Anneau intérieur relief */}
      <circle cx="11" cy="11" r="7.3" stroke="currentColor" strokeWidth="0.6"
        fill="none" opacity="0.4" />
      {/* Étoile 4 branches ✦ — symbole valeur / crédit premium */}
      <path
        d="M11 5.2 L12.3 9.7 L17 11 L12.3 12.3 L11 16.8 L9.7 12.3 L5 11 L9.7 9.7 Z"
        fill="currentColor" />
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

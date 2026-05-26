import { useEffect, useState } from 'react';
import { useJetons } from '../hooks/useJetons';

/**
 * JetonWidget — jauge SVG animée affichée dans le header.
 * Montre le solde restant + une arc circulaire qui se vide au fil des actions.
 * Couleur : teal > 55 % · gold 20–55 % · rose < 20 %
 */
export default function JetonWidget() {
  const { balance, monthly_allocation } = useJetons();
  const [mounted, setMounted] = useState(false);

  // Petite pause pour déclencher l'animation CSS au montage
  useEffect(() => {
    if (balance === null) return;
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, [balance]);

  if (balance === null) return null;

  const total = monthly_allocation || 30;
  const pct   = Math.max(0, Math.min(100, (balance / total) * 100));

  // SVG arc
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
          {/* Piste grise */}
          <circle className="jw-track" cx="16" cy="16" r={R} />
          {/* Arc coloré */}
          <circle
            className="jw-fill"
            cx="16" cy="16" r={R}
            stroke={color}
            strokeDasharray={`${fill} ${circ - fill}`}
          />
        </svg>
        <span className="jw-emoji">🪙</span>
      </div>

      {/* Compteur texte */}
      <div className="jw-text">
        <span className="jw-count">{balance}</span>
        <span className="jw-label">jetons</span>
      </div>
    </div>
  );
}

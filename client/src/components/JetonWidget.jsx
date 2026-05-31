import { useEffect, useState } from 'react';
import { useJetons } from '../hooks/useJetons';
import PlansModal from './PlansModal';

export default function JetonWidget({ user }) {
  const { balance, monthly_allocation } = useJetons();
  const [mounted,      setMounted]      = useState(false);
  const [showPlans,    setShowPlans]    = useState(false);

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
    <>
      <div
        className={`jeton-widget${urgency}`}
        title={`${balance} / ${total} jetons restants — voir les plans`}
        onClick={() => setShowPlans(true)}
        style={{ cursor: 'pointer' }}
      >
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
          <div className="jw-coin-icon" style={{ color }}>
            <span className="jw-inner-count">{balance}</span>
          </div>
        </div>
        <span className="jw-label">jetons</span>
      </div>

      {showPlans && (
        <PlansModal
          currentPlan={user?.plan || 'free'}
          onClose={() => setShowPlans(false)}
        />
      )}
    </>
  );
}

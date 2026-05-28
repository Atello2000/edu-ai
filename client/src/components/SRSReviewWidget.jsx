import { useState, useEffect } from 'react';
import { getDueCount } from '../hooks/useFlashcards.js';
import eventBus from '../utils/eventBus';

/**
 * Widget dashboard — affiche le nombre de flashcards SRS dues et propose
 * un bouton "Réviser maintenant" qui lance une session de révision.
 *
 * @param {Function} onReview — appelé quand l'utilisateur veut réviser
 */
export default function SRSReviewWidget({ onReview }) {
  const [dueCount, setDueCount] = useState(() => getDueCount());

  useEffect(() => {
    const unsub = eventBus.on('srs:refresh', () => setDueCount(getDueCount()));
    return unsub;
  }, []);

  if (dueCount === 0) return null;

  return (
    <div className="srs-widget">
      <div className="srs-widget-left">
        <span className="srs-widget-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="8" width="16" height="12" rx="2"/>
            <path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/>
          </svg>
        </span>
        <div>
          <div className="srs-widget-title">
            {dueCount} carte{dueCount > 1 ? 's' : ''} à réviser
          </div>
          <div className="srs-widget-sub">Révisions SRS planifiées pour aujourd'hui</div>
        </div>
      </div>
      <button className="srs-widget-btn" onClick={onReview}>
        Réviser →
      </button>
    </div>
  );
}

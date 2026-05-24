const GOALS = [
  {
    id: 'exam',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    label: 'Examen demain',
    desc: 'Résumé rapide + quiz difficile',
  },
  {
    id: 'understand',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    label: 'Comprendre',
    desc: 'Analyse approfondie + flashcards',
  },
  {
    id: 'memorize',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="8" width="16" height="12" rx="2"/>
        <path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/>
      </svg>
    ),
    label: 'Mémoriser',
    desc: 'Flashcards SRS + répétition',
  },
  {
    id: 'practice',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/>
        <line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>
      </svg>
    ),
    label: "S'entraîner",
    desc: 'Beaucoup de questions variées',
  },
];

export default function GoalModal({ onSelect }) {
  return (
    <div className="goal-overlay">
      <div className="goal-modal">
        <h2>Quel est votre <em>objectif</em> ?</h2>
        <p>Jangalai adaptera les générations à votre besoin.</p>
        <div className="goal-grid">
          {GOALS.map(g => (
            <button key={g.id} className="goal-card" onClick={() => onSelect(g.id)}>
              <span className="goal-icon">{g.icon}</span>
              <strong>{g.label}</strong>
              <span>{g.desc}</span>
            </button>
          ))}
        </div>
        <button className="goal-skip" onClick={() => onSelect(null)}>Passer cette étape</button>
      </div>
    </div>
  );
}

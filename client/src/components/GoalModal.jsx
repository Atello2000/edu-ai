const GOALS = [
  { id: 'exam',       icon: '⏰', label: 'Examen demain',  desc: 'Résumé rapide + quiz difficile' },
  { id: 'understand', icon: '🧠', label: 'Comprendre',     desc: 'Analyse approfondie + flashcards' },
  { id: 'memorize',   icon: '🃏', label: 'Mémoriser',      desc: 'Flashcards SRS + répétition' },
  { id: 'practice',   icon: '🎯', label: "S'entraîner",    desc: 'Beaucoup de questions variées' },
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

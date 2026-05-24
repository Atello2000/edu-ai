import { useState, useEffect } from 'react';

export default function FloatNav({ hasFiles, activePanel, onNavigate }) {
  const [generatedSections, setGeneratedSections] = useState(new Set());

  useEffect(() => {
    window.__refreshFloatNav     = () => {};  // no-op, garde la compat avec les vieux bridges
    window.__addGeneratedSection = (id) => {
      setGeneratedSections(prev => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    };
    return () => {
      delete window.__refreshFloatNav;
      delete window.__addGeneratedSection;
    };
  }, []);

  const hasActivity = generatedSections.size > 0 || hasFiles;
  if (!hasActivity) return null;

  function isActive(panelId) { return activePanel === panelId; }
  function navigate(target)  { onNavigate(target); }

  return (
    <nav className="float-nav" id="float-nav">
      {/* Accueil */}
      <button
        className={`fnav-btn fnav-home${isActive('dashboard-panel') ? ' active' : ''}`}
        onClick={() => navigate('dashboard-panel')}
      >
        <span className="fnav-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </span>
        <span className="fnav-label">Accueil</span>
      </button>

      {/* Actions — visible dès qu'il y a de l'activité */}
      <button
        className={`fnav-btn fnav-actions${isActive('actions-section') ? ' active' : ''}`}
        onClick={() => navigate('actions-section')}
      >
        <span className="fnav-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </span>
        <span className="fnav-label">Actions</span>
      </button>

      {/* Séparateur — visible seulement si au moins une section générée */}
      {generatedSections.size > 0 && <div className="fnav-divider" />}

      {/* Sections générées */}
      {[
        { id: 'summary-section',    label: 'Résumés',    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
        { id: 'quiz-section',       label: 'Quiz',       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg> },
        { id: 'flashcard-section',  label: 'Flashcards', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg> },
        { id: 'chat-section',       label: 'Chat',       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
        { id: 'exam-sheet-section', label: 'Fiche',      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
      ].filter(s => generatedSections.has(s.id)).map(s => (
        <button
          key={s.id}
          className={`fnav-btn fnav-generated${isActive(s.id) ? ' active' : ''}`}
          onClick={() => navigate(s.id)}
        >
          <span className="fnav-icon">{s.icon}</span>
          <span className="fnav-label">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}

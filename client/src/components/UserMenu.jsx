import { useState, useEffect, useRef } from 'react';

const PLAN_LABELS = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' };

function GearSvg() {
  return (
    <svg className="um-gear-svg" viewBox="0 0 18 18" fill="none"
      xmlns="http://www.w3.org/2000/svg" width="11" height="11">
      <circle cx="9" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"
        d="M9 1.5v1.4M9 15.1v1.4M1.5 9h1.4M15.1 9h1.4
           M3.6 3.6l1 1M13.4 13.4l1 1M14.4 3.6l-1 1M4.6 13.4l-1 1" />
    </svg>
  );
}

export default function UserMenu({ user, onOpenSettings }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  if (!user) return null;

  return (
    <div className="user-menu" ref={menuRef}>
      {/* Bouton principal : avatar + gear badge */}
      <button
        className="user-menu-btn"
        title={user.name}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
        <span className="user-menu-gear-badge">
          <GearSvg />
        </span>
      </button>

      {open && (
        <div className="user-dropdown open">
          {/* Infos utilisateur */}
          <div className="user-info">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <span className={`user-plan plan-${user.plan}`}>
              {PLAN_LABELS[user.plan] || user.plan}
            </span>
          </div>
          <hr className="dropdown-sep" />

          {/* Navigation */}
          <a href="/profile" className="dropdown-item"
            style={{ display: 'block', textDecoration: 'none', color: 'var(--text)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ marginRight: '.45rem', verticalAlign: 'middle' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Mon profil
          </a>

          <button className="dropdown-item dropdown-item-settings"
            onClick={() => { setOpen(false); onOpenSettings?.(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ marginRight: '.45rem', verticalAlign: 'middle' }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
                       a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
                       A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06
                       a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15
                       a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
                       A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06
                       a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68
                       a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
                       a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06
                       a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9
                       a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
                       a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Paramètres
          </button>

          {user.is_admin && (
            <a href="/admin" className="dropdown-item dropdown-item-admin"
              style={{ display: 'block', textDecoration: 'none' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ marginRight: '.45rem', verticalAlign: 'middle' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Administration
            </a>
          )}

          <hr className="dropdown-sep" />
          <button className="dropdown-item dropdown-item-logout" onClick={handleLogout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ marginRight: '.45rem', verticalAlign: 'middle' }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useJetons } from '../hooks/useJetons';

const PLAN_LABELS = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' };

export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { balance } = useJetons();

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
      <button
        className="user-menu-btn"
        title={user.name}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
        <span className="user-name-short">{user.name.split(' ')[0]}</span>
      </button>
      {open && (
        <div className="user-dropdown open">
          <div className="user-info">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <span className={`user-plan plan-${user.plan}`}>
              {PLAN_LABELS[user.plan] || user.plan}
            </span>
            {balance !== null && (
              <span className="user-jetons" title="Solde de jetons">
                🪙 {balance} jeton{balance !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <hr className="dropdown-sep" />
          <a
            href="/profile"
            className="dropdown-item"
            style={{ display: 'block', textDecoration: 'none', color: 'var(--text)' }}
          >
            Mon profil
          </a>
          {user.is_admin && (
            <a
              href="/admin"
              className="dropdown-item"
              style={{ display: 'block', textDecoration: 'none', color: 'var(--blue)' }}
            >
              ⚙ Administration
            </a>
          )}
          <button className="dropdown-item" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

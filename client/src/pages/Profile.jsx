import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import './Profile.css';

const PLAN_LABELS = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' };
const QUOTA_LABELS = { summarize: 'Résumés', quiz: 'Quiz', flashcards: 'Flashcards', chat: 'Chat' };

export default function Profile() {
  const { user, setUser } = useAuth();
  const [quota, setQuota]       = useState(null);
  const [nameVal, setNameVal]   = useState('');
  const [nameAlert, setNameAlert] = useState(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [curPwd, setCurPwd]     = useState('');
  const [newPwd, setNewPwd]     = useState('');
  const [pwdAlert, setPwdAlert] = useState(null);
  const [pwdBusy, setPwdBusy]   = useState(false);

  useEffect(() => {
    if (user) setNameVal(user.name);
    fetch('/api/quota').then(r => r.json()).then(d => {
      if (!d.unlimited) setQuota(d);
    });
  }, [user]);

  function flash(setter, msg, type) {
    setter({ msg, type });
    setTimeout(() => setter(null), 4000);
  }

  async function saveName(e) {
    e.preventDefault();
    setNameBusy(true);
    const r = await fetch('/api/auth/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameVal }),
    });
    const d = await r.json();
    setNameBusy(false);
    if (d.error) flash(setNameAlert, d.error, 'error');
    else {
      flash(setNameAlert, 'Nom mis à jour !', 'success');
      if (setUser) setUser(d.user);
    }
  }

  async function changePwd(e) {
    e.preventDefault();
    setPwdBusy(true);
    const r = await fetch('/api/auth/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
    });
    const d = await r.json();
    setPwdBusy(false);
    if (d.error) flash(setPwdAlert, d.error, 'error');
    else {
      flash(setPwdAlert, 'Mot de passe changé !', 'success');
      setCurPwd(''); setNewPwd('');
    }
  }

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <Link to="/app" className="back-link">← Retour à l&apos;app</Link>

        <div className="profile-header">
          <div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <h2>{user.name}</h2>
          <div className={`plan-badge plan-${user.plan}`}>{PLAN_LABELS[user.plan] || user.plan}</div>
        </div>

        {quota && (
          <div className="profile-section">
            <h3>Quota aujourd&apos;hui</h3>
            <div className="quota-grid">
              {Object.entries(QUOTA_LABELS).map(([key, label]) => {
                const used  = quota[key]?.used  ?? 0;
                const limit = quota[key]?.limit ?? 1;
                const pct   = Math.min(100, Math.round(used / limit * 100));
                const color = pct >= 90 ? 'var(--rose)' : pct >= 60 ? 'var(--gold)' : 'var(--blue)';
                return (
                  <div className="quota-item" key={key}>
                    <div className="q-action">{label}</div>
                    <div className="q-bar"><div className="q-fill" style={{ width: `${pct}%`, background: color }}></div></div>
                    <div className="q-nums">{used} / {limit} aujourd&apos;hui</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="profile-section">
          <h3>Informations</h3>
          {nameAlert && <div className={`alert ${nameAlert.type}`}>{nameAlert.msg}</div>}
          <form onSubmit={saveName}>
            <div className="form-group">
              <label>Nom complet</label>
              <input type="text" value={nameVal} onChange={e => setNameVal(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={user.email} disabled />
            </div>
            <button type="submit" className="save-btn" disabled={nameBusy}>
              {nameBusy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </div>

        <div className="profile-section">
          <h3>Mot de passe</h3>
          {pwdAlert && <div className={`alert ${pwdAlert.type}`}>{pwdAlert.msg}</div>}
          <form onSubmit={changePwd}>
            <div className="form-group">
              <label>Mot de passe actuel</label>
              <input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} placeholder="••••••••" required />
            </div>
            <div className="form-group">
              <label>Nouveau mot de passe</label>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="8 caractères minimum" required minLength="8" />
            </div>
            <button type="submit" className="save-btn" disabled={pwdBusy}>
              {pwdBusy ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

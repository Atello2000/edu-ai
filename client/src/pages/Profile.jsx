import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { apiFetch } from '../utils/apiFetch';
import './Profile.css';

const PLAN_LABELS = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' };

const PLAN_INFO = {
  free: {
    jetons:   '40 jetons à l\'inscription (unique)',
    fileSize: '5 Mo max par fichier',
    features: ['Résumés, quiz, flashcards', 'Chat avec le cours', 'Carte mentale & fiche d\'examen', 'Glossaire automatique', '10 sessions sauvegardées', 'Bibliothèque jusqu\'à 15 cours'],
    locked:   ['Prédicteur de questions', 'Plan de révision', 'Mode socratique', 'Analyse des erreurs', 'Export PDF fiche d\'examen'],
  },
  pro: {
    jetons:   '150 jetons / mois (rechargement automatique)',
    fileSize: '10 Mo max par fichier',
    features: ['Tous les outils de base', 'Prédicteur de questions', 'Plan de révision', 'Mode socratique', 'Analyse des erreurs', '30 sessions sauvegardées', 'Bibliothèque jusqu\'à 50 cours'],
    locked:   ['Export PDF fiche d\'examen'],
  },
  max: {
    jetons:   '400 jetons / mois (rechargement automatique)',
    fileSize: '20 Mo max par fichier',
    features: ['Tout le plan Pro', 'Export PDF fiche d\'examen', 'Sessions illimitées', 'Bibliothèque jusqu\'à 100 cours'],
    locked:   [],
  },
};

export default function Profile() {
  const { user, setUser } = useAuth();
  const [nameVal, setNameVal]   = useState('');
  const [nameAlert, setNameAlert] = useState(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [curPwd, setCurPwd]     = useState('');
  const [newPwd, setNewPwd]     = useState('');
  const [pwdAlert, setPwdAlert] = useState(null);
  const [pwdBusy, setPwdBusy]   = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) setNameVal(user.name);
  }, [user]);

  function flash(setter, msg, type) {
    setter({ msg, type });
    setTimeout(() => setter(null), 4000);
  }

  async function saveName(e) {
    e.preventDefault();
    setNameBusy(true);
    const r = await apiFetch('/api/auth/profile', {
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
    const r = await apiFetch('/api/auth/profile', {
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
          <h3>Mon plan</h3>
          {(() => {
            const info = PLAN_INFO[user.plan] || PLAN_INFO.free;
            return (
              <div className="plan-info-block">
                <div className="plan-info-row">
                  <span className="plan-info-label">Jetons</span>
                  <span className="plan-info-value">{info.jetons}</span>
                </div>
                <div className="plan-info-row">
                  <span className="plan-info-label">Fichiers</span>
                  <span className="plan-info-value">{info.fileSize}</span>
                </div>
                <div className="plan-info-features">
                  <div className="plan-info-label" style={{ marginBottom: '.4rem' }}>Inclus</div>
                  {info.features.map(f => (
                    <div key={f} className="plan-info-feat plan-info-feat-ok">✓ {f}</div>
                  ))}
                  {info.locked.map(f => (
                    <div key={f} className="plan-info-feat plan-info-feat-locked">✕ {f}</div>
                  ))}
                </div>
                {user.plan !== 'max' && (
                  <a href="/app" onClick={e => { e.preventDefault(); window.history.back(); setTimeout(() => window.dispatchEvent(new CustomEvent('plans:open-from-profile')), 100); }} className="save-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '1rem' }}>
                    {user.plan === 'free' ? 'Passer au plan Pro →' : 'Passer au plan Max →'}
                  </a>
                )}
              </div>
            );
          })()}
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

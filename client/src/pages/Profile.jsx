import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useJetons } from '../hooks/useJetons.js';
import { apiFetch } from '../utils/apiFetch';
import './Profile.css';

const PLAN_LABELS = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' };

const PLAN_INFO = {
  free: {
    jetons:   '80 jetons à l\'inscription (unique)',
    fileSize: '5 Mo max par fichier',
    features: ['Résumés, quiz, flashcards', 'Chat avec le cours', 'Carte mentale & fiche d\'examen', 'Glossaire automatique', '10 sessions sauvegardées', 'Bibliothèque jusqu\'à 15 cours'],
    locked:   ['Prédicteur de questions', 'Plan de révision', 'Mode socratique', 'Analyse des erreurs', 'Export PDF fiche d\'examen'],
  },
  pro: {
    jetons:   '150 jetons / mois (crédités au paiement)',
    fileSize: '10 Mo max par fichier',
    features: ['Tous les outils de base', 'Prédicteur de questions', 'Plan de révision', 'Mode socratique', 'Analyse des erreurs', '30 sessions sauvegardées', 'Bibliothèque jusqu\'à 50 cours'],
    locked:   ['Export PDF fiche d\'examen'],
  },
  max: {
    jetons:   '400 jetons / mois (crédités au paiement)',
    fileSize: '20 Mo max par fichier',
    features: ['Tout le plan Pro', 'Export PDF fiche d\'examen', 'Sessions illimitées', 'Bibliothèque jusqu\'à 100 cours'],
    locked:   [],
  },
};

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { balance, history, monthly_allocation } = useJetons();
  const [nameVal, setNameVal]   = useState('');
  const [nameAlert, setNameAlert] = useState(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [curPwd, setCurPwd]     = useState('');
  const [newPwd, setNewPwd]     = useState('');
  const [pwdAlert, setPwdAlert] = useState(null);
  const [pwdBusy, setPwdBusy]   = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [dangerAlert, setDangerAlert] = useState(null);
  const [delOpen, setDelOpen]   = useState(false);
  const [delPwd, setDelPwd]     = useState('');
  const [delBusy, setDelBusy]   = useState(false);

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
    if (d.requiresLogin) {
      window.location.assign('/login?passwordChanged=1');
      return;
    }
    if (d.error) flash(setPwdAlert, d.error, 'error');
    else {
      flash(setPwdAlert, 'Mot de passe changé !', 'success');
      setCurPwd(''); setNewPwd('');
    }
  }

  async function exportData() {
    setExportBusy(true);
    try {
      const r = await apiFetch('/api/auth/account/export');
      if (!r.ok) throw new Error('Échec de l\'export des données.');
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `jangalai-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash(setDangerAlert, 'Export téléchargé.', 'success');
    } catch (err) {
      flash(setDangerAlert, err.message, 'error');
    } finally {
      setExportBusy(false);
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setDelBusy(true);
    const r = await apiFetch('/api/auth/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: delPwd }),
    });
    const d = await r.json().catch(() => ({}));
    setDelBusy(false);
    if (!r.ok || d.error) {
      flash(setDangerAlert, d.error || 'Échec de la suppression.', 'error');
      return;
    }
    if (setUser) setUser(null);
    navigate('/', { replace: true });
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
          <h3>Tableau de bord de mes jetons</h3>
          <div className="jeton-dashboard-block">
            <div className="jeton-summary-cards">
              <div className="jeton-summary-card">
                <span className="jsc-label">Solde actuel</span>
                <strong className="jsc-value">{balance !== null ? balance : '—'}</strong>
                <span className="jsc-sub text-muted">jetons restants</span>
              </div>
              <div className="jeton-summary-card">
                <span className="jsc-label">Allocation mensuelle</span>
                <strong className="jsc-value">{monthly_allocation !== null ? monthly_allocation : '80'}</strong>
                <span className="jsc-sub text-muted">jetons / mois</span>
              </div>
            </div>

            {/* Répartition des dépenses (Graphique CSS personnalisé) */}
            <h4 className="jeton-sub-title">Répartition de mes dépenses</h4>
            {(() => {
              const spentHistory = (history || []).filter(tx => tx.amount < 0);
              const totalSpent = spentHistory.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
              
              const actionSpent = {};
              spentHistory.forEach(tx => {
                let act = tx.action;
                if (act.startsWith('refund:')) act = act.split(':')[1];
                actionSpent[act] = (actionSpent[act] || 0) + Math.abs(tx.amount);
              });

              const ACTION_LABELS = {
                summarize: 'Résumés',
                quiz: 'Quiz',
                flashcards: 'Flashcards',
                chat: 'Chat',
                'exam-sheet': 'Fiches d\'examen',
                glossary: 'Glossaires',
                mindmap: 'Cartes mentales',
                socratic: 'Mode socratique',
                'study-plan': 'Plans de révision',
                predict: 'Prédicteur',
                'error-analysis': 'Analyse d\'erreurs',
                compare: 'Comparateur',
              };

              const chartData = Object.entries(actionSpent)
                .map(([action, amount]) => {
                  const percentage = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
                  return { action, amount, percentage, label: ACTION_LABELS[action] || action };
                })
                .sort((a, b) => b.amount - a.amount);

              if (chartData.length === 0) {
                return (
                  <div className="jeton-empty-state">
                    Aucune dépense de jetons enregistrée récemment.
                  </div>
                );
              }

              return (
                <div className="jeton-chart-list">
                  {chartData.map(item => (
                    <div key={item.action} className="jeton-chart-row">
                      <div className="jeton-chart-info">
                        <span className="jeton-chart-name">{item.label}</span>
                        <span className="jeton-chart-value">{item.amount} jetons ({item.percentage}%)</span>
                      </div>
                      <div className="jeton-chart-bar-track">
                        <div className="jeton-chart-bar-fill" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="jeton-chart-total">
                    Total dépensé sur la période : <strong>{totalSpent} jetons</strong>
                  </div>
                </div>
              );
            })()}

            {/* Historique des transactions */}
            <h4 className="jeton-sub-title" style={{ marginTop: '1.5rem' }}>Dernières transactions</h4>
            {(!history || history.length === 0) ? (
              <div className="jeton-empty-state">
                Aucune transaction répertoriée.
              </div>
            ) : (
              <div className="jeton-tx-list">
                {history.slice(0, 10).map((tx, idx) => {
                  const ACTION_LABELS = {
                    summarize: 'Résumés',
                    quiz: 'Quiz',
                    flashcards: 'Flashcards',
                    chat: 'Chat',
                    'exam-sheet': 'Fiches d\'examen',
                    glossary: 'Glossaires',
                    mindmap: 'Cartes mentales',
                    socratic: 'Mode socratique',
                    'study-plan': 'Plans de révision',
                    predict: 'Prédicteur',
                    'error-analysis': 'Analyse d\'erreurs',
                    compare: 'Comparateur',
                  };

                  const dateStr = new Date(tx.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  let desc = tx.note || '';
                  let act = tx.action;
                  const isRefund = act.startsWith('refund:');
                  if (isRefund) act = act.split(':')[1];
                  const actionName = ACTION_LABELS[act] || act;

                  if (tx.amount < 0) {
                    desc = `Génération de ${actionName.toLowerCase()}`;
                  } else if (isRefund) {
                    desc = `Remboursement (${actionName.toLowerCase()})`;
                  } else if (tx.action === 'admin_credit') {
                    desc = tx.note ? `Crédit : ${tx.note}` : 'Allocation de jetons';
                  }

                  const isPositive = tx.amount > 0;
                  const badgeClass = isPositive ? 'tx-badge-plus' : 'tx-badge-minus';

                  return (
                    <div key={idx} className="jeton-tx-item">
                      <div className="jtx-left">
                        <span className="jtx-date">{dateStr}</span>
                        <span className="jtx-desc">{desc}</span>
                      </div>
                      <span className={`jtx-badge ${badgeClass}`}>
                        {isPositive ? `+${tx.amount}` : tx.amount}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

        <div className="profile-section">
          <h3>Données &amp; confidentialité</h3>
          {dangerAlert && <div className={`alert ${dangerAlert.type}`}>{dangerAlert.msg}</div>}

          <div className="form-group">
            <label>Exporter mes données</label>
            <p className="privacy-hint">Téléchargez l&apos;ensemble de vos données personnelles (profil, bibliothèque, activité, jetons, paiements) au format JSON.</p>
            <button type="button" className="save-btn" onClick={exportData} disabled={exportBusy}>
              {exportBusy ? 'Préparation…' : 'Télécharger mes données (JSON)'}
            </button>
          </div>

          <div className="danger-zone">
            <label>Supprimer mon compte</label>
            <p className="privacy-hint">Cette action est <strong>irréversible</strong>. Votre compte et toutes vos données (bibliothèque, historique, jetons, partages) seront définitivement effacés.</p>
            {!delOpen ? (
              <button type="button" className="danger-btn" onClick={() => { setDelOpen(true); setDangerAlert(null); }}>
                Supprimer mon compte
              </button>
            ) : (
              <form onSubmit={deleteAccount}>
                <div className="form-group">
                  <label>Confirmez avec votre mot de passe</label>
                  <input
                    type="password"
                    value={delPwd}
                    onChange={e => setDelPwd(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <p className="privacy-hint">Laissez vide si vous vous connectez uniquement avec Google.</p>
                </div>
                <div className="danger-actions">
                  <button type="button" className="save-btn save-btn-ghost" onClick={() => { setDelOpen(false); setDelPwd(''); }} disabled={delBusy}>
                    Annuler
                  </button>
                  <button type="submit" className="danger-btn" disabled={delBusy}>
                    {delBusy ? 'Suppression…' : 'Supprimer définitivement'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/Logo';
import './Login.css';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('login');
  const [error, setError] = useState('');

  useEffect(() => {
    const e = searchParams.get('error');
    if (e === 'google_denied') setError('Connexion Google annulée.');
    else if (e === 'invalid_token') setError('Lien de vérification invalide.');
    else if (e === 'token_expired') setError('Lien expiré. Reconnectez-vous pour en recevoir un nouveau.');
    else if (e) setError('Une erreur est survenue. Réessayez.');
  }, []);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  function onChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-preview">
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 500 }}>
          <div className="mockup-wrap">
            <div className="mock-window">
              <div className="mock-titlebar">
                <div className="mock-dot r"/><div className="mock-dot y"/><div className="mock-dot g"/>
                <span className="mock-title-text">Jangalai — Tableau de bord</span>
              </div>
              <div className="mock-body">
                <div className="mock-greeting">Bonjour, <em>Aminata</em> — Bonne session !</div>
                <div className="mock-actions">
                  <div className="mock-action purple">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    Résumé
                  </div>
                  <div className="mock-action blue">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d7eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Quiz
                  </div>
                  <div className="mock-action gold">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a94c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    Fiches
                  </div>
                  <div className="mock-action teal">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1dd1a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Chat IA
                  </div>
                </div>
                <div className="mock-stats">
                  <div className="mock-stat"><div className="mock-stat-val">12</div><div className="mock-stat-lbl">Cours résumés</div></div>
                  <div className="mock-stat"><div className="mock-stat-val">84</div><div className="mock-stat-lbl">Flashcards</div></div>
                  <div className="mock-stat"><div className="mock-stat-val">7</div><div className="mock-stat-lbl">Quiz passés</div></div>
                </div>
                <div className="mock-fc-row">
                  <div className="mock-fc front">
                    <div className="mock-fc-q">Question</div>
                    <div className="mock-fc-a">Qu'est-ce que la mitose ?</div>
                    <div className="mock-fc-tag blue">Biologie</div>
                  </div>
                  <div className="mock-fc back">
                    <div className="mock-fc-q">Réponse</div>
                    <div className="mock-fc-a">Division cellulaire produisant 2 cellules filles identiques.</div>
                    <div className="mock-fc-tag teal">✓ Correct</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mockup-tagline">
            <p><strong>Résumés · Quiz · Flashcards · Chat IA</strong><br/>Tout ce dont vous avez besoin pour maîtriser vos cours.</p>
          </div>
        </div>
      </div>

      <div className="auth-side">
        <div className="auth-card">
          <div className="auth-logo">
            <h1><Logo size={36} /></h1>
            <p>Plateforme IA pour vos cours</p>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>Connexion</button>
            <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>Inscription</button>
          </div>

          {error && <div className="auth-error show">{error}</div>}

          {tab === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" placeholder="vous@email.com" required autoComplete="email" value={form.email} onChange={onChange} />
              </div>
              <div className="form-group">
                <label>Mot de passe</label>
                <input type="password" name="password" placeholder="••••••••" required autoComplete="current-password" value={form.password} onChange={onChange} />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
              <p className="forgot-link"><Link to="/forgot-password">Mot de passe oublié ?</Link></p>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="form-group">
                <label>Prénom / Nom</label>
                <input type="text" name="name" placeholder="Votre nom complet" required autoComplete="off" value={form.name} onChange={onChange} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" placeholder="vous@email.com" required autoComplete="email" value={form.email} onChange={onChange} />
              </div>
              <div className="form-group">
                <label>Mot de passe</label>
                <input type="password" name="password" placeholder="8 caractères minimum" required autoComplete="new-password" minLength="8" value={form.password} onChange={onChange} />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Création…' : 'Créer mon compte'}</button>
            </form>
          )}
        </div>
        <p className="landing-link">Découvrir la plateforme → <Link to="/">En savoir plus</Link></p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/Logo';
import './Login.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { setUser }    = useAuth();
  const token          = searchParams.get('token') || '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas.');
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const me = await fetch('/api/auth/me', { credentials: 'include' });
      const { user } = await me.json();
      setUser(user);
      navigate('/app');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (!token) return (
    <div className="auth-side" style={{ width: '100%', minHeight: '100dvh', borderLeft: 'none' }}>
      <div className="auth-card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>Lien invalide.</p>
        <Link to="/login" className="auth-btn" style={{ display: 'block', marginTop: '1rem', textDecoration: 'none', textAlign: 'center' }}>
          Retour à la connexion
        </Link>
      </div>
    </div>
  );

  return (
    <div className="auth-side" style={{ width: '100%', minHeight: '100dvh', borderLeft: 'none' }}>
      <div className="auth-card" style={{ maxWidth: 400 }}>
        <div className="auth-logo">
          <h1><Logo size={36} /></h1>
          <p>Nouveau mot de passe</p>
        </div>

        {error && <div className="auth-error show">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nouveau mot de passe</label>
            <input type="password" placeholder="8 caractères minimum" required minLength="8" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Confirmer le mot de passe</label>
            <input type="password" placeholder="Répétez le mot de passe" required minLength="8" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}

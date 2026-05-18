import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import './Login.css';

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [done, setDone]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setDone(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="auth-side" style={{ width: '100%', minHeight: '100vh', borderLeft: 'none' }}>
      <div className="auth-card" style={{ maxWidth: 400 }}>
        <div className="auth-logo">
          <h1><Logo size={36} /></h1>
          <p>Réinitialisation du mot de passe</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📬</div>
            <p style={{ color: 'var(--text)', marginBottom: '.5rem', fontWeight: 600 }}>Email envoyé !</p>
            <p style={{ color: 'var(--muted)', fontSize: '.88rem', lineHeight: 1.6 }}>
              Si cet email existe dans notre base, vous recevrez un lien de réinitialisation dans quelques minutes.
            </p>
            <Link to="/login" className="auth-btn" style={{ display: 'block', marginTop: '1.5rem', textAlign: 'center', textDecoration: 'none' }}>
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            {error && <div className="auth-error show">{error}</div>}
            <form className="auth-form" onSubmit={handleSubmit}>
              <p style={{ color: 'var(--muted)', fontSize: '.88rem', lineHeight: 1.6, marginBottom: '.5rem' }}>
                Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="vous@email.com" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
            <p className="landing-link"><Link to="/login">← Retour à la connexion</Link></p>
          </>
        )}
      </div>
    </div>
  );
}

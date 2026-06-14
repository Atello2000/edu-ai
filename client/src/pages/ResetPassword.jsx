import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n';
import Logo from '../components/Logo';
import './Login.css';

export default function ResetPassword() {
  const { t }          = useT();
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
    if (password !== confirm) return setError(t('auth.resetPage.mismatch'));
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
        <p style={{ color: 'var(--muted)' }}>{t('auth.resetPage.invalidLink')}</p>
        <Link to="/login" className="auth-btn" style={{ display: 'block', marginTop: '1rem', textDecoration: 'none', textAlign: 'center' }}>
          {t('auth.resetPage.backToLogin')}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="auth-side" style={{ width: '100%', minHeight: '100dvh', borderLeft: 'none' }}>
      <div className="auth-card" style={{ maxWidth: 400 }}>
        <div className="auth-logo">
          <h1><Logo size={36} /></h1>
          <p>{t('auth.resetPage.subtitle')}</p>
        </div>

        {error && <div className="auth-error show">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.resetPage.newPassword')}</label>
            <input type="password" placeholder={t('auth.passwordMinPlaceholder')} required minLength="8" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('auth.resetPage.confirmPassword')}</label>
            <input type="password" placeholder={t('auth.resetPage.confirmPlaceholder')} required minLength="8" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? t('auth.resetPage.saving') : t('auth.resetPage.save')}
          </button>
        </form>
      </div>
    </div>
  );
}

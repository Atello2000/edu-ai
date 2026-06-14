import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n';
import Logo from '../components/Logo';
import './Login.css';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function Login() {
  const { login, register } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'register' ? 'register' : 'login');
  const [error, setError] = useState(() => {
    const code = searchParams.get('error');
    if (!code) return '';
    const known = ['beta_full', 'google_denied', 'invalid_token', 'token_expired'];
    return t(`auth.errors.${known.includes(code) ? code : 'generic'}`);
  });
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
                <span className="mock-title-text">{t('auth.preview.dashboard')}</span>
              </div>
              <div className="mock-body">
                <div className="mock-greeting">{t('auth.preview.greeting', { name: 'Aminata' })}</div>
                <div className="mock-actions">
                  <div className="mock-action purple">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    {t('auth.preview.summary')}
                  </div>
                  <div className="mock-action blue">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d7eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    {t('auth.preview.quiz')}
                  </div>
                  <div className="mock-action gold">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a94c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    {t('auth.preview.sheets')}
                  </div>
                  <div className="mock-action teal">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1dd1a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    {t('auth.preview.chat')}
                  </div>
                </div>
                <div className="mock-stats">
                  <div className="mock-stat"><div className="mock-stat-val">12</div><div className="mock-stat-lbl">{t('auth.preview.statSummaries')}</div></div>
                  <div className="mock-stat"><div className="mock-stat-val">84</div><div className="mock-stat-lbl">{t('auth.preview.statFlashcards')}</div></div>
                  <div className="mock-stat"><div className="mock-stat-val">7</div><div className="mock-stat-lbl">{t('auth.preview.statQuiz')}</div></div>
                </div>
                <div className="mock-fc-row">
                  <div className="mock-fc front">
                    <div className="mock-fc-q">{t('auth.preview.question')}</div>
                    <div className="mock-fc-a">{t('auth.preview.fcQuestion')}</div>
                    <div className="mock-fc-tag blue">{t('auth.preview.fcTag')}</div>
                  </div>
                  <div className="mock-fc back">
                    <div className="mock-fc-q">{t('auth.preview.answer')}</div>
                    <div className="mock-fc-a">{t('auth.preview.fcAnswer')}</div>
                    <div className="mock-fc-tag teal">{t('auth.preview.fcCorrect')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mockup-tagline">
            <p><strong>{t('auth.preview.featuresLine')}</strong><br/>{t('auth.preview.featuresSub')}</p>
          </div>
        </div>
      </div>

      <div className="auth-side">
        <div className="auth-card">
          <div className="auth-logo">
            <h1><Logo size={36} /></h1>
            <p>{t('auth.tagline')}</p>
          </div>

          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>{t('auth.tabs.login')}</button>
            <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>{t('auth.tabs.register')}</button>
          </div>

          {error && <div className="auth-error show">{error}</div>}

          <a href="/api/auth/google" className="google-btn">
            <GoogleIcon /> {t('auth.google')}
          </a>

          <div className="auth-divider">{tab === 'register' ? t('auth.dividerRegister') : t('auth.dividerLogin')}</div>

          {tab === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label>{t('auth.email')}</label>
                <input type="email" name="email" placeholder={t('auth.emailPlaceholder')} required autoComplete="email" value={form.email} onChange={onChange} />
              </div>
              <div className="form-group">
                <label>{t('auth.password')}</label>
                <input type="password" name="password" placeholder={t('auth.passwordPlaceholder')} required autoComplete="current-password" value={form.password} onChange={onChange} />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>{loading ? t('auth.loginLoading') : t('auth.login')}</button>
              <p className="forgot-link"><Link to="/forgot-password">{t('auth.forgot')}</Link></p>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="form-group">
                <label>{t('auth.email')}</label>
                <input type="email" name="email" placeholder={t('auth.emailPlaceholder')} required autoComplete="email" value={form.email} onChange={onChange} />
              </div>
              <div className="form-group">
                <label>{t('auth.password')}</label>
                <input type="password" name="password" placeholder={t('auth.passwordMinPlaceholder')} required autoComplete="new-password" minLength="8" value={form.password} onChange={onChange} />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>{loading ? t('auth.registerLoading') : t('auth.register')}</button>
              <p className="auth-legal-note">
                {t('auth.legalPrefix')}<Link to="/cgu">{t('auth.terms')}</Link>{t('auth.legalMid')}<Link to="/confidentialite">{t('auth.privacy')}</Link>{t('auth.legalSuffix')}
              </p>
            </form>
          )}
        </div>
        <p className="landing-link">{t('auth.discover')}<Link to="/">{t('auth.learnMore')}</Link></p>
      </div>
    </div>
  );
}

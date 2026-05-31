import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');

  let error = '';
  if (errorParam === 'beta_full')    error = 'L\'accès est limité pendant la bêta. Revenez bientôt !';
  if (errorParam === 'google_denied') error = 'Connexion Google annulée.';
  if (errorParam === 'invalid_token') error = 'Lien de vérification invalide.';
  if (errorParam === 'token_expired') error = 'Lien expiré. Reconnectez-vous pour en recevoir un nouveau.';
  if (errorParam) error = 'Une erreur est survenue lors de l\'authentification.';

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
        <div className="auth-card" style={{ padding: '50px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '380px' }}>
          <div className="auth-logo" style={{ marginBottom: '40px' }}>
            <h1><Logo size={42} /></h1>
            <p style={{ fontSize: '15px', color: '#94a3b8', marginTop: '10px' }}>Plateforme d&apos;apprentissage IA ultra-rapide pour vos cours</p>
          </div>

          {error && <div className="auth-error show" style={{ marginBottom: '24px' }}>{error}</div>}

          <a href="/api/auth/google" className="google-btn" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
            textDecoration: 'none',
            transition: 'all 0.2s ease-in-out',
            margin: '10px 0 20px 0'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.background = '#f8fafc';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = '#ffffff';
          }}
          >
            <GoogleIcon /> S&apos;inscrire ou se connecter avec Google
          </a>

          <p style={{
            fontSize: '13px',
            color: '#64748b',
            lineHeight: '1.6',
            marginTop: '20px',
            textAlign: 'center'
          }}>
            🔐 Authentification 100% sécurisée via Google.<br/>
            Aucun mot de passe à retenir. Compte créé instantanément.
          </p>
        </div>
        <p className="landing-link" style={{ marginTop: '20px' }}>Découvrir la plateforme → <Link to="/">En savoir plus</Link></p>
      </div>
    </div>
  );
}

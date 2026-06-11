import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import { useDir } from './hooks/useDir.js';
import OfflineBanner from './components/OfflineBanner.jsx';
import { apiFetch } from './utils/apiFetch';
import toast from './utils/toast';

// Chargement synchrone — page d'atterrissage (premier rendu critique)
import Landing from './pages/Landing.jsx';

// Lazy-load — pages secondaires (chargées à la demande)
const Login          = lazy(() => import('./pages/Login.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword.jsx'));
const AppPage        = lazy(() => import('./pages/AppPage.jsx'));
const Profile        = lazy(() => import('./pages/Profile.jsx'));
const Admin          = lazy(() => import('./pages/Admin.jsx'));
const CGU            = lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m.CGU })));
const Confidentialite = lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m.Confidentialite })));

function PageLoader() {
  return <div className="page-loader">Chargement…</div>;
}

function VerifyEmailScreen({ user }) {
  const { logout, refreshSession } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  useEffect(() => {
    let polls = 0;
    const MAX_POLLS = 150; // 10 minutes à raison de 4s/poll
    const timer = setInterval(async () => {
      if (++polls >= MAX_POLLS) { clearInterval(timer); return; }
      await refreshSession();
    }, 4000);
    return () => clearInterval(timer);
  }, [refreshSession]);

  async function resend() {
    if (sending) return;
    setSending(true);
    try {
      const res = await apiFetch('/api/auth/resend-verify', { method: 'POST' });
      if (res.ok) { setSent(true); toast.success('E-mail renvoyé ! Vérifiez vos spams.'); }
      else toast.error("Impossible de renvoyer l'e-mail.");
    } catch {
      toast.error('Une erreur est survenue.');
    } finally { setSending(false); }
  }

  async function checkVerification() {
    const updated = await refreshSession();
    if (updated?.email_verified !== 0) {
      toast.success('Email confirmé !');
    } else if (!updated) {
      toast.info('Reconnectez-vous pour finaliser la session sur cet appareil.');
    } else {
      toast.info('Email pas encore confirmé.');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#070b14',
      padding: '24px 16px', fontFamily: 'Outfit, sans-serif',
    }}>
      {/* Glow background */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '500px', height: '500px', borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
      }} />

      <div style={{
        position: 'relative', background: '#0d1117',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: '28px', padding: '44px 32px 36px',
        maxWidth: '400px', width: '100%', textAlign: 'center',
        boxSizing: 'border-box',
        boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
      }}>
        {/* Icon */}
        <div style={{
          width: '76px', height: '76px', borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.1))',
          border: '1.5px solid rgba(59,130,246,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 28px',
          boxShadow: '0 0 32px rgba(59,130,246,0.2)',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="url(#emailGrad)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="emailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#6366f1"/>
              </linearGradient>
            </defs>
            <rect x="2" y="4" width="20" height="16" rx="3"/>
            <polyline points="2,4 12,13 22,4"/>
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '24px', fontWeight: '800', margin: '0 0 12px',
          background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em',
        }}>Confirmez votre email</h1>

        <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.7', margin: '0 0 6px' }}>
          Un lien d&apos;activation a été envoyé à
        </p>
        <p style={{
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: '10px', padding: '8px 14px', display: 'inline-block',
          color: '#60a5fa', fontWeight: '600', fontSize: '14px',
          margin: '0 0 28px', wordBreak: 'break-all', maxWidth: '100%',
        }}>{user?.email}</p>

        {/* Steps */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '14px', padding: '16px 18px', marginBottom: '24px', textAlign: 'left',
        }}>
          {[
            ['1', 'Ouvrez votre boîte mail'],
            ['2', 'Cliquez sur le lien de confirmation'],
            ['3', 'Accédez à Jangalai'],
          ].map(([n, label]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: n !== '3' ? '10px' : 0 }}>
              <span style={{
                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700', color: '#60a5fa',
              }}>{n}</span>
              <span style={{ fontSize: '13.5px', color: '#94a3b8' }}>{label}</span>
            </div>
          ))}
        </div>

        <button onClick={resend} disabled={sending} style={{
          width: '100%',
          background: sent
            ? 'rgba(34,197,94,0.15)'
            : 'linear-gradient(135deg, #3b82f6, #6366f1)',
          color: sent ? '#4ade80' : '#fff',
          border: sent ? '1px solid rgba(34,197,94,0.3)' : 'none',
          borderRadius: '14px', padding: '14px', fontSize: '15px',
          fontWeight: '600', cursor: sending ? 'wait' : 'pointer',
          marginBottom: '10px', opacity: sending ? 0.7 : 1,
          boxShadow: sent ? 'none' : '0 8px 20px -4px rgba(59,130,246,0.35)',
          transition: 'all 0.2s',
        }}>
          {sending ? 'Envoi…' : sent ? '✓ Lien renvoyé' : 'Renvoyer le lien'}
        </button>

        <button onClick={checkVerification} style={{
          width: '100%', background: 'transparent', color: '#334155',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px',
          padding: '12px', fontSize: '13.5px', cursor: 'pointer',
          marginBottom: '10px',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
          onMouseLeave={e => e.currentTarget.style.color = '#334155'}
        >
          J'ai déjà confirmé
        </button>

        <button onClick={logout} style={{
          width: '100%', background: 'transparent', color: '#334155',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px',
          padding: '12px', fontSize: '13.5px', cursor: 'pointer',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
          onMouseLeave={e => e.currentTarget.style.color = '#334155'}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.email_verified === 0) return <VerifyEmailScreen user={user} />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/app" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user?.email_verified === 0 && new URLSearchParams(location.search).has('error')) return children;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  useDir(); // Applique dir="rtl" sur <html> si lang === 'ar'
  return (
    <>
    <OfflineBanner />
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/"                element={<Landing />} />
        <Route path="/login"           element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/app"             element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
        <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin"           element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/cgu"             element={<CGU />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  );
}

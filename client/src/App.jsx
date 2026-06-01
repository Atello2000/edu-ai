import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

function PageLoader() {
  return <div className="page-loader">Chargement…</div>;
}

function VerifyEmailScreen({ user }) {
  const { logout } = useAuth();

  async function resend() {
    try {
      const res = await apiFetch('/api/auth/resend-verify', { method: 'POST' });
      if (res.ok) toast.success('E-mail renvoyé ! Vérifiez vos spams.');
      else toast.error("Impossible de renvoyer l'e-mail.");
    } catch {
      toast.error('Une erreur est survenue.');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg, #080c16)',
      padding: '24px 16px', fontFamily: 'Outfit, sans-serif',
    }}>
      <div style={{
        background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '24px', padding: '40px 28px', maxWidth: '420px',
        width: '100%', textAlign: 'center', boxSizing: 'border-box',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'rgba(59,130,246,0.12)', border: '1.5px solid rgba(59,130,246,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: '32px',
        }}>📧</div>

        <h1 style={{
          fontSize: '22px', fontWeight: '800', margin: '0 0 10px',
          color: '#f1f5f9', letterSpacing: '-0.02em',
        }}>Vérifiez votre email</h1>

        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.7', margin: '0 0 8px' }}>
          Un lien de confirmation a été envoyé à
        </p>
        <p style={{
          color: '#3b82f6', fontWeight: '600', fontSize: '14px',
          margin: '0 0 28px', wordBreak: 'break-all',
        }}>{user?.email}</p>

        <button onClick={resend} style={{
          width: '100%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          color: '#fff', border: 'none', borderRadius: '14px',
          padding: '14px', fontSize: '15px', fontWeight: '600',
          cursor: 'pointer', marginBottom: '12px',
          boxShadow: '0 8px 20px -4px rgba(59,130,246,0.4)',
        }}>
          Renvoyer le lien
        </button>

        <button onClick={logout} style={{
          width: '100%', background: 'transparent',
          color: '#475569', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px', padding: '12px', fontSize: '14px',
          cursor: 'pointer',
        }}>
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
  if (loading) return <PageLoader />;
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
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  );
}

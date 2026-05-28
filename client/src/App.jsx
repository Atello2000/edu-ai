import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';

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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/"                element={<Landing />} />
        <Route path="/login"           element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/app"             element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
        <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin"           element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

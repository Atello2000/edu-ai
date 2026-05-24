import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import { ConfirmProvider } from './components/ConfirmModal.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import App from './App.jsx';
import './style.css';

// ── PWA Service Worker ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  // Remember whether a SW was already controlling this page before we register.
  // controllerchange fires both on first install (null → SW) and on updates
  // (old SW → new SW). We only want to reload on updates so that a hard
  // navigation to the app doesn't trigger a cascade of reloads caused by the
  // first-install activate cycle hitting an old CDN edge node.
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.register('/sw.js').then(reg => {
    if (reg.waiting) applySwUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller)
          applySwUpdate(sw);
      });
    });
  }).catch(() => {});

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) location.reload(); // SW update — reload to apply new assets
    // else: first install — no reload needed, page already has fresh assets
  });
}

function applySwUpdate(sw) {
  const toast = document.createElement('div');
  toast.textContent = '✦ Mise à jour en cours…';
  toast.style.cssText = 'position:fixed;bottom:5.5rem;left:50%;transform:translateX(-50%);background:#1a2540;border:1px solid #3d7eff;color:#e8ecf6;padding:.6rem 1.2rem;border-radius:10px;z-index:9999;font-family:\'Outfit\',sans-serif;font-size:.85rem;box-shadow:0 8px 28px rgba(0,0,0,.4);pointer-events:none;';
  document.body.appendChild(toast);
  setTimeout(() => sw.postMessage({ type: 'SKIP_WAITING' }), 2000);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ConfirmProvider>
            <App />
            <ToastContainer />
          </ConfirmProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);

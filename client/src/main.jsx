import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import App from './App.jsx';
import './style.css';

// ── PWA Service Worker ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
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
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
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
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);

// public/app.js — résiduel minimal
// Tout le code applicatif est maintenant dans le bundle React (client/src/).
// Ce fichier est chargé dynamiquement par AppPage.jsx pour s'assurer que
// l'utilisateur est bien authentifié (fallback vanilla pour les pages non-React).

// ── AUTH (vanilla fallback) ───────────────────────────────────────────────────
async function initAuth() {
  if (window.__reactUser) return true;
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.user) { window.location.href = '/login'; return false; }
    return true;
  } catch {
    window.location.href = '/login';
    return false;
  }
}

// Init — appelé par React AppPage après le montage
async function startApp() {
  const ok = await initAuth();
  if (!ok) return;
}

if (!window.__reactApp) {
  startApp();
} else {
  window.startApp = startApp;
}

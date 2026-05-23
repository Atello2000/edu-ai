// public/app.js — résiduel minimal
// Tout le code applicatif est maintenant dans le bundle React (client/src/).
// Ce fichier est chargé dynamiquement par AppPage.jsx pour initialiser
// quelques bridges nécessaires au contexte vanilla (pages non-React).

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

// ── BRIDGES (définis par React, listés ici pour référence) ───────────────────
// window.__appShowPanel        — AppPage.jsx setActivePanel
// window.__getSelectedFiles    — ActionsPanel.jsx
// window.__saveSession         — useSessions.js
// window.__restoreSession      — useSessions.js
// window.__fetchQuota          — QuotaBar.jsx
// window.__renderDashboard     — DashboardStats.jsx
// window.__refreshFloatNav     — FloatNav.jsx (no-op)
// window.__addGeneratedSection — FloatNav.jsx
// window.__showSaveFolderModal — SaveFolderModal.jsx
// window.__openMindmap         — MindmapModal.jsx
// window.__refreshHistory      — HistoryPanel.jsx
// window.__refreshStats        — StatsPanel.jsx
// window.__applyPrefs          — ActionsPanel.jsx
// window._summaryResultsRef    — AppPage.jsx
// window.uploadedFilesMeta     — AppPage.jsx

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

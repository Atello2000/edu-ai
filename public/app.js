// ── AUTH ─────────────────────────────────────────────────────────────────────
// User menu + onboarding handled by React (AppPage.jsx / UserMenu / Onboarding)
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

// ── PANEL NAVIGATION — gérée par React (AppPage.jsx activePanel state) ───────
// window.__appShowPanel = setActivePanel (défini par React AppPage)

// window.uploadedFilesMeta syncé depuis React (AppPage.jsx useEffect)
// window.__getSelectedFiles défini par React (ActionsPanel.jsx)

const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const uploadSizeHint = document.getElementById('upload-size-hint');
if (uploadSizeHint) uploadSizeHint.textContent = isLocal ? '50 Mo' : '20 Mo';

// ── Compteur utilisateurs en ligne ───────────────────────────────────────────
const onlineCounter = document.getElementById('online-counter');
const onlineCountEl = document.getElementById('online-count');

// ID unique par session navigateur
if (!sessionStorage.getItem('edu-client-id'))
  sessionStorage.setItem('edu-client-id', crypto.randomUUID());
const clientId = sessionStorage.getItem('edu-client-id');

async function pingServer() {
  try {
    const res  = await fetch('/api/ping', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ clientId }) });
    const data = await res.json();
    if (isLocal) {
      onlineCountEl.textContent = data.online;
      onlineCounter.classList.remove('hidden');
    }
  } catch {}
}

pingServer();
setInterval(pingServer, 30000);

const SRS_KEY = 'jangalai-srs';

// ── PWA SERVICE WORKER ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    // SW déjà en attente (onglet rouvert après déploiement)
    if (reg.waiting) applyUpdate(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          applyUpdate(newSW);
        }
      });
    });
  }).catch(() => {});

  // Recharge la page dès que le nouveau SW prend le contrôle
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
}

function applyUpdate(newSW) {
  // Toast discret, puis mise à jour automatique après 2 s
  const toast = document.createElement('div');
  toast.textContent = '✦ Mise à jour en cours…';
  toast.style.cssText = `
    position:fixed;bottom:5.5rem;left:50%;transform:translateX(-50%);
    background:#1a2540;border:1px solid #3d7eff;color:#e8ecf6;
    padding:.6rem 1.2rem;border-radius:10px;z-index:9999;
    font-family:'Outfit',sans-serif;font-size:.85rem;
    box-shadow:0 8px 28px rgba(0,0,0,.4);pointer-events:none;`;
  document.body.appendChild(toast);
  setTimeout(() => newSW.postMessage({ type: 'SKIP_WAITING' }), 2000);
}


// ── ONBOARDING ────────────────────────────────────────────────────────────────
document.getElementById('onboarding-close')?.addEventListener('click', () => {
  document.getElementById('onboarding-modal').classList.add('hidden');
  localStorage.setItem('jangalai-onboarded', '1');
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────
const PREFS_KEY = 'jangalai-prefs';
function getPrefs() { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
function savePrefs(patch) { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...getPrefs(), ...patch })); }

function applyPrefs() {
  const prefs = getPrefs();
  if (prefs.reduceMotion) document.documentElement.classList.add('reduce-motion');
  else document.documentElement.classList.remove('reduce-motion');
  if (prefs.quizCount)      { const el = document.getElementById('quiz-count'); if (el) el.value = prefs.quizCount; }
  if (prefs.quizDifficulty) { const el = document.getElementById('quiz-difficulty'); if (el) el.value = prefs.quizDifficulty; }
  if (prefs.fcCount)        { const el = document.getElementById('fc-count'); if (el) el.value = prefs.fcCount; }
}
window.__applyPrefs = applyPrefs;

// ── Mindmap — migré vers React (ActionsPanel.jsx handleMindmap) ──────────────
// window.__openMindmap + window.__closeMindmap set by React MindmapModal component

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64) {
  const pad  = '='.repeat((4 - base64.length % 4) % 4);
  const b64  = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw  = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  try {
    const r = await fetch('/api/push/vapid-public-key');
    const d = await r.json();
    if (!d.publicKey) return false;
    const reg  = await navigator.serviceWorker.ready;
    const sub  = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(d.publicKey)
    });
    await fetch('/api/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub })
    });
    localStorage.setItem('jangalai-push', '1');
    return true;
  } catch { return false; }
}

async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      await sub.unsubscribe();
    }
  } catch {}
  localStorage.removeItem('jangalai-push');
}

async function notifyDueCardsIfNeeded() {
  if (localStorage.getItem('jangalai-push') !== '1') return;
  const srsData = JSON.parse(localStorage.getItem(SRS_KEY) || '{}');
  const now = Date.now();
  const dueCount = Object.values(srsData).filter(c => !c.nextReview || c.nextReview <= now).length;
  if (dueCount > 0) {
    fetch('/api/push/notify-due', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueCount })
    });
  }
}

const pushToggle = document.getElementById('pref-push-notif');
if (pushToggle) {
  pushToggle.checked = localStorage.getItem('jangalai-push') === '1';
  pushToggle.addEventListener('change', async () => {
    if (pushToggle.checked) {
      const ok = await subscribeToPush();
      if (!ok) {
        pushToggle.checked = false;
        alert('Notifications refusées ou non disponibles sur ce navigateur.');
      }
    } else {
      await unsubscribeFromPush();
    }
  });
}

// Init — called by React AppPage after mount, or auto-run in vanilla HTML context
async function startApp() {
  const ok = await initAuth();
  if (!ok) return;
  applyPrefs();
  // Navigation gérée par React (activePanel state) — pas besoin de showPanel ni d'écouteurs DOM
  notifyDueCardsIfNeeded();
}

if (!window.__reactApp) {
  startApp();
} else {
  window.startApp = startApp;
}

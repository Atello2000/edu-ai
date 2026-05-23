// ── AUTH ─────────────────────────────────────────────────────────────────────
let currentUser = null;

async function initAuth() {
  if (window.__reactUser) {
    currentUser = window.__reactUser;
    renderUserMenu();
    showOnboarding();
    return true;
  }
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.user) { window.location.href = '/login'; return false; }
    currentUser = data.user;
    renderUserMenu();
    showOnboarding();
    return true;
  } catch {
    window.location.href = '/login';
    return false;
  }
}

function showOnboarding() {
  if (localStorage.getItem('jangalai-onboarded')) return;
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.remove('hidden');
}

function renderUserMenu() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight || !currentUser) return;

  const planLabels = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' };
  const menu = document.createElement('div');
  menu.className = 'user-menu';
  menu.innerHTML = `
    <button class="user-menu-btn" id="user-menu-btn" title="${currentUser.name}">
      <span class="user-avatar">${currentUser.name.charAt(0).toUpperCase()}</span>
      <span class="user-name-short">${currentUser.name.split(' ')[0]}</span>
    </button>
    <div class="user-dropdown" id="user-dropdown">
      <div class="user-info">
        <strong>${currentUser.name}</strong>
        <span>${currentUser.email}</span>
        <span class="user-plan plan-${currentUser.plan}">${planLabels[currentUser.plan] || currentUser.plan}</span>
      </div>
      <hr class="dropdown-sep"/>
      <a href="/profile" class="dropdown-item" style="display:block;text-decoration:none;color:var(--text)">Mon profil</a>
      <button class="dropdown-item" id="logout-btn">Se déconnecter</button>
    </div>`;
  headerRight.prepend(menu);

  document.getElementById('user-menu-btn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('open');
  };
  document.addEventListener('click', () => document.getElementById('user-dropdown')?.classList.remove('open'));
  document.getElementById('logout-btn').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };
}

// ── PANEL NAVIGATION ─────────────────────────────────────────────────────────
const ALL_PANELS = [
  'dashboard-panel','upload-section','actions-section',
  'summary-section','quiz-section','flashcard-section',
  'chat-section','exam-sheet-section',
  'stats-panel','history-panel','folders-panel'
];
const generatedSections = new Set();

function showPanel(id) {
  ALL_PANELS.forEach(pid => {
    const el = document.getElementById(pid);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const backBtn = document.getElementById('back-home-btn');
  if (backBtn) backBtn.classList.toggle('hidden', id === 'dashboard-panel');
  if (id === 'actions-section') refreshActionsAvailability();
  if (id === 'folders-panel') window.__refreshFolders?.();
  refreshFloatNav();
}
// Bridge : React appelle window.__appShowPanel(id) pour naviguer
window.__appShowPanel = showPanel;

function refreshActionsAvailability() {
  // Un fichier est "utilisable" s'il a du texte extrait OU un chemin serveur valide
  const hasFiles = getUploadedFiles().some(f => f.text || f.path);
  const notice = document.getElementById('no-files-notice');
  const fileArea = document.querySelector('#actions-section .file-select-area');
  if (notice) notice.classList.toggle('hidden', hasFiles);
  if (fileArea) fileArea.classList.toggle('hidden', !hasFiles);
  document.querySelectorAll('#actions-section .act-btn:not(#no-files-upload-btn)').forEach(btn => {
    btn.disabled = !hasFiles;
    btn.style.opacity = hasFiles ? '' : '0.4';
    btn.style.cursor = hasFiles ? '' : 'not-allowed';
  });
}

// ── REFS ────────────────────────────────────────────────────────────────────
// NOTE: upload refs removed — Upload migré vers React (UploadZone.jsx)
// NOTE: summary refs removed — Summary migré vers React (SummarySection.jsx)
const uploadedFilesEl = document.getElementById('uploaded-files');
const selectAll       = document.getElementById('select-all');
// Quiz/Flashcards/Chat DOM elements managed by React — no longer referenced here
const loader          = document.getElementById('loader');
const loaderText      = document.getElementById('loader-text');

// uploadedFilesMeta est désormais géré par React (AppPage.jsx).
// app.js lit depuis window.uploadedFilesMeta (syncé par React via useEffect).
function getUploadedFiles() { return window.uploadedFilesMeta || []; }

// __setFolderFiles est défini dans AppPage.jsx (React).
// app.js expose un hook pour que React puisse réinitialiser l'état local (examSheet, etc.)
window.__resetAppState = function() {
  examSheetMd = '';
};

// ── THEME ────────────────────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const html        = document.documentElement;
const savedTheme  = localStorage.getItem('jangalai-theme') || 'light';
html.setAttribute('data-theme', savedTheme);
if (themeToggle) {
  themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  themeToggle.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('jangalai-theme', next);
  });
}

// ── UPLOAD — migré vers React (UploadZone.jsx) ───────────────────────────────
// Les fonctions d'upload (addFiles, renderFileList, uploadBtn.click…) sont
// dans client/src/components/UploadZone.jsx + client/src/hooks/useUpload.js

// renderUploadedFiles : toujours nécessaire pour quiz/flashcards/chat (getSelectedUploadedFiles)
function renderUploadedFiles() {
  if (!uploadedFilesEl) return;
  uploadedFilesEl.innerHTML = '';
  getUploadedFiles().forEach(f => {
    const ext = f.name.split('.').pop().toUpperCase();
    const div = document.createElement('div');
    div.className = 'file-checkbox';
    div.innerHTML = `<input type="checkbox" value="${f.id}" data-name="${f.name}" data-path="${f.path || ''}" checked /><span class="file-ext">${ext}</span><span>${f.name}</span>`;
    uploadedFilesEl.appendChild(div);
  });
}
window.__renderUploadedFiles = renderUploadedFiles;

if (selectAll) {
  selectAll.addEventListener('change', () =>
    uploadedFilesEl?.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = selectAll.checked)
  );
}

function getSelectedUploadedFiles() {
  if (!uploadedFilesEl) return getUploadedFiles();
  const checked = Array.from(uploadedFilesEl.querySelectorAll('input[type=checkbox]:checked'));
  if (!checked.length) return getUploadedFiles();
  return checked.map(c => {
    const meta = getUploadedFiles().find(f => f.id === c.value || f.name === c.dataset.name);
    return { id: c.value, name: c.dataset.name, path: c.dataset.path || '', text: meta?.text || '' };
  });
}
window.__getSelectedFiles = getSelectedUploadedFiles;


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

// ── SUMMARY ──────────────────────────────────────────────────────────────────
const SVG = {
  target:`<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/></svg>`,
  bookmark:`<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M4 2h8a1 1 0 011 1v9.5l-5-3-5 3V3a1 1 0 011-1z"/></svg>`,
  lines:`<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8.5" x2="13" y2="8.5"/><line x1="3" y1="12" x2="9" y2="12"/></svg>`,
  key:`<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="6" cy="7" r="3"/><path d="M9 9.5l4.5 4.5M11.5 11.5l1-1"/></svg>`,
  star:`<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 1.5l1.8 3.65 4.03.59-2.92 2.84.69 4.01L8 10.52l-3.6 1.87.69-4.01L2.17 5.74l4.03-.59z"/></svg>`,
  copy:`<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V3a1 1 0 011-1h8"/></svg>`,
  download:`<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3v7M5.5 8L8 10.5 10.5 8"/><path d="M3 13h10"/></svg>`,
  pdf:`<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="2" width="10" height="12" rx="1.5"/><line x1="6" y1="6" x2="10" y2="6"/><line x1="6" y1="9" x2="10" y2="9"/><line x1="6" y1="12" x2="8" y2="12"/></svg>`,
  speaker:`<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polygon points="2,5 6,5 10,2 10,14 6,11 2,11" fill="currentColor" stroke="none"/><path d="M12 5.5a4 4 0 0 1 0 5"/></svg>`,
  pause:`<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>`,
  resume:`<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><polygon points="3,2 13,8 3,14"/></svg>`,
  stopIcon:`<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>`,
  map:`<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2"/><line x1="8" y1="6" x2="8" y2="2"/><line x1="8" y1="14" x2="8" y2="10"/><line x1="6" y1="8" x2="2" y2="8"/><line x1="14" y1="8" x2="10" y2="8"/><circle cx="8" cy="2" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="2" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>`,
};

let summaryAllResults = [];
let summaryActiveTab  = 0;
// Bridge: React (AppPage) syncs summary results here so mindmap can read them
window._setSummaryResults = r => { summaryAllResults = r; summaryActiveTab = 0; };

// ── Summary DOM handlers removed — React (SummarySection.jsx) owns this now ──
// ── Exam sheet btn state managed by React (ExamSheetSection.jsx) ──────────────

// ── TEXT-TO-SPEECH ───────────────────────────────────────────────────────────
const TTS_SETTINGS_KEY = 'jangalai-tts';
let ttsActiveBtn  = null;
let ttsActiveStop = null;
let ttsKeepAlive  = null;
let ttsVoices     = [];

const ttsBar        = document.getElementById('tts-bar');
const ttsVoiceSel   = document.getElementById('tts-voice-select');
const ttsSpeedEl    = document.getElementById('tts-speed');
const ttsSpeedVal   = document.getElementById('tts-speed-val');

// Charger réglages sauvegardés
const ttsSaved = JSON.parse(localStorage.getItem(TTS_SETTINGS_KEY) || '{}');
if (ttsSaved.rate) { ttsSpeedEl.value = ttsSaved.rate; ttsSpeedVal.textContent = ttsSaved.rate + '×'; }

ttsSpeedEl.addEventListener('input', () => {
  ttsSpeedVal.textContent = ttsSpeedEl.value + '×';
  localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify({ ...ttsSaved, rate: ttsSpeedEl.value, voice: ttsVoiceSel.value }));
  // Appliquer en direct si en cours de lecture (relance)
  if (ttsActiveBtn && ttsActiveBtn.dataset.state === 'speaking') {
    speechSynthesis.cancel();
    setTimeout(() => ttsApply(), 100);
  }
});

ttsVoiceSel.addEventListener('change', () => {
  localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify({ rate: ttsSpeedEl.value, voice: ttsVoiceSel.value }));
});

function loadTTSVoices() {
  ttsVoices = speechSynthesis.getVoices();
  if (!ttsVoices.length) return;
  const saved = JSON.parse(localStorage.getItem(TTS_SETTINGS_KEY) || '{}');
  ttsVoiceSel.innerHTML = '';
  // Voix françaises en premier, puis autres
  const fr = ttsVoices.filter(v => v.lang.startsWith('fr'));
  const others = ttsVoices.filter(v => !v.lang.startsWith('fr'));
  [...fr, ...others].forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.name === saved.voice) opt.selected = true;
    ttsVoiceSel.appendChild(opt);
  });
  // Sélectionner la première voix fr par défaut si rien de sauvegardé
  if (!saved.voice && fr.length) ttsVoiceSel.value = fr[0].name;
}
loadTTSVoices();
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined)
  speechSynthesis.onvoiceschanged = loadTTSVoices;

function getSelectedVoice() {
  return ttsVoices.find(v => v.name === ttsVoiceSel.value) || null;
}

// Preprocessing amélioré pour texte scientifique
function ttsPlainText(summaryMd) {
  const result = [];
  for (const raw of summaryMd.split('\n')) {
    let l = raw.trim();
    if (!l) continue;
    if (/^[-=*_]{3,}$/.test(l)) continue; // séparateurs
    // Retirer structure markdown
    l = l.replace(/^#{1,6}\s*/, '').replace(/^>\s*/, '').replace(/^[-*+]\s*/, '').replace(/^\d+\.\s*/, '');
    // Retirer formatage inline
    l = l.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/`(.+?)`/g,'$1').replace(/\[(.+?)\]\(.+?\)/g,'$1');
    // Symboles scientifiques → mots lisibles
    l = l
      .replace(/°C/g,'degrés Celsius').replace(/°F/g,'degrés Fahrenheit')
      .replace(/≤/g,'inférieur ou égal à').replace(/≥/g,'supérieur ou égal à')
      .replace(/±/g,'plus ou moins').replace(/×/g,'fois')
      .replace(/→/g,'donne').replace(/←/g,'provient de').replace(/↔/g,'est en équilibre avec')
      .replace(/α/g,'alpha').replace(/β/g,'bêta').replace(/γ/g,'gamma')
      .replace(/δ/g,'delta').replace(/λ/g,'lambda').replace(/σ/g,'sigma').replace(/μ/g,'micro')
      .replace(/([A-Za-z])(\d+)/g,'$1 $2') // H2O → H 2 O
      .replace(/(\d+)\s*mg\/kg/gi,'$1 milligrammes par kilogramme')
      .replace(/(\d+)\s*mg\/L/gi,'$1 milligrammes par litre')
      .replace(/(\d+)\s*µg/gi,'$1 microgrammes')
      .replace(/(\d+)\s*mL/gi,'$1 millilitres')
      .replace(/pH/g,'pH');
    // Supprimer emojis et symboles résiduels
    l = l.replace(/[\u{1F000}-\u{1FFFF}]/gu,'').replace(/[🎯📌📖🔑💡✦●▶•◆■□]/g,'')
         .replace(/[^\w\sàâäéèêëîïôùûüçœæ.,;:!?()''\-\/°%+=/]/g,' ')
         .replace(/\s+/g,' ').trim();
    if (l.length > 3) result.push(l);
  }
  return result.join('. ');
}

let _ttsCurrentMd = '';
function ttsApply() {
  if (!_ttsCurrentMd) return;
  const text = ttsPlainText(_ttsCurrentMd);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'fr-FR';
  utter.rate = parseFloat(ttsSpeedEl.value);
  const voice = getSelectedVoice();
  if (voice) utter.voice = voice;
  if (ttsActiveBtn) { ttsActiveBtn.dataset.state = 'speaking'; ttsActiveBtn.innerHTML = `${SVG.pause} Pause`; }
  ttsKeepAlive = setInterval(() => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); }
  }, 9000);
  utter.onend = utter.onerror = () => ttsStop(ttsActiveBtn, ttsActiveStop);
  speechSynthesis.speak(utter);
}

function ttsStop(speakBtn, stopBtn) {
  speechSynthesis.cancel();
  _ttsCurrentMd = '';
  if (ttsKeepAlive) { clearInterval(ttsKeepAlive); ttsKeepAlive = null; }
  if (speakBtn) { speakBtn.innerHTML = `${SVG.speaker} Écouter`; speakBtn.dataset.state = ''; }
  if (stopBtn)  stopBtn.classList.add('hidden');
  ttsActiveBtn  = null;
  ttsActiveStop = null;
}

function ttsToggle(summaryMd, speakBtn, stopBtn) {
  if (typeof speechSynthesis === 'undefined') {
    alert('La synthèse vocale n\'est pas supportée par ce navigateur.');
    return;
  }
  // speakBtn/stopBtn may be null when called from React components
  const state = speakBtn?.dataset?.state || '';
  if (state === 'speaking') {
    speechSynthesis.pause();
    if (speakBtn) { speakBtn.dataset.state = 'paused'; speakBtn.innerHTML = `${SVG.resume} Reprendre`; }
    if (ttsKeepAlive) { clearInterval(ttsKeepAlive); ttsKeepAlive = null; }
    return;
  }
  if (state === 'paused') {
    speechSynthesis.resume();
    if (speakBtn) { speakBtn.dataset.state = 'speaking'; speakBtn.innerHTML = `${SVG.pause} Pause`; }
    ttsKeepAlive = setInterval(() => {
      if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); }
    }, 9000);
    return;
  }
  if (ttsActiveBtn && ttsActiveBtn !== speakBtn) ttsStop(ttsActiveBtn, ttsActiveStop);
  speechSynthesis.cancel();
  loadTTSVoices();
  ttsBar.classList.remove('hidden');
  _ttsCurrentMd = summaryMd;
  ttsActiveBtn  = speakBtn;
  ttsActiveStop = stopBtn;
  if (stopBtn) stopBtn.classList.remove('hidden');
  ttsApply();
}
window.__ttsToggle = ttsToggle;

// ── QUIZ — migré vers React (QuizSection.jsx) ─────────────────────────────────
// exam-mode toggle (still in actions panel DOM — handled by React via state)
document.getElementById('exam-mode-cb')?.addEventListener('change', function() {
  const dur = document.getElementById('exam-duration');
  if (dur) dur.classList.toggle('hidden', !this.checked);
});

// Quiz handlers removed — React (QuizSection.jsx) owns this now

// ── FICHE D'EXAMEN — migrée vers React (ExamSheetSection.jsx) ─────────────────
let examSheetMd = ''; // session restore bridges via window._setExamSheetMd

// ── FLASHCARDS + CHAT — migrés vers React ─────────────────────────────────────
// (FlashcardSection.jsx, ChatSection.jsx)
// ── SESSION HISTORY ──────────────────────────────────────────────────────────
const HISTORY_KEY = 'jangalai-sessions';

function getSessions() { return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); }

function saveSession(update) {
  if (!uploadedFilesMeta.length) return;
  let sessions = getSessions();
  const fileKey = uploadedFilesMeta.map(f=>f.name).sort().join('|');
  let idx = sessions.findIndex(s => s.fileKey === fileKey);
  if (idx === -1) {
    sessions.unshift({
      id: Date.now(), fileKey, timestamp: Date.now(),
      files: uploadedFilesMeta.map(f => f.name),
      filesMeta: uploadedFilesMeta.map(f => ({ name: f.name, text: f.text || '' }))
    });
    idx = 0;
  }
  if (!sessions[idx].filesMeta && uploadedFilesMeta.some(f => f.text)) {
    sessions[idx].filesMeta = uploadedFilesMeta.map(f => ({ name: f.name, text: f.text || '' }));
  }
  Object.assign(sessions[idx], update, { timestamp: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, 10)));
  window.__refreshHistory?.();
  window.__renderDashboard?.();
}

function restoreSession(s) {
  // Rebuild uploadedFilesMeta from saved text so actions work without re-uploading
  if (s.filesMeta && s.filesMeta.length) {
    uploadedFilesMeta = s.filesMeta.map((f, i) => ({
      id: `restored-${i}`, name: f.name, path: '', text: f.text || '', size: 0
    }));
    renderUploadedFiles();
    refreshActionsAvailability();
  }
  let firstPanel = 'actions-section';
  if (s.summaries) {
    // React owns summary display — restore via bridge; also keep local copy for mindmap
    summaryAllResults = s.summaries;
    summaryActiveTab  = 0;
    window._setSummaryData?.(s.summaries);
    generatedSections.add('summary-section');
    firstPanel = 'summary-section';
  }
  if (s.quiz) {
    // React owns quiz — restore via bridge
    window._setQuizData?.(s.quiz);
    generatedSections.add('quiz-section');
    if (firstPanel === 'actions-section') firstPanel = 'quiz-section';
  }
  if (s.flashcards) {
    // React owns flashcards — restore via bridge
    window._setFlashcardsData?.(s.flashcards);
    generatedSections.add('flashcard-section');
    if (firstPanel === 'actions-section') firstPanel = 'flashcard-section';
  }
  if (s.examSheet) {
    // React owns exam sheet — restore via bridge
    examSheetMd = s.examSheet.sheet || '';
    window._setExamSheetMd?.(examSheetMd);
    generatedSections.add('exam-sheet-section');
    if (firstPanel === 'actions-section') firstPanel = 'exam-sheet-section';
  }
  // Summary + exam sheet btn states managed by React
  showPanel(firstPanel);
}
window.__restoreSession = restoreSession;
// ── Bridges pour React (fonctions app.js utilisées par les hooks) ─────────────
window.__saveSession         = saveSession;
window.__fetchQuota          = fetchQuota;
window.__refreshFloatNav     = refreshFloatNav;
// window.__renderDashboard set by React DashboardStats component
window.__saveQuizStat        = saveQuizStat;
window.__addGeneratedSection = id => { generatedSections.add(id); };


// ── MES MATIÈRES (FOLDERS) — rendering handled by FoldersPanel React component ─
let userFolders = [];

async function fetchFolders() {
  try {
    const res = await fetch('/api/folders');
    const data = await res.json();
    userFolders = data.folders || [];
  } catch { userFolders = []; }
}

// ── Save-to-folder modal ─────────────────────────────────────────────────────
const saveFolderModal = document.getElementById('save-folder-modal');
let saveFolderSelectedId = null;

async function showSaveFolderModal() {
  await fetchFolders();
  saveFolderSelectedId = null;
  const list = document.getElementById('save-folder-list');
  if (!userFolders.length) {
    list.innerHTML = '<p style="color:var(--muted);text-align:center;font-size:.78rem;padding:.5rem 0">Aucune matière. Créez-en une ci-dessous.</p>';
  } else {
    list.innerHTML = userFolders.map(f => `
      <div class="save-folder-item" data-id="${f.id}">
        <span class="save-folder-item-icon">${f.icon}</span>
        <span class="save-folder-item-name">${f.name}</span>
        <span class="save-folder-item-check"></span>
      </div>
    `).join('');
    list.querySelectorAll('.save-folder-item').forEach(el => {
      el.addEventListener('click', () => {
        list.querySelectorAll('.save-folder-item').forEach(x => { x.classList.remove('selected'); x.querySelector('.save-folder-item-check').textContent = ''; });
        el.classList.add('selected');
        el.querySelector('.save-folder-item-check').textContent = '✓';
        saveFolderSelectedId = +el.dataset.id;
        saveFilesToFolder(saveFolderSelectedId);
      });
    });
  }
  saveFolderModal.classList.remove('hidden');
}

async function saveFilesToFolder(folderId) {
  try {
    await fetch(`/api/folders/${folderId}/files`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: uploadedFilesMeta.map(f => ({ id: f.id, name: f.name, size: f.size, text: f.text })) })
    });
    saveFolderModal.classList.add('hidden');
    await fetchFolders();
  } catch (err) { alert(err.message); }
}

document.getElementById('save-folder-new-btn')?.addEventListener('click', async () => {
  const input = document.getElementById('save-folder-new-name');
  const name = input.value.trim();
  if (!name) return;
  try {
    const res = await fetch('/api/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    input.value = '';
    await saveFilesToFolder(data.id);
  } catch (err) { alert(err.message); }
});

document.getElementById('save-folder-skip')?.addEventListener('click', () => {
  saveFolderModal.classList.add('hidden');
});

saveFolderModal?.addEventListener('click', (e) => {
  if (e.target === saveFolderModal) saveFolderModal.classList.add('hidden');
});

// ── FLOAT NAV ────────────────────────────────────────────────────────────────
const floatNav     = document.getElementById('float-nav');
const NAV_SECTIONS = ['summary-section','quiz-section','flashcard-section','chat-section','exam-sheet-section'];

function refreshFloatNav() {
  const hasFiles = uploadedFilesMeta && uploadedFilesMeta.length > 0;
  const hasActivity = generatedSections.size > 0 || hasFiles;
  floatNav.classList.toggle('hidden', !hasActivity);

  floatNav.querySelectorAll('.fnav-btn').forEach(btn => {
    const target = btn.dataset.target;
    if (target === 'dashboard-panel') {
      btn.classList.toggle('active', !document.getElementById('dashboard-panel').classList.contains('hidden'));
    } else if (target === 'actions-section') {
      // Visible dès qu'il y a de l'activité (session restaurée ou fichiers chargés)
      btn.classList.toggle('hidden', !hasActivity);
      btn.classList.toggle('active', !document.getElementById('actions-section')?.classList.contains('hidden'));
    } else if (btn.classList.contains('fnav-generated')) {
      btn.classList.toggle('hidden', !generatedSections.has(target));
      btn.classList.toggle('active', !document.getElementById(target)?.classList.contains('hidden'));
    }
  });

  const divider = floatNav.querySelector('.fnav-divider');
  if (divider) divider.classList.toggle('hidden', generatedSections.size === 0);
}

floatNav.querySelectorAll('.fnav-btn').forEach(btn =>
  btn.addEventListener('click', () => showPanel(btn.dataset.target))
);

// ── STATS — rendering handled by StatsPanel React component ──────────────────
const QUIZ_STATS_KEY = 'jangalai-quiz-stats';
const SRS_KEY        = 'jangalai-srs';
function getSRSData() { return JSON.parse(localStorage.getItem(SRS_KEY) || '{}'); }

function saveQuizStat(pct, correct, total) {
  const stats = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '[]');
  stats.unshift({ date: Date.now(), pct, correct, total });
  localStorage.setItem(QUIZ_STATS_KEY, JSON.stringify(stats.slice(0, 50)));
  window.__refreshStats?.();
  window.__renderDashboard?.();  // React DashboardStats component handles re-render
}

document.getElementById('no-files-upload-btn')?.addEventListener('click', () => showPanel('upload-section'));

fetchFolders();

// ── UTILS ────────────────────────────────────────────────────────────────────
function showLoader(text) { loaderText.textContent = text; loader.classList.remove('hidden'); }
function hideLoader()     { loader.classList.add('hidden'); }

// ── QUOTA RESTANT ─────────────────────────────────────────────────────────────
const quotaBar = document.getElementById('quota-bar');

async function fetchQuota() {
  try {
    const res  = await fetch('/api/quota');
    const data = await res.json();
    if (!quotaBar) return;
    if (data.unlimited) { quotaBar.classList.add('hidden'); return; }
    quotaBar.classList.remove('hidden');
    quotaBar.innerHTML = [
      { k:'summarize', label:'Résumés' },
      { k:'quiz',      label:'Quiz' },
      { k:'flashcards',label:'Flashcards' },
      { k:'chat',      label:'Chat' },
    ].map(({ k, label }) => {
      const { used, limit } = data[k];
      const left = limit - used;
      const cls  = left === 0 ? 'quota-empty' : left <= 2 ? 'quota-low' : 'quota-ok';
      return `<span class="quota-item ${cls}">${label} <strong>${left}/${limit}</strong></span>`;
    }).join('');
  } catch {}
}

fetchQuota();

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

// ── MINDMAP ───────────────────────────────────────────────────────────────────
let markmapInstance = null;
const mindmapOverlay    = document.getElementById('mindmap-overlay');
const mindmapSvgEl      = document.getElementById('mindmap-svg');
const mindmapCourseName = document.getElementById('mindmap-course-name');

document.getElementById('mindmap-close').addEventListener('click', closeMindmap);
document.getElementById('mindmap-fit-btn').addEventListener('click', () => markmapInstance?.fit());
mindmapOverlay.addEventListener('click', e => { if (e.target === mindmapOverlay) closeMindmap(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !mindmapOverlay.classList.contains('hidden')) closeMindmap(); });

// ── Mindmap depuis les actions ────────────────────────────────────────────────
document.getElementById('mindmap-action-btn')?.addEventListener('click', async () => {
  const files = getSelectedUploadedFiles();
  if (!files.length) return alert('Sélectionnez au moins un fichier.');

  // Si un résumé est déjà disponible, l'utiliser directement
  if (summaryAllResults.length > 0) {
    const r = summaryAllResults[summaryActiveTab] || summaryAllResults[0];
    openMindmap(r.name, r.summary);
    return;
  }

  // Sinon, générer un résumé d'abord puis ouvrir le mindmap
  showLoader('Génération du mindmap…');
  try {
    const res = await fetch('/api/summarize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, lang: getPrefs().lang || 'fr' })
    });
    if (!res.ok) throw new Error('Erreur serveur');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const partials = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        let data; try { data = JSON.parse(part.slice(6)); } catch { continue; }
        if (data.type === 'start')  { partials[data.name] = { text: '' }; }
        if (data.type === 'delta')  { partials[data.name].text += data.text; }
        if (data.type === 'done')   { summaryAllResults.push({ name: data.name, summary: partials[data.name].text }); }
        if (data.type === 'error')  { throw new Error(data.message); }
      }
    }
    if (summaryAllResults.length > 0) {
      const r = summaryAllResults[0];
      openMindmap(r.name, r.summary);
    }
  } catch (err) { alert('Erreur : ' + err.message); }
  finally { hideLoader(); }
});

function closeMindmap() {
  mindmapOverlay.classList.add('hidden');
  mindmapSvgEl.innerHTML = '';
  markmapInstance = null;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = Object.assign(document.createElement('script'), { src, onload: res, onerror: rej });
    document.head.appendChild(s);
  });
}

async function openMindmap(courseName, markdown) {
  mindmapCourseName.textContent = courseName;
  mindmapOverlay.classList.remove('hidden');
  mindmapSvgEl.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    fill="var(--muted)" font-family="Outfit,sans-serif" font-size="14">Génération de la carte…</text>`;

  try {
    await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/markmap-lib@0.15/dist/browser/index.js');
    await loadScript('https://cdn.jsdelivr.net/npm/markmap-view@0.15/dist/browser/index.js');
  } catch {
    mindmapSvgEl.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      fill="var(--rose)" font-family="Outfit,sans-serif" font-size="14">Erreur de chargement de la bibliothèque</text>`;
    return;
  }

  const base = courseName.replace(/\.[^.]+$/, '');
  const md   = `# ${base}\n\n${markdown}`;
  const { Transformer, Markmap } = window.markmap;
  const transformer = new Transformer();
  const { root }    = transformer.transform(md);

  mindmapSvgEl.innerHTML = '';
  markmapInstance = Markmap.create(mindmapSvgEl, { paddingX: 16, duration: 300 }, root);
  markmapInstance.fit();
}

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
  showPanel('dashboard-panel');
  notifyDueCardsIfNeeded();
  document.getElementById('back-home-btn').addEventListener('click', () => showPanel('dashboard-panel'));
  document.getElementById('header-logo').addEventListener('click', () => showPanel('dashboard-panel'));
}

if (!window.__reactApp) {
  startApp();
} else {
  window.startApp = startApp;
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
let currentUser = null;

async function initAuth() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.user) { window.location.href = '/login.html'; return false; }
    currentUser = data.user;
    renderUserMenu();
    applyPlanRestrictions();
    showOnboarding();
    return true;
  } catch {
    window.location.href = '/login.html';
    return false;
  }
}

function applyPlanRestrictions() {
  // Bibliothèque : cacher le bouton dashboard en prod
  if (!isLocal) {
    document.getElementById('dash-library-btn')?.classList.add('hidden');
  }
}

function showOnboarding() {
  if (localStorage.getItem('edu-ai-onboarded')) return;
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
      <a href="/profile.html" class="dropdown-item" style="display:block;text-decoration:none;color:var(--text)">Mon profil</a>
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
    window.location.href = '/login.html';
  };
}

// ── PANEL NAVIGATION ─────────────────────────────────────────────────────────
const ALL_PANELS = [
  'dashboard-panel','upload-section','actions-section',
  'summary-section','quiz-section','flashcard-section',
  'chat-section','exam-sheet-section',
  'stats-panel','history-panel','library-panel'
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
  refreshFloatNav();
}

function refreshActionsAvailability() {
  const hasFiles = uploadedFilesMeta && uploadedFilesMeta.length > 0;
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
const fileInput       = document.getElementById('file-input');
const dropZone        = document.getElementById('drop-zone');
const fileListEl      = document.getElementById('file-list');
const uploadBtn       = document.getElementById('upload-btn');
const actionsSection  = document.getElementById('actions-section');
const uploadedFilesEl = document.getElementById('uploaded-files');
const selectAll       = document.getElementById('select-all');
const summarizeBtn    = document.getElementById('summarize-btn');
const quizBtn         = document.getElementById('quiz-btn');
const quizCount       = document.getElementById('quiz-count');
const summarySection  = document.getElementById('summary-section');
const summaryResults  = document.getElementById('summary-results');
const quizSection     = document.getElementById('quiz-section');
const quizContainer   = document.getElementById('quiz-container');
const submitQuiz      = document.getElementById('submit-quiz');
const quizFooter      = document.getElementById('quiz-footer');
const quizScore       = document.getElementById('quiz-score');
const quizProgressInfo= document.getElementById('quiz-progress-info');
const loader          = document.getElementById('loader');
const loaderText      = document.getElementById('loader-text');
const copyAllBtn      = document.getElementById('copy-all-btn');
const summaryTabs     = document.getElementById('summary-tabs');

let selectedFiles    = [];
let uploadedFilesMeta = [];

// ── THEME ────────────────────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const html        = document.documentElement;
const savedTheme  = localStorage.getItem('edu-ai-theme') || 'dark';
html.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
themeToggle.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('edu-ai-theme', next);
});

// ── UPLOAD ───────────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files));
});
dropZone.addEventListener('click', e => {
  if (e.target === fileInput) return;
  if (e.target.classList.contains('dz-btn') || e.target.htmlFor === 'file-input') return;
  fileInput.click();
});
fileInput.addEventListener('change', () => addFiles(Array.from(fileInput.files)));

function addFiles(files) {
  files.forEach(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf','ppt','pptx','docx'].includes(ext)) return;
    if (!selectedFiles.find(x => x.name === f.name)) selectedFiles.push(f);
  });
  renderFileList();
}

function renderFileList() {
  fileListEl.innerHTML = '';
  selectedFiles.forEach((f, i) => {
    const ext  = f.name.split('.').pop().toUpperCase();
    const size = f.size > 1024*1024 ? (f.size/1024/1024).toFixed(1)+' Mo' : (f.size/1024).toFixed(0)+' Ko';
    const div  = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `<div class="file-item-left"><span class="file-ext">${ext}</span><span>${f.name}</span><span class="file-size">${size}</span></div><span class="remove" data-i="${i}">✕</span>`;
    fileListEl.appendChild(div);
  });
  fileListEl.querySelectorAll('.remove').forEach(btn =>
    btn.addEventListener('click', e => { selectedFiles.splice(+e.target.dataset.i, 1); renderFileList(); })
  );
  uploadBtn.disabled = selectedFiles.length === 0;
}

uploadBtn.addEventListener('click', async () => {
  showLoader('Chargement des fichiers...');
  const formData = new FormData();
  selectedFiles.forEach(f => formData.append('files', f));
  try {
    const res  = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    uploadedFilesMeta = data.files;
    renderUploadedFiles();
    showPanel('actions-section');
  } catch (err) { alert('Erreur : ' + err.message); }
  finally { hideLoader(); }
});

function renderUploadedFiles() {
  uploadedFilesEl.innerHTML = '';
  uploadedFilesMeta.forEach(f => {
    const ext = f.name.split('.').pop().toUpperCase();
    const div = document.createElement('div');
    div.className = 'file-checkbox';
    div.innerHTML = `<input type="checkbox" value="${f.id}" data-name="${f.name}" data-path="${f.path}" checked /><span class="file-ext">${ext}</span><span>${f.name}</span>`;
    uploadedFilesEl.appendChild(div);
  });
}

selectAll.addEventListener('change', () =>
  uploadedFilesEl.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = selectAll.checked)
);

function getSelectedUploadedFiles() {
  const uploaded = Array.from(uploadedFilesEl.querySelectorAll('input[type=checkbox]:checked'))
    .map(c => {
      const meta = uploadedFilesMeta.find(f => f.id === c.value || f.name === c.dataset.name);
      return { id: c.value, name: c.dataset.name, path: c.dataset.path || '', text: meta?.text || '' };
    });
  const library = [];
  libAllSections.forEach(section => section.subjects.forEach(subject =>
    subject.files.forEach(f => { if (libSelectedIds.has(f.id)) library.push(f); })
  ));
  return [...library, ...uploaded];
}

// ── BIBLIOTHÈQUE ─────────────────────────────────────────────────────────────
const libPanel        = document.getElementById('library-panel');
const libSubjects     = document.getElementById('library-subjects');
const libCount        = document.getElementById('lib-count');
const libSelectionBar = document.getElementById('lib-selection-bar');
const libSelectionLbl = document.getElementById('lib-selection-label');
const libGoBtn        = document.getElementById('lib-go-btn');
const libSearch       = document.getElementById('library-search');
const libClearSearch  = document.getElementById('library-clear-search');
let libAllSections    = [];
let libSelectedIds    = new Set();

const SECTION_ICONS = {
  'pharmacie': '💊', 'sciences islamiques': '🕌', 'biologie': '🧬',
  'chimie': '⚗️', 'physique': '⚡', 'mathématiques': '📐', 'informatique': '💻',
};
const SUBJECT_ICONS = {
  'métrologie': '📐', 'qualité microbiologique': '🔬', 'microbiologie': '🔬',
  'arabe': '🌙', 'nahw': '✍️', 'tajwid': '🎵',
  'fiqh': '⚖️', 'usul': '🏛️',
  'tafsir': '📿', 'coran': '📿',
  'hadith': '📜', 'sira': '🕌',
  'aqida': '☪️',
  'pharmacologie': '💉', 'chimie': '⚗️', 'biochimie': '🧪',
};
function sectionIcon(name) {
  const k = name.toLowerCase();
  return Object.entries(SECTION_ICONS).find(([key]) => k.includes(key))?.[1] || '🗂️';
}
function subjectIcon(name) {
  const k = name.toLowerCase();
  return Object.entries(SUBJECT_ICONS).find(([key]) => k.includes(key))?.[1] || '📚';
}

function normalizeSearch(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildSubjectEl(subject) {
  const sec = document.createElement('div');
  sec.className = 'lib-subject';
  sec.innerHTML = `
    <div class="lib-subject-header">
      <span class="lib-subject-icon">${subjectIcon(subject.name)}</span>
      ${subject.name}
      <span class="lib-subject-count">${subject.files.length} fichier${subject.files.length>1?'s':''}</span>
    </div>
    <div class="lib-files"></div>`;
  const filesEl = sec.querySelector('.lib-files');
  subject.files.forEach(f => {
    const ext = f.name.split('.').pop().toUpperCase();
    const row = document.createElement('label');
    row.className = 'lib-file';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = f.id;
    cb.checked = libSelectedIds.has(f.id);
    cb.dataset.name = f.name; cb.dataset.path = f.path;
    cb.addEventListener('change', onLibraryChange);
    const extSpan  = document.createElement('span');
    extSpan.className = 'file-ext'; extSpan.textContent = ext;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'lib-file-name'; nameSpan.textContent = f.name;
    row.append(cb, extSpan, nameSpan);
    filesEl.appendChild(row);
  });
  return sec;
}

async function loadLibrary() {
  try {
    const res  = await fetch('/api/library');
    const data = await res.json();
    libAllSections = data.sections || [];
    renderLibrary();
  } catch(e) { console.warn('Library load failed', e); }
}

function renderLibrary() {
  libSubjects.innerHTML = '';
  const query = normalizeSearch(libSearch?.value || '');
  const filteredSections = libAllSections.map(section => {
    const sectionMatch = normalizeSearch(section.name).includes(query);
    const subjects = section.subjects.map(subject => {
      const subjectMatch = normalizeSearch(subject.name).includes(query);
      const files = subject.files.filter(f =>
        !query ||
        sectionMatch ||
        subjectMatch ||
        normalizeSearch(f.name).includes(query)
      );
      return { ...subject, files };
    }).filter(subject => subject.files.length);
    return { ...section, subjects };
  }).filter(section => section.subjects.length);

  const total = libAllSections.reduce((a, s) =>
      a + s.subjects.reduce((b, m) => b + m.files.length, 0), 0);
  const shown = filteredSections.reduce((a, s) =>
    a + s.subjects.reduce((b, m) => b + m.files.length, 0), 0);

  if (!total) {
    libSubjects.innerHTML = `<div class="lib-empty">Aucun cours dans la bibliothèque.<br>Déposez vos fichiers dans <code>courses/Section/Matière/</code></div>`;
    libCount.textContent = '0 cours';
    libPanel.classList.remove('hidden');
    renderDashboard();
    return;
  }

  libCount.textContent = query ? `${shown}/${total} cours` : `${total} cours`;
  if (query && !shown) {
    libSubjects.innerHTML = `<div class="lib-empty">Aucun cours ne correspond à “${libSearch.value}”.</div>`;
    libPanel.classList.remove('hidden');
    renderDashboard();
    return;
  }

  filteredSections.forEach(section => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'lib-section';
    const sFileCount = section.subjects.reduce((a, m) => a + m.files.length, 0);
    sectionEl.innerHTML = `
      <div class="lib-section-header">
        <span class="lib-section-icon">${sectionIcon(section.name)}</span>
        <span class="lib-section-name">${section.name}</span>
        <span class="lib-subject-count">${sFileCount} fichier${sFileCount>1?'s':''}</span>
      </div>`;
    const subjectsEl = document.createElement('div');
    subjectsEl.className = 'lib-section-subjects';
    section.subjects.forEach(subject => subjectsEl.appendChild(buildSubjectEl(subject)));
    sectionEl.appendChild(subjectsEl);
    libSubjects.appendChild(sectionEl);
  });

  onLibraryChange();
  libPanel.classList.remove('hidden');
  renderDashboard();
}

function onLibraryChange() {
  libSubjects.querySelectorAll('input[type=checkbox]').forEach(cb => {
    if (cb.checked) libSelectedIds.add(cb.value);
    else libSelectedIds.delete(cb.value);
  });
  const checked = libSelectedIds.size;
  libSelectionBar.classList.toggle('hidden', checked === 0);
  libSelectionLbl.textContent = `${checked} cours sélectionné${checked>1?'s':''}`;
  // Afficher la section d'actions dès qu'un fichier est coché
  if (checked > 0) {
    showPanel('actions-section');
  }
}

libGoBtn.addEventListener('click', () => showPanel('actions-section'));

libSearch?.addEventListener('input', renderLibrary);
libClearSearch?.addEventListener('click', () => {
  libSearch.value = '';
  renderLibrary();
  libSearch.focus();
});

const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (isLocal) loadLibrary();
else libPanel.classList.add('hidden');

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

const SECTION_CONFIG = [
  { match: /objectif/i,     icon: SVG.target,   cls: 'section-objectifs' },
  { match: /points?\s*cl/i, icon: SVG.bookmark, cls: 'section-points'    },
  { match: /r[eé]sum[eé]/i, icon: SVG.lines,    cls: 'section-resume'    },
  { match: /concept/i,      icon: SVG.key,      cls: 'section-concepts'  },
  { match: /retenir/i,      icon: SVG.star,     cls: 'section-retenir'   },
];

function buildSummarySections(md) {
  const sections = []; let current = null;
  for (const line of md.split('\n')) {
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) {
      if (current) sections.push(current);
      const title = h2[1].trim();
      const cfg = SECTION_CONFIG.find(c => c.match.test(title)) || { icon: '📄', cls: 'section-autre' };
      current = { title, icon: cfg.icon, cls: cfg.cls, lines: [] };
    } else if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections;
}

function renderSummaryItem(r) {
  const ext      = r.name.split('.').pop().toUpperCase();
  const baseName = r.name.replace(/\.[^.]+$/, '');
  const sections = buildSummarySections(r.summary);
  const encoded  = encodeURIComponent(r.summary);

  const item = document.createElement('div');
  item.className = 'summary-item';

  // Accent bar + header
  const accentBar = document.createElement('div');
  accentBar.className = 'summary-item-accent';

  const header = document.createElement('div');
  header.className = 'summary-file-header';
  header.innerHTML = `
    <div class="summary-file-header-left">
      <div class="summary-file-icon"><span class="file-ext">${ext}</span></div>
      <div class="summary-file-info">
        <strong title="${r.name}">${r.name}</strong>
        <div class="summary-file-meta">${sections.length} section${sections.length>1?'s':''} · Résumé IA</div>
      </div>
    </div>
    <div class="summary-file-actions">
      <button class="summary-action-btn speak-btn">${SVG.speaker} Écouter</button>
      <button class="summary-action-btn stop-btn hidden">${SVG.stopIcon} Stop</button>
      <button class="summary-action-btn copy-btn" data-text="${encoded}">${SVG.copy} Copier</button>
      <button class="summary-action-btn download-btn" data-name="${r.name}" data-text="${encoded}">${SVG.download} TXT</button>
      <button class="summary-action-btn pdf pdf-btn" data-name="${r.name}">${SVG.pdf} PDF</button>
      <button class="summary-action-btn mindmap-btn">${SVG.map} Mindmap</button>
    </div>`;

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'summary-toolbar';
  toolbar.innerHTML = `
    <span class="summary-toolbar-left">${sections.length} sections</span>
    <button class="summary-expand-btn">Tout réduire</button>`;

  // Sections
  const sectionsEl = document.createElement('div');
  sectionsEl.className = 'summary-sections';

  if (!sections.length) {
    const fb = document.createElement('div');
    fb.className = 'summary-section section-autre';
    fb.innerHTML = `<div class="summary-section-body">${marked.parse(r.summary)}</div>`;
    sectionsEl.appendChild(fb);
  } else {
    sections.forEach(s => {
      const sec = document.createElement('div');
      sec.className = `summary-section ${s.cls}`;
      sec.innerHTML = `
        <div class="summary-section-header">
          <span class="section-icon">${s.icon}</span>
          <span class="section-title">${s.title}</span>
          <span class="section-chevron">▼</span>
        </div>
        <div class="summary-section-body">${marked.parse(s.lines.join('\n').trim())}</div>`;
      sec.querySelector('.summary-section-header').addEventListener('click', () => {
        sec.classList.toggle('collapsed');
        updateExpandBtn(expandBtn, sectionsEl);
      });
      sectionsEl.appendChild(sec);
    });
  }

  // Expand/collapse all
  const expandBtn = toolbar.querySelector('.summary-expand-btn');
  expandBtn.addEventListener('click', () => {
    const allCollapsed = [...sectionsEl.querySelectorAll('.summary-section')].every(s => s.classList.contains('collapsed'));
    sectionsEl.querySelectorAll('.summary-section').forEach(s =>
      s.classList.toggle('collapsed', !allCollapsed)
    );
    updateExpandBtn(expandBtn, sectionsEl);
  });

  item.append(accentBar, header, toolbar, sectionsEl);

  // Events
  const speakBtn = item.querySelector('.speak-btn');
  const stopBtn2 = item.querySelector('.stop-btn');
  speakBtn.addEventListener('click', () => ttsToggle(r.summary, speakBtn, stopBtn2));
  stopBtn2.addEventListener('click', () => ttsStop(speakBtn, stopBtn2));

  item.querySelector('.copy-btn').addEventListener('click', btn => {
    const b = btn.currentTarget;
    navigator.clipboard.writeText(decodeURIComponent(b.dataset.text)).then(() => {
      b.innerHTML = `${SVG.copy} Copié ✓`; setTimeout(() => { b.innerHTML = `${SVG.copy} Copier`; }, 2000);
    });
  });
  item.querySelector('.download-btn').addEventListener('click', btn => {
    const b = btn.currentTarget;
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([decodeURIComponent(b.dataset.text)], { type:'text/plain' })),
      download: baseName + '_résumé.txt'
    });
    a.click();
  });
  item.querySelector('.pdf-btn').addEventListener('click', () =>
    exportSummaryToPDF(baseName, r.summary, sectionsEl)
  );
  item.querySelector('.mindmap-btn').addEventListener('click', () =>
    openMindmap(r.name, r.summary)
  );
  return item;
}

function updateExpandBtn(btn, sectionsEl) {
  const allCollapsed = [...sectionsEl.querySelectorAll('.summary-section')].every(s => s.classList.contains('collapsed'));
  btn.textContent = allCollapsed ? 'Tout développer' : 'Tout réduire';
}

// Strip ALL markdown syntax pour le PDF
function stripMd(text) {
  return text
    .replace(/^#{1,6}\s*/,'')
    .replace(/^>\s*/,'')
    .replace(/^[-*+]\s*/,'')
    .replace(/^\d+\.\s*/,'')
    .replace(/\*\*(.+?)\*\*/g,'$1')
    .replace(/\*(.+?)\*/g,'$1')
    .replace(/__(.+?)__/g,'$1')
    .replace(/_(.+?)_/g,'$1')
    .replace(/`(.+?)`/g,'$1')
    .replace(/\[(.+?)\]\(.+?\)/g,'$1')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu,'')
    .replace(/[🎯📌📖🔑💡✦●▶→•◆■□▪]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

async function exportSummaryToPDF(fileName, summaryMd, sectionsEl) {
  const btn  = sectionsEl.closest('.summary-item').querySelector('.pdf-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = '⏳…'; btn.disabled = true;
  try {
    const { jsPDF } = window.jspdf;
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const PW = pdf.internal.pageSize.getWidth();   // 210 mm
    const PH = pdf.internal.pageSize.getHeight();  // 297 mm
    const ML = 14, MR = 14;
    const CW = PW - ML - MR;                       // ~182 mm
    const LH = 5.5;                                // line height in mm

    // Color palette [r,g,b]
    const C = {
      dark:   [15,  21,  36 ], text:  [26,  32,  53 ],
      muted:  [100, 116, 139], border:[221, 227, 240],
      bg:     [244, 246, 251], white: [255, 255, 255],
      blue:   [61,  126, 255], purple:[167, 139, 250],
      teal:   [29,  209, 161], emerald:[52, 211, 153],
      gold:   [212, 169, 76 ],
    };

    const SEC_COL = {
      'section-objectifs': C.blue,
      'section-points':    C.purple,
      'section-resume':    C.emerald,
      'section-concepts':  C.gold,
      'section-retenir':   C.teal,
    };

    let y = 0, pageNum = 1;

    const setRgb  = c => pdf.setTextColor(c[0], c[1], c[2]);
    const setFill = c => pdf.setFillColor(c[0], c[1], c[2]);
    const setDraw = c => pdf.setDrawColor(c[0], c[1], c[2]);
    const fillRect = (x, yy, w, h, c) => { setFill(c); pdf.rect(x, yy, w, h, 'F'); };
    const hline = (x1, yy, x2, c, lw=0.3) => { setDraw(c); pdf.setLineWidth(lw); pdf.line(x1, yy, x2, yy); };
    const wrap  = (text, maxW) => pdf.splitTextToSize(String(text), maxW);

    function tint(col) {   // mix color with bg at 10%
      return [
        Math.round(col[0]*0.1 + C.bg[0]*0.9),
        Math.round(col[1]*0.1 + C.bg[1]*0.9),
        Math.round(col[2]*0.1 + C.bg[2]*0.9),
      ];
    }

    // ── page header ──────────────────────────────────────────────────
    function drawHeader(isFirst) {
      const bandH = isFirst ? 40 : 13;
      fillRect(0, 0, PW, bandH, C.dark);

      // 3-segment accent bar
      const seg = PW / 3;
      fillRect(0,     bandH, seg, 1.5, C.blue);
      fillRect(seg,   bandH, seg, 1.5, C.purple);
      fillRect(seg*2, bandH, seg, 1.5, C.teal);

      if (isFirst) {
        pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5);
        setRgb([167,139,250]);
        pdf.text('EDU AI', ML, 11, { charSpace:2.5 });

        pdf.setFont('helvetica','bold'); pdf.setFontSize(15);
        setRgb([232,236,246]);
        pdf.text(wrap(baseName, CW), ML, 24);

        pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
        setRgb([168,184,208]);
        const d = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
        pdf.text(d + '  ·  Résumé généré par EDU AI', ML, 36);
      } else {
        pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
        setRgb([200,210,230]);
        pdf.text(baseName, ML, 9);
      }

      y = bandH + 1.5 + 7;
    }

    // ── page footer ──────────────────────────────────────────────────
    function drawFooter() {
      hline(ML, PH-11, PW-MR, C.border);
      pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
      setRgb(C.muted);
      pdf.text('EDU AI', ML, PH-6.5);
      pdf.text(`Page ${pageNum}`, PW-MR, PH-6.5, { align:'right' });
    }

    function newPage() {
      drawFooter();
      pdf.addPage(); pageNum++;
      drawHeader(false);
    }

    function need(h) { if (y + h > PH - 16) newPage(); }

    // ── render one section ───────────────────────────────────────────
    function renderSection(section) {
      const col  = SEC_COL[section.cls] || C.muted;
      const PL   = ML + 5;
      const bodW = CW - 5;

      // section header row
      need(12);
      fillRect(ML, y, CW, 11, tint(col));
      fillRect(ML, y,  3, 11, col);
      const cleanTitle = section.title.replace(/[^\x00-\x7E]/g,'').trim();
      pdf.setFont('helvetica','bold'); pdf.setFontSize(9.5);
      setRgb(col);
      pdf.text(cleanTitle, ML+6, y+7.5);
      hline(ML, y+11, ML+CW, C.border);
      y += 11 + 4;

      // section body lines
      for (const raw of section.lines) {
        const line = raw.trimEnd();
        if (!line) { y += 2; continue; }

        // blockquote
        if (line.startsWith('> ')) {
          const text = stripMd(line.slice(2));
          const lines = wrap(text, bodW - 8);
          const bH = lines.length * LH + 5;
          need(bH + 4);
          fillRect(PL, y, bodW, bH, [235,252,248]);
          fillRect(PL, y, 2.5, bH, C.teal);
          pdf.setFont('helvetica','italic'); pdf.setFontSize(9);
          setRgb(C.text);
          pdf.text(lines, PL+5, y+LH);
          y += bH + 5;
          continue;
        }

        // sub-heading (h1-h6)
        if (/^#{1,6}\s/.test(line)) {
          const text = stripMd(line);
          need(12);
          pdf.setFont('helvetica','bold'); pdf.setFontSize(9.5);
          setRgb(C.text);
          pdf.text(text, PL, y+LH);
          hline(PL, y+LH+2, PL+bodW, C.border);
          y += 12;
          continue;
        }

        // bullet (-, *, +) ou liste numérotée
        if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
          const text = stripMd(line);
          const lines = wrap(text, bodW - 7);
          need(lines.length * LH + 2);
          setFill(col); pdf.circle(PL+1.5, y+LH-1.2, 1, 'F');
          pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5);
          setRgb(C.text);
          pdf.text(lines, PL+5, y+LH);
          y += lines.length * LH + 1.5;
          continue;
        }

        // paragraph
        const text = stripMd(line);
        if (!text) continue;
        const lines = wrap(text, bodW);
        need(lines.length * LH + 2);
        pdf.setFont('helvetica','normal'); pdf.setFontSize(9.5);
        setRgb(C.text);
        pdf.text(lines, PL, y+LH);
        y += lines.length * LH + 2;
      }

      y += 7; // gap between sections
    }

    // ── render ───────────────────────────────────────────────────────
    drawHeader(true);
    buildSummarySections(summaryMd).forEach(renderSection);
    drawFooter();

    pdf.save(baseName + '_résumé.pdf');
  } finally { btn.innerHTML = orig; btn.disabled = false; }
}

let summaryAllResults = [];
let summaryActiveTab  = 0;

function buildSummaryTabs() {
  summaryTabs.innerHTML = '';
  if (summaryAllResults.length <= 1) { summaryTabs.classList.add('hidden'); return; }
  summaryTabs.classList.remove('hidden');
  summaryAllResults.forEach((r, i) => {
    const btn = document.createElement('button');
    btn.className = 'summary-tab' + (i === summaryActiveTab ? ' active' : '');
    btn.textContent = r.name.replace(/\.[^.]+$/, '');
    btn.title = r.name;
    btn.addEventListener('click', () => switchSummaryTab(i));
    summaryTabs.appendChild(btn);
  });
}

function switchSummaryTab(idx) {
  summaryActiveTab = idx;
  summaryTabs.querySelectorAll('.summary-tab').forEach((btn, i) =>
    btn.classList.toggle('active', i === idx)
  );
  summaryResults.querySelectorAll('.summary-item').forEach((el, i) =>
    el.classList.toggle('hidden', i !== idx)
  );
}

summarizeBtn.addEventListener('click', async () => {
  const files = getSelectedUploadedFiles();
  if (!files.length) return alert('Sélectionnez au moins un fichier.');
  summarySection.classList.add('hidden');
  summaryResults.innerHTML = '';
  summaryTabs.innerHTML = '';
  summaryTabs.classList.add('hidden');
  summaryAllResults = [];
  summaryActiveTab  = 0;
  showLoader('Connexion…');

  try {
    const res = await fetch('/api/summarize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, lang: getPrefs().lang || 'fr' })
    });
    if (!res.ok) throw new Error('Erreur serveur');
    hideLoader();
    generatedSections.add('summary-section');
    showPanel('summary-section');

    const reader  = res.body.getReader();
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

        if (data.type === 'start') {
          const el = createStreamingItem(data.name);
          summaryResults.appendChild(el);
          partials[data.name] = { text: '', el };
        } else if (data.type === 'delta') {
          partials[data.name].text += data.text;
          updateStreamingItem(partials[data.name].el, partials[data.name].text);
        } else if (data.type === 'done') {
          const full = partials[data.name].text;
          summaryAllResults.push({ name: data.name, summary: full });
          const rendered = renderSummaryItem({ name: data.name, summary: full });
          partials[data.name].el.replaceWith(rendered);
          buildSummaryTabs();
          // Keep only the active tab visible
          summaryResults.querySelectorAll('.summary-item').forEach((el, i) =>
            el.classList.toggle('hidden', summaryAllResults.length > 1 && i !== summaryActiveTab)
          );
        } else if (data.type === 'model') {
          setModelBadge('summary-section', data.name);
        } else if (data.type === 'end') {
          saveSession({ summaries: summaryAllResults });
          fetchQuota();
        } else if (data.type === 'error') {
          throw new Error(data.message);
        }
      }
    }
  } catch (err) { alert('Erreur : ' + err.message); }
  finally { hideLoader(); }
});

function createStreamingItem(name) {
  const ext = name.split('.').pop().toUpperCase();
  const el = document.createElement('div');
  el.className = 'summary-item';
  el.innerHTML = `
    <div class="summary-file-header">
      <div class="summary-file-header-left">
        <span class="file-ext">${ext}</span>
        <strong>${name}</strong>
      </div>
      <span class="streaming-badge">✦ Génération en cours…</span>
    </div>
    <div class="summary-stream-body"></div>`;
  return el;
}

function updateStreamingItem(el, text) {
  const body = el.querySelector('.summary-stream-body');
  if (!body) return;

  const sections = buildSummarySections(text);
  if (!sections.length) { body.innerHTML = marked.parse(text); return; }

  const committed = parseInt(body.dataset.committed || '0');

  // Ajouter les sections terminées (toutes sauf la dernière) une seule fois
  for (let i = committed; i < sections.length - 1; i++) {
    const s = sections[i];
    const sec = document.createElement('div');
    sec.className = `summary-section ${s.cls}`;
    sec.innerHTML = `
      <div class="summary-section-header">
        <span class="section-icon">${s.icon}</span>
        <span class="section-title">${s.title}</span>
        <span class="section-chevron">▼</span>
      </div>
      <div class="summary-section-body">${marked.parse(s.lines.join('\n').trim())}</div>`;
    sec.querySelector('.summary-section-header').addEventListener('click', () => sec.classList.toggle('collapsed'));
    body.appendChild(sec);
  }
  body.dataset.committed = sections.length - 1;

  // Mettre à jour uniquement la section en cours (dernière)
  const last = sections[sections.length - 1];
  let lastEl = body.querySelector('.streaming-section');
  if (!lastEl) {
    lastEl = document.createElement('div');
    lastEl.className = `summary-section ${last.cls} streaming-section`;
    body.appendChild(lastEl);
  } else {
    lastEl.className = `summary-section ${last.cls} streaming-section`;
  }
  lastEl.innerHTML = `
    <div class="summary-section-header">
      <span class="section-icon">${last.icon}</span>
      <span class="section-title">${last.title}</span>
      <span class="streaming-badge">✦</span>
    </div>
    <div class="summary-section-body">${marked.parse(last.lines.join('\n').trim())}</div>`;
}

copyAllBtn.addEventListener('click', () => {
  const parts = Array.from(summaryResults.querySelectorAll('.download-btn'))
    .map(btn => `=== ${btn.dataset.name} ===\n\n${decodeURIComponent(btn.dataset.text)}`);
  navigator.clipboard.writeText(parts.join('\n\n---\n\n')).then(() => {
    copyAllBtn.textContent = 'Copié ✓'; setTimeout(() => copyAllBtn.textContent = 'Copier tout', 2000);
  });
});

// ── TEXT-TO-SPEECH ───────────────────────────────────────────────────────────
const TTS_SETTINGS_KEY = 'edu-ai-tts';
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
  if (!_ttsCurrentMd || !ttsActiveBtn) return;
  const text = ttsPlainText(_ttsCurrentMd);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'fr-FR';
  utter.rate = parseFloat(ttsSpeedEl.value);
  const voice = getSelectedVoice();
  if (voice) utter.voice = voice;
  ttsActiveBtn.dataset.state = 'speaking';
  ttsActiveBtn.innerHTML = `${SVG.pause} Pause`;
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
  const state = speakBtn.dataset.state || '';
  if (state === 'speaking') {
    speechSynthesis.pause();
    speakBtn.dataset.state = 'paused';
    speakBtn.innerHTML = `${SVG.resume} Reprendre`;
    if (ttsKeepAlive) { clearInterval(ttsKeepAlive); ttsKeepAlive = null; }
    return;
  }
  if (state === 'paused') {
    speechSynthesis.resume();
    speakBtn.dataset.state = 'speaking';
    speakBtn.innerHTML = `${SVG.pause} Pause`;
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
  stopBtn.classList.remove('hidden');
  ttsApply();
}

// ── QUIZ ─────────────────────────────────────────────────────────────────────
const quizStepHeader  = document.getElementById('quiz-step-header');
const quizStepFill    = document.getElementById('quiz-step-fill');
const quizStepLabel   = document.getElementById('quiz-step-label');
const quizPrevBtn     = document.getElementById('quiz-prev-btn');
const quizNextBtn     = document.getElementById('quiz-next-btn');
const examModeCb      = document.getElementById('exam-mode-cb');
const examDuration    = document.getElementById('exam-duration');
const examTimerEl     = document.getElementById('exam-timer');
const timerDisplay    = document.getElementById('timer-display');

let quizAllQ     = [];
let quizAns      = {};
let quizIdx      = 0;
let examInterval = null;
let examStartTs  = null;

examModeCb.addEventListener('change', () =>
  examDuration.classList.toggle('hidden', !examModeCb.checked)
);

function startExamTimer(minutes) {
  let remaining = minutes * 60;
  examStartTs = Date.now();
  examTimerEl.classList.remove('hidden', 'timer-warning');
  function tick() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    timerDisplay.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (remaining <= 60) examTimerEl.classList.add('timer-warning');
    if (remaining <= 0) { stopExamTimer(); submitQuiz.click(); return; }
    remaining--;
  }
  tick();
  examInterval = setInterval(tick, 1000);
}

function stopExamTimer() {
  if (examInterval) { clearInterval(examInterval); examInterval = null; }
  examTimerEl.classList.add('hidden');
  examTimerEl.classList.remove('timer-warning');
}

quizBtn.addEventListener('click', async () => {
  const files = getSelectedUploadedFiles();
  if (!files.length) return alert('Sélectionnez au moins un fichier.');
  showLoader('Génération du test...');
  stopExamTimer(); examStartTs = null;
  quizSection.classList.add('hidden');
  quizScore.classList.add('hidden'); quizFooter.classList.add('hidden');
  try {
    const difficulty = document.getElementById('quiz-difficulty').value;
    const res  = await fetch('/api/quiz', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ files, count: parseInt(quizCount.value)||5, difficulty, lang: getPrefs().lang || 'fr' }) });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    quizAllQ = [];
    data.results.forEach(r => (r.quiz.questions||[]).forEach(q => quizAllQ.push({ ...q, sourceName: r.name })));
    if (!quizAllQ.length) throw new Error('Aucune question générée');

    quizAns = {}; quizIdx = 0;
    quizProgressInfo.textContent = `${quizAllQ.length} question${quizAllQ.length>1?'s':''}`;
    quizStepHeader.classList.remove('hidden');
    generatedSections.add('quiz-section');
    showPanel('quiz-section');
    showQuizQuestion(0);
    saveSession({ quiz: data.results });
    if (data.model) setModelBadge('quiz-section', data.model);
    fetchQuota();
    refreshFloatNav();
    if (examModeCb.checked) startExamTimer(parseInt(examDuration.value));
  } catch (err) { alert('Erreur : ' + err.message); }
  finally { hideLoader(); }
});

function showQuizQuestion(idx) {
  quizIdx = idx;
  quizContainer.innerHTML = '';
  const q     = quizAllQ[idx];
  const total = quizAllQ.length;
  const isLast= idx === total - 1;

  // progress bar
  quizStepFill.style.width = `${((idx + 1) / total) * 100}%`;
  quizStepLabel.textContent = `${idx + 1} / ${total}`;
  quizPrevBtn.disabled = idx === 0;
  quizNextBtn.disabled = isLast;
  quizFooter.classList.toggle('hidden', !isLast);

  const div = document.createElement('div');
  div.className = 'quiz-question';
  div.innerHTML = `
    <div class="quiz-file-title">${q.sourceName}</div>
    <div class="question-num">Question ${idx + 1}<span style="color:var(--muted);font-weight:400"> / ${total}</span></div>
    <div class="question-text">${q.question}</div>
    <div class="options-grid"></div>`;
  const grid = div.querySelector('.options-grid');
  q.options.forEach(opt => {
    const letter = opt.charAt(0);
    const optDiv = document.createElement('div');
    optDiv.className = 'option' + (quizAns[idx] === letter ? ' selected' : '');
    optDiv.dataset.letter = letter;
    optDiv.innerHTML = `<span class="option-letter">${letter}</span><span>${opt.slice(3)}</span>`;
    optDiv.addEventListener('click', () => {
      quizAns[idx] = letter;
      grid.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
      optDiv.classList.add('selected');
    });
    grid.appendChild(optDiv);
  });
  quizContainer.appendChild(div);
}

quizPrevBtn.addEventListener('click', () => { if (quizIdx > 0) showQuizQuestion(quizIdx - 1); });
quizNextBtn.addEventListener('click', () => { if (quizIdx < quizAllQ.length - 1) showQuizQuestion(quizIdx + 1); });

// Keyboard arrows
document.addEventListener('keydown', e => {
  if (quizSection.classList.contains('hidden') || quizScore.classList.contains('hidden') === false) return;
  if (e.key === 'ArrowRight' && quizIdx < quizAllQ.length - 1) showQuizQuestion(quizIdx + 1);
  if (e.key === 'ArrowLeft'  && quizIdx > 0) showQuizQuestion(quizIdx - 1);
});

submitQuiz.addEventListener('click', () => {
  const timeTaken = examStartTs ? Math.round((Date.now() - examStartTs) / 1000) : null;
  stopExamTimer();
  examStartTs = null;
  quizStepHeader.classList.add('hidden');
  quizFooter.classList.add('hidden');
  quizContainer.innerHTML = '';
  let correct = 0;
  quizAllQ.forEach((q, idx) => {
    const userLetter = quizAns[idx];
    const isCorrect  = userLetter === q.answer;
    if (isCorrect) correct++;
    const div = document.createElement('div');
    div.className = 'quiz-question';
    div.innerHTML = `
      <div class="quiz-file-title">${q.sourceName}</div>
      <div class="question-num">Question ${idx + 1}</div>
      <div class="question-text">${q.question}</div>
      <div class="options-grid"></div>
      <div class="quiz-review-card">
        <div class="quiz-review-title">${isCorrect ? '✓ Bonne réponse' : 'À revoir'}</div>
        <div class="quiz-review-line"><strong>Votre réponse :</strong> ${userLetter || 'Non répondu'}</div>
        <div class="quiz-review-line"><strong>Réponse attendue :</strong> ${q.answer}</div>
        ${q.explanation ? `<div class="explanation">💡 ${marked.parseInline(q.explanation)}</div>` : ''}
        ${q.whyWrong && userLetter && !isCorrect && q.whyWrong[userLetter] ? `<div class="quiz-why-wrong"><strong>Pourquoi ce choix bloque :</strong> ${marked.parseInline(q.whyWrong[userLetter])}</div>` : ''}
        ${q.sourceHint ? `<div class="quiz-source-hint"><strong>À revoir :</strong> ${marked.parseInline(q.sourceHint)}</div>` : ''}
      </div>`;
    const grid = div.querySelector('.options-grid');
    q.options.forEach(opt => {
      const letter = opt.charAt(0);
      const optDiv = document.createElement('div');
      let cls = 'option';
      if (letter === q.answer) cls += ' correct';
      else if (letter === userLetter) cls += ' wrong';
      optDiv.className = cls; optDiv.dataset.letter = letter;
      optDiv.innerHTML = `<span class="option-letter">${letter}</span><span>${opt.slice(3)}</span>`;
      grid.appendChild(optDiv);
    });
    quizContainer.appendChild(div);
  });
  const pct = Math.round(correct / quizAllQ.length * 100);
  const msg = pct>=80 ? '// Excellent travail' : pct>=60 ? '// Bien, continuez ainsi' : '// Révisez encore un peu';
  const timeStr = timeTaken ? ` · ${Math.floor(timeTaken/60)}:${String(timeTaken%60).padStart(2,'0')} min` : '';
  quizScore.innerHTML = `<div class="score-number">${correct}/${quizAllQ.length}</div><div class="score-label">${pct}% de bonnes réponses${timeStr}</div><div class="score-msg">${msg}</div>`;
  quizScore.classList.remove('hidden');
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  saveQuizStat(pct, correct, quizAllQ.length);
});

// ── FICHE D'EXAMEN ────────────────────────────────────────────────────────────
const examSheetBtn     = document.getElementById('exam-sheet-btn');
const examSheetSection = document.getElementById('exam-sheet-section');
const examSheetResult  = document.getElementById('exam-sheet-result');
const examSheetCopyBtn = document.getElementById('exam-sheet-copy-btn');
let examSheetMd = '';

examSheetBtn.addEventListener('click', async () => {
  const files = getSelectedUploadedFiles();
  if (!files.length) return alert('Sélectionnez au moins un fichier.');
  showLoader("Création de la fiche d'examen...");
  examSheetSection.classList.add('hidden');
  examSheetResult.innerHTML = '';
  try {
    const res = await fetch('/api/exam-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, lang: getPrefs().lang || 'fr' })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    examSheetMd = data.sheet || '';
    examSheetResult.innerHTML = `<div class="exam-sheet-card">${marked.parse(examSheetMd)}</div>`;
    generatedSections.add('exam-sheet-section');
    showPanel('exam-sheet-section');
    if (data.model) setModelBadge('exam-sheet-section', data.model);
    saveSession({ examSheet: { files: files.map(f => f.name), sheet: examSheetMd } });
    fetchQuota();
    refreshFloatNav();
    renderDashboard();
  } catch (err) { alert('Erreur : ' + err.message); }
  finally { hideLoader(); }
});

examSheetCopyBtn.addEventListener('click', () => {
  if (!examSheetMd) return;
  navigator.clipboard.writeText(examSheetMd).then(() => {
    examSheetCopyBtn.textContent = 'Copié ✓';
    setTimeout(() => examSheetCopyBtn.textContent = 'Copier', 1600);
  });
});

// ── FLASHCARDS ───────────────────────────────────────────────────────────────
const flashcardBtn    = document.getElementById('flashcard-btn');
const fcSection       = document.getElementById('flashcard-section');
const fcFileTabs      = document.getElementById('fc-file-tabs');
const fcViewer        = document.getElementById('fc-viewer');
const fcDone          = document.getElementById('fc-done');
const fcBar           = document.getElementById('fc-bar');
const fcShuffle       = document.getElementById('fc-shuffle');
const fcRestart       = document.getElementById('fc-restart');
const fcKnownCount    = document.getElementById('fc-known-count');
const fcReviewCount   = document.getElementById('fc-review-count');
const fcRemainingCount= document.getElementById('fc-remaining-count');
const fcRedoWrong     = document.getElementById('fc-redo-wrong');
const fcRedoAll       = document.getElementById('fc-redo-all');
const fcProgressInfo  = document.getElementById('fc-progress-info');
const fcGrid          = document.getElementById('fc-grid');
const srsModeBtn      = document.getElementById('srs-mode-btn');
const fcSrsBar        = document.getElementById('fc-srs-bar');
const srsDueLabel     = document.getElementById('srs-due-label');

let allDecks     = [];
let currentDeckIdx = 0;
let currentCards = [];
let cardStates   = {};
let srsOnlyDue   = false;

// SM-2
const SRS_KEY = 'edu-ai-srs';
function cardHash(front) {
  let h = 0; for (let i=0;i<front.length;i++) h = Math.imul(31,h)+front.charCodeAt(i)|0; return h.toString(36);
}
function getSRSData() { return JSON.parse(localStorage.getItem(SRS_KEY)||'{}'); }
function setSRSData(d) { localStorage.setItem(SRS_KEY, JSON.stringify(d)); }
function sm2Update(key, quality) {
  const data = getSRSData();
  const c = data[key] || { interval:1, easeFactor:2.5, repetitions:0 };
  if (quality >= 3) {
    c.interval = c.repetitions===0 ? 1 : c.repetitions===1 ? 6 : Math.round(c.interval*c.easeFactor);
    c.repetitions++;
  } else { c.interval=1; c.repetitions=0; }
  c.easeFactor = Math.max(1.3, c.easeFactor+0.1-(5-quality)*(0.08+(5-quality)*0.02));
  c.nextReview = Date.now() + c.interval*86400000;
  data[key] = c; setSRSData(data); return c;
}
function getSRSStatus(key) {
  const c = getSRSData()[key]; if (!c) return null;
  if (c.nextReview <= Date.now()) return 'due';
  return (c.nextReview - Date.now()) < 86400000 ? 'soon' : 'learned';
}
function getSRSLabel(key) {
  const c = getSRSData()[key]; if (!c) return '';
  if (c.nextReview <= Date.now()) return '● dû';
  const h = Math.round((c.nextReview-Date.now())/3600000);
  return h<24 ? `● ${h}h` : `● ${Math.round(h/24)}j`;
}
function updateSRSDueCount() {
  const due = currentCards.filter(c => getSRSStatus(cardHash(c.front))==='due').length;
  srsDueLabel.textContent = `${due} carte${due!==1?'s':''} due${due!==1?'s':''}`;
  fcSrsBar.classList.toggle('hidden', !srsOnlyDue);
}

srsModeBtn.addEventListener('click', () => {
  srsOnlyDue = !srsOnlyDue;
  srsModeBtn.classList.toggle('active', srsOnlyDue);
  srsModeBtn.textContent = srsOnlyDue ? '📋 Toutes les cartes' : '🧠 Révision spacée';
  updateSRSDueCount();
  renderGrid();
});

flashcardBtn.addEventListener('click', async () => {
  const files = getSelectedUploadedFiles();
  if (!files.length) return alert('Sélectionnez au moins un fichier.');
  showLoader('Génération des flashcards...');
  fcSection.classList.add('hidden');
  try {
    const res  = await fetch('/api/flashcards', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ files, count: parseInt(document.getElementById('fc-count').value)||10, lang: getPrefs().lang || 'fr' }) });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    allDecks = data.results.map(r => ({ name:r.name, cards:r.flashcards }));
    buildFcTabs(); loadDeck(0);
    generatedSections.add('flashcard-section');
    showPanel('flashcard-section');
    saveSession({ flashcards: data.results });
    if (data.model) setModelBadge('flashcard-section', data.model);
    fetchQuota();
    refreshFloatNav();
  } catch (err) { alert('Erreur : ' + err.message); }
  finally { hideLoader(); }
});

function buildFcTabs() {
  fcFileTabs.innerHTML = '';
  if (allDecks.length <= 1) return;
  allDecks.forEach((d, i) => {
    const btn = document.createElement('button');
    btn.className = 'fc-tab' + (i===0?' active':'');
    btn.textContent = d.name;
    btn.addEventListener('click', () => { document.querySelectorAll('.fc-tab').forEach(t=>t.classList.remove('active')); btn.classList.add('active'); loadDeck(i); });
    fcFileTabs.appendChild(btn);
  });
}

function loadDeck(idx) {
  currentDeckIdx = idx; currentCards = [...allDecks[idx].cards]; cardStates = {};
  fcDone.classList.add('hidden'); fcViewer.classList.remove('hidden');
  fcProgressInfo.textContent = `${currentCards.length} carte${currentCards.length>1?'s':''}`;
  updateSRSDueCount(); renderGrid(); updateStats();
}

function renderGrid() {
  fcGrid.innerHTML = '';
  let cards = [...currentCards];

  if (srsOnlyDue) {
    cards = cards.filter(c => getSRSStatus(cardHash(c.front))==='due');
    if (!cards.length) {
      fcGrid.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--muted);font-family:'DM Mono',monospace;font-size:.8rem;">Aucune carte due pour aujourd'hui ✓</div>`;
      return;
    }
  }

  // Sort: due first, then soon, then learned, then new
  const order = { due:0, soon:1, learned:2, null:3 };
  cards.sort((a,b) => (order[getSRSStatus(cardHash(a.front))]??3) - (order[getSRSStatus(cardHash(b.front))]??3));

  const group = document.createElement('div'); group.className = 'fc-cat-group';
  const titleEl = document.createElement('div'); titleEl.className = 'fc-cat-title';
  titleEl.innerHTML = `${allDecks[currentDeckIdx].name} <span class="fc-cat-count">${cards.length} cartes</span>`;
  group.appendChild(titleEl);
  const grid = document.createElement('div'); grid.className = 'fc-cards-grid';
  cards.forEach((card, i) => grid.appendChild(createCardEl(card, currentCards.indexOf(card))));
  group.appendChild(grid); fcGrid.appendChild(group);
}

function createCardEl(card, i) {
  const key    = cardHash(card.front);
  const status = getSRSStatus(key);
  const label  = getSRSLabel(key);
  const el     = document.createElement('div');
  el.className = 'fc-card';
  el.dataset.idx = i;
  if (cardStates[i]==='known')  el.classList.add('fc-known');
  if (cardStates[i]==='review') el.classList.add('fc-review');

  el.innerHTML = `
    ${label ? `<div class="fc-card-srs-badge ${status||''}">${label}</div>` : ''}
    <div class="fc-card-inner">
      <div class="fc-card-front">
        <div class="fc-card-lbl">Question</div>
        <div class="fc-card-q">${card.front}</div>
        <div class="fc-card-hint">Cliquez pour voir la réponse</div>
      </div>
      <div class="fc-card-back">
        <div class="fc-card-lbl">Réponse</div>
        <div class="fc-card-a">${card.back}</div>
        <div class="fc-card-btns">
          <button class="fc-card-no-btn">✗ À revoir</button>
          <button class="fc-card-yes-btn">✓ Je sais</button>
        </div>
      </div>
    </div>`;

  el.addEventListener('click', e => {
    if (e.target.classList.contains('fc-card-no-btn')||e.target.classList.contains('fc-card-yes-btn')) return;
    el.classList.toggle('flipped');
  });
  el.querySelector('.fc-card-no-btn').addEventListener('click', () => {
    cardStates[i]='review'; el.classList.add('fc-review'); el.classList.remove('fc-known');
    sm2Update(key, 1); updateStats(); updateSRSDueCount();
  });
  el.querySelector('.fc-card-yes-btn').addEventListener('click', () => {
    cardStates[i]='known'; el.classList.add('fc-known'); el.classList.remove('fc-review');
    sm2Update(key, 4); updateStats(); updateSRSDueCount();
    setTimeout(() => el.classList.remove('flipped'), 300);
  });
  return el;
}

function updateStats() {
  const known   = Object.values(cardStates).filter(s=>s==='known').length;
  const review  = Object.values(cardStates).filter(s=>s==='review').length;
  const remaining = currentCards.length - known - review;
  fcKnownCount.textContent    = known;
  fcReviewCount.textContent   = review;
  fcRemainingCount.textContent= remaining;
  fcBar.style.width = `${(known/currentCards.length)*100}%`;
}

fcShuffle.addEventListener('click', () => {
  for (let i=currentCards.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [currentCards[i],currentCards[j]]=[currentCards[j],currentCards[i]]; }
  cardStates={}; renderGrid(); updateStats();
});
fcRestart.addEventListener('click', () => { cardStates={}; document.querySelectorAll('.fc-card').forEach(el=>el.classList.remove('fc-known','fc-review','flipped')); updateStats(); });
fcRedoAll.addEventListener('click', () => loadDeck(currentDeckIdx));
fcRedoWrong.addEventListener('click', () => {
  const wrongIdxs = Object.entries(cardStates).filter(([,s])=>s==='review').map(([i])=>+i);
  if (!wrongIdxs.length) return alert('Aucune carte à revoir !');
  currentCards = wrongIdxs.map(i => currentCards[i]); cardStates={};
  fcDone.classList.add('hidden'); fcViewer.classList.remove('hidden'); renderGrid(); updateStats();
});

// ── CHAT ─────────────────────────────────────────────────────────────────────
const chatOpenBtn      = document.getElementById('chat-open-btn');
const chatSection      = document.getElementById('chat-section');
const chatMessages     = document.getElementById('chat-messages');
const chatInput        = document.getElementById('chat-input');
const chatSendBtn      = document.getElementById('chat-send-btn');
const chatClearBtn     = document.getElementById('chat-clear-btn');
const chatFileSelect   = document.getElementById('chat-file-select');
const chatAttachBtn    = document.getElementById('chat-attach-btn');
const chatFileInput    = document.getElementById('chat-file-input');
const chatAttachBar    = document.getElementById('chat-attach-bar');
const chatAttachName   = document.getElementById('chat-attach-name');
const chatAttachRemove = document.getElementById('chat-attach-remove');
const chatImageBtn     = document.getElementById('chat-image-btn');
const chatImageInput   = document.getElementById('chat-image-input');
const chatImageBar     = document.getElementById('chat-image-bar');
const chatImageThumb   = document.getElementById('chat-image-thumb');
const chatImageNameEl  = document.getElementById('chat-image-name');
const chatImageRemove  = document.getElementById('chat-image-remove');
let chatHistory      = [];
let chatFiles        = [];
let chatAttachedFile  = null; // { id, name, path }
let chatAttachedImage = null; // { name, base64, mimeType }

// ── Chat attachment ───────────────────────────────────────────────────────────
chatAttachBtn.addEventListener('click', () => chatFileInput.click());

chatFileInput.addEventListener('change', async () => {
  const file = chatFileInput.files[0];
  if (!file) return;
  chatFileInput.value = '';

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf','ppt','pptx','docx'].includes(ext)) return alert('Seuls PDF, PPT/PPTX et DOCX sont acceptés.');

  chatAttachBtn.disabled = true;
  chatAttachBtn.style.opacity = '.4';
  try {
    const fd = new FormData();
    fd.append('files', file);
    const res  = await fetch('/api/upload', { method:'POST', body: fd });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    chatAttachedFile = data.files[0];
    chatAttachName.textContent = file.name;
    chatAttachBar.classList.remove('hidden');
    chatAttachBtn.classList.add('active');
  } catch (err) { alert('Erreur : ' + err.message); }
  finally { chatAttachBtn.disabled = false; chatAttachBtn.style.opacity = ''; }
});

chatAttachRemove.addEventListener('click', () => {
  chatAttachedFile = null;
  chatAttachBar.classList.add('hidden');
  chatAttachBtn.classList.remove('active');
});

// ── Image attachment ──────────────────────────────────────────────────────────
chatImageBtn.addEventListener('click', () => chatImageInput.click());

chatImageInput.addEventListener('change', () => {
  const file = chatImageInput.files[0];
  if (!file) return;
  chatImageInput.value = '';
  if (file.size > 4 * 1024 * 1024) return alert('Image trop lourde (max 4 Mo).');
  const reader = new FileReader();
  reader.onload = () => {
    chatAttachedImage = { name: file.name, base64: reader.result.split(',')[1], mimeType: file.type };
    chatImageThumb.src = reader.result;
    chatImageNameEl.textContent = file.name;
    chatImageBar.classList.remove('hidden');
    chatImageBtn.classList.add('active');
  };
  reader.readAsDataURL(file);
});

chatImageRemove.addEventListener('click', () => {
  chatAttachedImage = null;
  chatImageBar.classList.add('hidden');
  chatImageBtn.classList.remove('active');
});

chatOpenBtn.addEventListener('click', () => {
  chatFiles = getSelectedUploadedFiles();
  if (!chatFiles.length) return alert('Chargez d\'abord des fichiers.');
  buildChatChips();
  generatedSections.add('chat-section');
  showPanel('chat-section');
});

function buildChatChips() {
  chatFileSelect.innerHTML = '';
  chatFiles.forEach((f, i) => {
    const chip = document.createElement('button');
    chip.className = 'chat-file-chip' + (i===0?' active':'');
    chip.textContent = f.name; chip.dataset.idx = i;
    chip.addEventListener('click', () => { chip.classList.toggle('active'); });
    chatFileSelect.appendChild(chip);
  });
  if (chatFiles.length > 1) {
    const all = document.createElement('button');
    all.className = 'chat-file-chip';
    all.textContent = 'Tous';
    all.addEventListener('click', () => chatFileSelect.querySelectorAll('.chat-file-chip').forEach(c=>c.classList.add('active')));
    chatFileSelect.appendChild(all);
  }
}

function getActiveChatFiles() {
  const active = [...chatFileSelect.querySelectorAll('.chat-file-chip[data-idx].active')].map(c=>+c.dataset.idx);
  return active.length ? active.map(i=>chatFiles[i]) : chatFiles;
}

document.querySelectorAll('.chat-sug').forEach(btn => btn.addEventListener('click', () => sendChat(btn.textContent)));
chatSendBtn.addEventListener('click', () => sendChat(chatInput.value.trim()));
chatInput.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendChat(chatInput.value.trim()); } });

chatClearBtn.addEventListener('click', () => {
  chatHistory = [];
  chatAttachedImage = null;
  chatImageBar.classList.add('hidden');
  chatImageBtn.classList.remove('active');
  chatMessages.innerHTML = `<div class="chat-welcome" id="chat-welcome">
    <div class="chat-welcome-icon">💬</div>
    <p>Posez une question sur vos cours chargés.</p>
    <div class="chat-suggestions">
      <button class="chat-sug">Quels sont les points clés ?</button>
      <button class="chat-sug">Donne un exemple concret</button>
      <button class="chat-sug">Explique le concept principal</button>
      <button class="chat-sug">Quelles sont les définitions importantes ?</button>
    </div>
  </div>`;
  chatMessages.querySelectorAll('.chat-sug').forEach(btn => btn.addEventListener('click', () => sendChat(btn.textContent)));
});

async function sendChat(text) {
  if (!text && !chatAttachedFile && !chatAttachedImage) return;
  const msgText = text || `Analyse et réponds au document joint : **${chatAttachedFile?.name || chatAttachedImage?.name}**`;
  chatInput.value = '';
  document.getElementById('chat-welcome')?.remove();

  const attachedSnapshot = chatAttachedFile;
  const imageSnapshot    = chatAttachedImage;

  if (attachedSnapshot) {
    appendMsgWithAttachment('user', msgText, attachedSnapshot.name);
    chatAttachedFile = null;
    chatAttachBar.classList.add('hidden');
    chatAttachBtn.classList.remove('active');
  } else if (imageSnapshot) {
    appendMsgWithImage('user', msgText, imageSnapshot);
    chatAttachedImage = null;
    chatImageBar.classList.add('hidden');
    chatImageBtn.classList.remove('active');
  } else {
    appendMsg('user', msgText);
  }
  chatHistory.push({ role:'user', content: msgText });

  const typing = document.createElement('div');
  typing.className = 'chat-msg ai';
  typing.innerHTML = `<div class="chat-bubble chat-typing"><div class="chat-dot"></div><div class="chat-dot"></div><div class="chat-dot"></div></div>`;
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const body = { files: getActiveChatFiles(), messages: chatHistory };
    if (attachedSnapshot) body.attachedFile = attachedSnapshot;
    if (imageSnapshot)    body.attachedImage = imageSnapshot;
    const res  = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body) });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    typing.remove();
    appendMsg('ai', data.response, data.model);
    chatHistory.push({ role:'assistant', content: data.response });
  } catch (err) { typing.remove(); appendMsg('ai', '❌ ' + err.message); }
}

function appendMsgWithAttachment(role, text, attachName) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  const time = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  const ext  = attachName.split('.').pop().toUpperCase();
  el.innerHTML = `
    <div class="chat-attach-preview">
      <span class="file-ext" style="font-size:.5rem;padding:.1rem .3rem">${ext}</span>
      <span>${attachName}</span>
    </div>
    <div class="chat-bubble">${marked.parse(text)}</div>
    <div class="chat-time">${time}</div>`;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMsg(role, text, model = null) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  const time = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  if (role === 'ai') {
    const isGroq = model && model.toLowerCase().includes('groq');
    const badge = (model && isLocal) ? `<span class="chat-model-badge ${isGroq ? 'groq' : 'claude'}">${model}</span>` : '';
    el.innerHTML = `<div class="chat-bubble">${marked.parse(text)}</div><div class="chat-meta">${badge}<button class="chat-copy-btn" title="Copier">⎘</button><span class="chat-time">${time}</span></div>`;
    el.querySelector('.chat-copy-btn').addEventListener('click', function() {
      navigator.clipboard.writeText(text).then(() => {
        this.textContent = '✓'; setTimeout(() => this.textContent = '⎘', 1500);
      });
    });
  } else {
    el.innerHTML = `<div class="chat-bubble">${marked.parse(text)}</div><div class="chat-time">${time}</div>`;
  }
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMsgWithImage(role, text, img) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  const time = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  el.innerHTML = `
    <div class="chat-image-preview"><img src="data:${img.mimeType};base64,${img.base64}" alt="${img.name}"/></div>
    <div class="chat-bubble">${marked.parse(text)}</div>
    <div class="chat-time">${time}</div>`;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── SESSION HISTORY ──────────────────────────────────────────────────────────
const HISTORY_KEY = 'edu-ai-sessions';

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
  renderHistoryPanel();
  renderDashboard();
}

function renderHistoryPanel() {
  const sessions = getSessions();
  const panel    = document.getElementById('history-panel');
  const list     = document.getElementById('history-list');
  list.innerHTML = '';
  if (!sessions.length) { list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem">Aucune session sauvegardée.</p>'; return; }
  sessions.forEach(s => {
    const el   = document.createElement('div');
    el.className = 'history-item';
    const date = new Date(s.timestamp).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    el.innerHTML = `
      <div class="history-left">
        <div class="history-files">${s.files.join(' · ')}</div>
        <div class="history-meta">${date}</div>
        <div class="history-tags">
          ${s.summaries  ? '<span class="htag hs">Résumés</span>'    : ''}
          ${s.quiz       ? '<span class="htag hq">Quiz</span>'       : ''}
          ${s.flashcards ? '<span class="htag hf">Flashcards</span>' : ''}
        </div>
      </div>
      <button class="history-del" data-id="${s.id}" title="Supprimer">✕</button>`;
    el.addEventListener('click', e => { if (e.target.classList.contains('history-del')) return; restoreSession(s); });
    el.querySelector('.history-del').addEventListener('click', e => {
      e.stopPropagation();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(getSessions().filter(x=>x.id!==s.id)));
      renderHistoryPanel();
      renderDashboard();
    });
    list.appendChild(el);
  });
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
    summaryResults.innerHTML = '';
    summaryAllResults = s.summaries;
    summaryActiveTab  = 0;
    s.summaries.forEach(r => summaryResults.appendChild(renderSummaryItem(r)));
    buildSummaryTabs();
    if (s.summaries.length > 1) switchSummaryTab(0);
    generatedSections.add('summary-section');
    firstPanel = 'summary-section';
  }
  if (s.quiz) {
    quizContainer.innerHTML = '';
    quizAllQ = [];
    s.quiz.forEach(r => (r.quiz?.questions||[]).forEach(q => quizAllQ.push({ ...q, sourceName: r.name })));
    quizAns = {}; quizIdx = 0;
    quizProgressInfo.textContent = `${quizAllQ.length} questions`;
    if (quizAllQ.length) {
      quizStepHeader.classList.remove('hidden');
      showQuizQuestion(0);
    }
    quizScore.classList.add('hidden');
    generatedSections.add('quiz-section');
    if (firstPanel === 'actions-section') firstPanel = 'quiz-section';
  }
  if (s.flashcards) {
    allDecks = s.flashcards.map(r=>({ name:r.name, cards:r.flashcards }));
    buildFcTabs(); loadDeck(0);
    generatedSections.add('flashcard-section');
    if (firstPanel === 'actions-section') firstPanel = 'flashcard-section';
  }
  if (s.examSheet) {
    examSheetMd = s.examSheet.sheet || '';
    examSheetResult.innerHTML = `<div class="exam-sheet-card">${marked.parse(examSheetMd)}</div>`;
    generatedSections.add('exam-sheet-section');
    if (firstPanel === 'actions-section') firstPanel = 'exam-sheet-section';
  }
  showPanel(firstPanel);
}

document.getElementById('history-clear-all').addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY); renderHistoryPanel(); renderDashboard();
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

// ── STATS ─────────────────────────────────────────────────────────────────────
const QUIZ_STATS_KEY = 'edu-ai-quiz-stats';
const statsPanel   = document.getElementById('stats-panel');
const statsContent = document.getElementById('stats-content');
const statsToggle  = document.getElementById('stats-toggle');

statsToggle.addEventListener('click', () => {
  renderStatsPanel();
  showPanel('stats-panel');
});

document.getElementById('stats-reset-btn').addEventListener('click', () => {
  if (!confirm('Réinitialiser l\'historique des quiz ?')) return;
  localStorage.removeItem(QUIZ_STATS_KEY);
  renderStatsPanel();
  renderDashboard();
});

function saveQuizStat(pct, correct, total) {
  const stats = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '[]');
  stats.unshift({ date: Date.now(), pct, correct, total });
  localStorage.setItem(QUIZ_STATS_KEY, JSON.stringify(stats.slice(0, 50)));
  renderStatsPanel();
  renderDashboard();
}

function renderStatsPanel() {
  const quizStats = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '[]');
  const sessions  = getSessions();
  const srsData   = getSRSData();

  const quizDone = quizStats.length;
  const avgPct   = quizDone ? Math.round(quizStats.reduce((s,x)=>s+x.pct,0)/quizDone) : null;
  const bestPct  = quizDone ? Math.max(...quizStats.map(x=>x.pct)) : null;

  const allSRS     = Object.values(srsData);
  const fcSeen     = allSRS.length;
  const fcMastered = allSRS.filter(c=>c.interval>=7).length;
  const fcDue      = allSRS.filter(c=>c.nextReview<=Date.now()).length;

  const sessCount = sessions.length;
  const sumCount  = sessions.filter(s=>s.summaries).length;
  const qzCount   = sessions.filter(s=>s.quiz).length;
  const flCount   = sessions.filter(s=>s.flashcards).length;

  const cls = p => p>=80?'good':p>=60?'mid':'low';

  statsContent.innerHTML = `
    <div class="stats-section">
      <div class="stats-section-title">Quiz</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number stat-blue">${quizDone}</div><div class="stat-label">quiz complétés</div></div>
        <div class="stat-card"><div class="stat-number stat-${avgPct!==null?cls(avgPct):'muted-num'}">${avgPct!==null?avgPct+'%':'—'}</div><div class="stat-label">score moyen</div></div>
        <div class="stat-card"><div class="stat-number stat-${bestPct!==null?cls(bestPct):'muted-num'}">${bestPct!==null?bestPct+'%':'—'}</div><div class="stat-label">meilleur score</div></div>
      </div>
      <div class="quiz-history">
        ${quizStats.slice(0,6).map(s=>{
          const d=new Date(s.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
          return `<div class="quiz-history-item"><span>${d}</span><span>${s.correct}/${s.total} correctes</span><span class="quiz-score-badge quiz-score-${cls(s.pct)}">${s.pct}%</span></div>`;
        }).join('')}
      </div>
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Flashcards · révision espacée</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number stat-purple">${fcSeen}</div><div class="stat-label">cartes vues</div></div>
        <div class="stat-card"><div class="stat-number stat-good">${fcMastered}</div><div class="stat-label">maîtrisées (≥7j)</div></div>
        <div class="stat-card"><div class="stat-number stat-${fcDue>0?'low':'good'}">${fcDue}</div><div class="stat-label">dues aujourd'hui</div></div>
      </div>
    </div>
    <div class="stats-section">
      <div class="stats-section-title">Sessions</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number stat-blue">${sessCount}</div><div class="stat-label">sessions</div></div>
        <div class="stat-card"><div class="stat-number stat-muted-num">${sumCount}</div><div class="stat-label">résumés</div></div>
        <div class="stat-card"><div class="stat-number stat-muted-num">${qzCount}</div><div class="stat-label">quiz</div></div>
        <div class="stat-card"><div class="stat-number stat-muted-num">${flCount}</div><div class="stat-label">flashcards</div></div>
      </div>
    </div>`;
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
const dashboardGrid       = document.getElementById('dashboard-grid');
const dashboardRefreshBtn = document.getElementById('dashboard-refresh-btn');
const dashContinueBtn     = document.getElementById('dash-continue-btn');
const dashUploadBtn       = document.getElementById('dash-upload-btn');
const dashLibraryBtn      = document.getElementById('dash-library-btn');
const dashStatsBtn        = document.getElementById('dash-stats-btn');

function renderDashboard() {
  if (!dashboardGrid) return;
  const sessions = getSessions();
  const quizStats = JSON.parse(localStorage.getItem(QUIZ_STATS_KEY) || '[]');
  const srsData = Object.values(getSRSData());
  const dueCards = srsData.filter(c => c.nextReview <= Date.now()).length;
  const avgPct = quizStats.length ? Math.round(quizStats.reduce((sum, s) => sum + s.pct, 0) / quizStats.length) : null;
  const lastSession = sessions[0];
  const libraryCount = libAllSections.reduce((a, s) => a + s.subjects.reduce((b, m) => b + m.files.length, 0), 0);

  const cards = [
    {
      label: 'Dernière session',
      value: lastSession ? lastSession.files.slice(0, 2).join(' · ') : 'Aucune',
      note: lastSession ? new Date(lastSession.timestamp).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : 'Charge un cours pour commencer',
      cls: 'blue'
    },
    {
      label: 'Quiz',
      value: avgPct !== null ? `${avgPct}%` : '—',
      note: `${quizStats.length} quiz complété${quizStats.length>1?'s':''}`,
      cls: avgPct === null ? 'muted' : avgPct >= 80 ? 'green' : avgPct >= 60 ? 'gold' : 'rose'
    },
    {
      label: 'Révision espacée',
      value: dueCards,
      note: dueCards ? "cartes dues aujourd'hui" : 'aucune carte due',
      cls: dueCards ? 'rose' : 'green'
    },
    {
      label: 'Bibliothèque',
      value: libraryCount,
      note: `cours disponible${libraryCount>1?'s':''} en local`,
      cls: 'purple'
    }
  ];

  dashboardGrid.innerHTML = cards.map(c => `
    <div class="dash-card dash-${c.cls}">
      <div class="dash-label">${c.label}</div>
      <div class="dash-value" title="${c.value}">${c.value}</div>
      <div class="dash-note">${c.note}</div>
    </div>
  `).join('');
  if (dashContinueBtn) {
    dashContinueBtn.disabled = !lastSession;
    dashContinueBtn.textContent = lastSession ? 'Continuer la session' : 'Aucune session';
  }
}

dashboardRefreshBtn?.addEventListener('click', renderDashboard);
dashContinueBtn?.addEventListener('click', () => {
  const lastSession = getSessions()[0];
  if (lastSession) restoreSession(lastSession);
});
dashUploadBtn?.addEventListener('click', () => showPanel('upload-section'));
document.getElementById('no-files-upload-btn')?.addEventListener('click', () => showPanel('upload-section'));
dashLibraryBtn?.addEventListener('click', () => showPanel('library-panel'));
document.getElementById('dash-history-btn')?.addEventListener('click', () => {
  renderHistoryPanel(); showPanel('history-panel');
});
dashStatsBtn?.addEventListener('click', () => {
  renderStatsPanel(); showPanel('stats-panel');
});

renderDashboard();

// ── UTILS ────────────────────────────────────────────────────────────────────
function showLoader(text) { loaderText.textContent = text; loader.classList.remove('hidden'); }
function hideLoader()     { loader.classList.add('hidden'); }

// ── MODÈLE IA BADGE ──────────────────────────────────────────────────────────
function setModelBadge(sectionId, modelName) {
  if (!isLocal) return; // badge visible uniquement en local
  const sec = document.getElementById(sectionId);
  if (!sec) return;
  let badge = sec.querySelector('.model-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'model-badge';
    const tag = sec.querySelector('.mono-tag, .panel-label');
    if (tag) tag.parentNode.insertBefore(badge, tag.nextSibling);
  }
  const isGroq = modelName.toLowerCase().includes('groq') || modelName.toLowerCase().includes('llama');
  badge.className = `model-badge ${isGroq ? 'model-groq' : 'model-claude'}`;
  badge.textContent = modelName;
}

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
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(newSW);
        }
      });
    });
  }).catch(() => {});
}

function showUpdateBanner(newSW) {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML = `
    <span>✦ Nouvelle version disponible</span>
    <button id="update-reload-btn">Mettre à jour</button>
    <button id="update-dismiss-btn">✕</button>`;
  banner.style.cssText = `
    position:fixed;bottom:5.5rem;left:50%;transform:translateX(-50%);
    background:#1a2540;border:1px solid #3d7eff;color:#e8ecf6;
    padding:.65rem 1.1rem;border-radius:10px;display:flex;gap:.75rem;
    align-items:center;z-index:9999;box-shadow:0 8px 28px rgba(0,0,0,.4);
    font-family:'Outfit',sans-serif;font-size:.88rem;white-space:nowrap;`;
  document.body.appendChild(banner);

  document.getElementById('update-reload-btn').style.cssText =
    'background:#3d7eff;color:#fff;border:none;border-radius:6px;padding:.3rem .9rem;font-weight:600;cursor:pointer;font-family:inherit;';
  document.getElementById('update-dismiss-btn').style.cssText =
    'background:none;border:none;color:#6b7fa3;cursor:pointer;font-size:1rem;padding:0 .2rem;';

  document.getElementById('update-reload-btn').onclick = () => {
    newSW.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  };
  document.getElementById('update-dismiss-btn').onclick = () => banner.remove();
}


// ── ONBOARDING ────────────────────────────────────────────────────────────────
document.getElementById('onboarding-close')?.addEventListener('click', () => {
  document.getElementById('onboarding-modal').classList.add('hidden');
  localStorage.setItem('edu-ai-onboarded', '1');
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────
const PREFS_KEY = 'edu-ai-prefs';
function getPrefs() { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
function savePrefs(patch) { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...getPrefs(), ...patch })); }

function openSettings() {
  const drawer  = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-overlay');
  populateSettings();
  drawer.classList.remove('hidden');
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  document.getElementById('settings-drawer').classList.add('hidden');
  document.getElementById('settings-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function populateSettings() {
  const prefs = getPrefs();

  // Account
  if (currentUser) {
    document.getElementById('sac-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('sac-name').textContent   = currentUser.name;
    document.getElementById('sac-email').textContent  = currentUser.email;
    const planEl = document.getElementById('sac-plan');
    const planLabels = { free: 'Gratuit', pro: '✦ Pro', max: '★ Max' };
    planEl.textContent = planLabels[currentUser.plan] || currentUser.plan;
    planEl.className = `sac-plan plan-${currentUser.plan}`;
  }

  // Theme
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  document.querySelectorAll('.ts-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.theme === currentTheme)
  );

  // Reduce motion
  document.getElementById('pref-reduce-motion').checked = !!prefs.reduceMotion;

  // AI prefs
  document.getElementById('pref-lang').value            = prefs.lang || 'fr';
  document.getElementById('pref-quiz-count').value      = prefs.quizCount || 5;
  document.getElementById('pref-quiz-difficulty').value = prefs.quizDifficulty || 'moyen';
  document.getElementById('pref-fc-count').value        = prefs.fcCount || 10;
}

function applyPrefs() {
  const prefs = getPrefs();
  if (prefs.reduceMotion) document.documentElement.classList.add('reduce-motion');
  else document.documentElement.classList.remove('reduce-motion');
  if (prefs.quizCount)      { const el = document.getElementById('quiz-count'); if (el) el.value = prefs.quizCount; }
  if (prefs.quizDifficulty) { const el = document.getElementById('quiz-difficulty'); if (el) el.value = prefs.quizDifficulty; }
  if (prefs.fcCount)        { const el = document.getElementById('fc-count'); if (el) el.value = prefs.fcCount; }
}

// Open / close
document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', closeSettings);

// Theme buttons
document.querySelectorAll('.ts-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    const t = btn.dataset.theme;
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('edu-ai-theme', t);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.textContent = t === 'dark' ? '🌙' : '☀️';
    document.querySelectorAll('.ts-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
  })
);

// Reduce motion
document.getElementById('pref-reduce-motion').addEventListener('change', e => {
  savePrefs({ reduceMotion: e.target.checked });
  applyPrefs();
});

// AI prefs — save on change
['pref-lang','pref-quiz-count','pref-quiz-difficulty','pref-fc-count'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    savePrefs({
      lang:           document.getElementById('pref-lang').value,
      quizCount:      parseInt(document.getElementById('pref-quiz-count').value) || 5,
      quizDifficulty: document.getElementById('pref-quiz-difficulty').value,
      fcCount:        parseInt(document.getElementById('pref-fc-count').value) || 10,
    });
    applyPrefs();
  });
});

// Data management
document.getElementById('clear-history-btn').addEventListener('click', () => {
  if (!confirm('Effacer tout l\'historique des sessions ?')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderDashboard();
  alert('Historique effacé.');
});

document.getElementById('clear-stats-btn').addEventListener('click', () => {
  if (!confirm('Réinitialiser toutes les statistiques quiz ?')) return;
  localStorage.removeItem(QUIZ_STATS_KEY);
  alert('Statistiques réinitialisées.');
});

document.getElementById('reset-onboarding-btn').addEventListener('click', () => {
  localStorage.removeItem('edu-ai-onboarded');
  closeSettings();
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.remove('hidden');
});

// ── MINDMAP ───────────────────────────────────────────────────────────────────
let markmapInstance = null;
const mindmapOverlay    = document.getElementById('mindmap-overlay');
const mindmapSvgEl      = document.getElementById('mindmap-svg');
const mindmapCourseName = document.getElementById('mindmap-course-name');

document.getElementById('mindmap-close').addEventListener('click', closeMindmap);
document.getElementById('mindmap-fit-btn').addEventListener('click', () => markmapInstance?.fit());
mindmapOverlay.addEventListener('click', e => { if (e.target === mindmapOverlay) closeMindmap(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !mindmapOverlay.classList.contains('hidden')) closeMindmap(); });

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
    localStorage.setItem('edu-ai-push', '1');
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
  localStorage.removeItem('edu-ai-push');
}

async function notifyDueCardsIfNeeded() {
  if (localStorage.getItem('edu-ai-push') !== '1') return;
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
  pushToggle.checked = localStorage.getItem('edu-ai-push') === '1';
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

// Init
(async () => {
  const ok = await initAuth();
  if (!ok) return;
  applyPrefs();
  showPanel('dashboard-panel');
  notifyDueCardsIfNeeded();
  document.getElementById('back-home-btn').addEventListener('click', () => showPanel('dashboard-panel'));
  document.getElementById('header-logo').addEventListener('click', () => showPanel('dashboard-panel'));
})();

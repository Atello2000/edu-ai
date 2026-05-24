import { useState, useEffect, useRef } from 'react';
import toast from '../utils/toast';
import { useConfirm } from './ConfirmModal';
import eventBus from '../utils/eventBus';

// ── Palette de couleurs ───────────────────────────────────────────────────────
const ICON_COLORS = [
  { key: 'purple',  hex: '#a78bfa', bg: 'rgba(167,139,250,.18)' },
  { key: 'blue',    hex: '#3d7eff', bg: 'rgba(61,126,255,.18)'  },
  { key: 'teal',    hex: '#1dd1a1', bg: 'rgba(29,209,161,.18)'  },
  { key: 'gold',    hex: '#d4a94c', bg: 'rgba(212,169,76,.18)'  },
  { key: 'rose',    hex: '#ff6b81', bg: 'rgba(255,107,129,.18)' },
  { key: 'orange',  hex: '#f97316', bg: 'rgba(249,115,22,.18)'  },
  { key: 'indigo',  hex: '#818cf8', bg: 'rgba(129,140,248,.18)' },
  { key: 'emerald', hex: '#34d399', bg: 'rgba(52,211,153,.18)'  },
];

// ── Icônes SVG (style Feather, 24×24) ────────────────────────────────────────
const ICON_DEFS = {
  folder:   <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>,
  book:     <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
  flask:    <><path d="M9 3h6"/><path d="M10 3v6l-5 9h14l-5-9V3"/></>,
  atom:     <><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/></>,
  calc:     <><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></>,
  globe:    <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
  code:     <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
  music:    <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
  scale:    <><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></>,
  pulse:    <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  cpu:      <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M9 2v2M9 20v2M2 9h2M20 9h2M2 15h2M20 15h2"/></>,
  pen:      <><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></>,
  chart:    <><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7" rx="1"/><rect x="12" y="7" width="3" height="11" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></>,
  bulb:     <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></>,
  grad:     <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></>,
  clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  layers:   <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
  star:     <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
  award:    <><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></>,
  pin:      <><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></>,
};
const ICON_KEYS = Object.keys(ICON_DEFS);

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseIcon(str) {
  if (!str) return { key: 'folder', color: 'purple' };
  if (str.includes('|')) {
    const [key, color] = str.split('|');
    return { key: ICON_DEFS[key] ? key : 'folder', color };
  }
  return { emoji: str }; // rétrocompatibilité emojis
}

function buildIcon(key, colorKey) { return `${key}|${colorKey}`; }

function FolderIconBadge({ icon, size = 44 }) {
  const p = parseIcon(icon);
  if (p.emoji) return <span style={{ fontSize: size * 0.6 }}>{p.emoji}</span>;
  const c = ICON_COLORS.find(x => x.key === p.color) || ICON_COLORS[0];
  const s = Math.round(size * 0.52);
  return (
    <span className="fi-badge" style={{ width: size, height: size, background: c.bg, color: c.hex, borderRadius: Math.round(size * 0.28) }}>
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {ICON_DEFS[p.key] || ICON_DEFS.folder}
      </svg>
    </span>
  );
}

export default function FoldersPanel({ onGoUpload }) {
  const confirm = useConfirm();
  const [folders, setFolders] = useState([]);
  const [view, setView] = useState('list');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [fileSelectedIds, setFileSelectedIds] = useState(new Set());

  const [modalOpen,     setModalOpen]     = useState(false);
  const [modalMode,     setModalMode]     = useState('create');
  const [modalName,     setModalName]     = useState('');
  const [modalIconKey,  setModalIconKey]  = useState('folder');
  const [modalColorKey, setModalColorKey] = useState('purple');
  const [modalSaving,   setModalSaving]   = useState(false);
  const modalNameRef = useRef(null);

  // Refs pour accéder aux valeurs courantes depuis les callbacks eventBus
  const viewRef          = useRef(view);
  const currentFolderRef = useRef(currentFolder);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { currentFolderRef.current = currentFolder; }, [currentFolder]);

  async function loadFolders() {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch {
      setFolders([]);
    }
  }

  async function loadFiles(folder) {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const res = await fetch(`/api/folders/${folder.id}/files`);
      const data = await res.json();
      setFolderFiles(data.files || []);
    } catch (err) {
      setFilesError(err.message);
      setFolderFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFolders();
    return eventBus.on('folders:refresh', async () => {
      await loadFolders();
      // Si on est en vue détail, recharger aussi les fichiers du dossier courant
      if (viewRef.current === 'detail' && currentFolderRef.current) {
        await loadFiles(currentFolderRef.current);
      }
    });
  }, []);

  useEffect(() => {
    if (modalOpen) setTimeout(() => modalNameRef.current?.focus(), 50);
  }, [modalOpen]);

  async function openDetail(folder) {
    setCurrentFolder(folder);
    setView('detail');
    setFileSelectedIds(new Set());
    await loadFiles(folder);
  }

  function toggleFileSelect(id) {
    setFileSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (fileSelectedIds.size === folderFiles.length && folderFiles.length > 0) {
      setFileSelectedIds(new Set());
    } else {
      setFileSelectedIds(new Set(folderFiles.map(f => f.id)));
    }
  }

  async function deleteFile(fileId, fileName) {
    const ok = await confirm(`Retirer « ${fileName} » de cette matière ?`, { confirmLabel: 'Retirer', danger: true });
    if (!ok) return;
    await fetch(`/api/folders/${currentFolder.id}/files/${fileId}`, { method: 'DELETE' });
    setFolderFiles(prev => prev.filter(f => f.id !== fileId));
    setFolders(prev => prev.map(f =>
      f.id === currentFolder.id ? { ...f, file_count: Math.max(0, f.file_count - 1) } : f
    ));
  }

  function openCreateModal() {
    setModalMode('create');
    setModalName('');
    setModalIconKey('folder');
    setModalColorKey('purple');
    setModalOpen(true);
  }

  function openRenameModal() {
    const p = parseIcon(currentFolder.icon);
    setModalMode('rename');
    setModalName(currentFolder.name);
    setModalIconKey(p.key || 'folder');
    setModalColorKey(p.color || 'purple');
    setModalOpen(true);
  }

  async function handleModalConfirm() {
    if (!modalName.trim() || modalSaving) return;
    setModalSaving(true);
    try {
      const iconStr = buildIcon(modalIconKey, modalColorKey);
      if (modalMode === 'rename') {
        const res = await fetch(`/api/folders/${currentFolder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modalName.trim(), icon: iconStr }),
        });
        const data = await res.json();
        if (data.error) { toast.error(data.error); return; }
        await loadFolders();
        setCurrentFolder(f => ({ ...f, name: modalName.trim(), icon: iconStr }));
      } else {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modalName.trim(), icon: iconStr }),
        });
        const data = await res.json();
        if (data.error) { toast.error(data.error); return; }
        await loadFolders();
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setModalSaving(false);
    }
  }

  async function deleteFolder() {
    const ok = await confirm(`Supprimer la matière « ${currentFolder.name} » et tous ses fichiers ?`, { confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    await fetch(`/api/folders/${currentFolder.id}`, { method: 'DELETE' });
    await loadFolders();
    setView('list');
    setCurrentFolder(null);
    toast.success('Matière supprimée.');
  }

  function useFiles() {
    const src = fileSelectedIds.size > 0
      ? folderFiles.filter(f => fileSelectedIds.has(f.id))
      : folderFiles;
    const files = src.map(f => ({
      id: f.filename, name: f.orig_name, path: '', text: f.text || '', size: f.size,
    }));
    window.__setFolderFiles?.(files);
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-label">Organisation</div>
          <h2 className="panel-title">Mes <em>matières</em></h2>
        </div>
        {view === 'list' && (
          <button className="ghost-btn" onClick={openCreateModal}>+ Nouvelle matière</button>
        )}
        {view === 'detail' && currentFolder && (
          <div className="folder-detail-actions">
            {onGoUpload && (
              <button className="ghost-btn folder-add-btn" onClick={() => onGoUpload(currentFolder.id)} title="Ajouter un cours">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Ajouter
              </button>
            )}
            <button className="ghost-btn" onClick={openRenameModal} title="Renommer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
            <button className="ghost-btn" onClick={deleteFolder} title="Supprimer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        )}
      </div>

      <p className="panel-desc">Classez vos cours par matière pour les retrouver et les réutiliser facilement</p>

      {view === 'list' && (
        folders.length === 0 ? (
          <div className="folders-empty">
            Aucune matière créée.<br />
            Cliquez sur « + Nouvelle matière » pour commencer.
          </div>
        ) : (
          <div className="folder-grid">
            {folders.map(f => (
              <div key={f.id} className="folder-card" onClick={() => openDetail(f)}>
                <span className="folder-card-icon"><FolderIconBadge icon={f.icon} size={48} /></span>
                <span className="folder-card-name">{f.name}</span>
                <span className="folder-card-count">{f.file_count} fichier{f.file_count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )
      )}

      {view === 'detail' && currentFolder && (
        <>
          <div className="folder-detail-header">
            <button className="ghost-btn" id="folder-back-btn" onClick={() => setView('list')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Retour
            </button>
            <h3 className="folder-detail-title"><FolderIconBadge icon={currentFolder.icon} size={28} /> {currentFolder.name}</h3>
          </div>

          {!filesLoading && folderFiles.length > 1 && (
            <div className="folder-select-bar">
              <button className="ghost-btn" style={{fontSize:'.74rem'}} onClick={toggleSelectAll}>
                {fileSelectedIds.size === folderFiles.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              {fileSelectedIds.size > 0 && (
                <span className="folder-sel-count">{fileSelectedIds.size} sélectionné{fileSelectedIds.size > 1 ? 's' : ''}</span>
              )}
            </div>
          )}

          <div id="folder-files-list">
            {filesLoading && (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>Chargement...</p>
            )}
            {!filesLoading && filesError && (
              <p style={{ color: 'var(--rose)', textAlign: 'center' }}>{filesError}</p>
            )}
            {!filesLoading && !filesError && folderFiles.length === 0 && (
              <div className="folders-empty">
                Aucun fichier dans cette matière.<br />Chargez un cours et enregistrez-le ici.
              </div>
            )}
            {!filesLoading && !filesError && folderFiles.map(f => {
              const ext = f.orig_name.split('.').pop().toUpperCase();
              const date = new Date(f.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
              const selected = fileSelectedIds.has(f.id);
              return (
                <div
                  key={f.id}
                  className={`folder-file-item${selected ? ' file-selected' : ''}`}
                  onClick={() => toggleFileSelect(f.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    className="sel-cb"
                    checked={selected}
                    onChange={() => toggleFileSelect(f.id)}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="file-ext">{ext}</span>
                  <span className="folder-file-name">{f.orig_name}</span>
                  <span className="folder-file-date">{date}</span>
                  <button className="folder-file-del" onClick={e => { e.stopPropagation(); deleteFile(f.id, f.orig_name); }} title="Retirer">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })}
          </div>

          {!filesLoading && folderFiles.length > 0 && (
            <div className="folder-actions-bar">
              <button className="act-btn purple" onClick={useFiles}>
                {fileSelectedIds.size > 0
                  ? `Utiliser ${fileSelectedIds.size} cours sélectionné${fileSelectedIds.size > 1 ? 's' : ''} →`
                  : 'Utiliser tous les cours →'}
              </button>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal-box modal-sm">
            <div className="modal-header">
              <h2>{modalMode === 'rename' ? <>Renommer la <em>matière</em></> : <>Nouvelle <em>matière</em></>}</h2>
            </div>
            <div className="folder-modal-body">
              <label className="folder-modal-label">Nom</label>
              <input
                ref={modalNameRef}
                type="text"
                className="input-field"
                placeholder="Ex : Biochimie S3"
                value={modalName}
                onChange={e => setModalName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleModalConfirm(); }}
                autoComplete="off"
              />
              <label className="folder-modal-label">Couleur</label>
              <div className="color-swatches">
                {ICON_COLORS.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    className={`color-swatch${c.key === modalColorKey ? ' selected' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => setModalColorKey(c.key)}
                  />
                ))}
              </div>

              <label className="folder-modal-label" style={{ marginTop: '.75rem' }}>Icône</label>
              <div className="folder-icon-grid">
                {ICON_KEYS.map(key => {
                  const c = ICON_COLORS.find(x => x.key === modalColorKey) || ICON_COLORS[0];
                  const active = key === modalIconKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`folder-icon-opt${active ? ' selected' : ''}`}
                      style={active ? { background: c.bg, borderColor: c.hex, color: c.hex } : {}}
                      onClick={() => setModalIconKey(key)}
                      title={key}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {ICON_DEFS[key]}
                      </svg>
                    </button>
                  );
                })}
              </div>

              <div className="icon-preview">
                <FolderIconBadge icon={buildIcon(modalIconKey, modalColorKey)} size={52} />
                <span className="icon-preview-label">{modalName || 'Aperçu'}</span>
              </div>
            </div>
            <div className="folder-modal-actions">
              <button className="ghost-btn" onClick={() => setModalOpen(false)}>Annuler</button>
              <button className="act-btn purple" onClick={handleModalConfirm} disabled={modalSaving}>
                {modalMode === 'rename' ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

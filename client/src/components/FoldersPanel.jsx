import { useState, useEffect, useRef } from 'react';
import toast from '../utils/toast';
import { useConfirm } from './ConfirmModal';

const FOLDER_ICONS = ['📁','📂','💊','🧬','⚗️','⚡','📐','💻','🔬','⚖️','🏛️','📿','💉','🧪','📜','🎵','🌍','🩺','📊','🧮'];

export default function FoldersPanel({ onGoUpload }) {
  const confirm = useConfirm();
  const [folders, setFolders] = useState([]);
  const [view, setView] = useState('list');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [modalName, setModalName] = useState('');
  const [modalIcon, setModalIcon] = useState('📁');
  const [modalSaving, setModalSaving] = useState(false);
  const modalNameRef = useRef(null);

  async function loadFolders() {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch {
      setFolders([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFolders();
    window.__refreshFolders = loadFolders;
    return () => { delete window.__refreshFolders; };
  }, []);

  useEffect(() => {
    if (modalOpen) setTimeout(() => modalNameRef.current?.focus(), 50);
  }, [modalOpen]);

  async function openDetail(folder) {
    setCurrentFolder(folder);
    setView('detail');
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

  async function deleteFile(fileId) {
    await fetch(`/api/folders/${currentFolder.id}/files/${fileId}`, { method: 'DELETE' });
    setFolderFiles(prev => prev.filter(f => f.id !== fileId));
    setFolders(prev => prev.map(f =>
      f.id === currentFolder.id ? { ...f, file_count: Math.max(0, f.file_count - 1) } : f
    ));
  }

  function openCreateModal() {
    setModalMode('create');
    setModalName('');
    setModalIcon('📁');
    setModalOpen(true);
  }

  function openRenameModal() {
    setModalMode('rename');
    setModalName(currentFolder.name);
    setModalIcon(currentFolder.icon || '📁');
    setModalOpen(true);
  }

  async function handleModalConfirm() {
    if (!modalName.trim() || modalSaving) return;
    setModalSaving(true);
    try {
      if (modalMode === 'rename') {
        const res = await fetch(`/api/folders/${currentFolder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modalName.trim(), icon: modalIcon }),
        });
        const data = await res.json();
        if (data.error) { toast.error(data.error); return; }
        await loadFolders();
        setCurrentFolder(f => ({ ...f, name: modalName.trim(), icon: modalIcon }));
      } else {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modalName.trim(), icon: modalIcon }),
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
    const files = folderFiles.map(f => ({
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
                <span className="folder-card-icon">{f.icon}</span>
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
            <h3 className="folder-detail-title">{currentFolder.icon} {currentFolder.name}</h3>
          </div>

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
              return (
                <div key={f.id} className="folder-file-item">
                  <span className="file-ext">{ext}</span>
                  <span className="folder-file-name">{f.orig_name}</span>
                  <span className="folder-file-date">{date}</span>
                  <button className="folder-file-del" onClick={() => deleteFile(f.id)} title="Retirer"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
              );
            })}
          </div>

          {!filesLoading && folderFiles.length > 0 && (
            <div className="folder-actions-bar">
              <button className="act-btn purple" onClick={useFiles}>Utiliser ces cours →</button>
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
              <label className="folder-modal-label">Icône</label>
              <div className="folder-icon-grid">
                {FOLDER_ICONS.map(ic => (
                  <div
                    key={ic}
                    className={`folder-icon-opt${ic === modalIcon ? ' selected' : ''}`}
                    onClick={() => setModalIcon(ic)}
                  >
                    {ic}
                  </div>
                ))}
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

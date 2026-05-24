import { useState, useEffect } from 'react';
import { useConfirm } from './ConfirmModal';
import eventBus from '../utils/eventBus';
import toast from '../utils/toast';

export default function LibraryPanel() {
  const confirm = useConfirm();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');

  async function loadFiles() {
    setLoading(true);
    try {
      const res = await fetch('/api/folders/files/all');
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
    return eventBus.on('folders:refresh', loadFiles);
  }, []);

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filtered = files.filter(f =>
    f.orig_name.toLowerCase().includes(search.toLowerCase()) ||
    f.folder_name.toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(f => f.id)));
    }
  }

  async function deleteFile(f) {
    const ok = await confirm(`Retirer « ${f.orig_name} » de « ${f.folder_name} » ?`, {
      confirmLabel: 'Retirer', danger: true,
    });
    if (!ok) return;
    await fetch(`/api/folders/${f.folder_id}/files/${f.id}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(x => x.id !== f.id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(f.id); return n; });
    eventBus.emit('folders:refresh');
    toast.success('Cours retiré.');
  }

  function useSelected() {
    const src = selectedIds.size > 0
      ? files.filter(f => selectedIds.has(f.id))
      : filtered;
    if (!src.length) { toast.warn('Aucun cours à utiliser.'); return; }
    const mapped = src.map(f => ({
      id: f.filename, name: f.orig_name, path: '', text: f.text || '', size: f.size,
    }));
    window.__setFolderFiles?.(mapped);
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  // Group by folder for display
  const byFolder = filtered.reduce((acc, f) => {
    const key = f.folder_id;
    if (!acc[key]) acc[key] = { id: f.folder_id, name: f.folder_name, icon: f.folder_icon, files: [] };
    acc[key].files.push(f);
    return acc;
  }, {});
  const groups = Object.values(byFolder);

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-label">Tous les cours</div>
          <h2 className="panel-title">Ma <em>bibliothèque</em></h2>
        </div>
        {filtered.length > 1 && (
          <button className="ghost-btn" style={{ fontSize: '.74rem' }} onClick={toggleSelectAll}>
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        )}
      </div>

      <input
        type="search"
        className="input-field lib-search"
        placeholder="Rechercher par nom ou matière…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1.5rem' }}>Chargement…</p>
      )}

      {!loading && files.length === 0 && (
        <div className="folders-empty">
          Aucun cours dans vos matières pour l&apos;instant.<br />
          Ajoutez des cours depuis « Mes matières ».
        </div>
      )}

      {!loading && files.length > 0 && filtered.length === 0 && (
        <div className="folders-empty">Aucun résultat pour cette recherche.</div>
      )}

      {selectedIds.size > 0 && (
        <div className="lib-sel-bar">
          <span>{selectedIds.size} cours sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
          <button className="ghost-btn" style={{ fontSize: '.74rem' }} onClick={() => setSelectedIds(new Set())}>Effacer</button>
        </div>
      )}

      <div className="lib-groups">
        {groups.map(group => (
          <div key={group.id} className="lib-group">
            <div className="lib-group-header">
              <span className="lib-group-icon">{group.icon}</span>
              <span className="lib-group-name">{group.name}</span>
              <span className="lib-group-count">{group.files.length} cours</span>
            </div>
            {group.files.map(f => {
              const ext = f.orig_name.split('.').pop().toUpperCase();
              const date = new Date(f.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
              const selected = selectedIds.has(f.id);
              return (
                <div
                  key={f.id}
                  className={`folder-file-item lib-item${selected ? ' file-selected' : ''}`}
                  onClick={() => toggleSelect(f.id)}
                >
                  <input
                    type="checkbox"
                    className="file-checkbox"
                    checked={selected}
                    onChange={() => toggleSelect(f.id)}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="file-ext">{ext}</span>
                  <span className="folder-file-name">{f.orig_name}</span>
                  <span className="folder-file-date">{date}</span>
                  <button
                    className="folder-file-del"
                    onClick={e => { e.stopPropagation(); deleteFile(f); }}
                    title="Retirer"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="folder-actions-bar">
          <button className="act-btn purple" onClick={useSelected}>
            {selectedIds.size > 0
              ? `Utiliser ${selectedIds.size} cours sélectionné${selectedIds.size > 1 ? 's' : ''} →`
              : 'Utiliser tous les cours affichés →'}
          </button>
        </div>
      )}
    </>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../utils/apiFetch';
import toast from '../utils/toast';

/**
 * Modal « Enregistrer dans une matière » affiché après chaque upload.
 *
 * Props :
 *   filesToSave  {Array|null}  fichiers à classer (null = modal fermée)
 *   onClose      {Function}    callback pour fermer (remet filesToSave à null)
 */
export default function SaveFolderModal({ filesToSave, onClose }) {
  const [folders,  setFolders]  = useState([]);
  const [newName,  setNewName]  = useState('');
  const [saving,   setSaving]   = useState(false);

  const visible = Boolean(filesToSave);
  const files   = useMemo(() => filesToSave || [], [filesToSave]);

  const close = useCallback(() => onClose?.(), [onClose]);

  const fetchFolders = useCallback(async () => {
    try {
      const res  = await apiFetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch {
      setFolders([]);
    }
  }, []);

  // Charger les matières dès que la modal s'ouvre
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewName('');
    fetchFolders();
  }, [visible, fetchFolders]);

  const saveToFolder = useCallback(async (folderId) => {
    setSaving(true);
    try {
      await apiFetch(`/api/folders/${folderId}/files`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map(f => ({ id: f.id, name: f.name, size: f.size, text: f.text })),
        }),
      });
      toast.success('Cours enregistré dans la matière.');
      close();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }, [files, close]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res  = await apiFetch('/api/folders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setNewName('');
      await saveToFolder(data.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }, [newName, saveToFolder]);

  if (!visible) return null;

  return (
    <div
      className="modal-overlay"
      id="save-folder-modal"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="modal-box modal-sm">
        <div className="modal-header">
          <h2>Enregistrer dans une <em>matière</em></h2>
          <p>Classez ces fichiers pour les retrouver facilement</p>
        </div>

        <div id="save-folder-list">
          {folders.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: '.78rem', padding: '.5rem 0' }}>
              Aucune matière. Créez-en une ci-dessous.
            </p>
          ) : (
            folders.map(f => (
              <div
                key={f.id}
                className="save-folder-item"
                onClick={() => !saving && saveToFolder(f.id)}
              >
                <span className="save-folder-item-icon">{f.icon}</span>
                <span className="save-folder-item-name">{f.name}</span>
                <span className="save-folder-item-check" />
              </div>
            ))
          )}
        </div>

        <div className="save-folder-new">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Nouvelle matière..."
            className="input-field"
            disabled={saving}
          />
          <button className="ghost-btn" onClick={handleCreate} disabled={saving}>
            Créer
          </button>
        </div>

        <div className="modal-footer">
          <button className="ghost-btn" onClick={close}>Passer</button>
        </div>
      </div>
    </div>
  );
}

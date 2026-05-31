import { useRef, useState } from 'react';
import { useUpload } from '../hooks/useUpload';

/**
 * Zone de dépôt + liste de fichiers + bouton upload.
 *
 * Props :
 *   onUploaded(files)  — appelé quand l'upload serveur réussit
 *   onError(msg)       — appelé en cas d'erreur
 */
export default function UploadZone({ onUploaded, onError }) {
  const { selectedFiles, uploading, addFiles, removeFile, upload } = useUpload();
  const inputRef   = useRef(null);
  const [dragging, setDragging] = useState(false);

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  function onDragOver(e)  { e.preventDefault(); setDragging(true);  }
  function onDragLeave()  { setDragging(false); }
  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }
  function onZoneClick(e) {
    if (e.target === inputRef.current) return;
    inputRef.current?.click();
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    try {
      const files = await upload();
      if (files) onUploaded(files);
    } catch (err) {
      onError?.(err.message);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatSize(bytes) {
    return bytes > 1024 * 1024
      ? (bytes / 1024 / 1024).toFixed(1) + ' Mo'
      : (bytes / 1024).toFixed(0) + ' Ko';
  }

  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  return (
    <>
      <h2 className="panel-title">Charger vos <em>fichiers</em></h2>
      <p className="panel-desc">
        Importez vos cours en PDF, PPT, PPTX ou DOCX —{' '}
        jusqu&apos;à <span>{isLocal ? '50 Mo' : '20 Mo'}</span> par fichier
      </p>

      {/* Drop zone */}
      <div
        className={`drop-zone${dragging ? ' drag-over' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Zone de dépôt de fichiers — cliquez ou appuyez sur Entrée pour parcourir"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onZoneClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      >
        <div className="drop-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p className="drop-main">Glissez vos fichiers ici</p>
        <p className="drop-or">ou</p>
        <label className="dz-btn" htmlFor="file-input-react" onClick={e => e.stopPropagation()}>
          Parcourir
        </label>
        <input
          ref={inputRef}
          type="file"
          id="file-input-react"
          multiple
          accept=".pdf,.ppt,.pptx,.docx"
          hidden
          onChange={e => addFiles(e.target.files)}
        />
        <p className="drop-hint">PDF · PPT · PPTX · DOCX</p>
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <div id="file-list">
          {selectedFiles.map((f, i) => {
            const ext = f.name.split('.').pop().toUpperCase();
            return (
              <div key={f.name} className="file-item">
                <div className="file-item-left">
                  <span className="file-ext">{ext}</span>
                  <span className="file-item-name">{f.name}</span>
                  <span className="file-size">{formatSize(f.size)}</span>
                </div>
                <button
                  type="button"
                  className="remove"
                  aria-label={`Retirer ${f.name}`}
                  onClick={() => removeFile(i)}
                >✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload button */}
      <button
        className="act-btn gold full"
        disabled={selectedFiles.length === 0 || uploading}
        onClick={handleUpload}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>{' '}
        {uploading ? 'Chargement…' : 'Charger les fichiers'}
      </button>
    </>
  );
}

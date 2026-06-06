import { useRef, useState } from 'react';
import { useUpload } from '../hooks/useUpload';
import toast from '../utils/toast';

const PLAN_MB = { free: 5, pro: 10, max: 20 };
const PLAN_MAX_FILES = { free: 3, pro: 5, max: 10 };

export default function UploadZone({ onUploaded, onError, userPlan }) {
  const { selectedFiles, uploading, progress, addFiles, removeFile, upload } = useUpload();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const maxMb = isLocal ? 50 : (PLAN_MB[userPlan] ?? PLAN_MB.free);
  const maxBytes = maxMb * 1024 * 1024;
  const maxFiles = isLocal ? 20 : (PLAN_MAX_FILES[userPlan] ?? PLAN_MAX_FILES.free);

  function showError(msg) {
    if (onError) onError(msg);
    else toast.error(msg);
  }

  function handleFilesAdded(files) {
    const { tooLargeCount, unsupportedCount, tooManyCount } = addFiles(files, maxBytes, maxFiles);
    if (tooLargeCount > 0) {
      showError(`Certains fichiers depassent la taille maximale autorisee de ${maxMb} Mo pour votre plan.`);
    }
    if (unsupportedCount > 0) {
      showError('Format non pris en charge. Utilisez PDF, PPTX ou DOCX. Les anciens fichiers .ppt doivent etre exportes en PPTX ou PDF.');
    }
    if (tooManyCount > 0) {
      showError(`Votre plan permet ${maxFiles} fichier${maxFiles > 1 ? 's' : ''} par import.`);
    }
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  }

  function onZoneClick(e) {
    if (e.target === inputRef.current) return;
    inputRef.current?.click();
  }

  async function handleUpload() {
    try {
      const files = await upload();
      if (files) onUploaded(files);
    } catch (err) {
      showError(err.message);
    }
  }

  function formatSize(bytes) {
    return bytes > 1024 * 1024
      ? (bytes / 1024 / 1024).toFixed(1) + ' Mo'
      : (bytes / 1024).toFixed(0) + ' Ko';
  }

  return (
    <>
      <h2 className="panel-title">Charger vos <em>fichiers</em></h2>
      <p className="panel-desc">
        Importez vos cours en PDF, PPTX ou DOCX - jusqu&apos;a <span>{maxMb} Mo</span> par fichier,
        {' '}<span>{maxFiles}</span> fichier{maxFiles > 1 ? 's' : ''} par import
      </p>

      <div
        className={`drop-zone${dragging ? ' drag-over' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Zone de depot de fichiers - cliquez ou appuyez sur Entree pour parcourir"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onZoneClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
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
          accept=".pdf,.pptx,.docx"
          hidden
          onChange={e => handleFilesAdded(e.target.files)}
        />
        <p className="drop-hint">PDF · PPTX · DOCX</p>
      </div>

      {selectedFiles.length > 0 && (
        <div id="file-list" style={{ marginTop: '1.25rem' }}>
          {selectedFiles.map((f, i) => {
            const ext = f.name.split('.').pop().toUpperCase();
            return (
              <div key={`${f.name}-${f.size}-${f.lastModified}`} className="file-item">
                <div className="file-item-left">
                  <span className="file-ext">{ext}</span>
                  <span className="file-item-name">{f.name}</span>
                  <span className="file-size">{formatSize(f.size)}</span>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    className="remove"
                    aria-label={`Retirer ${f.name}`}
                    onClick={() => removeFile(i)}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="upload-actions" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {uploading ? (
            <div className="progress-container" style={{ width: '100%', animation: 'fadeIn 0.3s ease' }}>
              <div className="progress-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem', fontFamily: 'DM Mono, monospace' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="spinner" style={{ width: '12px', height: '12px', border: '1.5px solid var(--muted)', borderTopColor: 'var(--gold)', animation: 'spin 0.8s linear infinite' }} />
                  Analyse et transmission...
                </span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar-bg" style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #c99a3a 0%, #e8be5e 100%)',
                    boxShadow: '0 0 12px var(--gold-glow)',
                    borderRadius: '99px',
                    transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="act-btn gold full"
              onClick={handleUpload}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Lancer l&apos;analyse ({selectedFiles.length} {selectedFiles.length > 1 ? 'fichiers' : 'fichier'})
            </button>
          )}
        </div>
      )}
    </>
  );
}

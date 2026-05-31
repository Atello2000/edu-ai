import { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';

const ALLOWED_EXTS = ['pdf', 'ppt', 'pptx', 'docx'];

/**
 * Gère la sélection de fichiers et l'appel à POST /api/upload.
 */
export function useUpload() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading,     setUploading]     = useState(false);

  function addFiles(files) {
    const valid = Array.from(files).filter(f =>
      ALLOWED_EXTS.includes(f.name.split('.').pop().toLowerCase())
    );
    setSelectedFiles(prev => {
      const next = [...prev];
      valid.forEach(f => { if (!next.find(x => x.name === f.name)) next.push(f); });
      return next;
    });
  }

  function removeFile(index) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  /**
   * Envoie les fichiers sélectionnés au serveur.
   * Retourne le tableau des fichiers uploadés ({ id, name, size, text }).
   * Lance une Error si le serveur répond avec une erreur.
   */
  async function upload() {
    if (!selectedFiles.length) return null;
    setUploading(true);
    const form = new FormData();
    selectedFiles.forEach(f => form.append('files', f));
    try {
      const res  = await apiFetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erreur upload');
      setSelectedFiles([]);
      return data.files;
    } finally {
      setUploading(false);
    }
  }

  return { selectedFiles, uploading, addFiles, removeFile, upload };
}

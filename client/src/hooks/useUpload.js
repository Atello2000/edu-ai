import { useState } from 'react';
import { ensureCsrfToken } from '../utils/apiFetch';

const ALLOWED_EXTS = ['pdf', 'ppt', 'pptx', 'docx'];

/**
 * Gère la sélection de fichiers et l'appel à POST /api/upload.
 */
export function useUpload() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading,     setUploading]     = useState(false);
  const [progress,      setProgress]      = useState(0);

  function addFiles(files, maxSizeBytes = null) {
    let tooLargeCount = 0;
    const valid = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      const isAllowed = ALLOWED_EXTS.includes(ext);
      if (!isAllowed) return false;
      if (maxSizeBytes && f.size > maxSizeBytes) {
        tooLargeCount++;
        return false;
      }
      return true;
    });
    setSelectedFiles(prev => {
      const next = [...prev];
      valid.forEach(f => { if (!next.find(x => x.name === f.name)) next.push(f); });
      return next;
    });
    return tooLargeCount;
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
    setProgress(0);
    const form = new FormData();
    selectedFiles.forEach(f => form.append('files', f));

    try {
      await ensureCsrfToken(); // Garantit que le cookie CSRF est bien présent avant l'appel
      const files = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        xhr.withCredentials = true;

        // Suivi de la progression en temps réel
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
          }
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
              resolve(data.files);
            } else {
              reject(new Error(data.error || `Erreur serveur (${xhr.status})`));
            }
          } catch {
            reject(new Error('Erreur de traitement du serveur.'));
          }
        };

        xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload.'));
        xhr.send(form);
      });
      setSelectedFiles([]);
      return files;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return { selectedFiles, uploading, progress, addFiles, removeFile, upload };
}

import { useState } from 'react';
import { ensureCsrfToken } from '../utils/apiFetch';

const ALLOWED_EXTS = ['pdf', 'ppt', 'pptx', 'docx'];

/**
 * Gere la selection de fichiers et l'appel a POST /api/upload.
 */
export function useUpload() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function addFiles(files, maxSizeBytes = null, maxFiles = null) {
    let tooLargeCount = 0;
    let unsupportedCount = 0;

    const valid = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        unsupportedCount++;
        return false;
      }
      if (maxSizeBytes && f.size > maxSizeBytes) {
        tooLargeCount++;
        return false;
      }
      return true;
    });

    const existingKeys = new Set(selectedFiles.map(f => `${f.name}|${f.size}|${f.lastModified}`));
    const uniqueValid = valid.filter(f => !existingKeys.has(`${f.name}|${f.size}|${f.lastModified}`));
    const slots = maxFiles ? Math.max(maxFiles - selectedFiles.length, 0) : uniqueValid.length;
    const accepted = uniqueValid.slice(0, slots);
    const tooManyCount = Math.max(0, uniqueValid.length - accepted.length);

    setSelectedFiles(prev => {
      const next = [...prev];
      accepted.forEach(f => {
        const exists = next.find(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified);
        if (exists) return;
        next.push(f);
      });
      return next;
    });

    return { tooLargeCount, unsupportedCount, tooManyCount };
  }

  function removeFile(index) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  function uploadOne(file, index, total) {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('files', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round(((index + (e.loaded / e.total)) / total) * 100);
          setProgress(pct);
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.success) {
            resolve(data.files || []);
          } else {
            reject(new Error(`${file.name} : ${data.error || `Erreur serveur (${xhr.status})`}`));
          }
        } catch {
          reject(new Error(`${file.name} : erreur de traitement du serveur.`));
        }
      };

      xhr.onerror = () => reject(new Error(`${file.name} : erreur reseau lors de l'upload.`));
      xhr.send(form);
    });
  }

  /**
   * Envoie les fichiers un par un pour eviter les limites de payload du proxy.
   */
  async function upload() {
    if (!selectedFiles.length) return null;
    setUploading(true);
    setProgress(0);

    try {
      await ensureCsrfToken();
      const uploaded = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const files = await uploadOne(selectedFiles[i], i, selectedFiles.length);
        uploaded.push(...files);
      }
      setSelectedFiles([]);
      setProgress(100);
      return uploaded;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return { selectedFiles, uploading, progress, addFiles, removeFile, upload };
}

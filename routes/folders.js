const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── List user folders (with file count) ──────────────────────────────────────
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT f.id, f.name, f.icon, f.created_at,
           COUNT(ff.id) AS file_count
    FROM folders f
    LEFT JOIN folder_files ff ON ff.folder_id = f.id
    WHERE f.user_id = ?
    GROUP BY f.id
    ORDER BY f.name COLLATE NOCASE
  `).all(req.user.id);
  res.json({ folders: rows });
});

// ── Create folder ────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, icon } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
  try {
    const info = db.prepare('INSERT INTO folders (user_id, name, icon) VALUES (?, ?, ?)')
      .run(req.user.id, name.trim(), icon || '📁');
    res.json({ id: info.lastInsertRowid, name: name.trim(), icon: icon || '📁' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cette matière existe déjà' });
    throw e;
  }
});

// ── Rename / change icon ─────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  const { name, icon } = req.body;
  const folder = db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Dossier introuvable' });
  if (name) {
    try {
      db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim(), folder.id);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce nom existe déjà' });
      throw e;
    }
  }
  if (icon) db.prepare('UPDATE folders SET icon = ? WHERE id = ?').run(icon, folder.id);
  res.json({ ok: true });
});

// ── Delete folder ────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Dossier introuvable' });
  res.json({ ok: true });
});

// ── List files in a folder ───────────────────────────────────────────────────
router.get('/:id/files', (req, res) => {
  const folder = db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Dossier introuvable' });
  const files = db.prepare(
    'SELECT id, filename, orig_name, size, text, created_at FROM folder_files WHERE folder_id = ? ORDER BY orig_name COLLATE NOCASE'
  ).all(folder.id);
  res.json({ files });
});

// ── Save files to a folder (from upload) ─────────────────────────────────────
router.post('/:id/files', (req, res) => {
  const folder = db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Dossier introuvable' });

  const { files } = req.body;
  if (!files || !files.length) return res.status(400).json({ error: 'Aucun fichier' });

  const insert = db.prepare(
    'INSERT OR IGNORE INTO folder_files (folder_id, filename, orig_name, size, text) VALUES (?, ?, ?, ?, ?)'
  );
  const tx = db.transaction((items) => {
    for (const f of items) {
      insert.run(folder.id, f.id || f.filename, f.name || f.orig_name, f.size || 0, f.text || '');
    }
  });
  tx(files);
  res.json({ ok: true });
});

// ── Remove a file from a folder ──────────────────────────────────────────────
router.delete('/:folderId/files/:fileId', (req, res) => {
  const folder = db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(req.params.folderId, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Dossier introuvable' });
  db.prepare('DELETE FROM folder_files WHERE id = ? AND folder_id = ?')
    .run(req.params.fileId, folder.id);
  res.json({ ok: true });
});

module.exports = router;

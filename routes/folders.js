const express = require('express');
const router  = express.Router();
const { prepare } = require('../db');

const LIBRARY_LIMITS = { free: 15, pro: 50, max: 100 };

// ── List user folders (with file count) ──────────────────────────────────────
router.get('/', async (req, res) => {
  const rows = await prepare(`
    SELECT f.id, f.name, f.icon, f.created_at,
           COUNT(ff.id) AS file_count
    FROM folders f
    LEFT JOIN folder_files ff ON ff.folder_id = f.id
    WHERE f.user_id = ?
    GROUP BY f.id
    ORDER BY LOWER(f.name)
  `).all(req.user.id);
  res.json({ folders: rows });
});

// ── Create folder ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, icon } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
  try {
    const info = await prepare('INSERT INTO folders (user_id, name, icon) VALUES (?, ?, ?)')
      .run(req.user.id, name.trim(), icon || '📁');
    res.json({ id: info.lastInsertRowid, name: name.trim(), icon: icon || '📁' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Cette matière existe déjà' });
    throw e;
  }
});

// ── Rename / change icon ─────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { name, icon } = req.body;
  const folder = await prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Dossier introuvable' });
  if (name) {
    try {
      await prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim(), folder.id);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Ce nom existe déjà' });
      throw e;
    }
  }
  if (icon) await prepare('UPDATE folders SET icon = ? WHERE id = ?').run(icon, folder.id);
  res.json({ ok: true });
});

// ── Delete folder ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const info = await prepare('DELETE FROM folders WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Dossier introuvable' });
  res.json({ ok: true });
});

// ── List ALL files across all folders (library) ──────────────────────────────
router.get('/files/all', async (req, res) => {
  const files = await prepare(`
    SELECT ff.id, ff.filename, ff.orig_name, ff.size, ff.text, ff.truncated, ff.created_at,
           f.id AS folder_id, f.name AS folder_name, f.icon AS folder_icon
    FROM folder_files ff
    JOIN folders f ON f.id = ff.folder_id
    WHERE f.user_id = ?
    ORDER BY LOWER(f.name), LOWER(ff.orig_name)
  `).all(req.user.id);
  const plan  = req.user?.plan || 'free';
  const limit = LIBRARY_LIMITS[plan] ?? LIBRARY_LIMITS.free;
  res.json({ files, used: files.length, limit });
});

// ── List files in a folder ───────────────────────────────────────────────────
router.get('/:id/files', async (req, res) => {
  const folder = await prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Dossier introuvable' });
  const files = await prepare(
    'SELECT id, filename, orig_name, size, text, truncated, created_at FROM folder_files WHERE folder_id = ? ORDER BY LOWER(orig_name)'
  ).all(folder.id);
  res.json({ files });
});

// ── Save files to a folder (from upload) ─────────────────────────────────────
router.post('/:id/files', async (req, res) => {
  const folder = await prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Dossier introuvable' });

  const { files } = req.body;
  if (!files || !files.length) return res.status(400).json({ error: 'Aucun fichier' });

  const plan  = req.user?.plan || 'free';
  const limit = LIBRARY_LIMITS[plan] ?? LIBRARY_LIMITS.free;
  const row   = await prepare(`
    SELECT COUNT(*) AS count FROM folder_files ff
    JOIN folders f ON f.id = ff.folder_id WHERE f.user_id = ?
  `).get(req.user.id);
  const used = Number(row?.count ?? 0);
  if (used + files.length > limit) {
    return res.status(403).json({
      error: `Limite de bibliothèque atteinte (${used}/${limit} cours). Supprimez des cours ou passez à un plan supérieur.`,
      limit,
      used,
    });
  }

  for (const f of files) {
    await prepare(
      'INSERT INTO folder_files (folder_id, filename, orig_name, size, text, truncated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (folder_id, filename) DO NOTHING'
    ).run(folder.id, f.id || f.filename, f.name || f.orig_name, f.size || 0, f.text || '', f.truncated ? 1 : 0);
  }
  res.json({ ok: true });
});

// ── Remove a file from a folder ──────────────────────────────────────────────
router.delete('/:folderId/files/:fileId', async (req, res) => {
  const folder = await prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?')
    .get(req.params.folderId, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Dossier introuvable' });
  await prepare('DELETE FROM folder_files WHERE id = ? AND folder_id = ?')
    .run(req.params.fileId, folder.id);
  res.json({ ok: true });
});

module.exports = router;

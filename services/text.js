const path = require('path');
const fs   = require('fs');
const pdfParse     = require('pdf-parse');
const officeParser = require('officeparser');

const ROOT       = path.resolve(__dirname, '..');
const uploadsDir = path.join(ROOT, 'uploads');
const coursesDir = path.join(ROOT, 'courses');

// LRU cache with a hard memory cap (200 MB).
// Oldest entries are evicted first when the cap is reached.
class LRUTextCache {
  constructor(maxBytes) {
    this.maxBytes   = maxBytes;
    this._map       = new Map(); // key -> { text, bytes }
    this.totalBytes = 0;
  }

  has(key) { return this._map.has(key); }

  get(key) {
    if (!this._map.has(key)) return undefined;
    const entry = this._map.get(key);
    // Refresh to most-recently-used position
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.text;
  }

  set(key, text) {
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > this.maxBytes) return; // single file larger than cap — skip
    // Remove existing entry to reset its position
    if (this._map.has(key)) {
      this.totalBytes -= this._map.get(key).bytes;
      this._map.delete(key);
    }
    // Evict oldest entries until there is room
    while (this.totalBytes + bytes > this.maxBytes && this._map.size > 0) {
      const oldest = this._map.keys().next().value;
      this.totalBytes -= this._map.get(oldest).bytes;
      this._map.delete(oldest);
    }
    this._map.set(key, { text, bytes });
    this.totalBytes += bytes;
  }

  delete(key) {
    if (this._map.has(key)) {
      this.totalBytes -= this._map.get(key).bytes;
      this._map.delete(key);
    }
  }

  // Yield [key, entry] pairs so existing `for (const [p] of textCache)` works
  [Symbol.iterator]() { return this._map[Symbol.iterator](); }
}

const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB
const textCache = new LRUTextCache(MAX_CACHE_BYTES);

async function extractText(filePath, originalName) {
  const resolved = path.resolve(filePath);
  if (
    !resolved.startsWith(uploadsDir + path.sep) &&
    !resolved.startsWith(coursesDir + path.sep) &&
    resolved !== uploadsDir &&
    resolved !== coursesDir
  ) {
    throw new Error('Accès non autorisé au fichier');
  }

  if (textCache.has(resolved)) return textCache.get(resolved);

  const ext = path.extname(originalName).toLowerCase();
  let text;
  if (ext === '.pdf') {
    const buffer = fs.readFileSync(resolved);
    const data   = await pdfParse(buffer);
    text = data.text;
  } else {
    text = await new Promise((resolve, reject) => {
      officeParser.parseOffice(resolved, (data, err) => {
        if (err) reject(new Error(String(err)));
        else resolve(data);
      });
    });
  }

  textCache.set(resolved, text);
  return text;
}

// Purge entries whose file has been deleted from disk
setInterval(() => {
  for (const [p] of textCache) if (!fs.existsSync(p)) textCache.delete(p);
}, 3600000);

async function extractTextFromBuffer(buffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  return new Promise((resolve, reject) => {
    officeParser.parseOffice(buffer, (data, err) => {
      if (err) reject(new Error(String(err)));
      else resolve(data);
    });
  });
}

module.exports = { extractText, extractTextFromBuffer, textCache };

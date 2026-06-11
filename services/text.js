const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const pdfParse     = require('pdf-parse');
const officeParser = require('officeparser');
const AdmZip       = require('adm-zip');
const {
  getGeminiApiKey,
  isGeminiCoolingDown,
  markGeminiRateLimited,
} = require('./geminiKey');
const logger = require('./logger');

async function fetchGeminiWithRetry(url, options, retries = 2) {
  if (isGeminiCoolingDown()) return null;
  let delay = 1500;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 503) {
        markGeminiRateLimited();
        logger.warn(`Gemini REST API rate-limited (${res.status}); cooling down before fallback.`);
        return res;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        logger.warn(`Gemini REST API network error (${err.message}, attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

const OFFICE_PARSER_CONFIG = { tempFilesLocation: os.tmpdir() };
const execFileAsync = promisify(execFile);

const OCR_THRESHOLD   = 200;   // PDF avec peu de texte → probablement scanné
const MIN_IMAGE_BYTES = 5000;  // Ignorer les images < 5 Ko (icônes, décorations)
const MAX_IMAGES      = 30;    // Max images analysées par document
const BATCH_SIZE      = 1;     // Gemini free tier is RPM-sensitive; avoid request bursts.
const PPT_TEXT_THRESHOLD = 80; // Minimum utile pour accepter un ancien .ppt

// ── Gemini Vision — description d'une image via l'API REST ───────────────────
async function describeImageWithGemini(base64, mimeType) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetchGeminiWithRetry(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        // Clé en header (pas en query string) : les URLs fuient dans les logs de proxy
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Décris ce schéma, figure ou graphique en français pour un étudiant (axes, labels, relations, données visibles). Si c\'est purement décoratif (logo, fond, icône), réponds uniquement "décoratif".' },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ]
          }],
          generationConfig: { maxOutputTokens: 400 },
        }),
      }
    );
    if (!res || !res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return text.toLowerCase() === 'décoratif' || !text ? null : text;
  } catch { return null; }
}

// ── Extraction d'images depuis PPTX / DOCX (format ZIP) ─────────────────────
const OFFICE_MEDIA = { '.pptx': 'ppt/media/', '.docx': 'word/media/', '.ppt': null };
const IMAGE_EXTS   = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']);
const MIME_MAP     = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp' };

// ── Protection ZIP bomb ───────────────────────────────────────────────────────
const MAX_ZIP_ENTRIES    = 1000;              // entrées max dans l'archive
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024; // 50 Mo décompressé max

/**
 * Valide les métadonnées ZIP sans décompresser aucune entrée.
 * entry.header.size = uncompressedSize déclaré dans le Central Directory.
 * Lève une erreur si l'archive est trop complexe ou trop volumineuse.
 */
function assertSafeZip(entries) {
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`Document trop complexe : ${entries.length} entrées ZIP (max ${MAX_ZIP_ENTRIES}).`);
  }
  let totalUncompressed = 0;
  for (const e of entries) {
    totalUncompressed += (e.header.size || 0);
    if (totalUncompressed > MAX_UNZIPPED_BYTES) {
      throw new Error(`Document trop volumineux une fois décompressé (max ${MAX_UNZIPPED_BYTES / 1024 / 1024} Mo).`);
    }
  }
}

// ── Parseur SmartArt (ppt/diagrams/data*.xml) ─────────────────────────────────
function parseSmartArt(xml) {
  const texts = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]+)<\/a:t>/g)]
    .map(m => m[1].trim()).filter(Boolean);
  const unique = [...new Set(texts)];
  if (!unique.length) return null;
  // Détecter les connexions pour inférer le type (processus, hiérarchie...)
  const hasCxn = xml.includes('<dgm:cxn');
  const type   = hasCxn ? 'Diagramme de processus' : 'Diagramme SmartArt';
  return `[${type} : ${unique.join(' → ')}]`;
}

// ── Parseur graphiques DrawingML (ppt/charts/*.xml, word/charts/*.xml) ─────────
function parseChartXml(xml) {
  const TYPE_MAP = {
    barChart: 'Histogramme', pieChart: 'Camembert', lineChart: 'Courbe',
    scatterChart: 'Nuage de points', areaChart: 'Aires', doughnutChart: 'Anneau',
    radarChart: 'Radar', bubbleChart: 'Bulles', stockChart: 'Boursier',
  };
  const typeMatch = xml.match(/<c:(barChart|pieChart|lineChart|scatterChart|areaChart|doughnutChart|radarChart|bubbleChart|stockChart)/);
  const chartType = typeMatch ? (TYPE_MAP[typeMatch[1]] || typeMatch[1]) : 'Graphique';

  const titleMatch = xml.match(/<c:title>[\s\S]*?<a:t[^>]*>([^<]+)<\/a:t>/);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const series = [...xml.matchAll(/<c:ser>[\s\S]*?<c:tx>[\s\S]*?<a:t[^>]*>([^<]+)<\/a:t>/g)]
    .map(m => m[1].trim()).filter(Boolean);

  const cats = [...xml.matchAll(/<c:cat>[\s\S]*?<c:v>([^<]+)<\/c:v>/g)]
    .map(m => m[1].trim()).filter(Boolean).slice(0, 8);

  const vals = [...xml.matchAll(/<c:val>[\s\S]*?<c:v>([^<]+)<\/c:v>/g)]
    .map(m => m[1].trim()).filter(Boolean).slice(0, 8);

  let desc = `[${chartType}`;
  if (title)       desc += ` — "${title}"`;
  if (series.length) desc += ` — Séries : ${series.join(', ')}`;
  if (cats.length)   desc += ` — Catégories : ${cats.join(', ')}`;
  if (vals.length && series.length <= 1) desc += ` — Valeurs : ${vals.join(', ')}`;
  return desc + ']';
}

async function extractAndDescribeOfficeImages(buffer, ext) {
  const mediaDir = OFFICE_MEDIA[ext];
  if (!mediaDir && ext !== '.pptx' && ext !== '.docx') return '';
  try {
    const zip  = new AdmZip(buffer);
    const all  = zip.getEntries();

    // ── Garde anti-ZIP bomb (lecture headers uniquement, sans décompression) ──
    assertSafeZip(all);

    const descriptions = [];

    // ── 1. Images raster (photos, figures, logos) ──────────────────────────────
    if (mediaDir) {
      const imgEntries = all
        .filter(e =>
          e.entryName.startsWith(mediaDir) &&
          IMAGE_EXTS.has(path.extname(e.entryName).toLowerCase()) &&
          e.getData().length >= MIN_IMAGE_BYTES
        )
        .sort((a, b) => b.getData().length - a.getData().length)
        .slice(0, MAX_IMAGES);

      for (let i = 0; i < imgEntries.length; i += BATCH_SIZE) {
        const batch = imgEntries.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async entry => {
          const imgExt = path.extname(entry.entryName).toLowerCase();
          const mime   = MIME_MAP[imgExt] || 'image/png';
          const desc   = await describeImageWithGemini(entry.getData().toString('base64'), mime);
          return desc ? `[Figure : ${desc}]` : null;
        }));
        descriptions.push(...results.filter(Boolean));
      }
    }

    // ── 2. SmartArt (PPTX : ppt/diagrams/data*.xml) ───────────────────────────
    if (ext === '.pptx') {
      all.filter(e => /^ppt\/diagrams\/data\d*\.xml$/i.test(e.entryName))
         .forEach(e => {
           const desc = parseSmartArt(e.getData().toString('utf8'));
           if (desc) descriptions.push(desc);
         });
    }

    // ── 3. Graphiques DrawingML (PPTX + DOCX) ─────────────────────────────────
    const chartPattern = ext === '.pptx'
      ? /^ppt\/charts\/chart\d*\.xml$/i
      : /^word\/charts\/chart\d*\.xml$/i;
    all.filter(e => chartPattern.test(e.entryName))
       .forEach(e => {
         const desc = parseChartXml(e.getData().toString('utf8'));
         if (desc) descriptions.push(desc);
       });

    return descriptions.length
      ? '\n\n--- Schémas, figures et graphiques ---\n' + descriptions.join('\n\n')
      : '';
  } catch { return ''; }
}

async function withTempDir(fn) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jangalai-ppt-'));
  try {
    return await fn(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function possibleOfficeCommands() {
  if (process.env.LIBREOFFICE_PATH) return [process.env.LIBREOFFICE_PATH];
  return process.platform === 'win32'
    ? ['soffice.exe', 'libreoffice.exe', 'soffice', 'libreoffice']
    : ['soffice', 'libreoffice'];
}

async function convertPptWithLibreOffice(buffer, originalName) {
  return withTempDir(async dir => {
    const input = path.join(dir, path.basename(originalName || 'presentation.ppt'));
    await fs.promises.writeFile(input, buffer);

    for (const cmd of possibleOfficeCommands()) {
      try {
        await execFileAsync(
          cmd,
          ['--headless', '--convert-to', 'pptx', '--outdir', dir, input],
          { timeout: 45000, windowsHide: true, maxBuffer: 1024 * 1024 }
        );
        const files = await fs.promises.readdir(dir);
        const converted = files.find(name => path.extname(name).toLowerCase() === '.pptx');
        if (!converted) continue;
        const pptxBuffer = await fs.promises.readFile(path.join(dir, converted));
        const text = await _extractCore(pptxBuffer, '.pptx', converted);
        return text?.trim() || null;
      } catch (_) {
        // LibreOffice is optional. Try the next binary name, then use fallback.
      }
    }
    return null;
  });
}

function normalizeLegacyPptChunk(value) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsefulLegacyPptChunk(value) {
  if (value.length < 4 || value.length > 500) return false;
  if (!/\p{L}/u.test(value)) return false;
  if (/^[\d\s._,;:!?()[\]{}'"-]+$/.test(value)) return false;
  if (/(PowerPoint Document|Current User|SummaryInformation|DocumentSummaryInformation|Root Entry|Ole10Native)/i.test(value)) {
    return false;
  }
  const letters = (value.match(/\p{L}/gu) || []).length;
  const controls = (value.match(/[\u0000-\u001f]/g) || []).length;
  return letters >= 2 && controls === 0;
}

function extractLegacyPptStrings(buffer) {
  const chunks = [];
  const seen = new Set();

  function push(value) {
    const normalized = normalizeLegacyPptChunk(value);
    const key = normalized.toLowerCase();
    if (!isUsefulLegacyPptChunk(normalized) || seen.has(key)) return;
    seen.add(key);
    chunks.push(normalized);
  }

  const latin = buffer.toString('latin1');
  for (const match of latin.matchAll(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s.,;:!?'"()[\]{}%€$+\-/]{3,}/g)) {
    push(match[0]);
  }

  function isLegacyPptTextCode(code) {
    return code === 9 || code === 10 || code === 13 ||
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255) ||
      [0x0152, 0x0153, 0x0178, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x20ac].includes(code);
  }

  function scanUtf16(offset) {
    let current = '';
    for (let i = offset; i + 1 < buffer.length; i += 2) {
      const code = buffer.readUInt16LE(i);
      if (isLegacyPptTextCode(code)) {
        current += String.fromCharCode(code);
        if (current.length > 500) {
          push(current);
          current = '';
        }
      } else {
        push(current);
        current = '';
      }
    }
    push(current);
  }

  scanUtf16(0);
  scanUtf16(1);

  return chunks.join('\n');
}

async function extractLegacyPpt(buffer, originalName) {
  const converted = await convertPptWithLibreOffice(buffer, originalName);
  if (converted && converted.trim().length >= PPT_TEXT_THRESHOLD) return converted;

  const fallback = extractLegacyPptStrings(buffer);
  if (fallback.trim().length >= PPT_TEXT_THRESHOLD) return fallback;

  throw new Error(
    'Impossible de lire suffisamment de texte dans cet ancien fichier .ppt. '
    + 'Il est peut-être composé surtout d’images, protégé ou corrompu. '
    + 'Essayez de l’exporter en PDF ou PPTX.'
  );
}

// Mistral OCR via l'API REST directe (pas de SDK ESM incompatible)
async function ocrWithMistral(buffer, originalName) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  let fileId = null;
  try {
    // 1. Upload du fichier (multipart/form-data)
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/pdf' }), originalName);
    form.append('purpose', 'ocr');

    const uploadRes = await fetch('https://api.mistral.ai/v1/files', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form,
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    const uploaded = await uploadRes.json();
    fileId = uploaded.id;

    // 2. Signed URL (expiry 1h)
    const urlRes = await fetch(`https://api.mistral.ai/v1/files/${fileId}/url?expiry=1`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!urlRes.ok) throw new Error(`Signed URL failed: ${urlRes.status}`);
    const { url } = await urlRes.json();

    // 3. OCR
    const ocrRes = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: { type: 'document_url', document_url: url },
      }),
    });
    if (!ocrRes.ok) throw new Error(`OCR failed: ${ocrRes.status}`);
    const ocr = await ocrRes.json();

    const text = (ocr.pages || []).map(p => p.markdown || '').join('\n\n').trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    require('./logger').warn('Mistral OCR failed', { message: err?.message });
    return null;
  } finally {
    // Nettoyage asynchrone
    if (fileId) {
      fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }).catch(() => {});
    }
  }
}

// ── Détection d'images dans un PDF (scan binaire, $0, ~0.1ms) ────────────────
// Couvre : XObject images (/Subtype /Image), inline images (BI...ID...EI)
function pdfHasImages(buffer) {
  return buffer.includes(Buffer.from('/Subtype /Image'))  // XObject standard
      || buffer.includes(Buffer.from('/Subtype/Image'))   // sans espace
      || buffer.includes(Buffer.from('\nBI\n'))           // inline image begin
      || buffer.includes(Buffer.from('\nBI '))            // inline image begin variante
      || buffer.includes(Buffer.from(' BI\n'));           // inline image begin variante
}

const GEMINI_INLINE_LIMIT = 15 * 1024 * 1024; // 15 Mo — marge sous la limite API de 20 Mo

// ── Gemini : extraction complète d'un PDF scanné (texte + figures) ────────────
async function ocrPdfWithGemini(buffer) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  if (buffer.length > GEMINI_INLINE_LIMIT) return null; // trop grand pour inline data
  try {
    const base64 = buffer.toString('base64');
    const res = await fetchGeminiWithRetry(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extrais tout le texte de ce document en markdown. Inclus les tableaux, formules et légendes des figures. Sois exhaustif.' },
              { inline_data: { mime_type: 'application/pdf', data: base64 } },
            ]
          }],
          generationConfig: { maxOutputTokens: 8192 },
        }),
      }
    );
    if (!res || !res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return text.length > OCR_THRESHOLD ? text : null;
  } catch { return null; }
}

// ── Gemini : description des figures d'un PDF texte (sans ré-extraire le texte)
async function describePdfFiguresWithGemini(buffer) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  if (buffer.length > GEMINI_INLINE_LIMIT) return null;
  try {
    const base64 = buffer.toString('base64');
    const res = await fetchGeminiWithRetry(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Ce document contient du texte et des figures. Décris uniquement les figures, schémas, graphiques, tableaux visuels et formules mathématiques présents. Pour chaque élément visuel, donne une description détaillée en français (axes, labels, données, relations). Ignore le texte ordinaire. Si aucune figure significative, réponds "aucune figure".' },
              { inline_data: { mime_type: 'application/pdf', data: base64 } },
            ]
          }],
          generationConfig: { maxOutputTokens: 4096 },
        }),
      }
    );
    if (!res || !res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text || text.toLowerCase().includes('aucune figure')) return null;
    return text;
  } catch { return null; }
}

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

// Logique d'extraction partagée entre extractText (fichier) et extractTextFromBuffer (buffer direct)
async function _extractCore(buffer, ext, originalName) {
  if (ext === '.pdf') {
    const data    = await pdfParse(buffer);
    const rawText = data.text?.trim() || '';
    if (rawText.length < OCR_THRESHOLD) {
      // Pas d'appel réseau OCR pendant les tests : résultats non déterministes
      // (rate limits Gemini, hallucinations OCR sur PDF vide) et coût API.
      if (process.env.NODE_ENV === 'test') return rawText;
      const ocrText = await ocrPdfWithGemini(buffer)
        || (process.env.MISTRAL_API_KEY ? await ocrWithMistral(buffer, originalName) : null);
      return ocrText || rawText;
    }
    if (pdfHasImages(buffer)) {
      const figDesc = await describePdfFiguresWithGemini(buffer);
      return figDesc ? rawText + '\n\n--- Schémas et figures ---\n' + figDesc : rawText;
    }
    return rawText;
  }
  if (ext === '.ppt') {
    return extractLegacyPpt(buffer, originalName);
  }
  // Garde anti-ZIP bomb AVANT officeParser : c'est lui qui décompresse
  // l'archive en premier — la même garde dans extractAndDescribeOfficeImages
  // arriverait trop tard pour protéger la mémoire du serveur.
  if (ext === '.docx' || ext === '.pptx') {
    assertSafeZip(new AdmZip(buffer).getEntries());
  }
  const ast = await officeParser.parseOffice(buffer, OFFICE_PARSER_CONFIG);
  const { value: parsed } = await ast.to('md');
  let text = parsed || '';
  const imageDesc = await extractAndDescribeOfficeImages(buffer, ext);
  if (imageDesc) text += imageDesc;
  return text;
}

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

  const ext    = path.extname(originalName).toLowerCase();
  const buffer = await fs.promises.readFile(resolved);
  const text   = await _extractCore(buffer, ext, originalName);

  textCache.set(resolved, text);
  return text;
}

// Purge entries whose file has been deleted from disk
setInterval(() => {
  for (const [p] of textCache) if (!fs.existsSync(p)) textCache.delete(p);
}, 3600000).unref();

async function extractTextFromBuffer(buffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  return _extractCore(buffer, ext, originalName);
}

module.exports = { extractText, extractTextFromBuffer, textCache };

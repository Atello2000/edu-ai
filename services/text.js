const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const officeParser = require('officeparser');

const textCache = new Map();

const ROOT       = path.resolve(__dirname, '..');
const uploadsDir = path.join(ROOT, 'uploads');
const coursesDir = path.join(ROOT, 'courses');

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
    const data = await pdfParse(buffer);
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

// Purge les entrées dont le fichier a été supprimé du disque
setInterval(() => {
  for (const [p] of textCache) if (!fs.existsSync(p)) textCache.delete(p);
}, 3600000);

module.exports = { extractText, textCache };

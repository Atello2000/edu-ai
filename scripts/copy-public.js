/**
 * copy-public.js
 * Copies files from root public/ into client/dist/ after the Vite build.
 * This ensures that /app.js, /sw.js, /manifest.json, /icon.svg and /style.css
 * are served as static CDN assets by Vercel (not through the serverless function).
 */

const fs   = require('fs');
const path = require('path');

const src  = path.join(__dirname, '..', 'public');
const dest = path.join(__dirname, '..', 'client', 'dist');

const FILES = ['app.js', 'icon.svg', 'manifest.json', 'style.css', 'sw.js'];

if (!fs.existsSync(dest)) {
  console.error(`[copy-public] ERROR: output directory not found: ${dest}`);
  process.exit(1);
}

FILES.forEach(file => {
  const srcFile  = path.join(src, file);
  const destFile = path.join(dest, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`[copy-public] Copied: ${file}`);
  } else {
    console.warn(`[copy-public] Skip (not found): ${file}`);
  }
});

/**
 * copy-public.js
 * Copies files from root public/ into client/dist/ after the Vite build.
 * This ensures that /sw.js, /manifest.json and /icon.svg
 * are served as static CDN assets by Vercel (not through the serverless function).
 */

const fs   = require('fs');
const path = require('path');

const src  = path.join(__dirname, '..', 'public');
const dest = path.join(__dirname, '..', 'client', 'dist');

// robots.txt, sitemap.xml et og-image.jpg sont indispensables au SEO et aux
// aperçus sociaux — sans eux Vercel renvoie index.html pour ces URLs.
const FILES = ['icon.svg', 'manifest.json', 'sw.js', 'robots.txt', 'sitemap.xml', 'og-image.jpg', 'logo.svg'];

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

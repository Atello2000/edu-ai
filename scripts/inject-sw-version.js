/**
 * inject-sw-version.js
 * Bakes a unique cache version into public/sw.js at build time.
 *
 * Why: Vercel serves public/sw.js as a static CDN file, so the Express
 * handler that does the replacement at request time is never reached.
 * By replacing __CACHE_VERSION__ here, the deployed sw.js always carries
 * a unique key → browser detects a changed SW byte-for-byte → auto-updates
 * → no more Ctrl+Shift+R needed.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');

// Use git commit SHA (most stable), fall back to timestamp
let version;
try {
  version = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (_) {
  version = String(Date.now());
}

// Also fold in a timestamp so even a re-deploy of the same commit
// (e.g. env-var change, manual redeploy) triggers an SW update.
const cacheKey = `${version}-${Date.now()}`;

let content = fs.readFileSync(swPath, 'utf8');

if (!content.includes('__CACHE_VERSION__')) {
  console.error('[inject-sw-version] WARNING: __CACHE_VERSION__ placeholder not found in sw.js — skipping.');
  process.exit(0);
}

content = content.replace('__CACHE_VERSION__', cacheKey);
fs.writeFileSync(swPath, content, 'utf8');

console.log(`[inject-sw-version] ✓ Cache version injected: jangalai-${cacheKey}`);

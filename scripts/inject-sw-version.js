/**
 * inject-sw-version.js
 * Bakes a unique cache version into public/sw.js at build time.
 *
 * Vercel serves public/sw.js as a static CDN file, so the Express handler
 * that can inject a version at request time is not always reached. This
 * script updates the CACHE constant idempotently on every build.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');

let version;
try {
  version = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (_) {
  version = String(Date.now());
}

const cacheKey = `${version}-${Date.now()}`;
const cacheDeclaration = `const CACHE = 'jangalai-${cacheKey}';`;
let content = fs.readFileSync(swPath, 'utf8');

if (/const CACHE = 'jangalai-[^']+';/.test(content)) {
  content = content.replace(/const CACHE = 'jangalai-[^']+';/, cacheDeclaration);
} else if (content.includes('__CACHE_VERSION__')) {
  content = content.replace('__CACHE_VERSION__', cacheKey);
} else {
  console.error('[inject-sw-version] ERROR: Could not find CACHE declaration in sw.js.');
  process.exit(1);
}

fs.writeFileSync(swPath, content, 'utf8');

console.log(`[inject-sw-version] Cache version injected: jangalai-${cacheKey}`);

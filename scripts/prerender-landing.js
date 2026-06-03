/**
 * scripts/prerender-landing.js
 * Génère public/landing-prerender.html — snapshot statique de la landing page
 * pour les robots d'indexation Google/Bing (dynamic rendering).
 *
 * Usage (après npm run build) :
 *   node scripts/prerender-landing.js
 *
 * Appelé automatiquement par le script "build" dans package.json.
 */
const path = require('path');
const fs   = require('fs');

const OUT  = path.join(__dirname, '..', 'public', 'landing-prerender.html');
const DIST = path.join(__dirname, '..', 'client', 'dist');

// Vérifie que puppeteer est disponible (absent en production Railway — devDependency)
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch {
  console.warn('⚠ prerender-landing : puppeteer non disponible (devDependency, normal en production). Ignoré.');
  process.exit(0);
}

const http    = require('http');
const express = require('express');

if (!fs.existsSync(DIST)) {
  console.warn('⚠ client/dist introuvable — lance npm run build d\'abord.');
  process.exit(0);
}

(async () => {
  // Démarre un mini-serveur Express pour servir le build React
  const miniApp = express();
  miniApp.use(express.static(DIST));
  miniApp.get('*', (_, res) => res.sendFile(path.join(DIST, 'index.html')));
  const server = http.createServer(miniApp);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 30000 });

    // Attend que le contenu principal soit rendu
    await page.waitForSelector('h1, .hero-title, main', { timeout: 10000 }).catch(() => {});

    let html = await page.content();

    // Injecte un tag pour distinguer la version pre-rendue
    html = html.replace('</head>', '  <meta name="prerendered" content="true">\n</head>');

    fs.writeFileSync(OUT, html, 'utf8');
    console.log(`✓ landing-prerender.html généré (${Math.round(html.length / 1024)}KB) → ${OUT}`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(err => {
  console.error('Prerender échoué :', err.message);
  process.exit(0); // Ne bloque pas le build
});

/**
 * scripts/prerender-landing.js
 * Prerendering statique des pages publiques pour le SEO et les aperçus sociaux.
 *
 * Contrairement à l'ancienne approche "dynamic rendering" (un fichier séparé
 * landing-prerender.html servi aux bots par user-agent dans app.js), qui ne
 * fonctionnait que du temps où un serveur Node servait le front (Railway),
 * ce script écrit le HTML rendu DIRECTEMENT dans les fichiers servis par Vercel.
 * Ainsi crawlers (Bing, crawlers IA, aperçus sociaux qui n'exécutent pas le JS)
 * ET utilisateurs reçoivent du contenu réel — React reprend la main au montage.
 *
 * Usage (après npm run build) :
 *   node scripts/prerender-landing.js
 *
 * Appelé automatiquement par le script "build" dans package.json.
 * Dégradation gracieuse : si puppeteer est absent ou échoue, le build continue
 * avec la SPA normale (process.exit(0)) — on ne casse jamais un déploiement.
 */
const path = require('path');
const fs   = require('fs');

const DIST = path.join(__dirname, '..', 'client', 'dist');

// Pages publiques statiques à prerender. /share/:token est dynamique (contenu
// dépendant du token via l'API) → hors périmètre, nécessiterait une injection
// d'OG côté backend.
const ROUTES = [
  { route: '/',                out: 'index.html' },
  { route: '/cgu',             out: path.join('cgu', 'index.html') },
  { route: '/confidentialite', out: path.join('confidentialite', 'index.html') },
];

// Vérifie que puppeteer est disponible (devDependency — peut manquer selon l'env)
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch {
  console.warn('⚠ prerender : puppeteer non disponible (devDependency). Ignoré, SPA normale.');
  process.exit(0);
}

const http    = require('http');
const express = require('express');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.warn('⚠ client/dist/index.html introuvable — lance npm run build d\'abord. Ignoré.');
  process.exit(0);
}

(async () => {
  // Mini-serveur statique pour servir le build React à Chrome headless.
  const miniApp = express();
  miniApp.use(express.static(DIST));
  miniApp.get('*', (_, res) => res.sendFile(path.join(DIST, 'index.html')));
  const server = http.createServer(miniApp);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const { route, out } of ROUTES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      // SEO : la version pré-rendue est toujours en français (langue canonique),
      // quelle que soit la locale du Chrome headless. On force avant que React
      // ne lise getLang().
      await page.evaluateOnNewDocument(() => {
        try { localStorage.setItem('jangalai-prefs', JSON.stringify({ lang: 'fr' })); } catch { /* ignore */ }
      });

      // Coupe les requêtes non pertinentes pour le snapshot statique (API, SW) :
      // elles échouent sur le mini-serveur et pourraient faire traîner le rendu.
      await page.setRequestInterception(true);
      page.on('request', req => {
        const url = req.url();
        if (url.includes('/api/') || url.endsWith('/sw.js')) return req.abort();
        req.continue();
      });

      await page.goto(`${base}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
      // Attend que le contenu principal soit rendu.
      await page.waitForSelector('h1, .hero-title, main', { timeout: 10000 }).catch(() => {});

      let html = await page.content();
      // Tag pour distinguer une page pré-rendue (debug / vérif).
      html = html.replace('</head>', '  <meta name="prerendered" content="true">\n</head>');

      const outPath = path.join(DIST, out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`✓ prerender ${route} → dist/${out.replace(/\\/g, '/')} (${Math.round(html.length / 1024)}KB)`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch(err => {
  console.error('Prerender échoué :', err.message);
  process.exit(0); // Ne bloque jamais le build.
});

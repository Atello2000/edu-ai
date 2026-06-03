/**
 * Génère public/og-image.png depuis public/og-preview.html
 * Usage : node scripts/generate-og.js
 * Dépendance : npm install puppeteer --save-dev
 */
const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

const HTML_PATH = path.join(__dirname, '..', 'public', 'og-preview.html');
const OUT_PATH  = path.join(__dirname, '..', 'public', 'og-image.jpg');
const W = 1200;
const H = 630;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.goto(`file:///${HTML_PATH.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: OUT_PATH, type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: W, height: H } });
    console.log(`✓ og-image.png généré → ${OUT_PATH}`);
  } finally {
    await browser.close();
  }
})();

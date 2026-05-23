import { stripMd } from './summaryUtils.js';

/**
 * Génère et télécharge la fiche d'examen en PDF.
 * @param {string} fileName  — nom de base du fichier (sans extension)
 * @param {string} md        — contenu markdown de la fiche
 */
export async function exportExamSheetToPDF(fileName, md) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) throw new Error('jsPDF non chargé');

  const pdf = new jsPDF('p', 'mm', 'a4');
  const PW  = pdf.internal.pageSize.getWidth();
  const PH  = pdf.internal.pageSize.getHeight();
  const ML  = 14, MR = 14, CW = PW - ML - MR, LH = 5.5;

  const C = {
    dark:   [15,  21,  36],
    text:   [26,  32,  53],
    muted:  [100, 116, 139],
    border: [221, 227, 240],
    bg:     [244, 246, 251],
    white:  [255, 255, 255],
    gold:   [212, 169, 76],
    teal:   [29,  209, 161],
  };
  const goldBg = [253, 246, 220];

  let y = 0, pageNum = 1;

  const setRgb   = c => pdf.setTextColor(c[0], c[1], c[2]);
  const setFill  = c => pdf.setFillColor(c[0], c[1], c[2]);
  const setDraw  = c => pdf.setDrawColor(c[0], c[1], c[2]);
  const fillRect = (x, yy, w, h, c) => { setFill(c); pdf.rect(x, yy, w, h, 'F'); };
  const hline    = (x1, yy, x2, c, lw = 0.3) => { setDraw(c); pdf.setLineWidth(lw); pdf.line(x1, yy, x2, yy); };
  const wrap     = (t, maxW) => pdf.splitTextToSize(String(t), maxW);

  function drawHeader(isFirst) {
    const bH = isFirst ? 40 : 13;
    fillRect(0, 0, PW, bH, C.dark);
    fillRect(0, bH, PW, 1.5, C.gold);
    if (isFirst) {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); setRgb([212, 169, 76]);
      pdf.text('JANGALAI', ML, 11, { charSpace: 2.5 });
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); setRgb([232, 236, 246]);
      pdf.text(wrap(fileName, CW), ML, 24);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); setRgb([168, 184, 208]);
      const d = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      pdf.text(d + '  ·  Fiche générée par Jangalai', ML, 36);
    } else {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); setRgb([200, 210, 230]);
      pdf.text(fileName, ML, 9);
    }
    y = bH + 1.5 + 7;
  }

  function drawFooter() {
    hline(ML, PH - 11, PW - MR, C.border);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); setRgb(C.muted);
    pdf.text('Jangalai', ML, PH - 6.5);
    pdf.text(`Page ${pageNum}`, PW - MR, PH - 6.5, { align: 'right' });
  }

  function newPage() { drawFooter(); pdf.addPage(); pageNum++; drawHeader(false); }
  function need(h)   { if (y + h > PH - 16) newPage(); }

  function renderTable(tableLines) {
    const rows = tableLines
      .filter(l => !/^\|[\s\-:|]+\|$/.test(l.trim()))
      .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim().replace(/\*\*(.+?)\*\*/g, '$1')));
    if (!rows.length) return;

    const cols = Math.max(...rows.map(r => r.length));
    const colW = CW / cols;
    const pad  = 2;
    const cellW = colW - pad * 2; // en mm, unité du document

    rows.forEach((row, ri) => {
      if (ri === 0) { pdf.setFont('helvetica', 'bold');   pdf.setFontSize(8);   }
      else          { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); }
      let maxL = 1;
      row.forEach(cell => { maxL = Math.max(maxL, wrap(cell, cellW).length); });
      const rH = maxL * LH + 5;
      need(rH + 1);
      fillRect(ML, y, CW, rH, ri === 0 ? goldBg : ri % 2 === 0 ? C.bg : C.white);
      row.forEach((cell, ci) => {
        if (ri === 0) { pdf.setFont('helvetica', 'bold');   pdf.setFontSize(8);   setRgb(C.gold); }
        else          { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); setRgb(C.text); }
        pdf.text(wrap(cell, cellW), ML + ci * colW + pad, y + LH);
        if (ci < cols - 1) {
          setDraw(C.border); pdf.setLineWidth(0.2);
          pdf.line(ML + (ci + 1) * colW, y, ML + (ci + 1) * colW, y + rH);
        }
      });
      hline(ML, y + rH, ML + CW, ri === 0 ? C.gold : C.border, ri === 0 ? 0.5 : 0.2);
      setDraw(C.border); pdf.setLineWidth(0.2);
      pdf.line(ML, y, ML, y + rH);
      pdf.line(ML + CW, y, ML + CW, y + rH);
      if (ri === 0) hline(ML, y, ML + CW, C.gold, 0.4);
      y += rH;
    });
    y += 5;
  }

  drawHeader(true);
  const mdLines = md.split('\n');
  let tableBuffer = [];

  function flushTable() {
    if (tableBuffer.length) { renderTable(tableBuffer); tableBuffer = []; }
  }

  for (const raw of mdLines) {
    const line = raw.trimEnd();

    if (line.startsWith('|')) { tableBuffer.push(line); continue; }
    flushTable();

    if (!line) { y += 2.5; continue; }

    if (/^##\s/.test(line)) {
      const t = stripMd(line); need(14); y += 3;
      fillRect(ML, y, CW, 10, goldBg); fillRect(ML, y, 3, 10, C.gold);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); setRgb(C.gold);
      pdf.text(wrap(t, CW - 10), ML + 6, y + 7); y += 15; continue;
    }
    if (/^###\s/.test(line)) {
      const t = stripMd(line); need(12); y += 2;
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); setRgb(C.gold);
      pdf.text(wrap(t, CW), ML, y + LH);
      hline(ML, y + LH + 2, ML + CW, [240, 225, 180]);
      y += 11; continue;
    }
    if (line.startsWith('> ')) {
      const t = stripMd(line.slice(2));
      const wl = wrap(t, CW - 8);
      const bH = wl.length * LH + 6; need(bH + 4);
      fillRect(ML, y, CW, bH, [235, 252, 248]); fillRect(ML, y, 2.5, bH, C.teal);
      pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9); setRgb(C.text);
      pdf.text(wl, ML + 5, y + LH); y += bH + 5; continue;
    }
    const numM = line.match(/^(\d+)\.\s(.*)/);
    if (numM) {
      const lbl = numM[1] + '.';
      const lw  = pdf.getTextWidth(lbl) + 2;
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); setRgb(C.gold); need(LH + 3);
      pdf.text(lbl, ML, y + LH);
      pdf.setFont('helvetica', 'normal'); setRgb(C.text);
      const tl = wrap(numM[2].replace(/\*\*(.+?)\*\*/g, '$1'), CW - lw - 2);
      need(tl.length * LH + 2); pdf.text(tl, ML + lw + 2, y + LH);
      y += tl.length * LH + 2; continue;
    }
    if (/^[-*+]\s/.test(line)) {
      const inner = line.replace(/^[-*+]\s/, '').replace(/\*\*(.+?)\*\*/g, '$1');
      const wl = wrap(inner, CW - 7); need(wl.length * LH + 2);
      setFill(C.gold); pdf.circle(ML + 1.5, y + LH - 1.2, 1, 'F');
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); setRgb(C.text);
      pdf.text(wl, ML + 5, y + LH); y += wl.length * LH + 2; continue;
    }
    const t = stripMd(line);
    if (!t) continue;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); setRgb(C.text);
    const wl = wrap(t, CW); need(wl.length * LH + 2);
    pdf.text(wl, ML, y + LH); y += wl.length * LH + 2;
  }
  flushTable();
  drawFooter();
  pdf.save(fileName + '_fiche-examen.pdf');
}

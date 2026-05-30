/**
 * summaryPdf.js — export PDF d'un résumé via jsPDF (bundlé npm).
 */
import { jsPDF } from 'jspdf';
import { buildSummarySections, stripMd, sanitizePdf } from './summaryUtils';

/**
 * @param {string} fileName  Nom de base du fichier (sans extension)
 * @param {string} summaryMd Markdown complet du résumé
 * @returns {Promise<void>}
 */
export function buildSummaryDoc(fileName, summaryMd) {
  const pdf = new jsPDF('p', 'mm', 'a4');

  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const ML = 14, MR = 14;
  const CW = PW - ML - MR;
  const LH = 5.5;

  const C = {
    dark:    [15,  21,  36 ], text:    [26,  32,  53 ],
    muted:   [100, 116, 139], border:  [221, 227, 240],
    bg:      [244, 246, 251], white:   [255, 255, 255],
    blue:    [61,  126, 255], purple:  [167, 139, 250],
    teal:    [29,  209, 161], emerald: [52,  211, 153],
    gold:    [212, 169, 76 ],
  };

  const SEC_COL = {
    'section-objectifs': C.blue,
    'section-points':    C.purple,
    'section-resume':    C.emerald,
    'section-concepts':  C.gold,
    'section-retenir':   C.teal,
  };

  let y = 0, pageNum = 1;

  const setRgb   = c => pdf.setTextColor(c[0], c[1], c[2]);
  const setFill  = c => pdf.setFillColor(c[0], c[1], c[2]);
  const setDraw  = c => pdf.setDrawColor(c[0], c[1], c[2]);
  const fillRect = (x, yy, w, h, c) => { setFill(c); pdf.rect(x, yy, w, h, 'F'); };
  const hline    = (x1, yy, x2, c, lw = 0.3) => { setDraw(c); pdf.setLineWidth(lw); pdf.line(x1, yy, x2, yy); };

  const wrap = (text, maxW) => pdf.splitTextToSize(sanitizePdf(String(text)), maxW);

  function drawHeader(isFirst) {
    const bandH = isFirst ? 40 : 13;
    fillRect(0, 0, PW, bandH, C.dark);
    fillRect(0, bandH, PW, 1.5, C.purple);
    if (isFirst) {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5);
      setRgb([167, 139, 250]);
      pdf.text('JANGALAI', ML, 11, { charSpace: 2.5 });
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15);
      setRgb([232, 236, 246]);
      pdf.text(wrap(fileName, CW), ML, 24);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
      setRgb([168, 184, 208]);
      const d = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      pdf.text(d + '  ·  Résumé généré par Jangalai', ML, 36);
    } else {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7);
      setRgb([200, 210, 230]);
      pdf.text(fileName, ML, 9);
    }
    y = bandH + 1.5 + 7;
  }

  function drawFooter() {
    hline(ML, PH - 11, PW - MR, C.border);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
    setRgb(C.muted);
    pdf.text('Jangalai', ML, PH - 6.5);
    pdf.text(`Page ${pageNum}`, PW - MR, PH - 6.5, { align: 'right' });
  }

  function newPage() {
    drawFooter(); pdf.addPage(); pageNum++;
    drawHeader(false);
  }

  function need(h) { if (y + h > PH - 16) newPage(); }

  function renderSection(section) {
    const col  = SEC_COL[section.cls] || C.muted;
    const PL   = ML + 5;
    const bodW = CW - 5;

    need(16);
    const cleanTitle = sanitize(
      section.title
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[🎯📌📖🔑💡✦●▶→•◆■□▪★☆◉]/gu, '')
        .trim()
    );
    // Style épuré : onglet d'accent coloré + titre foncé + filet coloré dessous
    fillRect(ML, y, 2.6, 6.5, col);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11.5);
    setRgb(C.dark);
    pdf.text(cleanTitle, ML + 6, y + 5.3);
    hline(ML, y + 9, ML + CW, col, 0.5);
    y += 9 + 6;

    function renderLine(rawLine, indentX, maxW) {
      const leadBold = rawLine.match(/^\*\*([^*]+)\*\*\s*:?\s*(.*)/s);
      if (leadBold) {
        const term = leadBold[1].trim();
        const def  = leadBold[2].trim();
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); setRgb(C.text);
        const termW     = pdf.getTextWidth(term + ' : ');
        const termLines = wrap(term + ' :', indentX === PL ? bodW : maxW);
        pdf.text(termLines[0], indentX, y + LH);
        if (def) {
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5);
          const defW   = maxW - (termLines[0].length > term.length + 2 ? 0 : termW);
          const defX   = termLines[0].length > term.length + 2 ? indentX : indentX + termW;
          const defLines = wrap(def, defW);
          pdf.text(defLines, defX, y + LH);
          y += Math.max(termLines.length, defLines.length) * LH + 2;
        } else {
          y += termLines.length * LH + 2;
        }
        return;
      }
      const fullBold = rawLine.match(/^\*\*(.+)\*\*$/);
      if (fullBold) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); setRgb(C.text);
        const lines = wrap(fullBold[1], maxW);
        need(lines.length * LH + 2);
        pdf.text(lines, indentX, y + LH);
        y += lines.length * LH + 2;
        return;
      }
      const text = stripMd(rawLine);
      if (!text) return;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); setRgb(C.text);
      const lines = wrap(text, maxW);
      need(lines.length * LH + 2);
      pdf.text(lines, indentX, y + LH);
      y += lines.length * LH + 2;
    }

    for (const raw of section.lines) {
      const line = raw.trimEnd();
      if (!line || /^--+$/.test(line)) { y += 2.5; continue; }

      if (line.startsWith('> ')) {
        const text  = stripMd(line.slice(2));
        const lines = wrap(text, bodW - 10);
        const bH    = lines.length * LH + 3;
        need(bH + 4);
        fillRect(PL, y, 2, bH, col);
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9.5);
        setRgb(C.muted);
        pdf.text(lines, PL + 6, y + LH);
        y += bH + 5;
        continue;
      }

      if (/^#{1,6}\s/.test(line)) {
        const text = stripMd(line);
        need(13); y += 3;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
        setRgb(C.text);
        pdf.text(text, PL, y + LH);
        y += 11;
        continue;
      }

      const numMatch = line.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        const numLabel = numMatch[1] + '.';
        const numW     = pdf.getTextWidth(numLabel) + 2;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); setRgb(col);
        need(LH + 3);
        pdf.text(numLabel, PL, y + LH);
        pdf.setFont('helvetica', 'normal'); setRgb(C.text);
        const textLines = wrap(numMatch[2].replace(/\*\*(.+?)\*\*/g, '$1'), bodW - numW - 2);
        need(textLines.length * LH + 2);
        pdf.text(textLines, PL + numW + 2, y + LH);
        y += textLines.length * LH + 2;
        continue;
      }

      if (/^[-*+]\s/.test(line)) {
        const inner = line.replace(/^[-*+]\s/, '');
        const innerClean = inner.replace(/\*\*(.+?)\*\*/g, '$1');
        const lines = wrap(innerClean, bodW - 7);
        need(lines.length * LH + 2);
        setFill(col); pdf.circle(PL + 1.5, y + LH - 1.2, 1, 'F');
        if (/^\*\*[^*]+\*\*/.test(inner)) {
          const m = inner.match(/^\*\*([^*]+)\*\*\s*:?\s*(.*)/s);
          if (m) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); setRgb(C.text);
            const tw = pdf.getTextWidth(m[1] + ': ');
            pdf.text(m[1] + ':', PL + 5, y + LH);
            pdf.setFont('helvetica', 'normal');
            const dl = wrap(m[2], bodW - 7 - tw);
            pdf.text(dl, PL + 5 + tw, y + LH);
            y += Math.max(1, dl.length) * LH + 2;
            continue;
          }
        }
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); setRgb(C.text);
        pdf.text(lines, PL + 5, y + LH);
        y += lines.length * LH + 2;
        continue;
      }

      need(LH + 2);
      renderLine(line, PL, bodW);
    }

    y += 8;
  }

  drawHeader(true);
  buildSummarySections(summaryMd).forEach(renderSection);
  drawFooter();
  return pdf;
}

export async function exportSummaryToPDF(fileName, summaryMd) {
  buildSummaryDoc(fileName, summaryMd).save(fileName + '_résumé.pdf');
}

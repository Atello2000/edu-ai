/**
 * quizPdf.js — export PDF d'un quiz QCM via jsPDF.
 */
import { jsPDF } from 'jspdf';
import { sanitizePdf } from './summaryUtils';

const C = {
  dark:   [15,  21,  36],
  text:   [26,  32,  53],
  muted:  [100, 116, 139],
  border: [221, 227, 240],
  bg:     [244, 246, 251],
  blue:   [61,  126, 255],
  green:  [29,  209, 161],
  red:    [229, 57,  53],
  gold:   [212, 169, 76],
  white:  [255, 255, 255],
};

/**
 * Exporte les questions QCM en PDF.
 * @param {string} title     — nom du cours / titre du quiz
 * @param {Array}  questions — [{question, options, answer, explanation}]
 * @param {Object} answers   — { [idx]: letter } réponses de l'utilisateur (optionnel)
 * @param {Object} score     — { correct, total } (optionnel)
 */
export function exportQuizToPDF(title, questions, answers = {}, score = null) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const ML = 14, MR = 14;
  const CW = PW - ML - MR;
  let y = 14;

  function setRgb(c) { pdf.setTextColor(...c); }
  function fillRect(x, yy, w, h, c) { pdf.setFillColor(...c); pdf.rect(x, yy, w, h, 'F'); }

  function need(h) {
    if (y + h > PH - 14) {
      pdf.addPage();
      y = 14;
    }
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  fillRect(0, 0, PW, 20, C.dark);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(...C.white);
  pdf.text(sanitizePdf(`Quiz — ${title}`), ML, 13);
  if (score) {
    const scoreText = `${score.correct}/${score.total} · ${Math.round(score.correct / score.total * 100)}%`;
    pdf.setFontSize(10);
    pdf.text(scoreText, PW - MR - pdf.getTextWidth(scoreText), 13);
  }
  y = 26;

  // ── Questions ────────────────────────────────────────────────────────────────
  questions.forEach((q, idx) => {
    const num    = idx + 1;
    const user   = answers[idx];
    const isWrong = user && user !== q.answer;

    need(20);

    // Numéro + question
    const badgeColor = isWrong ? C.red : (user === q.answer ? C.green : C.blue);
    fillRect(ML, y - 3.5, 7, 7, badgeColor);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...C.white);
    pdf.text(String(num), ML + 3.5, y + 0.5, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    setRgb(C.dark);
    const qWrapped = pdf.splitTextToSize(sanitizePdf(q.question), CW - 10);
    need(qWrapped.length * 4.5 + 2);
    pdf.text(qWrapped, ML + 10, y);
    y += qWrapped.length * 4.5 + 2;

    // Options
    const letters = ['A', 'B', 'C', 'D'];
    (q.options || []).forEach((opt, oi) => {
      const letter = letters[oi];
      const isAnswer = letter === q.answer;
      const isUser   = letter === user;
      let optColor = C.text;
      if (isAnswer) optColor = C.green;
      else if (isUser && !isAnswer) optColor = C.red;

      need(8);
      pdf.setFont('helvetica', isAnswer ? 'bold' : 'normal');
      pdf.setFontSize(9);
      setRgb(optColor);
      const marker = isAnswer ? '✓ ' : (isUser && !isAnswer ? '✗ ' : '  ');
      const optText = sanitizePdf(marker + opt);
      const wrapped = pdf.splitTextToSize(optText, CW - 8);
      pdf.text(wrapped, ML + 8, y);
      y += wrapped.length * 3.8 + 0.5;
    });

    // Explication (si quiz soumis avec réponses)
    if (q.explanation && Object.keys(answers).length > 0) {
      need(8);
      fillRect(ML, y, CW, 0.4, C.border);
      y += 2;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8.5);
      setRgb(C.muted);
      const expText = sanitizePdf('💡 ' + q.explanation);
      const expWrapped = pdf.splitTextToSize(expText, CW - 4);
      need(expWrapped.length * 3.5 + 2);
      pdf.text(expWrapped, ML + 2, y);
      y += expWrapped.length * 3.5 + 2;
    }

    y += 4;
    fillRect(ML, y - 1, CW, 0.3, C.border);
    y += 3;
  });

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pages = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    setRgb(C.muted);
    pdf.text(`Jangalai · ${sanitizePdf(title)} · Page ${p}/${pages}`, ML, PH - 6);
  }

  const safeName = title.replace(/[^a-zA-Z0-9À-ɏ\s-]/g, '').trim().slice(0, 50) || 'quiz';
  pdf.save(`${safeName}-quiz.pdf`);
}

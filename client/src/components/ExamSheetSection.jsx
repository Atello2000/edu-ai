import { useState } from 'react';
import { exportExamSheetToPDF } from '../utils/examSheetPdf';

/**
 * Props :
 *   md        string      — markdown final (vide pendant streaming)
 *   streaming string      — texte partiel en cours
 *   fileName  string      — nom de base pour le PDF
 *   onRegen   () => void  — callback régénérer
 */
export default function ExamSheetSection({ md, streaming, fileName = 'fiche', onRegen }) {
  const [copying,    setCopying]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const current = md || streaming;
  if (!current) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(current);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  async function handlePdf() {
    if (!md) return;
    setPdfLoading(true);
    try { await exportExamSheetToPDF(fileName, md); }
    catch (err) { alert('Erreur PDF : ' + err.message); }
    finally { setPdfLoading(false); }
  }

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-label">Révision ciblée</div>
          <h2 className="panel-title">Fiche <em>d&apos;examen</em></h2>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {onRegen && <button className="ghost-btn" onClick={onRegen}>↺ Régénérer</button>}
          <button className="ghost-btn" onClick={handleCopy} disabled={!current}>
            {copying ? 'Copié ✓' : 'Copier'}
          </button>
          <button
            className="ghost-btn"
            id="exam-sheet-pdf-btn"
            onClick={handlePdf}
            disabled={!md || pdfLoading}
          >
            {pdfLoading ? '⏳' : 'Exporter PDF'}
          </button>
        </div>
      </div>

      <div id="exam-sheet-result">
        {streaming && !md ? (
          <div className="exam-sheet-card">
            <p style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '.5rem 0' }}>
              Génération en cours…
            </p>
            <div dangerouslySetInnerHTML={{
              __html: window.marked?.parse(streaming) ?? streaming,
            }} />
          </div>
        ) : md ? (
          <div
            className="exam-sheet-card"
            dangerouslySetInnerHTML={{ __html: window.marked?.parse(md) ?? md }}
          />
        ) : null}
      </div>
    </>
  );
}

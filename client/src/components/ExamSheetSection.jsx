import { useState } from 'react';
import DOMPurify from 'dompurify';
import toast from '../utils/toast';
import { exportExamSheetToPDF } from '../utils/examSheetPdf';

/**
 * Props :
 *   md        string      — markdown final (vide pendant streaming)
 *   streaming string      — texte partiel en cours
 *   fileName  string      — nom de base pour le PDF
 *   onRegen   () => void  — callback régénérer
 */
function cleanMarkdown(text) {
  if (!text) return '';
  let cleaned = text.trim();
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\s*/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  return cleaned;
}

export default function ExamSheetSection({ md, streaming, fileName = 'fiche', onRegen, userPlan, onUpgrade }) {
  const [copying,    setCopying]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const current = md || streaming;
  if (!current) return null;

  const cleanedCurrent = cleanMarkdown(current);

  async function handleCopy() {
    await navigator.clipboard.writeText(cleanedCurrent);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  async function handlePdf() {
    if (!md) return;
    setPdfLoading(true);
    try { await exportExamSheetToPDF(fileName, cleanMarkdown(md)); }
    catch (err) { toast.error('Erreur PDF : ' + err.message); }
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
          {onRegen && <button className="ghost-btn" onClick={onRegen}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> Régénérer</button>}
          <button className="ghost-btn" onClick={handleCopy} disabled={!current}>
            {copying ? 'Copié ✓' : 'Copier'}
          </button>
          {userPlan === 'max' ? (
            <button
              className="ghost-btn"
              id="exam-sheet-pdf-btn"
              onClick={handlePdf}
              disabled={!md || pdfLoading}
            >
              {pdfLoading ? '⏳' : 'Exporter PDF'}
            </button>
          ) : (
            <button
              className="ghost-btn"
              title="Disponible avec le plan Max"
              onClick={onUpgrade}
              style={{ opacity: .6 }}
            >
              🔒 PDF Max
            </button>
          )}
          <button className="ghost-btn" onClick={() => window.print()} disabled={!current}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 9V2h12v7M4 9h16v10H4V9zm3 10v2h10v-2H7z"/>
            </svg> Imprimer
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
              __html: DOMPurify.sanitize(window.marked?.parse(cleanMarkdown(streaming)) ?? cleanMarkdown(streaming)),
            }} />
          </div>
        ) : md ? (
          <div
            className="exam-sheet-card"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(window.marked?.parse(cleanMarkdown(md)) ?? cleanMarkdown(md)) }}
          />
        ) : null}
      </div>
    </>
  );
}

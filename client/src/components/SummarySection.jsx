import { useState } from 'react';
import DOMPurify from 'dompurify';
import toast from '../utils/toast';
import { buildSummarySections } from '../utils/summaryUtils';
import { exportSummaryToPDF }   from '../utils/summaryPdf';

/* ── Icônes inline ─────────────────────────────────────────────────────────── */
const CopyIcon     = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V3a1 1 0 011-1h8"/></svg>;
const DownloadIcon = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v7M5.5 8L8 10.5 10.5 8"/><path d="M3 13h10"/></svg>;
const PdfIcon      = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="2" width="10" height="12" rx="1.5"/><line x1="6" y1="6" x2="10" y2="6"/><line x1="6" y1="9" x2="10" y2="9"/><line x1="6" y1="12" x2="8" y2="12"/></svg>;
const SpeakIcon    = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polygon points="2,5 6,5 10,2 10,14 6,11 2,11" fill="currentColor" stroke="none"/><path d="M12 5.5a4 4 0 0 1 0 5"/></svg>;

/* ── Icônes SVG par type de section ────────────────────────────────────────── */
const SECTION_ICONS = {
  'section-objectifs': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  'section-points':    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r=".7" fill="currentColor"/><circle cx="3" cy="12" r=".7" fill="currentColor"/><circle cx="3" cy="18" r=".7" fill="currentColor"/></svg>,
  'section-resume':    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  'section-concepts':  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  'section-retenir':   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  'section-autre':     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
};
function SectionIcon({ cls }) {
  return <span className="section-icon">{SECTION_ICONS[cls] ?? SECTION_ICONS['section-autre']}</span>;
}

/* ── Carte de résumé en cours de streaming ────────────────────────────────── */
function StreamingCard({ name, text }) {
  const ext      = name.split('.').pop().toUpperCase();
  const sections = buildSummarySections(text || '');

  return (
    <div className="summary-item">
      <div className="summary-item-accent" />

      <div className="summary-file-header">
        <div className="summary-file-header-left">
          <div className="summary-file-icon"><span className="file-ext">{ext}</span></div>
          <div className="summary-file-info">
            <strong title={name}>{name}</strong>
            <div className="summary-file-meta">Résumé IA</div>
          </div>
        </div>
        <span className="streaming-badge">✦ Génération en cours…</span>
      </div>

      {sections.length === 0 ? (
        /* Avant le premier ## : skeleton neutre, pas de texte brut */
        <div className="summary-stream-body">
          <div className="summary-skeleton">
            <div className="skel-line skel-title" />
            <div className="skel-line" style={{width:'92%'}} />
            <div className="skel-line" style={{width:'78%'}} />
            <div className="skel-line" style={{width:'85%'}} />
          </div>
        </div>
      ) : (
        <div className="summary-sections">
          {sections.map((s, i) => {
            const isLast = i === sections.length - 1;
            const bodyMd = s.lines.join('\n').trim();
            return (
              <div key={i} className={`summary-section ${s.cls}`}>
                <div className="summary-section-header">
                  <SectionIcon cls={s.cls} />
                  <span className="section-title">{s.title}</span>
                  {isLast && <span className="stream-cursor" aria-hidden="true" />}
                </div>
                <div
                  className="summary-section-body"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      window.marked?.parse(bodyMd) ?? bodyMd
                    ),
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Carte de résumé final ────────────────────────────────────────────────── */
function SummaryCard({ result }) {
  const { name, summary } = result;
  const ext      = name.split('.').pop().toUpperCase();
  const baseName = name.replace(/\.[^.]+$/, '');
  const sections = buildSummarySections(summary);

  const [allCollapsed, setAllCollapsed] = useState(false);
  const [copying,      setCopying]      = useState(false);
  const [pdfLoading,   setPdfLoading]   = useState(false);

  function toggleAll() {
    setAllCollapsed(c => !c);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(summary);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  function handleDownloadTxt() {
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([summary], { type: 'text/plain' })),
      download: baseName + '_résumé.txt',
    });
    a.click();
  }

  async function handlePdf() {
    setPdfLoading(true);
    try { await exportSummaryToPDF(baseName, summary); }
    catch (err) { toast.error('Erreur PDF : ' + err.message); }
    finally { setPdfLoading(false); }
  }

  function handleSpeak() {
    // Délégation à l'implémentation TTS de app.js via bridge window
    window.__ttsToggle?.(summary, null, null);
  }

  return (
    <div className="summary-item">
      {/* Accent bar */}
      <div className="summary-item-accent" />

      {/* Header */}
      <div className="summary-file-header">
        <div className="summary-file-header-left">
          <div className="summary-file-icon"><span className="file-ext">{ext}</span></div>
          <div className="summary-file-info">
            <strong title={name}>{name}</strong>
            <div className="summary-file-meta">
              {sections.length} section{sections.length > 1 ? 's' : ''} · Résumé IA
            </div>
          </div>
        </div>
        <div className="summary-file-actions">
          <button className="summary-action-btn speak-btn" onClick={handleSpeak}>
            <SpeakIcon /> Écouter
          </button>
          <button className="summary-action-btn copy-btn" onClick={handleCopy}>
            <CopyIcon /> {copying ? 'Copié ✓' : 'Copier'}
          </button>
          <button className="summary-action-btn download-btn" onClick={handleDownloadTxt}>
            <DownloadIcon /> TXT
          </button>
          <button className="summary-action-btn pdf pdf-btn" onClick={handlePdf} disabled={pdfLoading}>
            <PdfIcon /> {pdfLoading ? '⏳' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="summary-toolbar">
        <span className="summary-toolbar-left">{sections.length} sections</span>
        <button className="summary-expand-btn" onClick={toggleAll}>
          {allCollapsed ? 'Tout développer' : 'Tout réduire'}
        </button>
      </div>

      {/* Sections */}
      <div className="summary-sections">
        {sections.length === 0 ? (
          <div className="summary-section section-autre">
            <div
              className="summary-section-body"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(window.marked?.parse(summary) ?? summary) }}
            />
          </div>
        ) : (
          sections.map((s, i) => (
            <div
              key={i}
              className={`summary-section ${s.cls}${allCollapsed ? ' collapsed' : ''}`}
            >
              <div
                className="summary-section-header"
                onClick={() => {/* per-section collapse handled by child if needed */}}
              >
                <SectionIcon cls={s.cls} />
                <span className="section-title">{s.title}</span>
                <span className="section-chevron"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
              </div>
              <div
                className="summary-section-body"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(window.marked?.parse(s.lines.join('\n').trim()) ?? s.lines.join('\n')),
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Composant principal ──────────────────────────────────────────────────── */
/**
 * Props :
 *   results   [{name, summary}]    résultats finaux
 *   streaming {[name]: string}     texte partiel en cours
 *   onCopyAll ()                   bouton "Copier tout"
 *   onRegen   ()                   bouton "Régénérer"
 */
export default function SummaryResults({ results, streaming, onCopyAll, onRegen }) {
  const [activeTab, setActiveTab] = useState(0);

  const streamingEntries = Object.entries(streaming || {});
  const hasContent = results.length > 0 || streamingEntries.length > 0;

  if (!hasContent) return null;

  const allDone = results.length > 0 && streamingEntries.length === 0;

  return (
    <>
      {/* Barre d'actions en-tête */}
      <div className="panel-header">
        <div>
          <div className="panel-label">Résultats</div>
          <h2 className="panel-title">Résumés <em>générés</em></h2>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          {allDone && onCopyAll && (
            <button className="ghost-btn" onClick={onCopyAll}>Copier tout</button>
          )}
          {allDone && onRegen && (
            <button className="ghost-btn" onClick={onRegen}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> Régénérer
            </button>
          )}
        </div>
      </div>

      {/* Onglets (plusieurs fichiers) */}
      {results.length > 1 && (
        <div className="summary-tabs">
          {results.map((r, i) => (
            <button
              key={i}
              className={`summary-tab${i === activeTab ? ' active' : ''}`}
              title={r.name}
              onClick={() => setActiveTab(i)}
            >
              {r.name.replace(/\.[^.]+$/, '')}
            </button>
          ))}
        </div>
      )}

      {/* Cartes en cours de streaming */}
      {streamingEntries.map(([name, text]) => (
        <StreamingCard key={name} name={name} text={text} />
      ))}

      {/* Cartes finales */}
      {results.map((r, i) => (
        <div key={i} style={{ display: results.length > 1 && i !== activeTab ? 'none' : undefined }}>
          <SummaryCard result={r} />
        </div>
      ))}
    </>
  );
}

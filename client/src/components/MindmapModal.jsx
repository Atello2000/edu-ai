import { useState, useRef, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';

/**
 * Modal de carte mentale (markmap).
 *
 * Écoute l'événement eventBus 'mindmap:open' avec payload { name, markdown }.
 */

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = Object.assign(document.createElement('script'), {
      src,
      onload:  resolve,
      onerror: reject,
    });
    document.head.appendChild(s);
  });
}

export default function MindmapModal() {
  const [visible,    setVisible]    = useState(false);
  const [courseName, setCourseName] = useState('Carte mentale');
  const [pendingMd,  setPendingMd]  = useState(null);
  const svgRef      = useRef(null);
  const instanceRef = useRef(null);

  const close = useCallback(() => {
    setVisible(false);
    setPendingMd(null);
    if (svgRef.current) svgRef.current.innerHTML = '';
    instanceRef.current = null;
  }, []);

  // Fermeture par Échap
  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, close]);

  // Rendu markmap dès que visible + pendingMd sont définis
  useEffect(() => {
    if (!visible || !pendingMd || !svgRef.current) return;

    const svgEl = svgRef.current;
    svgEl.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      fill="var(--muted)" font-family="Outfit,sans-serif" font-size="14">Génération de la carte…</text>`;

    let cancelled = false;
    (async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/markmap-lib@0.15/dist/browser/index.js');
        await loadScript('https://cdn.jsdelivr.net/npm/markmap-view@0.15/dist/browser/index.js');
        if (cancelled) return;

        const base = courseName.replace(/\.[^.]+$/, '');
        const md   = `# ${base}\n\n${pendingMd}`;
        const { Transformer, Markmap } = window.markmap;
        const transformer = new Transformer();
        const { root }    = transformer.transform(md);

        svgEl.innerHTML = '';
        instanceRef.current = Markmap.create(svgEl, {
          paddingX:         20,
          duration:         400,
          maxWidth:         260,
          colorFreezeLevel: 2,   // couleur figée au niveau 2 → branches cohérentes
          zoom:             true,
          pan:              true,
        }, root);
        instanceRef.current.fit();
      } catch {
        if (cancelled) return;
        svgEl.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
          fill="var(--rose)" font-family="Outfit,sans-serif" font-size="14">Erreur de chargement de la bibliothèque</text>`;
      }
    })();

    return () => { cancelled = true; };
  }, [visible, pendingMd, courseName]);

  // Écoute l'événement eventBus au lieu des bridges window.__
  useEffect(() => {
    return eventBus.on('mindmap:open', ({ name, markdown }) => {
      setCourseName(name);
      setPendingMd(markdown);
      setVisible(true);
    });
  }, []);

  if (!visible) return null;

  return (
    <div
      className="mindmap-overlay"
      id="mindmap-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="mindmap-modal">
        <div className="mindmap-header">
          <span className="mindmap-course-name">{courseName}</span>
          <div className="mindmap-header-actions">
            <button className="ghost-btn" title="Zoom +" onClick={() => instanceRef.current?.rescale(1.25)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button className="ghost-btn" title="Zoom -" onClick={() => instanceRef.current?.rescale(0.8)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button className="ghost-btn" onClick={() => instanceRef.current?.fit()}>Centrer</button>
            <button className="ghost-btn" title="Exporter SVG" onClick={() => {
              const svg = svgRef.current;
              if (!svg) return;
              const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
              const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${courseName.replace(/\.[^.]+$/, '')}-mindmap.svg` });
              a.click(); URL.revokeObjectURL(a.href);
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button className="mindmap-close-btn" onClick={close}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <svg ref={svgRef} id="mindmap-svg" />
      </div>
    </div>
  );
}

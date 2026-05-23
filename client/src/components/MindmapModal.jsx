import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Modal de carte mentale (markmap).
 *
 * Bridges :
 *   window.__openMindmap(courseName, markdown)  — ouvre et rend la carte
 *   window.__closeMindmap()                     — ferme la modale
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
        instanceRef.current = Markmap.create(svgEl, { paddingX: 16, duration: 300 }, root);
        instanceRef.current.fit();
      } catch {
        if (cancelled) return;
        svgEl.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
          fill="var(--rose)" font-family="Outfit,sans-serif" font-size="14">Erreur de chargement de la bibliothèque</text>`;
      }
    })();

    return () => { cancelled = true; };
  }, [visible, pendingMd, courseName]);

  // Bridges
  useEffect(() => {
    window.__openMindmap = (name, markdown) => {
      setCourseName(name);
      setPendingMd(markdown);
      setVisible(true);
    };
    window.__closeMindmap = close;
    return () => {
      delete window.__openMindmap;
      delete window.__closeMindmap;
    };
  }, [close]);

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
            <button className="ghost-btn" onClick={() => instanceRef.current?.fit()}>Centrer</button>
            <button className="mindmap-close-btn" onClick={close}>✕</button>
          </div>
        </div>
        <svg ref={svgRef} id="mindmap-svg" />
      </div>
    </div>
  );
}

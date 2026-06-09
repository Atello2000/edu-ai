import { useState, useRef, useEffect, useCallback } from 'react';
import eventBus from '../utils/eventBus';
import { apiFetch } from '../utils/apiFetch';
import toast from '../utils/toast';

// Bundlés via npm — plus de dépendance CDN, fonctionne hors-ligne

let markmapModulesPromise;
function loadMarkmapModules() {
  markmapModulesPromise ||= Promise.all([
    import('markmap-lib/no-plugins'),
    import('markmap-view'),
  ]).then(([lib, view]) => ({
    Transformer: lib.Transformer,
    Markmap:     view.Markmap,
  }));
  return markmapModulesPromise;
}

export default function MindmapModal({
  mindmapMd,
  onMindmapChange,
  saveSession,
  uploadedFiles = [],
  selectedFileIds = null,
}) {
  const [visible,    setVisible]    = useState(false);
  const [courseName, setCourseName] = useState('Carte mentale');
  const [pendingMd,  setPendingMd]  = useState(null);
  const [extending,  setExtending]  = useState(false);
  const [selectedNodeText, setSelectedNodeText] = useState(null);
  const svgRef      = useRef(null);
  const instanceRef = useRef(null);

  const close = useCallback(() => {
    setVisible(false);
    setPendingMd(null);
    setSelectedNodeText(null);
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
        if (cancelled) return;

        const { Transformer, Markmap } = await loadMarkmapModules();
        if (cancelled) return;

        const base        = courseName.replace(/\.[^.]+$/, '');
        const md          = `# ${base}\n\n${pendingMd}`;
        const transformer = new Transformer();
        const { root }    = transformer.transform(md);

        svgEl.innerHTML = '';
        instanceRef.current = Markmap.create(svgEl, {
          paddingX:         20,
          duration:         400,
          maxWidth:         260,
          colorFreezeLevel: 2,
          zoom:             true,
          pan:              true,
        }, root);
        instanceRef.current.fit();
      } catch {
        if (cancelled) return;
        svgEl.innerHTML = `<foreignObject x="10%" y="35%" width="80%" height="30%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Outfit,sans-serif;font-size:14px;color:var(--muted);text-align:center;padding:1rem;background:var(--surface);border:1px solid var(--border);border-radius:8px">
            <div style="color:var(--rose);margin-bottom:.5rem">⚠ Impossible de charger la carte mentale.</div>
            <button onclick="location.reload()" style="font-size:12px;padding:.3rem .8rem;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:6px;cursor:pointer">Réessayer</button>
          </div>
        </foreignObject>`;
      }
    })();

    return () => { cancelled = true; };
  }, [visible, pendingMd, courseName]);

  // Highlight et sélection visuelle du nœud sélectionné
  useEffect(() => {
    if (!visible || !svgRef.current) return;
    const svgEl = svgRef.current;

    // Réinitialiser les styles de tous les nœuds
    svgEl.querySelectorAll('.markmap-node').forEach(nodeEl => {
      nodeEl.classList.remove('selected-node');
      const circle = nodeEl.querySelector('circle');
      if (circle) {
        circle.style.stroke = '';
        circle.style.strokeWidth = '';
        circle.style.fill = '';
      }
      const rect = nodeEl.querySelector('rect');
      if (rect) {
        rect.style.stroke = '';
        rect.style.strokeWidth = '';
      }
      const text = nodeEl.querySelector('text');
      if (text) {
        text.style.fill = '';
        text.style.fontWeight = '';
      }
    });

    if (!selectedNodeText) return;

    // Appliquer le style de sélection sur le nœud correspondant
    svgEl.querySelectorAll('.markmap-node').forEach(nodeEl => {
      const data = nodeEl.__data__;
      if (data && data.content) {
        const text = data.content.replace(/<[^>]*>/g, '').trim();
        if (text === selectedNodeText) {
          nodeEl.classList.add('selected-node');
          const circle = nodeEl.querySelector('circle');
          if (circle) {
            circle.style.stroke = 'var(--gold, #f5a623)';
            circle.style.strokeWidth = '3px';
            circle.style.fill = 'var(--gold, #f5a623)';
          }
          const rect = nodeEl.querySelector('rect');
          if (rect) {
            rect.style.stroke = 'var(--gold, #f5a623)';
            rect.style.strokeWidth = '2px';
          }
          const txt = nodeEl.querySelector('text');
          if (txt) {
            txt.style.fill = 'var(--gold, #f5a623)';
            txt.style.fontWeight = 'bold';
          }
        }
      }
    });
  }, [selectedNodeText, pendingMd, visible]);

  // Écoute l'événement eventBus
  useEffect(() => {
    return eventBus.on('mindmap:open', ({ name, markdown }) => {
      setCourseName(name);
      setPendingMd(markdown);
      setVisible(true);
    });
  }, []);

  // Gérer le clic sur le SVG pour la sélection des nœuds
  const handleSvgClick = useCallback((e) => {
    const nodeEl = e.target.closest('.markmap-node');
    if (!nodeEl) {
      if (e.target === svgRef.current) {
        setSelectedNodeText(null);
      }
      return;
    }
    const data = nodeEl.__data__;
    if (data && data.content) {
      const text = data.content.replace(/<[^>]*>/g, '').trim();
      setSelectedNodeText(text);
    }
  }, []);

  // Approfondir le concept sélectionné
  const handleExtendNode = async () => {
    if (!selectedNodeText) return;

    const files = !selectedFileIds || selectedFileIds.size === uploadedFiles.length
      ? uploadedFiles
      : uploadedFiles.filter(f => selectedFileIds?.has(f.id));

    if (!files || !files.length) {
      toast.warn('Sélectionnez d\'abord un cours.');
      return;
    }

    const file = files[0];
    setExtending(true);

    try {
      const res = await apiFetch('/api/mindmap/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, nodeText: selectedNodeText }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Erreur lors de l\'approfondissement.');
      }

      const originalMd = pendingMd;
      const newItemsMd = data.markdown;

      const lines = originalMd.split('\n');
      let targetLineIndex = -1;
      const cleanSelectedText = selectedNodeText.trim().toLowerCase();

      // Recherche du nœud dans le Markdown
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cleanLine = line.replace(/^[#\-*\s]+/, '').trim().toLowerCase();
        if (cleanLine === cleanSelectedText) {
          targetLineIndex = i;
          break;
        }
      }

      if (targetLineIndex === -1) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const cleanLine = line.replace(/^[#\-*\s]+/, '').trim().toLowerCase();
          if (cleanLine.includes(cleanSelectedText) || cleanSelectedText.includes(cleanLine)) {
            targetLineIndex = i;
            break;
          }
        }
      }

      if (targetLineIndex !== -1) {
        const targetLine = lines[targetLineIndex];
        let childPrefix = '- ';

        if (targetLine.trim().startsWith('#')) {
          childPrefix = '- ';
        } else {
          const spaceMatch = targetLine.match(/^(\s*)/);
          const leadingSpaces = spaceMatch ? spaceMatch[1] : '';
          childPrefix = leadingSpaces + '  - ';
        }

        const newLines = newItemsMd.split('\n')
          .map(line => line.replace(/^[\s\-*]+/, '').trim())
          .filter(Boolean)
          .map(text => `${childPrefix}${text}`);

        lines.splice(targetLineIndex + 1, 0, ...newLines);
        const newMarkdown = lines.join('\n');

        // Mettre à jour les états et sauvegarder la session
        setPendingMd(newMarkdown);
        onMindmapChange?.(newMarkdown);
        saveSession?.({ mindmap: newMarkdown });
        setSelectedNodeText(null);

        eventBus.emit('quota:refresh');
        toast.success('Concept approfondi ! (-1 jeton)');
      } else {
        throw new Error('Impossible de localiser le concept dans le document original.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExtending(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="mindmap-overlay"
      id="mindmap-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <style>{`
        .markmap-node {
          cursor: pointer;
        }
        .markmap-node:hover circle {
          stroke: var(--teal, #00f2fe) !important;
          stroke-width: 2.5px !important;
        }
        .markmap-node.selected-node circle {
          stroke: var(--gold, #f5a623) !important;
          stroke-dasharray: none !important;
          stroke-width: 3px !important;
          fill: var(--gold, #f5a623) !important;
        }
        .markmap-node.selected-node text {
          fill: var(--gold, #f5a623) !important;
          font-weight: bold !important;
        }
      `}</style>
      <div className="mindmap-modal">
        <div className="mindmap-header">
          <span className="mindmap-course-name">{courseName}</span>
          {selectedNodeText && (
            <span className="selected-node-badge" style={{
              fontSize: '0.8rem',
              color: 'var(--gold, #f5a623)',
              background: 'rgba(245, 166, 35, 0.1)',
              border: '1px solid rgba(245, 166, 35, 0.25)',
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              marginLeft: '1rem',
              marginRight: 'auto',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block'
            }}>
              Sélection : {selectedNodeText}
            </span>
          )}
          <div className="mindmap-header-actions" style={{ marginLeft: !selectedNodeText ? 'auto' : undefined }}>
            <button
              className="act-btn gold"
              style={{
                padding: '0.4rem 0.9rem',
                fontSize: '0.78rem',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                marginRight: '0.5rem',
                borderRadius: '8px',
                height: '32px'
              }}
              disabled={!selectedNodeText || extending}
              onClick={handleExtendNode}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              {extending ? 'Approfondissement...' : 'Approfondir (1 jeton)'}
            </button>
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
              const a = Object.assign(document.createElement('a'), {
                href:     URL.createObjectURL(blob),
                download: `${courseName.replace(/\.[^.]+$/, '')}-mindmap.svg`,
              });
              a.click(); URL.revokeObjectURL(a.href);
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button className="mindmap-close-btn" onClick={close}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <svg ref={svgRef} id="mindmap-svg" onClick={handleSvgClick} />
      </div>
    </div>
  );
}

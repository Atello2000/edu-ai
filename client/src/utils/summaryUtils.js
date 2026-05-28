/**
 * summaryUtils.js — utilitaires partagés pour le rendu des résumés
 * (utilisés par SummarySection.jsx et summaryPdf.js)
 */

export const SECTION_CONFIG = [
  { match: /objectif/i,     icon: '🎯', cls: 'section-objectifs' },
  { match: /points?\s*cl/i, icon: '📌', cls: 'section-points'    },
  { match: /r[eé]sum[eé]/i, icon: '📖', cls: 'section-resume'    },
  { match: /concept/i,      icon: '🔑', cls: 'section-concepts'  },
  { match: /retenir/i,      icon: '💡', cls: 'section-retenir'   },
];

/**
 * Parse un résumé Markdown en sections (délimitées par ## titres).
 * Retourne [{title, icon, cls, lines[]}]
 */
export function buildSummarySections(md) {
  const sections = [];
  let current = null;
  for (const line of md.split('\n')) {
    // Uniquement ## — les sous-titres ### dans le corps restent dans la section courante
    const hx = line.match(/^##\s+(.*)/);
    if (hx) {
      if (current) sections.push(current);
      const rawTitle = hx[1].trim();
      // Strip bold/italic markers then leading non-letter symbols (emojis, etc.)
      const title    = rawTitle
        .replace(/\*\*/g, '')
        .replace(/\*/g,   '')
        .replace(/^\P{L}+/u, '')
        .trim();
      const cfg      = SECTION_CONFIG.find(c => c.match.test(rawTitle)) || { icon: '📄', cls: 'section-autre' };
      current = { title, icon: cfg.icon, cls: cfg.cls, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  // Dédoublonnage : un header répété (ancien priming serveur) produit une section
  // vide suivie d'une section de même titre. On fusionne les titres adjacents
  // identiques en conservant le contenu.
  const norm = t => (t || '').toLowerCase().trim();
  const deduped = [];
  for (const sec of sections) {
    const prev = deduped[deduped.length - 1];
    if (prev && norm(prev.title) === norm(sec.title)) {
      const prevEmpty = prev.lines.join('').trim() === '';
      const curEmpty  = sec.lines.join('').trim() === '';
      if (prevEmpty) { deduped[deduped.length - 1] = sec; continue; } // la vide cède la place
      if (curEmpty)  continue;                                        // ignore la vide qui suit
      prev.lines.push('', ...sec.lines);                              // les deux pleines : fusion
      continue;
    }
    deduped.push(sec);
  }
  return deduped;
}

/**
 * Strip markdown syntax pour usage dans jsPDF (conserve les accents).
 */
export function stripMd(text) {
  return text
    .replace(/^#{1,6}\s*/,    '')
    .replace(/^>\s*/,          '')
    .replace(/^[-*+]\s*/,      '')
    .replace(/^\d+\.\s*/,      '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g,     '$1')
    .replace(/__(.+?)__/g,     '$1')
    .replace(/_(.+?)_/g,       '$1')
    .replace(/`(.+?)`/g,       '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[🎯📌📖🔑💡✦●▶→•◆■□▪]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

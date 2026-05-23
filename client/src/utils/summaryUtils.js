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
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) {
      if (current) sections.push(current);
      const title = h2[1].trim();
      const cfg   = SECTION_CONFIG.find(c => c.match.test(title)) || { icon: '📄', cls: 'section-autre' };
      current = { title, icon: cfg.icon, cls: cfg.cls, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
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

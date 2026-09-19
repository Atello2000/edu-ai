/**
 * Dérivation locale de fonctionnalités à partir d'un résumé déjà généré.
 * Retourne null si le contenu est insuffisant pour permettre un fallback IA.
 */
function splitSections(summaryMd) {
  const sections = [];
  let current = null;
  for (const line of String(summaryMd || '').split('\n')) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      current = { title: h2[1].trim(), lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
  }
  return sections;
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

const SECTION_KEYWORDS = {
  structure: ['structure', 'plan du cours', 'course outline', 'course structure', 'هيكل', 'بنية', 'خطة الدرس', 'خطة المقرر'],
  points: ['points cles', 'key points', 'النقاط الرئيسية', 'النقاط الاساسية', 'أهم النقاط'],
  concepts: ['concepts importants', 'concepts cles', 'important concepts', 'key concepts', 'المفاهيم المهمة', 'المفاهيم الرئيسية'],
  links: ['liens entre les idees', 'relations', 'links between ideas', 'connections', 'العلاقات بين الافكار', 'الروابط بين الافكار'],
};

function findSection(sections, kind) {
  const keywords = SECTION_KEYWORDS[kind] || [kind];
  return sections.find(section => {
    const title = normalize(section.title);
    return keywords.some(keyword => title.includes(normalize(keyword)));
  });
}

const bulletsOf = section => !section ? [] : section.lines
  .filter(line => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line))
  .map(line => line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').trim())
  .filter(Boolean);

function shorten(value, maxWords = 8) {
  const words = String(value || '').split(/\s+/);
  return words.length <= maxWords ? words.join(' ') : words.slice(0, maxWords).join(' ') + '…';
}

function parseBoldDefinition(line) {
  const cleaned = String(line || '').replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').trim();
  const match = cleaned.match(/^\*\*(.+?)\*\*\s*[:：—–-]\s*(.+\S)\s*$/);
  return match ? { title: match[1].trim(), detail: match[2].trim() } : null;
}

const LABELS = {
  fr: { structure: 'Structure du cours', concepts: 'Concepts clés', points: 'Points clés', links: 'Relations' },
  en: { structure: 'Course structure', concepts: 'Key concepts', points: 'Key points', links: 'Connections' },
  ar: { structure: 'هيكل الدرس', concepts: 'المفاهيم الرئيسية', points: 'النقاط الرئيسية', links: 'العلاقات' },
};

function deriveMindmapFromSummary(summaryMd, lang = 'fr') {
  const sections = splitSections(summaryMd);
  if (!sections.length) return null;
  const structure = bulletsOf(findSection(sections, 'structure'));
  const points = bulletsOf(findSection(sections, 'points'));
  const conceptsSection = findSection(sections, 'concepts');
  const concepts = conceptsSection ? conceptsSection.lines.map(parseBoldDefinition).filter(Boolean) : [];
  const linksSection = findSection(sections, 'links');
  const links = linksSection ? linksSection.lines.map(parseBoldDefinition).filter(Boolean) : [];
  if (!structure.length && !concepts.length && !points.length) return null;

  const labels = LABELS[lang] || LABELS.fr;
  const output = [];
  if (structure.length) {
    output.push(`## ${labels.structure}`);
    for (const item of structure.slice(0, 10)) output.push(`### ${shorten(item, 12)}`);
  }
  if (concepts.length) {
    output.push(`## ${labels.concepts}`);
    for (const concept of concepts.slice(0, 10)) {
      output.push(`### ${shorten(concept.title, 8)}`);
      output.push(`- ${shorten(concept.detail, 18)}`);
    }
  }
  if (points.length) {
    output.push(`## ${labels.points}`);
    for (const point of points.slice(0, 8)) output.push(`- ${shorten(point, 18)}`);
  }
  if (links.length) {
    output.push(`## ${labels.links}`);
    for (const link of links.slice(0, 6)) {
      output.push(`### ${shorten(link.title, 10)}`);
      output.push(`- ${shorten(link.detail, 18)}`);
    }
  }
  return output.join('\n');
}

function deriveGlossaryFromSummary(summaryMd) {
  const conceptsSection = findSection(splitSections(summaryMd), 'concepts');
  if (!conceptsSection) return null;
  const terms = conceptsSection.lines.map(parseBoldDefinition).filter(Boolean)
    .map(item => ({ term: item.title, definition: item.detail, category: 'Concepts clés' }));
  return terms.length ? terms : null;
}

module.exports = { deriveMindmapFromSummary, deriveGlossaryFromSummary, splitSections };

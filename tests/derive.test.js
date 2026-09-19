const { deriveGlossaryFromSummary, deriveMindmapFromSummary, splitSections } = require('../services/derive');

describe('summary derivation', () => {
  test('parses numbered and bulleted concepts', () => {
    const summary = `# Résumé
## 🔑 Concepts importants
- **Pharmacocinétique** : devenir du médicament dans l'organisme
2. **Biodisponibilité** — fraction qui atteint la circulation
## 📌 Points clés
1. La dose influence l'exposition`;
    expect(splitSections(summary)).toHaveLength(2);
    expect(deriveGlossaryFromSummary(summary)).toEqual([
      { term: 'Pharmacocinétique', definition: "devenir du médicament dans l'organisme", category: 'Concepts clés' },
      { term: 'Biodisponibilité', definition: 'fraction qui atteint la circulation', category: 'Concepts clés' },
    ]);
  });

  test.each([
    ['en', 'Course structure', 'Key concepts'],
    ['ar', 'هيكل الدرس', 'المفاهيم الرئيسية'],
  ])('derives a hierarchical %s mindmap', (lang, structureTitle, conceptsTitle) => {
    const source = lang === 'ar'
      ? `## هيكل المقرر\n- المقدمة\n- التطبيق\n## المفاهيم المهمة\n- **الجرعة** : كمية الدواء المعطاة\n## النقاط الرئيسية\n- الجرعة تؤثر في الاستجابة`
      : `## Course structure\n- Introduction\n- Application\n## Important concepts\n- **Dose**: amount administered\n## Key points\n- Dose affects response`;
    const markdown = deriveMindmapFromSummary(source, lang);
    expect(markdown).toContain(`## ${structureTitle}`);
    expect(markdown).toContain('###');
    expect(markdown).toContain(`## ${conceptsTitle}`);
  });

  test('returns null when the summary is not derivable', () => {
    expect(deriveMindmapFromSummary('Texte sans sections')).toBeNull();
    expect(deriveGlossaryFromSummary('## Autre\nRien ici')).toBeNull();
  });
});

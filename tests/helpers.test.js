const { parseJsonResponse, langLabel, userContext } = require('../routes/ai/helpers');

// ── parseJsonResponse ──────────────────────────────────────────────────────────
describe('parseJsonResponse', () => {
  it('parse un JSON propre', () => {
    expect(parseJsonResponse('{"a":1}', null)).toEqual({ a: 1 });
  });

  it('retire les fences markdown ```json', () => {
    const raw = '```json\n{"questions":[{"q":"x"}]}\n```';
    expect(parseJsonResponse(raw, null)).toEqual({ questions: [{ q: 'x' }] });
  });

  it('retire les fences markdown sans langage', () => {
    expect(parseJsonResponse('```\n{"ok":true}\n```', null)).toEqual({ ok: true });
  });

  it('extrait le premier objet JSON noyé dans du texte', () => {
    const raw = 'Voici votre résultat :\n{"terms":[]}\nMerci !';
    expect(parseJsonResponse(raw, null)).toEqual({ terms: [] });
  });

  it('gère les sauts de ligne dans les valeurs JSON', () => {
    const raw = '{"text":"ligne 1\\nligne 2"}';
    expect(parseJsonResponse(raw, null)).toEqual({ text: 'ligne 1\nligne 2' });
  });

  it('retourne le fallback sur JSON invalide', () => {
    const fb = { questions: [] };
    expect(parseJsonResponse('pas du tout du json', fb)).toBe(fb);
  });

  it('retourne le fallback sur chaîne vide', () => {
    const fb = { x: 1 };
    expect(parseJsonResponse('', fb)).toBe(fb);
  });
});

// ── langLabel ───────────────────────────────────────────────────────────────────
describe('langLabel', () => {
  it('mappe les langues connues', () => {
    expect(langLabel('fr')).toBe('en français');
    expect(langLabel('en')).toBe('in English');
    expect(langLabel('ar')).toBe('باللغة العربية');
  });

  it('retombe sur le français pour une langue inconnue', () => {
    expect(langLabel('zz')).toBe('en français');
    expect(langLabel(undefined)).toBe('en français');
  });
});

// ── userContext ─────────────────────────────────────────────────────────────────
describe('userContext', () => {
  it('retourne une chaîne vide sans profil', () => {
    expect(userContext(null)).toBe('');
    expect(userContext({})).toBe('');
  });

  it('construit un préfixe de profil à partir du niveau', () => {
    const ctx = userContext({ level: 'master' });
    expect(ctx).toContain('[Profil :');
    expect(ctx).toContain('Master');
  });

  it('intègre domaines (JSON) et spécialité', () => {
    const ctx = userContext({ level: 'licence', domains: '["Biologie","Chimie"]', specialty: 'Génétique' });
    expect(ctx).toContain('Biologie, Chimie');
    expect(ctx).toContain('Génétique');
  });

  it('ne casse pas si domains est un JSON invalide', () => {
    const ctx = userContext({ level: 'licence', domains: 'pas-du-json' });
    expect(ctx).toContain('[Profil :');
  });
});

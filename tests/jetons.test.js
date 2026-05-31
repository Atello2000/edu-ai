// En environnement de test, NODE_ENV !== 'production' → IS_PROD = false.
// checkAndDeduct / refundJetons court-circuitent alors la base de données :
// on valide ici cette logique de dev + les constantes de configuration.
const { JETON_COSTS, MONTHLY_JETONS, checkAndDeduct, refundJetons } = require('../services/jetons');

// ── Constantes d'allocation ──────────────────────────────────────────────────────
describe('MONTHLY_JETONS', () => {
  it('alloue free < pro < max', () => {
    expect(MONTHLY_JETONS.free).toBeLessThan(MONTHLY_JETONS.pro);
    expect(MONTHLY_JETONS.pro).toBeLessThan(MONTHLY_JETONS.max);
  });

  it('correspond aux valeurs documentées (40 / 150 / 400)', () => {
    expect(MONTHLY_JETONS).toMatchObject({ free: 40, pro: 150, max: 400 });
  });
});

// ── Coûts par action ─────────────────────────────────────────────────────────────
describe('JETON_COSTS', () => {
  it('définit un coût entier positif pour chaque action de base', () => {
    for (const action of ['summarize', 'quiz', 'flashcards', 'chat']) {
      expect(Number.isInteger(JETON_COSTS[action])).toBe(true);
      expect(JETON_COSTS[action]).toBeGreaterThan(0);
    }
  });

  it('facture le résumé plus cher que le chat', () => {
    expect(JETON_COSTS.summarize).toBeGreaterThan(JETON_COSTS.chat);
  });
});

// ── checkAndDeduct (mode dev) ─────────────────────────────────────────────────────
describe('checkAndDeduct (hors production)', () => {
  it('autorise toujours sans toucher la base en dev', async () => {
    const res = await checkAndDeduct(1, 'quiz', 'free', 5);
    expect(res.ok).toBe(true);
  });
});

// ── refundJetons (mode dev) ───────────────────────────────────────────────────────
describe('refundJetons', () => {
  it('est un no-op en dev (ne jette pas)', async () => {
    await expect(refundJetons(1, 'quiz', 5)).resolves.toBeUndefined();
  });

  it('ignore un montant nul ou négatif sans erreur', async () => {
    await expect(refundJetons(1, 'quiz', 0)).resolves.toBeUndefined();
    await expect(refundJetons(1, 'quiz', -3)).resolves.toBeUndefined();
  });

  it('ignore un userId absent sans erreur', async () => {
    await expect(refundJetons(undefined, 'quiz', 5)).resolves.toBeUndefined();
  });
});

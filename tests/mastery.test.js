const { computeTopicMastery, buildDailyPlan, daysUntil } = require('../services/mastery');

const NOW = Date.parse('2026-07-17T12:00:00Z');

describe('mastery engine', () => {
  test('weights recent attempts and reports the weakest topic first', () => {
    const mastery = computeTopicMastery([
      { topic: 'Pharmacologie', score: 9, total: 10, created_at: '2026-07-16T12:00:00Z' },
      { topic: 'Pharmacologie', score: 8, total: 10, created_at: '2026-07-10T12:00:00Z' },
      { topic: 'Chimie', score: 3, total: 10, created_at: '2026-07-16T12:00:00Z' },
    ], NOW);

    expect(mastery[0].topic).toBe('Chimie');
    expect(mastery[0].status).toBe('review');
    expect(mastery[1].mastery).toBeGreaterThan(mastery[0].mastery);
  });

  test('applies forgetting pressure to old results', () => {
    const recent = computeTopicMastery([
      { topic: 'Galénique', score: 8, total: 10, created_at: '2026-07-16T12:00:00Z' },
    ], NOW)[0];
    const old = computeTopicMastery([
      { topic: 'Galénique', score: 8, total: 10, created_at: '2026-05-01T12:00:00Z' },
    ], NOW)[0];

    expect(old.mastery).toBeLessThan(recent.mastery);
    expect(old.daysSinceReview).toBeGreaterThan(7);
  });

  test('builds a more intensive plan near the exam', () => {
    const plan = buildDailyPlan({
      dueCards: 12,
      examDate: '2026-07-19',
      now: NOW,
      mastery: [
        { topic: 'Chimie', mastery: 35, daysSinceReview: 1 },
        { topic: 'Galénique', mastery: 62, daysSinceReview: 3 },
        { topic: 'Pharmacologie', mastery: 70, daysSinceReview: 2 },
      ],
    });

    expect(plan.targetMinutes).toBe(45);
    expect(plan.tasks[0].type).toBe('srs');
    expect(plan.tasks.some(task => task.topic === 'Chimie')).toBe(true);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.targetMinutes);
  });

  test('calculates the inclusive exam countdown', () => {
    expect(daysUntil('2026-07-17', NOW)).toBe(0);
    expect(daysUntil(null, NOW)).toBeNull();
  });
});

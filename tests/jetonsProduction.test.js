process.env.NODE_ENV = 'production';
let mockUser;
jest.mock('../db', () => ({ prepare: sql => ({
  async get(...args) {
    if (sql.includes('jetons = jetons -')) {
      if (mockUser.jetons < args[0]) return null;
      mockUser.jetons -= args[0]; return { balance: mockUser.jetons };
    }
    return { ...mockUser };
  },
  async run() {
    if (sql.includes("SET plan = 'free'") && mockUser.expired) mockUser.plan = 'free';
    if (sql.includes('SET jetons = ?')) throw new Error('Calendar reset would destroy credits');
    return { changes: 1 };
  },
}) }));
const { checkAndDeduct, refillIfNeeded } = require('../services/jetons');
beforeEach(() => { mockUser = { plan: 'pro', jetons: 230, jetons_reset_date: '2020-01' }; });
test('keeps purchased credits when the calendar month changes', async () => {
  expect(await checkAndDeduct(1, 'quiz', 'pro')).toMatchObject({ ok: true, balance: 228 });
});
test('expiry removes entitlement without erasing the remaining balance', async () => {
  mockUser.expired = true;
  expect(await refillIfNeeded(1, 'pro')).toBe('free');
  expect(mockUser.jetons).toBe(230);
});

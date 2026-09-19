const { getClientIp } = require('../middleware/rateLimit');
afterEach(() => { delete process.env.TRUSTED_PROXY_SECRET; });
const req = headers => ({ ip: '203.0.113.1', headers });
test('ignores forged forwarding headers from unauthenticated clients', () => {
  expect(getClientIp(req({ 'x-vercel-forwarded-for': '198.51.100.9' }))).toBe('203.0.113.1');
  process.env.TRUSTED_PROXY_SECRET = 's'.repeat(40);
  expect(getClientIp(req({ 'x-vercel-forwarded-for': '198.51.100.9', 'x-jangalai-proxy-secret': 'wrong' }))).toBe('203.0.113.1');
});
test('uses a valid client IP only from the authenticated proxy', () => {
  process.env.TRUSTED_PROXY_SECRET = 's'.repeat(40);
  expect(getClientIp(req({ 'x-vercel-forwarded-for': '198.51.100.9', 'x-jangalai-proxy-secret': 's'.repeat(40) }))).toBe('198.51.100.9');
  expect(getClientIp(req({ 'x-vercel-forwarded-for': 'invalid', 'x-jangalai-proxy-secret': 's'.repeat(40) }))).toBe('203.0.113.1');
});

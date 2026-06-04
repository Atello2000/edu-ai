describe('services/email URL handling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env.RESEND_API_KEY;
    delete process.env.APP_URL;
    delete process.env.BACKEND_URL;
    delete process.env.CLIENT_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    jest.dontMock('resend');
    jest.restoreAllMocks();
  });

  it('builds verification links from BACKEND_URL when configured', () => {
    process.env.BACKEND_URL = 'ttps://api.example.com///';
    process.env.CLIENT_URL = 'https://app.example.com';

    const { _private } = require('../services/email');

    expect(_private.getBackendUrl()).toBe('https://api.example.com');
  });

  it('builds password reset links from CLIENT_URL when configured', () => {
    process.env.BACKEND_URL = 'https://api.example.com';
    process.env.CLIENT_URL = 'https://app.example.com/';

    const { _private } = require('../services/email');

    expect(_private.getClientUrl()).toBe('https://app.example.com');
  });

  it('logs the verification link in development when Resend is not configured', async () => {
    process.env.BACKEND_URL = 'https://api.example.com';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const { sendVerifyEmail } = require('../services/email');
    await sendVerifyEmail('user@example.com', 'abc123');

    expect(logSpy.mock.calls.flat().join('\n')).toContain('https://api.example.com/api/auth/verify/abc123');
    logSpy.mockRestore();
  });

  it('fails in production when Resend is not configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BACKEND_URL = 'https://api.example.com';

    const { sendVerifyEmail } = require('../services/email');

    await expect(sendVerifyEmail('user@example.com', 'abc123')).rejects.toThrow(/RESEND_API_KEY/);
  });

  it('throws when Resend returns an API error object', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    jest.doMock('resend', () => ({
      Resend: class {
        constructor() {
          this.emails = {
            send: async () => ({
              data: null,
              error: { name: 'validation_error', message: 'Domain is not verified' },
            }),
          };
        }
      },
    }));

    const { sendVerifyEmail } = require('../services/email');

    await expect(sendVerifyEmail('user@example.com', 'abc123')).rejects.toThrow('Domain is not verified');
  });
});

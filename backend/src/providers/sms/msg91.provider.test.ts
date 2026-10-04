import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  env: { MSG91_AUTH_KEY: 'test-auth-key', MSG91_TEMPLATE_ID: 'test-template-id' },
}));

import { Msg91SmsProvider } from './msg91.provider';

describe('Msg91SmsProvider', () => {
  const provider = new Msg91SmsProvider();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the MSG91 SendOTP API with the auth key, template id, and OTP code', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'success' }),
    });

    await provider.sendOtp('9876543210', '123456');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://control.msg91.com/api/v5/otp');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      template_id: 'test-template-id',
      mobile: '919876543210',
      otp: '123456',
    });
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authkey: 'test-auth-key' }),
      })
    );
  });

  it('throws when the HTTP call itself fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid authkey',
    });

    await expect(provider.sendOtp('9876543210', '123456')).rejects.toThrow(/MSG91 send failed \(401\)/);
  });

  it('throws when MSG91 responds 200 OK but with an application-level error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'error', message: 'Template not found' }),
    });

    await expect(provider.sendOtp('9876543210', '123456')).rejects.toThrow(/Template not found/);
  });
});

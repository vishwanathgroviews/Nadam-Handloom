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

  it('POSTs to the MSG91 Flow API with the auth key, template id, and OTP code', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'success' }),
    });

    await provider.sendOtp('9876543210', '123456');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://control.msg91.com/api/v5/flow/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authkey: 'test-auth-key' }),
      })
    );
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.template_id).toBe('test-template-id');
    expect(body.recipients).toEqual([{ mobiles: '919876543210', OTP: '123456' }]);
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

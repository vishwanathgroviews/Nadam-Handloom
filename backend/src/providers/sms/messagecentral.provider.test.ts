import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  env: { MESSAGE_CENTRAL_CUSTOMER_ID: 'C-TEST', MESSAGE_CENTRAL_KEY: 'dGVzdA==' },
}));

import { MessageCentralSmsProvider } from './messagecentral.provider';
import { TooManyRequestsError } from '../../utils/errors';

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const tokenReply = (token = 'token-1') => reply(200, { status: 200, token });
const sendReply = reply(200, { responseCode: 200, message: 'SUCCESS', data: { verificationId: '4521', timeout: '60' } });

describe('MessageCentralSmsProvider', () => {
  let provider: MessageCentralSmsProvider;
  let fetchMock: ReturnType<typeof vi.fn>;

  const calledUrl = (index: number) => new URL(fetchMock.mock.calls[index][0]);

  beforeEach(() => {
    provider = new MessageCentralSmsProvider();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs in, asks for a 6-digit OTP, and returns the verification id as the reference', async () => {
    fetchMock.mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(sendReply);

    await expect(provider.sendOtp('9876543210')).resolves.toEqual({ reference: '4521' });

    expect(calledUrl(0).pathname).toBe('/auth/v1/authentication/token');
    expect(Object.fromEntries(calledUrl(0).searchParams)).toEqual({
      customerId: 'C-TEST',
      key: 'dGVzdA==',
      scope: 'NEW',
      country: '91',
    });

    expect(calledUrl(1).pathname).toBe('/verification/v3/send');
    expect(Object.fromEntries(calledUrl(1).searchParams)).toEqual({
      countryCode: '91',
      customerId: 'C-TEST',
      flowType: 'SMS',
      mobileNumber: '9876543210',
      otpLength: '6',
    });
    expect(fetchMock.mock.calls[1][1]).toEqual({ method: 'POST', headers: { authToken: 'token-1' } });
  });

  it('signs in once and reuses the token on later calls', async () => {
    fetchMock.mockResolvedValueOnce(tokenReply()).mockResolvedValue(sendReply);

    await provider.sendOtp('9876543210');
    await provider.sendOtp('9876543211');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('signs in again and retries when the token is turned away', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenReply('stale'))
      .mockResolvedValueOnce(reply(401, {}))
      .mockResolvedValueOnce(tokenReply('fresh'))
      .mockResolvedValueOnce(sendReply);

    await expect(provider.sendOtp('9876543210')).resolves.toEqual({ reference: '4521' });
    expect(fetchMock.mock.calls[3][1].headers).toEqual({ authToken: 'fresh' });
  });

  it('throws when sign-in fails', async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { status: 401 }));

    await expect(provider.sendOtp('9876543210')).rejects.toThrow(/Message Central sign-in failed \(401\)/);
  });

  it('reports a request made while the last code is still live as a rate limit', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenReply())
      .mockResolvedValueOnce(reply(400, { responseCode: 506, message: 'REQUEST_ALREADY_EXISTS' }));

    await expect(provider.sendOtp('9876543210')).rejects.toThrow(TooManyRequestsError);
  });

  it('throws when the send is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenReply())
      .mockResolvedValueOnce(reply(400, { responseCode: 501, message: 'INVALID_CUSTOMER_ID' }));

    await expect(provider.sendOtp('9876543210')).rejects.toThrow(/INVALID_CUSTOMER_ID/);
  });

  it('verifies a correct entry against the reference', async () => {
    fetchMock.mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(
      reply(200, { responseCode: 200, message: 'SUCCESS', data: { verificationStatus: 'VERIFICATION_COMPLETED' } })
    );

    await expect(provider.verifyOtp('4521', '654321')).resolves.toBe(true);

    expect(calledUrl(1).pathname).toBe('/verification/v3/validateOtp');
    expect(Object.fromEntries(calledUrl(1).searchParams)).toEqual({
      verificationId: '4521',
      code: '654321',
      flowType: 'SMS',
    });
    expect(fetchMock.mock.calls[1][1]).toEqual({ method: 'GET', headers: { authToken: 'token-1' } });
  });

  it.each([
    [702, 'WRONG_OTP_PROVIDED'],
    [705, 'VERIFICATION_EXPIRED'],
    [703, 'ALREADY_VERIFIED'],
  ])('treats %i %s as an entry that does not verify', async (responseCode, message) => {
    fetchMock.mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(reply(400, { responseCode, message }));

    await expect(provider.verifyOtp('4521', '000000')).resolves.toBe(false);
  });

  it('throws when the verification call itself fails', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenReply())
      .mockResolvedValueOnce(reply(500, { responseCode: 500, message: 'SERVER_ERROR' }));

    await expect(provider.verifyOtp('4521', '654321')).rejects.toThrow(/Message Central verify failed \(500\)/);
  });
});

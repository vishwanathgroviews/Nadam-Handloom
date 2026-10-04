import { env } from '../../config/env';
import { BadRequestError, TooManyRequestsError } from '../../utils/errors';
import { SmsProvider } from './sms.provider';

// Message Central's VerifyNow API. Unlike MSG91 it needs no DLT registration
// or sender ID of our own — Message Central sends from its own pre-approved
// route — which is why it can go live before the shop's DLT paperwork exists.
//
// The catch is that it generates the OTP itself: there is no way to hand it
// the code we made. So sendOtp ignores `code` and returns Message Central's
// verificationId, and the customer's entry is checked by calling them back
// (verifyOtp) instead of comparing hashes on our side.
const BASE_URL = 'https://cpaas.messagecentral.com';

// Their default is 4 digits; every OTP screen and request schema here expects 6.
const OTP_LENGTH = '6';

// Message Central's own result codes, returned in the body's responseCode.
const SUCCESS = 200;
const REQUEST_ALREADY_EXISTS = 506;
const VERIFICATION_EXPIRED = 705;
// Each of these means "that entry does not verify" rather than "the call
// failed": invalid verification id, verification failed, wrong OTP, already
// verified.
const NOT_VERIFIED = [505, 700, 702, 703];

export class MessageCentralSmsProvider implements SmsProvider {
  // The API is called with a token obtained from the account credentials.
  // Kept for reuse and fetched again whenever a call is turned away with 401.
  private token: string | null = null;

  private async fetchToken(): Promise<string> {
    const params = new URLSearchParams({
      customerId: env.MESSAGE_CENTRAL_CUSTOMER_ID!,
      key: env.MESSAGE_CENTRAL_KEY!,
      scope: 'NEW',
      country: '91',
    });
    const response = await fetch(`${BASE_URL}/auth/v1/authentication/token?${params}`, {
      headers: { accept: '*/*' },
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || !data?.token) {
      throw new Error(`Message Central sign-in failed (${response.status})`);
    }
    return data.token;
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    params: Record<string, string>
  ): Promise<{ status: number; body: any }> {
    const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      this.token ??= await this.fetchToken();
      response = await fetch(url, { method, headers: { authToken: this.token } });
      if (response.status !== 401) break;
      this.token = null;
    }
    return { status: response!.status, body: await response!.json().catch(() => ({})) };
  }

  async sendOtp(mobile: string): Promise<{ reference: string }> {
    const { status, body } = await this.request('POST', '/verification/v3/send', {
      countryCode: '91',
      customerId: env.MESSAGE_CENTRAL_CUSTOMER_ID!,
      flowType: 'SMS',
      mobileNumber: mobile,
      otpLength: OTP_LENGTH,
    });

    const verificationId = body?.data?.verificationId;
    if (Number(body?.responseCode) === SUCCESS && verificationId) {
      return { reference: String(verificationId) };
    }
    // They refuse a second code for the same number while the first is still
    // live — the same situation our own resend cooldown reports.
    if (Number(body?.responseCode) === REQUEST_ALREADY_EXISTS) {
      throw new TooManyRequestsError('Please wait before requesting another code');
    }
    throw new Error(`Message Central send failed (${status}): ${body?.message ?? 'unknown error'}`);
  }

  async verifyOtp(reference: string, code: string): Promise<boolean> {
    const { status, body } = await this.request('GET', '/verification/v3/validateOtp', {
      verificationId: reference,
      code,
      flowType: 'SMS',
    });

    const responseCode = Number(body?.responseCode);
    if (responseCode === SUCCESS) return body?.data?.verificationStatus === 'VERIFICATION_COMPLETED';
    // Their codes live for 60 seconds, so a correct code entered late is
    // common — say that it expired rather than calling it invalid.
    if (responseCode === VERIFICATION_EXPIRED) {
      throw new BadRequestError('This code has expired. Please request a new one.');
    }
    if (NOT_VERIFIED.includes(responseCode)) return false;
    throw new Error(`Message Central verify failed (${status}): ${body?.message ?? 'unknown error'}`);
  }
}

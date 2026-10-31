// Message Central VerifyNow (live since 2026-10-04). It creates the code itself
// and checks it when we call back, so we only keep its verificationId.
// Codes live 60 seconds. Ported from the old backend's provider.
import { env } from '../../config/env.js';
import { tooMany, unavailable } from '../../utils/errors.js';

const BASE_URL = 'https://cpaas.messagecentral.com';
const OTP_LENGTH = '6';
const SUCCESS = 200;
const REQUEST_ALREADY_EXISTS = 506;
const VERIFICATION_EXPIRED = 705;
const NOT_VERIFIED = [505, 700, 702]; // invalid id, failed, wrong code
const ALREADY_VERIFIED = 703;
const TIMEOUT_MS = 12000;

let token = null;

async function call(url, init) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw unavailable('SMS_UNAVAILABLE', 'We couldn\'t reach the SMS service. Please try again in a minute.');
  }
}

async function fetchToken() {
  const params = new URLSearchParams({ customerId: env.MESSAGE_CENTRAL_CUSTOMER_ID, key: env.MESSAGE_CENTRAL_KEY, scope: 'NEW', country: '91' });
  const res = await call(`${BASE_URL}/auth/v1/authentication/token?${params}`, { headers: { accept: '*/*' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.token) throw unavailable('SMS_UNAVAILABLE', 'The SMS service refused our sign-in. Please tell the developer.');
  return data.token;
}

async function request(method, path, params) {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    token ??= await fetchToken();
    res = await call(url, { method, headers: { authToken: token } });
    if (res.status !== 401) break;
    token = null; // expired token: fetch a new one once
  }
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

export const messageCentralProvider = {
  name: 'messagecentral',
  // Set by "Validity Time" in Message Central's dashboard, not per request.
  codeTtlSeconds: env.MESSAGE_CENTRAL_CODE_TTL_SECONDS,
  async send(mobile) {
    const { body } = await request('POST', '/verification/v3/send', {
      countryCode: '91', customerId: env.MESSAGE_CENTRAL_CUSTOMER_ID, flowType: 'SMS', mobileNumber: mobile, otpLength: OTP_LENGTH,
    });
    const id = body?.data?.verificationId;
    const rc = Number(body?.responseCode);
    if (rc === SUCCESS && id) return { stored: `provider:${id}` };
    if (rc === REQUEST_ALREADY_EXISTS) throw tooMany('CODE_RESEND_WAIT', 'A code was sent a moment ago. Please wait before asking for another.', { retryAfterSeconds: 60 });
    throw unavailable('SMS_UNAVAILABLE', 'We couldn\'t send the code right now. Please try again in a minute.');
  },
  // Returns { ok }, { expired } or { alreadyVerified } (checked before; a lost reply).
  async verify(reference, code) {
    const { body } = await request('GET', '/verification/v3/validateOtp', { verificationId: reference, code, flowType: 'SMS' });
    const rc = Number(body?.responseCode);
    if (rc === SUCCESS) return { ok: body?.data?.verificationStatus === 'VERIFICATION_COMPLETED' };
    if (rc === VERIFICATION_EXPIRED) return { ok: false, expired: true };
    if (rc === ALREADY_VERIFIED) return { ok: false, alreadyVerified: true };
    if (NOT_VERIFIED.includes(rc)) return { ok: false };
    throw unavailable('SMS_UNAVAILABLE', 'We couldn\'t check the code right now. Please try again in a minute.');
  },
};

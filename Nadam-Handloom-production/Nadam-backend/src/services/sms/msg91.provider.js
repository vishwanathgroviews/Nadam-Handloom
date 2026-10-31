// MSG91 OTP (planned once the shop's DLT registration is done, web-01 section 12).
// We make the code ourselves and keep only its hash; MSG91 delivers it with the
// DLT-approved template MSG91_TEMPLATE_ID. Checking a code needs no call to MSG91.
// Not yet tried against MSG91: switch SMS_PROVIDER to msg91 only after a real test.
import { env } from '../../config/env.js';
import { randomCode, sha256 } from '../../utils/crypto.js';
import { unavailable } from '../../utils/errors.js';

const SEND_URL = 'https://control.msg91.com/api/v5/otp';
const TIMEOUT_MS = 12000;

export const msg91Provider = {
  name: 'msg91',
  codeTtlSeconds: null, // our own code: the caller's limit applies
  async send(mobile) {
    const code = randomCode(6);
    const params = new URLSearchParams({ template_id: env.MSG91_TEMPLATE_ID, mobile: `91${mobile}`, otp: code });
    let res;
    try {
      res = await fetch(`${SEND_URL}?${params}`, {
        method: 'POST',
        headers: { authkey: env.MSG91_AUTH_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ OTP: code }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw unavailable('SMS_UNAVAILABLE', 'We couldn\'t reach the SMS service. Please try again in a minute.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.type !== 'success') {
      console.error(`[sms:msg91] send refused: ${res.status} ${String(body?.message || '').slice(0, 120)}`);
      throw unavailable('SMS_UNAVAILABLE', 'We couldn\'t send the code right now. Please try again in a minute.');
    }
    return { stored: sha256(code), code };
  },
};

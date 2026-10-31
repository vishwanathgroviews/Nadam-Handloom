// Test-mode SMS: makes the code here and prints it in the server log instead of
// sending it. Never allowed in production (see config/env.js).
import { randomCode, sha256 } from '../../utils/crypto.js';
import { maskMobile } from '../../utils/phone.js';
import { env } from '../../config/env.js';

export const consoleProvider = {
  name: 'console',
  codeTtlSeconds: null,
  async send(mobile) {
    const code = randomCode(6);
    if (!env.isTest) console.log(`[sms:test-mode] code for ${maskMobile(mobile)} is ${code}`);
    return { stored: sha256(code), code };
  },
};

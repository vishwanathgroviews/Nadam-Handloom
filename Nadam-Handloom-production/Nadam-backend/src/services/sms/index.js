// Picks the SMS provider from SMS_PROVIDER and checks codes whichever way they were made.
import { env } from '../../config/env.js';
import { sha256, safeEqual } from '../../utils/crypto.js';
import { consoleProvider } from './console.provider.js';
import { messageCentralProvider } from './messagecentral.provider.js';
import { msg91Provider } from './msg91.provider.js';

const PROVIDER_PREFIX = 'provider:';
const PROVIDERS = { messagecentral: messageCentralProvider, msg91: msg91Provider, console: consoleProvider };
const active = PROVIDERS[env.SMS_PROVIDER] || consoleProvider;

export const sms = {
  name: active.name,
  // The longest a code can live with this provider (null = as long as we decide).
  codeTtlSeconds: active.codeTtlSeconds ?? null,
  send: (mobile) => active.send(mobile),
  // stored = OtpCode.codeHash. Returns { ok } or { expired }.
  async verify(stored, code) {
    if (stored.startsWith(PROVIDER_PREFIX)) return messageCentralProvider.verify(stored.slice(PROVIDER_PREFIX.length), code);
    return { ok: safeEqual(stored, sha256(code)) };
  },
};

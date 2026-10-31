// Asking for SMS codes, shared by the setup, Forgot PIN and new-phone screens.
import { publicApi } from '../api/client';
import { flowStore } from './flow';

const PATHS = { setup: '/auth/setup/request-code', forgot: '/auth/forgot/request-code', device: '/auth/device/request-code' };

// Sends (or re-sends) a code for the current journey and records the timing.
export async function requestCode(purpose) {
  const f = flowStore.get();
  const body = purpose === 'device' ? { stepToken: f.stepToken } : { mobile: f.mobile };
  const res = await publicApi(PATHS[purpose], { method: 'POST', body });
  flowStore.set({
    purpose,
    sentAt: Date.now(),
    resendAt: Date.now() + res.resendInSeconds * 1000,
    expiresAt: Date.now() + res.expiresInSeconds * 1000,
    devCode: res.devCode || null, // test mode only: the server never sends this in production
    mobileMasked: res.mobileMasked || f.mobileMasked,
  });
  return res;
}

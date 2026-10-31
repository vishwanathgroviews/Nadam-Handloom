// Who may pay online on the website (W6). Everyone, once payments are on; while they are being
// tried on the live website (PAYMENTS_TESTERS), only those customers: the rest order on
// WhatsApp as before, and the server refuses their Pay.
import { env } from '../../config/env.js';

export const testersOnly = () => env.payments.testers.length > 0;

export function canPayOnline(account) {
  if (!env.payments.enabled) return false;
  return !testersOnly() || (!!account?.phone && env.payments.testers.includes(account.phone));
}

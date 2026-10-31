// May this visitor pay online (W6)? Once payments are on, everyone; while they are being tried on
// the live website (testersOnly), only the signed-in customers the server lists (payOnline):
// everyone else orders on WhatsApp as before.
import { useAuth } from '../auth/useAuth.js';
import { useConfig } from '../config/useConfig.js';

export function paymentsOpen(payments, customer) {
  if (payments?.enabled !== true) return false;
  return !payments.testersOnly || customer?.payOnline === true;
}

export function usePaymentsOn() {
  const { config } = useConfig();
  const { customer } = useAuth();
  return paymentsOpen(config.payments, customer);
}

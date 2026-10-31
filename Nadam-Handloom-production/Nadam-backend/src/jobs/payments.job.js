// Website W6, in the background: holds whose 15 minutes are up end every 30 seconds (the
// sarees go back on sale); every minute, payments the page couldn't confirm are checked with
// Razorpay, lost notices are caught, refunds are retried and missing invoices are made.
import { PAYMENTS } from '../config/constants.js';
import { endExpiredHolds, checkPending } from '../services/shop/checkout.service.js';

let running = { holds: false, checks: false };

async function once(name, fn) {
  if (running[name]) return; // the previous run is still going
  running[name] = true;
  try { await fn(); } catch (e) { console.error(`[payments] ${name}: ${e.message}`); } finally { running[name] = false; }
}

export function startPaymentJobs() {
  const a = setInterval(() => once('holds', () => endExpiredHolds()), PAYMENTS.SWEEP_SECONDS * 1000);
  const b = setInterval(() => once('checks', () => checkPending()), PAYMENTS.CHECK_SECONDS * 1000);
  a.unref();
  b.unref();
  return [a, b];
}
export const resetPaymentJobsForTests = () => { running = { holds: false, checks: false }; };

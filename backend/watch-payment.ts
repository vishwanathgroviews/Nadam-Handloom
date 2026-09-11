/**
 * Live cross-check for a Razorpay test-mode payment.
 *
 * Run this in a terminal, then complete a payment in the browser — it prints
 * every order/payment/invoice state change as it happens, so you can see
 * exactly where a payment stops instead of guessing from the UI.
 *
 *   npx tsx watch-payment.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const stamp = () => new Date().toLocaleTimeString('en-IN', { hour12: false });

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID ?? '';
  console.log(`\nRazorpay key : ${keyId.slice(0, 8)}…${keyId.slice(-4)}  (${keyId.startsWith('rzp_test_') ? 'TEST MODE' : 'LIVE — STOP'})`);
  console.log('Watching for new orders… place one in the browser now. Ctrl+C to stop.\n');

  const seen = new Map<string, string>();
  // Only report orders created from now on, so old test orders stay quiet.
  let since = new Date();

  for (;;) {
    const orders = await prisma.order.findMany({
      where: { placedAt: { gte: since } },
      include: { payment: true, invoice: true },
      orderBy: { placedAt: 'asc' },
    });

    for (const o of orders) {
      const state = `${o.status}|${o.payment?.status ?? 'none'}|${o.invoice?.invoiceNumber ?? 'none'}`;
      if (seen.get(o.id) === state) continue;
      seen.set(o.id, state);

      const paid = o.payment?.status === 'paid';
      const mark = paid ? 'OK  ' : o.status === 'payment_failed' ? 'FAIL' : '... ';
      console.log(
        `[${stamp()}] ${mark} ${o.orderNumber}  ₹${o.total}  order=${o.status}  payment=${o.payment?.status ?? 'none'}` +
          `  invoice=${o.invoice?.invoiceNumber ?? '—'}`
      );
      if (o.payment?.razorpayPaymentId) console.log(`            razorpay payment: ${o.payment.razorpayPaymentId}`);
      if (paid) console.log('            ^ payment captured and order finalized — this is what success looks like\n');
      if (o.status === 'payment_failed') {
        console.log('            ^ signature rejected or payment abandoned; held stock was released\n');
      }
    }

    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

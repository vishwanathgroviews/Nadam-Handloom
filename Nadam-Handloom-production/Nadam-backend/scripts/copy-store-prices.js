// Module 10 (decision 6.3): copies the store price each counter and WhatsApp sale line
// was sold against onto the line itself (OrderItem.storePrice), from the bargain records
// in the activity log; a line with no bargain record was sold at the store price.
// Run once at switch-over, before the old server's 30-day log deletion can remove them.
//   node scripts/copy-store-prices.js        (shows what it would do)
//   node scripts/copy-store-prices.js --yes  (writes)
import { prisma, disconnectDatabase } from '../src/config/database.js';

const write = process.argv.includes('--yes');
const lines = await prisma.orderItem.findMany({
  where: { storePrice: null, order: { channel: { in: ['store', 'whatsapp'] } } },
  select: { id: true, orderId: true, productId: true, pieceId: true, priceSnapshot: true },
});
const events = await prisma.authEvent.findMany({ where: { eventType: 'offline_sale_price_override' }, select: { metadata: true } });
const recorded = new Map();
for (const { metadata: m } of events) {
  if (!m?.orderId || m.categoryStorePrice == null) continue;
  const key = `${m.orderId}:${m.pieceId ?? m.productId}`;
  if (!recorded.has(key)) recorded.set(key, Number(m.categoryStorePrice));
  if (m.productId && !recorded.has(`${m.orderId}:${m.productId}`)) recorded.set(`${m.orderId}:${m.productId}`, Number(m.categoryStorePrice));
}
let fromLog = 0;
const updates = lines.map((l) => {
  const r = recorded.get(`${l.orderId}:${l.pieceId ?? l.productId}`) ?? recorded.get(`${l.orderId}:${l.productId}`);
  if (r != null) fromLog += 1;
  return { id: l.id, storePrice: r ?? Number(l.priceSnapshot) };
});
console.log(`${updates.length} sale lines without a store price: ${fromLog} from bargain records, ${updates.length - fromLog} sold at the store price.`);
if (write) {
  for (const u of updates) await prisma.orderItem.update({ where: { id: u.id }, data: { storePrice: u.storePrice } });
  console.log('Written.');
} else console.log('Nothing written. Run again with --yes to write.');
await disconnectDatabase();

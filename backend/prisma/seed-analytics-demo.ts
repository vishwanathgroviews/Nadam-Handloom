// Supplementary, idempotent demo-data seed for the Admin/Staff Analytics
// screen — spreads realistic in-store (and a few online) sales across the
// last ~9 weeks so "This week / 30 days" actually has a prior period to
// compare against (revenueChangePct/orderCountChangePct — see
// analytics.service.ts — are null with nothing before the current window),
// the Home dashboard's "Sold Today" section has entries, and "Top
// Subcategories" has more than one or two rows.
//
// Safe to re-run: skips entirely if a prior run's marker orders already
// exist (checked via the DEMO_REF_PREFIX order-number prefix, which real
// orders — always "NH" + exactly 8 digits, see utils/orderNumber.ts — never
// produce).
import 'dotenv/config';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_REF_PREFIX = 'NHDEMOA';
const DAY_MS = 24 * 60 * 60 * 1000;

function demoOrderNumber(i: number): string {
  return `${DEMO_REF_PREFIX}${String(i).padStart(4, '0')}${randomBytes(2).toString('hex').toUpperCase()}`;
}

async function seedStoreOrders(products: { id: string; name: string; subcategory: { storePrice: any } }[]) {
  // Days-ago offsets: a handful "today", a spread across this week, this
  // month, and the prior month (so period-over-period comparisons are real).
  const offsets: number[] = [
    0, 0, 0, // today
    1, 2, 3, 4, 5, 6, // rest of this week
    9, 12, 16, 20, 24, 27, // rest of this month
    34, 38, 42, 46, 50, 54, 58, // the prior ~30-day period, for comparison
  ];

  let created = 0;
  for (let i = 0; i < offsets.length; i++) {
    const product = products[i % products.length]!;
    const quantity = 1 + (i % 3 === 0 ? 1 : 0); // occasional qty-2 sale
    const unitPrice = Number(product.subcategory.storePrice);
    const total = unitPrice * quantity;
    const placedAt = new Date(Date.now() - offsets[i]! * DAY_MS - i * 60_000); // stagger within the day too

    const order = await prisma.order.create({
      data: {
        orderNumber: demoOrderNumber(i),
        channel: 'store',
        status: 'delivered',
        subtotal: total,
        total,
        shippingAddress: {},
        placedAt,
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        nameSnapshot: product.name,
        priceSnapshot: unitPrice,
        quantity,
      },
    });
    await prisma.stockLedger.create({
      data: { productId: product.id, delta: -quantity, reason: 'offline_sale', channel: 'store', ref: order.orderNumber },
    });
    created += 1;
  }
  return created;
}

async function seedOnlineOrders(
  products: { id: string; name: string; subcategory: { onlinePrice: any } }[]
) {
  const customer = await prisma.authAccount.findFirst({
    where: { userProfile: { isNot: null } },
    include: { userProfile: true },
  });
  const address = customer ? await prisma.address.findFirst({ where: { authAccountId: customer.id } }) : null;
  if (!customer || !address) {
    console.log('No demo customer/address found — skipping online demo orders (store orders still seeded).');
    return 0;
  }

  const shippingAddress = {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
  };

  // A handful across this period and the prior one, delivered (a PAID status).
  const offsets = [2, 8, 15, 22, 40, 52];
  let created = 0;
  for (let i = 0; i < offsets.length; i++) {
    const product = products[i % products.length]!;
    const unitPrice = Number(product.subcategory.onlinePrice);
    const placedAt = new Date(Date.now() - offsets[i]! * DAY_MS - i * 90_000);
    const orderNumber = demoOrderNumber(100 + i);

    const order = await prisma.order.create({
      data: {
        orderNumber,
        authAccountId: customer.id,
        addressId: address.id,
        status: 'delivered',
        subtotal: unitPrice,
        total: unitPrice,
        shippingAddress,
        placedAt,
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        nameSnapshot: product.name,
        priceSnapshot: unitPrice,
        quantity: 1,
      },
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: `order_demoanalytics_${order.id.slice(0, 14)}`,
        razorpayPaymentId: `pay_demoanalytics_${order.id.slice(0, 14)}`,
        status: 'paid',
        amount: unitPrice,
      },
    });
    await prisma.shipment.create({
      data: {
        orderId: order.id,
        status: 'delivered',
        awbNumber: `DTDC${randomBytes(4).toString('hex').toUpperCase()}`,
        shippedAt: new Date(placedAt.getTime() + DAY_MS),
      },
    });
    created += 1;
  }
  return created;
}

async function main() {
  const alreadySeeded = await prisma.order.findFirst({ where: { orderNumber: { startsWith: DEMO_REF_PREFIX } } });
  if (alreadySeeded) {
    console.log('Analytics demo data already seeded (found an order with the demo prefix), skipping.');
    return;
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    take: 8,
    include: { subcategory: { select: { storePrice: true, onlinePrice: true } } },
  });
  if (products.length === 0) {
    console.log('No active products found — run seed.ts first. Skipping analytics demo data.');
    return;
  }

  const storeCount = await seedStoreOrders(products);
  const onlineCount = await seedOnlineOrders(products);
  console.log(`Seeded ${storeCount} demo store order(s) and ${onlineCount} demo online order(s) for Analytics.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

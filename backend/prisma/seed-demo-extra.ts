// Supplementary, idempotent demo-data seed — adds the realistic variety
// seed.ts's original single "one processing order" scenario doesn't cover,
// so every module has something to actually show in a client demo: a
// second staff login, orders across every shipment stage, an in-store sale,
// and a few low-stock items.
// Safe to re-run: every section checks for its own prior output and skips.
import 'dotenv/config';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashSecret } from '../src/utils/hash';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_STAFF_MOBILE = '9999999998';
const DEMO_STAFF_MPIN = '471290';

async function seedDemoStaff() {
  const existing = await prisma.authAccount.findUnique({ where: { phone: DEMO_STAFF_MOBILE } });
  if (existing) {
    console.log('Demo staff account already exists, skipping.');
    return;
  }
  const staffRole = await prisma.role.findUniqueOrThrow({ where: { name: 'STAFF' } });
  const mpinHash = await hashSecret(DEMO_STAFF_MPIN);

  await prisma.$transaction(async (tx) => {
    const account = await tx.authAccount.create({
      data: {
        email: 'demo.staff@nandamhandlooms.test',
        phone: DEMO_STAFF_MOBILE,
        mpinHash,
        mpinSetAt: new Date(),
        status: 'active',
        phoneVerifiedAt: new Date(),
        adminProfile: { create: { firstName: 'Demo', lastName: 'Staff' } },
      },
    });
    await tx.userRole.create({ data: { authAccountId: account.id, roleId: staffRole.id } });
  });

  console.log(`Demo STAFF account created — mobile ${DEMO_STAFF_MOBILE}, MPIN ${DEMO_STAFF_MPIN}.`);
}

async function seedLowStockProducts() {
  const candidates = await prisma.product.findMany({
    where: { isActive: true, trackingMode: 'quantity', stock: { gt: 3 } },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });
  if (candidates.length === 0) {
    console.log('No eligible products to mark low-stock (already low, or none seeded), skipping.');
    return;
  }
  for (const [i, product] of candidates.entries()) {
    await prisma.product.update({ where: { id: product.id }, data: { stock: i } }); // 0, 1, 2 — a mix including out-of-stock
  }
  console.log(`Set ${candidates.length} product(s) to low/zero stock for the Inventory > Low Stock screen.`);
}


async function seedOrderVariety() {
  const customer = await prisma.authAccount.findFirst({ where: { userProfile: { isNot: null } }, include: { userProfile: true } });
  if (!customer) {
    console.log('No demo customer found yet (seed.ts creates one) — skipping order variety.');
    return;
  }
  const existingOrders = await prisma.order.count({ where: { authAccountId: customer.id } });
  if (existingOrders >= 3) {
    console.log('Demo customer already has multiple orders, skipping order variety.');
    return;
  }

  const address = await prisma.address.findFirst({ where: { authAccountId: customer.id } });
  if (!address) {
    console.log('Demo customer has no address yet, skipping order variety.');
    return;
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    skip: 1, // the first product is already used by seed.ts's original order
    take: 2,
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, subcategory: { select: { onlinePrice: true, storePrice: true } } },
  });
  if (products.length < 2) {
    console.log('Not enough distinct products to build order variety, skipping.');
    return;
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

  const makeOnlineOrder = async (
    product: (typeof products)[number],
    status: 'shipped' | 'delivered',
    placedDaysAgo: number
  ) => {
    const orderNumber = `NH${Math.floor(Math.random() * 100_000_000).toString().padStart(8, '0')}`;
    const subtotal = Number(product.subcategory.onlinePrice);
    const placedAt = new Date(Date.now() - placedDaysAgo * 24 * 60 * 60 * 1000);
    const shippedAt = new Date(placedAt.getTime() + 1 * 24 * 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        orderNumber,
        authAccountId: customer.id,
        addressId: address.id,
        status,
        subtotal,
        total: subtotal,
        shippingAddress,
        placedAt,
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        nameSnapshot: product.name,
        priceSnapshot: product.subcategory.onlinePrice,
        imageSnapshot: product.images[0]?.url ?? null,
        quantity: 1,
      },
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: `order_seed_${order.id.slice(0, 18)}`,
        razorpayPaymentId: `pay_seed_${order.id.slice(0, 18)}`,
        status: 'paid',
        amount: subtotal,
      },
    });
    await prisma.shipment.create({
      data: {
        orderId: order.id,
        status,
        awbNumber: `DTDC${randomBytes(4).toString('hex').toUpperCase()}`,
        shippedAt,
      },
    });
    return orderNumber;
  };

  const shippedOrderNumber = await makeOnlineOrder(products[0]!, 'shipped', 3);
  const deliveredOrderNumber = await makeOnlineOrder(products[1]!, 'delivered', 10);

  // One in-store sale — mirrors createOfflineOrder in inventory.service.ts
  // (channel:'store', straight to 'delivered', no shipment/payment rows —
  // an in-person sale is settled at the counter, not tracked for shipping).
  const storeProduct = products[0]!;
  const storeOrderNumber = `NH${Math.floor(Math.random() * 100_000_000).toString().padStart(8, '0')}`;
  const storePrice = Number(storeProduct.subcategory.storePrice);
  const storeOrder = await prisma.order.create({
    data: {
      orderNumber: storeOrderNumber,
      channel: 'store',
      status: 'delivered',
      subtotal: storePrice,
      total: storePrice,
      shippingAddress: {},
    },
  });
  await prisma.orderItem.create({
    data: {
      orderId: storeOrder.id,
      productId: storeProduct.id,
      nameSnapshot: storeProduct.name,
      priceSnapshot: storeProduct.subcategory.storePrice,
      quantity: 1,
    },
  });
  await prisma.stockLedger.create({
    data: { productId: storeProduct.id, delta: -1, reason: 'offline_sale', channel: 'store', ref: storeOrderNumber },
  });

  console.log(
    `Seeded order variety: ${shippedOrderNumber} (Shipped), ${deliveredOrderNumber} (Delivered), ${storeOrderNumber} (in-store sale).`
  );
}

async function main() {
  await seedDemoStaff();
  await seedLowStockProducts();
  await seedOrderVariety();
  console.log('Demo data seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

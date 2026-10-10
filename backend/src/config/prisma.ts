import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { isMockDb } from '../modules/catalog/catalog.mock';
import { createFakePrisma, seedRoles } from '../test/fakePrisma';
import { hashSecret } from '../utils/hash';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  if (isMockDb()) {
    const fake = createFakePrisma();
    const db = fake.db as any;
    seedRoles(db);

    const DEMO_PHONE = '9876543210';
    const DEMO_EMAIL = 'customer@nandamhandlooms.com';
    const customerRole = db.role.find((r: any) => r.name === 'CUSTOMER');

    hashSecret('284759').then((mpinHash) => {
      const authAccountId = 'demo-cust-acc-01';
      const addressId = 'demo-addr-01';
      const order1Id = 'demo-order-01';
      const order2Id = 'demo-order-02';
      const order3Id = 'demo-order-03';
      const order4Id = 'demo-order-04';

      db.authAccount.push({
        id: authAccountId,
        phone: DEMO_PHONE,
        email: DEMO_EMAIL,
        status: 'active',
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        mpinHash,
        mpinSetAt: new Date(),
        securityStamp: 'stamp-demo',
        failedLoginAttempts: 0,
        mfaEnabled: false,
        isCompromised: false,
        createdAt: new Date(Date.now() - 30 * 86400000),
        updatedAt: new Date(),
      });

      db.userProfile.push({
        id: 'demo-profile-01',
        authAccountId,
        firstName: 'Sai Siddartha',
        lastName: 'Gorantla',
        displayName: 'Sai Siddartha',
        preferences: { city: 'Guntur', state: 'Andhra Pradesh', pincode: '522503' },
        createdAt: new Date(Date.now() - 30 * 86400000),
        updatedAt: new Date(),
      });

      if (customerRole) {
        db.userRole.push({
          id: 'demo-ur-01',
          authAccountId,
          roleId: customerRole.id,
          assignedAt: new Date(),
        });
      }

      db.address.push({
        id: addressId,
        authAccountId,
        fullName: 'Sai Siddartha Gorantla',
        phone: DEMO_PHONE,
        line1: '#10-23, Opp. Brahmam Gari Temple',
        line2: 'Old Mangalagiri',
        city: 'Guntur',
        state: 'Andhra Pradesh',
        pincode: '522503',
        country: 'India',
        isDefault: true,
        createdAt: new Date(Date.now() - 15 * 86400000),
        updatedAt: new Date(),
      });

      // Sample order 1: Paid & Delivered (Eligible for tracking)
      db.order.push({
        id: order1Id,
        orderNumber: 'NH20261001',
        authAccountId,
        addressId,
        channel: 'online',
        status: 'delivered',
        subtotal: 4500,
        total: 4500,
        placedAt: new Date(Date.now() - 5 * 86400000),
        shippingAddress: {
          fullName: 'Sai Siddartha Gorantla',
          phone: DEMO_PHONE,
          line1: '#10-23, Opp. Brahmam Gari Temple',
          line2: 'Old Mangalagiri',
          city: 'Guntur',
          state: 'Andhra Pradesh',
          pincode: '522503',
          country: 'India',
        },
        createdAt: new Date(Date.now() - 5 * 86400000),
        updatedAt: new Date(Date.now() - 1 * 86400000),
      });

      db.orderItem.push({
        id: 'demo-item-01',
        orderId: order1Id,
        productId: 'prod-1',
        nameSnapshot: 'Handloom Kanchi Pattu Saree - Royal Blue',
        priceSnapshot: 4500,
        imageSnapshot: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
        quantity: 1,
        createdAt: new Date(Date.now() - 5 * 86400000),
      });

      db.payment.push({
        id: 'demo-pay-01',
        orderId: order1Id,
        razorpayOrderId: 'order_demo_1001',
        razorpayPaymentId: 'pay_demo_1001',
        status: 'paid',
        amount: 4500,
        method: 'razorpay',
        createdAt: new Date(Date.now() - 5 * 86400000),
        updatedAt: new Date(Date.now() - 5 * 86400000),
      });

      db.shipment.push({
        id: 'demo-ship-01',
        orderId: order1Id,
        carrier: 'DTDC',
        awbNumber: 'D78912345',
        status: 'delivered',
        shippedAt: new Date(Date.now() - 4 * 86400000),
        deliveredAt: new Date(Date.now() - 1 * 86400000),
        createdAt: new Date(Date.now() - 4 * 86400000),
        updatedAt: new Date(Date.now() - 1 * 86400000),
      });

      // Sample order 2: Paid & Processing (Eligible for tracking)
      db.order.push({
        id: order2Id,
        orderNumber: 'NH20261002',
        authAccountId,
        addressId,
        channel: 'online',
        status: 'processing',
        subtotal: 3200,
        total: 3200,
        placedAt: new Date(Date.now() - 1 * 86400000),
        shippingAddress: {
          fullName: 'Sai Siddartha Gorantla',
          phone: DEMO_PHONE,
          line1: '#10-23, Opp. Brahmam Gari Temple',
          line2: 'Old Mangalagiri',
          city: 'Guntur',
          state: 'Andhra Pradesh',
          pincode: '522503',
          country: 'India',
        },
        createdAt: new Date(Date.now() - 1 * 86400000),
        updatedAt: new Date(Date.now() - 1 * 86400000),
      });

      db.orderItem.push({
        id: 'demo-item-02',
        orderId: order2Id,
        productId: 'prod-2',
        nameSnapshot: 'Pure Handloom Gadwal Silk Saree - Crimson Red',
        priceSnapshot: 3200,
        imageSnapshot: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
        quantity: 1,
        createdAt: new Date(Date.now() - 1 * 86400000),
      });

      db.payment.push({
        id: 'demo-pay-02',
        orderId: order2Id,
        razorpayOrderId: 'order_demo_1002',
        razorpayPaymentId: 'pay_demo_1002',
        status: 'paid',
        amount: 3200,
        method: 'razorpay',
        createdAt: new Date(Date.now() - 1 * 86400000),
        updatedAt: new Date(Date.now() - 1 * 86400000),
      });

      db.shipment.push({
        id: 'demo-ship-02',
        orderId: order2Id,
        carrier: 'DTDC',
        awbNumber: 'D98765432',
        status: 'in_transit',
        shippedAt: new Date(Date.now() - 12 * 3600000),
        createdAt: new Date(Date.now() - 12 * 3600000),
        updatedAt: new Date(Date.now() - 12 * 3600000),
      });

      // Sample order 3: Failed Payment (Must NOT appear in tracking)
      db.order.push({
        id: order3Id,
        orderNumber: 'NH20261003',
        authAccountId,
        addressId,
        channel: 'online',
        status: 'payment_failed',
        subtotal: 2800,
        total: 2800,
        placedAt: new Date(Date.now() - 3 * 86400000),
        shippingAddress: {
          fullName: 'Sai Siddartha Gorantla',
          phone: DEMO_PHONE,
          line1: '#10-23, Opp. Brahmam Gari Temple',
          city: 'Guntur',
          state: 'Andhra Pradesh',
          pincode: '522503',
        },
        createdAt: new Date(Date.now() - 3 * 86400000),
        updatedAt: new Date(Date.now() - 3 * 86400000),
      });

      db.orderItem.push({
        id: 'demo-item-03',
        orderId: order3Id,
        productId: 'prod-3',
        nameSnapshot: 'Dharmavaram Tissue Silk Saree',
        priceSnapshot: 2800,
        imageSnapshot: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
        quantity: 1,
        createdAt: new Date(Date.now() - 3 * 86400000),
      });

      db.payment.push({
        id: 'demo-pay-03',
        orderId: order3Id,
        razorpayOrderId: 'order_demo_1003',
        status: 'failed',
        amount: 2800,
        method: 'razorpay',
        createdAt: new Date(Date.now() - 3 * 86400000),
        updatedAt: new Date(Date.now() - 3 * 86400000),
      });

      // Sample order 4: Unpaid / Pending Payment (Must NOT appear in tracking)
      db.order.push({
        id: order4Id,
        orderNumber: 'NH20261004',
        authAccountId,
        addressId,
        channel: 'online',
        status: 'pending_payment',
        subtotal: 3500,
        total: 3500,
        placedAt: new Date(Date.now() - 6 * 3600000),
        shippingAddress: {
          fullName: 'Sai Siddartha Gorantla',
          phone: DEMO_PHONE,
          line1: '#10-23, Opp. Brahmam Gari Temple',
          city: 'Guntur',
          state: 'Andhra Pradesh',
          pincode: '522503',
        },
        createdAt: new Date(Date.now() - 6 * 3600000),
        updatedAt: new Date(Date.now() - 6 * 3600000),
      });

      db.orderItem.push({
        id: 'demo-item-04',
        orderId: order4Id,
        productId: 'prod-4',
        nameSnapshot: 'Uppada Jamdani Light Silk Saree',
        priceSnapshot: 3500,
        imageSnapshot: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=600&q=80',
        quantity: 1,
        createdAt: new Date(Date.now() - 6 * 3600000),
      });

      db.payment.push({
        id: 'demo-pay-04',
        orderId: order4Id,
        razorpayOrderId: 'order_demo_1004',
        status: 'created',
        amount: 3500,
        method: 'razorpay',
        createdAt: new Date(Date.now() - 6 * 3600000),
        updatedAt: new Date(Date.now() - 6 * 3600000),
      });
    });

    return fake.client as unknown as PrismaClient;
  }

  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    transactionOptions: { maxWait: 5000, timeout: 25000 },
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

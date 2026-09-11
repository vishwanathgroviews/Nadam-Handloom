import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

vi.mock('../../providers/sms', () => ({ smsProvider: { sendOtp: vi.fn() } }));
vi.mock('../../providers/storage', () => ({
  storageProvider: {
    isConfigured: vi.fn(() => true),
    upload: vi.fn(),
    deleteObject: vi.fn(() => Promise.resolve()),
  },
}));

import * as prismaModule from '../../config/prisma';
import { smsProvider } from '../../providers/sms';
import { storageProvider } from '../../providers/storage';
import { seedRoles } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import { generateInvoiceForOrder } from './invoices.service';
import app from '../../app';

const fake = (prismaModule as any).__fake;
const sendMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;
let uploadCounter = 0;
let roles: Record<string, { id: string }>;

const extractCode = (): string => {
  const call = sendMock.mock.calls[sendMock.mock.calls.length - 1];
  return call[1];
};

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
  sendMock.mockClear();
  uploadCounter = 0;
  (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (storageProvider.upload as ReturnType<typeof vi.fn>).mockImplementation(async () => {
    uploadCounter += 1;
    return { url: `https://cdn.example.com/invoices/invoice-${uploadCounter}.pdf`, key: `invoices/invoice-${uploadCounter}.pdf` };
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode('fake-logo-bytes').buffer,
    }))
  );
});

const createStaffToken = async (mobile: string, role: 'ADMIN' | 'STAFF' = 'ADMIN') => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: `${role.toLowerCase()}-${mobile}@example.com`, phone: mobile, mpinHash, mpinSetAt: new Date(),
      status: 'active', phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: role, lastName: 'User' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles[role]!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile, mpin: '284759' });
  return login.body.data.tokens.accessToken as string;
};

const registerAndLoginCustomer = async (phone: string) => {
  await request(app).post('/api/v1/auth/customer/register').send({
    firstName: 'Test', lastName: 'Customer', phone, state: 'Telangana', pincode: '500001',
  });
  const code = extractCode();
  const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone, code });
  const setup = await request(app)
    .post('/api/v1/auth/customer/mpin/setup')
    .send({ setupToken: verify.body.data.setupToken, mpin: '284759', confirmMpin: '284759' });
  return { token: setup.body.data.tokens.accessToken as string, authAccountId: setup.body.data.user.id as string };
};

const seedPaidOrder = (
  overrides: Partial<Record<string, any>> = {},
  items: { nameSnapshot: string; priceSnapshot: number; quantity: number }[] = [
    { nameSnapshot: 'Test Saree', priceSnapshot: 2000, quantity: 1 },
  ]
) => {
  const order = {
    id: randomUUID(),
    orderNumber: `NH${randomUUID().slice(0, 8).toUpperCase()}`,
    authAccountId: null,
    addressId: null,
    channel: 'store',
    status: 'delivered',
    subtotal: items.reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0),
    total: items.reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0),
    shippingAddress: {},
    placedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  fake.db.order.push(order);
  for (const item of items) {
    fake.db.orderItem.push({ id: randomUUID(), orderId: order.id, productId: randomUUID(), pieceId: null, imageSnapshot: null, ...item });
  }
  return order;
};

describe('invoices — list, detail, report', () => {
  it('generates an invoice and lists/fetches it by id', async () => {
    const staffToken = await createStaffToken('9400000001');
    const order = seedPaidOrder({ channel: 'store' }, [{ nameSnapshot: 'Kanjivaram Saree', priceSnapshot: 2000, quantity: 2 }]);
    const invoice = await generateInvoiceForOrder(order.id, 'test-actor');

    const listRes = await request(app).get('/api/v1/admin/invoices').set('Authorization', `Bearer ${staffToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.map((i: any) => i.id)).toContain(invoice.id);
    expect(listRes.body.data.total).toBe(1);

    const detailRes = await request(app).get(`/api/v1/admin/invoices/${invoice.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.invoiceNumber).toBe('INV-000001');
    expect(Number(detailRes.body.data.totalAmount)).toBe(4000);
  });

  it('filters the invoice list by channel', async () => {
    const staffToken = await createStaffToken('9400000002');
    const storeOrder = seedPaidOrder({ channel: 'store' });
    const onlineOrder = seedPaidOrder({ channel: 'online' });
    await generateInvoiceForOrder(storeOrder.id, 'test-actor');
    await generateInvoiceForOrder(onlineOrder.id, 'test-actor');

    const res = await request(app).get('/api/v1/admin/invoices?channel=online').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].channel).toBe('online');
  });

  it('rejects invoice access without a staff/admin token', async () => {
    const res = await request(app).get('/api/v1/admin/invoices');
    expect(res.status).toBe(401);
  });

  it('generates a grouped sales-summary PDF over a date range spanning online and store', async () => {
    const staffToken = await createStaffToken('9400000003');
    const within = new Date();
    const outsideRange = new Date(within.getFullYear() - 2, 0, 1);

    seedPaidOrder({ channel: 'store', placedAt: within }, [{ nameSnapshot: 'Saree X', priceSnapshot: 2000, quantity: 1 }]);
    seedPaidOrder({ channel: 'online', status: 'processing', placedAt: within }, [{ nameSnapshot: 'Saree X', priceSnapshot: 2000, quantity: 1 }]);
    seedPaidOrder({ channel: 'store', placedAt: outsideRange }, [{ nameSnapshot: 'Old Saree', priceSnapshot: 500, quantity: 1 }]);

    const res = await request(app)
      .post('/api/v1/admin/invoices/report')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ from: new Date(within.getFullYear(), 0, 1).toISOString(), to: new Date(within.getFullYear(), 11, 31).toISOString() });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(Buffer.isBuffer(res.body) || res.body instanceof Uint8Array).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // The consolidated monthly invoice is the business's single complete
  // sales document. A WhatsApp-only month must still produce one — if the
  // channel were ever dropped from the report query this 200 becomes the
  // "no sales were recorded" 400.
  it('includes WhatsApp orders in the consolidated report', async () => {
    const staffToken = await createStaffToken('9400000005');
    const within = new Date();
    seedPaidOrder({ channel: 'whatsapp', status: 'processing', placedAt: within }, [
      { nameSnapshot: 'WhatsApp Saree', priceSnapshot: 3000, quantity: 1 },
    ]);

    const res = await request(app)
      .post('/api/v1/admin/invoices/report')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ from: new Date(within.getFullYear(), 0, 1).toISOString(), to: new Date(within.getFullYear(), 11, 31).toISOString() });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('leaves an unpaid WhatsApp order out of the report', async () => {
    const staffToken = await createStaffToken('9400000006');
    const within = new Date();
    seedPaidOrder({ channel: 'whatsapp', status: 'pending', placedAt: within }, [
      { nameSnapshot: 'Unpaid Saree', priceSnapshot: 3000, quantity: 1 },
    ]);

    const res = await request(app)
      .post('/api/v1/admin/invoices/report')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ from: new Date(within.getFullYear(), 0, 1).toISOString(), to: new Date(within.getFullYear(), 11, 31).toISOString() });

    expect(res.status).toBe(400);
  });

  it('filters the invoice list down to WhatsApp sales', async () => {
    const staffToken = await createStaffToken('9400000007');
    const whatsappOrder = seedPaidOrder({ channel: 'whatsapp', status: 'processing' });
    const storeOrder = seedPaidOrder({ channel: 'store' });
    await generateInvoiceForOrder(whatsappOrder.id, 'test-actor');
    await generateInvoiceForOrder(storeOrder.id, 'test-actor');

    const res = await request(app).get('/api/v1/admin/invoices?channel=whatsapp').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].channel).toBe('whatsapp');
  });

  it('returns 400 for a report range with no sales', async () => {
    const staffToken = await createStaffToken('9400000004');
    const res = await request(app)
      .post('/api/v1/admin/invoices/report')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ from: '2000-01-01T00:00:00.000Z', to: '2000-01-31T00:00:00.000Z' });
    expect(res.status).toBe(400);
  });
});

describe('customer-facing invoice lookup', () => {
  it('lets a customer fetch their own order invoice', async () => {
    const { token, authAccountId } = await registerAndLoginCustomer('9876500001');
    const order = seedPaidOrder({ channel: 'online', status: 'processing', authAccountId });
    await generateInvoiceForOrder(order.id, 'system');

    const res = await request(app).get(`/api/v1/orders/${order.id}/invoice`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe(order.id);
    expect(res.body.data.url).toMatch(/^https:\/\/cdn\.example\.com/);
  });

  it("404s a customer trying to fetch another customer's invoice", async () => {
    const owner = await registerAndLoginCustomer('9876500002');
    const order = seedPaidOrder({ channel: 'online', status: 'processing', authAccountId: owner.authAccountId });
    await generateInvoiceForOrder(order.id, 'system');

    const { token: otherToken } = await registerAndLoginCustomer('9876500003');
    const res = await request(app).get(`/api/v1/orders/${order.id}/invoice`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('404s when no invoice has been generated for the order yet', async () => {
    const { token, authAccountId } = await registerAndLoginCustomer('9876500004');
    const order = seedPaidOrder({ channel: 'online', status: 'pending_payment', authAccountId });

    const res = await request(app).get(`/api/v1/orders/${order.id}/invoice`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

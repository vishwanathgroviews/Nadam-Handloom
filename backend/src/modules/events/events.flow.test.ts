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
vi.mock('../../providers/payment', () => ({
  paymentProvider: {
    isConfigured: vi.fn(() => true),
    createOrder: vi.fn(async (input: any) => ({
      providerOrderId: `order_test_${Math.random().toString(36).slice(2)}`,
      amount: input.amount,
      currency: input.currency,
    })),
    verifyPaymentSignature: vi.fn(() => true),
  },
}));

const { sendPushNotificationsAsync } = vi.hoisted(() => ({ sendPushNotificationsAsync: vi.fn() }));
vi.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken(token: unknown) {
      return typeof token === 'string' && token.startsWith('ExponentPushToken[');
    }
    chunkPushNotifications(messages: any[]) {
      return [messages];
    }
    sendPushNotificationsAsync(messages: any[]) {
      return sendPushNotificationsAsync(messages);
    }
  }
  return { Expo };
});

import * as prismaModule from '../../config/prisma';
import { smsProvider } from '../../providers/sms';
import { storageProvider } from '../../providers/storage';
import { seedRoles, seedCatalogFixture } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import { dispatchPendingEvents } from './events.service';
import app from '../../app';

const fake = (prismaModule as any).__fake;
const sendMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;
let invoiceUploadCounter = 0;

const extractCode = (): string => {
  const call = sendMock.mock.calls[sendMock.mock.calls.length - 1];
  return call[1];
};

let roles: Record<string, { id: string }>;
let fixture: ReturnType<typeof seedCatalogFixture>;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
  fixture = seedCatalogFixture(fake.db);
  sendMock.mockClear();
  sendPushNotificationsAsync.mockReset();
  sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);

  invoiceUploadCounter = 0;
  (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (storageProvider.upload as ReturnType<typeof vi.fn>).mockImplementation(async () => {
    invoiceUploadCounter += 1;
    return { url: `https://cdn.example.com/invoices/invoice-${invoiceUploadCounter}.pdf`, key: `invoices/invoice-${invoiceUploadCounter}.pdf` };
  });
  // The order.paid handler now also generates an invoice PDF, which fetches
  // the company logo over HTTP — stub it out so the test stays hermetic.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode('fake-logo-bytes').buffer,
    }))
  );
});

const createStaffToken = async (mobile = '9200000001') => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: `staff-${mobile}@example.com`, phone: mobile, mpinHash, mpinSetAt: new Date(),
      status: 'active', phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: 'Staff', lastName: 'User' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles.STAFF!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile, mpin: '284759' });
  return login.body.data.tokens.accessToken as string;
};

const placeAndPayOrder = async () => {
  const phone = '9876522222';
  await request(app).post('/api/v1/auth/customer/register').send({
    firstName: 'Events', lastName: 'Buyer', phone, state: 'Telangana', pincode: '500001',
  });
  const code = extractCode();
  const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone, code });
  const setup = await request(app)
    .post('/api/v1/auth/customer/mpin/setup')
    .send({ setupToken: verify.body.data.setupToken, mpin: '284759', confirmMpin: '284759' });
  const token = setup.body.data.tokens.accessToken as string;

  const addressRes = await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${token}`)
    .send({ fullName: 'Events Buyer', phone, line1: 'Line 1', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });

  const product = fixture.products[0]!;
  const checkoutRes = await request(app).post('/api/v1/orders/checkout').set('Authorization', `Bearer ${token}`)
    .send({ items: [{ productId: product.id, quantity: 1 }], addressId: addressRes.body.data.id });

  const { orderId, razorpayOrderId } = checkoutRes.body.data;
  await request(app).post(`/api/v1/orders/${orderId}/verify-payment`).set('Authorization', `Bearer ${token}`)
    .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_test', razorpay_signature: 'sig_test' });

  return orderId;
};

describe('events outbox → push notification pipeline', () => {
  it('writes an order.paid event when payment is captured', async () => {
    const orderId = await placeAndPayOrder();
    const event = fake.db.eventsOutbox.find((e: any) => e.eventType === 'order.paid' && e.payload.orderId === orderId);
    expect(event).toBeTruthy();
    expect(event.dispatched).toBe(false);
  });

  it('dispatches the event as a push to every ADMIN/STAFF device and marks it dispatched', async () => {
    const staffToken = await createStaffToken();
    await request(app).post('/api/v1/admin/notifications/devices').set('Authorization', `Bearer ${staffToken}`)
      .send({ expoPushToken: 'ExponentPushToken[staff-device-1]', platform: 'ios' });

    await placeAndPayOrder();

    const dispatchedCount = await dispatchPendingEvents();
    expect(dispatchedCount).toBe(1);
    expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(1);

    const [messages] = sendPushNotificationsAsync.mock.calls[0]!;
    expect(messages[0].to).toBe('ExponentPushToken[staff-device-1]');
    expect(messages[0].title).toBe('New order received');

    const event = fake.db.eventsOutbox.find((e: any) => e.eventType === 'order.paid');
    expect(event.dispatched).toBe(true);
  });

  it('generates an invoice for the order as part of dispatching order.paid', async () => {
    const orderId = await placeAndPayOrder();
    await dispatchPendingEvents();

    const invoice = fake.db.invoice.find((inv: any) => inv.orderId === orderId);
    expect(invoice).toBeTruthy();
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{6}$/);
    expect(invoice.channel).toBe('online');
    expect(invoice.url).toBe('https://cdn.example.com/invoices/invoice-1.pdf');

    // A second sweep finds nothing new to dispatch (the event is already
    // marked dispatched) — confirms it doesn't re-run the handler and
    // create a duplicate invoice.
    await dispatchPendingEvents();
    expect(fake.db.invoice.filter((inv: any) => inv.orderId === orderId)).toHaveLength(1);
  });

  it('leaves the event undispatched if sending fails, so the next sweep retries it', async () => {
    sendPushNotificationsAsync.mockRejectedValueOnce(new Error('network down'));
    const staffToken = await createStaffToken();
    await request(app).post('/api/v1/admin/notifications/devices').set('Authorization', `Bearer ${staffToken}`)
      .send({ expoPushToken: 'ExponentPushToken[staff-device-2]', platform: 'android' });

    await placeAndPayOrder();
    const dispatchedCount = await dispatchPendingEvents();
    expect(dispatchedCount).toBe(0);

    const event = fake.db.eventsOutbox.find((e: any) => e.eventType === 'order.paid');
    expect(event.dispatched).toBe(false);
  });

  it('does not fail dispatch when nobody has a registered device', async () => {
    await placeAndPayOrder();
    const dispatchedCount = await dispatchPendingEvents();
    expect(dispatchedCount).toBe(1);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('prunes a device token that comes back DeviceNotRegistered', async () => {
    sendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
    ]);
    const staffToken = await createStaffToken();
    await request(app).post('/api/v1/admin/notifications/devices').set('Authorization', `Bearer ${staffToken}`)
      .send({ expoPushToken: 'ExponentPushToken[dead-device]', platform: 'ios' });

    await placeAndPayOrder();
    await dispatchPendingEvents();

    expect(fake.db.deviceToken.find((d: any) => d.expoPushToken === 'ExponentPushToken[dead-device]')).toBeUndefined();
  });
});

describe('device registration', () => {
  it('rejects a malformed push token', async () => {
    const staffToken = await createStaffToken('9200000002');
    const res = await request(app).post('/api/v1/admin/notifications/devices').set('Authorization', `Bearer ${staffToken}`)
      .send({ expoPushToken: 'not-a-real-token', platform: 'ios' });
    expect(res.status).toBe(400);
  });

  it('unregisters a device token', async () => {
    const staffToken = await createStaffToken('9200000003');
    await request(app).post('/api/v1/admin/notifications/devices').set('Authorization', `Bearer ${staffToken}`)
      .send({ expoPushToken: 'ExponentPushToken[to-remove]', platform: 'android' });

    const res = await request(app).delete('/api/v1/admin/notifications/devices').set('Authorization', `Bearer ${staffToken}`)
      .send({ expoPushToken: 'ExponentPushToken[to-remove]' });
    expect(res.status).toBe(200);
    expect(fake.db.deviceToken.find((d: any) => d.expoPushToken === 'ExponentPushToken[to-remove]')).toBeUndefined();
  });
});

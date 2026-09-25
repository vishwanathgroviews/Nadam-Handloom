import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

vi.mock('../../providers/sms', () => ({ smsProvider: { sendOtp: vi.fn() } }));

// Counter sales now generate their invoice PDF inline (see scanSell), which
// needs somewhere to put it.
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

import * as prismaModule from '../../config/prisma';
import { smsProvider } from '../../providers/sms';
import { storageProvider } from '../../providers/storage';
import { paymentProvider } from '../../providers/payment';
import { seedRoles } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import { normalizeBarcode } from '../../utils/barcode';
import { sweepExpiredReservations } from './inventory.service';
import app from '../../app';

const fake = (prismaModule as any).__fake;
const sendMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;

const extractCode = (): string => {
  const call = sendMock.mock.calls[sendMock.mock.calls.length - 1];
  return call[1];
};

let roles: Record<string, { id: string }>;

let uploadCounter = 0;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
  sendMock.mockClear();
  (paymentProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (paymentProvider.verifyPaymentSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
  uploadCounter = 0;
  (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (storageProvider.upload as ReturnType<typeof vi.fn>).mockImplementation(async () => {
    uploadCounter += 1;
    return { url: `https://cdn.example.com/invoices/invoice-${uploadCounter}.pdf`, key: `invoices/invoice-${uploadCounter}.pdf` };
  });
  // The invoice PDF embeds the company logo, fetched over the network.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode('fake-logo-bytes').buffer,
    }))
  );
});

const seedCategory = (overrides: Partial<Record<string, any>> = {}) => {
  const category = {
    id: randomUUID(), name: 'Test Category', slug: `test-category-${randomUUID().slice(0, 8)}`,
    description: 'Test', imageUrl: null, sortOrder: 0, isActive: true,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  fake.db.category.push(category);
  return category;
};

const seedSubcategory = (categoryId: string, overrides: Partial<Record<string, any>> = {}) => {
  const subcategory = {
    id: randomUUID(), categoryId, name: `Test Subcategory ${randomUUID().slice(0, 6)}`,
    description: 'Test', sortOrder: 0, isActive: true,
    onlinePrice: 4999, storePrice: 4499, mrp: 5999,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  fake.db.subcategory.push(subcategory);
  return subcategory;
};

const seedProduct = (categoryId: string, overrides: Partial<Record<string, any>> = {}) => {
  const subcategoryId = overrides.subcategoryId ?? seedSubcategory(categoryId).id;
  const product = {
    id: randomUUID(), slug: `test-product-${randomUUID().slice(0, 8)}`, sku: `NH-TEST-${randomUUID().slice(0, 6).toUpperCase()}`,
    name: 'Test Product', categoryId, subcategoryId, technique: null, borderStyle: null, purity: null, zariTier: null,
    blouseType: null, pattern: null, color: null, fabric: null, occasion: [],
    channelVisibility: 'both', trackingMode: 'quantity', stock: 1, isFeatured: false, isActive: true,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  fake.db.product.push(product);
  return product;
};

const seedPiece = (productId: string, overrides: Partial<Record<string, any>> = {}) => {
  const piece = {
    id: randomUUID(), productId, barcode: `PIECE-${randomUUID().slice(0, 8)}`,
    status: 'in_stock', soldAt: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  // Rows only ever reach the real database through receivePieces, which
  // stores the canonical uppercase form — seeding straight into the fake db
  // has to match, or these fixtures would be unscannable in a way no real
  // piece is.
  piece.barcode = normalizeBarcode(piece.barcode);
  fake.db.piece.push(piece);
  return piece;
};

// One serialized product with N barcoded pieces on the shelf — the shape a
// multi-item counter bill is actually rung up from.
const seedSerializedProduct = async (pieceCount: number) => {
  const category = seedCategory();
  const subcategory = seedSubcategory(category.id);
  const product = seedProduct(category.id, {
    subcategoryId: subcategory.id, trackingMode: 'serialized', stock: 0,
  });
  const pieces = Array.from({ length: pieceCount }, () => seedPiece(product.id));
  return { category, subcategory, product, pieces, storePrice: Number(subcategory.storePrice) };
};

const registerLoginCustomer = async (phone: string) => {
  await request(app).post('/api/v1/auth/customer/register').send({
    firstName: 'Test', lastName: 'Customer', phone, state: 'Telangana', pincode: '500001',
  });
  const code = extractCode();
  const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone, code });
  const setup = await request(app)
    .post('/api/v1/auth/customer/mpin/setup')
    .send({ setupToken: verify.body.data.setupToken, mpin: '284759', confirmMpin: '284759' });
  const token = setup.body.data.tokens.accessToken as string;

  const addressRes = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send({ fullName: 'Test Customer', phone, line1: 'Line 1', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });

  return { token, addressId: addressRes.body.data.id as string };
};

const createStaffToken = async (mobile: string, role: 'ADMIN' | 'STAFF' = 'STAFF') => {
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

describe('checkout concurrency — the double-sell fix', () => {
  it('lets only one of two simultaneous checkouts win the last unit (quantity mode)', async () => {
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 1 });

    // Customer setup shares a mocked email "inbox" keyed by "most recent send",
    // so it must happen sequentially — only the checkout race itself is concurrent.
    const buyerA = await registerLoginCustomer('9000000101');
    const buyerB = await registerLoginCustomer('9000000102');

    const [resA, resB] = await Promise.all([
      request(app).post('/api/v1/orders/checkout').set('Authorization', `Bearer ${buyerA.token}`)
        .send({ items: [{ productId: product.id, quantity: 1 }], addressId: buyerA.addressId }),
      request(app).post('/api/v1/orders/checkout').set('Authorization', `Bearer ${buyerB.token}`)
        .send({ items: [{ productId: product.id, quantity: 1 }], addressId: buyerB.addressId }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = resA.status === 409 ? resA : resB;
    expect(failed.body.code).toBe('OUT_OF_STOCK');

    // Never double-sold, never negative — exactly one active reservation holding the one unit.
    const finalProduct = fake.db.product.find((p: any) => p.id === product.id);
    expect(finalProduct.stock).toBe(0);
    const activeReservations = fake.db.reservation.filter((r: any) => r.productId === product.id && r.status === 'active');
    expect(activeReservations).toHaveLength(1);
    expect(activeReservations[0].quantity).toBe(1);
  });

  it('lets only one of two simultaneous checkouts win the last serialized piece', async () => {
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'serialized', stock: 0 });
    const piece = seedPiece(product.id);

    const buyerA = await registerLoginCustomer('9000000103');
    const buyerB = await registerLoginCustomer('9000000104');

    const [resA, resB] = await Promise.all([
      request(app).post('/api/v1/orders/checkout').set('Authorization', `Bearer ${buyerA.token}`)
        .send({ items: [{ productId: product.id, quantity: 1 }], addressId: buyerA.addressId }),
      request(app).post('/api/v1/orders/checkout').set('Authorization', `Bearer ${buyerB.token}`)
        .send({ items: [{ productId: product.id, quantity: 1 }], addressId: buyerB.addressId }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const finalPiece = fake.db.piece.find((p: any) => p.id === piece.id);
    expect(finalPiece.status).toBe('reserved');
    const activeReservations = fake.db.reservation.filter((r: any) => r.pieceId === piece.id && r.status === 'active');
    expect(activeReservations).toHaveLength(1);
  });

  it('releases the hold immediately on payment failure, not just after the TTL', async () => {
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 1 });
    const buyer = await registerLoginCustomer('9000000105');

    const checkoutRes = await request(app).post('/api/v1/orders/checkout').set('Authorization', `Bearer ${buyer.token}`)
      .send({ items: [{ productId: product.id, quantity: 1 }], addressId: buyer.addressId });
    expect(checkoutRes.status).toBe(201);
    expect(fake.db.product.find((p: any) => p.id === product.id).stock).toBe(0);

    (paymentProvider.verifyPaymentSignature as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    const { orderId, razorpayOrderId } = checkoutRes.body.data;
    const verifyRes = await request(app).post(`/api/v1/orders/${orderId}/verify-payment`).set('Authorization', `Bearer ${buyer.token}`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_bad', razorpay_signature: 'sig_bad' });
    expect(verifyRes.status).toBe(400);

    expect(fake.db.product.find((p: any) => p.id === product.id).stock).toBe(1);
    const reservation = fake.db.reservation.find((r: any) => r.productId === product.id);
    expect(reservation.status).toBe('released');
  });

  it('the expiry sweep frees a reservation past its TTL', async () => {
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 5 });
    const order = await fake.client.order.create({
      data: { orderNumber: 'NH-EXPIRE-TEST', channel: 'online', subtotal: 100, total: 100, shippingAddress: {} },
    });
    await fake.client.product.update({ where: { id: product.id }, data: { stock: { decrement: 2 } } });
    await fake.client.reservation.create({
      data: { productId: product.id, quantity: 2, orderId: order.id, expiresAt: new Date(Date.now() - 1000), status: 'active' },
    });

    const swept = await sweepExpiredReservations();
    expect(swept).toBe(1);

    expect(fake.db.product.find((p: any) => p.id === product.id).stock).toBe(5);
    expect(fake.db.reservation.find((r: any) => r.orderId === order.id).status).toBe('expired');
  });
});

describe('scan-to-lookup / scan-to-sell', () => {
  it('looks up a serialized piece and a quantity-mode SKU', async () => {
    const staffToken = await createStaffToken('9000000110', 'STAFF');
    const category = seedCategory();
    const serializedProduct = seedProduct(category.id, { trackingMode: 'serialized' });
    const piece = seedPiece(serializedProduct.id);
    const quantityProduct = seedProduct(category.id, { trackingMode: 'quantity', stock: 4 });

    const pieceRes = await request(app).post('/api/v1/admin/inventory/scan-lookup').set('Authorization', `Bearer ${staffToken}`)
      .send({ code: piece.barcode });
    expect(pieceRes.status).toBe(200);
    expect(pieceRes.body.data.mode).toBe('serialized');
    expect(pieceRes.body.data.status).toBe('in_stock');

    const skuRes = await request(app).post('/api/v1/admin/inventory/scan-lookup').set('Authorization', `Bearer ${staffToken}`)
      .send({ code: quantityProduct.sku });
    expect(skuRes.status).toBe(200);
    expect(skuRes.body.data.mode).toBe('quantity');
    expect(skuRes.body.data.availableQty).toBe(4);
  });

  // The reported bug: the first scan of a tag worked and the second came back
  // "No product found". The camera reports whichever GTIN symbology it
  // decoded that frame, so the same label can arrive as UPC-A once and EAN-13
  // the next time — two different strings for one piece.
  it('resolves the same tag however its symbology decoded — repeat scans never miss', async () => {
    const staffToken = await createStaffToken('9000000111', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'serialized' });
    // Stored as the 13-digit EAN-13 form, as the intake scan happened to read it.
    const piece = seedPiece(product.id, { barcode: '0036000291452' });

    const asStored = await request(app).post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`).send({ code: '0036000291452' });
    expect(asStored.status).toBe(200);
    expect(asStored.body.data.pieceId).toBe(piece.id);

    // Second scan of the very same label, decoded as UPC-A this time.
    const asUpcA = await request(app).post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`).send({ code: '036000291452' });
    expect(asUpcA.status).toBe(200);
    expect(asUpcA.body.data.pieceId).toBe(piece.id);
  });

  it('sells a piece scanned in a different symbology than it was received in', async () => {
    const staffToken = await createStaffToken('9000000112', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const product = seedProduct(category.id, { subcategoryId: subcategory.id, trackingMode: 'serialized', stock: 0 });
    const piece = seedPiece(product.id, { barcode: '0036000291452' });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ code: '036000291452' }], channel: 'store', invoiceRequired: true });

    expect(res.status).toBe(200);
    const sold = fake.db.piece.find((row: any) => row.id === piece.id);
    expect(sold.status).toBe('sold_offline');
  });

  it('still refuses a code that belongs to nothing', async () => {
    const staffToken = await createStaffToken('9000000113', 'STAFF');
    const res = await request(app).post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`).send({ code: 'NOT-A-REAL-TAG' });
    expect(res.status).toBe(404);
  });

  it('records a WhatsApp sale as a shippable order with the buyer on it, not a finished counter sale', async () => {
    const staffToken = await createStaffToken('9000000150', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 3 });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: product.sku,
        channel: 'whatsapp', invoiceRequired: true,
        // Two fields only — the whole address as one block, the way staff
        // receive it in the chat.
        customer: {
          phone: '9876500011',
          address: 'Lakshmi Rao, 12 Temple Street, Vijayawada, Andhra Pradesh - 520001',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.channel).toBe('whatsapp');

    const order = fake.db.order.find((o: any) => o.id === res.body.data.orderId);
    expect(order.channel).toBe('whatsapp');
    // Still has to be packed and couriered, so it joins the To Ship queue
    // rather than being closed out like a counter sale.
    expect(order.status).toBe('processing');
    expect(order.shippingAddress.phone).toBe('9876500011');
    // The free-text address is stored in line1, the same field every other
    // order's street line uses, so the To Ship screen needs no special case.
    expect(order.shippingAddress.line1).toBe('Lakshmi Rao, 12 Temple Street, Vijayawada, Andhra Pradesh - 520001');

    // A Shipment row is what makes the AWB screen work for this order.
    expect(fake.db.shipment.filter((s: any) => s.orderId === order.id)).toHaveLength(1);
    // And it is invoiced like every other sale.
    expect(fake.db.invoice.filter((i: any) => i.orderId === order.id)).toHaveLength(1);
    expect(res.body.data.invoice.channel).toBe('whatsapp');
  });

  // Where the sale happened is a required answer, not a default. A sale that
  // doesn't say must not go through as a counter sale by assumption — a
  // WhatsApp order closed out that way never reaches To Ship.
  it('refuses a sale that does not say where it happened, and moves no stock', async () => {
    const staffToken = await createStaffToken('9000000153', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ code: product.sku }] });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/where this sale is happening/i);
    expect(fake.db.order).toHaveLength(0);
    expect(fake.db.product.find((p: any) => p.id === product.id).stock).toBe(2);
  });

  it('refuses a location that is not one of the two options', async () => {
    const staffToken = await createStaffToken('9000000154', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ code: product.sku }], channel: 'online' });

    expect(res.status).toBe(400);
    expect(fake.db.order).toHaveLength(0);
  });

  it('refuses a WhatsApp sale that has no customer details attached', async () => {
    const staffToken = await createStaffToken('9000000151', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ code: product.sku, channel: 'whatsapp', invoiceRequired: true });

    expect(res.status).toBe(400);
    expect(fake.db.order).toHaveLength(0);
    // Stock must not move when the sale is rejected.
    expect(fake.db.product.find((p: any) => p.id === product.id).stock).toBe(2);
  });

  it('a WhatsApp order can be marked shipped with an AWB, and hands back the invoice + buyer number to message', async () => {
    const staffToken = await createStaffToken('9000000152', 'ADMIN');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });

    const sale = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: product.sku,
        channel: 'whatsapp', invoiceRequired: true,
        customer: {
          phone: '9876500022',
          address: 'Meera Devi, 5 Market Road, Guntur, Andhra Pradesh - 522001',
        },
      });
    const orderId = sale.body.data.orderId;

    const shipped = await request(app).patch(`/api/v1/admin/orders/${orderId}/shipment`)
      .set('Authorization', `Bearer ${staffToken}`).send({ awbNumber: 'DTDC12345678' });

    expect(shipped.status).toBe(200);
    expect(shipped.body.data.awbNumber).toBe('DTDC12345678');
    expect(shipped.body.data.channel).toBe('whatsapp');
    expect(shipped.body.data.customerPhone).toBe('9876500022');
    expect(shipped.body.data.invoiceUrl).toBeTruthy();
    expect(shipped.body.data.trackingUrl).toBeTruthy();
    expect(fake.db.order.find((o: any) => o.id === orderId).status).toBe('shipped');
  });

  it('sells a quantity-mode item in store and decrements stock', async () => {
    const staffToken = await createStaffToken('9000000111', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 3 });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: product.sku });
    expect(res.status).toBe(200);
    expect(res.body.data.overridden).toBe(false);

    const order = fake.db.order.find((o: any) => o.id === res.body.data.orderId);
    expect(order.channel).toBe('store');
    expect(order.status).toBe('delivered');
    expect(fake.db.product.find((p: any) => p.id === product.id).stock).toBe(2);
  });

  // A single scanned sale is no less a sale than an online one —
  // staff need something to hand the customer either way.
  it('generates an invoice automatically for a counter sale', async () => {
    const staffToken = await createStaffToken('9000000112', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id, { storePrice: 3000 });
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2, subcategoryId: subcategory.id });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', `Bearer ${staffToken}`).send({ channel: 'store', invoiceRequired: true, code: product.sku });

    expect(res.status).toBe(200);
    expect(res.body.data.invoice).toBeTruthy();
    expect(res.body.data.invoice.channel).toBe('store');
    expect(Number(res.body.data.invoice.totalAmount)).toBe(3000);
    expect(res.body.data.invoice.url).toContain('https://');

    // Persisted against the order, exactly one of them.
    const invoices = fake.db.invoice.filter((inv: any) => inv.orderId === res.body.data.orderId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].invoiceNumber).toBe(res.body.data.invoice.invoiceNumber);
  });

  it('invoices a serialized piece sale too, at the price actually charged', async () => {
    const staffToken = await createStaffToken('9000000113', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id, { storePrice: 4000 });
    const product = seedProduct(category.id, { trackingMode: 'serialized', stock: 0, subcategoryId: subcategory.id });
    const piece = seedPiece(product.id);

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', `Bearer ${staffToken}`).send({ channel: 'store', invoiceRequired: true, code: piece.barcode, salePrice: 3500 });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.invoice.totalAmount)).toBe(3500);
    expect(fake.db.piece.find((p: any) => p.id === piece.id).status).toBe('sold_offline');
  });

  // The sale is committed before the PDF is built. Surfacing a storage
  // failure as a failed request would invite staff to scan the item twice.
  it('still completes the sale when the invoice cannot be generated', async () => {
    const staffToken = await createStaffToken('9000000114', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });
    (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', `Bearer ${staffToken}`).send({ channel: 'store', invoiceRequired: true, code: product.sku });

    expect(res.status).toBe(200);
    expect(res.body.data.invoice).toBeNull();
    expect(res.body.data.orderNumber).toBeTruthy();
    // Stock still moved, and the order is still on the books.
    expect(fake.db.product.find((p: any) => p.id === product.id).stock).toBe(1);
    expect(fake.db.order.find((o: any) => o.id === res.body.data.orderId)).toBeTruthy();
  });

  it('sells a serialized piece scanned back in a different case than it was received', async () => {
    const staffToken = await createStaffToken('9000000111', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const barcode = `SELL-${randomUUID().slice(0, 8)}`.toUpperCase();

    const createRes = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });
    const productId = createRes.body.data.id;
    await request(app).post(`/api/v1/admin/inventory/products/${productId}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [barcode] });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', `Bearer ${staffToken}`).send({ channel: 'store', invoiceRequired: true, code: barcode.toLowerCase() });

    expect(res.status).toBe(200);
    expect(fake.db.piece.find((p: any) => p.barcode === barcode).status).toBe('sold_offline');
  });

  it('lets STAFF set a custom sale price that differs from the store price, and audit-logs the override', async () => {
    const staffToken = await createStaffToken('9000000120', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id, { storePrice: 2000 });
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 3, subcategoryId: subcategory.id });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: product.sku, salePrice: 1750 });
    expect(res.status).toBe(200);

    const order = fake.db.order.find((o: any) => o.id === res.body.data.orderId);
    expect(Number(order.total)).toBe(1750);
    const orderItem = fake.db.orderItem.find((oi: any) => oi.orderId === order.id);
    expect(Number(orderItem.priceSnapshot)).toBe(1750);

    const overrideEvent = fake.db.authEvent.find((e: any) => e.eventType === 'offline_sale_price_override');
    expect(overrideEvent).toBeTruthy();
    expect(overrideEvent.source).toBe('staff_app');
    expect(overrideEvent.metadata.salePrice).toBe(1750);
    expect(overrideEvent.metadata.categoryStorePrice).toBe(2000);
  });

  // The owner's hard requirement: a price typed on one sale applies to that
  // sale and nothing else. It must never edit the subcategory's own prices,
  // and the next scan of a sibling product has to come back at the
  // configured counter price again.
  it('a price typed on one sale changes only that sale', async () => {
    const staffToken = await createStaffToken('9000000122', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id, { storePrice: 2000, onlinePrice: 2600 });
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 3, subcategoryId: subcategory.id });
    const sibling = seedProduct(category.id, { trackingMode: 'quantity', stock: 3, subcategoryId: subcategory.id });

    await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: product.sku, salePrice: 1750 });

    // The subcategory's configured prices are untouched.
    const after = fake.db.subcategory.find((sc: any) => sc.id === subcategory.id);
    expect(Number(after.storePrice)).toBe(2000);
    expect(Number(after.onlinePrice)).toBe(2600);

    // A different product in the same subcategory still sells at the
    // configured counter price.
    const second = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: sibling.sku });
    const secondOrder = fake.db.order.find((o: any) => o.id === second.body.data.orderId);
    expect(Number(secondOrder.total)).toBe(2000);

    // And so does the very same product on its next sale.
    const third = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: product.sku });
    const thirdOrder = fake.db.order.find((o: any) => o.id === third.body.data.orderId);
    expect(Number(thirdOrder.total)).toBe(2000);
  });

  // The counter never charges the website's price.
  it('sells at the counter price, not the online one', async () => {
    const staffToken = await createStaffToken('9000000123', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id, { storePrice: 2000, onlinePrice: 2600 });
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2, subcategoryId: subcategory.id });

    const lookup = await request(app).post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`).send({ code: product.sku });
    expect(Number(lookup.body.data.storePrice)).toBe(2000);
    // The scan response must not even carry the website price into the app.
    expect(lookup.body.data.onlinePrice).toBeUndefined();

    const sale = await request(app).post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', `Bearer ${staffToken}`).send({ channel: 'store', invoiceRequired: true, code: product.sku });
    const order = fake.db.order.find((o: any) => o.id === sale.body.data.orderId);
    expect(Number(order.total)).toBe(2000);
  });

  it('omitting salePrice behaves exactly as before — no audit event, store price used', async () => {
    const staffToken = await createStaffToken('9000000121', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id, { storePrice: 2000 });
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 3, subcategoryId: subcategory.id });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: product.sku });
    expect(res.status).toBe(200);

    const order = fake.db.order.find((o: any) => o.id === res.body.data.orderId);
    expect(Number(order.total)).toBe(2000);
    expect(fake.db.authEvent.find((e: any) => e.eventType === 'offline_sale_price_override')).toBeUndefined();
  });

  it('blocks scan-to-sell on a piece reserved online, and lets an owner override it', async () => {
    const staffToken = await createStaffToken('9000000112', 'STAFF');
    const adminToken = await createStaffToken('9000000113', 'ADMIN');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'serialized' });
    const piece = seedPiece(product.id, { status: 'reserved' });
    const order = await fake.client.order.create({
      data: { orderNumber: 'NH-RESERVED-TEST', channel: 'online', subtotal: 100, total: 100, shippingAddress: {} },
    });
    await fake.client.reservation.create({
      data: { productId: product.id, pieceId: piece.id, quantity: 1, orderId: order.id, expiresAt: new Date(Date.now() + 60000), status: 'active' },
    });

    const blockedRes = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: piece.barcode });
    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.code).toBe('RESERVED_ONLINE');

    // STAFF cannot self-authorize an override — ADMIN (owner) only.
    const staffOverrideRes = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: piece.barcode, override: true });
    expect(staffOverrideRes.status).toBe(403);

    const overrideRes = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${adminToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: piece.barcode, override: true });
    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.data.overridden).toBe(true);

    expect(fake.db.piece.find((p: any) => p.id === piece.id).status).toBe('sold_offline');
    expect(fake.db.reservation.find((r: any) => r.pieceId === piece.id).status).toBe('released');
  });

  // "Add More" on the Scan to Sell screen: several scanned products, one
  // order number, one invoice — the customer is handed a single bill.
  it('sells several scanned products as one order with one invoice', async () => {
    const staffToken = await createStaffToken('9400001101');
    const { pieces } = await seedSerializedProduct(3);

    const res = await request(app)
      .post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ channel: 'store', invoiceRequired: true, items: [{ code: pieces[0].barcode }, { code: pieces[1].barcode }, { code: pieces[2].barcode }] });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);

    const orders = fake.db.order.filter((o: any) => o.channel === 'store');
    expect(orders).toHaveLength(1);
    const orderItems = fake.db.orderItem.filter((i: any) => i.orderId === orders[0].id);
    expect(orderItems).toHaveLength(3);

    const invoices = fake.db.invoice.filter((i: any) => i.orderId === orders[0].id);
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0].totalAmount)).toBe(res.body.data.total);

    for (const piece of pieces) {
      expect(fake.db.piece.find((x: any) => x.id === piece.id).status).toBe('sold_offline');
    }
  });

  // "n products on one bill" is the whole point of Add More: there is no
  // small ceiling, and every line lands on the same invoice at the price it
  // was actually sold for.
  it('bills sixty scanned products as one order and one invoice, bargained prices included', async () => {
    const staffToken = await createStaffToken('9400001111');
    const { pieces, storePrice } = await seedSerializedProduct(60);

    // Every third saree was haggled down; the rest go at the store price.
    const items = pieces.map((piece, i) =>
      i % 3 === 0 ? { code: piece.barcode, salePrice: 1000 } : { code: piece.barcode }
    );
    const expectedTotal = items.reduce((sum, item) => sum + (item.salePrice ?? storePrice), 0);

    const res = await request(app)
      .post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ channel: 'store', invoiceRequired: true, items });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(60);
    expect(res.body.data.total).toBe(expectedTotal);

    const orders = fake.db.order.filter((o: any) => o.channel === 'store');
    expect(orders).toHaveLength(1);
    expect(fake.db.orderItem.filter((i: any) => i.orderId === orders[0].id)).toHaveLength(60);

    const invoices = fake.db.invoice.filter((i: any) => i.orderId === orders[0].id);
    expect(invoices).toHaveLength(1);
    // The bargained prices are what the invoice totals, not the catalogue.
    expect(Number(invoices[0].totalAmount)).toBe(expectedTotal);
    expect(expectedTotal).toBeLessThan(storePrice * 60);
  });

  // A bill can mix a barcoded saree with several of a product counted by
  // quantity — the app sends one line per code, with how many of it.
  it('sells a mixed bill of pieces and quantities as one order with one invoice', async () => {
    const staffToken = await createStaffToken('9400001110');
    const { pieces, subcategory } = await seedSerializedProduct(1);
    const counted = seedProduct(subcategory.categoryId, {
      subcategoryId: subcategory.id, trackingMode: 'quantity', stock: 5,
    });

    const res = await request(app)
      .post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({
        channel: 'store', invoiceRequired: true,
        items: [{ code: pieces[0].barcode }, { code: counted.sku, quantity: 3, salePrice: 1500 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[1].quantity).toBe(3);

    const orders = fake.db.order.filter((o: any) => o.channel === 'store');
    expect(orders).toHaveLength(1);
    expect(fake.db.invoice.filter((i: any) => i.orderId === orders[0].id)).toHaveLength(1);
    // Three of the counted product left the shelf, and the bargained price
    // applied to all three.
    expect(fake.db.product.find((p: any) => p.id === counted.id).stock).toBe(2);
    expect(res.body.data.total).toBe(Number(subcategory.storePrice) + 1500 * 3);
  });

  // Bargaining is per line: one saree discounted, the next at full price,
  // on the same bill.
  it('applies a bargained price to only the line it was set on', async () => {
    const staffToken = await createStaffToken('9400001102');
    const { pieces, storePrice } = await seedSerializedProduct(2);

    const res = await request(app)
      .post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ channel: 'store', invoiceRequired: true, items: [{ code: pieces[0].barcode, salePrice: 1111 }, { code: pieces[1].barcode }] });

    expect(res.status).toBe(200);
    const [bargained, fullPrice] = res.body.data.items;
    expect(bargained.unitPrice).toBe(1111);
    expect(bargained.priceAdjusted).toBe(true);
    expect(fullPrice.unitPrice).toBe(storePrice);
    expect(fullPrice.priceAdjusted).toBe(false);
    expect(res.body.data.total).toBe(1111 + storePrice);

    // Exactly one discount is audited, not both lines.
    const overrides = fake.db.authEvent.filter((e: any) => e.eventType === 'offline_sale_price_override');
    expect(overrides).toHaveLength(1);
    expect(overrides[0].metadata.salePrice).toBe(1111);
  });

  // The bargain is for this bill only — the catalogue price must not move,
  // or every future customer inherits one shopper's haggling.
  it('never writes a bargained price back to the subcategory', async () => {
    const staffToken = await createStaffToken('9400001103');
    const { pieces, subcategory, storePrice } = await seedSerializedProduct(1);

    await request(app)
      .post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ channel: 'store', invoiceRequired: true, items: [{ code: pieces[0].barcode, salePrice: 555 }] });

    const after = fake.db.subcategory.find((x: any) => x.id === subcategory.id);
    expect(Number(after.storePrice)).toBe(storePrice);
    expect(Number(after.onlinePrice)).toBe(Number(subcategory.onlinePrice));
  });

  // All-or-nothing: a bad line must not leave earlier lines sold.
  it('rolls the whole bill back when one line cannot be claimed', async () => {
    const staffToken = await createStaffToken('9400001104');
    const { pieces } = await seedSerializedProduct(2);
    // Second piece is already gone.
    const sold = fake.db.piece.find((x: any) => x.id === pieces[1].id);
    sold.status = 'sold_offline';

    const res = await request(app)
      .post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ channel: 'store', invoiceRequired: true, items: [{ code: pieces[0].barcode }, { code: pieces[1].barcode }] });

    expect(res.status).toBe(409);
    // The first piece is still on the shelf, and no order exists.
    expect(fake.db.piece.find((x: any) => x.id === pieces[0].id).status).toBe('in_stock');
    expect(fake.db.order.filter((o: any) => o.channel === 'store')).toHaveLength(0);
  });

  it('rejects the same code twice on one bill', async () => {
    const staffToken = await createStaffToken('9400001105');
    const { pieces } = await seedSerializedProduct(1);

    const res = await request(app)
      .post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ channel: 'store', invoiceRequired: true, items: [{ code: pieces[0].barcode }, { code: pieces[0].barcode }] });

    expect(res.status).toBe(400);
    expect(fake.db.order.filter((o: any) => o.channel === 'store')).toHaveLength(0);
  });

  it('bills a multi-item WhatsApp sale as one shippable order', async () => {
    const staffToken = await createStaffToken('9400001106');
    const { pieces } = await seedSerializedProduct(2);

    const res = await request(app)
      .post('/api/v1/admin/inventory/scan-sell')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({
        items: [{ code: pieces[0].barcode, salePrice: 900 }, { code: pieces[1].barcode }],
        channel: 'whatsapp', invoiceRequired: true,
        customer: {
          phone: '9876500011',
          address: 'Lakshmi, 2-3 Market Road, Vijayawada, Andhra Pradesh - 520001',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.channel).toBe('whatsapp');
    expect(res.body.data.items).toHaveLength(2);

    const order = fake.db.order.find((o: any) => o.channel === 'whatsapp');
    expect(order.status).toBe('processing');
    expect(fake.db.orderItem.filter((i: any) => i.orderId === order.id)).toHaveLength(2);
    // One shipment, one invoice — not one per scanned product.
    expect(fake.db.shipment.filter((sh: any) => sh.orderId === order.id)).toHaveLength(1);
    expect(fake.db.invoice.filter((i: any) => i.orderId === order.id)).toHaveLength(1);
  });

  it('refuses to sell a piece that was already sold', async () => {
    const staffToken = await createStaffToken('9000000114', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'serialized' });
    const piece = seedPiece(product.id, { status: 'sold_offline' });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, code: piece.barcode });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_SOLD');
  });
});

// Mirrors the real "Create Product" flow end-to-end: a scanned barcode must
// stay unassigned — and reusable by anyone — until the product it belongs to
// has actually been created (receivePieces called right after createProduct
// succeeds, never before). Uses the real POST /admin/products endpoint,
// not the seedProduct fixture, so this exercises the exact sequence a staff
// device drives.
describe('barcode lifecycle — not assigned until the product is actually created', () => {
  it('a freshly scanned barcode is unassigned, and only becomes assigned once receivePieces runs after createProduct succeeds', async () => {
    const staffToken = await createStaffToken('9000000140', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const barcode = `NEW-${randomUUID().slice(0, 8)}`.toUpperCase();

    // Scanning it before any product exists: genuinely free, nothing created.
    const beforeLookup = await request(app).post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`).send({ code: barcode });
    expect(beforeLookup.status).toBe(404);
    expect(fake.db.piece.filter((p: any) => p.barcode === barcode)).toHaveLength(0);

    // Creating the product itself does not touch the barcode at all — no
    // barcode is even part of this payload, matching createProductSchema.
    const createRes = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });
    expect(createRes.status).toBe(201);
    const productId = createRes.body.data.id;
    expect(fake.db.piece.filter((p: any) => p.barcode === barcode)).toHaveLength(0);

    // The same barcode is still free right up until receivePieces — mirrors
    // ProductFormScreen calling this only after createProduct's response
    // comes back successfully.
    const midLookup = await request(app).post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`).send({ code: barcode });
    expect(midLookup.status).toBe(404);

    const receiveRes = await request(app).post(`/api/v1/admin/inventory/products/${productId}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [barcode] });
    expect(receiveRes.status).toBe(201);

    // Only now does it exist and belong to this product.
    const afterLookup = await request(app).post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`).send({ code: barcode });
    expect(afterLookup.status).toBe(200);
    expect(afterLookup.body.data.productId).toBe(productId);
    expect(fake.db.piece.filter((p: any) => p.barcode === barcode)).toHaveLength(1);
  });

  it('the same barcode cannot later be received onto a second product once assigned', async () => {
    const staffToken = await createStaffToken('9000000141', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const barcode = `DUAL-${randomUUID().slice(0, 8)}`.toUpperCase();

    const firstProduct = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });
    await request(app).post(`/api/v1/admin/inventory/products/${firstProduct.body.data.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [barcode] });

    const secondProduct = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });
    const secondReceive = await request(app).post(`/api/v1/admin/inventory/products/${secondProduct.body.data.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [barcode] });

    expect(secondReceive.status).toBe(409);
    expect(secondReceive.body.code).toBe('BARCODE_ALREADY_ASSIGNED');
    // Wording staff actually see on the scan/listing screens.
    expect(secondReceive.body.message).toBe('Barcode already used');
    expect(secondReceive.body.details).toEqual([
      expect.objectContaining({ barcode, productName: expect.any(String), status: 'in_stock' }),
    ]);
    expect(fake.db.piece.filter((p: any) => p.barcode === barcode)).toHaveLength(1);
    expect(fake.db.piece.find((p: any) => p.barcode === barcode).productId).toBe(firstProduct.body.data.id);
  });

  // The app's manual-entry fields force-uppercase what staff type while the
  // camera reports the label's raw value, so the same physical tag routinely
  // arrives in different cases. Before normalization that meant a product
  // created with a typed code scanned back as "No product found".
  it('finds a received piece no matter what case the code is scanned in', async () => {
    const staffToken = await createStaffToken('9000000141', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const typed = `NANDAM-${randomUUID().slice(0, 8)}`.toUpperCase();

    const createRes = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });
    const productId = createRes.body.data.id;

    await request(app).post(`/api/v1/admin/inventory/products/${productId}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [typed] });

    for (const scanned of [typed, typed.toLowerCase(), `  ${typed.toLowerCase()}  `]) {
      const lookup = await request(app).post('/api/v1/admin/inventory/scan-lookup')
        .set('Authorization', `Bearer ${staffToken}`).send({ code: scanned });
      expect(lookup.status).toBe(200);
      expect(lookup.body.data.productId).toBe(productId);
    }
  });

  it('stores a scanned lowercase code canonically, so typing it back finds the piece', async () => {
    const staffToken = await createStaffToken('9000000141', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const scanned = `scan-${randomUUID().slice(0, 8)}`.toLowerCase();

    const createRes = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });
    const productId = createRes.body.data.id;

    const receiveRes = await request(app).post(`/api/v1/admin/inventory/products/${productId}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [scanned] });
    expect(receiveRes.status).toBe(201);
    expect(receiveRes.body.data[0].barcode).toBe(scanned.toUpperCase());

    const lookup = await request(app).post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`).send({ code: scanned.toUpperCase() });
    expect(lookup.status).toBe(200);
    expect(lookup.body.data.productId).toBe(productId);
  });

  it('refuses to claim one tag twice by varying its case', async () => {
    const staffToken = await createStaffToken('9000000141', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const barcode = `CASE-${randomUUID().slice(0, 8)}`.toUpperCase();

    const firstProduct = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });
    await request(app).post(`/api/v1/admin/inventory/products/${firstProduct.body.data.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [barcode] });

    const secondProduct = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });
    const secondReceive = await request(app).post(`/api/v1/admin/inventory/products/${secondProduct.body.data.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [barcode.toLowerCase()] });

    expect(secondReceive.status).toBe(409);
    expect(secondReceive.body.code).toBe('BARCODE_ALREADY_ASSIGNED');
    expect(secondReceive.body.message).toBe('Barcode already used');
    expect(fake.db.piece.filter((p: any) => p.barcode.toUpperCase() === barcode)).toHaveLength(1);
  });

  it('rejects a batch holding the same tag in two different cases', async () => {
    const staffToken = await createStaffToken('9000000141', 'STAFF');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const barcode = `BATCH-${randomUUID().slice(0, 8)}`.toUpperCase();

    const createRes = await request(app).post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: category.id, subcategoryId: subcategory.id, trackingMode: 'serialized' });

    const receiveRes = await request(app).post(`/api/v1/admin/inventory/products/${createRes.body.data.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: [barcode, barcode.toLowerCase()] });

    expect(receiveRes.status).toBe(409);
    expect(receiveRes.body.code).toBe('DUPLICATE_IN_BATCH');
    expect(fake.db.piece.filter((p: any) => p.barcode.toUpperCase() === barcode)).toHaveLength(0);
  });
});

describe('piece intake (receivePieces) and inventory reads', () => {
  it('receives scanned barcodes for a serialized product', async () => {
    const staffToken = await createStaffToken('9000000120', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'serialized', sku: 'NH-INTAKE-001' });

    const res = await request(app).post(`/api/v1/admin/inventory/products/${product.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: ['EXT-001', 'EXT-002', 'EXT-003'] });
    expect(res.status).toBe(201);
    expect(res.body.data.map((p: any) => p.barcode)).toEqual(['EXT-001', 'EXT-002', 'EXT-003']);
    expect(fake.db.piece.filter((p: any) => p.productId === product.id)).toHaveLength(3);
    expect(fake.db.stockLedger.filter((l: any) => l.productId === product.id && l.reason === 'restock')).toHaveLength(3);
  });

  it('also receives scanned barcodes for a quantity-mode product — every physical unit is barcoded now', async () => {
    const staffToken = await createStaffToken('9000000121', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });

    const res = await request(app).post(`/api/v1/admin/inventory/products/${product.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: ['EXT-100', 'EXT-101'] });
    expect(res.status).toBe(201);
    expect(fake.db.piece.filter((p: any) => p.productId === product.id)).toHaveLength(2);

    // Legacy `stock` is untouched by receiving — it only ever decrements as
    // it sells; new availability comes from the piece count on top of it.
    expect(fake.db.product.find((p: any) => p.id === product.id).stock).toBe(2);
    const detail = await request(app).get(`/api/v1/admin/products/${product.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detail.body.data.availableCount).toBe(4);
  });

  it('rejects a batch with a duplicate code within itself', async () => {
    const staffToken = await createStaffToken('9000000126', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'serialized' });

    const res = await request(app).post(`/api/v1/admin/inventory/products/${product.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: ['DUP-1', 'DUP-2', 'DUP-1'] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_IN_BATCH');
    expect(fake.db.piece.filter((p: any) => p.productId === product.id)).toHaveLength(0);
  });

  it('rejects a code already assigned to another piece, even if that piece was later sold', async () => {
    const staffToken = await createStaffToken('9000000127', 'STAFF');
    const category = seedCategory();
    const productA = seedProduct(category.id, { trackingMode: 'serialized', name: 'Product A' });
    const productB = seedProduct(category.id, { trackingMode: 'serialized', name: 'Product B' });
    seedPiece(productA.id, { barcode: 'ALREADY-TAKEN', status: 'sold_offline' });

    const res = await request(app).post(`/api/v1/admin/inventory/products/${productB.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`).send({ barcodes: ['ALREADY-TAKEN'] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BARCODE_ALREADY_ASSIGNED');
    expect(res.body.details[0]).toMatchObject({ barcode: 'ALREADY-TAKEN', productName: 'Product A', status: 'sold_offline' });
    expect(fake.db.piece.filter((p: any) => p.productId === productB.id)).toHaveLength(0);
  });

  it('lists a product\'s pieces oldest-first', async () => {
    const staffToken = await createStaffToken('9000000123', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'serialized', sku: 'NH-LIST-001' });
    const older = seedPiece(product.id, { barcode: 'NH-LIST-001-P01', createdAt: new Date('2026-01-01') });
    const newer = seedPiece(product.id, { barcode: 'NH-LIST-001-P02', createdAt: new Date('2026-02-01') });

    const res = await request(app)
      .get(`/api/v1/admin/inventory/products/${product.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((p: any) => p.id)).toEqual([older.id, newer.id]);
    expect(res.body.data[0]).toMatchObject({ barcode: 'NH-LIST-001-P01', status: 'in_stock' });
  });

  it('returns an empty list for a product with no pieces yet', async () => {
    const staffToken = await createStaffToken('9000000124', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'serialized' });

    const res = await request(app)
      .get(`/api/v1/admin/inventory/products/${product.id}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('404s listing pieces for a nonexistent product', async () => {
    const staffToken = await createStaffToken('9000000125', 'STAFF');

    const res = await request(app)
      .get(`/api/v1/admin/inventory/products/${randomUUID()}/pieces`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(404);
  });

  it('lists low-stock products, combining legacy stock and in-stock pieces', async () => {
    const staffToken = await createStaffToken('9000000122', 'STAFF');
    const category = seedCategory();
    seedProduct(category.id, { name: 'Low Qty', trackingMode: 'quantity', stock: 1 });
    seedProduct(category.id, { name: 'High Qty', trackingMode: 'quantity', stock: 50 });
    const serialized = seedProduct(category.id, { name: 'Low Serialized', trackingMode: 'serialized', stock: 0 });
    seedPiece(serialized.id, { status: 'in_stock' });
    // A legacy remainder plus scanned pieces still counts as low if the combined total is low.
    const hybrid = seedProduct(category.id, { name: 'Low Hybrid', trackingMode: 'quantity', stock: 1 });
    seedPiece(hybrid.id, { status: 'in_stock' });

    const res = await request(app).get('/api/v1/admin/inventory/low-stock').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((p: any) => p.name)).toEqual(['Low Qty', 'Low Serialized', 'Low Hybrid']);
  });
});

// A walk-in customer's mobile is used on the phone to send the invoice on
// WhatsApp and must never be stored. The app doesn't send it; this proves the
// server throws it away even if a client does.
describe('counter sales store no customer data', () => {
  it('keeps no customer details on the order or the invoice of a store sale', async () => {
    const staffToken = await createStaffToken('9000000170', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({
        items: [{ code: product.sku }],
        channel: 'store', invoiceRequired: true,
        customer: { phone: '9876512345', address: 'Should never be kept' },
      });
    expect(res.status).toBe(200);

    const order = fake.db.order.find((o: any) => o.id === res.body.data.orderId);
    expect(JSON.stringify(order)).not.toContain('9876512345');
    expect(JSON.stringify(order)).not.toContain('Should never be kept');

    const invoice = fake.db.invoice.find((i: any) => i.orderId === order.id);
    expect(invoice).toBeTruthy(); // the invoice itself is still generated and kept
    expect(invoice.customerMobile ?? null).toBeNull();
    expect(JSON.stringify(invoice)).not.toContain('9876512345');
  });

  it('still keeps the delivery number and address on a WhatsApp order', async () => {
    const staffToken = await createStaffToken('9000000171', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ code: product.sku }], channel: 'whatsapp', invoiceRequired: true, customer: { phone: '9876512345', address: '12 Temple St, Guntur' } });

    const order = fake.db.order.find((o: any) => o.id === res.body.data.orderId);
    expect(order.shippingAddress.phone).toBe('9876512345');
  });
});

// Staff read the number off a tag and type just that. The full code, the
// number alone and a camera scan must all land on the same product.
describe('finding a product by the number on its tag', () => {
  const lookup = (token: string, body: Record<string, unknown>) =>
    request(app).post('/api/v1/admin/inventory/scan-lookup').set('Authorization', `Bearer ${token}`).send(body);

  it('returns the same piece for the full code, the number and a lowercase scan', async () => {
    const staffToken = await createStaffToken('9000000180', 'STAFF');
    const { product } = await seedSerializedProduct(0);
    const piece = seedPiece(product.id, { barcode: 'NANDAM3136' });

    for (const code of ['NANDAM3136', '3136', 'nandam3136', ' 3136 ']) {
      const res = await lookup(staffToken, { code });
      expect(res.status, code).toBe(200);
      expect(res.body.data.pieceId).toBe(piece.id);
      // The full tag always comes back, so the bill sells the exact piece.
      expect(res.body.data.barcode).toBe('NANDAM3136');
    }
  });

  it('does not match a number that is only part of the tag number', async () => {
    const staffToken = await createStaffToken('9000000181', 'STAFF');
    const { product } = await seedSerializedProduct(0);
    seedPiece(product.id, { barcode: 'NANDAM3136' });

    expect((await lookup(staffToken, { code: '136' })).status).toBe(404);
  });

  it('matches only the literal code when asked for an exact match', async () => {
    const staffToken = await createStaffToken('9000000182', 'STAFF');
    const { product } = await seedSerializedProduct(0);
    seedPiece(product.id, { barcode: 'NANDAM3136' });

    expect((await lookup(staffToken, { code: '3136', exact: true })).status).toBe(404);
  });

  it('prefers the tag still in stock when two share a number', async () => {
    const staffToken = await createStaffToken('9000000183', 'STAFF');
    const { product } = await seedSerializedProduct(0);
    seedPiece(product.id, { barcode: 'OLD3136', status: 'sold_offline' });
    const live = seedPiece(product.id, { barcode: 'NANDAM3136' });

    const res = await lookup(staffToken, { code: '3136' });
    expect(res.body.data.pieceId).toBe(live.id);
  });

  it('asks for the full code when two in-stock tags share a number', async () => {
    const staffToken = await createStaffToken('9000000184', 'STAFF');
    const { product } = await seedSerializedProduct(0);
    seedPiece(product.id, { barcode: 'ABC3136' });
    seedPiece(product.id, { barcode: 'NANDAM3136' });

    const res = await lookup(staffToken, { code: '3136' });
    expect(res.status).toBe(409);
    expect(res.body.code ?? res.body.error?.code).toBe('AMBIGUOUS_CODE');
  });
});

describe('sales without an invoice', () => {
  it('requires staff to say whether an invoice is needed', async () => {
    const staffToken = await createStaffToken('9000000190', 'STAFF');
    const category = seedCategory();
    const product = seedProduct(category.id, { trackingMode: 'quantity', stock: 2 });

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', code: product.sku });
    expect(res.status).toBe(400);
    expect(fake.db.order).toHaveLength(0);
  });

  it('records the whole sale but generates no invoice', async () => {
    const staffToken = await createStaffToken('9000000191', 'STAFF');
    const { product, pieces } = await seedSerializedProduct(1);

    const res = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: false, items: [{ code: pieces[0].barcode, salePrice: 4000 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.invoice).toBeNull();
    expect(res.body.data.invoiceRequired).toBe(false);
    expect(res.body.data.total).toBe(4000);

    const order = fake.db.order.find((o: any) => o.id === res.body.data.orderId);
    expect(order.invoiceRequired).toBe(false);
    expect(fake.db.orderItem.filter((i: any) => i.orderId === order.id)).toHaveLength(1);
    expect(fake.db.piece.find((p: any) => p.id === pieces[0].id).status).toBe('sold_offline');
    expect(fake.db.invoice).toHaveLength(0);
    expect(product).toBeTruthy();
  });
});

describe('archived products', () => {
  it('cannot be looked up or sold', async () => {
    const staffToken = await createStaffToken('9000000195', 'STAFF');
    const { product, pieces } = await seedSerializedProduct(1);
    fake.db.product.find((p: any) => p.id === product.id).deletedAt = new Date();

    const found = await request(app).post('/api/v1/admin/inventory/scan-lookup').set('Authorization', `Bearer ${staffToken}`)
      .send({ code: pieces[0].barcode });
    expect(found.status).toBe(404);

    const sold = await request(app).post('/api/v1/admin/inventory/scan-sell').set('Authorization', `Bearer ${staffToken}`)
      .send({ channel: 'store', invoiceRequired: true, items: [{ code: pieces[0].barcode }] });
    expect(sold.status).toBe(404);
  });
});

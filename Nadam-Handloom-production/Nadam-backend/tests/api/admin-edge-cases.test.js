// Admin app: the situations people rarely hit (the 16 Oct 2026 check, to-do section 4d).
// PIN and code guesses sent at the same moment, a tag change crossing a sale, staff Home
// with many bills, invoices made again, the accountant's spreadsheet, database time limits,
// and Face ID needing the PIN.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { api, prisma, signedIn, authed, makeAccount, trustDevice, newDevice, phoneKeys } from '../support/helpers.js';
import { remakePdf } from '../../src/services/invoice.service.js';
import { rules as biometricRules } from '../../src/services/biometric.service.js';
import { storage } from '../../src/services/storage/index.js';
import { pdfText } from '../support/pdf.js';

const C = '/api/v2/catalog';
const SA = '/api/v2/sales';
const PR = '/api/v2/products';
const uid = () => crypto.randomUUID().slice(0, 8);
let seq = Math.floor(Math.random() * 400000) + 9200000;
const newTag = () => `NE${seq++}`;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const codes = (replies) => replies.map((r) => r.body?.error?.code ?? r.body?.status ?? r.status);
const count = (list, x) => list.filter((y) => y === x).length;
const login = (mobile, pin, device) => api().post('/api/v2/auth/login').send({ mobile, pin, device });
const wrongPin = (pin) => (pin === '111111' ? '222222' : '111111');

let owner;
let sub;
const as = (who) => (method, url) => authed(method, url, who.session, who.device);
const O = (m, u) => as(owner)(m, u);

beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Edge' });
  const c = await O('post', `${C}/categories`).send({ name: `Cat ${uid()}`, description: 'Test category' });
  const s = await O('post', `${C}/categories/${c.body.category.id}/subcategories`).send({ name: `Sub ${uid()}`, description: 'Test', storePrice: 3600, websitePrice: 2800, mrp: 16999 });
  sub = { ...s.body.subcategory, category: c.body.category };
});
afterEach(() => { biometricRules.needsPin = false; });

async function saree() {
  const id = uid() + uid();
  const p = await prisma.product.create({
    data: { slug: `test-${id}`, sku: `T-${id}`, name: sub.name, categoryId: sub.category.id, subcategoryId: sub.id, channelVisibility: 'both', trackingMode: 'serialized', isActive: true },
  });
  await prisma.productImage.create({ data: { productId: p.id, url: `http://test.local/${id}.jpg`, sortOrder: 0 } });
  const pc = await prisma.piece.create({ data: { productId: p.id, barcode: newTag(), status: 'in_stock' } });
  return { productId: p.id, pieceId: pc.id, storePrice: Number(sub.storePrice) };
}
const bill = (sarees) => ({ clientRef: `bill-${uid()}${uid()}`, lines: sarees.map((x) => ({ pieceId: x.pieceId, price: x.storePrice, storePrice: x.storePrice })), channel: 'store', paymentMethod: 'cash', invoice: false });

describe('PIN guesses sent at the same moment', () => {
  it('twenty wrong PINs at once: only 5 are checked, the rest are refused; then even the right PIN waits', async () => {
    const acc = await makeAccount({ role: 'STAFF' });
    const device = newDevice('android');
    await trustDevice(acc, device);
    const replies = await Promise.all(Array.from({ length: 20 }, () => login(acc.mobile, wrongPin(acc.pin), device)));
    const c = codes(replies);
    expect(count(c, 'INVALID_CREDENTIALS')).toBe(4);
    expect(count(c, 'LOCKED')).toBe(16);
    const right = await login(acc.mobile, acc.pin, device);
    expect(right.status).toBe(423);
    const a = await prisma.authAccount.findUnique({ where: { id: acc.id } });
    expect(a.lockCount).toBe(1);
    expect(a.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('when the lock ends there are 5 fresh tries, and the right PIN signs in', async () => {
    const acc = await makeAccount({ role: 'STAFF' });
    const device = newDevice('android');
    await trustDevice(acc, device);
    await Promise.all(Array.from({ length: 8 }, () => login(acc.mobile, wrongPin(acc.pin), device)));
    await prisma.authAccount.update({ where: { id: acc.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    const one = await login(acc.mobile, wrongPin(acc.pin), device);
    expect(one.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', details: { triesLeft: 4 } });
    expect((await login(acc.mobile, acc.pin, device)).body.status).toBe('signed_in');
    expect(await prisma.authAccount.findUnique({ where: { id: acc.id } })).toMatchObject({ failedLoginAttempts: 0, lockCount: 0, lockedUntil: null });
  });

  it('a number with no account answers the same way (nothing gives away who has an account)', async () => {
    const replies = await Promise.all(Array.from({ length: 20 }, () => login(`9${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`.slice(0, 10), '123456', newDevice('android'))));
    expect(codes(replies).every((x) => x === 'INVALID_CREDENTIALS')).toBe(true); // 20 different numbers: one try each
    const mobile = `9${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`;
    const same = codes(await Promise.all(Array.from({ length: 20 }, () => login(mobile, '123456', newDevice('android')))));
    expect(count(same, 'INVALID_CREDENTIALS')).toBe(4);
    expect(count(same, 'LOCKED')).toBe(16);
  });

  it('"Change PIN" guesses at once share the same 5 tries', async () => {
    const who = await signedIn({ role: 'STAFF' });
    const replies = await Promise.all(Array.from({ length: 10 }, () => as(who)('post', '/api/v2/me/pin/verify').send({ pin: wrongPin(who.account.pin) })));
    const c = codes(replies);
    expect(count(c, 'WRONG_PIN')).toBe(4);
    expect(count(c, 'LOCKED')).toBe(6);
  });
});

describe('SMS codes guessed at the same moment', () => {
  it('a new phone\'s code: eight guesses at once use the 3 tries, then the right code is refused', async () => {
    const acc = await makeAccount();
    const device = newDevice('android');
    const r1 = await login(acc.mobile, acc.pin, device);
    expect(r1.body.status).toBe('verify_device');
    const r2 = await api().post('/api/v2/auth/device/request-code').send({ stepToken: r1.body.stepToken });
    const wrong = r2.body.devCode === '000000' ? '111111' : '000000';
    const replies = await Promise.all(Array.from({ length: 8 }, () => api().post('/api/v2/auth/device/verify-code').send({ stepToken: r1.body.stepToken, code: wrong, device })));
    expect(count(codes(replies), 'WRONG_CODE')).toBe(2);
    const right = await api().post('/api/v2/auth/device/verify-code').send({ stepToken: r1.body.stepToken, code: r2.body.devCode, device });
    expect(right.body.error.code).toBe('CODE_USED_UP');
  });
});

describe('a tag change crossing a sale', () => {
  it('"Saree damaged" saved just after the saree was sold is refused, not written over the sale', async () => {
    const x = await saree();
    let reply;
    // Hold the tag's row, let the "damaged" request read it and wait, then sell it.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Piece" WHERE id = ${x.pieceId} FOR UPDATE`;
      reply = O('post', `${PR}/${x.productId}/tags/${x.pieceId}/damaged`).then((r) => r);
      await sleep(600);
      await tx.piece.update({ where: { id: x.pieceId }, data: { status: 'sold_offline', soldAt: new Date() } });
    }, { timeout: 10000 });
    const r = await reply;
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('TAG_CHANGED');
    expect((await prisma.piece.findUnique({ where: { id: x.pieceId } })).status).toBe('sold_offline');
    expect(await prisma.stockLedger.count({ where: { pieceId: x.pieceId, reason: 'damaged' } })).toBe(0);
  });

  it('a sale and "Saree damaged" at the same moment never both succeed', async () => {
    const staff = await signedIn({ role: 'STAFF', name: 'Race' });
    for (let i = 0; i < 4; i += 1) {
      const x = await saree();
      const [sale, dmg] = await Promise.all([
        as(staff)('post', SA).send(bill([x])),
        O('post', `${PR}/${x.productId}/tags/${x.pieceId}/damaged`),
      ]);
      expect(sale.status === 201 && dmg.status === 200).toBe(false);
      const status = (await prisma.piece.findUnique({ where: { id: x.pieceId } })).status;
      expect(status).toBe(sale.status === 201 ? 'sold_offline' : 'damaged');
    }
  });
});

describe('staff Home', () => {
  it('a staff member with 25 bills today sees 25 (not the first 20)', async () => {
    const staff = await signedIn({ role: 'STAFF', name: 'Busy' });
    for (let i = 0; i < 25; i += 1) {
      const r = await as(staff)('post', SA).send(bill([await saree()]));
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    }
    const h = await as(staff)('get', '/api/v2/home');
    expect(h.body.sales.mine).toEqual({ bills: 25, sarees: 25 });
  });
});

describe('an invoice PDF made again', () => {
  it('an old-app line of 2 pieces prints 2, and the invoice\'s own GST rate (not today\'s)', async () => {
    const x = await saree();
    const o = await prisma.order.create({
      data: {
        orderNumber: `T${uid()}`, channel: 'store', status: 'completed', subtotal: 2000, total: 2000, paymentMethod: 'cash', shippingAddress: { fullName: 'Old App Buyer' },
        items: { create: [{ productId: x.productId, nameSnapshot: 'Pattu saree', priceSnapshot: 1000, quantity: 2 }] },
      },
    });
    await prisma.invoice.create({ data: { invoiceNumber: `TEST-${uid()}`, orderId: o.id, channel: 'store', customerName: 'Old App Buyer', gstRatePercent: 12, taxableValue: 1785.71, cgstAmount: 107.15, sgstAmount: 107.14, totalAmount: 2000, storageKey: 'x', url: 'http://x/y.pdf', generatedBy: 'system' } });
    const inv = await remakePdf(o.id);
    const text = pdfText(fs.readFileSync(`${storage().root}/${inv.storageKey}`));
    expect(text).toContain('CGST @ 6.00%');
    // The line: name, tag, quantity 2, one piece without 12% GST, both pieces without GST.
    expect(text).toContain('Pattu saree-2Rs. 892.86Rs. 1,785.71');
    expect(text).not.toContain('CGST @ 2.50%');
  });
});

describe('the accountant\'s spreadsheet', () => {
  it('a customer name that starts like a formula stays plain text in Excel', async () => {
    const o = await prisma.order.create({ data: { orderNumber: `T${uid()}`, channel: 'online', status: 'processing', subtotal: 2800, total: 2800, shippingAddress: { fullName: '=HYPERLINK("http://x.example","click")' } } });
    await prisma.invoice.create({ data: { invoiceNumber: `TEST-${uid()}`, orderId: o.id, channel: 'online', customerName: '=HYPERLINK("http://x.example","click")', gstRatePercent: 5, taxableValue: 2666.67, cgstAmount: 66.67, sgstAmount: 66.66, totalAmount: 2800, storageKey: 'x', url: 'http://x/y.pdf', generatedBy: 'system', generatedAt: new Date('2024-03-05T06:00:00Z') } });
    const csv = await O('get', '/api/v2/invoices/summary/csv?from=2024-03-05&to=2024-03-05&channels=online');
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('"\'=HYPERLINK(""http://x.example"",""click"")"');
    expect(csv.text).toContain(',2666.67,'); // numbers unchanged
  });
});

describe('the database', () => {
  it('every statement has a time limit (a stalled database gives a quick "try again")', async () => {
    const [{ statement_timeout: t }] = await prisma.$queryRaw`SHOW statement_timeout`;
    expect(t).toBe('28s');
  });
});

describe('Face ID needs the PIN', () => {
  it('with a wrong PIN it isn\'t turned on; with the right PIN it is; older apps still work until the switch', async () => {
    const who = await signedIn({ role: 'STAFF' });
    const keys = phoneKeys();
    const wrong = await as(who)('post', '/api/v2/me/biometric').send({ publicKey: keys.publicKey, pin: wrongPin(who.account.pin) });
    expect(wrong.body.error).toMatchObject({ code: 'WRONG_PIN', details: { triesLeft: 4 } });
    expect((await prisma.trustedDevice.findFirst({ where: { authAccountId: who.account.id } })).biometricPublicKey).toBeNull();
    const ok = await as(who)('post', '/api/v2/me/biometric').send({ publicKey: keys.publicKey, pin: who.account.pin });
    expect(ok.body).toEqual({ biometricEnabled: true });

    const older = await signedIn({ role: 'STAFF' });
    expect((await as(older)('post', '/api/v2/me/biometric').send({ publicKey: phoneKeys().publicKey })).body).toEqual({ biometricEnabled: true });
    biometricRules.needsPin = true; // BIOMETRIC_NEEDS_PIN=true, once every phone has the new app
    const later = await signedIn({ role: 'STAFF' });
    const refused = await as(later)('post', '/api/v2/me/biometric').send({ publicKey: phoneKeys().publicKey });
    expect(refused.body.error.code).toBe('PIN_NEEDED');
  });
});

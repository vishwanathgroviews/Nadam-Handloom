// Module 5: the bill's sums and the checks before "Complete sale" (sections 5.2, 5.3, 6.3, 6.5, 6.6).
import { billTotals, parsePrice, isLowPrice, completeErrors, saleRequest, linePrice, stockBadgeFor, MAX_LINES } from './sales';

const L = (storePrice, agreed = null, extra = {}) => ({ pieceId: `p${Math.random()}`, storePrice, agreed, ...extra });

describe('the bill', () => {
  it('adds up store prices, or the agreed price when one is typed, with the saving', () => {
    expect(billTotals([])).toEqual({ count: 0, total: 0, off: 0 });
    expect(billTotals([L(3600), L(3600, 2000), L(1200)])).toEqual({ count: 3, total: 6800, off: 1600 });
    expect(billTotals([L(0.1), L(0.2)]).total).toBe(0.3);
    expect(billTotals([L(1000, 1200)]).off).toBe(0); // above the store price is not a saving
    expect(linePrice(L(3600, 2500))).toBe(2500);
  });

  it('reads the agreed-price box: empty = store price; rupees with up to 2 decimals; above ₹0', () => {
    expect(parsePrice('')).toEqual({ value: null });
    expect(parsePrice(' ₹2,500 ')).toEqual({ value: 2500 });
    expect(parsePrice('2499.5')).toEqual({ value: 2499.5 });
    expect(parsePrice('0').error).toMatch(/more than ₹0/);
    expect(parsePrice('12.345').error).toBeTruthy();
    expect(parsePrice('abc').error).toBeTruthy();
    expect(parsePrice('1000001').error).toMatch(/10,00,000/);
  });

  it('asks "Is this right?" only under half the store price (6.3)', () => {
    expect(isLowPrice(1799, 3600)).toBe(true);
    expect(isLowPrice(1800, 3600)).toBe(false);
    expect(isLowPrice(null, 3600)).toBe(false);
  });
});

describe('Complete sale', () => {
  const lines = [L(3600)];
  const ok = { where: 'store', pay: 'cash', invoice: false, name: '', mobile: '', address: '' };
  it('where, paid by and invoice are always asked, with no default (6.1, 6.7)', () => {
    expect(completeErrors({ where: null, pay: null, invoice: null }, lines)).toEqual({ where: expect.any(String), pay: expect.any(String), invoice: expect.any(String) });
    expect(completeErrors(ok, lines)).toEqual({});
    expect(completeErrors(ok, []).lines).toBeTruthy();
    expect(completeErrors(ok, Array.from({ length: MAX_LINES + 1 }, () => L(1))).lines).toMatch(/up to 100/);
  });
  it('a counter customer is optional, but a typed mobile must be right (6.5)', () => {
    expect(completeErrors({ ...ok, mobile: '98480' }, lines).mobile).toBeTruthy();
    expect(completeErrors({ ...ok, name: 'Sita', mobile: '9848022338' }, lines)).toEqual({});
  });
  it('a WhatsApp order needs name, mobile and the delivery address (6.6)', () => {
    const e = completeErrors({ ...ok, where: 'whatsapp' }, lines);
    expect(Object.keys(e).sort()).toEqual(['address', 'mobile', 'name']);
    expect(completeErrors({ ...ok, where: 'whatsapp', name: 'Anitha', mobile: '9848022338', address: '12-4 Main Road, Guntur' }, lines)).toEqual({});
  });
  it('sends the bill id, each line\'s price and store price, and "Sell anyway" per saree', () => {
    const bill = { id: 'bill-1', lines: [L(3600, 3000, { pieceId: 'a', held: true }), L(1200, null, { pieceId: 'b' })], form: { ...ok, where: 'store', invoice: true, name: ' Sita ', mobile: '9848022338', address: 'ignored at the counter' } };
    expect(saleRequest(bill)).toEqual({
      clientRef: 'bill-1',
      lines: [{ pieceId: 'a', price: 3000, storePrice: 3600, sellHeld: true }, { pieceId: 'b', price: 1200, storePrice: 1200, sellHeld: false }],
      channel: 'store', paymentMethod: 'cash', invoice: true, customer: { name: 'Sita', mobile: '9848022338' },
    });
  });
  it('Price check badges', () => {
    expect(stockBadgeFor({ sellable: true })[1]).toBe('success');
    expect(stockBadgeFor({ sellable: false, problem: { code: 'HELD_ONLINE' } })[0]).toBe('Held online');
  });
});

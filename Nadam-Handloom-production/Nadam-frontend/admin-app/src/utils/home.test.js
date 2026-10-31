// Module 8: greeting, hidden amounts, the updated time, the Needs attention list.
import { greeting, money, HIDDEN, clockTime, updatedText, attentionList } from './home';

describe('greeting, money and time', () => {
  it('greets by the hour; hides every ₹ when asked', () => {
    expect(greeting(9)).toBe('Good morning');
    expect(greeting(13)).toBe('Good afternoon');
    expect(greeting(19)).toBe('Good evening');
    expect(money(51850, false)).toBe('₹51,850');
    expect(money(1234.5, false)).toBe('₹1,234.50');
    expect(money(51850, true)).toBe(HIDDEN);
  });
  it('"just now" for a minute, then the clock time', () => {
    const at = new Date(2026, 9, 12, 19, 52).getTime();
    expect(clockTime(at)).toBe('7:52 pm');
    expect(clockTime(new Date(2026, 9, 12, 0, 5))).toBe('12:05 am');
    expect(updatedText(at, at + 30000)).toBe('just now');
    expect(updatedText(at, at + 5 * 60000)).toBe('7:52 pm');
  });
});

const data = {
  attention: {
    toShip: { count: 3, oldestDays: 2 },
    toCheck: { count: 2, oldestShipped: '29 Sept', oldestId: 'o6' },
    invoiceMissing: [{ id: 's2', orderNumber: 'NH40718001', date: '12 Oct 2026', time: '3:05 pm', today: true }],
    noPhoto: 6,
    unpaid: { customers: 4, tries: 18 },
    stock: { soldOut: 5, low: 2 },
    monthSummary: { month: 'September', key: '2026-09', from: '2026-09-01', to: '2026-09-30' },
  },
};

describe('Needs attention (6.4)', () => {
  it('most urgent first, each opening its screen', () => {
    const list = attentionList({ data, bill: { lines: [1, 2, 3] }, uploads: { waiting: 2, failed: 0 }, online: false });
    expect(list.map((x) => x.key)).toEqual(['bill', 'toShip', 'invoice-s2', 'unpaid', 'toCheck', 'uploads', 'month', 'stock', 'noPhoto']);
    const by = Object.fromEntries(list.map((x) => [x.key, x]));
    expect(by.bill.title).toBe('Your bill has 3 sarees, not finished');
    expect(by.toShip).toMatchObject({ title: '3 orders to ship', subtitle: 'Oldest waiting 2 days', warn: true, href: '/orders?tab=to_ship' });
    expect(by['invoice-s2']).toMatchObject({ href: '/scan/sale/s2?back=home', subtitle: 'Today, 3:05 pm · bill NH40718001 · tap to make it' });
    expect(by.unpaid.title).toBe("4 customers didn't finish paying");
    expect(by.toCheck).toMatchObject({ title: '2 parcels to check', href: '/orders?tab=shipped' });
    // Just one: straight to that order.
    expect(attentionList({ data: { attention: { toCheck: { count: 1, oldestShipped: '29 Sept', oldestId: 'o6' } } } })[0].href).toBe('/orders/order/o6?back=home');
    expect(by.uploads.title).toBe('2 sarees not uploaded yet');
    expect(by.month).toMatchObject({ title: "Send September's sales summary", href: '/more/invoices/summary?period=last&back=home', seen: '2026-09' });
    expect(by.stock).toMatchObject({ title: '5 designs sold out, 2 running low', href: '/home/low' });
    expect(by.noPhoto.href).toBe('/products?filter=nophoto');
  });
  it('a security alert comes first and opens Activity on Sign-in', () => {
    const list = attentionList({ data: { attention: { security: { count: 1, text: "Ravi's PIN was locked after too many wrong tries", time: '10:15 am' } } }, bill: { lines: [1] } });
    expect(list.map((x) => x.key)).toEqual(['security', 'bill']);
    expect(list[0]).toMatchObject({ title: '1 security alert', subtitle: "Ravi's PIN was locked after too many wrong tries · 10:15 am", href: '/more/activity?kind=signin&period=today&back=home' });
  });
  it('the staff app paused comes first and opens Settings (Module 11)', () => {
    const list = attentionList({ data: { attention: { maintenance: { since: '3:10 pm', sinceDate: '12 Oct 2026', by: 'Lakshmi', message: 'Back at 6' }, security: { count: 1, text: 'x', time: '10:15 am' } } } });
    expect(list.map((x) => x.key)).toEqual(['maintenance', 'security']);
    expect(list[0]).toMatchObject({ title: 'Staff app paused', subtitle: 'Since 12 Oct 2026, 3:10 pm · by Lakshmi · tap to resume', href: '/more/settings?back=home', tone: 'danger' });
  });
  it('nothing to show when nothing is waiting', () => {
    expect(attentionList({ data: { attention: { invoiceMissing: [], noPhoto: 0, toShip: null, toCheck: null, unpaid: null, stock: null, monthSummary: null } }, bill: { lines: [] }, uploads: { waiting: 0, failed: 0 } })).toEqual([]);
    expect(attentionList({})).toEqual([]);
  });
  it('a seen reminder goes; a pending bill and failed uploads say so', () => {
    const list = attentionList({ data, summarySeen: '2026-09', bill: { lines: [1], pending: true }, uploads: { waiting: 1, failed: 2 }, batch: { items: [{ tag: 'NH1' }, {}], sub: { name: 'Rainbow checks sarees' } } });
    const keys = list.map((x) => x.key);
    expect(keys).not.toContain('month');
    expect(keys.slice(0, 2)).toEqual(['bill', 'batch']);
    expect(list[0].title).toBe('A sale is waiting for an answer');
    expect(list[1].title).toBe('Sarees not saved yet: 1 of 2 photos tagged');
    expect(list.find((x) => x.key === 'uploads').title).toBe('2 sarees need a different tag');
  });
  it('one of a kind reads right; while online uploads say "Uploading"', () => {
    const one = attentionList({ data: { attention: { toShip: { count: 1, oldestDays: 0 }, stock: { soldOut: 1, low: 0 }, unpaid: { customers: 1, tries: 1 } } }, uploads: { waiting: 1 }, online: true });
    const by = Object.fromEntries(one.map((x) => [x.key, x]));
    expect(by.toShip).toMatchObject({ title: '1 order to ship', subtitle: 'All from today', warn: false });
    expect(by.stock.title).toBe('1 design sold out');
    expect(by.unpaid.subtitle).toBe('On the website this week · 1 try · call them back');
    expect(by.uploads.title).toBe('Uploading 1 saree…');
  });
});

// Online payments (owners): the list's query, refund words, and which payment a
// notification opens (Android and iPhone send it differently).
import { paymentsQuery, refundText, numberFromData, noticeText, STATUS_CHIPS } from './payments';
import { rupees } from './catalog';

describe('the list\'s query', () => {
  it('status, days and method; a search looks at every date', () => {
    expect(paymentsQuery()).toBe('status=all&method=all&offset=0&period=all');
    expect(paymentsQuery({ status: 'paid', period: '7d', method: 'upi', offset: 20 })).toBe('status=paid&method=upi&offset=20&period=7d');
    expect(paymentsQuery({ period: 'custom', custom: { from: '2026-10-01', to: '2026-10-17' } })).toBe('status=all&method=all&offset=0&period=custom&from=2026-10-01&to=2026-10-17');
    expect(paymentsQuery({ period: 'custom' })).toBe('status=all&method=all&offset=0&period=all');
    expect(paymentsQuery({ period: 'today', q: ' NH12345678 ' })).toBe('status=all&method=all&offset=0&q=NH12345678');
  });
  it('a chip for every state the server sends', () => {
    expect(STATUS_CHIPS.map(([k]) => k)).toEqual(['all', 'paid', 'confirming', 'not_paid', 'refunded', 'refund_stuck', 'refund_by_hand']);
  });
});

describe('words', () => {
  it('refunds', () => {
    expect(refundText(null, rupees)).toBeNull();
    expect(refundText({ amount: 5800, state: 'stuck' }, rupees)).toBe('Refund stuck · ₹5,800');
    expect(refundText({ amount: 5800, state: 'processed' }, rupees)).toBe('Refunded · ₹5,800');
    expect(refundText({ amount: 5800, state: 'started' }, rupees)).toBe('Refund started · ₹5,800');
    expect(refundText({ amount: 5800, state: 'waiting' }, rupees)).toBe('Refund waiting · ₹5,800');
  });
  it('Razorpay\'s notices', () => {
    expect(noticeText('payment.captured')).toBe('Payment taken');
    expect(noticeText('something.new')).toBe('something.new');
  });
});

describe('which payment a notification opens', () => {
  it('Android (data.body as JSON text), iPhone (data.body as an object), or the number itself', () => {
    expect(numberFromData({ body: '{"type":"payment","number":"NH12345678"}' })).toBe('NH12345678');
    expect(numberFromData({ body: { number: 'NH12345678' } })).toBe('NH12345678');
    expect(numberFromData({ number: 'NH12345678' })).toBe('NH12345678');
  });
  it('anything else opens nothing', () => {
    expect(numberFromData(null)).toBeNull();
    expect(numberFromData({ body: 'not json' })).toBeNull();
    expect(numberFromData({ number: '../../team' })).toBeNull();
    expect(numberFromData({ type: 'test' })).toBeNull();
  });
});

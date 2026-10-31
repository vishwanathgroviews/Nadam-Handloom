// Online payments (owners): the list and one payment draw what the server sends, the chips
// filter, and a stuck refund says what to do. The server and notifications are stand-ins.
import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { FeedbackProvider } from '../Feedback';
import * as payments from '../../api/payments';
import OnlinePayments from '../../app/(app)/more/payments/index';
import PaymentDetail from '../../app/(app)/more/payments/[number]';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../api/payments', () => ({
  listPayments: jest.fn(), getPayment: jest.fn(), pushStatus: jest.fn(), registerPush: jest.fn(), setPaymentPush: jest.fn(), testPush: jest.fn(),
}));
jest.mock('../StatusBanner', () => ({ StatusBanner: () => null }));
jest.mock('../../push/notifications', () => ({ permission: jest.fn(async () => 'ask'), enable: jest.fn(async () => ({ ok: true, push: { payments: true } })), watchToken: jest.fn(() => () => {}) }));

const row = (over) => ({
  id: 'o1', number: 'NH12345678', status: 'paid', statusText: 'Paid', orderStatus: 'processing', total: 12400, method: 'upi', methodText: 'UPI',
  customer: 'Priya Sharma', mobile: '9876543210', town: 'Hyderabad', sarees: 2, imageUrl: null, placedAt: '2026-10-17T05:00:00.000Z', when: '17 Oct 2026, 10:30 am',
  paidAt: '2026-10-17T05:01:00.000Z', tries: 1, refund: null, ...over,
});
const LIST = {
  payments: [
    row(),
    row({ id: 'o2', number: 'NH87654321', status: 'refund_stuck', statusText: 'Refund stuck', orderStatus: 'cancelled', total: 5800, customer: 'Ravi Kumar', town: 'Guntur', refund: { amount: 5800, state: 'stuck', reason: 'Paid after the sarees were sold', error: 'The balance is insufficient' } }),
    row({ id: 'o3', number: 'NH11112222', status: 'not_paid', statusText: 'Not paid', orderStatus: 'pending_payment', total: 3300, method: null, methodText: null, paidAt: null }),
  ],
  nextOffset: null, total: 3,
  totals: { paid: 12400, paidCount: 1, refunded: 5800, refundedCount: 1 },
  counts: { paid: 1, confirming: 0, not_paid: 1, refunded: 1, refund_stuck: 1, refund_by_hand: 0 },
  period: null,
};
const DETAIL = {
  payment: {
    ...row({ number: 'NH87654321', status: 'refund_stuck', statusText: 'Refund stuck', orderStatus: 'cancelled', total: 5800, refund: { amount: 5800, state: 'stuck', reason: 'Paid after the sarees were sold', error: 'The balance is insufficient' } }),
    orderStatusText: 'Cancelled',
    customer: { name: 'Ravi Kumar', mobile: '9123456789', email: null, lines: ['D.No. 4-12, Temple Street', 'Guntur, Andhra Pradesh 522002'] },
    items: [{ name: 'Pure Pattu Butta', sku: 'NH-PPB-0042', imageUrl: null, price: 5800, quantity: 1 }],
    invoiceNumber: null, razorpayPaymentId: null, razorpayOrderId: 'order_ABC123', hold: null, cancelReason: 'Paid after the sarees were sold; refunded', canOpenOrder: true,
    tries: [{ razorpayOrderId: 'order_ABC123', status: 'refund_due', statusText: 'Refund waiting', amount: 5800, method: 'upi', methodText: 'UPI', paymentId: 'pay_XYZ', when: '17 Oct 2026, 10:30 am', paidWhen: '17 Oct 2026, 10:50 am', refund: { amount: 5800, state: 'stuck', tries: 3, error: 'The balance is insufficient', when: null } }],
    notices: [{ type: 'payment.captured', result: 'refunded', when: '17 Oct 2026, 10:50 am' }],
  },
};

const routes = {
  _layout: () => (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider><FeedbackProvider><Stack screenOptions={{ headerShown: false }} /></FeedbackProvider></ThemeProvider>
    </SafeAreaProvider>
  ),
  'more/payments/index': OnlinePayments,
  'more/payments/[number]': PaymentDetail,
  'orders/order/[id]': () => <Text>order page</Text>,
};

beforeEach(() => {
  payments.listPayments.mockReset().mockResolvedValue(LIST);
  payments.getPayment.mockReset().mockResolvedValue(DETAIL);
  payments.pushStatus.mockReset().mockResolvedValue({ push: { registered: false, payments: false, canGetPayments: true, ready: true } });
});

// renderRouter runs on fake timers (one app per test file): each step settles when they run.
// (A press answers a promise in this testing library: it is awaited.)
const settle = async (fn) => {
  await act(async () => { if (fn) await fn(); await Promise.resolve(); });
  await act(async () => { jest.runAllTimers(); await Promise.resolve(); });
};

it('the list: totals, counts on the chips, each payment, a stuck refund called out; chips filter; a row opens the payment', async () => {
  // With this testing library, render answers a promise; the router's helpers sit on it.
  const router = renderRouter(routes, { initialUrl: '/more/payments' });
  await router;
  await settle();
  const app = screen;
  expect(app.getAllByText('₹12,400')).toHaveLength(2); // the totals and the row
  expect(app.getByText('Paid · 1 order')).toBeTruthy();
  expect(app.getByText('1 refund stuck')).toBeTruthy();
  expect(app.getByText('NH12345678')).toBeTruthy();
  expect(app.getByText('Priya Sharma, Hyderabad · 17 Oct 2026, 10:30 am · UPI')).toBeTruthy();
  expect(app.getByText(/Get a notification on this phone for each online payment/)).toBeTruthy();
  expect(payments.listPayments).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'all', period: 'all', method: 'all', q: '', offset: 0 }));

  await settle(() => fireEvent.press(app.getByRole('tab', { name: /Refund stuck/ })));
  expect(payments.listPayments).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'refund_stuck' }));
  await settle(() => fireEvent.press(app.getByRole('tab', { name: /^UPI/ })));
  expect(payments.listPayments).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'refund_stuck', method: 'upi' }));

  await settle(() => fireEvent.press(app.getByLabelText(/^NH87654321, Refund stuck/)));
  expect(router.getPathname()).toBe('/more/payments/NH87654321');
  expect(payments.getPayment).toHaveBeenCalledWith('NH87654321');
  expect(app.getByText('Refund stuck: please refund by hand')).toBeTruthy();
  expect(app.getByText(/Razorpay refused to refund ₹5,800 \(The balance is insufficient\)/)).toBeTruthy();
  expect(app.getByText('Ravi Kumar')).toBeTruthy();
  expect(app.getByText('Pure Pattu Butta')).toBeTruthy();
  expect(app.getByText('Refund waiting')).toBeTruthy();
  expect(app.getByText('Payment taken')).toBeTruthy();
  await settle(() => fireEvent.press(app.getByText('Open the order')));
  expect(router.getPathname()).toBe('/orders/order/o1');
});

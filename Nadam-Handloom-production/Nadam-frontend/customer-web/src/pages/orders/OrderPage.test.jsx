// The order page: right after paying (W6 6.6 A) and every ending (paid, confirming, refunded);
// any later visit (W7 7.3 A: status, progress, tracking, invoice, Buy again, help, Pay while
// still held); checkouts that ended unpaid; not found. The server and Razorpay's window are
// stand-ins.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({ order: vi.fn(), payAgain: vi.fn(), verifyPayment: vi.fn(), cancelCheckout: vi.fn(), bag: vi.fn(), bagCheck: vi.fn(), invoice: vi.fn(), buyAgain: vi.fn() }));
const auth = vi.hoisted(() => {
  const state = { status: 'signedIn', customer: { fullName: 'Priya Sharma' } };
  return { authStore: { get: () => state, subscribe: () => () => {} } };
});
const cfg = vi.hoisted(() => {
  const state = { status: 'ready', config: { gst: { ratePercent: 5, shopState: 'Andhra Pradesh', igstOtherStates: false }, store: { whatsapp: '917382968566' } } };
  return { configStore: { get: () => state, subscribe: () => () => {} } };
});
const rzp = vi.hoisted(() => ({ load: vi.fn(), open: vi.fn() }));
vi.mock('../../api/shop.js', () => ({ shopApi: api }));
vi.mock('../../auth/session.js', () => ({ authStore: auth.authStore }));
vi.mock('../../config/config.js', () => ({ configStore: cfg.configStore }));
vi.mock('../../payments/razorpay.js', async (orig) => ({ ...(await orig()), loadRazorpay: rzp.load, openRazorpay: rzp.open }));

const { default: OrderPage } = await import('./OrderPage.jsx');
const { ToastProvider } = await import('../../components/Toasts.jsx');

const ADDRESS = { fullName: 'Priya Sharma', mobile: '9876543210', line1: 'Flat 302', line2: null, landmark: 'water tank', city: 'Hyderabad', state: 'Telangana', pincode: '500034' };
const LINES = [{ slug: 'one', sku: 'NH-ONE', name: 'Pure Pattu Butta', photo: null, price: 5800, quantity: 1, lineTotal: 5800 }];
const order = (over = {}) => ({
  number: 'NH12345678', status: 'paid', placedAt: '2026-10-17T10:50:00.000Z', total: 5800, pieces: 1, lines: LINES, address: ADDRESS, holdUntil: null, canPay: false,
  payment: { method: 'upi', methodText: 'UPI', paidAt: '2026-10-17T11:05:00.000Z' }, refund: null, cancelled: null, invoice: { number: 'INV-000123', ready: true, cancelled: false },
  shipping: null, canBuyAgain: true, oldWebsite: false, ...over,
});
const SHIPPED = { status: 'shipped', carrier: 'DTDC', trackingNumber: 'D7348812905', shippedAt: '2026-10-18T09:30:00.000Z', deliveredAt: null, trackingUrl: 'https://www.dtdc.com/track-your-shipment/' };

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
function renderAt(url, state) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: url, state }]}>
        <Routes>
          <Route path="/order/:number" element={<OrderPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  rzp.load.mockReset().mockResolvedValue(function Razorpay() {});
  rzp.open.mockReset();
  api.bag.mockResolvedValue({ items: [], totals: {}, changes: {} });
});

describe('the order page', () => {
  it('just paid: thank you, the order number, what happens next, the sarees, the address and how it was paid', async () => {
    api.order.mockResolvedValue({ order: order() });
    renderAt('/order/NH12345678', { paid: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Thank you, Priya' })).toBeInTheDocument();
    expect(screen.getByText(/is confirmed and paid: ₹5,800 by UPI/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'What happens next' })).toHaveTextContent('Paid4:35 pm, 17 October 2026');
    expect(screen.getByText('Pure Pattu Butta')).toBeInTheDocument();
    expect(screen.getByText('Flat 302, Near water tank, Hyderabad, Telangana 500034')).toBeInTheDocument();
    expect(screen.getByText(/Paid ₹5,800 by UPI \(Razorpay\)/)).toBeInTheDocument();
    expect(screen.getByText(/GST invoice INV-000123/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download it' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/account/orders');
    expect(document.title).toBe('Order confirmed · Nandam Handlooms');
  });

  it('just paid but our server hasn\'t confirmed yet: "confirming", then paid when asked again', async () => {
    api.order.mockResolvedValueOnce({ order: order({ status: 'awaiting_payment', payment: null, holdUntil: new Date(Date.now() + 600_000).toISOString(), canPay: true }) })
      .mockResolvedValue({ order: order() });
    const user = userEvent.setup();
    renderAt('/order/NH12345678', { paid: true });
    expect(await screen.findByRole('heading', { name: 'Payment received, confirming with your bank' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Thank you, Priya' })).toBeInTheDocument();
  });

  it('still being paid for (from My orders): waiting for payment, the hold, Pay (a fresh payment request), Change my bag', async () => {
    api.order.mockResolvedValue({ order: order({ status: 'awaiting_payment', payment: null, invoice: null, holdUntil: '2099-01-01T11:05:00.000Z', canPay: true, canBuyAgain: false }) });
    api.payAgain.mockResolvedValue({ order: order({ status: 'awaiting_payment' }), razorpay: { keyId: 'rzp_test_x', orderId: 'order_NEW' } });
    api.cancelCheckout.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt('/order/NH12345678');
    expect(await screen.findByRole('heading', { level: 1, name: 'Order NH12345678' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Waiting for paymentYour sarees are held for you until 4:35 pm\. Nothing was charged yet\./);
    expect(screen.queryByRole('button', { name: /Buy again/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download invoice/ })).not.toBeInTheDocument();
    expect(screen.getByText('Not paid yet. Nothing was charged.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pay ₹5,800' }));
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    expect(api.payAgain).toHaveBeenCalledWith('NH12345678');
    expect(rzp.open.mock.calls[0][1]).toMatchObject({ orderId: 'order_NEW' });
    rzp.open.mock.calls[0][2].closed();
    await user.click(screen.getByRole('button', { name: 'Change my bag' }));
    expect(await screen.findByText('/bag')).toBeInTheDocument();
  });

  it('the 15 minutes over: nothing charged, check the bag again', async () => {
    api.order.mockResolvedValue({ order: order({ status: 'hold_ended', payment: null, invoice: null }) });
    renderAt('/order/NH12345678');
    expect(await screen.findByRole('heading', { name: 'The 15 minutes are over' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check my bag again' })).toHaveAttribute('href', '/checkout');
  });

  it('just paid after a saree sold: refunded in full, and why', async () => {
    api.order.mockResolvedValue({ order: order({ status: 'refunded', payment: null, invoice: null, refund: { amount: 5800, status: 'processed', reason: 'Paid after the sarees were sold' } }) });
    renderAt('/order/NH12345678', { paid: true });
    expect(await screen.findByRole('heading', { name: 'We couldn\'t keep your order' })).toBeInTheDocument();
    expect(screen.getByText(/arrived after the 15 minutes/)).toBeInTheDocument();
    expect(screen.getByText('Your ₹5,800 is being refunded')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ask us for a similar saree/ })).toHaveAttribute('href', expect.stringContaining('NH12345678'));
  });

  it('cancelled, and an order that isn\'t ours or doesn\'t exist', async () => {
    api.order.mockResolvedValueOnce({ order: order({ status: 'cancelled', payment: null }) });
    const { unmount } = renderAt('/order/NH12345678');
    expect(await screen.findByRole('heading', { name: 'This checkout was cancelled' })).toBeInTheDocument();
    unmount();
    api.order.mockRejectedValueOnce(Object.assign(new Error('We couldn\'t find this order.'), { code: 'ORDER_NOT_FOUND', status: 404 }));
    renderAt('/order/NH87654321');
    expect(await screen.findByRole('heading', { name: 'We couldn\'t find this order' })).toBeInTheDocument();
    renderAt('/order/not-a-number');
    expect(api.order).toHaveBeenCalledTimes(2);
  });

  it('later (from My orders): the order\'s own page: its status, the progress, Download invoice, Buy again, help; cancelling on WhatsApp', async () => {
    api.order.mockResolvedValue({ order: order() });
    renderAt('/order/NH12345678');
    expect(await screen.findByRole('heading', { level: 1, name: 'Order NH12345678' })).toBeInTheDocument();
    expect(document.title).toBe('Order NH12345678 · Nandam Handlooms');
    expect(screen.getByText('Being packed')).toBeInTheDocument();
    expect(screen.getByText(/Placed 17 Oct 2026, 4:20 pm · 1 piece/)).toBeInTheDocument();
    const steps = document.querySelector('.otrack');
    expect(steps.querySelectorAll('li.done')).toHaveLength(1);
    expect(steps.querySelector('li[aria-current="step"]')).toHaveTextContent('PackedWithin 2 working days');
    expect(screen.getByRole('button', { name: 'Download invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Help on WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('NH12345678'));
    expect(screen.getByRole('link', { name: 'WhatsApp us' })).toHaveAttribute('href', expect.stringContaining('cancel%20or%20change%20my%20order%20NH12345678'));
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument(); // 7.10: to discuss
    expect(screen.getByText('The address saved with this order.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/account/orders');
  });

  it('shipped: three steps done, the tracking card (Copy, Track on DTDC); delivered: every step and the date', async () => {
    api.order.mockResolvedValueOnce({ order: order({ status: 'shipped', shipping: SHIPPED }) });
    const user = userEvent.setup(); // gives the page a stand-in clipboard
    const { unmount } = renderAt('/order/NH12345678');
    expect(await screen.findByText('Shipped 18 Oct 2026 · DTDC tracking number')).toBeInTheDocument();
    expect(document.querySelectorAll('.otrack li.done')).toHaveLength(3);
    expect(screen.getByText('D7348812905')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Track on DTDC/ })).toHaveAttribute('href', 'https://www.dtdc.com/track-your-shipment/');
    expect(screen.getByRole('link', { name: /Track on DTDC/ })).toHaveAttribute('target', '_blank');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe('D7348812905');
    expect(await screen.findByText('Tracking number D7348812905 copied')).toBeInTheDocument();
    expect(screen.queryByText(/Need to cancel or change/)).not.toBeInTheDocument();
    unmount();
    api.order.mockResolvedValueOnce({ order: order({ status: 'delivered', shipping: { ...SHIPPED, status: 'delivered', deliveredAt: '2026-10-21T06:00:00.000Z' } }) });
    renderAt('/order/NH12345678');
    expect(await screen.findByText('Delivered 21 Oct 2026 · DTDC tracking number')).toBeInTheDocument();
    expect(document.querySelectorAll('.otrack li.done')).toHaveLength(4);
    expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0);
  });

  it('Download invoice: the PDF through our server; "being made" says so', async () => {
    api.order.mockResolvedValue({ order: order() });
    api.invoice.mockResolvedValueOnce({ blob: new Blob(['%PDF-1.4']), filename: 'INV-000123.pdf' })
      .mockRejectedValueOnce(Object.assign(new Error('Your invoice is being made. Check back in a few minutes.'), { code: 'INVOICE_NOT_READY', status: 409 }));
    URL.createObjectURL = vi.fn(() => 'blob:invoice');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    renderAt('/order/NH12345678');
    await user.click(await screen.findByRole('button', { name: 'Download invoice' }));
    expect(api.invoice).toHaveBeenCalledWith('NH12345678');
    expect(click).toHaveBeenCalled();
    expect(click.mock.contexts[0].download).toBe('INV-000123.pdf');
    expect(await screen.findByText('Invoice INV-000123 downloaded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download invoice' }));
    expect(await screen.findByText('Your invoice is being made. Check back in a few minutes.')).toBeInTheDocument();
    click.mockRestore();
  });

  it('the invoice not made yet: no download button, "being made"', async () => {
    api.order.mockResolvedValue({ order: order({ invoice: { number: null, ready: false, cancelled: false } }) });
    renderAt('/order/NH12345678');
    expect(await screen.findByText(/Your GST invoice is being made/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download invoice' })).not.toBeInTheDocument();
  });

  it('Buy again: the sarees go to the bag, and it says which sold since (with a WhatsApp ask)', async () => {
    api.order.mockResolvedValue({ order: order() });
    api.buyAgain.mockResolvedValue({ items: [], totals: { pieces: 1, amount: 2700 }, changes: {}, buyAgain: { added: [{ slug: 'one', name: 'Plain', quantity: 1, fewer: false }], raised: [], already: [], skipped: [{ slug: 'two', name: 'Pure Pattu Butta', reason: 'sold_out' }] } });
    const user = userEvent.setup();
    renderAt('/order/NH12345678');
    await user.click(await screen.findByRole('button', { name: 'Buy again' }));
    expect(api.buyAgain).toHaveBeenCalledWith('NH12345678');
    expect(await screen.findByText('1 saree added to your bag. Pure Pattu Butta has sold since.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask on WhatsApp' })).toBeInTheDocument();
  });

  it('cancelled by the shop after paying: refund on its way, never "nothing was charged"; then refunded on a date', async () => {
    api.order.mockResolvedValueOnce({ order: order({ status: 'cancelled_paid', cancelled: { at: '2026-10-18T05:00:00.000Z', refundedAt: null }, invoice: { number: 'INV-000123', ready: true, cancelled: true } }) });
    const { unmount } = renderAt('/order/NH12345678');
    expect(await screen.findByText('Cancelled by the shop: ₹5,800 is being refunded')).toBeInTheDocument();
    expect(screen.getByText('Cancelled · refund on its way')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing was charged/)).not.toBeInTheDocument();
    expect(screen.getByText(/stamped CANCELLED/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /Where your order is/ })).not.toBeInTheDocument();
    unmount();
    api.order.mockResolvedValueOnce({ order: order({ status: 'cancelled_paid', cancelled: { at: '2026-10-18T05:00:00.000Z', refundedAt: '2026-10-19T05:00:00.000Z' } }) });
    renderAt('/order/NH12345678');
    expect(await screen.findByText('Cancelled by the shop: your ₹5,800 was refunded')).toBeInTheDocument();
    expect(screen.getByText(/Refunded on 19 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText('Cancelled · refunded')).toBeInTheDocument();
  });

  it('refunded, opened later: the order\'s page with why and how much; an old website order says so', async () => {
    api.order.mockResolvedValueOnce({ order: order({ status: 'refunded', payment: null, invoice: null, refund: { amount: 5800, status: 'pending', reason: 'Paid after the sarees were sold' } }) });
    const { unmount } = renderAt('/order/NH12345678');
    expect(await screen.findByRole('heading', { level: 1, name: 'Order NH12345678' })).toBeInTheDocument();
    expect(screen.getByText('Your ₹5,800 is being refunded')).toBeInTheDocument();
    expect(screen.getByText(/Paid after the sarees were sold\. It goes back/)).toBeInTheDocument();
    unmount();
    api.order.mockResolvedValueOnce({ order: order({ status: 'delivered', oldWebsite: true, payment: { method: null, methodText: 'Online', paidAt: '2026-09-23T12:16:00.000Z' }, shipping: { ...SHIPPED, status: 'delivered', deliveredAt: '2026-09-29T08:00:00.000Z' } }) });
    renderAt('/order/NH12345678');
    expect(await screen.findByText(/on our old website/)).toBeInTheDocument();
  });

  it('not found offers My orders', async () => {
    api.order.mockRejectedValueOnce(Object.assign(new Error('We couldn\'t find this order.'), { code: 'ORDER_NOT_FOUND', status: 404 }));
    renderAt('/order/NH87654321');
    expect(await screen.findByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/account/orders');
  });

  it('paid from this page (still being paid for): the confirming window goes, the order is asked again and shows paid', async () => {
    api.order.mockResolvedValueOnce({ order: order({ status: 'awaiting_payment', payment: null, invoice: null, holdUntil: '2099-01-01T11:05:00.000Z', canPay: true, canBuyAgain: false }) })
      .mockResolvedValue({ order: order() });
    api.payAgain.mockResolvedValue({ order: order({ status: 'awaiting_payment', payment: null, invoice: null, holdUntil: '2099-01-01T11:20:00.000Z', canPay: true }), razorpay: { keyId: 'rzp_test_x', orderId: 'order_NEW' } });
    api.verifyPayment.mockResolvedValue({ order: order() });
    const user = userEvent.setup();
    renderAt('/order/NH12345678');
    await user.click(await screen.findByRole('button', { name: 'Pay ₹5,800' }));
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    expect(screen.getByText(/held for you until/)).toHaveTextContent('4:50 pm'); // the renewed hold
    rzp.open.mock.calls[0][2].paid({ razorpay_order_id: 'order_NEW', razorpay_payment_id: 'pay_X', razorpay_signature: 'a'.repeat(64) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Thank you, Priya' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.verifyPayment).toHaveBeenCalledWith('NH12345678', expect.objectContaining({ razorpay_payment_id: 'pay_X' }));
  });

  it('confirming with the bank: a failed ask (briefly offline) doesn\'t stop the checking', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api.order.mockResolvedValueOnce({ order: order({ status: 'confirming', payment: null, invoice: null }) })
        .mockRejectedValueOnce(Object.assign(new Error('You seem to be offline.'), { code: 'OFFLINE' }))
        .mockResolvedValue({ order: order() });
      renderAt('/order/NH12345678', { paid: true });
      expect(await screen.findByRole('heading', { name: 'Payment received, confirming with your bank' })).toBeInTheDocument();
      // The ask after 4 s fails; the page asks again 4 s after that anyway.
      for (let i = 0; i < 12 && api.order.mock.calls.length < 3; i += 1) await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(api.order).toHaveBeenCalledTimes(3);
      expect(await screen.findByRole('heading', { level: 1, name: 'Thank you, Priya' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});


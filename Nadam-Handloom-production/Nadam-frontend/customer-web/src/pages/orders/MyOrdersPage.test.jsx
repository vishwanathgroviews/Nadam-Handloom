// My orders (W7): the list (cards with what's next), loading, couldn't load (never "No orders
// yet"), no orders, Show more, Buy again from a card; and My account's latest order.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({ myOrders: vi.fn(), buyAgain: vi.fn(), invoice: vi.fn(), addresses: vi.fn() }));
const auth = vi.hoisted(() => {
  const state = { status: 'signedIn', customer: { id: 'c-1', fullName: 'Priya Sharma', mobile: '9876543210', email: 'priya@example.com' } };
  return { state, authStore: { get: () => state, subscribe: () => () => {} } };
});
const cfg = vi.hoisted(() => {
  const state = { status: 'ready', config: { gst: { ratePercent: 5 }, store: { whatsapp: '917382968566' } } };
  return { configStore: { get: () => state, subscribe: () => () => {} } };
});
vi.mock('../../api/shop.js', () => ({ shopApi: api }));
vi.mock('../../auth/session.js', () => ({ authStore: auth.authStore }));
vi.mock('../../config/config.js', () => ({ configStore: cfg.configStore }));

const { default: MyOrdersPage } = await import('./MyOrdersPage.jsx');
const { default: OverviewPage } = await import('../account/OverviewPage.jsx');
const { ToastProvider } = await import('../../components/Toasts.jsx');

let n = 0;
const row = (over = {}) => ({
  number: `NH${String(48213097 + (n += 1)).padStart(8, '0')}`, status: 'paid', placedAt: '2026-10-17T04:42:00.000Z', total: 11200, pieces: 3, sarees: 2,
  title: 'Pure Pattu 350k Butta Saree', photos: ['https://example.test/a.jpg', 'https://example.test/b.jpg'], more: 0, holdUntil: null,
  paidAt: '2026-10-17T04:44:00.000Z', methodText: 'UPI', refund: null, cancelled: null, shipping: null, invoice: { number: 'INV-000123', ready: true, cancelled: false },
  canBuyAgain: true, oldWebsite: false, ...over,
});
const SHIPPED = { status: 'shipped', carrier: 'DTDC', trackingNumber: 'D7348812905', shippedAt: '2026-10-15T10:35:00.000Z', deliveredAt: null, trackingUrl: 'https://www.dtdc.com/track-your-shipment/' };

function renderPage(page = <MyOrdersPage />) {
  return render(<ToastProvider><MemoryRouter>{page}</MemoryRouter></ToastProvider>);
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  auth.state.customer = { ...auth.state.customer, id: `c-${Math.random()}` }; // a fresh cache entry
  api.addresses.mockResolvedValue({ addresses: [] });
});

describe('My orders', () => {
  it('every order as a card: number, date, status, photos, what happens next, the amount, and its buttons', async () => {
    const packing = row();
    const shipped = row({ status: 'shipped', shipping: SHIPPED, total: 2600, pieces: 1, sarees: 1, title: 'Scallop Border Hand painted Saree', methodText: 'Card' });
    api.myOrders.mockResolvedValue({ orders: [packing, shipped], nextOffset: null });
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: `Order ${packing.number}` })).toBeInTheDocument();
    expect(screen.getByText('2 orders · newest first')).toBeInTheDocument();
    const [a, b] = document.querySelectorAll('.ocard');
    expect(a).toHaveTextContent('17 Oct 2026, 10:12 am');
    expect(a).toHaveTextContent('Being packed');
    expect(a).toHaveTextContent('Pure Pattu 350k Butta Saree and 1 more');
    expect(a).toHaveTextContent('3 pieces · UPI');
    expect(a).toHaveTextContent('₹11,200Paid');
    expect(a).toHaveTextContent('Paid 17 Oct. We pack within 2 working days.');
    expect(a.querySelectorAll('.oc-photos img')).toHaveLength(2);
    expect(screen.getByRole('link', { name: `View order ${packing.number}` })).toHaveAttribute('href', `/order/${packing.number}`);
    expect(screen.getByRole('button', { name: `Download the invoice of order ${packing.number}` })).toBeInTheDocument();
    expect(b).toHaveTextContent('Shipped 15 Oct · DTDC D7348812905');
    expect(screen.getByRole('link', { name: `Track order ${shipped.number}` })).toHaveAttribute('href', `/order/${shipped.number}#tracking`);
    expect(screen.getByText('That\'s all 2 orders.')).toBeInTheDocument();
    expect(screen.getByText(/A checkout you didn.t finish isn.t an order/)).toBeInTheDocument();
  });

  it('a checkout still held: Pay now, the time it is held until, no invoice or Buy again; refunded and cancelled say so', async () => {
    const held = row({ status: 'awaiting_payment', holdUntil: '2099-01-01T05:53:00.000Z', paidAt: null, methodText: null, invoice: null, canBuyAgain: false });
    const refunded = row({ status: 'refunded', refund: { amount: 4800, status: 'pending' }, total: 4800, invoice: null, methodText: null });
    const cancelled = row({ status: 'cancelled_paid', cancelled: { at: '2026-10-18T05:00:00.000Z', refundedAt: null } });
    api.myOrders.mockResolvedValue({ orders: [held, refunded, cancelled], nextOffset: null });
    renderPage();
    await screen.findByRole('heading', { level: 2, name: `Order ${held.number}` });
    const [h, r, c] = document.querySelectorAll('.ocard');
    expect(h).toHaveTextContent('Waiting for payment');
    expect(h).toHaveTextContent('Held for you until 11:23 am. Pay to confirm it.');
    expect(h).toHaveTextContent('To pay');
    expect(h.querySelector('a.btn-primary')).toHaveTextContent('Pay now');
    expect(h.querySelector('button')).toBeNull();
    expect(r).toHaveTextContent('₹4,800 is being refunded to your account (5 to 7 working days)');
    expect(r).toHaveTextContent('Being refunded');
    expect(c).toHaveTextContent('Cancelled · refund on its way');
    expect(c).toHaveTextContent('Cancelled by the shop. ₹11,200 is being refunded.');
    expect(c.textContent).not.toMatch(/Invoice/); // the invoice is on the order's page, stamped
  });

  it('loading, then couldn\'t load: "Try again" (never "No orders yet"); then no orders yet', async () => {
    let fail;
    api.myOrders.mockReturnValueOnce(new Promise((_, rej) => { fail = rej; }));
    renderPage();
    expect(screen.getByLabelText('Loading your orders')).toBeInTheDocument();
    fail(Object.assign(new Error('You seem to be offline.'), { code: 'OFFLINE' }));
    expect(await screen.findByText('Your orders didn\'t load')).toBeInTheDocument();
    expect(screen.queryByText('No orders yet')).not.toBeInTheDocument();
    api.myOrders.mockResolvedValue({ orders: [], nextOffset: null });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New in' })).toHaveAttribute('href', '/shop?sort=new');
  });

  it('20 at a time: Show more brings the next ones, and the focus goes to the first of them', async () => {
    const first = Array.from({ length: 20 }, () => row());
    const next = row({ title: 'Kanchi Border Triple Check Saree' });
    api.myOrders.mockImplementation((offset) => Promise.resolve(offset ? { orders: [next], nextOffset: null } : { orders: first, nextOffset: 20 }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { level: 2, name: `Order ${first[0].number}` });
    expect(screen.getByText('20 most recent orders · newest first')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('heading', { level: 2, name: `Order ${next.number}` })).toBeInTheDocument();
    expect(api.myOrders).toHaveBeenCalledWith(20);
    expect(document.querySelectorAll('.ocard')).toHaveLength(21);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: `View order ${next.number}` })));
    expect(screen.getByText('That\'s all 21 orders.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('Buy again from a card: added, and what has sold since', async () => {
    const o = row();
    api.myOrders.mockResolvedValue({ orders: [o], nextOffset: null });
    api.buyAgain.mockResolvedValue({ items: [], totals: {}, changes: {}, buyAgain: { added: [{ slug: 'a', name: 'A', quantity: 1, fewer: false }, { slug: 'b', name: 'B', quantity: 2, fewer: true }], raised: [], already: [], skipped: [{ slug: 'c', name: 'C', reason: 'unavailable' }] } });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: `Buy order ${o.number} again` }));
    expect(await screen.findByText('2 sarees added to your bag. One has fewer pieces left: added as many as there are. C is no longer on the website.')).toBeInTheDocument();
  });

  it('an order from the old website is marked', async () => {
    api.myOrders.mockResolvedValue({ orders: [row({ status: 'delivered', oldWebsite: true, methodText: 'Online', shipping: { ...SHIPPED, status: 'delivered', deliveredAt: '2026-09-29T08:00:00.000Z' } })], nextOffset: null });
    renderPage();
    expect(await screen.findByText('Our old website')).toBeInTheDocument();
    expect(document.querySelector('.ocard')).toHaveTextContent('Delivered 29 Sept');
  });
});

describe('My account: the latest order', () => {
  it('the newest order, what happens next and a link to all orders', async () => {
    const held = row({ status: 'awaiting_payment', holdUntil: '2099-01-01T05:53:00.000Z', invoice: null, canBuyAgain: false });
    api.myOrders.mockResolvedValue({ orders: [held, row()], nextOffset: null });
    renderPage(<OverviewPage />);
    expect(await screen.findByRole('heading', { name: 'Your latest order' })).toBeInTheDocument();
    expect(screen.getByText(`${held.number}`)).toBeInTheDocument();
    expect(screen.getByText('Held for you until 11:23 am. Pay to confirm it.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute('href', `/order/${held.number}`);
    expect(screen.getByRole('link', { name: 'All my orders (2 orders)' })).toHaveAttribute('href', '/account/orders');
    expect(screen.getByRole('link', { name: /My orders/ })).toHaveAttribute('href', '/account/orders');
  });

  it('no orders yet: no latest order, the My orders tile stays', async () => {
    api.myOrders.mockResolvedValue({ orders: [], nextOffset: null });
    renderPage(<OverviewPage />);
    await waitFor(() => expect(api.myOrders).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Your latest order' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My orders/ })).toBeInTheDocument();
  });
});

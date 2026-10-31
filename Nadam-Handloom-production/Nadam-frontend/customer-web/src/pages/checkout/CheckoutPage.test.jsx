// The checkout page (W6): sign-in first, the address step, Pay, Razorpay's window and every
// way it can end. The server, the sign-in, the settings and Razorpay's window are stand-ins.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({
  addresses: vi.fn(), addAddress: vi.fn(), updateAddress: vi.fn(), pincode: vi.fn(), bag: vi.fn(), bagCheck: vi.fn(), bagMerge: vi.fn(),
  checkout: vi.fn(), order: vi.fn(), payAgain: vi.fn(), verifyPayment: vi.fn(), cancelCheckout: vi.fn(),
}));
const auth = vi.hoisted(() => {
  let state = { status: 'signedIn', customer: { fullName: 'Priya Sharma', mobile: '9876543210' } };
  const subs = new Set();
  return {
    authStore: { get: () => state, subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); } },
    set(patch) { state = { ...state, ...patch }; subs.forEach((fn) => fn()); },
    reset() { state = { status: 'signedIn', customer: { fullName: 'Priya Sharma', mobile: '9876543210' } }; },
  };
});
const cfg = vi.hoisted(() => {
  const base = { status: 'ready', error: null, config: { payments: { enabled: true, holdMinutes: 15, mode: 'test' }, gst: { ratePercent: 5, shopState: 'Andhra Pradesh', igstOtherStates: false }, store: { whatsapp: '917382968566', addressLines: [], hours: '' }, shop: { name: 'Nandam Handlooms', mobile: '9494170180' }, states: ['Andhra Pradesh', 'Telangana'] } };
  let state = base;
  return {
    configStore: { get: () => state, subscribe: () => () => {} },
    set(config) { state = { ...base, config: { ...base.config, ...config } }; },
    reset() { state = base; },
  };
});
const rzp = vi.hoisted(() => ({ load: vi.fn(), open: vi.fn() }));
vi.mock('../../api/shop.js', () => ({ shopApi: api }));
vi.mock('../../auth/session.js', () => ({ authStore: auth.authStore }));
vi.mock('../../config/config.js', () => ({ configStore: cfg.configStore }));
vi.mock('../../payments/razorpay.js', async (orig) => ({ ...(await orig()), loadRazorpay: rzp.load, openRazorpay: rzp.open }));

const store = await import('../../bag/store.js');
const { default: CheckoutPage } = await import('./CheckoutPage.jsx');

const line = (slug, price, quantity = 1, extra = {}) => ({ slug, sku: `NH-${slug.toUpperCase()}`, name: `Pattu ${slug}`, photo: null, price, priceWas: null, available: quantity, asked: quantity, quantity, lineTotal: price * quantity, state: 'ok', ...extra });
const bagOf = (items) => ({ items, totals: {}, changes: {}, maxLines: 20, checkedAt: new Date().toISOString() });
const HOME = { id: 'a1', label: 'home', fullName: 'Priya Sharma', mobile: '9876543210', line1: 'Flat 302, Sri Sai Residency', line2: 'Road No. 12', landmark: 'water tank', city: 'Hyderabad', state: 'Telangana', pincode: '500034', isDefault: true, problem: null };
const OLD = { id: 'a2', label: 'other', fullName: 'Priya', mobile: '9876543210', line1: 'Main road', line2: '', landmark: '', city: 'Mangalagiri', state: 'Ap', pincode: '522503', isDefault: false, problem: { field: 'state', message: 'Choose the state.' } };
const until = (ms = 15 * 60_000) => new Date(Date.now() + ms).toISOString();
const orderOf = (over = {}) => ({ number: 'NH12345678', status: 'awaiting_payment', total: 8500, pieces: 2, lines: [], address: HOME, holdUntil: until(), canPay: true, payment: null, refund: null, invoice: null, shipping: null, ...over });
const REQUEST = { keyId: 'rzp_test_x', mode: 'test', orderId: 'order_ABC', amount: 850000, currency: 'INR', name: 'Nandam Handlooms', description: 'Order NH12345678', prefill: {}, notes: {}, timeoutSeconds: 880 };

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.state?.paid ? ' (paid)' : ''}</p>; }
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
const payButton = () => screen.getAllByRole('button', { name: /^Pay ₹/ })[0];
async function toReview(user) {
  await screen.findByText('Flat 302, Sri Sai Residency, Road No. 12, Near water tank, Hyderabad, Telangana 500034');
  await user.click(screen.getByRole('button', { name: 'Deliver here' }));
  await screen.findByText('Pattu one');
  await waitFor(() => expect(payButton()).toBeEnabled());
}

let windowOn;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  auth.reset();
  cfg.reset();
  store.resetBagForTests();
  Object.values(api).forEach((f) => f.mockReset());
  rzp.load.mockReset().mockResolvedValue(function Razorpay() {});
  rzp.open.mockReset().mockImplementation((_R, _rz, on) => { windowOn = on; });
  api.addresses.mockResolvedValue({ addresses: [HOME], max: 10 });
  api.bag.mockResolvedValue(bagOf([line('one', 5800), line('two', 2700)]));
  api.checkout.mockResolvedValue({ order: orderOf(), razorpay: REQUEST });
  api.cancelCheckout.mockResolvedValue({ order: orderOf({ status: 'cancelled' }) });
  api.pincode.mockResolvedValue({ pincode: '522503', area: 'Mangalagiri', city: 'Guntur', state: 'Andhra Pradesh' });
  store.startBag();
});

describe('before the address', () => {
  it('a visitor is asked to sign in and comes straight back', async () => {
    auth.set({ status: 'signedOut', customer: null });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Sign in to check out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in?next=%2Fcheckout');
  });

  it('payments switched off: WhatsApp, as before', async () => {
    cfg.set({ payments: { enabled: false } });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Online payment isn\'t open yet' })).toBeInTheDocument();
  });

  it('an empty bag', async () => {
    api.bag.mockResolvedValue(bagOf([]));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Your bag is empty' })).toBeInTheDocument();
  });

  it('no saved address: the form opens at once; saving it delivers there', async () => {
    api.addresses.mockResolvedValue({ addresses: [], max: 10 });
    api.addAddress.mockResolvedValue({ address: HOME, addresses: [HOME], max: 10 });
    api.pincode.mockResolvedValue({ pincode: '500034', area: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'New address' });
    await user.type(screen.getByLabelText('House, flat, building'), 'Flat 302, Sri Sai Residency');
    await user.type(screen.getByLabelText('Pincode'), '500034');
    await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('Hyderabad'));
    await user.click(screen.getByRole('button', { name: 'Save and deliver here' }));
    await screen.findByText('Pattu one');
    expect(api.addAddress.mock.calls[0][0]).toMatchObject({ fullName: 'Priya Sharma', mobile: '9876543210', line1: 'Flat 302, Sri Sai Residency', pincode: '500034', state: 'Telangana' });
  });

  it('an address from the old website must be checked first', async () => {
    api.addresses.mockResolvedValue({ addresses: [HOME, OLD], max: 10 });
    api.updateAddress.mockResolvedValue({ address: { ...OLD, state: 'Andhra Pradesh', problem: null }, addresses: [HOME, { ...OLD, state: 'Andhra Pradesh', problem: null }], max: 10 });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Needs checking before use');
    await user.click(screen.getByRole('radio', { name: /Main road/ }));
    await user.click(screen.getByRole('button', { name: 'Deliver here' }));
    expect(await screen.findByText('Please check this address')).toBeInTheDocument();
    expect(screen.getByText('Choose the state.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('State'), 'Andhra Pradesh');
    await user.click(screen.getByRole('button', { name: 'Save and deliver here' }));
    await screen.findByText('Pattu one');
    expect(api.updateAddress).toHaveBeenCalledWith('a2', expect.objectContaining({ state: 'Andhra Pradesh' }));
  });
});

describe('Pay', () => {
  it('sends what the page shows, opens Razorpay, and after paying our server checks it before the order page', async () => {
    api.verifyPayment.mockResolvedValue({ order: orderOf({ status: 'paid' }) });
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    expect(screen.getByText('Includes GST 5% (₹405): CGST 2.5% + SGST 2.5%')).toBeInTheDocument();
    expect(payButton()).toHaveTextContent('Pay ₹8,500');
    await user.click(payButton());
    expect(api.checkout).toHaveBeenCalledWith('a1', { amount: 8500, lines: [{ slug: 'one', quantity: 1, price: 5800 }, { slug: 'two', quantity: 1, price: 2700 }] });
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    expect(rzp.open.mock.calls[0][1]).toEqual(REQUEST);
    expect(await screen.findByText(/held for you until/)).toBeInTheDocument();
    const bagCalls = api.bag.mock.calls.length;
    windowOn.paid({ razorpayOrderId: 'order_ABC', razorpayPaymentId: 'pay_1', razorpaySignature: 'a'.repeat(64) });
    expect(await screen.findByText('/order/NH12345678 (paid)')).toBeInTheDocument();
    expect(api.verifyPayment).toHaveBeenCalledWith('NH12345678', { razorpayOrderId: 'order_ABC', razorpayPaymentId: 'pay_1', razorpaySignature: 'a'.repeat(64) });
    expect(api.bag.mock.calls.length).toBeGreaterThan(bagCalls); // the bought sarees leave the bag
  });

  it('our server can\'t be reached after paying: it tries again, then the order page keeps checking', async () => {
    const down = Object.assign(new Error('We couldn\'t reach Nandam Handlooms.'), { code: 'NETWORK', status: 0 });
    api.verifyPayment.mockRejectedValueOnce(down).mockResolvedValueOnce({ order: orderOf({ status: 'paid' }) });
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    windowOn.paid({ razorpayOrderId: 'order_ABC', razorpayPaymentId: 'pay_1', razorpaySignature: 'b'.repeat(64) });
    expect(await screen.findByRole('heading', { name: 'Confirming your payment' })).toBeInTheDocument();
    expect(await screen.findByText('/order/NH12345678 (paid)', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(api.verifyPayment).toHaveBeenCalledTimes(2);
  });

  it('the window closed without paying: the hold, Pay now (the same order, renewed)', async () => {
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    windowOn.closed();
    const note = await screen.findByRole('alert');
    expect(within(note).getByText('Payment not completed')).toBeInTheDocument();
    expect(note).toHaveTextContent(/Your sarees are held for you until \d{1,2}:\d{2} [ap]m/);
    await user.click(within(note).getByRole('button', { name: 'Pay now' }));
    expect(api.checkout).toHaveBeenCalledTimes(2);
  });

  it('a payment that failed, then the window closed: "Nothing was taken", Try again', async () => {
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    windowOn.failed('Your bank declined the payment');
    windowOn.closed();
    expect(await screen.findByText('Payment didn\'t go through. Nothing was taken.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('"Change my bag" ends the checkout and goes to the bag', async () => {
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    windowOn.closed();
    await user.click(await screen.findByRole('button', { name: 'Change my bag' }));
    expect(await screen.findByText('/bag')).toBeInTheDocument();
    expect(api.cancelCheckout).toHaveBeenCalledWith('NH12345678');
  });

  it('something changed before Pay: nothing charged, the bag as it is now', async () => {
    const err = Object.assign(new Error('Something in your bag changed just now.'), { code: 'BAG_CHANGED', status: 409, details: { bag: bagOf([line('one', 6100, 1, { priceWas: 5800 }), line('two', 2700)]) } });
    api.checkout.mockRejectedValueOnce(err);
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    expect(await screen.findByText('Something changed before you paid')).toBeInTheDocument();
    expect(rzp.open).not.toHaveBeenCalled();
    await waitFor(() => expect(payButton()).toHaveTextContent('Pay ₹8,800'));
    expect(screen.getByText('price changed from ₹5,800')).toBeInTheDocument();
  });

  it('Razorpay\'s script didn\'t load: say so, nothing charged, Try again', async () => {
    rzp.load.mockRejectedValue(Object.assign(new Error('x'), { code: 'RAZORPAY_NOT_LOADED' }));
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    expect(await screen.findByText('The payment window didn\'t open')).toBeInTheDocument();
  });

  it('the 15 minutes end while the page is open: the server says so (Razorpay\'s window closes itself)', async () => {
    api.checkout.mockResolvedValue({ order: orderOf({ holdUntil: until(300) }), razorpay: REQUEST });
    api.order.mockResolvedValue({ order: orderOf({ status: 'hold_ended', holdUntil: null }) });
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    windowOn.closed();
    expect(await screen.findByText('The 15 minutes are over', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check my bag again' })).toBeInTheDocument();
    expect(api.order).toHaveBeenCalledWith('NH12345678');
  });

  it('the phone\'s clock is fast: its own timer never says the 15 minutes are over while the server still holds the sarees', async () => {
    api.checkout.mockResolvedValue({ order: orderOf({ holdUntil: until(-60_000) }), razorpay: REQUEST });
    api.order.mockResolvedValue({ order: orderOf({ holdUntil: until(600_000) }) });
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    windowOn.closed();
    await waitFor(() => expect(api.order).toHaveBeenCalled());
    await new Promise((r) => { setTimeout(r, 300); });
    expect(screen.queryByText('The 15 minutes are over')).not.toBeInTheDocument();
    expect(screen.getAllByText(/held for you until/).length).toBeGreaterThan(0);
  });

  it('paid in a UPI app while this page waited: it says so, and never offers Pay for it again', async () => {
    api.checkout.mockResolvedValue({ order: orderOf({ holdUntil: until(1000) }), razorpay: REQUEST });
    api.order.mockResolvedValue({ order: orderOf({ status: 'paid', holdUntil: null }) });
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    await waitFor(() => expect(rzp.open).toHaveBeenCalled());
    windowOn.closed();
    expect(await screen.findByText('Your payment for order NH12345678 went through', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('Pay refused because the bag emptied, as the open checkout was paid meanwhile: "went through", not "something changed"', async () => {
    sessionStorage.setItem('nh-checkout', 'NH12345678');
    api.order.mockResolvedValueOnce({ order: orderOf() }).mockResolvedValue({ order: orderOf({ status: 'paid', holdUntil: null }) });
    api.checkout.mockRejectedValueOnce(Object.assign(new Error('Your bag has nothing that can be bought now.'), { code: 'BAG_EMPTY', status: 409, details: { bag: bagOf([]) } }));
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    expect(await screen.findByText('Your payment for order NH12345678 went through')).toBeInTheDocument();
    expect(screen.queryByText('Something changed before you paid')).not.toBeInTheDocument();
  });

  it('above the payment limit: said before Pay, Pay off, WhatsApp offered', async () => {
    cfg.set({ payments: { enabled: true, holdMinutes: 15, mode: 'test', maxAmount: 5000 } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Flat 302, Sri Sai Residency, Road No. 12, Near water tank, Hyderabad, Telangana 500034');
    await user.click(screen.getByRole('button', { name: 'Deliver here' }));
    expect(await screen.findByText(/Orders above ₹5,000 can't be paid online in one go/)).toBeInTheDocument();
    expect(payButton()).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Order on WhatsApp' }).length).toBeGreaterThan(0);
  });

  it('the server says the order is too large (Razorpay\'s own limit): its message, WhatsApp', async () => {
    api.checkout.mockRejectedValueOnce(Object.assign(new Error('Orders above ₹5,00,000 can\'t be paid online in one go. Please order on WhatsApp and we\'ll help you pay.'), { code: 'ORDER_TOO_LARGE', status: 409 }));
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    expect(await screen.findByText('This order is too large to pay online in one go')).toBeInTheDocument();
    expect(rzp.open).not.toHaveBeenCalled();
  });

  it('our server couldn\'t open the payment: its message, nothing charged', async () => {
    api.checkout.mockRejectedValueOnce(Object.assign(new Error('We couldn\'t open the payment just now.'), { code: 'PAYMENTS_UNAVAILABLE', status: 503 }));
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    expect(await screen.findByText('Payment didn\'t start')).toBeInTheDocument();
    expect(screen.getByText(/We couldn't open the payment just now\. Nothing was charged\./)).toBeInTheDocument();
  });

  it('a checkout from earlier in this tab that was paid meanwhile (Razorpay\'s notice): said once, and checkout goes on', async () => {
    sessionStorage.setItem('nh-checkout', 'NH12345678');
    api.order.mockResolvedValue({ order: orderOf({ status: 'paid' }) });
    renderPage();
    expect(await screen.findByText('Your payment for order NH12345678 went through')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the order' })).toHaveAttribute('href', '/order/NH12345678');
    expect(sessionStorage.getItem('nh-checkout')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Deliver here' })).toBeInTheDocument();
  });

  it('a checkout from earlier in this tab still held: its hold shows', async () => {
    sessionStorage.setItem('nh-checkout', 'NH12345678');
    api.order.mockResolvedValue({ order: orderOf() });
    renderPage();
    expect(await screen.findByText(/held for you until/)).toBeInTheDocument();
  });

  it('while payments are tried on the live website: a listed customer checks out; anyone else is sent to WhatsApp', async () => {
    cfg.set({ payments: { enabled: true, testersOnly: true, holdMinutes: 15, mode: 'test' } });
    auth.set({ customer: { fullName: 'Priya Sharma', mobile: '9876543210', payOnline: false } });
    const { unmount } = renderPage();
    expect(await screen.findByRole('heading', { name: 'Online payment isn\'t open yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send bag on WhatsApp/ })).toBeInTheDocument();
    expect(api.checkout).not.toHaveBeenCalled();
    unmount();
    auth.set({ customer: { fullName: 'Priya Sharma', mobile: '9876543210', payOnline: true } });
    renderPage();
    await screen.findByText('Flat 302, Sri Sai Residency, Road No. 12, Near water tank, Hyderabad, Telangana 500034');
    expect(screen.queryByText('Online payment isn\'t open yet')).not.toBeInTheDocument();
  });

  it('while payments are tried: a visitor is asked to sign in first (the server then says)', async () => {
    cfg.set({ payments: { enabled: true, testersOnly: true, holdMinutes: 15, mode: 'test' } });
    auth.set({ status: 'signedOut', customer: null });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Sign in to check out' })).toBeInTheDocument();
  });

  it('Pay finds the order paid a moment ago in another tab: "went through", no second payment', async () => {
    api.checkout.mockRejectedValueOnce(Object.assign(new Error('This order is already paid.'), { code: 'ORDER_PAID', status: 409, details: { order: orderOf({ status: 'paid', holdUntil: null }) } }));
    const user = userEvent.setup();
    renderPage();
    await toReview(user);
    await user.click(payButton());
    expect(await screen.findByText('Your payment for order NH12345678 went through')).toBeInTheDocument();
    expect(rzp.open).not.toHaveBeenCalled();
  });
});


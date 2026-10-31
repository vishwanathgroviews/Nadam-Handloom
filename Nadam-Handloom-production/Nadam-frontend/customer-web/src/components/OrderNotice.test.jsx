// "Your order … is confirmed" across the website (W6): for a payment the page missed.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ myOrders: vi.fn() }));
const auth = vi.hoisted(() => {
  let state = { status: 'signedIn', customer: { id: 'c1' } };
  return { authStore: { get: () => state, subscribe: () => () => {} }, set: (s) => { state = s; } };
});
vi.mock('../api/shop.js', () => ({ shopApi: api }));
vi.mock('../auth/session.js', () => ({ authStore: auth.authStore }));

let OrderNotice;
const { markSeen, isSeen, newsOf } = await import('../orders/seen.js');

const recent = (over = {}) => ({ number: 'NH12345678', status: 'paid', total: 12400, pieces: 2, placedAt: new Date().toISOString(), refund: null, ...over });
const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="*" element={<OrderNotice />} /></Routes>
  </MemoryRouter>,
);

beforeEach(async () => {
  vi.resetModules();
  OrderNotice = (await import('./OrderNotice.jsx')).default;
  localStorage.clear();
  api.myOrders.mockReset();
  auth.set({ status: 'signedIn', customer: { id: 'c1' } });
});

describe('the order news', () => {
  it('a payment the page missed: "confirmed", once; See the order or close marks it seen', async () => {
    api.myOrders.mockResolvedValue({ orders: [recent()] });
    const user = userEvent.setup();
    const { unmount } = renderAt('/shop');
    expect(await screen.findByText(/is confirmed and paid: ₹12,400/)).toHaveTextContent('Your order NH12345678 is confirmed and paid: ₹12,400.');
    expect(screen.getByRole('link', { name: 'See the order' })).toHaveAttribute('href', '/order/NH12345678');
    await user.click(screen.getByRole('button', { name: 'Close this message' }));
    expect(screen.queryByText(/is confirmed/)).toBeNull();
    expect(isSeen('NH12345678', 'paid')).toBe(true);
    unmount();
    renderAt('/');
    expect(screen.queryByText(/is confirmed/)).toBeNull(); // seen (the reply is reused for a minute)
  });

  it('being confirmed, then confirmed: told both times; refunded says so', () => {
    const now = Date.now();
    expect(newsOf([recent({ status: 'confirming' })], now).status).toBe('confirming');
    markSeen('NH12345678', 'confirming');
    expect(newsOf([recent({ status: 'confirming' })], now)).toBeNull();
    expect(newsOf([recent({ status: 'paid' })], now).status).toBe('paid');
    expect(newsOf([recent({ status: 'awaiting_payment' })], now)).toBeNull();
    expect(newsOf([recent({ placedAt: new Date(now - 4 * 86400_000).toISOString() })], now)).toBeNull(); // older than 3 days
  });

  it('refunded', async () => {
    api.myOrders.mockResolvedValue({ orders: [recent({ status: 'refunded', refund: { amount: 5800 } })] });
    renderAt('/');
    expect(await screen.findByText(/couldn't be kept/)).toHaveTextContent('Order NH12345678 couldn\'t be kept: your ₹5,800 is being refunded.');
  });

  it('not on the checkout or the order page; nothing asked when signed out', async () => {
    api.myOrders.mockResolvedValue({ orders: [recent()] });
    renderAt('/checkout');
    await waitFor(() => expect(api.myOrders).toHaveBeenCalled());
    expect(screen.queryByText(/is confirmed/)).toBeNull();
    auth.set({ status: 'signedOut', customer: null });
    api.myOrders.mockClear();
    renderAt('/shop');
    expect(api.myOrders).not.toHaveBeenCalled();
  });
});

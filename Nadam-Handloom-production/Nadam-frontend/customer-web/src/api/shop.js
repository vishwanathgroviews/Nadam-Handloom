// Every /api/v2/shop call the website makes (W1 onwards), in one place.
import { request, send } from './client.js';

const enc = encodeURIComponent;

export const shopApi = {
  config: (opts) => request('GET', '/config', opts),
  home: (opts) => request('GET', '/home', opts),
  catalog: (opts) => request('GET', '/catalog', opts),
  products: (query, opts) => request('GET', `/products?${query}`, opts),
  product: (slug, opts) => request('GET', `/products/${enc(slug)}`, opts),
  pincode: (pin, opts) => request('GET', `/pincodes/${enc(pin)}`, opts),

  // The bag (W5): a visitor's bag is checked, a signed-in customer's is kept in the account
  bagCheck: (items, opts) => request('POST', '/bag/check', { ...opts, body: { items } }),
  bag: () => request('GET', '/me/bag', { auth: true }),
  bagSet: (slug, quantity, priceSeen) => request('PUT', `/me/bag/items/${enc(slug)}`, { auth: true, body: { quantity, ...(priceSeen != null ? { priceSeen } : {}) } }),
  bagRemove: (slug) => request('DELETE', `/me/bag/items/${enc(slug)}`, { auth: true }),
  bagMerge: (items) => request('POST', '/me/bag/merge', { auth: true, body: { items } }),
  bagClear: () => request('DELETE', '/me/bag', { auth: true }),

  // Checkout and payment (W6): the order is made from the account's bag; `expect` is what the
  // page showed (total and lines), so nothing different is ever charged.
  checkout: (addressId, expect) => request('POST', '/checkout', { auth: true, body: { addressId, expect } }),
  // My orders (W7): 20 at a time; the invoice comes through our server; Buy again answers the bag.
  myOrders: (offset = 0, opts) => request('GET', `/orders${offset ? `?offset=${offset}` : ''}`, { ...opts, auth: true }),
  order: (number, opts) => request('GET', `/orders/${enc(number)}`, { ...opts, auth: true }),
  invoice: (number) => request('GET', `/orders/${enc(number)}/invoice`, { auth: true, as: 'file', timeoutMs: 60000 }),
  buyAgain: (number) => request('POST', `/orders/${enc(number)}/buy-again`, { auth: true }),
  payAgain: (number) => request('POST', `/orders/${enc(number)}/pay`, { auth: true }),
  verifyPayment: (number, receipt) => request('POST', `/orders/${enc(number)}/verify`, { auth: true, body: receipt, timeoutMs: 30000 }),
  cancelCheckout: (number) => request('POST', `/orders/${enc(number)}/cancel`, { auth: true }),

  // Sign in
  sendCode: (mobile, trap) => request('POST', '/auth/code', { body: { mobile, ...(trap ? { trap } : {}) } }),
  verifyCode: (mobile, code) => request('POST', '/auth/verify', { body: { mobile, code } }),
  complete: (body) => request('POST', '/auth/complete', { body }),
  refresh: () => send('POST', '/auth/refresh', { body: {} }),
  logout: (pushToken) => send('POST', '/auth/logout', { body: pushToken ? { pushToken } : {} }),
  logoutAll: () => request('POST', '/auth/logout-all', { auth: true }),

  // My account
  me: () => request('GET', '/me', { auth: true }),
  updateMe: (patch) => request('PATCH', '/me', { auth: true, body: patch }),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return request('POST', '/me/avatar', { auth: true, form, timeoutMs: 60000 });
  },
  removeAvatar: () => request('DELETE', '/me/avatar', { auth: true }),
  mobileCode: (mobile) => request('POST', '/me/mobile/code', { auth: true, body: { mobile } }),
  mobileVerify: (mobile, code) => request('POST', '/me/mobile/verify', { auth: true, body: { mobile, code } }),
  sessions: () => request('GET', '/me/sessions', { auth: true }),
  signOutSession: (id) => request('DELETE', `/me/sessions/${enc(id)}`, { auth: true }),
  addresses: () => request('GET', '/me/addresses', { auth: true }),
  addAddress: (body) => request('POST', '/me/addresses', { auth: true, body }),
  updateAddress: (id, body) => request('PATCH', `/me/addresses/${enc(id)}`, { auth: true, body }),
  removeAddress: (id) => request('DELETE', `/me/addresses/${enc(id)}`, { auth: true }),
  defaultAddress: (id) => request('POST', `/me/addresses/${enc(id)}/default`, { auth: true }),
  requestDeletion: (reason) => request('POST', '/me/delete-request', { auth: true, body: reason ? { reason } : {} }),
  cancelDeletion: () => request('DELETE', '/me/delete-request', { auth: true }),

  // Notifications
  pushSubscribe: (token, topics) => request('POST', '/push/subscribe', { auth: 'optional', body: { token, ...(topics ? { topics } : {}) } }),
  pushUnsubscribe: (token) => request('DELETE', '/push/subscribe', { auth: 'optional', body: { token } }),
  pushStatus: (token) => request('POST', '/push/status', { auth: 'optional', body: { token } }),
  pushTopics: (token, topics) => request('PATCH', '/push/preferences', { auth: 'optional', body: { token, topics } }),
  pushTest: (token) => request('POST', '/push/test', { auth: true, body: { token } }),
};

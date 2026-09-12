// VITE_API_URL is a build-time env var (Vite inlines it at build, not
// runtime) — set it in the deployment environment for staging/production
// when the API lives on a different origin than the frontend.
//
// Left unset (the dev default), this resolves to a *relative* '/api/v1' —
// same-origin against whatever host loaded the page. In dev that's Vite's
// own dev server, which proxies '/api' to the backend (see vite.config.js).
// That's deliberate: a hardcoded 'http://localhost:4000' only works when the
// browser and backend are the same machine — opening the site from a phone
// on the LAN (its "localhost" is the phone itself) would otherwise silently
// fail every API call. Routing through the page's own origin instead means
// only the dev server's address needs to be reachable; Vite's proxy (running
// on the dev machine) still talks to the backend over real localhost.
const configuredApiUrl = import.meta.env.VITE_API_URL;
const API_URL = configuredApiUrl ? `${configuredApiUrl.replace(/\/$/, '')}/api/v1` : '/api/v1';

// Access token lives in memory only (never localStorage) — the refresh token
// is an HttpOnly cookie the browser sends automatically via credentials:'include'.
let accessToken = null;
let refreshPromise = null;

const request = async (path, { method = 'GET', body, skipAuth = false } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (!skipAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong');
    error.status = response.status;
    error.code = data.code;
    error.details = data.details;
    throw error;
  }

  return data;
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = request('/auth/refresh', { method: 'POST', skipAuth: true })
      .then((res) => {
        accessToken = res.data.tokens.accessToken;
        return accessToken;
      })
      .catch((err) => {
        accessToken = null;
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Wraps `request` with one automatic silent-refresh-and-retry on a 401.
const authedRequest = async (path, options = {}) => {
  try {
    return await request(path, options);
  } catch (err) {
    if (err.status === 401) {
      await refreshAccessToken();
      return request(path, options);
    }
    throw err;
  }
};

export const api = {
  // 1. REGISTER (backend auto-sends the signup-verification OTP)
  registerUser: async (userData) => {
    await request('/auth/customer/register', {
      method: 'POST',
      skipAuth: true,
      body: {
        firstName: userData.first_name,
        lastName: userData.last_name,
        phone: userData.phone,
        state: userData.state,
        pincode: userData.pincode,
      },
    });
    return { phone: userData.phone };
  },

  // 2. OTP (sent via SMS to the registered mobile number) — verifying the
  // signup code returns a short-lived setupToken used to set the MPIN next.
  sendOtp: async (phone) => request('/auth/customer/otp/resend', { method: 'POST', skipAuth: true, body: { phone } }),

  verifyOtp: async (phone, code) => {
    const res = await request('/auth/customer/otp/verify', { method: 'POST', skipAuth: true, body: { phone, code } });
    return res.data;
  },

  // 3. MPIN SETUP (completes registration, logs the customer in)
  setupMpin: async (setupToken, mpin) => {
    const res = await request('/auth/customer/mpin/setup', {
      method: 'POST',
      skipAuth: true,
      body: { setupToken, mpin, confirmMpin: mpin, platform: 'web' },
    });
    accessToken = res.data.tokens.accessToken;
    return res.data.user;
  },

  // 4. LOGIN (phone + MPIN, every time after setup)
  loginUser: async (phone, mpin) => {
    try {
      const res = await request('/auth/customer/login', {
        method: 'POST',
        skipAuth: true,
        body: { phone, mpin, platform: 'web' },
      });
      accessToken = res.data.tokens.accessToken;
      return { requiresVerification: false, user: res.data.user };
    } catch (err) {
      if (err.code === 'ACCOUNT_NOT_VERIFIED') {
        return { requiresVerification: true, user: { phone: err.details?.phone || phone } };
      }
      throw err;
    }
  },

  // 5. FORGOT MPIN (OTP sent via SMS to the registered mobile number)
  requestMpinReset: async (phone) =>
    request('/auth/customer/mpin/forgot', { method: 'POST', skipAuth: true, body: { phone } }),

  resetMpin: async (phone, code, newMpin) =>
    request('/auth/customer/mpin/reset', { method: 'POST', skipAuth: true, body: { phone, code, newMpin, confirmNewMpin: newMpin } }),

  // 5. PROFILE
  getCurrentUser: async () => {
    try {
      const res = await authedRequest('/user/profile');
      return res.data;
    } catch {
      return null;
    }
  },

  updateUserProfile: async (_userId, profileData) => {
    const res = await authedRequest('/user/profile', {
      method: 'PUT',
      body: {
        firstName: profileData.first_name ?? profileData.firstName,
        lastName: profileData.last_name ?? profileData.lastName,
        displayName: profileData.display_name ?? profileData.displayName,
        avatarUrl: profileData.avatar_url ?? profileData.avatarUrl,
        preferences: profileData.preferences,
      },
    });
    return res.data;
  },

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST', skipAuth: true });
    } catch {
      // best-effort — clear the local token regardless of network outcome
    }
    accessToken = null;
  },

  isAuthenticated: () => accessToken !== null,

  // Silently restores a session from the httpOnly refresh cookie on app load
  // (e.g. after a page reload), without forcing the user through login again.
  bootstrapSession: async () => {
    if (accessToken) return true;
    try {
      await refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  },

  // 6. CATALOG (public, no auth required)
  getCategories: async () => {
    const res = await request('/catalog/categories', { skipAuth: true });
    return res.data;
  },

  getSubcategories: async (categorySlug) => {
    const res = await request(`/catalog/categories/${encodeURIComponent(categorySlug)}/subcategories`, { skipAuth: true });
    return res.data;
  },

  getProducts: async (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    const res = await request(`/catalog/products?${qs.toString()}`, { skipAuth: true });
    return res.data;
  },

  // Live stock for what's in the cart. The cart is localStorage and can be
  // days old, so nothing in it can be trusted about availability.
  getAvailability: async (productIds) =>
    (await request('/catalog/availability', { method: 'POST', skipAuth: true, body: { productIds } })).data,

  getProductBySlug: async (slug) => {
    const res = await request(`/catalog/products/${slug}`, { skipAuth: true });
    return res.data;
  },

  // 7. ADDRESSES (auth required)
  getAddresses: async () => (await authedRequest('/addresses')).data,
  createAddress: async (payload) => (await authedRequest('/addresses', { method: 'POST', body: payload })).data,
  updateAddress: async (id, payload) => (await authedRequest(`/addresses/${id}`, { method: 'PATCH', body: payload })).data,
  deleteAddress: async (id) => (await authedRequest(`/addresses/${id}`, { method: 'DELETE' })).data,

  // 8. CHECKOUT / ORDERS / PAYMENT (auth required)
  checkout: async (payload) => (await authedRequest('/orders/checkout', { method: 'POST', body: payload })).data,

  verifyPayment: async (orderId, payload) =>
    (await authedRequest(`/orders/${orderId}/verify-payment`, { method: 'POST', body: payload })).data,

  getOrders: async ({ page = 1, pageSize = 10 } = {}) => {
    const res = await authedRequest(`/orders?page=${page}&pageSize=${pageSize}`);
    return res.data;
  },

  getOrder: async (orderId) => (await authedRequest(`/orders/${orderId}`)).data,

  getOrderTracking: async (orderId) => (await authedRequest(`/orders/${orderId}/tracking`)).data,

  // Generated a few seconds after payment (async, once the order.paid event
  // dispatches) — callers should expect a 404 for a moment right after
  // checkout and treat it as "not ready yet", not an error.
  getOrderInvoice: async (orderId) => (await authedRequest(`/orders/${orderId}/invoice`)).data,
};

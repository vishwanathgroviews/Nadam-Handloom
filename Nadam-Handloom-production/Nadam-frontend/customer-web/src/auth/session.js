// The customer's sign-in on this browser (W1, web-01 section 8).
// - The 30-day sign-in lives in an HttpOnly cookie the page can't read; the short key
//   (15 minutes) lives in memory and is renewed before it runs out.
// - One renewal at a time, even with several tabs open (Web Locks), so tabs never race.
// - Tabs keep in step: signing out in one tab signs out the others.
// - A small "was signed in" note in localStorage avoids asking the server on every visit.
import { accessKey, setRenewer, on } from '../api/client.js';
import { shopApi } from '../api/shop.js';
import { SESSION_ENDED } from '../api/errors.js';
import { readPushToken } from '../push/token.js';

const HINT = 'nh-shop-signed-in';
const LOCK = 'nh-shop-renew';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nh-shop-auth') : null;

// status: unknown (checking) | signedIn | signedOut. bootError: the server couldn't be reached.
let state = { status: 'unknown', customer: null, sessionExpiresAt: null, ended: null, bootError: null };
const subscribers = new Set();
function set(patch) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}
export const authStore = {
  subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  get: () => state,
};

const hint = {
  get() { try { return localStorage.getItem(HINT) === '1'; } catch { return false; } },
  set(on) { try { if (on) localStorage.setItem(HINT, '1'); else localStorage.removeItem(HINT); } catch { /* private mode */ } },
};
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

let timer = null;
function scheduleRenewal(expiresInSeconds) {
  clearTimeout(timer);
  // A minute before the key runs out (at least 5 seconds from now).
  const ms = Math.max(5000, (expiresInSeconds - 60) * 1000);
  timer = setTimeout(() => {
    if (document.visibilityState === 'visible') renew().catch(() => {});
  }, ms);
}

// A signed-in reply from verify, complete or refresh.
function apply(reply) {
  accessKey.set(reply.accessToken, reply.accessTokenExpiresIn);
  hint.set(true);
  set({ status: 'signedIn', customer: reply.customer, sessionExpiresAt: reply.sessionExpiresAt, ended: null, bootError: null });
  scheduleRenewal(reply.accessTokenExpiresIn);
}

// The sign-in is over on this browser. err: why (shown once), or null for a plain sign-out.
function end(err) {
  clearTimeout(timer);
  accessKey.clear();
  hint.set(false);
  set({ status: 'signedOut', customer: null, sessionExpiresAt: null, bootError: null, ended: err ? { code: err.code, message: err.message, at: Date.now() } : null });
}

async function renewOnce() {
  try {
    apply(await shopApi.refresh());
    return true;
  } catch (err) {
    if (err.code === 'REFRESH_RACE') {
      // Another tab renewed a moment ago: the browser now holds the newest cookie.
      await wait(400);
      apply(await shopApi.refresh());
      return true;
    }
    throw err;
  }
}

let renewing = null;
async function doRenew() {
  try {
    return navigator.locks?.request ? await navigator.locks.request(LOCK, renewOnce) : await renewOnce();
  } catch (err) {
    if (err.status === 401) {
      // NOT_SIGNED_IN just means a visitor; anything else ended a real sign-in.
      end(err.code === 'NOT_SIGNED_IN' ? null : err);
      return false;
    }
    throw err; // offline or server trouble: keep the sign-in, try again later
  }
}

// Renews the short key. Resolves true when renewed, false when not signed in.
export function renew() {
  if (!hint.get() && state.status !== 'signedIn') return Promise.resolve(false);
  renewing ??= doRenew().finally(() => { renewing = null; });
  return renewing;
}
setRenewer(renew);

// On page load: signed in from an earlier visit?
export async function bootstrap() {
  if (!hint.get()) {
    set({ status: 'signedOut' });
    return;
  }
  for (const delay of [0, 1000, 3000]) {
    if (delay) await wait(delay);
    try {
      await renew();
      return;
    } catch (err) {
      set({ bootError: err });
    }
  }
}
export const retryBootstrap = () => { set({ bootError: null }); return bootstrap(); };

export function signedIn(reply) {
  apply(reply);
  channel?.postMessage({ type: 'signed-in' });
  relinkPush();
}

// This browser has notifications on (from an earlier sign-in, maybe someone else's that lapsed or
// whose sign-out didn't reach us): its order updates now belong to the customer signed in here.
function relinkPush() {
  const token = readPushToken();
  if (!token || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  shopApi.pushSubscribe(token).catch(() => { /* the Notifications page links it again */ });
}

export const updateCustomer = (customer) => set({ customer });

// "Sign out": always ends here, even if the server can't be reached. leave() runs just
// before the sign-in ends here, so the page can move on first (e.g. to the home page)
// instead of being sent to sign in by the account pages.
export async function signOut(leave) {
  try {
    await shopApi.logout(readPushToken());
  } catch {
    // The cookie stays until it expires; the next visit simply shows signed out.
  }
  leave?.();
  end(null);
  channel?.postMessage({ type: 'signed-out' });
}

// "Sign out of all devices": the server must confirm it (an error is thrown otherwise).
export async function signOutEverywhere(leave) {
  await shopApi.logoutAll();
  leave?.();
  end(null);
  channel?.postMessage({ type: 'signed-out' });
}

export const clearEnded = () => set({ ended: null });

/* ---------- Keeping tabs and the server in step ---------- */
on('sessionEnded', (err) => {
  if (state.status === 'signedIn' && SESSION_ENDED.has(err.code)) {
    end(err);
    channel?.postMessage({ type: 'signed-out' });
  }
});

if (channel) {
  channel.onmessage = (e) => {
    if (e.data?.type === 'signed-out' && state.status === 'signedIn') end(null);
    if (e.data?.type === 'signed-in' && state.status !== 'signedIn') renew().catch(() => {});
  };
}

if (typeof window !== 'undefined') {
  // Browsers without BroadcastChannel: the note in localStorage changes.
  window.addEventListener('storage', (e) => {
    if (e.key !== HINT || channel) return;
    if (e.newValue === null && state.status === 'signedIn') end(null);
    if (e.newValue === '1' && state.status !== 'signedIn') renew().catch(() => {});
  });
  // Back to a tab after a while: renew a key that ran out while it slept.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.status === 'signedIn' && !accessKey.fresh(60000)) renew().catch(() => {});
  });
}

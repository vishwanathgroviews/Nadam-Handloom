// This browser's Firebase notification token, remembered so "Sign out" can unlink it and
// the notifications page can show its state. Not a secret: it only lets us send to this browser.
const KEY = 'nh-push-token';

export function readPushToken() {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}
export function savePushToken(token) {
  try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}

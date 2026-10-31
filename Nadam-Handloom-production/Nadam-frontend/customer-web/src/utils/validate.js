// The same field rules as the server (Nadam-backend/src/validators/shop/common.js), checked
// before sending so mistakes show at once. The server checks again; its word is final.

export function cleanMobile(input) {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
export const isMobile = (m) => /^[6-9]\d{9}$/.test(m);
export const mobileError = (input) => (isMobile(cleanMobile(input)) ? null : 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.');

export const squash = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

export function nameError(v) {
  const s = squash(v);
  if (s.length < 2) return 'Enter your full name.';
  if (s.length > 60) return 'Use 60 characters or fewer.';
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(s)) return 'Use letters only (spaces, dots and hyphens are fine).';
  return null;
}

export function emailError(v) {
  const s = String(v ?? '').trim();
  if (!s) return 'Enter your email address.';
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'Enter a valid email address, like name@example.com.';
  return null;
}

export const isPincode = (v) => /^[1-9]\d{5}$/.test(String(v ?? ''));
export const pincodeError = (v) => (isPincode(v) ? null : 'Enter a valid 6-digit pincode.');

export function cityError(v) {
  const s = squash(v);
  if (s.length < 2 || s.length > 60) return 'Enter your city or town.';
  if (!/^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'()-]*$/u.test(s)) return 'Use letters only for the city.';
  return null;
}

const ageOn = (iso, today = new Date()) => {
  const [y, m, d] = iso.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
};
const realDate = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const dt = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso;
};
export function dobError(v) {
  if (!v) return null;
  if (!realDate(v)) return 'Use a valid date.';
  const a = ageOn(v);
  return a >= 13 && a <= 110 ? null : 'Enter your real date of birth (you must be 13 or older).';
}
export function anniversaryError(v) {
  if (!v) return null;
  if (!realDate(v)) return 'Use a valid date.';
  if (v < '1940-01-01' || new Date(`${v}T00:00:00Z`) > new Date()) return 'The anniversary can\'t be in the future.';
  return null;
}

// Where to go after signing in: only paths on this website (no open redirects).
export function safeNext(next, fallback = '/account') {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (next.startsWith('/sign-in')) return fallback;
  return next;
}

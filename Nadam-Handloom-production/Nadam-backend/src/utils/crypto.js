import crypto from 'node:crypto';

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

// URL-safe random token, e.g. refresh tokens and challenge nonces.
export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');

// Six random digits for the console (test) SMS provider.
export const randomCode = (length = 6) => String(crypto.randomInt(0, 10 ** length)).padStart(length, '0');

export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

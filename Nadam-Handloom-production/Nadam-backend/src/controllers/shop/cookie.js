// The website's 30-day sign-in cookie: HttpOnly (page scripts can't read it), SameSite=Lax,
// Secure in production, and sent only to /api/v2/shop/auth (renew and sign out).
import { env } from '../../config/env.js';
import { readCookies } from '../../utils/cookies.js';

export const COOKIE = 'nh_shop_session';
const PATH = '/api/v2/shop/auth';
const base = () => ({ httpOnly: true, secure: env.shop.cookieSecure, sameSite: 'lax', path: PATH });

export const readSignInCookie = (req) => readCookies(req)[COOKIE] || null;

export function setSignInCookie(res, token, expiresAt) {
  res.cookie(COOKIE, token, { ...base(), expires: expiresAt });
}

export function clearSignInCookie(res) {
  res.clearCookie(COOKIE, base());
}

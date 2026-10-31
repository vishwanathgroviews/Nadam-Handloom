// Website (W1) request guards for /api/v2/shop:
// - CORS: only the shop's own website addresses (SHOP_WEB_ORIGINS) may call from a browser,
//   with cookies. Other sites get no CORS headers, so browsers block them.
// - Calls that use the 30-day cookie (renew, sign out) also need the X-Requested-With
//   header (other sites can't send it without CORS) and, when the browser says where the
//   request came from, an allowed Origin: protection against cross-site requests.
// - Replies are never cached by browsers or proxies unless a route says otherwise.
// - The website switch (Settings → Maintenance → Website) pauses everything but /config.
import { env } from '../config/env.js';
import { websiteMaintenance } from '../services/settings.service.js';
import { forbidden, unavailable } from '../utils/errors.js';

const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With';
export const CLIENT_HEADER = 'nandam-web';

export function shopCors(req, res, next) {
  const origin = req.get('origin');
  if (origin && env.shop.origins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Expose-Headers', 'Retry-After, X-Request-Id');
  }
  res.vary('Origin');
  if (req.method === 'OPTIONS') {
    if (origin && env.shop.origins.includes(origin)) {
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.set('Access-Control-Max-Age', '600');
    }
    return res.status(204).end();
  }
  res.set('Cache-Control', 'no-store');
  req.ctx.platform = 'web';
  req.ctx.deviceId = null;
  return next();
}

export function requireSameSite(req, _res, next) {
  const origin = req.get('origin');
  if (origin && !env.shop.origins.includes(origin)) return next(forbidden('ORIGIN_NOT_ALLOWED', 'This request did not come from the Nandam Handlooms website.'));
  if (req.get('x-requested-with') !== CLIENT_HEADER) return next(forbidden('CLIENT_HEADER_MISSING', 'This request did not come from the Nandam Handlooms website.'));
  return next();
}

export async function websiteOpen(_req, _res, next) {
  try {
    const m = await websiteMaintenance();
    if (m.on) return next(unavailable('MAINTENANCE', m.message || 'The website is being updated. Please check back soon.', { message: m.message }));
    return next();
  } catch (err) {
    return next(err);
  }
}

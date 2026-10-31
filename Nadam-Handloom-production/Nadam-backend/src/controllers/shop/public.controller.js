// Website pages anyone can use: settings, pincode lookup, notifications.
import * as config from '../../services/shop/config.service.js';
import * as place from '../../services/shop/place.service.js';
import * as pushes from '../../services/shop/push.service.js';
import { env } from '../../config/env.js';

const send = (fn, status = 200, cache = null) => async (req, res, next) => {
  try {
    const out = await fn(req.valid || {}, req);
    if (cache) res.set('Cache-Control', cache);
    if (status === 204) return res.status(204).end();
    return res.status(status).json(out);
  } catch (err) {
    return next(err);
  }
};

const account = (req) => req.customer?.account ?? null;
// The website's own address for links in notifications (the first allowed one).
const siteUrl = () => env.shop.origins[0] || null;

export const getConfig = send(() => config.websiteConfig(), 200, 'public, max-age=60');
export const lookupPincode = send((v) => place.lookup(v.pincode), 200, 'public, max-age=86400');

export const subscribe = send((v, req) => pushes.subscribe({ account: account(req), token: v.token, topics: v.topics, ctx: req.ctx }));
export const unsubscribe = send(async (v, req) => { await pushes.unsubscribe({ account: account(req), token: v.token, ctx: req.ctx }); }, 204);
export const pushStatus = send((v, req) => pushes.status({ account: account(req), token: v.token }));
export const setTopics = send((v, req) => pushes.setTopics({ account: account(req), token: v.token, topics: v.topics, ctx: req.ctx }));
export const sendTest = send((v, req) => pushes.sendTest({ account: req.customer.account, token: v.token, siteUrl: siteUrl(), ctx: req.ctx }));

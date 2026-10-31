// /api/v2/shop: the new website (W1 onwards). Customers only: owners and staff use the
// admin app (/api/v2/auth, /api/v2/me ...). See docs/modules/web-01-sign-in.md section 9.
import { Router } from 'express';
import { z } from 'zod';
import * as auth from '../../controllers/shop/auth.controller.js';
import * as me from '../../controllers/shop/me.controller.js';
import * as pub from '../../controllers/shop/public.controller.js';
import * as shopCat from '../../controllers/shop/catalog.controller.js';
import * as bag from '../../controllers/shop/bag.controller.js';
import * as co from '../../controllers/shop/checkout.controller.js';
import * as page from '../../controllers/shop/page.controller.js';
import * as vc from '../../validators/shop/catalog.validators.js';
import * as va from '../../validators/shop/auth.validators.js';
import * as vm from '../../validators/shop/me.validators.js';
import * as vp from '../../validators/shop/push.validators.js';
import * as vb from '../../validators/shop/bag.validators.js';
import * as vco from '../../validators/shop/checkout.validators.js';
import { uuidParam, pincode } from '../../validators/shop/common.js';
import { validate } from '../../middlewares/validate.js';
import { rateLimit } from '../../middlewares/rateLimit.js';
import { shopCors, requireSameSite, websiteOpen } from '../../middlewares/shopGuard.js';
import { authenticateCustomer, optionalCustomer } from '../../middlewares/authenticateCustomer.js';
import { avatarUpload } from '../../middlewares/avatarUpload.js';

const r = Router();
r.use(shopCors);

// Before the website switch: the website must learn it is switched off.
r.get('/config', pub.getConfig);
// A saree page with its own link preview (nginx sends /product/<slug> here). Before the switch
// too: when the website is off, the page itself shows that.
r.get('/pages/product/:slug', rateLimit({ name: 'shop-page', max: 240 }), page.product);
r.use(websiteOpen);

/* ---------- Sign in ---------- */
const a = Router();
a.use(rateLimit({ name: 'shop-auth' }));
a.post('/code', validate(va.codeBody), auth.requestCode);
a.post('/verify', validate(va.verifyBody), auth.verifyCode);
a.post('/complete', validate(va.completeBody), auth.complete);
a.post('/refresh', requireSameSite, auth.refresh);
a.post('/logout', requireSameSite, validate(va.logoutBody), auth.logout);
a.post('/logout-all', authenticateCustomer, auth.logoutAll);
r.use('/auth', a);

/* ---------- Shop: home, catalogue, lists, saree pages (W2–W4) ---------- */
const browse = rateLimit({ name: 'shop-browse', max: 240 });
r.get('/home', browse, shopCat.home);
r.get('/catalog', browse, shopCat.catalog);
r.get('/products', browse, validate(vc.listQuery, 'query'), shopCat.list);
r.get('/products/:slug', browse, validate(vc.slugParam, 'params'), shopCat.product);

/* ---------- The bag (W5): a visitor's bag is checked, never kept ---------- */
const bagLimit = rateLimit({ name: 'shop-bag', max: 120 });
r.post('/bag/check', bagLimit, validate(vb.itemsBody), bag.check);

/* ---------- Pincodes ---------- */
r.get('/pincodes/:pincode', rateLimit({ name: 'shop-pincode' }), validate(z.object({ pincode }), 'params'), pub.lookupPincode);

/* ---------- My account ---------- */
const m = Router();
m.use(authenticateCustomer);
m.get('/', me.getMe);
m.patch('/', validate(vm.updateBody), me.updateMe);
m.post('/avatar', rateLimit({ name: 'shop-avatar', max: 10 }), avatarUpload, me.setAvatar);
m.delete('/avatar', me.removeAvatar);
m.post('/mobile/code', rateLimit({ name: 'shop-mobile' }), validate(vm.mobileCodeBody), me.requestMobileCode);
m.post('/mobile/verify', rateLimit({ name: 'shop-mobile' }), validate(vm.mobileVerifyBody), me.verifyMobileCode);
m.get('/sessions', me.listSessions);
m.delete('/sessions/:id', validate(uuidParam, 'params'), me.signOutSession);
m.get('/addresses', me.listAddresses);
m.post('/addresses', validate(vm.addressBody), me.addAddress);
m.patch('/addresses/:id', validate(uuidParam, 'params'), validate(vm.addressPatch), me.updateAddress);
m.delete('/addresses/:id', validate(uuidParam, 'params'), me.removeAddress);
m.post('/addresses/:id/default', validate(uuidParam, 'params'), me.makeDefaultAddress);
m.post('/delete-request', validate(vm.deleteRequestBody), me.requestDeletion);
m.delete('/delete-request', me.cancelDeletion);
// The signed-in customer's bag (W5): kept in the account, one row per saree. Counted per
// customer, not per network (mobile networks put many phones on one IP).
const myBagLimit = rateLimit({ name: 'shop-my-bag', max: 120, by: (req) => req.customer?.accountId });
m.get('/bag', myBagLimit, bag.getBag);
m.put('/bag/items/:slug', myBagLimit, validate(vb.slugParam, 'params'), validate(vb.setBody), bag.setItem);
m.delete('/bag/items/:slug', myBagLimit, validate(vb.slugParam, 'params'), bag.removeItem);
m.post('/bag/merge', myBagLimit, validate(vb.itemsBody), bag.merge);
m.delete('/bag', myBagLimit, bag.clear);
r.use('/me', m);

/* ---------- Checkout and payment (W6), My orders (W7): signed-in customers, their own orders ---------- */
const payLimit = rateLimit({ name: 'shop-pay', max: 10, by: (req) => req.customer?.accountId });
r.post('/checkout', authenticateCustomer, payLimit, validate(vco.checkoutBody), co.start);
const o = Router();
o.use(authenticateCustomer);
const orderLimit = rateLimit({ name: 'shop-order', max: 120, by: (req) => req.customer?.accountId });
o.get('/', orderLimit, validate(vco.listQuery, 'query'), co.list);
o.get('/:number', orderLimit, validate(vco.numberParam, 'params'), co.getOrder);
o.get('/:number/invoice', rateLimit({ name: 'shop-invoice', max: 30, by: (req) => req.customer?.accountId }), validate(vco.numberParam, 'params'), co.invoice);
o.post('/:number/buy-again', myBagLimit, validate(vco.numberParam, 'params'), co.buyAgain);
o.post('/:number/pay', payLimit, validate(vco.numberParam, 'params'), co.payAgain);
o.post('/:number/verify', rateLimit({ name: 'shop-verify', max: 30, by: (req) => req.customer?.accountId }), validate(vco.numberParam, 'params'), validate(vco.verifyBody), co.verify);
o.post('/:number/cancel', orderLimit, validate(vco.numberParam, 'params'), co.cancel);
r.use('/orders', o);

/* ---------- Notifications (Firebase web push) ---------- */
const p = Router();
p.use(rateLimit({ name: 'shop-push' }));
p.post('/subscribe', optionalCustomer, validate(vp.subscribeBody), pub.subscribe);
p.delete('/subscribe', optionalCustomer, validate(vp.tokenBody), pub.unsubscribe);
p.post('/status', optionalCustomer, validate(vp.tokenBody), pub.pushStatus);
p.patch('/preferences', optionalCustomer, validate(vp.topicsBody), pub.setTopics);
p.post('/test', authenticateCustomer, validate(vp.tokenBody), pub.sendTest);
r.use('/push', p);

export default r;

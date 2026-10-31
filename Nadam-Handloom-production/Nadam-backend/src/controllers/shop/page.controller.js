// Saree pages with their own link preview (see services/shop/page.service.js). nginx sends
// /product/<slug> here and serves the plain page itself if this ever fails.
import { env } from '../../config/env.js';
import * as pages from '../../services/shop/page.service.js';

// The website's own address for this request; an unknown Host gets the first one.
function originOf(req) {
  const asked = `${req.protocol}://${req.get('host')}`;
  return env.shop.origins.includes(asked) ? asked : (env.shop.origins[0] || asked);
}

export async function product(req, res, next) {
  try {
    const html = await pages.productPage(req.params.slug, originOf(req));
    res.set('Cache-Control', 'no-cache'); // as nginx serves index.html
    return res.type('html').send(html);
  } catch (err) {
    return next(err);
  }
}

// When a saree is on the website (W2–W4). One rule for the website and for the admin app's
// "On the website now / Not on the website: …" line, so the two can never disagree.
// The old website's rule, plus two from Oct 2026: a photo, and a believable price.
import { SHOP_CATALOG } from '../../config/constants.js';

export const CUSTOMER_CHANNELS = ['online_only', 'both'];

// Prisma filter: sarees a customer can see and buy today.
export function visibleWhere() {
  return {
    isActive: true,
    deletedAt: null,
    channelVisibility: { in: CUSTOMER_CHANNELS },
    category: { is: { isActive: true, status: 'active' } },
    subcategory: { is: { isActive: true, status: 'active', onlinePrice: { gte: SHOP_CATALOG.MIN_ONLINE_PRICE } } },
    images: { some: {} },
    OR: [{ stock: { gt: 0 } }, { pieces: { some: { status: 'in_stock' } } }],
  };
}

// Everything above except stock: a sold-out saree's page still opens (with "Sold out").
export function listedWhere() {
  const { OR: _stock, ...rest } = visibleWhere();
  return rest;
}

const rupees = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;

// Why a saree is or isn't on the website. p needs category, subcategory, images and pieces.
export function websiteState(p) {
  const inStock = (p.pieces || []).some((x) => x.status === 'in_stock') || p.stock > 0;
  if (!p.isActive || p.deletedAt) return { visible: false, text: 'Not on the website: switched off.' };
  if (!CUSTOMER_CHANNELS.includes(p.channelVisibility)) return { visible: false, text: 'Not on the website: set to Store only.' };
  if (!p.subcategory?.isActive || (p.subcategory?.status && p.subcategory.status !== 'active')) return { visible: false, text: 'Not on the website: its subcategory is hidden.' };
  if (!p.category?.isActive || (p.category?.status && p.category.status !== 'active')) return { visible: false, text: 'Not on the website: its category is hidden.' };
  if (!inStock) return { visible: false, text: 'Not on the website: nothing in stock.' };
  if (!(p.images || []).length) return { visible: false, text: 'Not on the website: it needs a photo.' };
  if (Number(p.subcategory?.onlinePrice) < SHOP_CATALOG.MIN_ONLINE_PRICE) {
    return { visible: false, text: `Not on the website: its website price (${rupees(p.subcategory?.onlinePrice)}) looks wrong. Fix the subcategory's price.` };
  }
  return { visible: true, text: p.channelVisibility === 'online_only' ? 'On the website now (Online only).' : 'On the website and at the counter now.' };
}

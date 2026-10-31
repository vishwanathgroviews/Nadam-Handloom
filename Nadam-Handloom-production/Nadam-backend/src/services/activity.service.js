// Activity log (Module 10, owners): every staff-app record, old app and new, as one
// plain sentence with its details (6.4); kinds, people, periods, search and Important
// only (6.6, 6.7); repeated actions grouped (6.5); security alerts for Home (6.8);
// sign-in records kept 1 year (6.2). Docs Module 10, sections 5, 6 and 8.
import * as A from '../models/activity.model.js';
import { appRoleOf, displayNameOf } from '../models/authAccount.model.js';
import { istRange, istYmd, istDate, istTime } from '../utils/day.js';
import { resolvePeriod, rangeText } from '../utils/period.js';
import { badRequest } from '../utils/errors.js';
import { pageOf, PAGE_SIZE } from '../utils/page.js';

const DAY = 24 * 60 * 60 * 1000;
const PAGE = PAGE_SIZE;
const GROUP_GAP = 10 * 60 * 1000; // 10 minutes
const GROUP_ITEMS = 300;

export const KINDS = {
  sales: ['sale_completed', 'sale_cancelled', 'offline_sale_price_override', 'offline_sale_held_override', 'invoice_generated', 'invoice_made_later', 'invoice_customer_corrected'],
  orders: ['order_marked_shipped', 'order_tracking_changed', 'order_marked_delivered', 'order_cancelled'],
  prices: ['category_created', 'category_updated', 'category_deleted', 'category_image_updated', 'category_price_changed', 'category_hidden_from_web', 'category_shown_on_web', 'subcategory_created', 'subcategory_updated', 'subcategory_deleted', 'subcategory_price_changed', 'subcategory_image_updated', 'subcategory_hidden_from_web', 'subcategory_shown_on_web', 'subcategory_catalog_pdf_generated'],
  products: ['product_created', 'product_updated', 'product_deleted', 'product_moved', 'product_image_updated', 'product_image_uploaded', 'product_tag_changed', 'product_tag_replaced', 'product_tag_removed', 'product_marked_damaged', 'product_back_in_stock'],
  team: [...A.TEAM_TYPES],
  settings: ['app_config_updated', 'shop_details_updated'],
  signin: ['login_success', 'login_failed', 'login_locked', 'login_denied_not_staff', 'pin_check_failed', 'biometric_login_failed', 'device_trusted', 'device_check_code_sent', 'app_activation_requested', 'app_phone_verified', 'app_mpin_setup', 'app_mpin_reset', 'mpin_reset_requested', 'pin_changed', 'pin_upgraded', 'biometric_enabled', 'biometric_disabled', 'logout', 'device_signed_out', 'devices_signed_out_others', 'refresh_token_reuse_detected'],
};
export const ALL_TYPES = Object.values(KINDS).flat();
const KIND_OF = Object.fromEntries(Object.entries(KINDS).flatMap(([k, types]) => types.map((t) => [t, k])));
export const IMPORTANT = ['app_config_updated', 'shop_details_updated', 'subcategory_price_changed', 'category_price_changed', 'sale_cancelled', 'order_cancelled', 'offline_sale_held_override', 'product_deleted', 'product_tag_replaced', 'product_tag_removed', 'product_marked_damaged', 'category_deleted', 'subcategory_deleted', 'admin_changed_role', 'admin_revoked_user_access', 'admin_main_owner_changed', 'device_trusted', 'login_locked', 'refresh_token_reuse_detected'];
export const SECURITY = ['login_locked', 'refresh_token_reuse_detected'];
export const KEEP_SIGNINS_DAYS = 365;
// Each sale, cancellation and price change stays on its own line.
const NEVER_GROUPED = new Set([...KINDS.sales, 'order_cancelled', 'order_tracking_changed']);
const ADDING = new Set(['product_created', 'product_image_updated', 'product_image_uploaded']);

const n2 = (v) => (v == null || v === '' ? null : Number(v));
const rupees = (v) => (v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ROLE = { ADMIN: 'Owner', STAFF: 'Staff', owner: 'Owner', staff: 'Staff' };
const roleWord = (r) => ROLE[r] || (Array.isArray(r) ? r.map((x) => ROLE[x] || x).join(', ') : r) || 'team member';
const PAY = { cash: 'Cash', upi: 'UPI', card: 'Card' };
const isBigBargain = (m) => n2(m?.salePrice) != null && n2(m?.categoryStorePrice) > 0 && n2(m.salePrice) < n2(m.categoryStorePrice) / 2;

export const actorIdOf = (e) => (A.TEAM_TYPES.includes(e.eventType) ? e.metadata?.byUserId ?? null : e.metadata?.actorId ?? e.authAccountId ?? null);
export const isImportant = (e) => IMPORTANT.includes(e.eventType) || (e.eventType === 'offline_sale_price_override' && isBigBargain(e.metadata));

// Names for the ids on a page of records.
async function lookups(events) {
  const ids = { acc: new Set(), dev: new Set(), sub: new Set(), cat: new Set(), prod: new Set(), ord: new Set() };
  for (const e of events) {
    const m = e.metadata || {};
    [actorIdOf(e), e.authAccountId, m.from && typeof m.from === 'string' && m.from.length === 36 ? m.from : null, m.to && typeof m.to === 'string' && m.to.length === 36 ? m.to : null].forEach((x) => x && ids.acc.add(x));
    if (m.deviceId) ids.dev.add(m.deviceId);
    if (m.subcategoryId) ids.sub.add(m.subcategoryId);
    if (m.categoryId) ids.cat.add(m.categoryId);
    if (m.productId) ids.prod.add(m.productId);
    if (m.orderId) ids.ord.add(m.orderId);
  }
  const [accs, devs, subs, cats, prods, ords] = await Promise.all([
    A.accounts([...ids.acc]), A.devices([...ids.dev]), A.subcategories([...ids.sub]), A.categories([...ids.cat]), A.products([...ids.prod]), A.orders([...ids.ord]),
  ]);
  return {
    acc: new Map(accs.map((a) => [a.id, a])),
    dev: devs,
    sub: new Map(subs.map((s) => [s.id, s])),
    cat: new Map(cats.map((c) => [c.id, c])),
    prod: new Map(prods.map((p) => [p.id, p])),
    ord: new Map(ords.map((o) => [o.id, o])),
  };
}

const nameOf = (L, id) => (id ? (L.acc.get(id) ? displayNameOf(L.acc.get(id)) : 'Former team member') : null);

// The sentence, details and link for one record.
export function present(e, L) {
  const m = e.metadata || {};
  const t = e.eventType;
  const actorId = actorIdOf(e);
  const who = nameOf(L, actorId) || 'Not recorded';
  const target = A.TEAM_TYPES.includes(t) ? nameOf(L, e.authAccountId) || 'someone' : null;
  const person = nameOf(L, e.authAccountId) || (m.mobileMasked ? `+91 ${m.mobileMasked}` : 'Someone');
  const sub = m.subcategoryId ? L.sub.get(m.subcategoryId) : null;
  const cat = m.categoryId ? L.cat.get(m.categoryId) : null;
  const prod = m.productId ? L.prod.get(m.productId) : null;
  const ord = m.orderId ? L.ord.get(m.orderId) : null;
  const orderNo = m.orderNumber || ord?.orderNumber || 'an order';
  const design = sub?.name || m.name || prod?.subcategory?.name || 'a design';
  const saree = prod ? `${prod.subcategory?.name ?? 'saree'} ${prod.sku}` : m.sku ? `saree ${m.sku}` : 'a saree';
  const D = [];
  const add = (label, value) => { if (value != null && value !== '') D.push([label, String(value)]); };
  let text;
  let link = null;
  const saleLink = m.orderId ? { type: ord?.channel === 'online' ? 'order' : 'sale', id: m.orderId } : null;
  const orderLink = m.orderId ? { type: 'order', id: m.orderId } : null;
  const productLink = prod && !prod.deletedAt ? { type: 'product', id: prod.id } : null;
  const designLink = sub && sub.status !== 'inactive' ? { type: 'design', id: sub.id } : null;
  const personLink = (id) => (id && L.acc.get(id) ? { type: 'person', id } : null);

  switch (t) {
    case 'sale_completed':
      text = m.channel === 'whatsapp' ? `${who} made a WhatsApp order: ${plural(m.sarees ?? 0, 'saree')}, ${rupees(m.total)}` : `${who} sold ${plural(m.sarees ?? 0, 'saree')} for ${rupees(m.total)}${m.paymentMethod ? ` (${PAY[m.paymentMethod] || m.paymentMethod})` : ''}`;
      add('Bill', m.orderNumber); add('Paid by', PAY[m.paymentMethod]); add('Invoice', m.invoice ? 'Yes' : 'No'); link = saleLink; break;
    case 'sale_cancelled':
      text = `${who} cancelled sale ${orderNo} (${rupees(m.total)})${m.reason ? `: "${m.reason}"` : ''}`;
      add('Sale', orderNo); add('Back in stock', Array.isArray(m.backInStock) ? m.backInStock.join(', ') : m.backInStock); add('Invoice', m.invoiceNumber ? `${m.invoiceNumber}, marked CANCELLED` : 'none'); link = saleLink; break;
    case 'offline_sale_price_override': {
      const big = isBigBargain(m);
      const tag = m.code || prod?.pieces?.[0]?.barcode;
      text = `${who} sold ${design}${tag ? ` ${tag}` : ''} for ${rupees(m.salePrice)}${big ? ', below half its store price' : ''} ${big ? rupees(m.categoryStorePrice) : `(store price ${rupees(m.categoryStorePrice)})`}`;
      add('Bill', orderNo); add('Tag', tag); add('Store price', rupees(m.categoryStorePrice));
      add('Sold for', `${rupees(m.salePrice)}${n2(m.categoryStorePrice) ? ` (${Math.round((100 * n2(m.salePrice)) / n2(m.categoryStorePrice))}%)` : ''}`); link = saleLink; break;
    }
    case 'offline_sale_held_override':
      text = `${who} chose "Sell anyway" on sale ${orderNo}: a website checkout was holding a saree`;
      add('Sale', orderNo); add('Website checkouts cancelled', (m.cancelledCheckouts || []).map((c) => c.orderNumber).join(', ')); link = saleLink; break;
    case 'invoice_generated':
      text = `${who} made invoice ${m.invoiceNumber} again for sale ${orderNo}`; add('Invoice', m.invoiceNumber); link = saleLink; break;
    case 'invoice_made_later':
      text = `${who} made invoice ${m.invoiceNumber} later for sale ${orderNo}`; add('Invoice', m.invoiceNumber); add('Sale date', m.saleDate ? istDate(new Date(m.saleDate)) : null); link = saleLink; break;
    case 'invoice_customer_corrected':
      text = `${who} corrected the customer on invoice ${m.invoiceNumber}`;
      add('Before', [m.from?.name, m.from?.mobile].filter(Boolean).join(', ') || 'none'); add('After', [m.to?.name, m.to?.mobile].filter(Boolean).join(', ') || 'none');
      link = m.invoiceId ? { type: 'invoice', id: m.invoiceId } : null; break;
    case 'order_marked_shipped':
      text = `${who} shipped order ${orderNo} by ${m.carrier || 'DTDC'}${m.awbNumber ? `, ${m.awbNumber}` : ''}`; add('Order', orderNo); add('Tracking number', m.awbNumber); link = orderLink; break;
    case 'order_tracking_changed':
      text = `${who} changed the tracking number of order ${orderNo}: ${m.from?.awb ?? '—'} → ${m.to?.awb ?? '—'}`; add('Before', [m.from?.carrier, m.from?.awb].filter(Boolean).join(' ')); add('After', [m.to?.carrier, m.to?.awb].filter(Boolean).join(' ')); link = orderLink; break;
    case 'order_marked_delivered':
      text = `${who} marked order ${orderNo} delivered`; link = orderLink; break;
    case 'order_cancelled':
      text = `${who} cancelled order ${orderNo} (${rupees(m.total)})${m.reason ? `: "${m.reason}"` : ''}`;
      add('Refund in Razorpay', m.refundDue ? rupees(m.refundDue) : null); add('Back in stock', Array.isArray(m.backInStock) ? m.backInStock.join(', ') : m.backInStock); link = orderLink; break;
    case 'category_created': text = `${who} added the category ${cat?.name || m.name || ''}`.trim(); break;
    case 'category_updated': text = `${who} changed the category ${cat?.name || ''}`.trim(); add('Changed', (m.changed || []).join(', ')); break;
    case 'category_deleted': text = `${who} deleted the category ${m.name || cat?.name || ''}`.trim(); break;
    case 'category_image_updated': text = `${who} changed the photo of the category ${cat?.name || ''}`.trim(); break;
    case 'category_hidden_from_web': text = `${who} hid the category ${cat?.name || ''} from the website`; break;
    case 'category_shown_on_web': text = `${who} showed the category ${cat?.name || ''} on the website`; break;
    case 'subcategory_created': text = `${who} added the design ${design}`; link = designLink; break;
    case 'subcategory_updated': text = `${who} changed the design ${design}`; add('Changed', (m.changed || []).join(', ')); link = designLink; break;
    case 'subcategory_deleted': text = `${who} deleted the design ${design}`; break;
    case 'subcategory_image_updated': text = `${who} changed the photo of ${design}`; link = designLink; break;
    case 'subcategory_hidden_from_web': text = `${who} hid ${design} from the website`; link = designLink; break;
    case 'subcategory_shown_on_web': text = `${who} showed ${design} on the website`; link = designLink; break;
    case 'subcategory_catalog_pdf_generated': text = `${who} made the catalogue PDF for ${design}${m.productCount != null ? ` (${plural(m.productCount, 'saree')})` : ''}`; link = designLink; break;
    case 'category_price_changed':
    case 'subcategory_price_changed': {
      const b = m.before || {};
      const a = m.after || {};
      const parts = [['storePrice', 'store price'], ['onlinePrice', 'website price'], ['mrp', 'MRP']].filter(([k]) => n2(b[k]) !== n2(a[k]));
      text = parts.length === 1 ? `${who} changed the ${parts[0][1]} of ${design}: ${rupees(b[parts[0][0]])} → ${rupees(a[parts[0][0]])}`
        : parts.length ? `${who} changed the prices of ${design}: ${parts.map(([k, w]) => `${w} ${rupees(b[k])} → ${rupees(a[k])}`).join(', ')}` : `${who} saved the prices of ${design} (no change)`;
      for (const [k, w] of [['storePrice', 'Store price'], ['onlinePrice', 'Website price'], ['mrp', 'MRP']]) add(w, n2(b[k]) !== n2(a[k]) ? `${rupees(b[k])} → ${rupees(a[k])}` : rupees(a[k] ?? b[k]));
      if (n2(a.mrp) > 0 && n2(a.storePrice) > n2(a.mrp)) add('Note', 'The store price is above the MRP: check it');
      link = designLink; break;
    }
    case 'product_created': text = `${who} added ${saree}${m.barcodes?.[0] ? `, tag ${m.barcodes[0]}` : ''}`; add('Tags', (m.barcodes || []).join(', ')); link = productLink; break;
    case 'product_updated': text = `${who} edited ${saree}${m.summary ? `: ${m.summary}` : ''}`; add('Changed', (m.changed || []).join(', ')); link = productLink; break;
    case 'product_moved': text = `${who} moved ${saree} from ${m.from} to ${m.to}`; link = productLink; break;
    case 'product_image_updated':
    case 'product_image_uploaded': text = `${who} added a photo to ${saree}`; link = productLink; break;
    case 'product_deleted': text = `${who} deleted ${m.name ? `${m.name} ${m.sku || ''}`.trim() : saree}${(m.freedTags || m.barcodes || []).length ? ` (tag ${(m.freedTags || m.barcodes).join(', ')} freed)` : ''}`; add('Tags', (m.barcodes || []).join(', ')); break;
    case 'product_tag_changed': text = `${who} changed the tag of ${saree}: ${m.from} → ${m.to} (wrong tag)`; link = productLink; break;
    case 'product_tag_replaced': text = `${who} replaced the damaged tag ${m.from} with ${m.to} on ${saree}`; add('Old tag', `${m.from} (retired)`); add('New tag', m.to); link = productLink; break;
    case 'product_tag_removed': text = `${who} removed the extra tag ${m.code} from ${saree}`; link = productLink; break;
    case 'product_marked_damaged': text = `${who} marked ${saree} (${m.code}) damaged`; link = productLink; break;
    case 'product_back_in_stock': text = `${who} put ${saree} (${m.code}) back in stock`; link = productLink; break;
    case 'admin_provisioned_user': text = `${who} invited ${target} as ${roleWord(m.role)}`; link = personLink(e.authAccountId); break;
    case 'admin_reinvited_user': text = `${who} invited ${target} again${m.role ? ` as ${roleWord(m.role)}` : ''}`; link = personLink(e.authAccountId); break;
    case 'admin_renamed_user': text = `${who} renamed ${m.from || target} to ${m.to || target}`; link = personLink(e.authAccountId); break;
    case 'admin_changed_role': text = `${who} changed ${target}'s role: ${roleWord(m.from)} → ${roleWord(m.to)}`; link = personLink(e.authAccountId); break;
    case 'admin_revoked_user_access': text = `${who} removed ${target} from the team`; add('Phones signed out', m.devicesSignedOut); link = personLink(e.authAccountId); break;
    case 'admin_main_owner_changed': text = `${who} made ${target} the main owner`; link = personLink(e.authAccountId); break;
    case 'session_revoked_by_admin': text = m.all ? `${who} signed ${target} out of every phone` : `${who} signed ${target} out on ${m.device || 'a phone'}`; link = personLink(e.authAccountId); break;
    case 'login_success': text = `${person} signed in${m.method === 'pin+sms' ? ' with an SMS code' : ''}`; break;
    case 'login_failed': text = `Wrong PIN for ${person}`; break;
    case 'login_locked': text = `${person}'s PIN was locked after too many wrong tries`; link = personLink(e.authAccountId); break;
    case 'login_denied_not_staff': text = `${person} tried to sign in but isn't in the team`; break;
    case 'pin_check_failed': text = `Wrong PIN for ${person} while confirming an action`; break;
    case 'biometric_login_failed': text = `Face ID or fingerprint sign-in failed for ${person}`; break;
    case 'device_trusted': text = `${person} signed in on a new phone${m.device ? `: ${m.device}` : ''}`; add('Phone', m.device); link = personLink(e.authAccountId); break;
    case 'device_check_code_sent': text = `An SMS code was sent to ${person} for a new phone`; break;
    case 'app_activation_requested': text = `${person} asked for a first-time sign-in code`; break;
    case 'app_phone_verified': text = `${person} confirmed their mobile number with an SMS code`; break;
    case 'app_mpin_setup': text = `${person} set their PIN`; break;
    case 'app_mpin_reset': text = `${person} reset their PIN`; break;
    case 'mpin_reset_requested': text = `${person} asked to reset their PIN`; break;
    case 'pin_changed': text = `${person} changed their PIN`; break;
    case 'pin_upgraded': text = `${person} moved to a 6-digit PIN`; break;
    case 'biometric_enabled': text = `${person} turned on Face ID or fingerprint${m.device ? ` on ${m.device}` : ''}`; break;
    case 'biometric_disabled': text = `${person} turned off Face ID or fingerprint${m.device ? ` on ${m.device}` : ''}`; break;
    case 'logout': text = `${person} logged out`; break;
    case 'device_signed_out': text = `${person} signed out a phone`; break;
    case 'devices_signed_out_others': text = `${person} signed out their other phones`; break;
    case 'app_config_updated': {
      const ch = m.changes || {};
      const P = m.platform === 'ios' ? 'iPhone' : 'Android';
      const parts = [];
      if (ch.staffOn) parts.push(ch.staffOn.to ? `paused the staff app${(ch.staffMessage?.to ?? '') ? `: "${ch.staffMessage.to}"` : ''}` : 'resumed the staff app');
      else if (ch.staffMessage) parts.push('changed the staff app maintenance message');
      if (ch.websiteOn) parts.push(ch.websiteOn.to ? `paused the website${(ch.websiteMessage?.to ?? '') ? `: "${ch.websiteMessage.to}"` : ''}` : 'opened the website again');
      else if (ch.websiteMessage) parts.push('changed the website maintenance message');
      const ver = (k) => ch[`${m.platform}.${k}`];
      if (ver('oldest') && ver('oldest').to > ver('oldest').from) parts.push(`required ${P} version ${ver('oldest').to} or later for everyone`);
      else if (ver('oldest')) parts.push(`set the oldest ${P} version allowed to ${ver('oldest').to || 'any'}`);
      if (ver('newest')) parts.push(`set the newest ${P} version to ${ver('newest').to}`);
      if (ver('required')) parts.push(ver('required').to ? `made ${P} updates required` : `made ${P} updates optional`);
      if (ver('link')) parts.push(`changed the ${P} store link`);
      // The old app's records name the columns.
      if (!parts.length && Object.keys(ch).length) parts.push(`changed the app settings (${Object.keys(ch).join(', ')})`);
      text = `${who} ${parts.join(', ') || 'saved the app settings (no change)'}`;
      for (const [k, v] of Object.entries(ch)) add(k, `${v.from === '' ? '(empty)' : v.from} → ${v.to === '' ? '(empty)' : v.to}`);
      break;
    }
    case 'shop_details_updated': {
      const ch = m.changes || {};
      const W = { name: 'name', address: 'address', mobile: 'mobile', gstin: 'GSTIN', website: 'website address' };
      text = `${who} changed the shop ${Object.keys(ch).map((k) => W[k] || k).join(', ')}`;
      for (const [k, v] of Object.entries(ch)) add(W[k] ? W[k][0].toUpperCase() + W[k].slice(1) : k, `${v.from || '(empty)'} → ${v.to || '(empty)'}`);
      break;
    }
    case 'refresh_token_reuse_detected': text = `A stolen sign-in was blocked for ${person}: signed out on every phone`; link = personLink(e.authAccountId); break;
    default: text = `${who}: ${t.replace(/_/g, ' ')}${m.summary ? ` (${m.summary})` : ''}`;
  }
  const device = m.deviceId ? L.dev.find((d) => d.deviceId === m.deviceId && (!actorId || d.authAccountId === actorId || d.authAccountId === e.authAccountId)) || L.dev.find((d) => d.deviceId === m.deviceId) : null;
  const phone = device ? device.name : m.platform === 'ios' ? 'an iPhone' : m.platform === 'android' ? 'an Android phone' : null;
  return {
    id: e.id,
    type: t,
    kind: KIND_OF[t] || 'signin',
    at: e.createdAt.toISOString(),
    day: istYmd(e.createdAt),
    date: istDate(e.createdAt),
    time: istTime(e.createdAt),
    actor: actorId ? { id: actorId, name: who, role: L.acc.get(actorId) ? (appRoleOf(L.acc.get(actorId)) === 'ADMIN' ? 'owner' : appRoleOf(L.acc.get(actorId)) === 'STAFF' ? 'staff' : 'former') : 'former' } : null,
    text,
    important: isImportant(e),
    phone,
    details: D,
    link,
    // Adding a saree and adding its photos count as one action (the old app logged them in turns).
    groupKey: NEVER_GROUPED.has(t) || isImportant(e) ? null : `${actorId}|${ADDING.has(t) ? 'adding' : t}|${m.subcategoryId || prod?.subcategory?.id || ''}`,
    design: sub?.name || prod?.subcategory?.name || null, // for a group's sentence
  };
}

// "System Admin added 48 sarees to Rainbow checks sarees"
function groupText(items) {
  const f = items[0];
  const n = items.length;
  const who = f.actor?.name || 'Not recorded';
  if (ADDING.has(f.type)) {
    const sarees = items.filter((i) => i.type === 'product_created').length;
    const photos = n - sarees;
    const to = f.design ? ` to ${f.design}` : '';
    if (!sarees) return `${who} added ${plural(photos, 'photo')}${to}`;
    return `${who} added ${plural(sarees, 'saree')}${to}${photos ? ` with ${plural(photos, 'photo')}` : ''}`;
  }
  switch (f.type) {
    case 'product_updated': return `${who} edited ${n} sarees`;
    case 'order_marked_shipped': return `${who} shipped ${n} orders`;
    case 'order_marked_delivered': return `${who} marked ${n} orders delivered`;
    case 'subcategory_catalog_pdf_generated': return `${who} made ${n} catalogue PDFs`;
    case 'login_success': return `${f.text.replace(' signed in', '').replace(' with an SMS code', '')} signed in ${n} times`;
    case 'login_failed': return `${n} wrong PINs for ${f.text.replace('Wrong PIN for ', '')}`;
    case 'pin_check_failed': return `${n} wrong PINs for ${f.text.replace('Wrong PIN for ', '').replace(' while confirming an action', '')} while confirming an action`;
    case 'logout': return `${f.text.replace(' logged out', '')} logged out ${n} times`;
    default: return `${f.text} (and ${n - 1} more like it)`;
  }
}

// Same person, same action, same design, less than 10 minutes apart (6.5).
export function groupRows(rows) {
  const out = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    const lastItem = last ? (last.items ? last.items[last.items.length - 1] : last) : null;
    if (r.groupKey && last && (last.items ? last.items[0].groupKey : last.groupKey) === r.groupKey && new Date(lastItem.at) - new Date(r.at) < GROUP_GAP) {
      if (!last.items) out[out.length - 1] = { group: true, items: [last] };
      out[out.length - 1].items.push(r);
    } else out.push(r);
  }
  return out.map((x) => {
    if (!x.group) return x;
    const first = x.items[0];
    const last = x.items[x.items.length - 1];
    return {
      id: `g-${first.id}`, group: true, groupKey: first.groupKey, design: first.design, type: first.type, kind: first.kind, at: first.at, day: first.day, date: first.date,
      time: last.time === first.time ? first.time : `${last.time}–${first.time}`, actor: first.actor, phone: first.phone, important: false,
      text: groupText(x.items), count: x.items.length, items: x.items.slice(0, GROUP_ITEMS), more: Math.max(0, x.items.length - GROUP_ITEMS),
    };
  });
}

function periodRange({ period = '30d', from, to }, now) {
  if (period === 'all') return { range: null, label: 'All' };
  try {
    const p = resolvePeriod({ period, from, to }, now);
    return { range: istRange(p.range.from, p.range.to), label: rangeText(p.range) };
  } catch (e) {
    throw badRequest('BAD_RANGE', e.message);
  }
}

// One page: up to 20 lines (a group counts as one), newest first.
export async function list({ kind = 'all', person = null, period = '30d', from, to, q = '', important = false, before = null, now = new Date() }) {
  const types = kind === 'all' ? ALL_TYPES : KINDS[kind] || [];
  const { range, label } = periodRange({ period, from, to }, now);
  const word = q.trim();
  const ids = word ? await A.matchIds(word) : { accounts: [], subs: [], cats: [], products: [], orders: [] };
  const like = word ? `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  let cursor = before ? (() => { const [at, id] = String(before).split('|'); return { at: new Date(at), id }; })() : null;
  const raw = [];
  let done = false;
  // Read in chunks until 20 lines are complete (the 21st line closes the 20th group).
  while (!done) {
    const chunk = await A.list({ types, person, from: range?.from ?? null, to: range?.to ?? null, like, ids, important, importantTypes: IMPORTANT, before: cursor, take: 300 });
    raw.push(...chunk);
    if (chunk.length < 300) done = true;
    else cursor = { at: chunk[chunk.length - 1].createdAt, id: chunk[chunk.length - 1].id };
    if (!done) {
      const L0 = await lookups(raw);
      if (groupRows(raw.map((e) => present(e, L0))).length > PAGE) done = true;
    }
  }
  const L = await lookups(raw);
  const lines = groupRows(raw.map((e) => present(e, L)));
  const page = lines.slice(0, PAGE);
  const more = lines.length > PAGE;
  const lastLine = page[page.length - 1];
  const lastRaw = lastLine ? (lastLine.items ? lastLine.items[lastLine.items.length - 1] : lastLine) : null;
  // A group cut at 300 items continues on the next page from its last shown entry.
  const strip = ({ groupKey, design, ...rest }) => rest; // eslint-disable-line no-unused-vars
  return {
    period: { period, label },
    entries: page.map((l) => (l.items ? { ...l, items: l.items.map(strip) } : strip(l))),
    next: more && lastRaw ? `${lastRaw.at}|${lastRaw.id}` : null,
  };
}

// Everyone who appears as a doer, for the person filter (former members too).
export async function people({ offset = 0, limit = PAGE_SIZE } = {}) {
  const ids = (await A.doers()).map((r) => r.id).filter(Boolean);
  const accs = await A.accounts(ids);
  const all = accs.map((a) => ({ id: a.id, name: displayNameOf(a), role: appRoleOf(a) === 'ADMIN' ? 'owner' : appRoleOf(a) === 'STAFF' ? 'staff' : 'former' }))
    .sort((x, y) => ({ owner: 0, staff: 1, former: 2 }[x.role] - { owner: 0, staff: 1, former: 2 }[y.role]) || x.name.localeCompare(y.name));
  const page = pageOf(all, { offset, limit });
  return { people: page.items, nextOffset: page.nextOffset, total: page.total };
}

// Home (6.8): locked PINs and blocked stolen sign-ins in the last 24 hours.
export async function securityAlerts(now = new Date()) {
  const { count, latest } = await A.securitySince(new Date(now.getTime() - DAY), SECURITY);
  if (!count) return null;
  const p = present(latest, await lookups([latest]));
  return { count, text: p.text, time: p.time };
}

// Sign-in records are kept 1 year; everything else is never deleted (6.2).
export async function deleteOldSignIns(now = new Date()) {
  const r = await A.deleteSignInsBefore(new Date(now.getTime() - KEEP_SIGNINS_DAYS * DAY), KINDS.signin);
  return r.count;
}

// "My account" → Addresses (W1): at most 10; one is the default (the first one saved is).
import { prisma } from '../../config/database.js';
import { SHOP } from '../../config/constants.js';
import * as Address from '../../models/address.model.js';
import * as Pincode from '../../models/pincode.model.js';
import { presentAddress } from './present.js';
import { shopAudit } from '../audit.service.js';
import { conflict, notFound, badRequest } from '../../utils/errors.js';

const notMine = () => notFound('ADDRESS_NOT_FOUND', 'This address was removed. Refresh the page.');

export async function list(accountId) {
  return { addresses: (await Address.list(accountId)).map(presentAddress), max: SHOP.MAX_ADDRESSES };
}

// The state must exist; a pincode in India Post's list fills in a missing city or state.
async function placeOf(v) {
  const p = await Pincode.find(v.pincode);
  const city = v.city || p?.city;
  const state = v.state || p?.state;
  if (!city || !state) throw badRequest('PINCODE_NOT_FOUND', 'We couldn\'t find this pincode. Check it, or type the city and state.', { field: 'pincode' });
  return { city, state };
}

const fields = (v) => ({
  ...(v.label !== undefined ? { label: v.label } : {}),
  ...(v.fullName !== undefined ? { fullName: v.fullName } : {}),
  ...(v.mobile !== undefined ? { phone: v.mobile } : {}),
  ...(v.line1 !== undefined ? { line1: v.line1 } : {}),
  ...(v.line2 !== undefined ? { line2: v.line2 || null } : {}),
  ...(v.landmark !== undefined ? { landmark: v.landmark || null } : {}),
});

export async function add({ accountId, v, ctx }) {
  const place = await placeOf(v);
  const saved = await prisma.$transaction(async (tx) => {
    await Address.lockFor(accountId, tx);
    const n = await Address.count(accountId, tx);
    if (n >= SHOP.MAX_ADDRESSES) throw conflict('ADDRESS_LIMIT', `You can save up to ${SHOP.MAX_ADDRESSES} addresses. Delete one to add another.`, { max: SHOP.MAX_ADDRESSES });
    const makeDefault = n === 0 || !!v.isDefault;
    if (makeDefault) await Address.clearDefault(accountId, tx);
    return Address.create({ authAccountId: accountId, ...fields(v), label: v.label || 'home', pincode: v.pincode, ...place, country: 'India', isDefault: makeDefault }, tx);
  });
  await shopAudit('shop_address_added', { accountId, ctx });
  return { address: presentAddress(saved), ...(await list(accountId)) };
}

export async function update({ accountId, id, v, ctx }) {
  const current = await Address.findOwn(accountId, id);
  if (!current) throw notMine();
  const placeChange = v.pincode !== undefined || v.city !== undefined || v.state !== undefined;
  const place = placeChange
    ? await placeOf({ pincode: v.pincode ?? current.pincode, city: v.city ?? (v.pincode && v.pincode !== current.pincode ? null : current.city), state: v.state ?? (v.pincode && v.pincode !== current.pincode ? null : current.state) })
    : {};
  const saved = await prisma.$transaction(async (tx) => {
    await Address.lockFor(accountId, tx);
    if (!(await Address.findOwn(accountId, id, tx))) throw notMine();
    if (v.isDefault === true) await Address.clearDefault(accountId, tx);
    return Address.update(id, { ...fields(v), ...(placeChange ? { pincode: v.pincode ?? current.pincode, ...place } : {}), ...(v.isDefault === true ? { isDefault: true } : {}) }, tx);
  });
  await shopAudit('shop_address_updated', { accountId, ctx });
  return { address: presentAddress(saved), ...(await list(accountId)) };
}

export async function remove({ accountId, id, ctx }) {
  await prisma.$transaction(async (tx) => {
    await Address.lockFor(accountId, tx);
    const a = await Address.findOwn(accountId, id, tx);
    if (!a) throw notMine();
    await Address.remove(id, tx);
    // The default went: the most recently used one becomes the default.
    if (a.isDefault) {
      const next = await Address.newest(accountId, tx);
      if (next) await Address.update(next.id, { isDefault: true }, tx);
    }
  });
  await shopAudit('shop_address_deleted', { accountId, ctx });
  return list(accountId);
}

export async function makeDefault({ accountId, id, ctx }) {
  await prisma.$transaction(async (tx) => {
    await Address.lockFor(accountId, tx);
    if (!(await Address.findOwn(accountId, id, tx))) throw notMine();
    await Address.clearDefault(accountId, tx);
    await Address.update(id, { isDefault: true }, tx);
  });
  await shopAudit('shop_address_default', { accountId, ctx });
  return list(accountId);
}

// "My account" → Profile (W1, web-01 section 4.3): details, profile picture, change of mobile.
import sharp from 'sharp';
import { prisma } from '../../config/database.js';
import { SHOP, SHOP_CODE_PURPOSE } from '../../config/constants.js';
import * as Customer from '../../models/customer.model.js';
import * as codes from './code.service.js';
import { resolvePlace } from './place.service.js';
import { presentCustomer } from './present.js';
import { splitName } from './auth.service.js';
import { storage } from '../storage/index.js';
import { shopAudit } from '../audit.service.js';
import { maskMobile } from '../../utils/phone.js';
import { badRequest, conflict, forbidden } from '../../utils/errors.js';

const emailTaken = () => conflict('EMAIL_TAKEN', 'This email is already on another account. Use a different one, or message us on WhatsApp if it is yours.', { field: 'email', help: 'whatsapp' });
const asDate = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : null);

export const getMe = (account) => presentCustomer(account);

// patch: only the fields sent change. Dates are "YYYY-MM-DD" or null (to clear).
export async function updateMe({ account, patch, ctx }) {
  const profile = account.userProfile;
  const accountData = {};
  const data = {};
  const changed = [];

  if (patch.fullName !== undefined && patch.fullName !== (profile.displayName || '')) {
    Object.assign(data, splitName(patch.fullName), { displayName: patch.fullName });
    changed.push('fullName');
  }
  if (patch.email !== undefined && patch.email !== (account.email || '').toLowerCase()) {
    const holder = await Customer.findByEmail(patch.email);
    if (holder && holder.id !== account.id) throw emailTaken();
    accountData.email = patch.email;
    accountData.emailVerifiedAt = null;
    changed.push('email');
  }
  if (patch.pincode !== undefined || patch.city !== undefined || patch.state !== undefined) {
    const pincode = patch.pincode ?? profile.pincode;
    if (!pincode) throw badRequest('VALIDATION_FAILED', 'Enter your 6-digit pincode.', { issues: [{ field: 'pincode', message: 'Enter your 6-digit pincode.' }] });
    const newPin = patch.pincode !== undefined && patch.pincode !== profile.pincode;
    // A new pincode brings its own city and state unless the customer typed them.
    const place = await resolvePlace({
      pincode,
      city: patch.city ?? (newPin ? null : profile.city),
      state: patch.state ?? (newPin ? null : profile.state),
    });
    for (const k of ['pincode', 'city', 'state']) {
      if (place[k] !== profile[k]) { data[k] = place[k]; changed.push(k); }
    }
  }
  for (const k of ['dateOfBirth', 'anniversary']) {
    if (patch[k] === undefined) continue;
    const before = profile[k] ? profile[k].toISOString().slice(0, 10) : null;
    if (patch[k] !== before) { data[k] = asDate(patch[k]); changed.push(k); }
  }
  if (patch.language !== undefined && patch.language !== profile.language) { data.language = patch.language; changed.push('language'); }
  if (patch.marketingOptIn !== undefined && patch.marketingOptIn !== profile.marketingOptIn) {
    data.marketingOptIn = patch.marketingOptIn;
    data.marketingOptInAt = new Date();
    changed.push('marketingOptIn');
  }

  if (changed.length) {
    try {
      await prisma.$transaction(async (tx) => {
        if (Object.keys(accountData).length) await Customer.updateAccount(account.id, accountData, tx);
        if (Object.keys(data).length) await Customer.updateProfile(account.id, data, tx);
      });
    } catch (err) {
      if (err?.code === 'P2002') throw emailTaken();
      throw err;
    }
    await shopAudit('shop_profile_updated', { accountId: account.id, ctx, metadata: { fields: changed } });
  }
  return { customer: presentCustomer(await Customer.findById(account.id)), changed };
}

/* ---------- Profile picture ---------- */
// A square JPEG, 256 × 256, upright, location and camera details removed. The photo's
// real type and size in pixels are read from its header first: a small file can still be
// a huge picture that would fill the server's memory when opened.
const unreadable = () => badRequest('PHOTO_UNREADABLE', 'This photo could not be read. Please choose another one.');

export async function makeAvatar(buffer) {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw unreadable();
  }
  const cap = SHOP.AVATAR_MAX_PIXELS[meta.format];
  if (!cap) throw badRequest('PHOTO_TYPE', 'Use a JPEG, PNG or WebP photo.');
  if (!meta.width || !meta.height || meta.width * meta.height > cap) {
    throw badRequest('PHOTO_TOO_MANY_PIXELS', 'This photo is too big to use. Please choose another one, or a screenshot of it.');
  }
  try {
    return await sharp(buffer, { failOn: 'error', limitInputPixels: cap })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(SHOP.AVATAR_EDGE, SHOP.AVATAR_EDGE, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    throw unreadable();
  }
}

export async function setAvatar({ account, file, ctx }) {
  const jpeg = await makeAvatar(file.buffer);
  const saved = await storage().upload({ buffer: jpeg, contentType: 'image/jpeg', folder: 'avatars', ext: 'jpg' });
  const oldKey = account.userProfile?.avatarKey;
  await Customer.updateProfile(account.id, { avatarUrl: saved.url, avatarKey: saved.key });
  if (oldKey) await storage().remove(oldKey).catch(() => false);
  await shopAudit('shop_avatar_changed', { accountId: account.id, ctx });
  return { customer: presentCustomer(await Customer.findById(account.id)) };
}

export async function removeAvatar({ account, ctx }) {
  const oldKey = account.userProfile?.avatarKey;
  if (account.userProfile?.avatarUrl) {
    await Customer.updateProfile(account.id, { avatarUrl: null, avatarKey: null });
    if (oldKey) await storage().remove(oldKey).catch(() => false);
    await shopAudit('shop_avatar_removed', { accountId: account.id, ctx });
  }
  return { customer: presentCustomer(await Customer.findById(account.id)) };
}

/* ---------- Change of mobile ---------- */
function assertMayChangeMobile(account, mobile) {
  if (Customer.isTeamMember(account)) {
    throw forbidden('MOBILE_MANAGED_BY_SHOP', 'This number is also used for the shop\'s staff app, so it can only be changed by the shop owner.');
  }
  if (mobile === account.phone) throw badRequest('SAME_MOBILE', 'This is already your mobile number.', { field: 'mobile' });
}

async function assertFree(mobile, accountId) {
  const holder = await Customer.findByMobile(mobile);
  if (holder && holder.id !== accountId) throw conflict('MOBILE_TAKEN', 'This number is already used by another account.', { field: 'mobile' });
}

export async function requestMobileChange({ account, mobile, ctx }) {
  assertMayChangeMobile(account, mobile);
  await assertFree(mobile, account.id);
  const reply = await codes.sendCode({ mobile, purpose: SHOP_CODE_PURPOSE.CHANGE_MOBILE, accountId: account.id, ip: ctx.ip });
  await shopAudit('shop_mobile_change_code_sent', { accountId: account.id, ctx, metadata: { to: maskMobile(mobile) } });
  return { ...reply, mobileMasked: maskMobile(mobile) };
}

export async function verifyMobileChange({ account, mobile, code, ctx }) {
  assertMayChangeMobile(account, mobile);
  await codes.verifyCode({ mobile, purpose: SHOP_CODE_PURPOSE.CHANGE_MOBILE, code, accountId: account.id });
  try {
    await Customer.updateAccount(account.id, { phone: mobile, phoneVerifiedAt: new Date() });
  } catch (err) {
    if (err?.code === 'P2002') throw conflict('MOBILE_TAKEN', 'This number is already used by another account.', { field: 'mobile' });
    throw err;
  }
  await shopAudit('shop_mobile_changed', { accountId: account.id, ctx, metadata: { from: maskMobile(account.phone), to: maskMobile(mobile) } });
  return { customer: presentCustomer(await Customer.findById(account.id)) };
}

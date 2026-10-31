// The shapes the API sends to the website: a customer, an address, a signed-in browser.
import { SHOP } from '../../config/constants.js';
import { maskMobile } from '../../utils/phone.js';
import { isTeamMember } from '../../models/customer.model.js';
import { addressProblem } from './addressCheck.js';
import { canPayOnline } from './paymentAccess.js';

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const iso = (d) => (d ? new Date(d).toISOString() : null);

export const fullNameOf = (account) => {
  const p = account?.userProfile;
  return (p?.displayName || [p?.firstName, p?.lastName].filter(Boolean).join(' ')).trim();
};

export function deletionOf(profile) {
  if (!profile?.deleteRequestedAt) return null;
  const at = new Date(profile.deleteRequestedAt);
  const deletesOn = new Date(at.getTime() + SHOP.DELETE_AFTER_DAYS * 86400_000);
  // overdue: the 7 days are over but it hasn't gone yet (orders still on their way, or the
  // next clean-up run is a few minutes away).
  return { requestedAt: at.toISOString(), deletesOn: deletesOn.toISOString(), overdue: deletesOn <= new Date() };
}

export function presentCustomer(account) {
  const p = account.userProfile || {};
  return {
    id: account.id,
    fullName: fullNameOf(account),
    firstName: p.firstName || '',
    mobile: account.phone,
    mobileMasked: maskMobile(account.phone),
    email: account.email || null,
    avatarUrl: p.avatarUrl || null,
    pincode: p.pincode || null,
    city: p.city || null,
    state: p.state || null,
    dateOfBirth: day(p.dateOfBirth),
    anniversary: day(p.anniversary),
    language: p.language || null,
    marketingOptIn: !!p.marketingOptIn,
    memberSince: iso(account.createdAt),
    deletion: deletionOf(p),
    // The same number is used for the shop's staff app: its mobile and the account
    // itself are managed there (the website shows no staff powers, only this).
    managedByShop: isTeamMember(account),
    // W6: Checkout shows for this customer (everyone, unless payments are being tried).
    payOnline: canPayOnline(account),
  };
}

export const presentAddress = (a) => ({
  id: a.id,
  label: a.label || 'home',
  fullName: a.fullName,
  mobile: a.phone,
  line1: a.line1,
  line2: a.line2 || '',
  landmark: a.landmark || '',
  city: a.city,
  state: a.state,
  pincode: a.pincode,
  country: a.country,
  isDefault: a.isDefault,
  updatedAt: iso(a.updatedAt),
  // W6: what must be corrected before an order can be sent here (old website), or null.
  problem: addressProblem(a),
});

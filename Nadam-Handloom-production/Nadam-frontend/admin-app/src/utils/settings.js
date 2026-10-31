// The Settings page (Module 11): texts and checks, kept here so they can be tested.
// The server checks everything again.

export const MESSAGE_MAX = 300;
// GSTIN: 2 digits, 5 letters, 4 digits, a letter, a digit or letter, Z, a digit or letter.
export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const mobileText = (m) => (/^\d{10}$/.test(String(m || '')) ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : String(m || ''));
const digits10 = (m) => String(m || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

// The fixed numbers the app uses (6.6: shown, not changed here).
export const RULES = [
  ['A warning when a saree is sold under', 'half its store price'],
  ['Running low', '1 to 3 sarees left in a design'],
  ['Check delivery', '10 days after shipping'],
  ['Unpaid website checkouts', 'kept 30 days (Home shows 7)'],
  ['Signed in on a phone', '7 days, renewed each time the app is used'],
  ['Sarees in stock', 'up to 5,000'],
  ['Activity log', 'sign-ins 1 year; everything else for years'],
];

// The shop details form, checked like the server checks it.
export function shopErrors(f) {
  const e = {};
  if ((f.name || '').trim().length < 2) e.name = 'Type the shop name.';
  if ((f.address || '').trim().length < 10) e.address = 'Type the full address.';
  if (!/^\d{10}$/.test(digits10(f.mobile))) e.mobile = 'Type a 10-digit mobile number.';
  if (!GSTIN.test((f.gstin || '').trim().toUpperCase())) e.gstin = 'That doesn\'t look like a GSTIN: 15 characters, like 37CCWPN2487C1Z2.';
  if ((f.website || '').trim() && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(f.website.trim())) e.website = 'Start with https://, like https://nandamhandlooms.com';
  return e;
}
export const FIELD_NAME = { name: 'shop name', address: 'address', mobile: 'mobile', gstin: 'GSTIN', website: 'website address' };
// What the server will save, to tell "Saved" from "Nothing changed".
export const shopKey = (s) => JSON.stringify([(s.name || '').trim().replace(/\s+/g, ' '), (s.address || '').trim().replace(/\s+/g, ' '), digits10(s.mobile), (s.gstin || '').trim().toUpperCase(), (s.website || '').trim().replace(/\/$/, '')]);

// "Lakshmi, 12 Oct 2026, 3:10 pm". Before this module only the time was saved.
export function lastChanged(changed, never) {
  if (!changed) return never;
  return changed.by ? `${changed.by}, ${changed.when}` : `${changed.when} · person not recorded`;
}

// Phones signed in this week on a version older than `build` (the warning before requiring it).
export function olderPhones(phones, platform, build) {
  const mine = (phones || []).filter((p) => p.platform === platform);
  return { older: mine.filter((p) => p.build != null && p.build < build), unknown: mine.filter((p) => p.build == null).length };
}
export const phoneText = (p) => `${p.person} · ${p.name || 'phone'} (${p.build})`;

// Advanced: the numbers and the store link.
export function advancedError(f) {
  if (!/^\d+$/.test(String(f.newest)) || !/^\d+$/.test(String(f.oldest))) return 'Type whole numbers for the versions.';
  if (Number(f.oldest) > Number(f.newest)) return 'The oldest allowed can\'t be above the newest.';
  if ((f.link || '').trim() && !/^https:\/\/\S+$/.test(f.link.trim())) return 'The store link must start with https://';
  return null;
}
// The lowest version phones may use after a change.
export const needOf = (u) => Math.max(u.oldest || 0, u.required ? u.newest || 0 : 0);

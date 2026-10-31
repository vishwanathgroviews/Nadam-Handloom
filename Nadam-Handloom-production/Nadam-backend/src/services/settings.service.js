// Settings (Module 11, owners): staff app and website maintenance, app updates, shop
// details and the website address; the start-up check every phone makes; the shop
// details invoices print. Every change goes to the Activity log with before → after.
// Docs Module 11, sections 5, 6 and 8.
import { env } from '../config/env.js';
import * as Settings from '../models/settings.model.js';
import * as A from '../models/activity.model.js';
import { appRoleOf, displayNameOf } from '../models/authAccount.model.js';
import { audit } from './audit.service.js';
import { istDate, istTime } from '../utils/day.js';
import { badRequest } from '../utils/errors.js';
import { normalizeMobile } from '../utils/phone.js';
import pkg from '../../package.json' with { type: 'json' };

const DAY = 24 * 60 * 60 * 1000;
export const LIMITS = { message: 300, build: 1000000 };
export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
// Used until an owner saves a link of their own (as the old app).
export const STORE_LINKS = {
  android: 'https://play.google.com/store/apps/details?id=com.nandamhandlooms.staff',
  ios: 'https://beta.itunes.apple.com/v1/app/6818412372',
};

// "2.0.0 (26)" → 26; anything else → null.
export const buildOf = (appVersion) => {
  const m = /\((\d+)\)\s*$/.exec(String(appVersion || ''));
  return m ? Number(m[1]) : null;
};
const when = (d) => (d ? `${istDate(d)}, ${istTime(d)}` : null);

// What every phone checks at start-up (no sign-in needed).
export async function status() {
  const r = await Settings.get();
  const platform = (p) => ({
    newest: r?.[`${p}LatestBuild`] ?? 0,
    oldest: r?.[`${p}MinBuild`] ?? 0,
    required: r?.[`${p}ForceUpdate`] ?? false,
    link: r?.[`${p}UpdateUrl`] || STORE_LINKS[p],
  });
  return {
    maintenance: {
      staff: { on: !!r?.maintenanceEnabled, message: r?.maintenanceMessage || '' },
      website: { on: !!r?.webMaintenanceEnabled, message: r?.webMaintenanceMessage || '' },
    },
    updates: { android: platform('android'), ios: platform('ios') },
  };
}

// Must this build update? (8: below the oldest allowed, or below the newest with "required").
export function mustUpdate(u, build) {
  if (build == null) return false;
  return build < (u.oldest || 0) || (u.required && build < (u.newest || 0));
}

// The shop details invoices and messages use: the saved ones, else the server settings.
export async function shopDetails() {
  const r = await Settings.get();
  return {
    name: r?.shopName || env.company.name,
    address: r?.shopAddress || env.company.address,
    mobile: r?.shopMobile || normalizeMobile(env.company.mobile) || env.company.mobile,
    gstin: r?.shopGstin || env.company.gstin,
    website: (r?.websiteUrl || env.WEBSITE_URL || '').replace(/\/$/, ''),
    gstRatePercent: env.company.gstRatePercent,
  };
}
// The shop details of the day an invoice was made: a PDF re-made later (after a
// correction or a cancel) keeps them (6.5). Today's details with every later change undone.
export async function shopDetailsAt(at) {
  const out = await shopDetails();
  if (!at) return out;
  for (const e of await Settings.shopChangesSince(at)) {
    for (const [k, v] of Object.entries(e.metadata?.changes || {})) if (k in out && v && 'from' in v) out[k] = v.from;
  }
  return out;
}

// "+91 94941 70180" for the letterhead.
export const mobileText = (m) => (/^\d{10}$/.test(String(m)) ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : String(m || ''));

// Is the staff app paused for this account? Owners always work (6.3). Cached briefly so
// every request doesn't read the row.
let cache = { at: 0, row: null };
export function forgetCache() { cache = { at: 0, row: null }; }
export async function maintenanceFor(account) {
  if (appRoleOf(account) !== 'STAFF') return null;
  if (Date.now() - cache.at > 10000) cache = { at: Date.now(), row: await Settings.get() };
  return cache.row?.maintenanceEnabled ? { message: cache.row.maintenanceMessage || '' } : null;
}

// Is the website switched off (W1)? Same short cache as above.
export async function websiteMaintenance() {
  if (Date.now() - cache.at > 10000) cache = { at: Date.now(), row: await Settings.get() };
  return { on: !!cache.row?.webMaintenanceEnabled, message: cache.row?.webMaintenanceMessage || '' };
}

async function names(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  const accs = await A.accounts(list);
  return new Map(accs.map((a) => [a.id, displayNameOf(a)]));
}

// Everything on the Settings page.
export async function getSettings({ ctx = {} } = {}) {
  const [r, st, shop, owners, phones] = await Promise.all([Settings.get(), status(), shopDetails(), Settings.ownersWhoCanSignIn(), Settings.recentPhones(new Date(Date.now() - 7 * DAY))]);
  const N = await names([r?.maintenanceBy, r?.webMaintenanceBy, r?.maintenanceChangedBy, r?.updatesChangedBy, r?.shopChangedBy, r?.updatedBy]);
  const by = (id) => (id ? N.get(id) || 'Former team member' : null);
  const changed = (at, id) => (at ? { at: at.toISOString(), when: when(at), by: by(id) } : null);
  const thisBuild = buildOf(ctx.appVersion);
  return {
    maintenance: {
      staff: { ...st.maintenance.staff, since: when(r?.maintenanceSince), by: by(r?.maintenanceBy) },
      website: { ...st.maintenance.website, since: when(r?.webMaintenanceSince), by: by(r?.webMaintenanceBy) },
      changed: changed(r?.maintenanceChangedAt, r?.maintenanceChangedBy),
    },
    updates: {
      ...st.updates,
      thisPhone: { platform: ctx.platform || null, version: ctx.appVersion || null, build: thisBuild },
      // Before this module only the time was saved, never the person (migration v2_settings_updates_changed).
      changed: changed(r?.updatesChangedAt, r?.updatesChangedBy),
      phones: phones.map((p) => ({ name: p.name, person: displayNameOf(p.authAccount), platform: p.platform, build: buildOf(p.appVersion) })),
    },
    shop: { ...shop, saved: !!(r?.shopName || r?.shopAddress || r?.shopMobile || r?.shopGstin || r?.websiteUrl), changed: changed(r?.shopChangedAt, r?.shopChangedBy) },
    owners,
    server: { version: pkg.version },
    limits: LIMITS,
  };
}

const cleanMessage = (m) => String(m ?? '').replace(/\s+/g, ' ').trim();

// Staff app and website maintenance (6.2, 6.3).
export async function setMaintenance({ viewer, staff, website, ctx }) {
  const r = await Settings.get();
  const now = new Date();
  const data = {};
  const changes = {};
  const part = (key, input, enabledCol, messageCol, sinceCol, byCol) => {
    if (!input) return;
    const message = input.message !== undefined ? cleanMessage(input.message) : r?.[messageCol] ?? '';
    if (message.length > LIMITS.message) throw badRequest('MESSAGE_TOO_LONG', `Keep the message under ${LIMITS.message} characters.`);
    const on = input.on !== undefined ? !!input.on : !!r?.[enabledCol];
    if (on !== !!r?.[enabledCol]) {
      changes[`${key}On`] = { from: !!r?.[enabledCol], to: on };
      data[enabledCol] = on;
      data[sinceCol] = on ? now : null;
      data[byCol] = on ? viewer.id : null;
    }
    if (message !== (r?.[messageCol] ?? '')) { changes[`${key}Message`] = { from: r?.[messageCol] ?? '', to: message }; data[messageCol] = message; }
  };
  part('staff', staff, 'maintenanceEnabled', 'maintenanceMessage', 'maintenanceSince', 'maintenanceBy');
  part('website', website, 'webMaintenanceEnabled', 'webMaintenanceMessage', 'webMaintenanceSince', 'webMaintenanceBy');
  if (Object.keys(changes).length) {
    await Settings.save({ ...data, maintenanceChangedAt: now, maintenanceChangedBy: viewer.id, updatedBy: viewer.id });
    forgetCache();
    await audit('app_config_updated', { accountId: viewer.id, ctx, metadata: { section: 'maintenance', changes, actorId: viewer.id } });
  }
  return getSettings({ ctx });
}

// App updates (6.4): "require this version" and "tell phones" use this phone's own
// build; the numbers and links can also be set directly (Advanced).
export async function setUpdates({ viewer, platform, newest, oldest, required, link, requireThisPhone, tellThisPhone, ctx }) {
  const r = await Settings.get();
  const P = platform;
  const cur = { newest: r?.[`${P}LatestBuild`] ?? 0, oldest: r?.[`${P}MinBuild`] ?? 0, required: r?.[`${P}ForceUpdate`] ?? false, link: r?.[`${P}UpdateUrl`] ?? '' };
  const next = { ...cur };
  if (requireThisPhone || tellThisPhone) {
    const build = buildOf(ctx.appVersion);
    if (build == null || ctx.platform !== P) throw badRequest('NEEDS_THIS_PHONE', `Do this from ${P === 'ios' ? 'an iPhone' : 'an Android phone'} that already has the new version.`);
    next.newest = Math.max(cur.newest, build);
    if (requireThisPhone) next.oldest = Math.max(cur.oldest, build);
  }
  if (newest !== undefined) next.newest = newest;
  if (oldest !== undefined) next.oldest = oldest;
  if (required !== undefined) next.required = !!required;
  if (link !== undefined) next.link = String(link).trim();
  if (next.oldest > next.newest) throw badRequest('OLDEST_ABOVE_NEWEST', 'The oldest allowed version can\'t be above the newest.');
  // A version no phone has yet would stop every phone, owners' too, and only the database
  // could undo it: refused, as is one that would stop the phone making the change.
  const blocksBelow = (u) => Math.max(u.oldest || 0, u.required ? (u.newest || 0) : 0); // see mustUpdate
  if (blocksBelow(next) > blocksBelow(cur)) {
    const want = blocksBelow(next);
    const mine = ctx.platform === P ? buildOf(ctx.appVersion) : null;
    if (mine != null && want > mine) {
      throw badRequest('WOULD_BLOCK_THIS_PHONE', `This would ask this phone (version ${mine}) to update too. Install version ${want} on it first.`);
    }
    // Phones of this kind used in the last 60 days, and this phone itself (just updated).
    const seen = (await Settings.recentPhones(new Date(Date.now() - 60 * DAY))).filter((ph) => ph.platform === P).map((ph) => buildOf(ph.appVersion)).filter((b) => b != null);
    if (mine != null) seen.push(mine);
    const highest = seen.length ? Math.max(...seen) : null;
    if (highest != null && want > highest) {
      throw badRequest('NO_PHONE_HAS_IT', `No ${P === 'ios' ? 'iPhone' : 'Android phone'} has version ${want} yet (the newest in use is ${highest}). Requiring it would stop every phone. Check the number.`);
    }
  }
  if (next.link && !/^https:\/\/\S+$/.test(next.link)) throw badRequest('BAD_LINK', 'The store link must start with https://');
  const cols = { newest: `${P}LatestBuild`, oldest: `${P}MinBuild`, required: `${P}ForceUpdate`, link: `${P}UpdateUrl` };
  const changes = {};
  const data = {};
  for (const k of Object.keys(cols)) if (next[k] !== cur[k]) { changes[`${P}.${k}`] = { from: cur[k], to: next[k] }; data[cols[k]] = next[k]; }
  if (Object.keys(changes).length) {
    const now = new Date();
    await Settings.save({ ...data, updatesChangedAt: now, updatesChangedBy: viewer.id, updatedBy: viewer.id });
    await audit('app_config_updated', { accountId: viewer.id, ctx, metadata: { section: 'updates', platform: P, changes, actorId: viewer.id } });
  }
  return getSettings({ ctx });
}

// Shop details and the website address (6.5, 6.7): new invoices use them.
export async function setShop({ viewer, name, address, mobile, gstin, website, ctx }) {
  const before = await shopDetails();
  const next = { name: name.trim().replace(/\s+/g, ' '), address: address.trim().replace(/\s+/g, ' '), mobile, gstin: gstin.toUpperCase(), website: (website || '').trim().replace(/\/$/, '') };
  if (!GSTIN.test(next.gstin)) throw badRequest('BAD_GSTIN', 'That doesn\'t look like a GSTIN: 15 characters, like 37CCWPN2487C1Z2.');
  if (next.website && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(next.website)) throw badRequest('BAD_WEBSITE', 'The website address must start with https://, like https://nandamhandlooms.com');
  const changes = {};
  for (const k of ['name', 'address', 'mobile', 'gstin', 'website']) if (String(next[k]) !== String(before[k] ?? '')) changes[k] = { from: before[k] ?? '', to: next[k] };
  if (Object.keys(changes).length) {
    const now = new Date();
    await Settings.save({ shopName: next.name, shopAddress: next.address, shopMobile: next.mobile, shopGstin: next.gstin, websiteUrl: next.website || null, shopChangedAt: now, shopChangedBy: viewer.id, updatedBy: viewer.id });
    await audit('shop_details_updated', { accountId: viewer.id, ctx, metadata: { changes, actorId: viewer.id } });
  }
  return getSettings({ ctx });
}

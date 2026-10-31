// Home (Module 8): how the day is going and what needs doing. Owners get the money
// figures, unpaid checkouts, designs running low and the monthly reminder; staff get
// their own sarees and bills, never the shop's totals (plan sections 5, 6 and 8).
import { can, PERMISSION } from '../config/permissions.js';
import { appRoleOf } from '../models/authAccount.model.js';
import * as St from '../models/stats.model.js';
import * as O from '../models/order.model.js';
import * as P from '../models/product.model.js';
import * as S from '../models/sale.model.js';
import { LIMITS } from './product.service.js';
import { today } from './sale.service.js';
import { securityAlerts } from './activity.service.js';
import * as Settings from '../models/settings.model.js';
import { displayNameOf } from '../models/authAccount.model.js';
import { accounts } from '../models/activity.model.js';
import { istDayStart, istYmd, istRange, istDate, istDay, istTime } from '../utils/day.js';

const DAY = 24 * 60 * 60 * 1000;
export const RULES = { checkAfterDays: 10, unpaidDays: 7, invoiceDays: 30, soldOutDays: 30, reminderLastDay: 7 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const isOwner = (viewer) => can(appRoleOf(viewer), PERMISSION.SALES_VIEW);
const iso = (d) => (d ? d.toISOString() : null);
const weekday = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
export const dayLabel = (d) => weekday.format(d).replace(',', ''); // Mon 12 Oct

export const daysSince = (at, now = new Date()) => Math.max(0, Math.floor((now.getTime() - at.getTime()) / DAY));
export const monthStart = (now = new Date()) => istRange(`${istYmd(now).slice(0, 7)}-01`, istYmd(now)).from;
export const monthName = (now = new Date()) => MONTHS[Number(istYmd(now).slice(5, 7)) - 1];

// From the 1st to the 7th: last month's sales summary for the accountant (6.6).
export function monthReminder(now = new Date()) {
  const [y, m, d] = istYmd(now).split('-').map(Number);
  if (d > RULES.reminderLastDay) return null;
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const mm = String(pm).padStart(2, '0');
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return { month: MONTHS[pm - 1], key: `${py}-${mm}`, from: `${py}-${mm}-01`, to: `${py}-${mm}-${String(last).padStart(2, '0')}` };
}

const saleRow = (s) => ({ id: s.id, time: s.time, channel: s.channel, paymentMethod: s.paymentMethod, total: s.total, sarees: s.sarees, imageUrl: s.imageUrl, soldBy: s.soldBy, customer: s.customer });

export async function home({ viewer, now = new Date() }) {
  const owner = isOwner(viewer);
  const dayStart = istDayStart(now);
  const dayEnd = new Date(dayStart.getTime() + DAY);
  const day = await today({ viewer, now });
  const live = day.sales.filter((s) => !s.cancelled);

  const [toShip, oldest, check, missing, noPhoto] = await Promise.all([
    O.countTab('to_ship'),
    St.oldestToShip(),
    St.toCheck(new Date(now.getTime() - RULES.checkAfterDays * DAY)),
    St.invoiceMissing(new Date(now.getTime() - RULES.invoiceDays * DAY)),
    St.countNoPhoto(),
  ]);
  // Staff: an invoice missing on their own sales only.
  let mineMissing = missing;
  if (!owner && missing.length) {
    const sellerOf = await S.sellers(missing.map((o) => o.orderNumber));
    mineMissing = missing.filter((o) => sellerOf.get(o.orderNumber) === viewer.id);
  }
  const attention = {
    toShip: toShip ? { count: toShip, oldestDays: oldest ? daysSince(oldest.placedAt, now) : 0 } : null,
    toCheck: check.count ? { count: check.count, oldestShipped: istDay(check.oldestShippedAt), oldestId: check.oldestId } : null,
    invoiceMissing: mineMissing.slice(0, 5).map((o) => ({ id: o.id, orderNumber: o.orderNumber, date: istDate(o.placedAt), time: istTime(o.placedAt), today: o.placedAt >= dayStart })),
    invoiceMissingCount: mineMissing.length,
    noPhoto,
    unpaid: null,
    stock: null,
    monthSummary: null,
    security: null,
    maintenance: null,
  };

  let sales;
  let stock = null;
  if (owner) {
    const [yesterday, month, unpaid, designs, inStock, security, cfg] = await Promise.all([
      St.sumRange(new Date(dayStart.getTime() - DAY), dayStart),
      St.sumRange(monthStart(now), dayEnd),
      St.unpaidSince(new Date(now.getTime() - RULES.unpaidDays * DAY)),
      St.lowDesigns(new Date(now.getTime() - RULES.soldOutDays * DAY)),
      P.countInStock(),
      securityAlerts(now),
      Settings.get(),
    ]);
    const t = day.totals;
    sales = {
      today: { amount: t.amount, bills: t.count, sarees: t.sarees, cancelled: t.cancelled, byChannel: t.byChannel },
      yesterday,
      month: { name: monthName(now), ...month },
    };
    const soldOut = designs.filter((d) => d.left === 0).length;
    attention.unpaid = unpaid.tries ? unpaid : null;
    attention.stock = designs.length ? { soldOut, low: designs.length - soldOut } : null;
    attention.monthSummary = monthReminder(now);
    attention.security = security; // Module 10 (6.8): locked PINs and stolen sign-ins, last 24 hours
    // Module 11: while the staff app is paused, owners see since when and by whom.
    if (cfg?.maintenanceEnabled) {
      const [by] = cfg.maintenanceBy ? await accounts([cfg.maintenanceBy]) : [];
      attention.maintenance = { since: cfg.maintenanceSince ? istTime(cfg.maintenanceSince) : null, sinceDate: cfg.maintenanceSince ? istDate(cfg.maintenanceSince) : null, by: by ? displayNameOf(by) : null, message: cfg.maintenanceMessage || '' };
    }
    stock = { inStock, limit: LIMITS.inStock };
  } else {
    sales = { mine: day.counts }; // every bill of the day, not only the first page
  }

  return {
    date: istDate(now),
    day: dayLabel(now),
    updatedAt: iso(now),
    scope: owner ? 'everyone' : 'mine',
    sales,
    attention,
    recent: live.slice(0, 3).map(saleRow),
    stock,
  };
}

// The Running low page (6.5): designs sold out in the last 30 days, and designs with 1–3 left.
export async function runningLow({ now = new Date() } = {}) {
  const rows = await St.lowDesigns(new Date(now.getTime() - RULES.soldOutDays * DAY));
  const out = (r) => ({ id: r.id, name: r.name, category: r.category, imageUrl: r.imageUrl, left: r.left, soldRecent: r.soldRecent, lastSold: r.lastSold ? istDay(r.lastSold) : null });
  return { days: RULES.soldOutDays, soldOut: rows.filter((r) => r.left === 0).map(out), low: rows.filter((r) => r.left > 0).map(out) };
}

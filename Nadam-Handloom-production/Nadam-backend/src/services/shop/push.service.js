// Website notifications with Firebase (W1, web-01 section 10): a browser subscribes with
// its Firebase token, chooses topics, and the server sends. Order updates go only to the
// customer's own browsers; new arrivals and offers only with the customer's consent.
import { PUSH_TOPICS, MARKETING_TOPICS } from '../../config/constants.js';
import * as Push from '../../models/pushToken.model.js';
import * as Notification from '../../models/notification.model.js';
import * as Customer from '../../models/customer.model.js';
import { push } from '../push/index.js';
import { describeUserAgent } from '../../utils/userAgent.js';
import { shopAudit } from '../audit.service.js';
import { notFound, tooMany } from '../../utils/errors.js';

const TYPE_TOPIC = {
  order_paid: 'orders', order_shipped: 'orders', order_delivered: 'orders', payment_failed: 'orders', test: null,
  arrivals: 'arrivals', offers: 'offers',
};

const unique = (list) => [...new Set(list)];
// Visitors who are not signed in have no orders to hear about.
const allowedTopics = (topics, signedIn) => unique(topics.filter((t) => PUSH_TOPICS.includes(t) && (signedIn || t !== 'orders')));

async function recordConsent(account, topics, ctx) {
  if (account && topics.some((t) => MARKETING_TOPICS.includes(t)) && !account.userProfile?.marketingOptIn) {
    await Customer.updateProfile(account.id, { marketingOptIn: true, marketingOptInAt: new Date() });
    await shopAudit('shop_marketing_opt_in', { accountId: account.id, ctx, metadata: { via: 'push' } });
  }
}

export async function subscribe({ account, token, topics, ctx }) {
  const signedIn = !!account;
  const wanted = topics
    ? allowedTopics(topics, signedIn)
    : signedIn
      ? ['orders', ...(account.userProfile?.marketingOptIn ? MARKETING_TOPICS : [])]
      : ['arrivals'];
  const ua = describeUserAgent(ctx.userAgent);
  const existing = await Push.findByToken(token);
  if (!signedIn && existing?.authAccountId && !existing.removedAt) {
    // Not signed in, on a browser still linked to a customer: the link and its topics stay
    // (only signing in or "Sign out" changes who it belongs to); asked-for topics are added.
    const row = await Push.update(existing.id, { topics: unique([...existing.topics, ...wanted]), userAgent: ctx.userAgent, browser: ua.label, lastSeenAt: new Date() });
    await shopAudit('shop_push_subscribed', { accountId: null, ctx, metadata: { topics: row.topics, linked: true } });
    return { subscribed: true, topics: row.topics };
  }
  const row = await Push.upsert(
    token,
    { platform: 'web', authAccountId: account?.id ?? null, topics: wanted, userAgent: ctx.userAgent, browser: ua.label },
    { platform: 'web', authAccountId: account?.id ?? null, topics: wanted, userAgent: ctx.userAgent, browser: ua.label, lastSeenAt: new Date(), removedAt: null, removedReason: null },
  );
  if (topics) await recordConsent(account, wanted, ctx);
  await shopAudit('shop_push_subscribed', { accountId: account?.id ?? null, ctx, metadata: { topics: row.topics } });
  return { subscribed: true, topics: row.topics };
}

// Never says whether the token was known.
export async function unsubscribe({ account, token, ctx }) {
  const t = await Push.findByToken(token);
  if (t && !t.removedAt && (!t.authAccountId || t.authAccountId === account?.id)) {
    await Push.markRemoved([t.id], 'unsubscribed');
    await shopAudit('shop_push_unsubscribed', { accountId: account?.id ?? null, ctx });
  }
}

// What this browser gets now (the notifications page).
export async function status({ account, token }) {
  const t = await Push.findByToken(token);
  const mine = t && !t.removedAt && (!t.authAccountId || t.authAccountId === account?.id);
  return { subscribed: !!mine, topics: mine ? t.topics : [] };
}

export async function setTopics({ account, token, topics, ctx }) {
  const t = await Push.findByToken(token);
  if (!t || t.removedAt || (t.authAccountId && t.authAccountId !== account?.id)) {
    throw notFound('PUSH_NOT_SUBSCRIBED', 'Notifications are not on in this browser. Turn them on first.');
  }
  const wanted = allowedTopics(topics, !!account);
  const row = await Push.update(t.id, { topics: wanted, authAccountId: account?.id ?? t.authAccountId, lastSeenAt: new Date() });
  await recordConsent(account, wanted, ctx);
  return { subscribed: true, topics: row.topics };
}

// Sends one message to a list of tokens; removes tokens Firebase says are gone.
async function deliver(tokens, message) {
  let sent = 0;
  const failed = [];
  const gone = [];
  for (const t of tokens) {
    const r = await push.send({ ...message, token: t.token });
    if (r.ok) sent += 1;
    else {
      failed.push(r.error);
      if (r.invalidToken) gone.push(t.id);
    }
  }
  if (gone.length) await Push.markRemoved(gone, 'expired');
  return { sent, failed };
}

// For the orders module (W6, W7) and the test button: one customer's browsers.
// type: order_paid | order_shipped | order_delivered | payment_failed | arrivals | offers | test
export async function notifyCustomer({ accountId, type, title, body, link = null, data = null, onlyToken = null }) {
  const topic = TYPE_TOPIC[type] ?? null;
  const account = await Customer.findById(accountId);
  const note = await Notification.create({ authAccountId: accountId, channel: 'push', type, title, body, link, data });
  if (!account || Customer.isClosed(account) || (MARKETING_TOPICS.includes(topic) && !account.userProfile?.marketingOptIn)) {
    return Notification.update(note.id, { status: 'failed', error: 'no consent or no account' });
  }
  let tokens = await Push.activeForAccount(accountId, topic);
  if (onlyToken) tokens = tokens.filter((t) => t.token === onlyToken);
  if (!tokens.length) return Notification.update(note.id, { status: 'no_device' });
  const { sent, failed } = await deliver(tokens, { title, body, link, data: { ...(data || {}), notificationId: note.id, type }, tag: type });
  return Notification.update(note.id, {
    status: sent && failed.length ? 'partly_sent' : sent ? 'sent' : 'failed',
    sentCount: sent,
    failedCount: failed.length,
    error: failed.length ? failed.slice(0, 3).join('; ').slice(0, 300) : null,
    sentAt: sent ? new Date() : null,
  });
}

// "Send a test notification" on the notifications page: this browser only, 3 an hour.
export async function sendTest({ account, token, siteUrl, ctx }) {
  const recent = await Notification.countRecent(account.id, 'test', new Date(Date.now() - 3600_000));
  if (recent >= 3) throw tooMany('PUSH_TEST_LIMIT', 'You can send 3 test notifications an hour. Please try later.', { retryAfterSeconds: 3600 });
  const t = await Push.findByToken(token);
  if (!t || t.removedAt || t.authAccountId !== account.id) throw notFound('PUSH_NOT_SUBSCRIBED', 'Notifications are not on in this browser. Turn them on first.');
  const note = await notifyCustomer({
    accountId: account.id, type: 'test', title: 'Notifications are on', body: 'You will hear from Nandam Handlooms here about your orders.',
    link: siteUrl ? `${siteUrl}/account/notifications` : null, onlyToken: token,
  });
  await shopAudit('shop_push_test', { accountId: account.id, ctx, metadata: { status: note.status } });
  return { status: note.status };
}

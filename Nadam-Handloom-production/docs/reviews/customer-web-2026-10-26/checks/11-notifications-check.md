# Second check: Module 11, Notifications (web push)

| | |
|---|---|
| **Report checked** | [`../11-notifications.md`](../11-notifications.md) |
| **Date** | 26 Oct 2026 |
| **How** | Read the code only (server, website, service worker, and the old server one folder up). Nothing was run, built, tested or changed. No live server, Firebase or database was touched. |
| **Live facts used** | Everything in this code is live since 26 Oct ~13:55 IST (checkout, online payment, My orders). The live server sends through Firebase (`push: fcm`). The old server still runs on the same database. |

Paths below are short: `backend/` = `Nadam-backend/`, `web/` = `Nadam-frontend/customer-web/`, `old/` = `../backend/` (the old server, one folder above the project).

## Summary

27 findings checked: **23 ✅ correct, 4 ⚠️ partly correct, 0 ❌ wrong.**

| Id | Finding (one line) | Report's group | Verdict | Right group |
|---|---|---|---|---|
| M1 | "Turn off for this browser" is undone the next time the page opens | Must | ⚠️ | Should |
| M2 | Signing a device out (one device, safety, too many) leaves its order notifications on | Must | ✅ | Must |
| S1 | New arrivals and offers are promised but nothing ever sends them | Should | ✅ | Should |
| S2 | Failed notices never retried; restart loses queued ones; EventsOutbox "unused" | Should | ⚠️ | Should |
| S3 | Payment confirmation waits for Firebase; customer may see an error | Should | ⚠️ | Small |
| S4 | Signing in resets this browser's topics to the defaults | Should | ✅ | Should |
| S5 | A message while the site is in front is only an 8-second, untappable note | Should | ⚠️ | Small |
| S6 | Safari may cancel the subscription because foreground pushes show nothing | Should | ✅ | Should |
| S7 | Token only refreshed on the Notifications page; no change handler | Should | ✅ | Should |
| S8 | No notice for bank refusal, 3-day give-up, shop cancel, tracking change | Should | ✅ | Should |
| s1 | Same `tag` per type: a second message silently replaces the first | Small | ✅ | Small |
| s2 | Account consent switch and browser topic switches can disagree | Small | ✅ | Small |
| s3 | "Shop hasn't switched them on" shown while settings load or fail | Small | ✅ | Small |
| s4 | Firebase's technical error text shown to the customer | Small | ✅ | Small |
| s5 | Page says "on" but the test says "not on" (unlinked browser) | Small | ✅ | Small |
| s6 | Test limit (3 an hour) can be beaten with parallel presses | Small | ✅ | Small |
| s7 | Test text talks about orders even when Order updates is off | Small | ✅ | Small |
| s8 | Fast switch changes can show the wrong state | Small | ✅ | Small |
| s9 | Test mode can hide missing Firebase keys | Small | ✅ | Small (not happening on live today) |
| s10 | Tapping a notification moves the first site tab, even mid-checkout | Small | ✅ | Small |
| s11 | Any 404 from Firebase marks the token dead | Small | ✅ | Small |
| s12 | Visitor tokens are kept forever | Small | ✅ | Small |
| s13 | `readAt` is never filled | Small | ✅ | Small |
| M1b | Overview tile says "On" from the browser's permission only | (dev table) | ✅ | Small (part of M1) |
| M2b | A visitor can't see or stop a browser linked to someone else | (dev table) | ✅ | part of M2 |
| N1 | Token length rule uses Zod's default English text | (other notes) | ✅ | Note |
| N2 | Test link uses the first `SHOP_WEB_ORIGINS` entry; www/bare mismatch sends to home | (other notes) | ✅ | Note |

---

## M1. "Turn off for this browser" does not stay off — ⚠️ Partly correct (right group: Should)

**What is right (the bug is real, the cause is exactly as the report says):**
- Turn off: `web/src/pages/account/NotificationsPage.jsx:136-141` sends `DELETE /push/subscribe` (server marks the row removed, `backend/src/services/shop/push.service.js:58-59`), then `turnOff()` calls Firebase `deleteToken` and clears the saved copy (`web/src/push/push.js:82-88`). The browser's permission stays "granted" (a website cannot take it back).
- Next time the page mounts (any navigation back to it, or a reload), `check()` runs: permission is granted, so it calls `currentToken()` → `getToken()` (`NotificationsPage.jsx:100`, `push.js:71-80`). With permission already granted, Firebase's `getToken` makes a new push subscription and a new token without asking (well-known Firebase behaviour; very sure). The server doesn't know it, so `check()` calls `pushSubscribe(token)` with no topics (`NotificationsPage.jsx:105`).
- With no topics, a signed-in customer gets `orders`, plus `arrivals` and `offers` if the account said yes to marketing (`push.service.js:31-35`). So notifications are back on.
- Even if `deleteToken` failed, the same thing happens: the row is `removedAt` set, so `status()` says not subscribed (`push.service.js:67`) and `subscribe` clears `removedAt` (`push.service.js:48`).

**What is overstated:**
- "The customer cannot stop the messages without blocking the whole site" is not true. Switching all three topic switches off works and stays off: `setTopics` accepts an empty list (`backend/src/validators/shop/push.validators.js:6,10`), the token stays active with `topics: []`, `status()` then answers `subscribed: true` (`push.service.js:65-69`), so `check()` does not subscribe again (`NotificationsPage.jsx:105` only runs when `!s.subscribed`), and nothing is sent (sends filter by topic, `backend/src/models/pushToken.model.js:12-13`).
- What comes back is order updates (the customer's own orders, to their own browser) and marketing topics only if the account already said yes (and those are never sent today, see S1). So no data leaks and the customer is not stuck. It is an ignored "off" choice: likely and confusing, which is **Should fix**, not Must.

---

## M2. Signing a device out does not stop its order notifications — ✅ Correct (Must)

- One device signed out from "Signed-in devices": `signOutSession` only revokes the session (`backend/src/services/shop/session.service.js:238-245`). No PushToken change.
- Safety sign-out: `signOutForSafety` only revokes sessions (`session.service.js:130-136`).
- Too many devices: the oldest sign-in is revoked in `start()` (`session.service.js:77`, the report didn't cite this line), no PushToken change.
- Only `logout` (this browser, `session.service.js:186-194`) and `logoutAll` (`:198-207`) unlink tokens.
- The signed-out device's website just ends the sign-in (`web/src/auth/session.js:156-161` → `end()`, `:53-58`); it never unlinks its token.
- So the token keeps `authAccountId` = the customer and `orders`, and `notifyCustomer` keeps sending to it (`push.service.js:108`, `pushToken.model.js:12-13`). The texts carry the order number, amount, courier, tracking number and refund amount (`checkout.service.js:569`, `orderNotices.service.js:13`, `checkout.service.js:624`).
- On that device, a visitor gets "not on" (`push.service.js:67`), a Turn off is ignored (`:58`), and pressing the home box's button only adds topics to the linked row (`:38-44`) and says "on" until the next load, when `status()` says "not on" again. So the "flips" claim is right.
- Small wording note: a visitor never sees a "Turn off" button (account pages need sign-in, `web/src/App.jsx:81-91`); the visitor's only ways out are signing in with their own account (that relinks the token, `session.js:123-127`) or blocking the site in browser settings. This does not change the verdict.
- Group: a device the customer deliberately cut off keeps showing their order and payment details, even on the lock screen. That is a privacy hole: **Must** is right.

---

## S1. New-arrival alerts are promised but never sent — ✅ Correct (Should)

- The only callers of `notifyCustomer` are `checkout.service.js:567` (`order_paid`), `:622` (`payment_failed`), `orderNotices.service.js:28` (shipped/delivered) and `push.service.js:127` (test). Nothing sends `arrivals` or `offers`, and there is no admin route for it (`backend/src/routes/shop/index.js`, no broadcast service).
- `notifyCustomer` takes one `accountId` and reads `Push.activeForAccount(accountId, topic)` (`push.service.js:101-110`), so visitor tokens (`authAccountId` null) can never be reached by it.
- The promises: `web/src/pages/home/Alerts.jsx:45` ("Done. We will tell you when new sarees arrive.") and `:75`; `NotificationsPage.jsx:18-19` and `:79`.
- The old server doesn't send them either: it uses its own `DeviceToken` table for the staff app (`old/src/modules/notifications/notifications.service.ts`).

---

## S2. Failed notices never retried; a restart can lose them — ⚠️ Partly correct (Should)

**What is right:**
- Shipped/delivered notices are a promise chain in memory (`backend/src/services/shop/orderNotices.service.js:24-31`). On restart, `server.js:16-22` waits only for open requests, then closes the database and exits; the background chain is not waited for, so queued notices are lost.
- A Firebase failure sets the Notification row to `failed` (`push.service.js:111-118`); nothing ever reads Notification rows again (only `create`, `update`, `countRecent` exist, `backend/src/models/notification.model.js`), so no retry.
- "Order confirmed" is sent after the payment transaction commits (`checkout.service.js:531-532`); if the server stops in between, `checkPending` does not resend it (it only retries refunds and invoices, `checkout.service.js:706-727`).

**What is wrong:**
- "The EventsOutbox table ... nothing uses it" is not true. The **old server, still live on the same database**, writes `order.paid` rows into it (`old/src/modules/orders/orders.service.ts:204`) and sweeps it every 5 seconds (`old/src/index.ts:20`, `old/src/modules/events/events.service.ts:34-66`). Its sweep marks **every** undispatched row as dispatched, even event types it has no handler for (`events.service.ts:44-46`). So EventsOutbox is not a free safety net: anything this server put there would be taken by the old server within 5 seconds. (Section 4.4's "the new server never uses it" is correct.) The developer-table fix (a `queued` Notification row retried by `checkPending`) does not need EventsOutbox, so it is still fine.

Group: Should is fair (both triggers are rare, and the order page still shows the change).

---

## S3. The payment confirmation waits for Firebase — ⚠️ Partly correct (right group: Small)

**What is right:**
- `verify` → `settle` → `complete` → `await afterPaid()` (`checkout.service.js:413, 427, 532`) → `await notifyCustomer(...)` (`:567-570`). The refund path also awaits it (`:622-625`). `deliver` sends to each browser one after another (`push.service.js:87-88`), each with a 10-second limit per Google call (`backend/src/services/push/fcm.provider.js:9, 63, 80`), so a slow Google adds about 10 (up to 20 on a key renewal) seconds per browser. All right.

**What is wrong:**
- "The website gives up after 20 seconds" is wrong for this call. `verifyPayment` has its own 30-second limit (`web/src/api/shop.js:31`, `timeoutMs: 30000`); `client.js:10` is only the default.
- "A customer who has just paid can see an error on the payment page" is wrong. On a timeout (status 0, `web/src/api/errors.js:37`) `confirm()` waits and tries again, up to 4 times (`web/src/pages/checkout/usePayment.js:47-55`). Then it **always** goes to the order page (`:57-59`). The order was already committed as paid before `afterPaid` ran, so the next verify returns at once (`checkout.service.js:465-467`) and the order page shows "Order confirmed".
- Real effect: a longer "confirming" wait (about 30 s or more) only when Google is slow or unreachable. That is polish, so **Small**.

---

## S4. Signing in again throws away this browser's topic choices — ✅ Correct (Should)

- `relinkPush()` posts the token with no topics (`web/src/auth/session.js:123-127`).
- With no topics and a signed-in caller, the server uses the account defaults (`push.service.js:31-35`) and the upsert replaces the row's topics (`:45-48`).
- Both examples happen as described. A third one the report didn't name: a customer who switched **Order updates** off gets them back after signing out and in. Today the arrivals/offers part has no effect on what is sent (S1), but the switches change by themselves, which is confusing. Should is fair.

---

## S5. A message while the website is in front is easy to miss — ⚠️ Partly correct (right group: Small)

**What is right:**
- If a site tab is focused and visible, the worker only posts to it and does not call `showNotification` (`web/public/firebase-messaging-sw.js:39-44`), so nothing goes into the phone's list.
- The page shows it as an 8-second toast with no action (`web/src/App.jsx:51`); the toast is clickable only when an `action` is passed (`web/src/components/Toasts.jsx:12-26`), so "Tap to see it" (`orderNotices.service.js:13`) is false here.

**What is overstated:**
- "They ... never see the tracking number" is wrong: the order page shows the tracking card (`web/src/pages/orders/OrderPage.jsx:48, 149`; `web/src/orders/parts.jsx:83-100`) and My orders has a Track button (`parts.jsx:58`). It also needs the site to be open in front at the very moment the shop ships. So this is polish: **Small**.

---

## S6. Safari may cancel the subscription because foreground pushes show nothing — ✅ Correct (Should)

- The worker skips `showNotification` when a site tab is in front (`firebase-messaging-sw.js:39-44`).
- Platform behaviour (from what is known of WebKit, not tested here; fairly sure, not certain): Safari and iOS web apps do not allow "silent" pushes. A push that shows no notification counts as silent, and after a few of them (WebKit's limit is 3) Safari removes the push subscription. Chrome has an exception when a tab is focused; WebKit, as far as known, does not.
- It is even more likely than the report says: besides the test button, **"Order confirmed" is sent while the customer is on the order page right after paying** (`checkout.service.js:567`), which is the same foreground case on every iPhone purchase. And 3 tests an hour (`push.service.js:124`) is exactly enough to reach the limit.
- Once removed, Firebase answers "gone", and the server marks the token `expired` (`push.service.js:92-95`); order updates stop until the customer opens the Notifications page again.

---

## S7. A browser's token is only refreshed on the Notifications page — ✅ Correct (Should)

- `currentToken()` (`push.js:71-80`) is only called from `NotificationsPage.jsx:100`. `Alerts.jsx:25` and `session.js:124` only read the saved copy.
- The worker has no `pushsubscriptionchange` handler (`firebase-messaging-sw.js` has only `install`, `activate`, `push`, `notificationclick`).
- When a send fails as "gone", the server just marks the token removed (`push.service.js:92-95`).
- Known Firebase behaviour: the web SDK refreshes the token only when `getToken` is called, and Firebase treats web tokens as expired after long inactivity (about 270 days). So a customer who never revisits the page will stop getting messages without knowing. Should is fair.

---

## S8. Some order changes send nothing — ✅ Correct (Should)

- Bank refusal: `settle` only updates the attempt to `failed` (`checkout.service.js:443-448`).
- 3-day give-up: only an update to `failed` (`checkout.service.js:712-714`).
- Shop cancel: `cancelOrder` has no `tellCustomer` (`backend/src/services/order.service.js:271-305`).
- Tracking change: `changeTracking` has no `tellCustomer` (`order.service.js:236-250`).
- The design note says "What gets sent: order paid, shipped (DTDC number), delivered, payment failed" (`docs/modules/web-01-sign-in.md:138`), and `payment_failed` is used only for the refund message (`checkout.service.js:623`).

---

## Small items

**s1. Same tag replaces the first message silently — ✅ Correct.** `tag: type` (`push.service.js:111`) goes into `webpush.notification.tag` (`fcm.provider.js:43`) and the worker uses `n.tag || d.type` (`firebase-messaging-sw.js:35`). A notification with the same tag replaces the old one, and without `renotify: true` it makes no sound (standard browser behaviour).

**s2. Account switch and browser switches can disagree — ✅ Correct.** Turning consent off only changes `marketingOptIn` (`backend/src/services/shop/profile.service.js:58-61`); token topics stay. The page keeps `state.topics` (`NotificationsPage.jsx:179-190`, `:207`) and the home box reads `topics.includes('arrivals')` (`Alerts.jsx:28`). Sending checks consent (`push.service.js:105`), so it is display only.

**s3. Wrong reason while settings load — ✅ Correct.** Before `/config` answers, `config.push` is `null` (`web/src/config/config.js:21, 24`), so support is `not-configured` (`push.js:13`); `check()` returns at once (`NotificationsPage.jsx:97`) and the card shows "The shop hasn't switched them on yet" (`:23-25`). If `/config` fails, `push` stays `null` (`config.js:39-42`) and it is never retried (only called once, `web/src/main.jsx:25`). The loading case is a short flash; the failed case lasts until reload.

**s4. Technical error text — ✅ Correct.** `NotificationsPage.jsx:130` shows `ex.message` for anything but `PUSH_UNSUPPORTED`; Firebase errors read like "Messaging: … (messaging/token-subscribe-failed)."

**s5. Page and test can disagree — ✅ Correct.** `status()` treats an unlinked token as "mine" (`push.service.js:67`), so `check()` doesn't link it (`NotificationsPage.jsx:105`), but `sendTest` requires `t.authAccountId === account.id` (`push.service.js:126`).

**s6. Test limit race — ✅ Correct.** Count (`push.service.js:123`) and the new Notification row (`:104`, inside `notifyCustomer`) are separate steps with no lock, so parallel presses can all pass. Only the customer's own browser gets them.

**s7. Test text mentions orders — ✅ Correct.** Fixed text at `push.service.js:128`; the test goes regardless of topics (type `test` has no topic, `:14`, `:108`).

**s8. Fast switch changes — ✅ Correct.** The switch is only disabled when not subscribed (`NotificationsPage.jsx:207`); each change sends its own PATCH and the last reply to arrive wins (`:160-177`); a failure restores `before`, which can undo the other change.

**s9. Test mode can hide missing keys — ✅ Correct, but not happening on live today.** Without the three `FIREBASE_*` server values the provider silently becomes `console` (`backend/src/config/env.js:216-217`, `services/push/index.js:9`), which returns `ok: true` (`console.provider.js:8-15`) so rows say "sent". On live today the keys are set and the server uses `fcm`, so this is only a future-setup risk. `server.js:10` does not print the push provider at start, so nothing in the start line would warn.

**s10. Tapping a notification can move the wrong tab — ✅ Correct.** `firebase-messaging-sw.js:55-56` picks the first site tab and calls `navigate(link)`. `navigate` only works on tabs this worker controls; with `includeUncontrolled: true` it can pick one it doesn't control, and then the tab is focused but stays where it was (the linked page does not open, no fallback).

**s11. Any 404 marks the token dead — ✅ Correct (code).** `fcm.provider.js:93` treats any 404 as `invalidToken`, and `deliver` removes those tokens (`push.service.js:92-95`). Whether a wrong project id gives 404 (or 403) is not certain, as the report says; live sends work today, so this is only a future-setup risk.

**s12. Visitor tokens kept forever — ✅ Correct.** Clean-up deletes only rows removed 90+ days ago (`backend/src/jobs/cleanup.job.js:26`, `pushToken.model.js:24-25`); visitor rows are never sent to (S1), so Firebase never reports them gone. Old unlinked rows after sign-out stay too.

**s13. `readAt` never set — ✅ Correct.** Nothing in `backend/src` writes `readAt` (schema `prisma/schema.prisma:918`); the worker's click handler sends nothing to the server (`firebase-messaging-sw.js:50-60`).

---

## Extra findings in "For the developer"

**M1b. Overview tile — ✅ Correct.** `web/src/pages/account/OverviewPage.jsx:54` shows "On for this browser" from `Notification.permission` only, so it says "On" even after Turn off. Small, part of M1.

**M2b. Visitor can't see or stop a linked browser — ✅ Correct.** `push.service.js:38-44` (topics only added), `:58` (unsubscribe ignored), `:67` (status "not on"). Part of M2.

**N1. Zod default text — ✅ Correct.** `backend/src/validators/shop/common.js:83`: `.min(20).max(4096)` have no custom message (only "missing" and the regex do). The website always sends a real token, so customers won't see it.

**N2. Test link and www/bare address — ✅ Correct.** `backend/src/controllers/shop/public.controller.js:20` uses `env.shop.origins[0]`; the link is absolute (`push.service.js:129`), sent as `fcm_options.link` (`fcm.provider.js:45`), and the worker sends any other origin to the home page (`firebase-messaging-sw.js:11-18, 30`). Order links are relative, so only the test is affected. The live `SHOP_WEB_ORIGINS` value was not checked (no `.env` opened).

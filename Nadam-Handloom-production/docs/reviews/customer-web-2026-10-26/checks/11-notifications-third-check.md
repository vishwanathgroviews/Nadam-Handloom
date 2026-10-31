# Third check: Module 11, Notifications (web push)

| | |
|---|---|
| **Report** | [`../11-notifications.md`](../11-notifications.md) |
| **Second check** | [`11-notifications-check.md`](11-notifications-check.md) |
| **Date** | 26 Oct 2026 |
| **What was checked** | Only the 4 findings the second checker marked ⚠️ (M1, S2, S3, S5). None were marked ❌. |
| **How** | Read the code only: website, server, the background helper (service worker), the Firebase library the website uses, and the old server one folder up. Nothing was run, built, tested or changed. No live server, Firebase or database was touched. |

Short paths: `backend/` = `Nadam-backend/`, `web/` = `Nadam-frontend/customer-web/`, `old/` = `../backend/` (the old server), `fb/` = `web/node_modules/@firebase/messaging/dist/index.cjs.js` (Firebase messaging 0.13.3, the copy the website is built with).

## Summary

| Id | Finding | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| M1 | "Turn off for this browser" is undone the next time the Notifications page opens | Must fix: the customer can't stop messages without blocking the site | Bug and cause right, but the three topic switches do stop it; only the customer's own order updates come back: Should fix | **Second checker right** | **Should fix** |
| S2 | A failed notice is never tried again; a restart can lose shipped/delivered notices | Should fix; also "EventsOutbox is unused" | Right, except EventsOutbox: the old server writes to it and sweeps it every 5 seconds | **Second checker right** | **Should fix** |
| S3 | The payment confirmation waits for Firebase | Should fix: the site gives up after 20 s and the customer can see an error | The verify call has 30 s, tries again, and always ends on the order page: Small | **Second checker right** | **Small** |
| S5 | A message while the website is open is easy to miss | Should fix: the customer may never see the tracking number | The note really can't be tapped, but the tracking number stays on the order page: Small | **Second checker right** | **Small** |

Count: Second checker right 4 · First reviewer right 0 · Both partly right 0 · Neither right 0.

---

## M1. "Turn off for this browser" does not stay off

**What really happens**
1. Turn off: the website tells the server to stop this browser (`web/src/pages/account/NotificationsPage.jsx:139`; the server marks the row removed, `backend/src/services/shop/push.service.js:58-59`). Then it asks Firebase to delete the token and forgets the saved copy (`web/src/push/push.js:82-88`). The browser's "Allow" stays; a website can't take it back.
2. Firebase's delete also ends the browser's push subscription (`fb:805-816`, `pushSubscription.unsubscribe()`).
3. Next time the same customer opens My account → Notifications, `check()` sees "Allow" and asks Firebase for a token (`NotificationsPage.jsx:100`). Firebase has none stored, so it makes a new one (`fb:748` "No token, get a new one"), subscribing again without any question because "Allow" is still on (`fb:849-856`).
4. The server doesn't know the new token, so the page subscribes it with no topics (`NotificationsPage.jsx:105`). The server then gives `orders`, plus `arrivals` and `offers` only if the account already said yes to marketing (`push.service.js:31-35`). The page shows "Notifications are on for this browser" again.

**What comes back, and for whom**
- Only on this browser, only when **this signed-in customer** opens this page. The home box and sign-in use only the saved copy, which Turn off cleared (`web/src/pages/home/Alerts.jsx:25`, `web/src/auth/session.js:124`), so nothing else turns it back on.
- The token is linked to the caller's own account (`push.service.js:45-48`), so what arrives is that customer's own order updates. New arrivals and offers come back only where the account already said yes, and nothing sends them today (S1).
- No one else's details reach this device. So this is an ignored "off" choice (an annoyance and a broken promise), **not a privacy hole**. The privacy problem with devices that were signed out is a separate finding (M2).

**Is the customer stuck?** No. Switching the three topic switches off works and stays off: an empty list is allowed (`backend/src/validators/shop/push.validators.js:6,10`), the token stays active with no topics, `status()` then says "subscribed" (`push.service.js:65-69`), so the page doesn't subscribe again (`NotificationsPage.jsx:105`), and sends only go to tokens that have the topic (`backend/src/models/pushToken.model.js:12-13`). Blocking the site in browser settings also works. The workaround is not obvious, which is why it is still worth fixing.

**Why the first reviewer went wrong:** the bug and its cause are exactly right. The mistake is the weight: "cannot stop the messages" is not true (the switches work), and what returns is the customer's own order updates, not a leak.

**Second checker:** right on every point. I confirmed the "new token without asking" step in the Firebase code itself (the second checker called it well-known behaviour).

**Final:** Turn off is quietly undone when the customer comes back to the Notifications page, so their own order updates (and offers, if the account said yes) start again; on the page, only switching the three topics off lasts. **Should fix.**

---

## S2. A failed notice is never tried again; a restart can lose it

**What really happens**
- Shipped and delivered notices wait in a chain in the server's memory (`backend/src/services/shop/orderNotices.service.js:24-31`; called "in the background" at `backend/src/services/order.service.js:231` and `:265`).
- On a stop or restart the server only waits for open requests, then closes the database and exits (`backend/server.js:16-24`). The in-memory chain is not waited for, so a notice still waiting is lost.
- If Firebase fails, the Notification row is set to `failed` (`backend/src/services/shop/push.service.js:112-118`). Nothing ever reads these rows again: the model has only create, update and a count (`backend/src/models/notification.model.js:4-8`). No retry.
- "Order confirmed" is sent after the payment is saved (`backend/src/services/shop/checkout.service.js:531-532`, `:567`). The background check does not send it again for a paid order (`checkout.service.js:706-727`; a second settle sees the order already paid at `:465`).

**About EventsOutbox**
- The new server never touches it (no use in `backend/src`; only `backend/prisma/schema.prisma:718`). So section 4.4 "the new server never uses it" is right.
- But the old server, still running on the same database, writes `order.paid` rows into it (`old/src/modules/orders/orders.service.ts:204`), starts a sweep at every start (`old/src/index.ts:20`), runs it every 5 seconds (`old/src/modules/events/events.service.ts:57-62`), and marks **every** waiting row as done, even types it has no handler for (`events.service.ts:44-46`).
- So "nothing uses it" is wrong, and it could not be used as this server's retry list as it is: the old server would mark the rows done within 5 seconds.

**Why the first reviewer went wrong:** looked only at the new server; the old server shares the table.

**Second checker:** right. The developer table's own fix (keep the Notification row as `queued` and let the minute job send and retry it) does not need EventsOutbox, so the fix still stands.

**Final:** shipped/delivered notices wait only in memory and are lost on a restart, and any notice Firebase fails is never retried; the order page still shows the change. **Should fix.**

---

## S3. The payment confirmation waits for Firebase

**What really happens on the server**
- After paying, `verify` → `settle` → `complete` → `await afterPaid()` (`backend/src/services/shop/checkout.service.js:413, 427, 532`). `afterPaid` waits for the invoice (`:562`) and then for `notifyCustomer` (`:567-570`) before the answer goes back. The payment is already saved before this (`:461-529`).
- Each browser is sent one after another (`backend/src/services/shop/push.service.js:87-88`). Each Google call has a 10-second limit (`backend/src/services/push/fcm.provider.js:9, 63, 80`). So if Google hangs, each browser with Order updates adds about 10 s (about 20 s when the Google key must be renewed). A Firebase error can't break the answer: it is caught (`checkout.service.js:570`, `fcm.provider.js:82-84`).

**What the page does (the exact limits)**
- The usual limit of 20 s (`web/src/api/client.js:10`) is **not** used here: the verify call sets its own **30 s** (`web/src/api/shop.js:31`, `timeoutMs: 30000`).
- While waiting, the customer sees "Confirming your payment. Checking with Razorpay that the money arrived. Please don't close this page." (`web/src/pages/checkout/parts.jsx:60-66`).
- If 30 s pass, it becomes a timeout with status 0 (`web/src/api/client.js:65`, `web/src/api/errors.js:37`). `confirm()` does not show it: it waits 1.5 s, 3 s, 6 s and tries again, up to 4 tries (`web/src/pages/checkout/usePayment.js:47-55`). The second try finds the order already paid and answers at once (`checkout.service.js:465`). Then it **always** opens the order page (`usePayment.js:57-59`), which shows "Order confirmed" (`web/src/pages/orders/OrderPage.jsx:35`).
- The server has no request time limit of its own that would answer with an error first (none in `backend/src/app.js` or `backend/src/middlewares`). The verify rate limit (30, `backend/src/routes/shop/index.js:99`) is far above 4 tries.

**Why the first reviewer went wrong:** read the usual 20 s limit instead of the 30 s set on this call, and did not follow what `confirm()` does after a timeout. There is no error path on this page.

**Second checker:** right. One small addition: the wait also includes making the invoice (`checkout.service.js:562`), which is not Firebase.

**Final:** when Google is slow, the customer stares at "Confirming your payment" for about 10 to 30 seconds longer than needed, but always ends on the order page showing the order as paid. **Small.**

---

## S5. A message while the website is open is easy to miss

**What really happens**
- If a site tab is in front and focused, the background helper only passes the message to that tab and shows no phone notification (`web/public/firebase-messaging-sw.js:39-44`). So nothing stays in the phone's notification list.
- The tab shows it as an 8-second note (`web/src/App.jsx:51`, `ms: 8000`) with no action button; a note can only be pressed when an action is given (`web/src/components/Toasts.jsx:12-26`). The shipped text says "Tap to see it" (`backend/src/services/shop/orderNotices.service.js:13`), which is untrue here.

**What the customer can still see**
- The order page shows the courier and tracking number with a Copy button (`web/src/orders/parts.jsx:83-100`, used at `web/src/pages/orders/OrderPage.jsx:149`), and the progress line shows "Tracking …" (`OrderPage.jsx:48`).
- My orders has a Track button for shipped orders (`web/src/orders/parts.jsx:58`).
- It only happens if the site is open and in front at the very moment the shop ships or delivers. For "Order confirmed" the customer is already on the order page, which says it.

**Why the first reviewer went wrong:** "never see the tracking number" ignores the order page and My orders. The rest is right.

**Second checker:** right. (The bigger risk of this same "show nothing in front" rule on iPhone is S6, kept as Should fix.)

**Final:** a message that arrives while the site is open shows only as an 8-second note that can't be tapped and leaves nothing behind, though the order page still has all the details. **Small.**

# Module 11 — Notifications (web push): review

Date: 26 Oct 2026. Read-only review of the code on the Mac (server `Nadam-backend/`, website `Nadam-frontend/customer-web/`). Nothing was run, nothing was changed, the live server was not touched.

Paths below are short:
- Server files start at `Nadam-backend/`.
- Website files start at `Nadam-frontend/customer-web/`.

---

## 1. What this module does

A customer can say "yes, send me notifications" in their browser. After that, the shop's server can send small messages to that phone or computer: an order was paid, shipped or delivered, a refund started, or a test message. The home page also offers "Tell me about new arrivals". The messages travel through Google's free Firebase service (Firebase is Google's tool for sending these messages).

---

## 2. The steps a customer goes through

1. The customer presses **Turn on notifications** (My account → Notifications), or **Tell me about new arrivals** (home page). The browser never asks by itself when a page opens.
2. The browser shows its own question: "Allow notifications?" The customer presses Allow or Block.
3. If they press Allow, Firebase gives this browser a long secret address (called a "token").
4. The website sends this token to the shop's server. The server saves it, with the topics this browser wants: **Order updates**, **New arrivals**, **Offers**.
5. On iPhone and iPad this only works after **Share → Add to Home Screen**, then opening Nandam from the Home Screen (iOS 16.4 or later). The website explains this.
6. On My account → Notifications the customer can switch each topic on or off for this browser, press **Send a test notification**, or press **Turn off for this browser**. There is also one switch for the whole account: **New arrivals and offers** (their consent, meaning their "yes" to marketing).
7. When the shop marks a website order **shipped** or **delivered** in the admin app, or when an online payment is confirmed or refunded, the server sends a message to every browser of that customer that has Order updates on.
8. If the website is closed or in the background, the phone shows a normal notification. Tapping it opens the order page.
9. If the website is open and in front, no phone notification is shown. Instead a short message appears at the bottom of the page for 8 seconds.
10. **Sign out** on this browser stops Order updates here (the browser is unlinked from the account). **Sign out of all devices** does the same for every browser. Deleting the account removes all its browsers.

---

## 3. Each API

All five live under `/api/v2/shop/push` (`src/routes/shop/index.js:104-111`).

**Rules shared by all five:**
- Each network (one internet address) may make **60 requests a minute** in total across these five. This number comes from the server setting `RATE_LIMIT_PER_MINUTE` (`src/config/env.js:58`, `src/routes/shop/index.js:105`). If a network goes over, the server answers `RATE_LIMITED` (429): "Too many requests from this network. Please wait a minute and try again."
- If the website is switched off, the server answers `MAINTENANCE` (503) and the website shows the maintenance page.
- If a sign-in key is sent and it is bad, the server answers 401:
  - `ACCESS_TOKEN_EXPIRED`: the website renews the key quietly and tries again.
  - `SESSION_INVALID`, `SIGNED_OUT_REMOTELY`, `SIGNED_OUT_FOR_SAFETY`, `SESSION_EXPIRED` and similar: the customer is signed out and told why.
- A wrong token or topic gets `VALIDATION_FAILED` (400). The token must be 20 to 4096 characters, using only letters, digits and `_ : . -`. Each topic must be one of `orders`, `arrivals`, `offers`, with at most 3 in the list (`src/validators/shop/common.js:83`, `src/validators/shop/push.validators.js:6-10`).

### 3.1 `POST /push/subscribe` — "Turn on"

| | |
|---|---|
| **What it is for** | Saving this browser's token and the topics it should get. |
| **Who can use it** | Anyone. A visitor (not signed in) can never get `orders`: the server quietly drops it. |
| **What goes in** | `token` (required). `topics` (optional list). |
| **If no topics are sent** | Signed in: `orders`, plus `arrivals` and `offers` if the account already said yes to marketing. Visitor: `arrivals` only (`src/services/shop/push.service.js:31-35`). |
| **What is saved** | A row in **PushToken** is made or updated. It records who it belongs to (the signed-in customer, or nobody), the topics, the browser's name, the last-seen time, and it is marked active again. If a signed-in customer picks `arrivals` or `offers` and the account had not said yes, the account's marketing "yes" is switched on with the time (`push.service.js:22-27, 50`). Activity log: `shop_push_subscribed`, and `shop_marketing_opt_in` when consent is recorded. |
| **Special case** | A visitor on a browser that is still linked to a customer: the link and its topics stay, and the asked-for topics are added (`push.service.js:38-44`). |
| **What comes back** | `{ subscribed: true, topics: [...] }` |
| **What can go wrong** | Only the shared errors above. On the Notifications page an error shows as a red message, using the server's words. On the home box it shows "Alerts couldn't be turned on. Please try again." |

### 3.2 `DELETE /push/subscribe` — "Turn off"

| | |
|---|---|
| **What it is for** | Stopping notifications on this browser. |
| **What goes in** | `token`. Signing in is optional. |
| **What the server checks** | The token must be active and either belong to nobody or belong to the person asking. If not, the server quietly does nothing. It never says whether the token was known (`push.service.js:56-62`). |
| **What is saved** | PushToken gets `removedAt` = now and `removedReason` = `unsubscribed`. Activity log: `shop_push_unsubscribed`. |
| **What comes back** | Nothing (204). |
| **What can go wrong** | Only the shared errors. The website ignores any error here and turns Firebase off anyway (`NotificationsPage.jsx:139-140`). |

### 3.3 `POST /push/status` — "Is this browser on?"

| | |
|---|---|
| **What it is for** | The Notifications page and the home box use it to ask what this browser gets. |
| **What goes in** | `token`. Signing in is optional. |
| **What the server checks** | It answers "on" only if the token is active **and** either belongs to nobody or belongs to the person asking (`push.service.js:65-69`). |
| **What is saved** | Nothing. |
| **What comes back** | `{ subscribed: true/false, topics: [...] }` |
| **What can go wrong** | Only the shared errors. |

### 3.4 `PATCH /push/preferences` — "Choose topics"

| | |
|---|---|
| **What it is for** | The topic switches on the Notifications page, and the home box when the browser is already on. |
| **What goes in** | `token` and `topics` (a list, which may be empty). Visitors lose `orders`. |
| **What the server checks** | The token must be active and not linked to a different customer. |
| **What is saved** | The topic list is replaced. If the customer is signed in, the token is linked to them. The last-seen time is updated. Picking `arrivals` or `offers` switches the account's marketing "yes" on (`push.service.js:71-80`). |
| **What comes back** | `{ subscribed: true, topics: [...] }` |
| **What can go wrong** | `PUSH_NOT_SUBSCRIBED` (404): "Notifications are not on in this browser. Turn them on first." The website shows this in red and flips the switch back. |

### 3.5 `POST /push/test` — "Send a test notification"

| | |
|---|---|
| **What it is for** | The test button on the Notifications page. |
| **Who can use it** | Signed-in customers only. |
| **What goes in** | `token`. |
| **What the server checks** | (1) No more than **3 tests per account per hour**, counted from saved Notification rows. (2) The token must be active and linked to **this** account (`push.service.js:122-126`). |
| **What it sends** | Title "Notifications are on", text "You will hear from Nandam Handlooms here about your orders." It goes to this browser only. Tapping it opens `/account/notifications` on the website's first allowed address. |
| **What is saved** | A **Notification** row: type `test`, plus the result (sent / failed / no_device / partly_sent, the counts and the error). If Firebase says the token is dead, the token is marked removed (`expired`). Activity log: `shop_push_test`. |
| **What comes back** | `{ status: "sent" | "failed" | "no_device" | "partly_sent" }`. The website says "Test sent. It should appear in a few seconds." only for `sent`. Anything else gets "The test couldn't be delivered. Try turning notifications off and on." |
| **What can go wrong** | `NOT_SIGNED_IN` (401). `PUSH_TEST_LIMIT` (429): "You can send 3 test notifications an hour. Please try later." `PUSH_NOT_SUBSCRIBED` (404). Each is shown as a red message. |

---

## 4. The data kept

### 4.1 PushToken — one row per browser that said yes (`prisma/schema.prisma:883-901`)

| Field | What it means | Must have it? |
|---|---|---|
| id | The row's own number | Made automatically |
| token | The browser's Firebase address (long secret text) | Yes. **Unique**: one row per address |
| platform | `web` (phones are for later) | Yes. Always `web` today |
| authAccountId | Which customer it belongs to. Empty for a visitor | No. If the account row is removed, this becomes empty |
| topics | List of `orders` / `arrivals` / `offers` | No. Starts as an empty list |
| userAgent | The browser's full self-description | No |
| browser | Short name, e.g. "Chrome on Android" | No |
| lastSeenAt | Last time it was turned on or its topics changed | Starts as now |
| removedAt | When it stopped. Empty means still active | No |
| removedReason | `unsubscribed`, `expired` (Firebase says dead) or `account_deleted` | No |
| createdAt / updatedAt | When made or changed | Automatic |

Rows that were removed more than 90 days ago are deleted by the clean-up job (`src/jobs/cleanup.job.js:26`). Rows that are still active are never deleted.

### 4.2 Notification — every message the server tried to send (`prisma/schema.prisma:904-925`)

| Field | What it means | Must have it? |
|---|---|---|
| id | Row number | Automatic |
| authAccountId | The customer it was for | No |
| channel | `push` today (SMS and email later) | Yes |
| type | `order_paid`, `order_shipped`, `order_delivered`, `payment_failed` (used for refunds), `test`. `arrivals` and `offers` exist on paper but are never sent | Yes |
| title / body | The words shown | Yes |
| link | The page opened on tap, e.g. `/order/NH…` | No |
| data | Extra details, e.g. the order number | No |
| status | `queued` → `sent` / `partly_sent` / `failed` / `no_device` | Starts as `queued` |
| sentCount / failedCount | How many browsers got it / failed | Start at 0 |
| error | The first Firebase errors (max 300 characters) | No |
| sentAt | When it went | No |
| readAt | Meant for "opened". **Never filled today** | No |
| createdAt | When made | Automatic |

These rows are never deleted.

### 4.3 The customer's consent (on UserProfile, `prisma/schema.prisma:76-77`)

| Field | What it means | Must have it? |
|---|---|---|
| marketingOptIn | Yes or no to "new arrivals and offers" for the whole account | Starts as **no** |
| marketingOptInAt | When that answer last changed | No |

This consent is set by the tick at sign-up, by the account switch on the Notifications page, or automatically when the customer switches on New arrivals or Offers for a browser. It is wiped when the account is deleted.

### 4.4 EventsOutbox (`prisma/schema.prisma:714-726`)

This is a table meant for "write the event now, send it reliably later". Its fields are id, eventType, payload, dispatched (starts as no) and createdAt. **The new server never uses it.**

### 4.5 In the browser

- `nh-push-token` in the browser's local storage: a copy of the token, so Sign out can unlink it (`src/push/token.js`).
- Firebase keeps its own copy of the token in the browser.

---

## 5. On the website

### 5.1 Home page — "New-arrival alerts" box (`src/pages/home/Alerts.jsx`)

- **Text:** "Be the first to see new sarees. New pieces reach the store every week. Get one short alert on this phone or computer when they go up. No email, no spam; turn it off any time."
- **The browser can do notifications:** the button **Tell me about new arrivals** shows. Pressing it brings the browser's Allow question, then saves the topic `arrivals` (plus `orders` for signed-in customers). The customer then sees "Done. We will tell you when new sarees arrive." The box changes to "Alerts are on for this device", with a **Manage** link if signed in.
- **Blocked:** "Notifications are blocked in this browser. You can allow them in the site settings next to the address bar." A WhatsApp button shows too.
- **iPhone not on the Home Screen:** "On iPhone, tap Share then Add to Home Screen, open Nandam from there and turn alerts on."
- **Not supported, or Firebase settings missing:** a **Get new arrivals on WhatsApp** button.
- **Error:** "Alerts couldn't be turned on. Please try again."
- **Important:** nothing in the server ever sends a new-arrival alert (see 6, Should fix 1).

### 5.2 My account → Notifications (`src/pages/account/NotificationsPage.jsx`)

- **While loading:** a grey placeholder.
- **Firebase settings missing:** "Notifications aren't available yet. The shop hasn't switched them on yet."
- **Not https:** "Notifications need a secure (https) address."
- **iPhone/iPad not on the Home Screen:** three steps (Share → Add to Home Screen → open from there). It notes that iOS 16.4 or later is needed.
- **Browser can't do it:** "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari on a computer or an Android phone."
- **Blocked:** "Notifications are blocked on this browser", with how to allow them (lock icon → Notifications → Allow → reload).
- **Off:** "Get updates on this device. Order shipped, delivered, new arrivals: straight to this phone or computer." There is a **Turn on notifications** button.
  - Success: "Notifications are on for this browser".
  - If the customer presses Block: "Notifications were blocked. You can allow them later in the browser's site settings."
  - Other errors: a red message.
- **On:** "Notifications are on for this browser", with **Send a test notification** and **Turn off for this browser** buttons.
- **"On this browser" table:** three switches.
  - Order updates: "Paid, shipped with the tracking number, delivered".
  - New arrivals: "When new collections arrive".
  - Offers and festive sales: "Only if you want them".
  - Each change shows "Saved", or a red error and the switch flips back. The switches are greyed out while notifications are off.
- **"New arrivals and offers" card:** one account-wide switch. Its text says it covers "every channel we use … Order updates are always sent."
- **When the page opens:** if the browser already allowed notifications, the page gets the token from Firebase. If the server doesn't know this browser for this customer, the page **turns it on automatically** (`NotificationsPage.jsx:96-110`). See Must fix 1.

### 5.3 My account overview tile (`src/pages/account/OverviewPage.jsx:54`)

The tile says "On for this browser" whenever the **browser** allows notifications. It does not check whether the shop is actually sending to this browser.

### 5.4 Sign in and Sign out (`src/auth/session.js`)

- **After signing in:** if this browser has a saved token and allows notifications, it is linked to the customer who just signed in. It is saved with that customer's default topics (`session.js:115-127`).
- **Sign out:** the token is sent with the sign-out. The server unlinks the browser and drops `orders` (`src/services/shop/session.service.js:177-194`).
- **Sign out of all devices:** every browser of the customer is unlinked (`session.service.js:198-207`).
- **Signing out one device from "Signed-in devices", or the automatic safety sign-out:** browsers are **not** unlinked (see Must fix 2).
- **Account deleted after 7 days:** every browser is removed and unlinked (`src/services/shop/account.service.js:76`).

### 5.5 The notification itself (`public/firebase-messaging-sw.js`)

A small background helper in the browser (a "service worker") receives each message.
- **Website closed, or in the background:** it shows a normal notification with the shop's icon. Tapping it opens the right page (for example `/order/NH…`). If a tab of the site is already open, that tab is reused. Only links on the shop's own website are opened.
- **Website open and in front:** no phone notification. The page shows an 8-second message at the bottom: "Title: text" (`src/App.jsx:51`).

### 5.6 When the Firebase settings are missing

- If the server has no public Firebase values, it sends `push: null` (`src/services/shop/config.service.js:22`). The website then shows "not available yet" on the Notifications page and the WhatsApp button on the home page.
- If the server's own Firebase keys are missing, it quietly uses **test mode**. Nothing is really sent, but every message is still recorded as "sent" (`src/config/env.js:216-217`, `src/services/push/index.js:9`).

### 5.7 Which events send a notification today

| Event | Sent? | What the customer reads | Where in the code |
|---|---|---|---|
| Online payment confirmed | **Yes** (browsers with Order updates on) | "Order confirmed — Thank you! Order NH… is paid (₹…). We pack it within 2 working days." | `src/services/shop/checkout.service.js:566-571` |
| Shop marks a website order shipped (admin app) | **Yes** | "Your order has shipped — NH… is on its way with DTDC. Tracking number …. Tap to see it." | `src/services/order.service.js:231`, `src/services/shop/orderNotices.service.js:10-15` |
| Shop marks it delivered | **Yes**, once | "Your order was delivered — NH… was delivered. We hope you love it." | `order.service.js:265` |
| Payment refunded (sarees sold before the money arrived, wrong amount, paid twice) | **Yes** | "Your payment is being refunded — … goes back to your account in 5 to 7 working days." | `checkout.service.js:621-626` |
| Test button | **Yes**, this browser only | "Notifications are on" | `src/services/shop/push.service.js:122-133` |
| Payment refused by the bank | **No** | — | `checkout.service.js:443-448` |
| Payment stuck "confirming" for 3 days, then given up | **No** | — | `checkout.service.js:712-714` |
| Shop cancels a website order (money due back) | **No** | — | `order.service.js:271-305` |
| Tracking number corrected after shipping | **No** | — | `order.service.js:236-250` |
| **New arrivals** (promised on the home page and the Notifications page) | **No: no code sends it** | — | nothing calls `notifyCustomer` with `arrivals` |
| **Offers / festive sales** | **No: no code sends it** | — | same |
| Counter or WhatsApp orders | No (on purpose) | — | `orderNotices.service.js:26` |

### 5.8 Checked and fine

- **Both ends match:** the website and server use the same field names (`token`, `topics`, and `pushToken` on sign-out) and the same three topics.
- **Visitors** can never get order updates.
- **Consent:** new arrivals and offers are checked against the account's "yes" at the moment of sending.
- **Dead tokens:** when Firebase says a token is dead, it is marked removed.
- **No one can attach their browser to someone else's account.** The account always comes from the caller's own sign-in, and tokens can't be guessed.
- **The test button** only reaches the customer's own browser, and only 3 times an hour.
- **Duplicate tokens:** the token is unique in the database, and the save is a single database step, so two saves at once don't clash.

---

## 6. Problems found

### Must fix

**M1. "Turn off for this browser" does not stay off.**
- **What happens:** the next time the customer opens My account → Notifications, the page quietly turns notifications back on. If the account said yes to marketing, it also switches New arrivals and Offers back on.
- **Example:** a customer turns them off, visits My orders, and comes back. Notifications are on again with a fresh token. The overview tile also keeps saying "On for this browser".
- **Why it matters:** the customer cannot stop the messages without blocking the whole site in browser settings. It also ignores their choice about offers.
- **Where:**
  - `Nadam-frontend/customer-web/src/pages/account/NotificationsPage.jsx:100` and `:105`: the page asks Firebase for a token and subscribes when the server doesn't know it.
  - `src/push/push.js:71-80`: asking Firebase for a token when the browser allows it simply makes a new one.
  - `NotificationsPage.jsx:136-146`: Turn off leaves the browser's "allow" in place.
  - `src/pages/account/OverviewPage.jsx:54`: the tile only checks the browser's "allow".

> **Second check: ⚠️ Partly correct: the bug and its cause are exactly right, but the customer is not stuck: switching all three topic switches off stops the messages and stays off (status then says subscribed with no topics, so the page doesn't re-subscribe). What comes back is the customer's own order updates (marketing only if the account already said yes), so this is Should fix, not Must.**
> **Third check: Second checker right. Final: Turn off is quietly undone when the same customer comes back to the Notifications page, so their own order updates (and offers, if the account said yes) start again; on the page only switching the three topics off lasts, so it is an ignored choice, not a privacy leak. Final group: Should fix.**

**M2. Signing a device out does not stop its order notifications.**
- **What happens:** this covers signing a device out from "Signed-in devices", the automatic "signed out for your safety", and the oldest sign-in ended after too many devices. In all three, that device keeps getting the customer's order notifications: order number, amount paid, courier, tracking number and refund amount.
- **Example:** someone on that device (a shared family phone, a shop computer, or a thief after a safety sign-out) cannot turn them off from the website. The server tells a visitor "not on", ignores their Turn off, and the home box flips between "on" and the button.
- **Why it matters:** the customer believes that device is cut off, but their order details keep showing on it, even on the lock screen. Only "Sign out of all devices" unlinks browsers today.
- **Where:**
  - `Nadam-backend/src/services/shop/session.service.js:238-245`: one device signed out; browsers not unlinked.
  - `session.service.js:130-136`: safety sign-out; browsers not unlinked.
  - Compare `session.service.js:198-207`, which does unlink.
  - `src/services/shop/push.service.js:38-44`, `:58` and `:67`: a visitor can't see or stop a browser linked to someone else.

> **Second check: ✅ Correct.**

### Should fix

**S1. New-arrival alerts are promised but never sent.**
- **What happens:** the home box says "Done. We will tell you when new sarees arrive." The Notifications page offers "New arrivals" and "Offers". But no code anywhere sends them, and there is no admin button to send them.
- **Visitors get nothing either:** the sending code only reaches signed-in customers, one account at a time. So a visitor who turns alerts on could never get one, even once sending is built.
- **Why it matters:** customers wait for alerts that never come, and the shop loses the "come back" effect the box promises.
- **Where:**
  - `Nadam-frontend/customer-web/src/pages/home/Alerts.jsx:45` and `:75`
  - `src/pages/account/NotificationsPage.jsx:18-19` and `:79`
  - `Nadam-backend/src/services/shop/push.service.js:101-119` (sends to one account only; nothing calls it with `arrivals` or `offers`)

> **Second check: ✅ Correct.**

**S2. A notification that fails is never tried again. A server restart can lose it completely.**
- **What happens:** "shipped" and "delivered" are queued only in the server's memory. If the server restarts (for example during an update) in the moment after the shop presses Ship, that message is gone.
- **If Firebase is briefly down:** the message is marked "failed" and nobody retries it. The same applies to "Order confirmed" if the server stops just after a payment.
- **Unused safety net:** the EventsOutbox table was made for exactly this, but nothing uses it.
- **Where:**
  - `Nadam-backend/src/services/shop/orderNotices.service.js:24-31`
  - `src/services/shop/push.service.js:83-97` and `:112-118`
  - `prisma/schema.prisma:714-726`

> **Second check: ⚠️ Partly correct: the in-memory queue, the lost notices on restart and the missing retry are right, but EventsOutbox is not unused: the old server, still live on the same database, writes `order.paid` rows to it and sweeps it every 5 seconds, marking every undispatched row as dispatched, so it cannot serve as this server's retry queue. Should fix is fair.**
> **Third check: Second checker right. Final: shipped and delivered notices wait only in the server's memory and are lost on a restart, and any notice Firebase fails is never retried (EventsOutbox is taken by the old server, so it is no ready safety net). Final group: Should fix.**

**S3. The payment confirmation waits for Firebase.**
- **What happens:** after a customer pays, the server sends "Order confirmed" **before** it answers the payment page. Each browser can add 10 to 20 seconds if Google is slow or unreachable. The website gives up after 20 seconds.
- **Why it matters:** a customer who has just paid can see an error on the payment page. The order is in fact paid. This is likelier for a customer with two or more browsers turned on.
- **Where:**
  - `Nadam-backend/src/services/shop/checkout.service.js:532` and `:566-571` (also the refund message at `:621-626`)
  - `src/services/push/fcm.provider.js:9` and `:55-85`
  - `Nadam-frontend/customer-web/src/api/client.js:10`

> **Second check: ⚠️ Partly correct: the server does wait for Firebase before answering, but the verify call has its own 30-second limit (`src/api/shop.js:31`), and on a timeout `usePayment.confirm` retries and then always opens the order page, which shows the order as paid. The customer sees a longer "confirming" wait, not an error, so this is Small.**
> **Third check: Second checker right. Final: when Google is slow the customer waits about 10 to 30 seconds longer on "Confirming your payment", but always lands on the order page showing it paid, with no error. Final group: Small.**

**S4. Signing in again throws away this browser's topic choices.**
- **What happens:** at sign-in the browser is saved again with the account's **default** topics.
- **Examples:**
  - A visitor who turned on new-arrival alerts loses them at sign-in, unless the account had already said yes to marketing.
  - A customer who switched Offers off on this browser gets Offers back.
- **Where:**
  - `Nadam-frontend/customer-web/src/auth/session.js:123-127` (subscribes with no topics)
  - `Nadam-backend/src/services/shop/push.service.js:31-35` and `:45-49` (replaces the topics)

> **Second check: ✅ Correct.**

**S5. A message that arrives while the website is open is easy to miss.**
- **What happens:** the message shows only as an 8-second note at the bottom of the page. It says "Tap to see it", but it cannot be tapped. Nothing is left in the phone's notification list afterwards.
- **Example:** the customer is browsing sarees when their order ships. They miss the note and never see the tracking number.
- **Where:**
  - `Nadam-frontend/customer-web/public/firebase-messaging-sw.js:39-44`
  - `src/App.jsx:51`
  - `Nadam-backend/src/services/shop/orderNotices.service.js:13`

> **Second check: ⚠️ Partly correct: the foreground note really is untappable and leaves nothing in the phone's list, but the customer does not "never see the tracking number": the order page shows the tracking card and My orders has a Track button. It also needs the site open in front at the exact moment, so this is Small.**
> **Third check: Second checker right. Final: a message that arrives while the site is open shows only as an 8-second note that can't be tapped and leaves nothing behind, but the order page and My orders still show the tracking number. Final group: Small.**

**S6. On iPhone and Safari, the same "open in front, so show nothing" rule may make Safari cancel the site's notifications.**
- **The rule:** Apple's rule is that every message must show a notification.
- **Why the test button is risky:** the customer presses it with the page open and in front, which is exactly this case.
- **Not sure:** I could not test on an iPhone, and I don't know whether Safari makes an exception when the site is in front.
- **Where:** `Nadam-frontend/customer-web/public/firebase-messaging-sw.js:39-44`

> **Second check: ✅ Correct.**

**S7. A browser's token is only refreshed on the Notifications page.**
- **What happens:** if Firebase or the browser changes the token, the server keeps the old one. Messages stop without anyone noticing. The server only finds out when a send fails, and then it just removes the token.
- **What is missing:** the home page and sign-in only use the saved copy. The background helper has no handler for "the browser changed its address".
- **Not sure:** how often this happens in practice.
- **Where:**
  - `Nadam-frontend/customer-web/src/push/push.js:71-80`, which is only called from `src/pages/account/NotificationsPage.jsx:100`
  - `src/pages/home/Alerts.jsx:25` and `src/auth/session.js:124` (both use the saved copy)
  - `public/firebase-messaging-sw.js`

> **Second check: ✅ Correct.**

**S8. Some order changes the customer cares about send nothing.**
- **Which changes:**
  - a payment the bank finally refuses;
  - a payment given up after 3 days of "confirming";
  - an order the shop cancels (money is due back);
  - a corrected tracking number (the earlier "shipped" message showed the wrong one).
- **What the plan said:** the design note (web-01 section 10) lists "payment failed" as sent. In the code, `payment_failed` is only used for refunds.
- **Where:**
  - `Nadam-backend/src/services/shop/checkout.service.js:443-448` and `:712-714`
  - `src/services/order.service.js:271-305` and `:236-250`

> **Second check: ✅ Correct.**

### Small

- **A second message of the same kind silently replaces the first.**
  - Example: two orders shipped the same day. The phone keeps only the last "shipped" message, and it makes no sound.
  - Where: `Nadam-backend/src/services/push/fcm.provider.js:43`, `src/services/shop/push.service.js:111`, `Nadam-frontend/customer-web/public/firebase-messaging-sw.js:35`

  > **Second check: ✅ Correct.**
- **The account switch and the browser switches can disagree.**
  - Example: the customer turns off "New arrivals and offers" for the account. The New arrivals switch for this browser still shows on, and the home box still says "Alerts are on".
  - Where: `Nadam-frontend/customer-web/src/pages/account/NotificationsPage.jsx:179-190` and `:207`, `src/pages/home/Alerts.jsx:28`, `Nadam-backend/src/services/shop/profile.service.js:58-61`

  > **Second check: ✅ Correct.**
- **Wrong reason shown while settings load.** "The shop hasn't switched them on yet" appears while the website's settings are still loading, or if they failed to load because of a weak connection.
  - Where: `Nadam-frontend/customer-web/src/pages/account/NotificationsPage.jsx:23-25` and `:90`, `src/config/config.js:21` and `:39-42`

  > **Second check: ✅ Correct.**
- **Technical error text.** If Firebase fails while turning on, the customer sees Firebase's technical English (e.g. "Messaging: … (messaging/token-subscribe-failed)").
  - Where: `Nadam-frontend/customer-web/src/pages/account/NotificationsPage.jsx:130`

  > **Second check: ✅ Correct.**
- **The page and the test button can disagree.** The page can say "Notifications are on" while the test answers "Notifications are not on in this browser". This happens when the browser isn't linked to the account, for example when the link at sign-in failed. The page treats an unlinked browser as "mine"; the test does not.
  - Where: `Nadam-backend/src/services/shop/push.service.js:67` vs `:126`

  > **Second check: ✅ Correct.**
- **The test limit can be beaten.** Pressing the test button many times at once can get past "3 an hour", because the count and the send are separate steps. It only reaches the customer's own browser.
  - Where: `Nadam-backend/src/services/shop/push.service.js:123-127`

  > **Second check: ✅ Correct.**
- **The test text can be wrong.** It says "You will hear … about your orders" even when Order updates is off on that browser.
  - Where: `Nadam-backend/src/services/shop/push.service.js:128`

  > **Second check: ✅ Correct.**
- **Fast switch changes can show the wrong state.** Two quick changes can come back from the server in the wrong order. The switches are not locked while saving.
  - Where: `Nadam-frontend/customer-web/src/pages/account/NotificationsPage.jsx:160-177`

  > **Second check: ✅ Correct.**
- **Test mode can hide missing keys.** If the server's Firebase keys are missing on the live server, it quietly uses test mode. Records say "sent" and the test button says "Test sent", but nothing arrives.
  - Where: `Nadam-backend/src/config/env.js:215-217`, `src/services/push/index.js:9`, `src/services/push/console.provider.js:8-15`

  > **Second check: ✅ Correct.**
- **Tapping a notification can replace the wrong page.** It navigates the first open tab of the site, even if the customer is in the middle of checkout there. If that tab can't be moved, nothing opens.
  - Where: `Nadam-frontend/customer-web/public/firebase-messaging-sw.js:55-56`

  > **Second check: ✅ Correct.**
- **Not sure: a setting mistake could remove every token.** Any "404" answer from Firebase counts as "token is dead". If the Firebase project name in the settings were ever wrong, every customer's token might be removed on the first send.
  - Where: `Nadam-backend/src/services/push/fcm.provider.js:93`

  > **Second check: ✅ Correct.**
- **Visitor tokens are kept forever.** Visitors are never sent anything, so their dead tokens are never found and never cleaned up. Their browser details stay stored.
  - Where: `Nadam-backend/src/models/pushToken.model.js:24-25`, `src/jobs/cleanup.job.js:26`

  > **Second check: ✅ Correct.**
- **Opening a notification is never recorded.** `readAt` stays empty.
  - Where: `Nadam-backend/prisma/schema.prisma:918`, `Nadam-frontend/customer-web/public/firebase-messaging-sw.js:50-60`

  > **Second check: ✅ Correct.**

---

## 7. What I could not check

- **Real phones.** I could not check real iPhones (Home Screen notifications, Safari's "must show a notification" rule, tapping to open) or real Android phones. I only read the code. The to-do list still has "real phones on nandamhandlooms.com" open (`docs/to-do-list.md:63`).
- **The live server.** I did not look at its settings. I could not see whether `PUSH_PROVIDER` and the `FIREBASE_*` keys are set there, so I don't know if live messages really go out or are only logged. I also could not see the real value of `RATE_LIMIT_PER_MINUTE` or the first website address in `SHOP_WEB_ORIGINS` (used for the test link).
- **Which version is live.** My notes say W6/W7 (paid, shipped, delivered messages) were built on the Mac and not live as of 17 Oct. I could not confirm whether they are live now.
- **Firebase's console** (project `nandam-cf952`) and whether nginx caches the `firebase-messaging-sw.js` file. Caching would delay updates to the background helper.
- **Exact Firebase and Safari behaviour** where I wrote "Not sure": how often tokens change, what Firebase answers for a wrong project, and Safari's silent-message rule.
- **Tests.** I did not run them. `tests/api/shop/push.test.js` covers subscribe, visitors, consent, sign-out, sending, dead tokens and the test limit.

---

## 8. For the developer

| # | What | Where | Suggested fix (one line) |
|---|---|---|---|
| M1 | `check()` calls `currentToken()` → `getToken()` mints a fresh token when permission is granted, then auto-`pushSubscribe`s, so Turn off is undone on the next mount | `Nadam-frontend/customer-web/src/pages/account/NotificationsPage.jsx:96-110`, `src/push/push.js:71-80`, `:82-88` | Keep a per-browser "turned off" flag (set in `off()`, cleared in `on()`) and skip `currentToken`/subscribe in `check()` when it is set. Show the overview tile from it too. |
| M1b | Overview shows "On" from `Notification.permission` alone | `src/pages/account/OverviewPage.jsx:54` | Use the same flag plus `readPushToken()`, or ask `/push/status`. |
| M2 | `signOutSession`, `signOutForSafety` and the too-many revoke don't unlink PushTokens; `PushToken` has no link to the session | `Nadam-backend/src/services/shop/session.service.js:130-136`, `:238-245`; `prisma/schema.prisma:883-901` | Store `shopSessionId` on PushToken when linking (subscribe/setTopics with a session; follow rotations) and unlink it (drop `orders`, null account) whenever that session is revoked for any reason except rotation. At minimum, unlink all on safety sign-out. |
| M2b | A visitor can't see or stop a browser linked to someone else | `src/services/shop/push.service.js:38-44`, `:58`, `:67` | Let `DELETE /push/subscribe` remove a token from a visitor too (the token itself proves the browser), or unlink it there. |
| S1 | No sender for `arrivals`/`offers`; `notifyCustomer` is per account, so visitor tokens are unreachable | `src/services/shop/push.service.js:101-119`; `Nadam-frontend/customer-web/src/pages/home/Alerts.jsx:45,75` | Add a broadcast sender: tokens with the topic, not removed, and (if linked) the account has `marketingOptIn`. Trigger it from an admin action or new-collection publish, with a per-day cap. Or hide the box until it exists. |
| S2 | Order notices are queued in memory (`pending` promise); failed sends never retried; EventsOutbox unused | `src/services/shop/orderNotices.service.js:24-31`; `push.service.js:83-97,112-118` | Create the Notification row as `queued` (with a `nextTryAt`) inside or right after the order transaction, and let `checkPending` (payments job, every minute) send and retry `queued`/retryable rows. |
| S3 | `afterPaid` awaits `notifyCustomer` inside the verify request | `src/services/shop/checkout.service.js:532`, `:566-571`, `:621-626` | Fire-and-forget through the same background queue as `tellCustomer` (or the S2 queue). Never await Firebase in a customer request. |
| S4 | `relinkPush` posts no topics → server resets topics to defaults | `Nadam-frontend/customer-web/src/auth/session.js:123-127`; `Nadam-backend/src/services/shop/push.service.js:31-35,45-49` | When the token row exists and no topics are given, keep its topics and only add `orders` (and add marketing topics only if they were chosen before). |
| S5 | Foreground: SW posts to the focused tab instead of `showNotification`; the toast ignores `m.link` | `public/firebase-messaging-sw.js:39-44`; `src/App.jsx:51` | Add a toast action `{ label: 'View', onClick: () => navigate(m.link) }`. Drop "Tap to see it" from the foreground text or make it true. |
| S6 | Safari/WebKit may revoke the subscription after pushes with no notification | `public/firebase-messaging-sw.js:39-44` | Always call `showNotification` (at least when the user agent is Safari/iOS) and also post to the page. |
| S7 | Token only refreshed on the Notifications page; no `pushsubscriptionchange` handler | `src/push/push.js:71-80`; `src/pages/home/Alerts.jsx:25`; `src/auth/session.js:124`; `public/firebase-messaging-sw.js` | On app start (permission granted, not turned off, push configured), call `currentToken()`. If it differs from the saved copy, subscribe the new one keeping topics and unsubscribe the old one. |
| S8 | No notices for failed payment, 3-day give-up, shop cancel, tracking change | `src/services/shop/checkout.service.js:443-448`, `:712-714`; `src/services/order.service.js:236-250`, `:271-305` | Add `payment_failed` (true failure), `order_cancelled` and `tracking_changed` via `tellCustomer`. Rename the refund type to `payment_refunded`. |
| s | Same `tag` per type collapses different orders silently | `src/services/push/fcm.provider.js:43`; `src/services/shop/push.service.js:111`; `public/firebase-messaging-sw.js:35` | Use `tag: \`${type}:${orderNumber}\`` and `renotify: true` in the SW options. |
| s | Account consent off leaves browser topics on | `src/services/shop/profile.service.js:58-61`; `src/pages/account/NotificationsPage.jsx:179-190` | When consent goes false, remove `arrivals`/`offers` from the account's tokens. Refresh `state.topics` on the page. |
| s | "Not available yet" while config loads or fails | `src/pages/account/NotificationsPage.jsx:23-25,90`; `src/config/config.js:39-42` | Use `configStore` status: show a skeleton while `loading` and "Couldn't load, try again" on `error`. |
| s | Firebase error text shown raw | `src/pages/account/NotificationsPage.jsx:130` | Show raw text only for `ApiError`. Use a plain message for Firebase errors (and log the code). |
| s | `status()` counts unlinked tokens as "mine" for signed-in users; `sendTest` requires a link | `src/services/shop/push.service.js:67`, `:126` | For a signed-in caller, treat an unlinked token as not subscribed (so `check()` links it), or link it in `sendTest`. |
| s | Test limit count-then-send race | `src/services/shop/push.service.js:123-127` | Use the `rateLimit` middleware keyed by account (`max: 3, windowSeconds: 3600`) on `/push/test`, which is already serialised per key. |
| s | Test body mentions orders regardless of topics | `src/services/shop/push.service.js:128` | Use neutral text: "Notifications from Nandam Handlooms will appear here." |
| s | Out-of-order topic replies | `src/pages/account/NotificationsPage.jsx:160-177` | Disable the toggles while a save is in flight, or ignore stale replies with a request counter. |
| s | Silent test-mode fallback in production | `src/config/env.js:215-217`; `src/services/push/index.js:9` | In production, refuse to start when `FIREBASE_WEB_*` is set but the provider resolves to `console`, or record `status: 'not_sent'` in console mode. |
| s | Notification click navigates the first site tab; `navigate()` rejects on uncontrolled clients with no fallback | `public/firebase-messaging-sw.js:55-56` | Prefer a focused tab or one already on the link. Catch `navigate` failure and fall back to `openWindow(link)`. |
| s | Any 404 marks the token dead (Not sure for a wrong project id) | `src/services/push/fcm.provider.js:93` | Treat only `UNREGISTERED` / `INVALID_ARGUMENT`-on-token as dead. Treat a 404 without `UNREGISTERED` as a config error and alert. |
| s | Active visitor tokens never expire | `src/models/pushToken.model.js:24-25`; `src/jobs/cleanup.job.js:26` | Remove unlinked tokens not seen for e.g. 13 months, or validate them with a `validate_only` send now and then. |
| s | `readAt` never set | `prisma/schema.prisma:918`; `public/firebase-messaging-sw.js:50-60` | Optional: on click, `fetch('/api/v2/shop/push/opened', { notificationId })`. |

> **Second check (row M1b): ✅ Correct.**

> **Second check (row M2b): ✅ Correct.**

Other notes:
- The token rule `min(20)` / `max(4096)` uses Zod's default English message (`src/validators/shop/common.js:83`). Customers won't see it, because the website always sends a real token.

  > **Second check: ✅ Correct.**
- The test link uses the first `SHOP_WEB_ORIGINS` entry (`src/controllers/shop/public.controller.js:20`). If that is the `www.` address and the customer uses the bare one (or the other way round), the SW's `safeLink` sends them to the home page instead (`public/firebase-messaging-sw.js:11-18`).

  > **Second check: ✅ Correct.**

---

## Second check (26 Oct 2026)

27 findings checked against the code (M1, M2, S1–S8, 13 Small items, table rows M1b and M2b, and the 2 other notes):

| ✅ Correct | ⚠️ Partly correct | ❌ Wrong |
|---|---|---|
| 23 | 4 | 0 |

Partly correct: M1 (real, but the customer can stop messages with the three switches; Should, not Must), S2 (EventsOutbox is used by the old server, which sweeps it every 5 seconds), S3 (no error on the payment page: verify has 30 s and always ends on the order page; Small), S5 (tracking stays visible on the order page; Small).

Full details and evidence: [checks/11-notifications-check.md](checks/11-notifications-check.md)

---

## Third check (26 Oct 2026)

The 4 findings marked ⚠️ (M1, S2, S3, S5) were checked a third time against the code (website, server, Firebase library, old server). None were marked ❌.

| Second checker right | First reviewer right | Both partly right | Neither right |
|---|---|---|---|
| 4 | 0 | 0 | 0 |

Final groups: M1 Should fix, S2 Should fix, S3 Small, S5 Small.

Full details and evidence: [checks/11-notifications-third-check.md](checks/11-notifications-third-check.md)

# Module 7: The bag (cart), review

| | |
|---|---|
| **Date** | 26 Oct 2026 |
| **How** | Read the code only. Nothing was run, changed, built or tested. No live server or database was touched. No `.env` file was opened. |
| **Server code** | `Nadam-backend/` (`src/routes/shop/index.js`, `controllers/shop/bag.controller.js`, `services/shop/bag.service.js`, `validators/shop/bag.validators.js`, `models/bag.model.js`, `services/shop/visibility.js`, `services/shop/catalog.service.js` (`presentCard`), `middlewares/rateLimit.js`, `middlewares/shopGuard.js`, `middlewares/authenticateCustomer.js`, `middlewares/validate.js`, `jobs/cleanup.job.js`, `services/shop/checkout.service.js`, `services/shop/account.service.js`, `services/shop/config.service.js`, `prisma/schema.prisma`, migration `20261016180000_w5_bag_items`) |
| **Website code** | `Nadam-frontend/customer-web/` (`src/bag/*`, `components/BagPanel.jsx`, `BagButton.jsx`, `BagWhatsApp.jsx`, `SareeCard.jsx`, `QtyStepper.jsx`, `Toasts.jsx`, `SideMenu.jsx`, `pages/bag/*`, `pages/product/ProductPage.jsx`, `pages/checkout/CheckoutPage.jsx`, `auth/session.js`, `api/*`, `config/config.js`, `data/recent.js`) |
| **Design notes used** | `docs/modules/web-03-cart.md` (sections 6 to 9 and 14) |

**Short answer:** the bag is well built. The server checks every saree against today's stock and website price, prices are always whole rupees on both sides, a set can never go above what is in stock, and one customer can never see or change another customer's bag. Payment takes the bought sarees out of the bag, and account deletion removes the bag.

I found **1 "Must fix" problem**: if joining the two bags at sign-in fails even once, the signed-in customer is left with a bag that is not saved in their account, and the **Pay** button stays grey until they reload the page. I found **2 "Should fix" problems**: a saree added at the wrong moment (while the website is still working out who is signed in) quietly disappears, and **Undo** can bring back the wrong saree. There is also a list of small items.

---

## 1. What this module does

The bag is where a customer collects the sarees they like before ordering. It shows today's price and stock for every saree, works without signing in, and is kept in the customer's account once they sign in (so it follows them to another phone). From the bag they send the order on WhatsApp, or press Checkout when online payment is on.

---

## 2. The steps a customer goes through

1. **Adds a saree.** On any saree card: **Add to bag** (always one piece). On a saree page: **Add to bag**; for a set (more than one identical piece) they first choose how many with **− 1 +**.
2. **The side panel slides in** from the right: "Added to your bag", the sarees, the total, **Checkout** (only when online payment is on for them), **View bag**, **Keep shopping**, and **Send bag on WhatsApp** (or "Order on WhatsApp instead" when payment is on).
3. **The bag icon** at the top shows how many pieces are in the bag. Tapping it opens the side panel.
4. **Opens the bag page** (`/bag`). Each saree shows photo, name, code, single piece or set, pieces, price and line total. On the right: subtotal, free delivery, total.
5. **Changes the bag.** For a set: − / + to change pieces. **Remove** takes a saree out at once with a short "Removed … · Undo" message. **Clear the bag** asks "Are you sure?" first.
6. **Sees what changed.** The bag is checked with the shop every time it opens, after every change, and when the customer comes back to the tab after a minute. Notes show for: sold out, no longer on the website, fewer pieces left, new price.
7. **Sends the bag on WhatsApp.** A window shows the exact message first. **Open WhatsApp** opens a chat with the shop's number (91 73823 88565) with the message filled in. Back on the bag page: "Sent on WhatsApp? · Clear the bag / Keep it".
8. **Or presses Checkout** (when payment is on). If not signed in, the checkout page asks them to sign in, then brings them back.
9. **Signs in.** The visitor's bag and the account's saved bag are joined. A short message says what changed ("Welcome back. Your bags are joined").
10. **Signs out.** The bag is removed from this browser (so a shared phone shows nothing). It stays in the account.
11. **After paying online,** the bought sarees leave the bag by themselves.

---

## 3. Each API

All six live under `/api/v2/shop`. All are switched off (answer `MAINTENANCE`) when the shop switches the website off. All answers say "never keep a copy" (`Cache-Control: no-store`).

### 3.0 The one answer all six give

| Part | What it means |
|---|---|
| `items` | The sarees, one line each (below), in the order they were added. |
| `totals.lines` | How many sarees are in the bag (links that don't exist at all are not counted). |
| `totals.buyableLines` | How many of them can be bought now. |
| `totals.pieces` | Pieces that can be bought now. |
| `totals.amount` | The total in whole rupees: price × pieces of the sarees that can be bought now. |
| `changes` | How many lines are `soldOut`, `unavailable` (not on the website), `fewer` (fewer left than chosen), `priceChanged`, `notFound`. Used for the note at the top. |
| `maxLines` | Always 20. |
| `checkedAt` | When the server checked. |
| `joined` | Only in the sign-in join: `{ added, raised, skipped }` counts. |
| `buyAgain` | Only in My orders → Buy again (another module): what was added, raised, already there, or skipped. |

**One line** has: `slug` (the saree's link name), `sku` (the code), `name`, `collection { id, name }`, `category { slug, name }`, `craftName`, `photo { url, alt }`, `price` (today's website price, whole rupees), `priceWas` (the price the customer saw before, only when different), `available` (pieces in stock now, plus any pieces this customer's own unpaid checkout holds), `asked` (pieces asked for), `quantity` (pieces counted), `lineTotal` (price × quantity), `state`.

`state` is one of: `ok`; `fewer` (fewer left than asked: lowered to what is left); `sold_out` (still on the website, nothing in stock: counted as 0); `unavailable` (no longer on the website: counted as 0); `not_found` (the link does not exist at all).

For a visitor (`/bag/check`), a saree that is **not on the website** comes back with only `slug`, `state`, `asked`, `available: 0`, `quantity: 0`, `lineTotal: 0`. Nothing else is said about it, so someone guessing links learns nothing. A link that does not exist comes back the same way with `state: not_found`.

**"On the website"** (same rule as every list): switched on, not deleted, set to Online only or Both, its category and collection shown, its collection's website price at least ₹500, and at least one photo. Stock is checked separately (sold out still counts as "on the website").

### 3.1 `POST /bag/check`: check a visitor's bag

| | |
|---|---|
| **What it is for** | A visitor (not signed in) asks: "here is my bag, what is it like today?" The server keeps nothing. |
| **What goes in** | `{ items: [ { slug, quantity, priceSeen? } ] }`. `slug`: letters, digits and hyphens, 1 to 160 long. `quantity`: a whole number 1 to 50. `priceSeen`: the price shown when added, rupees 0 to 1 crore, rounded; a broken one is simply ignored. At most 20 items. The same saree twice becomes one line with the larger number. |
| **What comes back** | The answer in 3.0. |
| **What is saved** | Nothing in the bag. One row in the rate-limit table (`RateLimitHit`). |
| **Who may call** | Anyone. Limit: 120 a minute per network (internet address). |
| **What can go wrong** | `VALIDATION_FAILED` (400): a broken bag (the website never sends one). `RATE_LIMITED` (429). `MAINTENANCE` (503): the whole site shows the "being updated" page. Server or connection trouble. **The customer sees:** on the bag page "We couldn't check your bag just now · Try again" (or "You're offline" when offline). The bag itself is not changed. |

### 3.2 `GET /me/bag`: the signed-in customer's saved bag

| | |
|---|---|
| **What it is for** | Reads the bag saved in the account and checks it. |
| **What goes in** | Nothing (the sign-in key says who it is). |
| **What comes back** | The answer in 3.0. Sarees no longer on the website are still named (the customer added them while they were on the website). |
| **What is saved** | If fewer pieces are left than saved, the saved number is lowered, once. It is never raised again by itself. |
| **Who may call** | Signed-in customers only, their own bag only. One change at a time per customer (a database lock). Limit: 120 a minute per customer. |
| **What can go wrong** | `NOT_SIGNED_IN` and the other "your sign-in ended" codes (401): the website signs the customer out, removes the bag from the browser and shows "You're signed out, so your bag was removed from this browser". `RATE_LIMITED`, `MAINTENANCE`, server trouble: "We couldn't check your bag just now · Try again". |

### 3.3 `PUT /me/bag/items/:slug`: add a saree, or set its pieces

| | |
|---|---|
| **What it is for** | Add a saree to the account's bag, change how many pieces, or put a removed saree back (Undo). |
| **What goes in** | In the address: `slug` (same rule as above). In the body: `{ quantity, priceSeen? }`, `quantity` 1 to 50, `priceSeen` as above. |
| **What the server checks** | 1. The saree exists and is on the website, else `NOT_ON_WEBSITE`. 2. At least one piece is free (pieces this customer's own unpaid checkout holds count as theirs), else `SOLD_OUT`. 3. If it is a new saree and the bag already has 20 different sarees, `BAG_FULL`. 4. The number is capped at what is in stock. If more was asked, that line comes back as `fewer`. It **sets** the number (it does not add to it): the last change wins. |
| **What comes back** | The whole bag (3.0). |
| **What is saved** | One `BagItem` row created or changed. Every other line's "price seen" is set to today's price (a change by the customer counts as having seen today's prices, so "price changed" notes go). |
| **What can go wrong** | `VALIDATION_FAILED` (400, e.g. "Choose 50 pieces or fewer."). `NOT_ON_WEBSITE` (404): "This saree is no longer on the website." `SOLD_OUT` (409): "This saree has just sold out." `BAG_FULL` (409): "Your bag is full (20 sarees). Remove one to add another." `RATE_LIMITED` (429), sign-in codes (401), `MAINTENANCE` (503). **The customer sees** the message in a red strip at the bottom of the screen. For a full bag there is also a **View bag** button. |

### 3.4 `DELETE /me/bag/items/:slug`: remove one saree

| | |
|---|---|
| **What it is for** | Takes one saree out of the account's bag. |
| **What goes in** | `slug` in the address. |
| **What comes back** | The whole bag (3.0). |
| **What is saved** | The row is deleted. Other lines' "price seen" are set to today's price. Already gone: fine, no error. |
| **What can go wrong** | `VALIDATION_FAILED`, sign-in codes, `RATE_LIMITED`, `MAINTENANCE`, server trouble. **The customer sees** the message in a red strip. |

### 3.5 `POST /me/bag/merge`: join the bags at sign-in

| | |
|---|---|
| **What it is for** | Right after sign-in, the browser's bag joins the account's bag. |
| **What goes in** | `{ items: [ { slug, quantity, priceSeen? } ] }`, same rules as 3.1. |
| **What the server does** | For each saree: gone, off the website or sold out: skipped. Already in the account: the larger number is kept (never the sum, so nothing doubles), capped by stock. New: added, unless the account already has 20 sarees (then skipped). |
| **What comes back** | The whole bag (3.0) plus `joined: { added, raised, skipped }`. |
| **What is saved** | New and raised `BagItem` rows. |
| **What can go wrong** | `VALIDATION_FAILED`, sign-in codes, `RATE_LIMITED`, `MAINTENANCE`, server trouble. **The customer sees** "We couldn't check your bag just now" on the bag page. See **Must fix 1**: after this failure the website does not try again. |

### 3.6 `DELETE /me/bag`: empty the bag

| | |
|---|---|
| **What it is for** | **Clear the bag** for a signed-in customer. |
| **What goes in** | Nothing. |
| **What comes back** | An empty bag (3.0 with no lines). |
| **What is saved** | Every `BagItem` row of this customer is deleted. |
| **What can go wrong** | Sign-in codes, `RATE_LIMITED`, `MAINTENANCE`, server trouble: red strip with the message. |

### 3.7 Other places that change the bag

| Where | What happens |
|---|---|
| Payment succeeds (`checkout.service.js:519`) | The bought sarees' rows are deleted from that customer's bag, inside the same database step that marks the order paid. |
| Account deleted (`account.service.js:73`) | All the customer's bag rows are deleted with the other personal details (7 days after the request). The database also deletes them if the account row itself is ever removed. |
| Clean-up job, every 15 minutes (`cleanup.job.js:27`) | Bag rows not changed for 60 days are deleted. |
| A saree is deleted for good in the admin app | Its bag rows are deleted by the database. A saree that is only archived stays and shows as "No longer on the website". |
| My orders → Buy again (`POST /orders/:number/buy-again`) | Puts an order's sarees back by the same rules; shares the same per-customer limit. |

---

## 4. The data kept

### 4.1 The `BagItem` table (new for the bag): one row per saree per signed-in customer

| Field | What it means | Must have it? |
|---|---|---|
| `id` | The row's own number (made automatically). | Yes (automatic) |
| `authAccountId` | Which customer. Linked to the account; deleted with it. | Yes |
| `productId` | Which saree. Linked to the saree; deleted if the saree is deleted for good. | Yes |
| `quantity` | How many pieces. The database refuses anything outside 1 to 50. | Yes |
| `priceSeen` | The website price the customer last saw for it (rupees and paise). The database refuses a negative. Used for the "price changed" note. | Yes |
| `createdAt` | When it was added (automatic). Lines are shown in this order. | Yes (automatic) |
| `updatedAt` | When it was last changed (automatic). The 60-day clean-up uses it. | Yes (automatic) |

Rules: one row per customer per saree (unique pair `authAccountId` + `productId`). An index on `updatedAt` for the clean-up.

### 4.2 Tables the bag reads (never changes)

| Table | Fields used | Why |
|---|---|---|
| `Product` (saree) | `id`, `slug`, `sku`, `name`, `stock` (old counter of pieces without tags), `isActive`, `deletedAt`, `channelVisibility`, `createdAt` | Name, code, link, "on the website", and part of the stock. |
| `Piece` (one tagged piece) | `status` (`in_stock`, `reserved`, `sold_online`, …) | Pieces in stock = old counter + tagged pieces still `in_stock`. |
| `Subcategory` (collection) | `name`, `onlinePrice`, `isActive`, `status` | The website price (rounded to whole rupees) and "on the website". |
| `Category` | `slug`, `name`, `isActive`, `status` | "On the website" and the line's category. |
| `ProductImage` | first photo `url`, `altText` | The line's photo; a saree with no photo is not on the website. |
| `Reservation` (a 15-minute hold while paying) + `Order` | `status: active`, `quantity`, `productId`; order `authAccountId`, `channel: online`, `status: pending_payment` | Pieces this customer's own unpaid checkout holds still count as theirs. |
| `AuthAccount` | `id` and the customer checks | Whose bag. |
| `RateLimitHit` | one row per request | Request limits. |

### 4.3 What the browser keeps

| Where | What | Notes |
|---|---|---|
| `localStorage` `nh-bag-v1` | `{ v: 1, owner: guest or account, items, pending }`. Each item: `slug`, `quantity`, `priceSeen`, `addedAt`, `name`, `sku`, `photo { url, alt }`. | Nothing about the person. Anything odd is dropped when read. At most 20 lines, 50 pieces each. `pending` = old-website sarees waiting to join a signed-in bag. |
| `sessionStorage` `nh-bag-notice` | The one-time message (brought back, joined, signed out, taken out). | Lasts for this tab's visit. |
| `localStorage` `NANDAM_CART_V1` | The old website's bag. | Read once, added (1 piece each), then deleted. |
| `localStorage` `nh-recent` | Recently viewed saree cards (price and stock **as they were then**). | Not part of the bag, but these cards now have "Add to bag" (see Small 6). |
| Memory only | Last server answer, checking state, side panel, WhatsApp window, "Sent?", Undo. | Lost on reload (by design). |

---

## 5. On the website

### 5.1 Saree card (lists, home, rails)
- **Add to bag** (one piece). While adding, the button shows it is busy. Then the side panel opens.
- Already in the bag: the button says **In your bag** and opens the side panel.
- Sold out: **See details** instead.
- Errors: red strip with the server's message; a full bag adds **View bag**.

### 5.2 Saree page
- A set: **Pieces − 1 +**, with "Up to 3" or "2 in your bag · up to 1 more".
- **Add to bag** / **Add one more to bag** / **Add 2 more to bag**. All pieces already in: **All 3 pieces are in your bag · View** (or **In your bag · View** for a single piece).
- Bag full (20 sarees): a yellow note and the button greyed.
- **Order on WhatsApp** under it, "Questions? Call", and the quiet note "The bag doesn't hold the saree: our store sells it too."
- On phones, a bar at the bottom with **Add** / **In bag** when the main buttons scroll out of view.

### 5.3 Header and menu
- Bag icon with the number of pieces that can be bought (bounces once after each add). Tapping it opens the side panel (on the bag page it scrolls to the top).
- The full-screen menu has **Bag** (without the number; see Small 12).

### 5.4 Side panel
- Title "Added to your bag" (the saree just added first) or "Your bag".
- Each saree in short form (pieces shown, no − / +), **Remove**.
- "Total · N pieces ₹X", "Free delivery across India · includes all taxes · checking…".
- **Checkout** (payment on and something to buy), **View bag**, **Keep shopping**, **Send bag on WhatsApp** (off when offline or nothing can be bought).
- Empty: "Your bag is empty" + **New in**. Escape or tapping outside closes it; moving to another page closes it.

### 5.5 Bag page (`/bag`)
- Lines: photo, craft, name, **code**, "Set · 3 in stock" or "Single piece", − / + for sets, **Remove**, line total ("2 × ₹2,800", the old total struck through when the price changed).
- Line notes: "Sold out: it sold since you added it. Ask for a similar saree" · "No longer on the website. Ask us on WhatsApp" · "Only 2 left now. We changed it from 4 to 2." · "Price went up from ₹2,600 to ₹2,800 since you added it."
- Top notes: "You're offline…", "We couldn't check your bag just now · Try again", the one-time message (old bag brought back / bags joined / signed out / taken out), "Some sarees changed since you added them: 1 sold out · 1 with a new price…", "Sent on WhatsApp? · Clear the bag / Keep it".
- Waiting: "Checking prices and stock…"; done: "Prices and stock checked just now"; offline: "Last checked before you went offline".
- Summary: subtotal, Delivery Free, Total, "Includes all taxes", "1 saree that can't be bought now is not counted."
- Payment on: **Checkout** (grey when nothing can be bought), "Secure payment by Razorpay", "Order on WhatsApp instead". Payment off: **Send bag on WhatsApp**, "Online payment is coming soon".
- "Saved in your account" when signed in. "Your browser isn't saving your bag (private browsing?). Sign in to keep it." when storage is blocked.
- **Clear the bag** asks first ("This removes 3 sarees from your bag, here and in your account"). Then "Your bag is empty now".
- Empty bag: "Your bag is empty" with **New in**, **All collections**, **Sets for the family**, and Recently viewed.
- Phones: a bar at the bottom with the total and **Checkout** or **Send**.

### 5.6 Send bag on WhatsApp
- A window shows the message first: "Hello Nandam Handlooms, I'd like to order these sarees from my bag:" then each saree (name, code, pieces × price = line total, its link), then "Total: ₹X (N pieces, free delivery)". Sold-out and off-website sarees are left out.
- **Copy text** and **Open WhatsApp** (opens `wa.me/917382388565` with the message). The number is the same in the website's built-in settings and the server's (`STORE.whatsapp`). Nothing in the message depends on anything shop-specific beyond the greeting line.
- Nothing can be bought: "Nothing in your bag can be bought right now." + **Close**.

### 5.7 Sign-in and sign-out
- Sign-in with sarees in the browser: the bags are joined. The bag page then says "Welcome back, Priya. Your bags are joined" with what was added from the account, what now has more pieces, and what was left out. A brand-new customer whose bag simply moves gets no message.
- Sign-out (here, on all devices, or ended by the shop): the bag leaves this browser; the bag page says "You're signed out, so your bag was removed from this browser · Sign in".

### 5.8 Two tabs, offline, private browsing, old website
- Two tabs: a change in one shows in the other at once (browser storage event).
- Offline: the saved bag shows with "You're offline"; WhatsApp is off. A visitor can still add (kept in the browser); a signed-in customer gets "You are offline…" when adding.
- Storage blocked: the bag works for this visit with the warning in 5.5.
- Old website's bag: brought in once, "We brought back 2 sarees from your earlier visit", each checked like any line.

---

## 6. Problems found

### Must fix

**1. If joining the bags at sign-in fails once, the customer is stuck with a bag that is not in their account, and cannot pay.**
- What happens: a customer adds sarees, presses Checkout, signs in. Right after sign-in the website joins the two bags. If that one request fails (a weak signal for a moment, the server busy, a timeout), the website keeps showing the old visitor bag. From then on, everything they add stays only in this browser and is not saved in the account. **Try again** only re-checks the visitor bag and never retries the join. The account's saved bag (from another phone) never shows. On the checkout page the **Pay** button stays grey with no reason, because the page waits for the account's bag. "Clear the bag" even says "here and in your account" although nothing in the account is cleared. Only reloading the page fixes it. (It retries by itself only if the phone actually went offline and came back.)
- Why it matters: a ready-to-pay customer cannot pay and is not told why. Online orders are already rare (18 of 20 old online orders were never paid).
- Where: `Nadam-frontend/customer-web/src/bag/store.js:345` (the failure is only noted), `src/bag/store.js:329` and `:183` (the bag stays "visitor" while signed in), `src/bag/store.js:210` (later checks use the visitor check), `src/bag/store.js:406-411` (retry only on coming back online), `src/pages/bag/BagPage.jsx:112` (Try again), `src/pages/checkout/CheckoutPage.jsx:187` and `:319` (Pay waits for an account bag that never comes).

> **Second check: ✅ Correct.**
> **Third check: Second checker right. Final: if the join at sign-in fails once, the bag stays a browser-only visitor bag while signed in; checkout first shows "We couldn't check your bag just now · Try again", but Try again (or any later check) only re-checks the visitor bag, so the note goes and Pay stays grey with no reason until the page is reloaded. Final group: Must fix.**

### Should fix

**1. A saree added while the website is still working out who is signed in quietly disappears.** Two moments:
- (a) A returning signed-in customer opens the website. For a second or two (longer on a weak signal) the website is still checking their sign-in. If they tap **Add to bag** (or change pieces, or remove) in that time, the side panel says "Added to your bag", but when the check finishes the website loads the account's bag over it and the saree is gone. If the sign-in turns out to have ended, it is also wiped with the rest.
- (b) Right after sign-in, while the two bags are being joined, a saree added (or removed) in those seconds is not part of the join. When the join answers, the added saree vanishes (or the removed one comes back).
- Why it matters: the customer saw "Added" and later finds it missing, with no message.
- Where: `src/bag/store.js:241-249` (changes go to the browser copy when not yet "signed in"), `src/bag/store.js:203` (no check while waiting), `src/bag/store.js:329` (the join leaves out the browser copy when it belonged to the account), `src/bag/store.js:332-335` (the answer replaces the whole bag), `src/auth/session.js:17` (status "unknown" while checking).

> **Second check: ✅ Correct.**

**2. Undo on an earlier "Removed" message brings back the wrong saree.**
- What happens: remove saree A, then saree B. Two messages show: "Removed A · Undo" and "Removed B · Undo" (up to three stay for 6 seconds). Tapping Undo on **A's** message brings back **B**, and A is gone for good. Tapping Undo on B's message then does nothing.
- Why it matters: the customer loses the saree they meant to keep and must find it again.
- Where: `src/bag/useBagActions.js:30` (every Undo calls the same `undo()`), `src/bag/store.js:274` and `:279` (only the last removed saree is remembered), `src/components/Toasts.jsx:14` (several messages at once).

> **Second check: ✅ Correct.**

### Small

1. **When the sign-in ends while the website is open (for example "Sign out of all devices" on another phone), the next bag check shows two messages at once.** The bag page shows "We couldn't check your bag just now · Try again" next to "You're signed out". The first one is wrong. Where: `src/bag/store.js:212` (error set after the sign-out already cleared the bag), `src/api/client.js:105`.
   > **Second check: ✅ Correct.**
2. **Joining into a full account bag drops the visitor's sarees with the wrong reason.** If the account already has 20 sarees (or visitor + account go above 20), the extra visitor sarees are dropped and the message says they "can't be bought now", not "your bag was full". Rare (bags are 1 to 3 sarees). Where: `Nadam-backend/src/services/shop/bag.service.js:171`, `src/bag/store.js:342`, `src/pages/bag/BagPage.jsx:47`.
   > **Second check: ✅ Correct.**
3. **"Sold out: it sold since you added it" also shows when another customer is only paying for it** (a 15-minute hold that may end unpaid). For a set, the bag lowers the pieces for good (it never raises them again). Most online checkouts on the old site were never paid, so holds that come back are normal. Where: `Nadam-backend/src/services/shop/catalog.service.js:49` (reserved pieces don't count), `bag.service.js:35-36`, `src/pages/bag/BagLine.jsx:33`, `src/bag/store.js:164`.
   > **Second check: ✅ Correct.**
4. **For a signed-in customer, "Add to bag" can lower a set's pieces.** The website sends "set to N" using this browser's copy. If another phone added more pieces of the same set in the meantime, adding 1 here sets it to 1. Rare (sets on two devices). Where: `src/bag/store.js:236` and `:242`, `Nadam-backend/src/services/shop/bag.service.js:130-132`.
   > **Second check: ✅ Correct.**
5. **An older bag answer can arrive after a newer change** (signed in). A check that was already on its way when the customer changed something is applied after the change; the screen goes back for a moment until the next check. Where: `src/bag/store.js:199` and `:210` (no "newer change" guard for signed-in bags, unlike visitors at `:215`).
   > **Second check: ⚠️ Partly correct: the missing guard is real, but every `/me/bag` call takes the same per-customer lock (`bag.model.js:10`) and signed-in changes wait for the server, so an older GET is normally answered and applied before the change's answer, which then wins; only out-of-order network delivery shows the old bag, and then it stays until the next check or change (not "a moment"). Small, very rare.**
   > **Third check: Second checker right. Final: there is no "older answer" guard for a signed-in bag, but the server's per-customer lock makes the older answer arrive first, so the old bag only comes back if the network swaps the two answers, and it then stays until the next check or change (the saved bag and payment stay right). Final group: Small.**
6. **Recently viewed cards add with old prices and stock.** Those cards are saved in the browser when a saree was viewed (maybe weeks ago) and now have "Add to bag". The bag can then say "Price went up … since you added it" or "Sold out: it sold since you added it" a second after adding. Where: `src/data/recent.js:16`, `src/components/SareeCard.jsx:27`, `src/pages/bag/BagPage.jsx:63`, `src/pages/product/ProductPage.jsx:269`.
   > **Second check: ✅ Correct.**
7. **Send on WhatsApp works before the bag was ever checked** (for example the check failed). Sarees never checked are treated as "can be bought" at the price saved in the browser, so the message can list a sold saree or an old price. The shop confirms by hand anyway. Where: `src/bag/useBag.js:16`, `src/pages/bag/BagPage.jsx:95`, `src/components/BagPanel.jsx:61-63`.
   > **Second check: ✅ Correct.**
8. **Signing out at the exact moment a bag request is on its way can put the last customer's bag back** on a shared phone until the page is reloaded. Very rare. Where: `src/bag/store.js:172-180` (an answer always makes the bag "account" again), `:352-359`.
   > **Second check: ✅ Correct.**
9. **A saree untouched for 60 days disappears from a signed-in bag with no message.** Looking at the bag does not count as a change. Where: `Nadam-backend/src/models/bag.model.js:56`, `src/jobs/cleanup.job.js:27`.
   > **Second check: ✅ Correct.**
10. **After paying, the whole bag line goes,** even if the customer raised the number in another tab during the 15 minutes. Rare. Where: `Nadam-backend/src/services/shop/checkout.service.js:519`.
   > **Second check: ✅ Correct.**
11. **The "bags are joined" message only shows on the bag page.** A customer who signs in from Checkout (the usual path) never sees what was added or left out. Where: `src/pages/bag/BagPage.jsx:116`.
   > **Second check: ✅ Correct.**
12. **The menu's "Bag" has no number** (the design notes say it should). Where: `src/components/SideMenu.jsx:45`.
   > **Second check: ✅ Correct.**
13. **The old-website message can count wrong.** It counts every old saree read, even beyond 20 or ones then taken out; a "taken out" message replaces it. Where: `src/bag/store.js:373`, `:101`, `:167`.
   > **Second check: ✅ Correct.**
14. **The per-customer request limit message says "from this network".** Where: `Nadam-backend/src/middlewares/rateLimit.js:26` used by `src/routes/shop/index.js:80`.
   > **Second check: ✅ Correct.**
15. **The website's limits are written into its own code** (20 sarees, 50 pieces) instead of read from the server's `/config` (which sends them). Same numbers today. Where: `src/bag/store.js:17-18`, `Nadam-backend/src/services/shop/config.service.js:18`.
   > **Second check: ✅ Correct.**
16. **A guessed link can tell whether a hidden saree exists** ("not on the website" vs "does not exist"). It says nothing else about it. Where: `Nadam-backend/src/services/shop/bag.service.js:89` and `:92`.
   > **Second check: ✅ Correct.**
17. **The server's browser rules (CORS) don't list PUT.** No effect today because the website and the server share one address; it would break "add to bag" for signed-in customers if the server ever moved to its own address. Where: `Nadam-backend/src/middlewares/shopGuard.js:26`.
   > **Second check: ✅ Correct.**

---

## 7. What I could not check

- **Anything live.** I did not open the live website, server, database or nginx. So I could not check that nginx passes `PUT` and `DELETE` to the server, or that the server's "trust proxy" setting makes the per-network limit count real visitors and not the whole site as one (that setting is in `.env`, which I did not open).
- **A signed-in bag on live.** The status line at the top of the design notes says a signed-in bag on live still had to be tried by the owner with a real SMS. I could not try it.
- **Tests.** I did not run the server tests (24 for the bag), the website tests or the browser tests.
- **How long the "checking your sign-in" moment really lasts** on a phone. Should fix 1(a) depends on it.
- **Very long WhatsApp messages.** A full bag of 20 sarees makes a long link. I could not check that every phone's WhatsApp opens it in full.
- **Heavy load.** Every bag change holds a database connection while it waits for the customer's lock, and the server has 10 connections. I could not measure whether a burst of requests from one account could slow the rest of the site. Not sure; it is the same pattern as the request limiter everywhere.
- **The old website on the same address.** The old bag can only be brought in if the old website used the same web address as the new one. I could not check that.

---

## 8. For the developer

Paths are relative to the project root. `W` = `Nadam-frontend/customer-web/`, `B` = `Nadam-backend/`.

**Must fix 1: failed join leaves `owner: 'guest'` while signed in**
- `W/src/bag/store.js:345` `.catch((error) => set({ status: 'error', error }))` leaves `owner === 'guest'`; `isAccount()` (`:183`) stays false; `refresh()` (`:210`) then calls `bagCheck`, which succeeds and sets `status: 'ready'`, so the `online` retry (`:407`) never fires. `CheckoutPage.jsx:187` requires `bag.owner === 'account'`, so `canPay` (`:319`) is false forever. The same happens when the guest bag is empty and `shopApi.bag()` fails (the account bag never loads; `refresh()` takes the `!isAccount() && !state.items.length` branch at `:204`).
  > **Second check: ✅ Correct.** (Includes the empty-guest-bag variant: checkout then shows "Your bag is empty", `CheckoutPage.jsx:233-238`.)
- Fix: in `refresh()`, when `signedIn() && (state.owner === 'guest' || state.pending.length)`, call `joinAccount()` instead of `bagCheck`; also show the join error on the checkout page.

**Should fix 1: changes lost while auth is `unknown` or while `joining`**
- (a) `add/setQuantity/remove` (`store.js:241-249`, `:255-259`, `:266-273`) take the local branch when `owner === 'account'` but `authStore.status === 'unknown'`; `joinAccount()` then ignores `state.items` (`:329`, guest only) and `applyAccount` replaces them.
- (b) While `joining` is set, `owner` is still `'guest'`; the local add is not in `toJoin` and is overwritten at `:335`.
- Fix: in `add/setQuantity/remove/undo`, `await joining` and wait for auth to leave `unknown` before choosing the branch; or push local changes made in those windows into `state.pending` so the join sends them.

**Should fix 2: Undo uses a single global `lastRemoved`**
- `W/src/bag/useBagActions.js:30` calls `undo()`; `store.js:279` reads `state.lastRemoved`, which `remove()` overwrites at `:274`. `Toasts.jsx:14` keeps three toasts.
- Fix: give `undo(item, index)` the removed line captured in the toast's closure (and ignore it if already back), or dismiss older Undo toasts on a new remove.

**Small**
1. `store.js:212`: `request()` emits `sessionEnded` before throwing (`api/client.js:105`), so `forgetAccount()` runs, then the catch sets `status: 'error'`. Fix: in the catch, skip setting the error when `!signedIn() && state.owner === 'guest' && !state.items.length`, or ignore 401 session codes.
2. `B/src/services/shop/bag.service.js:171` counts bag-full as `skipped`. Fix: return `skipped` and `full` separately; word the website note by reason (`BagPage.jsx:47`).
3. `B/src/services/shop/catalog.service.js:49` excludes `reserved` pieces; `bag.service.js:35-36` then says `sold_out`/`fewer`, and `readBag` (`:108`) / `applyCheck` (`store.js:164`) lower sets permanently. Fix: count other customers' active reservations as "held, may come back" (a separate `held` state and text), and don't persist the lowering while the shortfall is only held stock.
4. `store.js:236`/`:242` turn "add N" into `PUT quantity = local + N`. Fix: send an "add" intent (e.g. `{ add: N }`) and let the server add to the saved number, capped by stock.
5. `store.js:199`/`:210`: account GET can land after a PUT/DELETE answer. Fix: keep a sequence number per account call and ignore older answers in `applyAccount`.
6. `W/src/data/recent.js:16` stores `price`/`available` with no date; `SareeCard.jsx:27` adds with them. Fix: on the Recently viewed rails, drop `priceSeen` (let the first check set it) or hide Add for cards older than a day.
7. `useBag.js:16` treats `unknown` as buyable; `BagPage.jsx:95` and `BagPanel.jsx:61-63` don't wait for a check. Fix: disable Send while any line is `unknown` (as the design notes say for offline), or leave unknown lines out of `bagMessage`.
8. `store.js:172-180` sets `owner: 'account'` from any answer. Fix: in `applyAccount`, ignore answers when `!signedIn()`.
9. `B/src/models/bag.model.js:56`: rows go silently after 60 days, and reads don't touch `updatedAt`. Fix: bump `updatedAt` on `GET /me/bag` (or on reads older than a week), and/or tell the customer when a saved saree was removed.
10. `B/src/services/shop/checkout.service.js:519` deletes whole rows. Fix: decrement by the bought quantity and delete only rows that reach 0. Note this delete (and the clean-up job) run without `Bag.lockFor`, so a `setItem` at the same instant can hit "record not found" (`bag.service.js:132`) and answer 500. Not sure how often; very rare.
   > **Second check: ✅ Correct.** (No P2025 mapping; `errorHandler.js:20-24` turns it into 500 `INTERNAL`.)
   > **Third check: Second checker right. Final: a bag change made at the exact moment a payment of the same saree completes (or the 60-day clean-up removes it) can answer 500 "Something went wrong"; nothing is lost and the next check is right. Final group: Small.**
11. `BagPage.jsx:116`: the `joined` notice only renders on `/bag`. Fix: also render it on the checkout page (or as a toast after sign-in).
12. `W/src/components/SideMenu.jsx:45`: add the pieces count as the other menu links do.
13. `store.js:373` uses `old.length`. Fix: count lines actually kept after `joinItems` (`:101`) and don't let the `dropped` notice (`:167`) replace it.
14. `B/src/middlewares/rateLimit.js:26`: use a different message when `by` is set ("Too many changes to your bag…").
15. `store.js:17-18`: read `config.limits.bag` (sent by `B/src/services/shop/config.service.js:18`).
16. `bag.service.js:89`: answer `unavailable` for `not_found` too if hiding existence matters (the website would then keep dead links instead of removing them; decide which is wanted).
17. `B/src/middlewares/shopGuard.js:26`: add `PUT` to `Access-Control-Allow-Methods`.

**Checked and fine (no change needed)**
- Field names, limits and slug rules match on both sides: `B/src/validators/shop/bag.validators.js:6-27` vs `W/src/bag/store.js:17-20,76-91`; `priceSeen` is rounded on both (`bag.validators.js:19`, `store.js:85`, `:238`).
- Prices are whole rupees everywhere (`catalog.service.js` `presentCard`: `Math.round(onlinePrice)`); the checkout re-checks the shown lines and total (`checkout.service.js:279-283`, `BAG_CHANGED`).
- Sets never exceed stock: capped in the website (`store.js:236`, `ProductPage.jsx:125-126`), in `setItem` (`bag.service.js:130`), `merge` (`:165`) and `readBag` (`:108`); the database refuses quantity outside 1–50 (migration `BagItem_quantity_check`).
- One change at a time per customer: `pg_advisory_xact_lock` in `bag.model.js:10`, used by all five `/me/bag` routes and by checkout (`checkout.service.js:274`). The 20-saree limit is exact even with two tabs.
- No customer can touch another's bag: the account always comes from the sign-in key (`authenticateCustomer.js:30`, `bag.controller.js:15`); every query filters by `authAccountId` (`bag.model.js:21-47`).
- Tampering with `nh-bag-v1` only changes what that visitor sees; every value is cleaned (`store.js:76-91`) and the server recomputes prices and stock. Photo links must start with `https://` or `/`, and names are shown as plain text.
- Payment removes bought sarees (`checkout.service.js:519`); the website re-reads the bag after paying (`usePayment.js:58`, `OrderPage.jsx:184`).
- Account deletion removes the bag (`account.service.js:73`), plus `onDelete: Cascade` in `schema.prisma` `BagItem`.
- WhatsApp number `917382388565` in both `W/src/config/config.js:13` and `B/src/config/constants.js:190`; the message is built in `W/src/bag/message.js:8-14` and encoded with `encodeURIComponent` (`:20`).
- Doc difference only: the design notes say the 120-a-minute limit is "per network on all six"; the code counts the five signed-in routes per customer (`routes/shop/index.js:80`), which is better for mobile networks.
  > **Second check: ✅ Correct.**

---

## Second check (26 Oct 2026)

All 20 problems (1 Must, 2 Should, 17 Small) and 3 developer notes were checked against the code.

**Counts: ✅ 22 · ⚠️ 1 · ❌ 0.**

- ⚠️ Small 5: real missing guard, but much rarer than described (the per-customer lock means the older answer normally lands first), and if it happens the old view stays until the next check.

Details and evidence: [checks/07-bag-check.md](checks/07-bag-check.md).

---

## Third check (26 Oct 2026)

Three items were checked again from the code: Small 5 (the one ⚠️), the second checker's precision on Must fix 1, and its note that the payment's bag delete can collide with a bag change and answer 500 (developer note Small 10).

**Counts: Second checker right 3 · First reviewer right 0 · Both partly right 0 · Neither right 0.**

- Must fix 1 stays **Must fix**. Right after a failed join, checkout shows "We couldn't check your bag just now · Try again". Pay goes grey with no reason once that (or any later) check succeeds as a visitor check. If the customer reaches checkout later, they may never see the red note.
- Small 5 stays **Small** (very rare). The server lock makes the older answer arrive first, so only swapped network delivery shows the old bag, and it then stays until the next check or change.
- The 500 collision note stays **Small** (very rare). The same can happen on the join, Buy again, a bag read that lowers a line, and the 60-day clean-up. Nothing is lost.

Details and evidence: [checks/07-bag-third-check.md](checks/07-bag-third-check.md).

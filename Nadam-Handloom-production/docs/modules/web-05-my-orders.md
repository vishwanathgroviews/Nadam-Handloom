# Website module W7: My orders

| | |
|---|---|
| **Status** | **Built and tested end to end on 17 Oct 2026, on this Mac only (not live).** Picks: **all A** (the user, 17 Oct: "implement it as you are recommended"). **Cancelling (7.10) stays parked** for a later discussion (the user: "cancelling part we will see discuss"); each order says "Need to cancel or change something? WhatsApp us". Goes live together with W6 (section 18), on the user's go. |
| **Where** | The website (`Nadam-frontend/customer-web`), the server (`Nadam-backend`, `/api/v2/shop`), and two small changes on the admin side (shipped and delivered notices) |
| **Users** | Signed-in customers (W1). The shop marks orders shipped and delivered in the admin app (Module 7) |
| **Design** | Design C Utsav, as live. Mock-up: [`design/ui-mockup/web-7-my-orders/`](../design/ui-mockup/web-7-my-orders/index.html) |
| **Comes after** | W6 checkout (built 17 Oct, not live). **Comes before** W8 go-live |
| **Plan of the whole website** | [`web-00-website-plan.md`](web-00-website-plan.md) |

## 1. Goal
After paying, a customer can always find their order. They see where it is (packed, shipped, delivered), track the parcel, download their GST invoice, buy the same sarees again, and ask the shop about it. Nothing confusing shows: no abandoned checkouts, no wrong address, no other people's orders.

## 2. What is in this module
- **My orders** (`/account/orders`): every order of the customer, newest first, 20 at a time.
- **One order** (`/order/NH…`, the page W6 made): what happens next, then a **progress line** (Paid → Packed → Shipped → Delivered). Under it:
  - the sarees, the address, the payment;
  - **tracking** (courier, number, Copy, "Track on DTDC");
  - **Download invoice**, **Buy again**, **Help on WhatsApp**.
- **Notices to the customer** when the shop marks the order **shipped** (with the tracking number) and **delivered** in the admin app.
- **My account**: a "My orders" tab, and the latest order on the overview.
- **Not in this module:**
  - **Cancelling (to discuss, section 6, item 7.10)**;
  - returns and exchanges;
  - courier status read live from DTDC (no courier connection yet);
  - SMS or email updates.

## 3. What the old website did (read from its code; it must not be copied)
| Old behaviour | Problem | W7 |
|---|---|---|
| The list asked for 10 orders, with no "more" | Orders after the 10th never showed | 20 at a time, "Show more" |
| Every status was listed, including checkouts never paid ("Payment Pending" forever; each retry made a new order) | The list filled with orders that don't exist for the customer | Only paid orders, plus the one checkout still being paid (7.9) |
| The order page showed the **saved** address (editable later), not the one on the order; the invoice did the same | A changed address showed as if the parcel went there | Always the copy kept on the order |
| The invoice link was a **public, never-expiring** file address (customer's name and mobile inside); the API also sent the payment signature and storage names to the browser | Anyone with the link could open it | Downloaded through our server after checking it is theirs; no internal fields sent |
| Online orders could never become "Delivered" (no code) | Wrong status forever | The admin app already marks delivered (Module 7); the website shows it |
| No customer notices at all; the shop sent tracking by hand on WhatsApp | Customers asked "where is my order?" | A notification when shipped (with tracking) and delivered |
| A failed list showed "No orders yet"; a network error showed "could not find this order" | Misleading | Clear "couldn't load, try again" |
| Quantity never shown; the badge always green, also for "Payment failed" | Confusing | Pieces and the right colour for each state |
| No cancel, reorder or help | – | Buy again and Help now; cancelling to discuss |
| "Try again" made a brand-new order | Duplicates | W6 already pays the same order again |

## 4. Facts (live data copy of 16 Oct; the new server)
| Fact | Detail |
|---|---|
| Website orders, ever | 20 from 4 customers; **only 2 paid** (old website: 1 shipped, 1 delivered), 18 abandoned checkouts (never shown in My orders) |
| Shipping data | Each shipped order has a Shipment: courier (DTDC), tracking number, shipped date; delivered date when marked. The admin app's activity log also records each "shipped" and "delivered" |
| Invoices | Made right after payment; stored as PDFs at a **public address** (`…amazonaws.com/invoices/<random>.pdf`); 2 of the 20 online orders have one |
| Shop and WhatsApp bills | Counter bills rarely have a mobile (2 of 39). WhatsApp orders do (84), but the numbers are typed in many ways, and only 2 orders (1 person) match a website account. Showing them in My orders would add almost nothing now |
| Statuses | Order: waiting for payment, processing (paid, to ship), shipped, delivered, cancelled. There is **no "packed" status**: "Packed" on the website means "being packed" until shipped |
| What exists already | The order page (W6: paid, confirming, waiting, refunded, cancelled), `GET /shop/orders` (W6: last 30 days, for the "confirmed" note), customer web notifications (W1, "orders" topic) with the types `order_shipped` and `order_delivered` ready but **never sent** |
| Bug found (W6) | An order **paid and then cancelled by the shop** (admin app) shows "This checkout was cancelled. Nothing was charged." It must say the payment is being refunded |

## 5. The customer's view of an order
| The order | Status shown | What the page says |
|---|---|---|
| Paid, not shipped | **Being packed** | "We pack within 2 working days" (the owner's promise) |
| Shipped | **Shipped** | Courier, tracking number, shipped date, "Track on DTDC" |
| Delivered | **Delivered** | Delivered date; Buy again; Help |
| Paid, being confirmed with the bank | **Confirming payment** | As in W6 |
| Checkout still held (not paid) | **Waiting for payment** | Pay now, held until a time (only while held) |
| Paid after the hold, saree sold → refunded (W6) | **Refunded** | Why, how much, 5 to 7 working days |
| Paid, then cancelled by the shop | **Cancelled · refund on its way** | The amount and "refunded to the same account" (the owner refunds it in Razorpay, 6.15 of W6) |
| Abandoned checkout | – | Never in My orders. The link still opens the order page with "checkout ended" |

## 6. Decisions (my recommendation first)
Choices 7.1 to 7.4, 7.7 and 7.9 can be tried in the mock-up's **Design options**.

| # | Question | Options | Recommended |
|---|---|---|---|
| 7.1 | Where My orders is | **A a tab in My account** (+ "My orders" in the menu and the latest order on the overview) · B its own page in the header | **A** |
| 7.2 | The list | **A cards with photos**, status and what's next · B compact rows · C grouped by month | **A** |
| 7.3 | One order | **A progress line on top, one column** (the W6 page, extended) · B two columns | **A** |
| 7.4 | Tracking | **A a card: courier, number, Copy, "Track on DTDC"** · B the number only | **A** |
| 7.5 | Which orders show | **A website orders** (also the 2 paid from the old website) · B also shop and WhatsApp bills with the same mobile | **A** (B later, if wanted: mobiles need cleaning first) |
| 7.6 | Invoice | **A downloaded through our server, only by that customer** · B the stored public link | **A** |
| 7.7 | Buy again | **A the whole order back to the bag** (what is still on sale) · B each saree · C not offered | **A** |
| 7.8 | Shipped and delivered notices | **A a web notification (if turned on) and the order page** · B also SMS (needs DLT templates; later) | **A** |
| 7.9 | A checkout not paid yet | **A shown only while its sarees are held (Pay now)** · B never shown | **A** |
| 7.10 | **Cancelling (to discuss later, not in this build)** | A a Cancel button before shipping, refunded automatically through Razorpay · B a cancel *request*; an owner approves it in the admin app, then the refund · C WhatsApp only (as today) | To discuss. Until then the page says "Need to cancel or change something? WhatsApp us" with the order number |

**Owner to confirm (content):** the delivery promise, "packed within 2 working days, delivered in 3 to 7 days" (also in W6).

## 7. Rules
1. **Only the customer's own orders**, by their sign-in (W1). Another person's order number answers "not found".
2. **The list:** website orders that were paid (being packed, shipped, delivered, refunded, cancelled after paying), any being confirmed, and (7.9 A) a checkout still held. Never an abandoned checkout. Newest first, 20 at a time.
3. **The address** is always the copy kept on the order; a later change to a saved address never changes an order.
4. **Tracking** shows once the shop has shipped it in the admin app: courier, number, shipped date. "Track on DTDC" opens DTDC's tracking page (it has no link per number), and Copy puts the number on the clipboard. When delivered: the date.
5. **The invoice** is for paid orders. The server checks the order is theirs, reads the PDF from storage and sends it as `INV-000123.pdf`. The public address is never given. Not made yet: "Your invoice is being made. Check back in a few minutes" (the server makes it within a minute, W6). Cancelled after paying: the invoice stamped CANCELLED (as the admin app does).
6. **Buy again** puts the order's sarees back in the bag with the bag's own rules (W5): only what is still on the website, never more than in stock, at most 20 sarees, today's price. It says which couldn't be added, then opens the bag panel.
7. **Notices:**
   - The shop marks a **website** order shipped in the admin app → "Your order NH… has shipped · DTDC D1234567 · Track it" (if the customer turned on order notifications).
   - Marked delivered → "Delivered. We hope you love it."
   - Never for counter or WhatsApp orders.
   - Never delays the admin app.
8. **Help:** WhatsApp to the shop with "About my order NH…" filled in.
9. **No secrets** reach the page: no payment signatures, storage names or internal ids.
10. **Old links** `/account/orders/<id>` and `/order-confirmation/<id>` (old website) open My orders.

## 8. Every situation and what the customer sees
| Situation | What the customer sees |
|---|---|
| No orders yet | "No orders yet": New in · All collections |
| The list can't load (offline, server) | "Your orders didn't load" with Try again (never "No orders yet") |
| More than 20 orders | Show more |
| A checkout being paid in another tab | "Waiting for payment · held until 4:35 pm" with Pay now |
| Paid just now (the page missed it) | The W6 note "Your order … is confirmed" and the order in the list |
| Shipped | Tracking card; a notification if turned on |
| Delivered | Delivered date; Buy again |
| Invoice not made yet | "Being made" (no broken link) |
| Buy again, some sold | "2 sarees added to your bag. 1 has sold since: Ask for a similar one." |
| Buy again, bag full | "Your bag is full (20 sarees)…" (W5 rule) |
| Paid late, refunded (W6) | Refunded, how much, why |
| Paid, then cancelled by the shop | "Cancelled · ₹X is being refunded to the same account" |
| Wants to cancel or change | "Need to cancel or change something? WhatsApp us" (until 7.10 is decided) |
| Not their order / wrong number | "We couldn't find this order" |
| Old website's order | Shown like any other (its photos and tracking come from the same data) |
| Signed out while looking | The sign-in page, then back to the same page |

## 9. Server plan (`/api/v2/shop`, MVC like the rest)
| Endpoint | Who | What |
|---|---|---|
| `GET /orders?offset=` | signed in | Rule 2, 20 at a time: number, status, total, pieces, placedAt, up to 4 photos, the first saree's name, shipping (status, courier, number, dates), refund, holdUntil. Replaces W6's 30-day list (the "confirmed" note uses the first page) |
| `GET /orders/:number` | signed in, own | W6's answer plus: tracking (courier, number, shipped and delivered dates, DTDC page), the progress steps, `invoice: { number, ready }`, `canBuyAgain`. Fixes the "cancelled after paying" status (section 4) |
| `GET /orders/:number/invoice` | signed in, own, paid | The PDF (`application/pdf`, `INV-….pdf`), read from storage (a new read function for S3 and the local folder). `INVOICE_NOT_READY` until made |
| `POST /orders/:number/buy-again` | signed in, own | The bag's join rules (W5); answers the bag and what couldn't be added |
| Admin app: ship / delivered (Module 7) | – | After saving, a notice to the customer of a website order (`order_shipped`, `order_delivered`, W1's notification service), in the background |

- **Database:** no change expected (everything is already recorded).
- **Limits:** per customer (like W6).
- **Tests:** every rule in section 7 and every situation in section 8, including other customers' orders, an abandoned checkout never listed, the address copy, the invoice's owner check, buy again with sold and off-website sarees, the notices (website orders only).

## 10. Website plan
- `/account/orders` (My account tab "My orders", after Overview); the overview shows the latest order; the menu gets "My orders".
- `/order/:number` (W6's page) gets the progress line, tracking, invoice, buy again and help.
- Old links (rule 10).
- Tests: unit tests for the list and the order page's states; real-browser tests (Chrome and Safari's engine, phone and laptop, light and dark): an order paid with Razorpay's test window, shipped and delivered in the admin app (API), seen on the website; the notice on the Android phone.

## 11. Before going live
Together with W6 (its section 18): the owner's delivery promise; nothing else new (no new settings, no database change).

## 12. Privacy and safety
- Only the signed-in customer's own orders; an unknown or someone else's number answers the same "not found".
- The invoice is never a public link from the website.
- No payment signatures, storage names or internal ids are sent to the page.

## 13. Steps
| Step | What | Status |
|---|---|---|
| 1 | Plan (this page) | **Done 17 Oct** |
| 2 | Clickable mock-up, every screen and state, design options | **Done 17 Oct** |
| 3 | Picks (section 6) | **All A, 17 Oct.** Cancelling (7.10): still to discuss |
| 4 | Server: endpoints, admin notices, tests | **Done 17 Oct** (section 16) |
| 5 | Website: pages and tests | **Done 17 Oct** (section 16) |
| 6 | Real checks | **Done 17 Oct**: Chrome, Safari's engine, real Google Chrome with Firebase, and **the Android phone** (Samsung Note10 Lite, its own Chrome: 80/80, section 17) |
| 7 | Record here, in the website plan and the to-do list; live with W6 on the user's go | Recorded 17 Oct. Live: waiting for the go |

## 14. The mock-up
`docs/design/ui-mockup/web-7-my-orders/`: open `index.html`. Serve `docs/design/ui-mockup` with `python3 -m http.server 8765` and go to `http://127.0.0.1:8765/web-7-my-orders/`. The customer "Priya", her orders, tracking numbers and invoice numbers are samples, marked as such; the sarees, prices and photos are real.

## 15. Later (not in W7)
- Cancelling (7.10, to discuss).
- Returns and exchanges (to-do item 5).
- Shop and WhatsApp bills in My orders (7.5 B), after cleaning the mobiles.
- Live courier status (a DTDC connection); SMS updates (DLT); email receipts.

## 16. What was built (17 Oct 2026, local only)
**Server (`Nadam-backend`), no database change:**
- `GET /api/v2/shop/orders?offset=`: rule 2, 20 at a time, newest first, with `nextOffset`. Each row: number, status, date, total, pieces, how many sarees, the first saree's name, up to 4 photos, what's next (hold time, payment, shipping), the invoice's state, `canBuyAgain`, `oldWebsite`. Replaces W6's 30-day list (the "Your order is confirmed" note uses the first page).
- `GET /orders/:number`: W6's answer plus tracking (courier, number, shipped and delivered dates, DTDC's page), `invoice: { number, ready, cancelled }` (no address), `canBuyAgain`, `oldWebsite`, and `cancelled` for an order the shop cancelled after paying.
- **The W6 slip is fixed:** a paid order cancelled in the admin app is now `cancelled_paid` ("Cancelled · refund on its way"), never "Nothing was charged".
- `GET /orders/:number/invoice`: the PDF for its own customer only (`attachment; filename="INV-….pdf"`, `private, no-store`). Read from storage by its key (S3 or the local folder); if the stored file can't be read, the same invoice is drawn again from the records; a cancelled order's copy is always stamped CANCELLED. Not made yet: `INVOICE_NOT_READY`; never paid: `NO_INVOICE`. Each download is in the audit log.
- `POST /orders/:number/buy-again`: the bag's own rules (W5). Answers the bag plus what was added, raised, already there, and skipped (sold out, not on the website, bag full), by name. Not on an order still being paid for (`CANT_BUY_AGAIN`).
- **Notices:** when the admin app marks a **website** order shipped ("Your order has shipped · NH… is on its way with DTDC. Tracking number …") and delivered ("We hope you love it"). Once each, in the background (the admin app never waits), only to browsers with order updates on. Never for counter or WhatsApp orders.
- **The owners' hand refund (6.15 of W6):** Razorpay's `refund.processed` notice for a refund made in its dashboard is recognised ("refund by hand") and the order then says "your ₹… was refunded on <date>".
- Files: `services/shop/orders.service.js` (list, invoice, Buy again), `services/shop/orderNotices.service.js`, changes in `checkout.service.js` (status, order view), `checkout.model.js` (the list's filter), `bag.service.js` (`addOrderLines`), `invoice.service.js` (`invoicePdfAgain`), `storage/local.js` and `s3.js` (`read`), `order.service.js` (the notices), the routes, controller and checks.

**Website (`customer-web`):**
- **My orders** (`/account/orders`), a tab of My account after Overview (7.1 A): cards with photos, status, what's next, the amount, and View order, Pay now, Track, Invoice, Buy again (7.2 A). Loading, "couldn't load" with Try again (never "No orders yet"), no orders yet, Show more (the focus moves to the first new order).
- **One order** (`/order/NH…`): right after paying, W6's "Thank you" (now with a My orders link and the invoice download). Any later visit: the order's own page (7.3 A): number, date, status, the progress line, the tracking card with Copy and "Track on DTDC" (7.4 A), Download invoice, Buy again, Help on WhatsApp, "Need to cancel or change something? WhatsApp us" while being packed; the sarees, the address kept with the order, the payment. Waiting for payment: Pay and Change my bag. Refunded and cancelled by the shop: why, how much, when.
- **My account:** the latest order on the overview, a My orders tile; "My orders" in the menu and the footer.
- Old website links `/account/orders/<id>` and `/order-confirmation/<id>` open My orders.
- Files: `pages/orders/MyOrdersPage.jsx`, `pages/orders/OrderPage.jsx`, `orders/` (`status.js`, `parts.jsx`, `actions.js`, `invoice.js`, `useMyOrders.js`), `theme/orders.css`, and small changes in `api/`, `bag/store.js` (`buyAgain`), `AccountLayout`, `OverviewPage`, `FullMenu`, `Footer`, `OrderNotice`, `App.jsx`.

**Decided while building (small, in the spirit of the picks):**
- The reason the shop types when cancelling (admin app) is the shop's own note: **not shown to the customer**.
- The order page shows "Delivered to" once delivered and "Delivery address" for a refunded or cancelled order.
- The cancel-or-change line shows only while the order is being packed (or still being paid for).

## 17. Test results (17 Oct 2026)
| Check | Result |
|---|---|
| Server, all tests | **581/581** (W7: 20 new in `tests/api/shop/orders.test.js`) |
| Website unit tests, lint | **125/125**, lint clean |
| W7 in a real browser (`e2e/w7.e2e.cjs`): Chrome 1440 light + 390 dark | **143/143** |
| The same in Safari's engine (390 light, 1440 dark) | **143/143** |
| The same on the production build with the live security settings (port 5181) | **143/143** (the invoice download included) |
| W6 again (Chrome and Safari's engine), W5 bag, W1 account | **147/147**, **147/147**, **111/111**, **245/245** |
| Notices in real Google Chrome through Firebase (local server, the live website's public Firebase settings) | "Shipped" shown on the open page; "Delivered" shown by Chrome as a notification with the website closed, its tap opening the order. Each sent once |
| **The Android phone** (Samsung Note10 Lite SM-N770F, Android 12, its own Chrome 155, driven over USB: `NH_ENGINE=android node e2e/w7.e2e.cjs`) | **80/80**: the whole journey above on the phone, plus: notifications turned on (Firebase); with the website open, "Your order has shipped … Tracking number …" shown on the page; with Chrome in the background, the phone's notification "Your order was delivered · NH… was delivered. We hope you love it." (with the shop's logo); tapping it opened the order showing Delivered; the invoice saved in the phone's Downloads ("File downloaded"). Afterwards the website's data, the test invoice and the test tabs were removed from the phone |

**Found and fixed on the phone (17 Oct):**
- **Two notification sign-ups at once (W1 code):** when the Notifications page checked this browser while "Turn on" was pressed, Firebase was asked twice at the same moment and made two addresses; Firebase dropped the first at the next send (the customer still got each notice once). Now simultaneous asks share one answer (`push/push.js`, with a test).
- **The order page updated the bag button while drawing** (React warned; from W6): the bag refresh now runs outside the state update.

The browser test covers: a visitor sent to sign in and back; no orders yet; the tab, menu and footer links; paid → "Thank you" → My orders; a checkout still held (first, Pay now, on the overview) and gone after "Change my bag"; the progress line; the invoice download (a real PDF); shipped (badge, three steps, tracking number, DTDC link, Copy to the clipboard, the card's Track landing on the tracking card); delivered; Buy again with both sarees sold, then with one back in stock (added, the other named, the bag panel, saved in the account); cancelled by the shop (being refunded, the shop's note hidden, invoice stamped), then the owner's hand refund (refunded, with the date); 22 orders with Show more and the focus; not found; the old links; one heading per page, alt text, named buttons, no sideways scrolling, no console errors.

## 18. Going live (with W6, on the user's go)
Nothing new beyond W6's section 18: no database change, no new setting. Deploy the server and website together with W6; the owner confirms the delivery promise ("packed within 2 working days, 3 to 7 days"). After going live, check once: a real order shipped in the admin app reaches the customer's phone as a notification.


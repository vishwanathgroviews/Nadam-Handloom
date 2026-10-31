# Website module W6: checkout and payment (Razorpay)

| | |
|---|---|
| **Status** | **Built and tested on 17 Oct 2026, on this Mac only (not live).** All recommendations (A) taken (user, 17 Oct). Left: one run with Razorpay's real test mode (needs the test keys), the owner's policy texts, then going live on the owner's go (section 18). |
| **Where** | The website (`Nadam-frontend/customer-web`), the server (`Nadam-backend`, `/api/v2/shop` and one Razorpay address), nginx (the website's security settings), the Razorpay dashboard (the owner) |
| **Users** | Signed-in customers (sign-in is the mobile number and an SMS code from W1). The shop sees paid orders in the admin app (Module 7). |
| **Design** | Design C Utsav, as live. Mock-up: [`design/ui-mockup/web-6-checkout/`](../design/ui-mockup/web-6-checkout/index.html) |
| **Comes after** | W5 the bag (live 16 Oct). **Comes before** W7 My orders, W8 final go-live checks |
| **Plan of the whole website** | [`web-00-website-plan.md`](web-00-website-plan.md) |

## 1. Goal
A customer pays for their bag online in under a minute, safely: the sarees are held for them while they pay, the money is always checked with Razorpay before anything is marked paid, and a saree is never sold twice (online and at the counter). The shop sees each paid order in the admin app, ready to pack, with its GST invoice.

## 2. What is in this module
- **Checkout** (`/checkout`): sign in (if needed), choose or add the delivery address, review the sarees and the total, **Pay**.
- **Holding the sarees** for 15 minutes from **Pay**, so the counter can't sell them meanwhile (the admin app already shows "held by a website order").
- **Razorpay's payment window** (UPI, cards, net banking, wallets), opened on our page.
- **Checking the payment on the server** (signature, then Razorpay's own record of the payment) before the order counts as paid; Razorpay's notices to the server (webhook) as the safety net.
- **What happens after:** order paid → sarees sold online, removed from the bag, GST invoice made, order in the admin app's **To ship**, a notification to the customer (if they turned notifications on).
- **Every other ending:** payment failed, window closed, bank slow, the hold ended, paid after the hold ended, something sold or changed price before paying, offline.
- **The confirmation page** (`/order/:orderNumber`) and the pages Razorpay requires: **Shipping**, **Cancellation and refunds**, **Contact us**.
- Not in this module: My orders and tracking (W7), cancelling a paid order from the website (W7), cash on delivery, coupons, gift wrap, saved cards.

## 3. What the old website did (read from its code; it must not be copied)
The old website and server (`/api/v1`) had a working Razorpay checkout. Its flow is the right shape; its rules had serious gaps.

| Old behaviour | Problem | W6 |
|---|---|---|
| Any payment that arrived was marked paid, whatever the order's state (`finalizeCapturedPayment`) | A checkout cancelled at the counter ("Sell anyway"), a payment after the hold ended, or after a "failed" signature brought the order back to "processing": **a saree could be sold twice** (to-do item "Before online payment") | A payment only completes an order that still holds its sarees; otherwise the sarees are claimed again if still in stock, or the money is refunded automatically (rule 7.6) |
| The browser's word ("signature") alone was trusted; no amount or currency check | A captured payment was never confirmed | Signature **and** Razorpay's own record of the payment (status, amount, currency, order) |
| Every "Pay" click made a new order, while the earlier one still held the same sarees | A customer retrying after closing the window got "just sold out" for their own sarees | One open checkout per customer; paying again reuses it (rule 7.3) |
| Window closed or payment failed: the server was never told | Orders stayed "waiting for payment" with nothing to show | The page offers "Pay now" while the sarees are held; the server knows the state |
| Razorpay's checkout script failed once → failed forever until reload | Customers stuck | Load again on retry |
| Confirmation page said "Order Confirmed!" even for a cancelled order | Wrong message | One page per real state (section 8) |
| Webhook: only `payment.captured`, on the old server | The old server would also finish **new** orders (shared database) | **The same webhook** (its address and secret) is sent to the new server by nginx at go-live; no new webhook is made (user, 17 Oct). The old server is switched off the same day (6.14 A) |
| GST invoice always CGST + SGST | An order to another state needs IGST | Decision 6.12 (with the accountant) |
| No refund code; refunds by hand in Razorpay | Not recorded anywhere | Automatic refund for a late payment that can't be filled; recorded |
| No security policy on the old site | – | The new site has a strict one: Razorpay's addresses are added (section 11) |

## 4. Facts (live data copy of 16 Oct, and the server)
| Fact | Detail |
|---|---|
| Online orders on the old website, ever | 20: 1 delivered (₹3,000), 1 shipped (₹10, a test), **18 started and never paid** (4 accounts, 9–10 Oct, ₹10 to ₹54,576) |
| Old stock holds | 29 expired, 2 became sales |
| Customers / saved addresses | 9 customer accounts; 6 addresses, **2 with a broken state** ("Dkrkgkv", "Ap"): such an address must be corrected before it is used |
| Prices | Include GST (5%); delivery is free; the website price is per collection |
| Order numbers | `NH` + 8 digits (shared with counter and WhatsApp bills) |
| What the new server already has | The tables (Order, OrderItem, Payment, Shipment, Invoice, Reservation, StockLedger), the admin app's Orders (To ship → Shipped → Delivered, cancel), invoices (`ensureInvoice`), customer notifications (`notifyCustomer`), addresses, the bag. **No payment code, no Razorpay keys, no hold or expiry code.** |
| What the admin app expects | A paid website order has status **processing** and payment **paid**; an abandoned checkout stays **pending payment** (the "Unpaid checkouts" list and Home use it); revenue counts processing, shipped and delivered |
| Razorpay account | Live keys and a webhook secret are in the **old** server's settings; the dashboard webhook points at the old server (`/api/v1/webhooks/razorpay`, `payment.captured` only) |

## 5. How a payment works (in plain words)
1. **Pay** (our server): checks the bag once more (stock, price, still on the website), makes the order "waiting for payment", **holds** each saree (piece → "reserved") for 15 minutes, and asks Razorpay for a payment request for the exact total.
2. **Razorpay's window** opens on our page with the amount, the customer's name, mobile and email filled in. It closes by itself when the hold ends.
3. The customer pays. Razorpay gives the page a receipt (payment id + signature).
4. **Our server checks**: the signature (with our secret key), then asks Razorpay directly: is this payment captured, for this amount, in rupees, for this order? Only then:
5. **Order paid**: sarees → "sold online", order → "processing" (admin app: To ship), payment → "paid" (with the method: UPI, card…), the paid sarees leave the bag, the GST invoice is made, the customer gets "Order confirmed" (and a notification if turned on).
6. **Razorpay's notice (webhook)** arrives on its own a moment later. If the customer's phone lost the connection after paying, this is what completes the order. Each notice is handled once.

## 6. Decisions for the owner (my recommendation first)
Choices 6.1 to 6.7 can be tried in the mock-up's **Design options** panel, with the same letters.

| # | Question | Options | Recommended |
|---|---|---|---|
| 6.1 | Checkout layout | **A two steps on one page: 1 Address, 2 Review and pay, with the summary on the right** · B three steps with a progress bar (Address → Review → Pay) · C everything on one page | **A** |
| 6.2 | Signing in at checkout | **A the sign-in page you already have, then straight back to checkout** · B sign in inside the checkout page | **A** |
| 6.3 | Choosing the address | **A cards, the default one already chosen; "Add a new address" opens the form** · B a compact list · C a drop-down | **A** |
| 6.4 | The bag's main button now | **A "Checkout" main, "Order on WhatsApp instead" as a small link** · B both buttons the same size · C keep WhatsApp main | **A** |
| 6.5 | Showing the hold | **A one quiet line: "Held for you until 4:35 pm"** · B a live countdown (14:59) · C not shown | **A** |
| 6.6 | Confirmation page | **A a large tick, the order number, what happens next, then the sarees and the address** · B a compact receipt | **A** |
| 6.7 | Pay button on phones | **A a bar fixed at the bottom with the total and Pay** · B only at the end of the page | **A** |
| 6.8 | Payment methods | **A everything Razorpay offers on the account: UPI, cards, net banking, wallets** · B UPI and cards only | **A** |
| 6.9 | Cash on delivery | **A no** (high-value handloom; returns and unpaid parcels cost the shop) · B yes, below an amount | **A** |
| 6.10 | Hold time | **A 15 minutes from Pay** (fits Razorpay's 12-minute minimum capture window) · B 20 · C 30 | **A** |
| 6.11 | Payment arrives after the hold ended | **A if every saree is still in stock, the order goes through; if not, the whole payment is refunded automatically and the customer is told** · B always refund | **A** |
| 6.12 | GST for orders delivered outside Andhra Pradesh | **A IGST on those invoices (place of supply = the delivery state), after the accountant confirms** · B CGST + SGST as today | **A** (to-do item 1) |
| 6.13 | Messages to the customer | **A on the screen, a web notification if they turned them on, and My orders (W7); SMS order updates later (needs DLT templates)** · B also email (needs an email service) | **A** |
| 6.14 | The old server when W6 goes live | **A switch it off the same day** (it is also due before 4 Nov) and move Razorpay's webhook to the new server · B keep it running, only move the webhook | **A** |
| 6.15 | Refunds the shop decides (a paid order cancelled in the admin app) | **A by hand in the Razorpay dashboard for now (as today), the admin app shows "Refund ₹X in Razorpay"** · B a Refund button in the admin app | **A** (B later) |

**Owner to provide (content):** the delivery promise (for example "packed within 2 working days, delivered in 3 to 7 days"), the cancellation and refund policy, and the shipping policy. Drafts are in the mock-up; nothing goes live without the owner's text.

## 7. Rules
1. **Sign-in needed** for checkout (W1). The bag stays while signing in (it joins the account, W5).
2. **The order is made from the account's bag**, only sarees that can be bought now. If anything changed since the bag was last seen (sold, fewer left, new price, off the website), **Pay** stops and the page shows what changed; the customer looks and presses Pay again.
3. **One open checkout per customer.** Pressing Pay again (after closing the window or a failed payment) reuses the same order and its hold while it lasts. If the bag changed, the earlier checkout is cancelled (its sarees released) and a new one starts.
4. **The hold:** 15 minutes from Pay. Pressing Pay again within the hold starts a fresh 15 minutes, at most 30 minutes in all per order. A hold ends early when the customer goes back to change the bag, or when an owner sells the saree at the counter with "Sell anyway" (that checkout is cancelled, as today).
5. **Every 30 seconds** the server ends holds whose time is up: sarees back in stock (and back on the website). The order stays "waiting for payment" (the admin app's Unpaid checkouts list).
6. **A payment arrives** (from the page or the webhook): checked (signature, then Razorpay's record: captured, same amount, rupees, our payment request). Then:
   - the order still holds its sarees → **paid**;
   - the hold ended or the checkout was cancelled → if every saree is still in stock, claim them again → **paid**; otherwise → **refund the whole payment automatically** (normal speed, 5 to 7 working days), the order stays cancelled with the reason "Paid after the sarees were sold; refunded", the customer sees it;
   - already paid (the same payment twice, the page and the webhook) → nothing more;
   - a second, different payment for an order already paid → refunded automatically.
7. **Never paid by the browser alone.** If Razorpay's record can't be read at that moment, the page says "Payment received, confirming" and the server keeps checking (every minute, up to 3 days) and the webhook completes it.
8. **Razorpay settings per payment request:** amount in paise, rupees, the order number as the receipt, our order id in the notes; automatic capture with a 15-minute capture window, so a payment that the bank confirms much later is not taken and Razorpay returns it by itself.
9. **The invoice** is made right after payment (`ensureInvoice`, as the admin app does). If it fails (storage busy), the server tries again every minute; the order is paid regardless.
10. **The delivery address is copied onto the order** (name, mobile, house, area, landmark, city, state, pincode). Editing or deleting a saved address later never changes an order.
11. **Razorpay's notices (webhook)** go to the new server only: `https://api.nandamhandlooms.com/api/v2/payments/razorpay/webhook`. Checked with the webhook secret on the exact bytes received, answered within 5 seconds, each notice handled once (Razorpay's event id). Handled: payment authorized, captured, failed; order paid; refund processed or failed.
12. **The customer can't be charged more than the total shown** on the review step: the amount is fixed on the server and checked on the way back.
13. **Limits:** Pay at most 10 times a minute per customer; at most 20 sarees per order (the bag's limit); the hold total at most 30 minutes.

## 8. Every situation and what the customer sees
| Situation | What the customer sees |
|---|---|
| Not signed in | "Sign in to check out. Your bag stays." → sign-in → back to checkout |
| No saved address | The address form opens at once |
| A saved address with a missing or wrong field (old website) | "Please check this address" with the form, before it can be used |
| Something sold or changed price before Pay | Back to the review step with the change marked on the line, a note at the top, the new total; Pay again |
| Everything in the bag sold | "Your bag has nothing that can be bought now" and the bag |
| Paid | **Order confirmed**, order number, what happens next, the sarees, the address, the total paid and the method |
| Payment failed (card declined, UPI failed) | "Payment didn't go through. Nothing was taken." **Try again** (sarees still held until 4:35 pm) |
| Window closed without paying | "Payment not completed. Your sarees are held until 4:35 pm." **Pay now** · Change my bag |
| Bank slow (Razorpay says pending) | "Payment received, confirming with your bank. You can close this page; we'll update you." (web notification, My orders) |
| Hold ended before paying | "The 15 minutes are over and your sarees were released." **Check my bag again** |
| Paid after the hold ended, sarees still there | Order confirmed (as normal) |
| Paid after the hold ended, a saree sold meanwhile | "We couldn't keep your order: a saree sold before your payment arrived. Your ₹X is being refunded to the same account (5 to 7 working days)." |
| Offline when pressing Pay | "You're offline. Nothing was charged." Pay waits |
| Razorpay's window can't load (in-app browsers like Instagram's) | "Payments don't open inside this app. Open the website in Chrome or Safari." with Copy link |
| The website is switched off by the shop | The maintenance page (as today); payments already made still complete |
| Two tabs paying at once | One order, one payment; the other tab shows the same result |

## 9. Server plan (`/api/v2`, MVC like the rest)
| Endpoint | Who | What |
|---|---|---|
| `POST /shop/checkout` | signed in | `{ addressId }` → makes (or reuses) the order from the account's bag, holds the sarees, makes the Razorpay payment request. Answers the order (number, lines, total, address, `holdUntil`) and what the page needs to open Razorpay (key id, Razorpay order id, amount, name, mobile, email). Errors: `BAG_EMPTY`, `BAG_CHANGED` (with the checked bag), `ADDRESS_INVALID`, `PAYMENTS_OFF` |
| `POST /shop/orders/:number/pay` | signed in, own order | Pay again: a fresh payment request while the hold lasts (renews the hold, at most 30 minutes in all). `HOLD_ENDED` when the sarees were released |
| `POST /shop/orders/:number/verify` | signed in, own order | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` → rule 7.6. Answers `paid`, `confirming`, `refunded` or `failed` |
| `POST /shop/orders/:number/cancel` | signed in, own order, waiting for payment only | "Change my bag": ends the checkout, releases the sarees |
| `GET /shop/orders/:number` | signed in, own order | The order for the confirmation page (no payment secrets) |
| `POST /payments/razorpay/webhook` | Razorpay only (signature) | Outside `/shop` so the website switch can't block it; its own raw-body reader |
| `GET /shop/config` | anyone | adds `payments: { enabled, holdMinutes: 15 }` |

- **Background jobs** (in the server, like the clean-up job): end holds every 30 seconds; keep checking "confirming" payments every minute (up to 3 days); make missing invoices every minute.
- **Database (additive only):** a new table `PaymentAttempt` (one row per Razorpay payment request: order, Razorpay order id, amount, status, payment id, method, failure reason, refund id and status), a new table `PaymentEvent` (each Razorpay notice once: event id, type, when, result), and on `Payment` (the one row per order the admin app reads) the method and when it was captured. If 6.12 is A: on `Invoice` the IGST amount and the place of supply. No existing column changes.
- **Settings** (in the one `.env`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (the same account as today), `RAZORPAY_WEBHOOK_SECRET` (the **old** webhook's secret, reused), `PAYMENTS_ENABLED`, `PAYMENT_PROVIDER`, `GST_IGST_OTHER_STATES`, `SHOP_STATE`.
- **Admin app (small changes):** the order shows the payment method ("Paid online · UPI"); the landmark is printed in the address; a refunded late payment shows in the order's timeline.
- **Tests:** every rule in section 7 and every situation in section 8, with Razorpay's test mode and signed test notices (Razorpay can't send notices to a computer at home), including two tabs, two notices at once, a payment after the hold, a payment for a checkout cancelled at the counter, a different amount, a broken signature.

## 10. Website plan
- `/checkout` (address step, review and pay), `/order/:orderNumber` (confirmation and every ending), `/shipping`, `/refunds`, `/contact` (policy pages).
- Razorpay's script is loaded only when Pay is pressed (and loaded again if it failed). The window's timeout is the time left on the hold.
- The bag's main button becomes **Checkout** (6.4); "Order on WhatsApp" stays on the saree page and as a small link in the bag.
- Tests: unit tests for the checkout steps; real-browser tests (Chrome and Safari's engine, phone and laptop, light and dark) with Razorpay's test mode and test UPI (`success@razorpay`, `failure@razorpay`) and test cards.

## 11. Before going live (the owner and me)
1. **Razorpay dashboard (the owner):** check the account is in Live mode and the registered website is `nandamhandlooms.com`. **The webhook stays as it is** (`/api/v1/webhooks/razorpay`, same secret): nginx sends it to the new server (section 18). Optional, same webhook: also tick `payment.failed`, `payment.authorized`, `order.paid`, `refund.processed`, `refund.failed` (only `payment.captured` is needed; the server checks the rest by itself every minute).
2. **Policy pages** live with the owner's text (Razorpay checks them).
3. **The website's security settings (nginx):** allow Razorpay's addresses (`checkout.razorpay.com`, `cdn.razorpay.com` for scripts; `api.razorpay.com` for its window and calls, plus its analytics hosts; `cdn.razorpay.com` images) and let its window use the payment feature. Tried first in "report only" mode so nothing breaks.
4. **The old server** switched off (6.14 A), after checking no phone still uses the old staff app.
5. **A real payment** by the owner (one saree), then a refund from the dashboard, to see the whole path once (Razorpay keeps its fee, about 2%).
6. Backups (database, server code, website) and the undo steps, as for every go-live.

## 12. Privacy and safety
- Card and UPI details never touch our server: Razorpay's window handles them.
- The secret keys stay in the server's `.env`; the page only gets the public key id.
- A customer can only see and pay their own orders (by order number and their sign-in).
- Payment receipts and signatures are never sent back to the page.

## 13. Steps
| Step | What | Status |
|---|---|---|
| 1 | Plan (this page) | **Done 16 Oct** |
| 2 | Clickable mock-up, every screen and state, design options | **Done 17 Oct** |
| 3 | Picks (section 6): **all A** (user, 17 Oct). Policy texts: drafts on the website, the owner to confirm | Picks done; texts waiting |
| 4 | Server: payments, holds, webhook, jobs, new tables (local), tests | **Done 17 Oct** (section 16) |
| 5 | Website: checkout, confirmation, policy pages, tests | **Done 17 Oct** (section 16) |
| 5b | One run with Razorpay's real **test mode** | **Done 17 Oct** (section 20: card success and failure; UPI shows as a QR on a laptop) |
| 6 | Security settings, nginx webhook route, go live on the owner's go, backups first | – (section 18) |
| 7 | Record here, in the website plan and the to-do list | **Done 17 Oct** |

## 14. The mock-up
`docs/design/ui-mockup/web-6-checkout/`: open `index.html`. Serve `docs/design/ui-mockup` with `python3 -m http.server 8765` and go to `http://127.0.0.1:8765/web-6-checkout/`. Razorpay's window in the mock-up is a **stand-in** drawn by us so every ending can be tried; the real window is Razorpay's own. The customer "Priya", her addresses and every payment ending are samples, marked as such.

## 15. Later (not in W6)
- My orders with tracking, invoice download and cancelling before shipping (W7).
- A Refund button in the admin app (6.15 B).
- SMS order updates (after DLT templates) and an email receipt.
- A notification on the shop's phones for each new paid order (to-do item 12).
- Saved cards (`remember_customer`), EMI.

## 16. What was built (17 Oct 2026, local only)
**Server (`Nadam-backend`)**
| Part | File |
|---|---|
| Settings: `PAYMENTS_ENABLED` (default off), `PAYMENT_PROVIDER` (`razorpay`, or `fake` for tests; refused in production), `RAZORPAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET`, `GST_IGST_OTHER_STATES` (default off), `SHOP_STATE`. Test keys in production need `PAYMENTS_ALLOW_TEST_KEYS_IN_PRODUCTION=true` | `src/config/env.js`, `.env.example` |
| Database, additive only: tables `PaymentAttempt` (one row per Razorpay payment request) and `PaymentEvent` (each notice once); `Payment.method`, `Payment.capturedAt`; `Invoice.placeOfSupply`, `Invoice.igstAmount` | `prisma/migrations/20261017090000_w6_payments` |
| Razorpay (orders, payments, capture, refunds; 10-second limit) and the stand-in used by tests | `src/services/payments/` |
| Checkout, holds, checking payments, late payments, refunds, notices, background checks | `src/services/shop/checkout.service.js`, `src/models/checkout.model.js` |
| Jobs: holds every 30 s; payments being confirmed, lost notices, refunds to retry, missing invoices every 60 s | `src/jobs/payments.job.js` |
| Routes: `POST /shop/checkout`, `GET /shop/orders/:number`, `POST /shop/orders/:number/pay`, `…/verify`, `…/cancel`; `POST /api/v2/payments/razorpay/webhook` (raw body, outside `/shop`). Test-only `POST /api/v2/payments/fake/pay` exists only with the stand-in | `src/routes/shop/index.js`, `src/app.js`, controllers |
| Invoices: "Paid online (UPI)"; place of supply; one IGST line when the switch is on and the state isn't Andhra Pradesh | `src/services/invoice.service.js`, `invoicePdf.service.js` |
| Admin app: "Paid online (Razorpay) · UPI", the landmark in the address | `src/services/order.service.js` |
| `GET /me/addresses` says which old address needs correcting (`problem`) | `src/services/shop/addressCheck.js` |

Found and fixed while testing:
- Pay was limited per network. Indian mobile networks put many phones on one address, so it is now **per customer**; the signed-in bag's limit too.
- While paying, the customer's own sarees showed as "sold out" in their own bag; they count as theirs now.
- A second payment on an already-paid request would have overwritten the paid record; it is refunded and the record kept.
- After a payment completed by Razorpay's notice (the phone had lost the connection), the checkout kept jumping to that old order; it now says "Your payment for order … went through" once and carries on.

**Website (`Nadam-frontend/customer-web`)**
- `/checkout`: sign-in card for visitors (then back here). Step 1, the address: cards with the default chosen; the form opens at once if there's none; an old address with a wrong state must be corrected first. Step 2, review and pay. The summary (GST note, hold line, Pay) is on the right; on phones a Pay bar sits at the bottom.
- Razorpay's script loads only when Pay is pressed, and again after a failure. Our server checks every payment before the order page shows it. Window closed: "Payment not completed", held until a time, with Pay now and Change my bag. Payment failed: "Nothing was taken" and Try again. Something changed: Pay stops and the change shows on the line. The 15 minutes ending, offline, and in-app browsers (Instagram and others) are all handled.
- `/order/NH…`: Order confirmed (6.6 A); confirming (asks again by itself); not completed (Pay); the 15 minutes over; refunded; cancelled; not found.
- `/shipping`, `/refunds`, `/contact` (drafts, marked), linked from the footer and the Pay step. The Terms page links to them.
- The bag and side panel: **Checkout** is the main button; "Order on WhatsApp instead" is a small link (6.4 A). With payments off, everything is as before.
- My account → Addresses marks an old address "Needs checking".
- `robots.txt` keeps search engines out of `/checkout` and `/order/`. The local preview uses the security settings needed for Razorpay (section 18).

## 17. Test results (17 Oct 2026)
| Test | Result |
|---|---|
| Server, all (`npx vitest run`) | **546 / 546**; the checkout file **40 / 40** (every rule in section 7 and ending in section 8, two customers for the last piece, two taps on Pay, notices twice, bad signatures, a different amount, the IGST invoice) |
| Website unit tests | **96 / 96**; lint clean; build OK |
| `e2e/w6.e2e.cjs` (real browser, stand-in Razorpay window, local copy of live data) | Chrome **143 / 143**, Safari's engine **143 / 143** |
| Earlier website tests, with payments on | W1 **245 / 245**, W2 **379 / 379**, W5 **111 / 111** (Chrome) |
| Stress: 600 bag checks, 60 at a time | Slowest 150 ms. One check stalled once in an earlier run and could not be repeated: watch the live logs after go-live |

## 18. Going live (only on the owner's go)
1. **Before:** run once with Razorpay's real test mode on this Mac (test keys in `Nadam-backend/.env`). The owner confirms the shipping, refunds and contact texts and the delivery promise ("packed within 2 working days, 3 to 7 days").
2. **Backups:** live database dump, `/home/ubuntu/nandam-v2-backend-before-w6-<date>.tgz` (code and `.env`), `/home/ubuntu/nandam-web-dist-before-w6-<date>.tgz`, and both nginx files.
3. **Database:** `npx prisma migrate deploy` (additive: `20261017090000_w6_payments`).
4. **Server `.env`** (the one file): `PAYMENTS_ENABLED=true`, `PAYMENT_PROVIDER=razorpay`, and `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` copied from the **old** server's `.env` (read on the server, never printed). `GST_IGST_OTHER_STATES` stays `false` until the accountant confirms. Then `pm2 restart nandam-v2`; the log must say `payments: razorpay live`.
5. **nginx, `api.nandamhandlooms.com` block:** send the old webhook address to the new server (the exact-match location wins over `/api/`):
   ```nginx
   location = /api/v1/webhooks/razorpay {
       proxy_pass http://127.0.0.1:4200/api/v2/payments/razorpay/webhook;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
6. **nginx, the website's headers** (`/etc/nginx/snippets/nandam-web-headers.conf`):
   - `script-src 'self' https://checkout.razorpay.com https://cdn.razorpay.com`
   - `style-src 'self' 'unsafe-inline'` (Razorpay's loader adds a small style)
   - `img-src` adds `https://*.razorpay.com`
   - `connect-src` adds `https://*.razorpay.com`
   - `frame-src https://api.razorpay.com https://api-dark.razorpay.com https://checkout-static-next.razorpay.com`
   - `Permissions-Policy … payment=(self "https://api.razorpay.com")`

   Read from Razorpay's own script on 17 Oct. Then `sudo nginx -t && sudo systemctl reload nginx`.
7. **Website:** build and copy to `/var/www/nandam-web/dist` (keep old hashed files).
8. **Check:**
   - a real ₹ payment by the owner (one saree), then a refund in the dashboard;
   - the order in the admin app's To ship;
   - Razorpay's dashboard shows the webhook delivered (200).
9. **Old server off** (6.14 A), after checking no phone still uses the old staff app.
10. **Undo:**
    - website and nginx from the backups;
    - `PAYMENTS_ENABLED=false` and `pm2 restart nandam-v2`, which puts the bag back to WhatsApp at once;
    - remove the nginx webhook location, so the old server gets the webhook again while it is still on.

    The database change can stay.

**W7 (17 Oct) changed two things on the order page:** a later visit (from My orders or a link) shows the order's own page instead of "Thank you" again, and a paid order cancelled by the shop says "refund on its way" instead of "Nothing was charged". See `web-05-my-orders.md` section 16.

## 19. Added on 17 Oct (user: "do it end to end"): owners' Online payments and notifications
**Gaps closed after the first build**
| Gap | What was built |
|---|---|
| A customer who paid while the phone closed our page (UPI app switch) had nowhere to see it | `GET /shop/orders` (the customer's last 30 days: paid, held, being confirmed, refunded). The website shows "Your order NH… is confirmed and paid: ₹X · See the order" once per order and state (`components/OrderNotice.jsx`, remembered in `nh-orders-seen`); not on the checkout or the order page |
| A refund Razorpay refuses was retried every minute forever, silently | Tried after 1, 5, 15, 60 minutes, then every 6 hours. After the 3rd refusal, or Razorpay's `refund.failed`, the owners are told once, and it shows as **Refund stuck** |
| A very large bag got "couldn't open the payment" | `PAYMENTS_MAX_AMOUNT` (default ₹5,00,000). Above it, Pay is off with "Order on WhatsApp". Razorpay's own lower limit gets the same answer (`ORDER_TOO_LARGE`); nothing stays held |

**Admin app → More → Online payments (owners only, permission `payments.view`)**
- **List:** every website payment, newest first, with:
  - chips for state, with counts: Paid · Confirming · Not paid · Refunded · Refund stuck · Cancelled after paying;
  - days: All · Today · 7 days · 30 days · Custom;
  - method: UPI · Card · Net banking · Wallet;
  - search by order number, name, mobile or `pay_…` / `order_…` id (looks at every date);
  - totals: paid and refunded;
  - a red note when refunds are stuck.
  - Refreshes on opening, when pulled down, and when the app comes back.
- **One payment:**
  - the amount and state, and what to do (refund by hand, cancelled after paying, confirming, held until);
  - the customer (call), the sarees, each payment try (refund and refusals), Razorpay's notices and ids;
  - "Open the order".
- Server: `GET /api/v2/payments`, `GET /api/v2/payments/:number` (`services/onlinePayments.service.js`).

**Payment notifications (owners' phones only)**
- **What is sent:**
  - "New online order · ₹12,400" / "NH12345678 · 2 sarees · Priya Sharma, Hyderabad · UPI";
  - "Refund started · ₹5,800";
  - "Refund stuck · ₹5,800 … Refund it by hand in the Razorpay dashboard".
  - A tap opens that payment.
- **Who gets them:** only owners, only phones still signed in, and only where the owner left **More → Notifications → Payment notifications** on. That screen has a test button. Signing out stops them. Staff never get them.
- **How:**
  - Android goes through **Firebase**. The admin app is registered in project `nandam-cf952` on 17 Oct (`com.nandamhandlooms.admin` and `.admin.test`). Its `google-services.json` is private, in `admin-app/` (not in git).
  - iPhone goes through **Apple's push service**. It needs:
    - a push key (APNs `.p8`) from the Apple Developer account → `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` in the server `.env`;
    - Push turned on for `com.nandamhandlooms.staff` and a new signing profile;
    - an iPhone build with `IOS_PUSH=true` (until then iPhone builds leave the push permission out, so they keep building).
- **Server parts:**
  - `services/ownerAlerts.service.js`, `push/apns.provider.js`;
  - Android messages in Expo's shape in `push/fcm.provider.js`;
  - table `StaffPushToken` (one per signed-in phone);
  - `PUT/PATCH/DELETE /api/v2/me/push`, `POST /api/v2/me/push/test`.
- **Database (additive):** migration `20261017130000_admin_payment_alerts` adds `PaymentAttempt.refundTries`, `refundError`, `nextRefundAt`, `alertedAt`, and table `StaffPushToken`.

**Tests (17 Oct)**
| Test | Result |
|---|---|
| Server | **560 / 560** (new: `tests/api/onlinePayments.test.js` 14: who gets notifications, stuck refunds, the list and its filters and totals, one payment, the limit, recent orders, the Android and iPhone senders) |
| Website unit | **102 / 102** |
| Website browser `w6` | Chrome **147 / 147**, Safari's engine **147 / 147** (now also: the "confirmed" note after a lost connection, once) |
| Admin app | **142 / 142** (new: Online payments list → filter → a stuck refund → the order; notification helpers); lint clean |
| Android build 30 | `~/Documents/Nandam-Handlooms/apk/Nandam-Admin-v2.0.0-build30.apk`, owner key `ae81ad22…`, `com.nandamhandlooms.admin` 30, notification permission, live server. Not run on a phone yet (none connected). It includes build 29's Face ID change. The new parts appear only once the server update is live, because the live server doesn't yet give owners `payments.view` |

**Going live adds to section 18:**
- the second migration;
- `PAYMENTS_MAX_AMOUNT` (optional);
- the `FIREBASE_*` service account on the server, the same one the website's notifications use: check it's there;
- for iPhones, the APNs settings above.

## 20. Real tests on 17 Oct: Razorpay test mode and an Android phone
**Razorpay's real window in test mode** (the owner's test keys in `Nadam-backend/.env`; `e2e/w6-razorpay.cjs`, Chrome):
- It opens in the shop's colour with the exact amount, the customer's number and "times out in 14:59" (the hold).
- **Card succeeds:** test card `4111 1111 1111 1111`, then Razorpay's demo bank page "Success". Result: our page says Thank you; our server checked it with Razorpay; the order is processing, payment `card` with `pay_…`, and the saree sold online.
- **Card refused:** "Failure" on the demo bank page. Razorpay shows "Payment failed" with a retry; closing it shows our "Payment didn't go through. Nothing was taken."; the saree stays held.
- **Run on the production build with the live security settings** (`vite preview` = section 18 step 6): everything works; nothing of Razorpay's is blocked. Razorpay's own frame logs a refused motion-sensor read; it does that with no settings too, and it doesn't affect paying.
- Notes: Razorpay's card Continue may need a second press; the logo is sent only from the real https site (a local address can't be loaded by Razorpay).

**Android, a real phone** (Samsung Galaxy Note10 Lite, Android 12; test app `com.nandamhandlooms.admin.test` built against this Mac's server over USB; the server sending through Firebase project `nandam-cf952`):
- Signed in as a test owner. More shows **Online payments** and **Notifications → Payment notifications** (on). The token was saved.
- "Send a test notification": the banner arrived with the ₹ icon.
- **A real Razorpay test payment on the website → "New online order · ₹6,499 · NH58943514 · 1 saree · Sravani Test, Guntur · Card" on the phone.**
- Tapping it with the app in the background, and with the app fully closed: the app opens that payment. Back goes to the app's tabs.
- The Online payments list draws correctly on the phone (chips with counts, totals, rows).

**Found on the phone and fixed:**
1. The app sends its token twice at start (on start, and again when Android reports it), and the two collided in the database (an error). The server now takes one phone's sends one at a time (test added); the app skips sending a token the server already has.
2. Firebase **data-only** messages weren't shown by Samsung. Android alerts are now a system notification (title, text, the "Online payments" channel) **plus** the data for the tap (`number`, `body`). Delivered and tapped as above.
3. The search hint was cut off on a phone; it's shorter now.
4. (Android itself:) a **force-stopped** app gets no messages until it is opened again; a normally closed app does. Nothing to fix.

**Tests after these:** server 561/561, admin app 142/142, website 102/102.

Android build 30 was rebuilt with the fixes: `apk/Nandam-Admin-v2.0.0-build30.apk`, SHA-256 `feb78616…`, owner key, live server.

## 21. Review before going live (18 Oct 2026)
The user (18 Oct): "put it end to end and test it entirely, all the modules, for all the edge cases and the situations we might have missed; Razorpay test credentials only for the testing". Three read-only reviews of the code (the server's payment and order rules, the website's flows, go-live safety) found these; each was checked against the code, fixed and tested.

**Server (payments):**
| Found | Fixed |
|---|---|
| Pay in a second tab while the first tab's payment landed could mark the paid order "not paid" again, then refund the real payment | A new payment request is put only on an order still waiting and held, re-read under its lock; a paid payment is never marked "created"; the same payment told twice is "already paid" (`ORDER_PAID` to the page) |
| A failed try, then a successful try on the same payment request: if the page couldn't reach Razorpay and the notice was lost, the customer stayed charged with no order | Such requests (and every request not known to be paid) are looked at again every 5 minutes for 2 hours; a late "failed" notice never overrides a try being confirmed |
| A payment request looked at once at minute 14 was never looked at again (a payment at 14:30 with a lost notice: charged, no order, no refund) | The same 5-minute re-check |
| A Razorpay notice for a payment with no Razorpay order (a QR code, a payment link) crashed the notice handler, so Razorpay could switch the webhook off | Answered "not a website payment" |
| A second payment whose refund Razorpay refused was only logged | Kept on the paid try as "Refund stuck" in Online payments, the owners told once |
| The page and a notice at the same moment could start the same refund twice | A refund is decided once (under the order's lock) |
| The old server's hold sweep (same database, no shared lock) could release a hold at the 15-minute mark while a payment completed it: a saree sold twice | Each hold is claimed only while still active; otherwise the saree is taken from stock again, or the payment refunded |
| A refunded second payment hid a shop cancel from the customer | "Cancelled by the shop" comes first |
| One blank line in `.env` (copied from `.env.example`) stopped the server, and with it the website and the admin app | A blank line counts as not set |

**While payments are tried on the live website (test keys):**
- `PAYMENTS_TESTERS` (comma-separated mobiles): only those signed-in customers see Checkout and may pay; everyone else orders on WhatsApp as before, and the server refuses their Pay. The live server refuses to start with test keys and payments on unless it is set (and `PAYMENTS_ALLOW_TEST_KEYS_IN_PRODUCTION=true`).
- An order paid with test keys on the live server gets a **TEST-000001** invoice, printed "Test invoice (not a tax invoice)": the real GST invoice numbers are never used up by test money.

**Website:**
| Found | Fixed |
|---|---|
| Paying from the order page left "Confirming your payment" on screen for good | The confirming step ends, and the order is asked again |
| Back at checkout after paying in a UPI app (the page reloaded): "Your bag is empty" with no word about the order; or Pay offered again for an order already paid | The open checkout is asked about every few seconds while the page waits; a payment made meanwhile shows as "went through", also when Pay is refused because the bag emptied |
| The checkout ended the 15 minutes by the phone's own clock | The server decides (a phone set fast never says "over" while the sarees are still held) |
| One failed check while "confirming with your bank" stopped all checking | The checking carries on |
| A sign-in could let a visitor's bag check land over the account's bag (Pay stayed off) | A check waits for the joining |
| The last customer's "Welcome back, <name>" could stay for the next person | Cleared at sign-out |
| A browser's notifications could keep going to the previous customer (a sign-out that didn't reach us) | Linked to the customer who signs in |
| The confirming window didn't take the focus (Tab could reach "Change my bag" behind it); removing a saree or pressing "Change" sent the focus to the top | Focus moves into the window and stays; after Remove it goes to the next saree; after Change to the chosen address |
| After Pay on the order page the old "held until" time stayed | The renewed time shows |

**Not changed (kept, safe):** a payment that arrives after the customer's own newer checkout took the same sarees is refunded (the newer checkout stays open for them).

**Tests after the fixes:** server 594/594; website 138/138, lint clean; browser tests Chrome (checkout 147/147, My orders 143/143, bag 111/111) and Safari's engine (147/147, 143/143).


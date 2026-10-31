# Second check: Module 9, Payments (Razorpay)

Date: 26 Oct 2026. Report checked: [`../09-payments.md`](../09-payments.md).
I only read code (server, website, schema, and the old server's code one folder up). I did not run, test or change any code, and I did not open `.env`.
All `path:line` references start from the project folder (`Nadam-Handloom-production/`). `B/` = `Nadam-backend/src/`, `W/` = `Nadam-frontend/customer-web/src/`, `OLD/` = `../backend/src/` (the old server, `Nadam-Handloom/backend`).

Live facts used: everything in this code is live since 26 Oct ~13:55 IST. Online payment runs on Razorpay TEST keys, open to every signed-in visitor (`PAYMENTS_TEST_FOR_EVERYONE=true`, no tester list). Razorpay's notices (webhook) go to the OLD server, not this one. This server checks unconfirmed payments with Razorpay every minute. The old server still runs on the same database.

## Summary

| Finding | One-line title | Original group | Verdict | Right group |
|---|---|---|---|---|
| M1 | Test payments act like real sales (stock, To ship, sales, invoices, alerts) | Must | ✅ Correct | Must |
| M2 | A customer can pay twice when a UPI payment finishes while the page isn't watching | Must | ⚠️ Partly correct | Must (before live keys) |
| S1 | Without Razorpay's notices, a refund never shows as done | Should | ⚠️ Partly correct | Should |
| S2 | An unapproved UPI request is shown as "Payment received, confirming" | Should | ✅ Correct | Should |
| S3 | "Nothing was charged" said too early; such an order can vanish from My orders | Should | ⚠️ Partly correct | Should |
| S4 | A refund that went through but whose answer was missed: retried for ever, "Refund stuck" | Should | ⚠️ Partly correct | Small |
| S5 | Razorpay's notice answered only after invoice PDF, upload and customer push | Should | ✅ Correct | Should |
| S6 | The old server on the same database works against the new one | Should | ✅ Correct | Should (Must if live keys go in before the webhook move) |
| S7 | Switching from test to live keys leaves traps | Should | ✅ Correct | Should |
| 1 | "Paid twice" refund message says "We couldn't keep order" | Small | ✅ Correct | Small |
| 2 | Refund of a second payment on a paid request not saved; repeat gives false "Refund stuck" | Small | ✅ Correct | Small |
| 3 | Page and job start the same refund; error left on a refunded try | Small | ✅ Correct | Small |
| 4 | Refused refunds retried every 6 hours with no end | Small | ✅ Correct | Small |
| 5 | Pay again between minute 29 and 30 refused as "released"; order page shows nothing | Small | ✅ Correct | Small |
| 6 | "Nothing was charged" twice when Razorpay can't be reached | Small | ✅ Correct | Small |
| 7 | Owners' alert and "Order confirmed" lost on a restart at that moment | Small | ✅ Correct | Small |
| 8 | Late-refund screen always blames "our store" | Small | ✅ Correct | Small |
| 9 | Checkout says "The 15 minutes are over" for any ended checkout | Small | ✅ Correct | Small |
| 10 | Invoice catch-up: 20 a minute, no order, 30 days; a few failures block others | Small | ⚠️ Partly correct | Small |
| 11 | Customer waits for the invoice PDF and upload before "Order confirmed" | Small | ✅ Correct | Small |
| 12 | A late payment cancels the customer's newer open checkout | Small | ✅ Correct | Small |
| 13 | Schema comment lacks `refund_due` | Small | ✅ Correct | Small |

**Counts: ✅ 17 · ⚠️ 5 · ❌ 0** (22 findings).

The "For the developer" section adds no new problems; its extra details were checked too (see the end).

## Timing, in one place (what is code, what is Razorpay)

**Code:**
- Jobs: holds end every 30 s (`B/config/constants.js:127`), payment checks every 60 s (`constants.js:128`; `B/jobs/payments.job.js:16-17`). A run still going is skipped (`payments.job.js:10`).
- A try not known to be paid (`created` or `failed`): looked at only once the request is at least 3 minutes old, then again once the last look is at least 5 minutes old, up to 2 hours (`B/models/checkout.model.js:73-77`). With the 1-minute job: first look **3–4 min after Pay**, then **every 5 min**. So for a payment the page didn't report, this server is at most about **5–6 minutes behind** the payment (more only if over 50 tries wait, `checkout.model.js:83`). It is not "3 to 8 minutes after the payment".
- A "confirming" try: every minute, for 3 days (`checkout.model.js:69`, `B/services/shop/checkout.service.js:712-713`, `constants.js:126`).
- Refund retries: 1, 5, 15, 60 minutes, then every 360 minutes, no end (`checkout.service.js:600`, `:610`). Owners told after the 3rd refusal (`:601`, `:611`).
- Every call to Razorpay gives up after 10 s (`B/services/payments/razorpay.provider.js:8`, `:26`).

**Razorpay's own behaviour (not in our code):**
- Automatic capture of a payment the bank approves within 15 minutes; a later one is returned by Razorpay. The code only asks for this (`constants.js:125`, sent at `razorpay.provider.js:43`).
- "5 to 7 working days" for a refund: Razorpay's normal refund speed. The code asks for `speed: 'normal'` (`razorpay.provider.js:48`) and refund_speed normal (`:43`).
- Whether a refund's first answer says `processed` or `pending`, how long a half-started UPI payment stays `created`, the webhook's answer time (5 s in the plan, `docs/modules/web-04-checkout.md:99`) and when Razorpay turns a failing webhook off.

---

## Must fix

### M1. Test payments act like real sales: ✅ Correct (Must)
**Why:** `complete()` never looks at test or live mode. In Razorpay's test mode the test card gives a "captured" payment, so the order is filled exactly like a real one. Nothing downstream filters test orders out.
**Evidence:**
- Captured → `complete()`: `B/services/shop/checkout.service.js:427`. Holds converted and pieces → `sold_online`: `:479-487`. Order → `processing`: `:504-507`. Shipment made: `:514-515`. Bag cleared: `:519`. No mode check in `complete()`; `env.payments.mode` is only used at `checkout.service.js:246` (sent to the page) and `B/services/invoice.service.js:39` (invoice number).
- Off the website: a saree is listed only with `stock > 0` or an `in_stock` piece (`B/services/shop/visibility.js:17`).
- Counter refuses it: `B/services/sale.service.js:68` ("ALREADY_SOLD … online"). The report cites `:73`; `:68` is the line that fires for a `sold_online` saree. Same meaning.
- To ship: `B/models/order.model.js:10`. Sales: `B/models/stats.model.js:7-8`. Invoice totals and GST summary: `B/models/invoice.model.js:52-58`, `:63-68`, with no `TEST-` filter (searching the server for `TEST-` finds it only in `sale.model.js`, `invoice.service.js` and `invoicePdf.service.js`).
- Messages: "Order confirmed … We pack it within 2 working days" `checkout.service.js:567-570`; "New online order · ₹X" `B/services/ownerAlerts.service.js:19-24`.
- The promise: `W/payments/TestPayNote.jsx:16` "Test orders are not shipped."
- Month rule: `B/services/order.service.js:142` (`NOT_THIS_MONTH`).
- Allowed by: `B/config/env.js:105`, `:158`; `B/services/shop/paymentAccess.js` lets everyone pay when the tester list is empty.
- Small nuance: the admin order detail does show the invoice number (`order.service.js:170`), so a `TEST-` number is one indirect sign. The To ship rows don't show it (`order.model.js:20-23`), so the report's point stands.

### M2. Paying twice when UPI finishes while the page isn't watching: ⚠️ Partly correct (Must, before live keys)
**What is right:**
- The order read never asks Razorpay: `getOrder` reads only the database (`checkout.service.js:385-391`). The checkout page's 8-second re-check calls that same read (`W/pages/checkout/CheckoutPage.jsx:151-154`, `:168-180`).
- After the window closes, the checkout page shows the hold line and an active Pay (`CheckoutPage.jsx:412`, `:420`; reload path `:137-144`). The order page says "Nothing was charged yet" with Pay (`W/pages/orders/OrderPage.jsx:103-108`).
- Pay again makes a new payment request on the same order. `payAgain` never looks at the tries (`checkout.service.js:349-359`). `checkout()` reuses the open order or cancels it (`:288-297`) and `openPayment` makes a new request (`:209-238`).
- When the first payment is found later, it is refunded as "Paid twice" (`checkout.service.js:472`, then `markRefund`/`refundNow`).
- Even with a try already "confirming", the checkout says "You don't need to pay for it again" (`CheckoutPage.jsx:55`), while Pay stays on (`:319`, `:420`; the bag still has the sarees, because only `complete()` removes them, `checkout.service.js:519`).

**What is not exact:**
- **Timing.** The code looks first 3–4 minutes after **Pay**, then every 5 minutes (`checkout.model.js:73-77`, job every 60 s). So the server is at most about 5–6 minutes behind the payment, sometimes under a minute. It is not "3 to 8 minutes after the payment".
- **"Real money is taken twice"** is not true today: the live site uses test keys. It becomes true with live keys.
- The 5–7 days are Razorpay's normal refund time (code asks `speed: 'normal'`, `razorpay.provider.js:48`).
- If test-mode notices do reach the old server and it accepts them, the old server marks the order paid within seconds (`OLD/modules/orders/orders.service.ts:210-224`). That shortens this gap, but by the old rules (see S6).

Must is still the right group to fix before live keys: a double charge is money taken wrongly, even though it is returned.

## Should fix

### S1. Without notices, a refund never shows as done: ⚠️ Partly correct (Should)
**What is right:**
- A shop-cancelled order's "refunded" date comes only from stored `refund.processed` notices (`B/models/checkout.model.js:44-51`, used at `checkout.service.js:389`). Those notices go to the old server, which stores none (it only handles `payment.captured`, `OLD/modules/orders/orders.service.ts:211`). So "₹X is being refunded" stays for ever (`OrderPage.jsx:124-129`, `W/orders/status.js:36`).
- A refund that Razorpay accepts and later fails is reported only by a `refund.failed` notice (`checkout.service.js:669-681`). Without notices, nobody is told.

**What is overstated:** "every automatic refund stays 'being refunded' for ever". The code saves `processed` when Razorpay's first answer already says processed (`checkout.service.js:620`: `refundStatus: r.status === 'processed' ? 'processed' : 'pending'`), and the order page then says "was refunded" (`OrderPage.jsx:63`, `:119`; `status.js:33`). Only refunds whose first answer is `pending` stay stuck. Which answer Razorpay gives is Razorpay's behaviour: its documents show `processed` for a normal refund, but this was not checked here. One screen ignores the status: the just-paid "We couldn't keep your order" box always says "is being refunded" (`OrderPage.jsx:330`). The report's "saved as pending" for `:620` is not exact; its own developer section describes it correctly.

### S2. Unapproved UPI shown as "Payment received, confirming": ✅ Correct (Should)
**Why:** `settle()` sends any Razorpay status other than captured, authorized, failed or refunded (that is, `created`, a half-started payment) to "confirming" (`checkout.service.js:454`). The background check passes `payments[0]` when nothing is captured or authorized (`:718`), and looks at a `created` try 3–4 minutes after Pay (`checkout.model.js:73-77`). A "confirming" try makes the order "confirming" (`checkout.service.js:85`). Then the order page shows "Payment received, confirming with your bank" with no Pay (`OrderPage.jsx:39`, `:294-306`), and the checkout says "You don't need to pay for it again" (`CheckoutPage.jsx:55`, reached through `:159`). The hold still ends on time (`checkout.service.js:690-702`). The try stays "confirming" until Razorpay marks the payment failed (`:446-447`), which is Razorpay's timing.

### S3. "Nothing was charged" said too early; order vanishes from My orders: ⚠️ Partly correct (Should)
**What is right:**
- The texts are stated as facts: `OrderPage.jsx:312`, `:342`; `status.js:38`; `CheckoutPage.jsx:65` ("Nothing was taken"), `:68`.
- A cancelled order with a confirming try is shown as plain "cancelled" (`checkout.service.js:90-92`), and My orders lists "confirming" only while `pending_payment` (`checkout.model.js:33`).
- The three ways such an order gets cancelled are real: a newer checkout (`checkout.service.js:295-296`), "Sell anyway" (`B/services/sale.service.js:119-133`), and another payment settling it (`checkout.service.js:520-523`).
- A failed try can still turn into a paid one (Razorpay's late approval). The code itself re-checks failed tries for 2 hours (`checkout.model.js:74`).

**What is not exact:**
- "We only learn of it up to 8 minutes later": the code learns within about 5–6 minutes (see Timing).
- "(It is refunded later)" is not always so. If every saree is still in stock, `complete()` takes them again and the cancelled order goes ahead as paid (`checkout.service.js:489-507`, `cancelledAt: null`).

### S4. Missed refund answer → retried for ever, false "Refund stuck": ⚠️ Partly correct (Small)
**What is right:** A Razorpay call over 10 s is aborted (`razorpay.provider.js:8`, `:26-29`), and a crash after Razorpay accepts loses the answer. Either way the try stays `refund_due` (`checkout.service.js:606-619`). Each retry is then refused. After the 3rd refusal the owners get "Refund stuck" (`:611`, `:617`), and Online payments shows it stuck (`B/services/onlinePayments.service.js:34-35`). It retries every 6 hours with no end (`checkout.service.js:600`, `:610`), and the customer push is only sent on success (`:621-626`). The customer's page still says "being refunded", because `refund_due` counts as refunded (`checkout.service.js:91`).
**What is overstated:** Severity. It needs a Razorpay answer over 10 s, or a restart at that exact moment, so it is rare. The harm is a false alarm, not money: Razorpay does not allow refunding more than was paid, so "owners may refund twice" can't take extra money (this is Razorpay's rule). Small, not Should.

### S5. Notice answered only after invoice, upload and push: ✅ Correct (Should)
**Why:** `B/controllers/payments.controller.js:9-10` answers only after `handleWebhook` returns. `handleWebhook` → `settle` → `complete` → `await afterPaid()` (`checkout.service.js:668`, `:531-533`). `afterPaid` awaits `ensureInvoice` (PDF render plus storage upload inside a transaction, `B/services/invoice.service.js:83-95`) and `notifyCustomer` (database plus web push, `B/services/shop/push.service.js:101-118`). Only the owners' alert is not awaited (`checkout.service.js:573`). The plan says "answered within 5 seconds" (`docs/modules/web-04-checkout.md:99`). Resends and turning the webhook off are Razorpay's rules (it switches a webhook off only after it keeps failing for a long time). Not live today, because the notices go to the old server, so Should is right.

### S6. Old server on the same database: ✅ Correct (Should; Must if live keys go in before the webhook move)
**Why (a):** The old handler finalises any `payment.captured` whose request id matches a `Payment` row (`OLD/modules/orders/orders.service.ts:210-224`). It makes no amount, hold, stock or order-status check (`:180-206`; even a cancelled order becomes `processing`, `:200`). `finalizeReservationsForOrder` only converts holds still active (`OLD/modules/inventory/inventory.service.ts:153-163`). So a payment arriving after "Sell anyway" puts an order with no stock into To ship. Our server writes the newest request id into `Payment` (`checkout.service.js:232-236`), so the old server will find new orders. The plan moves the webhook with nginx at go-live (`web-04-checkout.md:51`, `:225-228`).
**Why (b):** The old sweep reads the hold (`inventory.service.ts:192-193`), then raises `Product.stock` with no condition (`:197`) and marks the hold expired by id (`:199`), every 15 s (`:756-758`; started at `OLD/index.ts:19`). Our release is conditional (`checkout.service.js:68-71`). If ours commits between the old sweep's read and its stock update, the stock goes up twice. In `complete()`'s not-held branch (`checkout.service.js:489-503`), counted stock is taken again even for a hold that is still active, so stock is counted down twice.
**Extra notes:**
- Whether (a) already happens today depends on a test-mode webhook pointing at the old server with a secret it accepts. That is unknown (the report lists it under "could not check").
- If the old server finalises first, our server's `complete()` sees "already paid" (`checkout.service.js:465`) and skips `afterPaid`. So there is no customer "Order confirmed", no owners' alert from this server, no bag clean-up, and the try stays "created".

### S7. Test-to-live switch traps: ✅ Correct (Should)
**Why:** The TEST number is chosen from today's keys (`B/services/invoice.service.js:39`, used at `:90`). The invoice catch-up retries orders up to 30 days old (`checkout.service.js:724-726`, `B/models/checkout.model.js:86-90`). So a test order still without an invoice at the switch gets a real `INV-` number (only orders whose first invoice failed). Test tries left `refund_due` call `refundNow` with live keys (`checkout.service.js:711`), which Razorpay refuses (an unknown id), so they become "Refund stuck" after 3 tries. "Confirming" or recent tries call `orderPayments` (`:717`), which errors every minute (logged at `:721`) until the 3-day cut-off.

## Small

1. **✅ Correct.** `checkout.service.js:622-625`: the body is "We couldn't keep order NH…: paid twice: this order was already paid…", but in the "Paid twice" case the order stays paid (`markRefund` leaves a paid order alone, `:586-591`).
2. **✅ Correct.** `checkout.service.js:536-551`: on success only an audit row and an owners' alert are written; nothing is stored on any try. A repeat (`payment.captured` plus `order.paid`, or a page verify retried after a timeout, `W/pages/checkout/usePayment.js:47-56`) refunds again. Razorpay refuses, and `:546` sets `refundStatus: 'failed'` on the **paid** try. Online payments then shows the whole order as "Refund stuck" (`onlinePayments.service.js:35`, `:40`). Rare: Razorpay normally refuses a second payment on a paid request.
3. **✅ Correct.** `markRefund` commits `refund_due` with `nextRefundAt` null (`checkout.service.js:592`). The job picks such tries (`checkout.model.js:79`) while the page path is inside `refundNow` (`checkout.service.js:602-607`). The loser's catch writes `refundError`/`nextRefundAt` by id with no status check (`:612-615`), so it can leave an error on a `refunded` try. Online payments shows it (`onlinePayments.service.js:110`, `:212`). Shown as an error text, not as "stuck".
4. **✅ Correct.** `checkout.service.js:600`, `:610`: the last wait (360 min) repeats for ever while the try stays `refund_due` (`checkout.model.js:79`).
5. **✅ Correct.** A renewal after minute 15 holds until minute 30 (`checkout.service.js:63`). `payAgain` refuses from minute 29 with "…your sarees were released" (`:356`, message `:42`). The order page only reloads on `HOLD_ENDED` and sets no note (`OrderPage.jsx:259`), so the press does nothing visible. The checkout page isn't affected: it makes a new order instead (`checkout.service.js:293`).
6. **✅ Correct.** Server message "…Nothing was charged. Please try again in a minute." (`checkout.service.js:336`, `:363`), plus the page adds " Nothing was charged." (`CheckoutPage.jsx:63`, via `:285`).
7. **✅ Correct.** Owners' alerts are an in-memory promise chain (`ownerAlerts.service.js:61-65`). The customer's "Order confirmed" is sent after the database step commits (`checkout.service.js:531-533`, `:567`) and is never retried (the job only remakes invoices, `:724-726`). Both are lost if the process stops in between. The customer message isn't "kept in memory", but it is lost the same way.
8. **✅ Correct.** `OrderPage.jsx:320`, `:327`: any reason containing "sold" gives "a saree had sold at our store". `StockGone` is raised for any piece not `in_stock` (sold online, held by another checkout including the customer's own newer one, damaged) or not enough counted stock (`checkout.service.js:494-498`).
9. **✅ Correct.** `CheckoutPage.jsx:159`: any status not in `PAID_LIKE` becomes `{ kind: 'expired' }` → "The 15 minutes are over" (`:48-49`). That includes cancelled by "Sell anyway", by Change my bag in another tab, or replaced.
10. **⚠️ Partly correct (Small).** Right: `take: 20`, no `orderBy`, only orders from the last 30 days (`checkout.model.js:86-90`; `checkout.service.js:724`). Overstated: "a few that always fail can keep others waiting". The others still fit in the same 20 and are done in the same run, so it takes **20 or more** always-failing orders to block the rest. A few failures only make each run slower.
11. **✅ Correct.** `verify` → `settle` → `complete` → `await afterPaid` → `await ensureInvoice` (`checkout.service.js:413`, `:532`, `:562`). The page waits for `verifyPayment` before going to the order page (`usePayment.js:49`, `:59`). The page's limit is 30 s (`W/api/shop.js:31`).
12. **✅ Correct.** `checkout.service.js:518-523` cancels every other open checkout of the customer, whatever it holds. Reachable: an older order cancelled by a newer checkout (`:295-296`) and revived by its late payment cancels that newer one.
13. **✅ Correct.** `Nadam-backend/prisma/schema.prisma:622` lists `created | confirming | paid | failed | refunded`. `refund_due` is used at `checkout.service.js:592` and elsewhere.

## "For the developer": extra points checked
- M1: "Paid online (Razorpay)" in the admin order detail: `B/services/order.service.js:154-155`, `:169`. ✅
- M2: `payAgain` doesn't look at tries: `checkout.service.js:349-359`. ✅
- S1: "`refundNow` sets `refundStatus` from the immediate answer (`:620`)". ✅ Exact (and it is why S1's "every refund" is overstated).
- S6: in `complete()`'s not-held branch, counted stock is decremented even for holds still `active`: `checkout.service.js:496-502`. ✅
- "Checked and fine", spot-checked, all hold:
  - signature compared in constant time with our stored request id (`B/services/payments/signature.js:8-18`; `checkout.service.js:400`);
  - order, amount and currency checked before status (`:420-427`);
  - per-order lock (`checkout.model.js:8`);
  - repeated notices skipped (`checkout.service.js:658-659`);
  - a failed try doesn't override a confirming one (`:446`);
  - stock re-claim is conditional (`:479-501`);
  - fake provider refused in production (`env.js:148-150`; `B/app.js:25`);
  - test keys in production need the flags (`env.js:151-160`);
  - verify has no payments-on check (`checkout.service.js:395-415`);
  - receipt fields match the validator (`W/payments/razorpay.js:66-68`, `B/validators/shop/checkout.validators.js:19-23`).

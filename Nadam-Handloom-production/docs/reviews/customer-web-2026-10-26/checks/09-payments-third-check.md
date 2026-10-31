# Third check: Module 9, Payments (Razorpay)

Date: 26 Oct 2026. Report: [`../09-payments.md`](../09-payments.md). Second check: [`09-payments-check.md`](09-payments-check.md).

What I did: read the code only (the new server, the website, and the old server one folder up). I did not run, test or change any code, did not open `.env`, and did not touch the live server, Razorpay or the database.

Only 6 items were checked again: the 5 findings marked ⚠️ (M2, S1, S3, S4, Small 10) and the second checker's extra notes on S6.

Short paths: `B/` = `Nadam-backend/src/`, `W/` = `Nadam-frontend/customer-web/src/`, `OLD/` = `../backend/src/` (the old server, `Nadam-Handloom/backend`). All start from the project folder `Nadam-Handloom-production/`.

## Summary

| Id | Title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| M2 | Paying twice when a UPI payment finishes while our page isn't watching | Real. Server learns "3 to 8 min later". Real money taken twice. Must | Real, Must before live keys. Server is at most ~5–6 min behind the payment. No real money on test keys | **Second checker right** | **Must fix** (before live keys) |
| S1 | A refund never shows as done without Razorpay's notices | Every automatic refund stays "being refunded" for ever | Only refunds whose first answer is "pending" stay stuck. Hand refunds and later failures: right | **Second checker right** | **Should fix** |
| S3 | "Nothing was charged" said too early; order drops out of My orders | Texts wrong. Server learns "up to 8 min later". A cancelled order "is refunded later" | Texts right. ~5–6 min. A cancelled order can come back as paid instead | **Second checker right** | **Should fix** |
| S4 | Refund answer missed → retried for ever, false "Refund stuck" | Should | Mechanism right. Rare, false alarm only → Small | **Second checker right** | **Small** |
| Small 10 | Invoice catch-up: 20 a minute, no order, 30 days | "A few" failing orders can keep others waiting | It takes 20 or more always-failing orders | **Second checker right** | **Small** |
| S6 (extra notes) | The old server's notice handler on the same database | (S6 a: old rules, works against the new server) | Marks any captured payment paid, even a cancelled order. If first, our server skips "Order confirmed", owners' alert, bag clean-up. Today depends on a test-mode webhook | **Real only if** a test-mode webhook points at the old address with the same secret text. Certain once live keys go in before the webhook move | **Should fix** (must be done before live keys) |

**Counts:** Second checker right 5 · First reviewer right 0 · Both partly right 0 · Neither right 0 · Extra notes: Real only if … 1.

Group changes: only S4 (Should → Small), as the second checker said.

---

## Timing, in one place

**What is in our code:**
- The payment check runs every 60 seconds (`B/config/constants.js:128`, `B/jobs/payments.job.js:17`). If the last run is still going, the next one is skipped (`payments.job.js:10`).
- A payment try that is "created" or "failed" is looked at once it is 3 minutes old, then again only when the last look is 5 or more minutes old, until it is 2 hours old (`B/models/checkout.model.js:73-77`). With a 1-minute job, the looks are at about **3–4, 8–9, 13–14 … minutes after Pay**.
- A "confirming" try is looked at **every minute** for 3 days (`checkout.model.js:69`; `B/services/shop/checkout.service.js:712-713`).
- At most 50 tries per run (`checkout.model.js:82-83`).
- Each Razorpay call gives up after 10 seconds (`B/services/payments/razorpay.provider.js:8`, `:26`).
- So a payment the page didn't report is found at the next look: **0 to about 5 minutes after the payment** (about 6 if a run is skipped). From Pay, the first two looks are at about 3 and 8 minutes. That is probably where "3 to 8" came from, but it is not the delay after the payment.

**What is Razorpay's own behaviour (not in our code):**
- Whether a refund's first answer says "processed" or "pending". Razorpay's documents show "processed" for a normal refund. Not tried here.
- A UPI payment first marked failed can be approved late by the bank. How long a half-started UPI payment stays "created".
- Test mode and live mode have their own webhooks in the dashboard, each with its own address, events and secret.
- A refund can never be more than the amount paid.

---

## M2. Paying twice

**What really happens:**
1. The customer pays in a UPI app, but our page never gets Razorpay's "paid" message (the phone closed the tab, or the customer closed Razorpay's window before approving).
2. Our page asks our server about the order every 8 seconds. The server only reads its own database. It does not ask Razorpay (`checkout.service.js:385-391`; `W/pages/checkout/CheckoutPage.jsx:151-154`, `:166-180`).
3. Until the next background look, the checkout shows the hold and an active Pay (`CheckoutPage.jsx:137-144`, `:319`, `:420`). The order page says "Nothing was charged yet" with Pay (`W/pages/orders/OrderPage.jsx:103-108`).
4. Pay again makes a new payment request and never looks at earlier tries (`checkout.service.js:344-359`). A new Pay on the checkout reuses the open order or cancels it, then opens a new request (`:289-297`, `:328`).
5. Even when the try is already "confirming", the checkout says "You don't need to pay for it again" but Pay stays on. The bag still has the sarees, because only a completed payment clears them (`CheckoutPage.jsx:55`, `:159`, `:319`; `checkout.service.js:519`).
6. When both payments are found, the one found second is refunded: as "Paid twice" if the same order was reused (`checkout.service.js:472`), or as "Paid after the sarees were sold" if a new order was made (`:489-499`, `:526-528`).

**Why the first reviewer was partly off:** the path and the group are right. "3 to 8 minutes later" matches the first two looks after Pay, not the delay after the payment (0 to about 5 minutes). "Real money is taken twice" is only true with live keys. Today, test keys move no real money.

**Is the second checker right?** Yes, on all three points. One small addition: once a try is "confirming" (for example Razorpay showed a half-started payment, see S2), it is looked at every minute, so the delay is then about 1 minute.

**Final:** until the server's next look at Razorpay (3–4 min after Pay, then every 5 min), the website still offers Pay for an order already paid in a UPI app, and the server opens new payments even while one is "confirming". A customer can pay twice; one payment is refunded later. **Must fix** before live keys.

---

## S1. A refund never shows as done

**What really happens:**
- **Automatic refund:** our server asks Razorpay to refund. It saves "processed" if Razorpay's first answer says processed, otherwise "pending" (`checkout.service.js:620`). Only a Razorpay notice can move "pending" on (`:669-681`). Notices go to the old server. It only handles `payment.captured` (`OLD/modules/orders/orders.service.ts:211`) and has no PaymentEvent table. Only our server writes PaymentEvent (`checkout.service.js:683`).
  - First answer "processed": the customer's page says "was refunded" (`OrderPage.jsx:63`, `:119`; `W/orders/status.js:33`).
  - First answer "pending": "is being refunded" for ever.
  - In the admin app the list already says "Refunded" either way (`B/services/onlinePayments.service.js:23`, `:44`). Only the detail's refund state stays "started" (`:108`, `:211`).
- **Shop-cancelled order, refunded by hand:** "refunded on …" comes only from a stored `refund.processed` notice (`B/models/checkout.model.js:44-51`, used at `checkout.service.js:389` and `B/services/shop/orders.service.js:52`). None are stored today, so it says "₹X is being refunded" for ever (`OrderPage.jsx:124-129`, `status.js:36`). **This part is certain.**
- **A refund Razorpay accepted that fails later:** only a `refund.failed` notice reports it (`checkout.service.js:669-681`). Today nobody is told.

**Why the first reviewer was partly off:** "every automatic refund" ignores the "processed" branch at `:620`. And the admin list already says "Refunded".

**Is the second checker right?** Yes. Which first answer Razorpay gives is Razorpay's behaviour, not our code.

**Final:** while notices go to the old server, a shop-cancelled order's hand refund never shows as done, a refund first answered "pending" stays "being refunded" for ever, and a later refund failure is never reported. **Should fix.**

---

## S3. "Nothing was charged" said too early

**What really happens:**
- These texts state it as a fact: hold ended (`OrderPage.jsx:312`), cancelled (`:342`), the My orders line (`status.js:38`), a failed try (`CheckoutPage.jsx:65`, `OrderPage.jsx:110`), window closed with no hold left (`CheckoutPage.jsx:68`).
- A payment can still be on its way at that moment: a UPI payment approved in the last minute, or a "failed" one the bank approves late (Razorpay's behaviour; our code expects it and re-checks failed tries for 2 hours, `checkout.model.js:74`). Our server finds it 0 to about 5 minutes after it is made.
- A checkout cancelled while a try is "confirming" shows as plain "cancelled" (`checkout.service.js:90-92`) and is left out of My orders (`checkout.model.js:33`; a hold-ended order is left out too, `:34`). It gets cancelled by a newer checkout (`checkout.service.js:295-296`), "Sell anyway" at the counter (`B/services/sale.service.js:119-133`), or another order's payment (`checkout.service.js:520-523`).
- When that payment is found: if every saree is still in stock, the order is taken again and goes ahead as paid (`checkout.service.js:489-507`, `cancelledAt: null` at `:506`). Otherwise the whole amount is refunded (`:526-528`, `:552-556`).
  - "Sell anyway": the saree is sold, so refunded.
  - A newer checkout with the same sarees: they are held by the new order, so refunded.
  - Another order's payment: its sarees went back in stock (`:521`), so usually it comes back as paid.

**Why the first reviewer was partly off:** "up to 8 minutes" is too long (about 5). "It is refunded later" is not always true.

**Is the second checker right?** Yes, on both points.

**Final:** "Nothing was charged/taken" is shown as a fact while a payment may still turn up (up to about 5 minutes later), and a checkout cancelled while a payment is confirming drops out of My orders. That payment then brings the order back if every saree is in stock, or is refunded. **Should fix.**

---

## S4. A missed refund answer gives a false "Refund stuck"

**What really happens:** our server asks Razorpay to refund (`checkout.service.js:607`). If Razorpay takes over 10 seconds, the call is cut (`razorpay.provider.js:8`, `:26-29`). If the server stops between Razorpay's yes and our save (`checkout.service.js:620`), the answer is lost too. Either way the try stays "refund due". The next tries are refused by Razorpay (already refunded). After the 3rd refusal: one "Refund stuck" alert (`:611`, `:617`), and Online payments shows "Refund stuck" (`onlinePayments.service.js:34-35`, `:40`). It is retried every 6 hours for ever (`checkout.service.js:600`, `:610`; `checkout.model.js:79`). The customer's "being refunded" push is never sent (`checkout.service.js:621-626`), but their page still says "being refunded" (`:91`, `:129`).

**Why the first reviewer was partly off:** the group. It needs a Razorpay answer over 10 seconds or a stop in that split second, so it is rare. No money can go out twice: Razorpay never refunds more than was paid (Razorpay's rule). So it is a rare false alarm.

**Is the second checker right?** Yes.

**Final:** a refund Razorpay accepted, but whose answer we lost, is retried for ever and gives the owners a false "Refund stuck". Rare; no money lost. **Small.**

---

## Small 10. Invoice catch-up

**What really happens:** every minute, after the payment checks, up to 20 paid online orders from the last 30 days without an invoice are tried one after another (`checkout.model.js:86-90`, no `orderBy`; `checkout.service.js:724-726`). A failure is logged and the loop goes on. With fewer than 20 always-failing orders, the others still fit in the same 20 and are done in that run. Only 20 or more always-failing orders that keep coming first can keep the rest waiting. Orders older than 30 days are never tried again.

**Why the first reviewer was partly off:** "a few" failing orders can't block the others.

**Is the second checker right?** Yes. Their "a few failures only make each run slower" also holds. The same run does the payment checks, and a run still going makes the next one skip (`payments.job.js:10`), so a very slow invoice run also delays payment checks a little.

**Final:** the catch-up takes up to 20 orders a minute in no set order and stops after 30 days. Only 20 or more always-failing orders can starve the rest. **Small.**

---

## S6. The second checker's extra notes (old server on the same database)

### Note 1: the old notice handler marks any captured payment paid by the old rules

**The code does this. True.**
- `OLD/modules/webhooks/webhooks.controller.ts:8-21` → `OLD/modules/orders/orders.service.ts:210-225`. Only `payment.captured`. It finds the `Payment` row by Razorpay's request id (`:218`). `finalizeCapturedPayment` (`:180-207`) only checks "not already paid" (`:187`, `:190-198`). Then the order becomes "processing" whatever it was, cancelled too (`:200`). No amount, currency, hold or stock check.
- Holds: only holds still active are turned into a sale (`OLD/modules/inventory/inventory.service.ts:153-164`). A cancelled or hold-ended order goes to To ship with no saree taken.
- It finds our new orders, because our server writes the newest request id into `Payment` (`checkout.service.js:232-236`).
- The old database model is a smaller copy of the new one (Payment, Order, Reservation, Shipment, Invoice only gained columns), so its queries still work on the shared database.
- Its own follow-up then runs every 5 seconds: the old invoice code and an Expo push to the **old** app's phones (`OLD/modules/events/events.service.ts:22-31`, `:58`; `OLD/modules/notifications/notifications.service.ts:36`). The old invoice code has no TEST- rule (`OLD/utils/invoiceNumber.ts:13-24`). Also, once TEST- invoices exist, its "highest number + 1" reads a `TEST-…` number first and builds `INV-000NaN` (`invoiceNumber.ts:18-24`).

**Can a TEST-mode notice even get through?**
- The old server checks the stamp with its own `RAZORPAY_WEBHOOK_SECRET` on the exact bytes (`OLD/providers/payment/razorpay.provider.ts:47-55`; `OLD/config/env.ts:49-52`). This path never calls Razorpay, so the keys don't matter; only the webhook secret does.
- In Razorpay's dashboard, test mode and live mode each have their own webhooks, each with its own secret (Razorpay's behaviour). The plan only records the live one: old address, `payment.captured` only (`docs/modules/web-04-checkout.md:51`).
- So today it happens **only if** someone made a test-mode webhook pointing at the old address, with `payment.captured` on, and with the **same secret text** as the old server's live one. That is unknown (the report lists it under "could not check"). With a different secret, the old server answers 401 and changes nothing.
- **On the day live keys go in**, the live webhook already points at the old server with the matching secret, so it becomes certain, unless the nginx move is done first (`web-04-checkout.md:225`) or the old server is switched off (6.14 A, `:79`).

### Note 2: if the old server marks the order paid first

**True, if Note 1 happens.**
- The old server saves the payment id (`orders.service.ts:194`). Our `complete()` then sees the same payment already paid and stops (`checkout.service.js:465`).
- Skipped: the customer's "Order confirmed" (`:567-570`), our owners' alert to the new app (`:573`), clearing the bag and ending other open checkouts (`:518-523`), and marking our try "paid" (`:513`).
- Not lost: the customer's page shows "paid" (`:83`). The invoice is still made, by the old server or by our catch-up (`:724-726`).
- Our try stays "created" and is looked at every 5 minutes for 2 hours with no effect. If it was "confirming", it is looked at every minute for 3 days and then marked "failed" (`checkout.model.js:69`, `:73-77`; `checkout.service.js:712-713`).
- **Extra, rare, seen while checking:** the old server doesn't take our order lock (`checkout.model.js:8`). If both servers handle the same payment in the same split second, and the old one saves after our order read but before our hold claim, our claim finds the hold "converted" and the saree "sold_online" (`inventory.service.ts:157-159`). Our server then decides the sarees are gone (`checkout.service.js:479-482`) and **refunds the payment** (`:526-528`, `:552-556`). The order stays paid and in To ship, because `markRefund` leaves an order the old server marked paid alone (`:586-592`).

**Final:** **Real only if** Razorpay's test-mode dashboard has a webhook to the old address with the same secret text (unknown). It is certain from the day live keys go in, unless the webhook is moved first or the old server is switched off. Then the old server marks captured payments paid by its old rules, and when it gets there first our server skips "Order confirmed", the new app's owners' alert and the bag clean-up. **Should fix**, and it must be done before live keys.

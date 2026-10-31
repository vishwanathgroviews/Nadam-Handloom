# Second check: Module 10, Orders

| | |
|---|---|
| **Report checked** | [`../10-orders.md`](../10-orders.md) |
| **Date** | 26 Oct 2026 |
| **How** | Read the code only (server, website, admin app, and the old server one folder up). Nothing was run, built, tested or changed. No live server or database was touched. |
| **Live facts used** | Everything in this code is live since 26 Oct ~13:55 IST. Razorpay is on TEST keys. **Razorpay's notices (webhook) go to the OLD server**, so refund notices never reach this server. Invoices are in S3. The old server runs on the same database. |

Paths below are short: `backend/` = `Nadam-backend/`, `web/` = `Nadam-frontend/customer-web/`, `admin/` = `Nadam-frontend/admin-app/`, `old/` = `../backend/` (the old server, one folder above the project).

## Summary

| Id | Finding (one line) | Report's group | Verdict | Right group |
|---|---|---|---|---|
| S1 | Paid order can't be cancelled after its month; stays "Being packed" after a hand refund | Should | ✅ | Should (close to Must) |
| S2 | Cancelled order says the full total was refunded, even if less was refunded | Should | ⚠️ | Should (can't happen on live today) |
| S3 | Stuck automatic refund done by hand shows "being refunded" for ever, retried for ever | Should | ✅ | Should |
| S4 | No notification when the shop cancels a paid order | Should | ✅ | Should |
| S5 | "Thank you" page comes back on a reloaded tab, hiding tracking card and Buy again | Should | ⚠️ | Small |
| s1 | Invoice "being made" for ever if cancelled before it was made | Small | ✅ | Small |
| s2 | Corrected tracking number sends no new notification | Small | ✅ | Small |
| s3 | "Shipped by DTDC" hard-coded on the Thank-you steps | Small | ✅ | Small |
| s4 | Old-website orders read "by Online (Razorpay)"; paid time is last-change time | Small | ✅ | Small |
| s5 | GST line uses today's settings, not the invoice's | Small | ✅ | Small |
| s6 | Refunded second payment mentioned only on the Thank-you page | Small | ✅ | Small |
| s7 | Card hides Invoice for a cancelled-by-shop order; page shows it | Small | ✅ | Small |
| s8 | "Too many requests from this network" on per-customer limits | Small | ✅ | Small |
| s9 | Offline text "What you typed is kept." on orders pages | Small | ✅ | Small |
| s10 | "We pack within 2 working days" never changes | Small | ✅ | Small |
| s11 | Unknown-status fallback says "Nothing was charged" | Small | ✅ | Small |
| s12 | Show more can skip or repeat one order | Small | ✅ | Small |
| s13 | Shipped/delivered notices queued in memory, never retried | Small | ✅ | Small |
| s14 | Waiting card doesn't change when its hold ends | Small | ✅ | Small |
| s15 | "Delivered" can't be undone; a wrong tap notifies the customer | Small | ⚠️ | Small |
| s16 | Invoice download in in-app browsers (not sure) | Small | ✅ | Small |
| s17 | Lower-case order number says "not found" | Small | ✅ | Small |

**Counts: ✅ 19 · ⚠️ 3 · ❌ 0.** The "For the developer" table (section 8) has no extra findings: its rows are the same S1 to S5 and s1 to s17, and the verdicts above apply to them.

---

## Should fix

### S1. Can't cancel after the order's month; stays "Being packed" after a hand refund
**Verdict: ✅ Correct.** Right group: Should (close to Must).

Why: the admin app's cancel is blocked for any order not placed in this calendar month (India time). A paid website order that is still `processing` is always shown to the customer as "paid" (Being packed), whatever happened in Razorpay. The hand-refund lookup is only done for orders that are already `cancelled`. The old server has no cancel route either, so there is no other way to cancel.

Evidence:
- `backend/src/services/order.service.js:142`: `if (!istSameMonth(order.placedAt)) return 'NOT_THIS_MONTH';` and `:277` throws it. `backend/src/utils/day.js:21`: same year-month in India time.
- `backend/src/services/shop/checkout.service.js:83`: `processing` + paid → `'paid'`, before any refund check.
- `backend/src/services/shop/checkout.service.js:389`: `handRefunds` only when `customerStatus === 'cancelled_paid'`.
- `old/src/modules/orders/orders.routes.ts:12-17` (checkout, verify, list, view, tracking, invoice) and `old/src/modules/admin/admin.routes.ts:20-27` (list, view, shipment): no cancel anywhere on the old server.

Notes:
- Also wrong in this case: the sarees stay `sold_online` (they only go back on sale through the cancel, `order.service.js:284-293`) and the order stays in To ship, so a refunded order could be shipped. That is why it is close to Must.
- Today Razorpay's notices go to the old server, so the second fix in section 8 ("show refunded when a `refund.processed` exists") would not work until the webhook is moved to this server. The first fix (let owners cancel online orders in a later month) works today.

### S2. Cancelled order says the full total was refunded
**Verdict: ⚠️ Partly correct.** Right group: Should (but it can't happen on live today).

What is right: the server keeps only "a refund went through on this payment" and when, never the amount, and takes the first one even if it came before the cancel. The website then prints the order total.
- `backend/prisma/schema.prisma:647-656`: `PaymentEvent` has no amount.
- `backend/src/models/checkout.model.js:44-51`: selects only `razorpayPaymentId, receivedAt`, no time filter against `cancelledAt`.
- `backend/src/services/shop/checkout.service.js:683`: the stored row has no amount.
- `web/src/orders/status.js:36` and `web/src/pages/orders/OrderPage.jsx:126-128`: `rs(o.total)` / `rs(order.total)`.

What is wrong: on live today the wrong amount is never shown. `PaymentEvent` rows are written only by this server's webhook handler (`checkout.service.js:683`), and Razorpay's notices go to the old server. The old server ignores everything except `payment.captured` (`old/src/modules/orders/orders.service.ts:211`) and writes no `PaymentEvent`. So `handRefunds` always finds nothing, `refundedAt` stays empty, and the page always says "**₹X is being refunded**", even long after the owner refunded. The live problem today is the opposite one: "being refunded" for ever. The wrong-amount text becomes real once the webhook is moved to this server.

### S3. Stuck automatic refund done by hand shows "being refunded" for ever
**Verdict: ✅ Correct.** Right group: Should.

Why: a refund notice is matched only by the refund id our server started. A refund the owners make by hand has a different id. The "by hand" check only looks for a **paid** `Payment` with that payment id, and an automatic refund's payment was never marked paid. So the attempt stays `refund_due` (or `refundStatus: failed`). A `refund_due` attempt is retried for ever: 1, 5, 15, 60 minutes, then every 6 hours. Razorpay refuses each try, so no money moves twice. The admin "Online payments" page shows it as "Refund stuck".

Evidence:
- `backend/src/services/shop/checkout.service.js:671`: `updateMany({ where: { razorpayPaymentId, refundId: refund.id } })`; `:674`: `payment.findFirst({ ..., status: 'paid' })`.
- `checkout.service.js:600`, `:609-615`: waits `[1, 5, 15, 60, 360]`, status stays `refund_due`. `backend/src/models/checkout.model.js:79` picks it up again each time.
- `backend/src/services/onlinePayments.service.js:35`: `isStuck` = `refund_due` with 3 or more tries, or `refundStatus === 'failed'`.
- `web/src/orders/status.js:33`: anything but `processed` → "is being refunded (5 to 7 working days)".

Notes: the endless retries apply only to the "refused at the start" case (`refund_due`). The "Razorpay later said failed" case (`status: refunded`, `refundStatus: failed`) is not retried; it just shows "being refunded" for ever. Section 8 says this correctly. On live today the "later said failed" case can't happen (refund notices go to the old server). The refused case can.

### S4. No notification when the shop cancels a paid order
**Verdict: ✅ Correct.** Right group: Should.

Why: ship and deliver call `tellCustomer`. Cancel does not, and there is no cancel message to send.
- `backend/src/services/order.service.js:231` (ship) and `:265` (deliver) call `tellCustomer`. `:271-305` (cancel) only writes the audit and stamps the invoice.
- `backend/src/services/shop/orderNotices.service.js:9-22`: `noticeFor` has only `shipped` and `delivered`.

### S5. "Thank you" page comes back when a tab reloads
**Verdict: ⚠️ Partly correct.** Right group: Small (not Should).

What is right: after paying, the website opens the order page with `state: { paid: true }`. React Router keeps that state in the browser's history entry, so a reload (or Back/Forward to that entry) brings it back, and nothing clears it. With `paid` set, a paid, shipped or delivered order shows the "Thank you" view. That view has no tracking card (Copy, Track on DTDC), no progress card and no Buy again button. The design note says a later visit should show the order's own page (`docs/modules/web-04-checkout.md:256`).
- `web/src/pages/checkout/usePayment.js:59`: `navigate(..., { replace: true, state: { paid: true } })`.
- `web/src/pages/orders/OrderPage.jsx:176`: `paidHere = !!nav?.paid`. `:40`: `JUST_PAID_ENDING` includes `shipped` and `delivered`. `:210`: `ending`. `:278-293`: the hero, with no `Tracking` and no Buy again.

What is overstated: the customer still sees the right state and the tracking number. The eyebrow above "Thank you" reads "Order shipped" or "Order delivered" (`OrderPage.jsx:35`, `:282`). The steps mark Shipped and Delivered as done and show "Tracking <number>" (`OrderPage.jsx:48-49`). A "My orders" button is right there (`:289`). Nothing is wrong about money or the order, and the customer is not stuck. This is polish, so **Small**.

---

## Small

### s1. Invoice "being made" for ever after a cancel
**Verdict: ✅ Correct.** The background job that makes missing invoices skips cancelled orders. Cancel doesn't make one either (it only updates an existing invoice). The page shows "being made… a few minutes" whenever `invoice.ready` is false.
- `backend/src/models/checkout.model.js:87`: `status: { in: ['processing', 'shipped', 'delivered'] }`.
- `backend/src/services/order.service.js:294`, `:300`: only `if (order.invoice)`.
- `web/src/pages/orders/OrderPage.jsx:71`. `ensureInvoice` already stamps a cancelled order (`backend/src/services/invoice.service.js:91-92`), so the suggested fix is safe.

### s2. Corrected tracking number sends no new notification
**Verdict: ✅ Correct.** `changeTracking` saves and audits only, with no `tellCustomer` (`backend/src/services/order.service.js:236-250`).

### s3. "Shipped by DTDC" hard-coded
**Verdict: ✅ Correct.** `web/src/pages/orders/OrderPage.jsx:48`: `'Shipped by DTDC'`. Note: this step list is only on the "Thank you" view, which normally shows before shipping. Another courier's name only goes wrong there in the S5 case.

### s4. Old-website orders: "by Online (Razorpay)", paid time = last change
**Verdict: ✅ Correct.** The old server never saves the method or the capture time; it only sets `status: 'paid'` and the payment id (`old/src/modules/orders/orders.service.ts:190-197`). This server falls back to `'Online'` and `updatedAt` (`backend/src/services/shop/checkout.service.js:128`). The page prints "Paid ₹X by Online (Razorpay)" (`web/src/pages/orders/OrderPage.jsx:68`). Note: `updatedAt` is normally the moment the old site marked it paid, so the time shown is usually close. The odd wording is the main point.

### s5. GST line uses today's settings
**Verdict: ✅ Correct.** `web/src/pages/orders/OrderPage.jsx:84` calls `gstText(order.total, order.address?.state, gst)` with `config.gst` (today's rate and IGST switch, `web/src/pages/checkout/format.js:12-19`). The invoice keeps its own `gstRatePercent` and `igstAmount` (`backend/src/services/invoice.service.js:103-107`).

### s6. Refunded second payment only on the "Thank you" page
**Verdict: ✅ Correct.** The server sends `refund` for a paid order with a refunded second payment (`checkout.service.js:111`, `:129`). The status stays `paid` (`:83`). Only the hero shows it (`web/src/pages/orders/OrderPage.jsx:286`). `PaymentPart` (`:61-74`), the card and `nextLine` say nothing about it.

### s7. Card hides Invoice for a cancelled-by-shop order
**Verdict: ✅ Correct.** Card: `o.invoice?.ready && KEPT.has(o.status)`, and `KEPT` has only paid, shipped and delivered (`web/src/orders/parts.jsx:59`, `web/src/orders/status.js:10`). Page: `order.invoice?.ready` alone (`web/src/pages/orders/OrderPage.jsx:151`).

### s8. "Too many requests from this network" on per-customer limits
**Verdict: ✅ Correct.** One message for both kinds (`backend/src/middlewares/rateLimit.js:26`). All the order routes count per account (`by: (req) => req.customer?.accountId`, `backend/src/routes/shop/index.js:80`, `:93`, `:96`).

### s9. "What you typed is kept." on orders pages
**Verdict: ✅ Correct.** `web/src/api/errors.js:35`. The API client uses it whenever the browser is offline (`web/src/api/client.js:48`, `:66`), and My orders and the order page show `error.message` as it is (`web/src/pages/orders/MyOrdersPage.jsx:26`, `OrderPage.jsx:241`).

### s10. "We pack within 2 working days" never changes
**Verdict: ✅ Correct.** `web/src/orders/status.js:28` has no age check. The progress step "Within 2 working days" is the same (`:58`).

### s11. Unknown-status fallback says "Nothing was charged"
**Verdict: ✅ Correct, and safe today.** `web/src/orders/status.js:38`. The server only lists statuses in `SHOWN` (`backend/src/services/shop/orders.service.js:22`, `:55`), and each of those has its own branch.

### s12. Show more can skip or repeat one order
**Verdict: ✅ Correct.** Pages are counted by position (`skip: offset`, `backend/src/models/checkout.model.js:39-40`; `orders.service.js:49`, `:57`). The website removes duplicates only against the first page (`web/src/orders/useMyOrders.js:24`). Notes on when it happens: a new order alone is mostly hidden by that check. It goes wrong when (a) a held checkout drops out of the list (its 15 minutes end), so everything moves up one and the next page skips one; (b) the cached first page is fetched again (after a minute, when the tab comes back) after Show more; (c) from page 3 on. Only customers with more than 20 orders.

### s13. Notices queued in memory, never retried
**Verdict: ✅ Correct.** `tellCustomer` chains a promise in memory (`backend/src/services/shop/orderNotices.service.js:24-31`). The `Notification` row is only written when the queue reaches it (`backend/src/services/shop/push.service.js:104`). A failed send is saved as `failed` with no retry, and the only jobs are payments and cleanup (`backend/src/jobs/`).

### s14. Waiting card doesn't change when its hold ends
**Verdict: ✅ Correct.** `web/src/pages/orders/MyOrdersPage.jsx` has no timer. The cache refreshes only on opening or when the tab comes back after a minute (`web/src/data/resource.js:21`, `web/src/components/OrderNotice.jsx:21-26`). The order page does have one (`OrderPage.jsx:223-227`). Pay now then lands on "The 15 minutes are over" (`OrderPage.jsx:307-318`).

### s15. "Delivered" can't be undone
**Verdict: ⚠️ Partly correct.** Right group: Small.

Right: there is no undo route (`backend/src/routes/order.routes.js:23` is the only delivered route). `markDelivered` notifies the customer once (`backend/src/services/order.service.js:253-267`).

Overstated: "a wrong tap" is not enough. The admin app first asks "Mark NH… delivered?" with a separate "Mark delivered" button (`admin/src/app/(app)/orders/order/[id].js:93-99`). It takes two deliberate taps.

### s16. Invoice download in in-app browsers (not sure)
**Verdict: ✅ Correct as a code fact; device behaviour not verifiable from code.** The download is a blob link clicked by script, and the "Invoice … downloaded" toast shows right after, with no way to know if the browser saved it (`web/src/orders/invoice.js:5-17`, `web/src/orders/actions.js:37-38`). Checkout already detects in-app browsers (`web/src/payments/razorpay.js:36-37`), so the suggested fix has a ready helper.

### s17. Lower-case order number says "not found"
**Verdict: ✅ Correct.** `web/src/pages/orders/OrderPage.jsx:177`: `/^NH\d{8}$/.test(number)` with no `toUpperCase()`. The server checks the same way (`backend/src/validators/shop/checkout.validators.js:17`, trims but doesn't upper-case).

---

## Extra notes (not findings of this report, not counted above)

1. **Hand refunds never show as "refunded" on live today.** Section 2's table and section 7 assume Razorpay tells this server about hand refunds. It doesn't: notices go to the old server, which ignores refunds (`old/src/modules/orders/orders.service.ts:211`). So every shop-cancelled paid order says "₹X is being refunded" for ever (`web/src/orders/status.js:36`, `OrderPage.jsx:126`). Moving the webhook to this server fixes it.
2. **To check in Module 09 (payments):** the old server's `payment.captured` handler marks any order whose Razorpay order id it finds as paid and `processing`, with no stock or hold check (`old/src/modules/orders/orders.service.ts:180-225`; it only converts **active** holds, `old/src/modules/inventory/inventory.service.ts:153-164`). New website orders have that id saved (`backend/src/services/shop/checkout.service.js:232-236`). If its webhook secret is set, then:
   - a late payment that this server refunds (sarees sold meanwhile, `checkout.service.js:526-529`, `:579-595`) can be flipped back to `processing` + paid. The customer then sees "Being packed" while the money is refunded, and the order sits in To ship.
   - a payment after the hold ended can be marked paid without taking the sarees from stock. When this server sees it later it says "already paid" (`checkout.service.js:465`), so the stock is never taken and the order confirmation steps (notice, owners' alert) don't run.

   This affects what the Orders module shows, but the cause is in payments. Treat it as a lead to confirm in the Module 09 check.

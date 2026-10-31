# Third check: Module 10, Orders (tie-breaker)

| | |
|---|---|
| **Report** | [`../10-orders.md`](../10-orders.md) |
| **Second check** | [`10-orders-check.md`](10-orders-check.md) |
| **Date** | 26 Oct 2026 |
| **How** | Read the code only (server, website, admin app, the old server one folder up) and the deployment notes. Nothing was run, built, tested or changed. No live server, database or Razorpay account was touched. No `.env` file was opened. |
| **Scope** | Only the 3 items marked ⚠️ (S2, S5, s15) and the second checker's lead about the old server's payment notices. |

Short paths: `backend/` = `Nadam-backend/`, `web/` = `Nadam-frontend/customer-web/`, `admin/` = `Nadam-frontend/admin-app/`, `old/` = `../backend/` (the old server).

## Summary

| Id | One-line title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| S2 | A shop-cancelled order says the full total was refunded, even if less was refunded | Real now. Should | Code is right, but it can't happen on live today (refund notices never reach this server; the page says "being refunded" for ever instead). Should | **Second checker right** (and for a stronger reason than it gave) | **Should fix** |
| S5 | The "Thank you" view comes back when the paid tab is reloaded | Should | Cause right, but only polish. Small | **Second checker right** | **Small** |
| s15 | "Delivered" can't be undone | A wrong tap sends "We hope you love it". Small | No undo, but it takes a tap plus a confirm. Small | **Second checker right** | **Small** |
| Lead | The old server's `payment.captured` handler can mark a new website order paid and "processing" with no stock or hold check | (not in the report) | A lead: real "if its webhook secret is set" | **Real only if** a TEST-mode Razorpay webhook reaches the old server signed with the same secret it holds. **Certain** once live keys are used while the old webhook still goes to the old server | **Must fix** (before live keys) |

---

## S2. "Your ₹X was refunded" uses the full total

**What really happens (code).**
- When the shop cancels a paid website order, the page shows the order **total** as the refund: `web/src/pages/orders/OrderPage.jsx:126` (`your ${rs(order.total)} was refunded`) and `web/src/orders/status.js:36`.
- The only thing that turns "being refunded" into "was refunded" is a stored Razorpay notice: `backend/src/models/checkout.model.js:44-51` looks for `refund.processed` rows for that payment and keeps the **first** one (`// the first one`), with no check against the cancel time.
- The stored notice has no amount: `backend/prisma/schema.prisma:647-656` (`PaymentEvent`: id, type, ids, result, time), written at `backend/src/services/shop/checkout.service.js:683`.
- So, once refund notices reach this server: a part refund, or a part refund made before the cancel, still shows "your ₹<full total> was refunded on <date of the first refund>". The first reviewer's code reading is right.

**Can it happen on live today? No (almost certainly).**
- `PaymentEvent` rows are written only by this server's webhook handler (`checkout.service.js:653-685`). Nothing else writes them.
- That handler stops at once if no webhook secret is set: `checkout.service.js:654` (`WEBHOOK_NOT_CONFIGURED`). The 26 Oct go-live note lists every line added to the server's `.env`, and the webhook secret is not one of them (`docs/deployment/live-v2-server.md:101`); it is listed under "Before real selling" (`:104`).
- The old webhook address still goes to the old server (`live-v2-server.md:50`, `:102`), and the old server ignores everything except `payment.captured` (`old/src/modules/orders/orders.service.ts:211`).
- So today no refund is ever recorded here. Every shop-cancelled paid order says "₹X is being refunded" for ever, even after the owner refunded it in full.

**Why the first reviewer went partly wrong.** It described a future problem as a present one. Its table in section 2 assumes Razorpay tells this server about hand refunds. It did hedge in section 7 ("Hand refunds show on the order page only if it is"), but the finding itself reads as live.

**Is the second checker right?** Yes. Its conclusion holds. One gap in its reason: "Razorpay's notices go to the old server" is about the LIVE-mode webhook, and today's website payments are TEST-mode payments. The stronger reason is the missing webhook secret on this server, which blocks every notice whatever the dashboard says. Should stays right: the wrong amount appears as soon as the planned webhook move is done (`docs/modules/web-04-checkout.md:225-232`).

**Final.** The server never stores how much was refunded. So once refund notices reach it, a shop-cancelled order will say the full total was refunded, even after a part refund. Today it instead says "being refunded" for ever. **Should fix.**

---

## S5. The "Thank you" view comes back on reload

**What really happens.**
- After paying, the website opens the order with a "just paid" mark: `web/src/pages/checkout/usePayment.js:59` (`navigate(..., { replace: true, state: { paid: true } })`). The "confirmed" strip does the same: `web/src/components/OrderNotice.jsx:42`.
- React Router keeps that mark in the browser's own history entry (`usr: location.state` in `node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs:224`, read back on load at `:143`, `:176`). A reload, a phone reopening an old tab, or Back/Forward brings it back. Nothing ever clears it.
- With the mark, a paid, shipped or delivered order shows the "Thank you" view: `web/src/pages/orders/OrderPage.jsx:176`, `:40`, `:210`, `:278-293`.
- What the customer still sees in that view: "Order shipped" or "Order delivered" above "Thank you" (`:35`, `:282`). The steps tick Shipped and Delivered and show "Tracking <number>" (`:47-49`). A My orders button (`:289`). Below it: sarees, address ("Delivered to" when delivered, `:87`), payment, and the invoice "Download it" link once the invoice is made (`:354`, `:361-363`, `:70`).
- What is missing: the status badge, the progress card, the tracking card (Copy, Track on DTDC), Buy again and the "Need to cancel" line (all only in `OrderView`, `:143-157`).
- Small extra from the same cause: a refunded order's "Thank you"-style view always says "is being refunded" (`:330`), while its normal page says "was refunded" once Razorpay confirms (`:119`).

**Why the first reviewer went partly wrong.** The cause is right. But nothing is wrong about money or the order, the tracking number is still on screen, the invoice can still be downloaded, and My orders is one tap away. The customer is not stuck. That is polish, not "likely and harmful".

**Is the second checker right?** Yes, and its evidence matches the code. It did not mention that the invoice link is also still there, which supports Small even more.

**Final.** Reopening or reloading the tab used to pay shows "Thank you" again, even days later. It still has the right status and tracking number, but not the tracking card, progress card or Buy again. **Small.**

---

## s15. "Delivered" can't be undone

**What really happens.**
- The server has only a "mark delivered" route, no undo: `backend/src/routes/order.routes.js:23`. `markDelivered` sets the order delivered and notifies the customer once: `backend/src/services/order.service.js:253-267`.
- After that, the tracking number can't be changed (`order.service.js:240`, "This order was delivered; its tracking number can't change now.") and the order can't be cancelled (`:141`).
- In the admin app the only caller is the order page. Pressing "Mark delivered" opens a confirm box, "Mark NH… delivered?", with its own "Mark delivered" and "Cancel" buttons: `admin/src/app/(app)/orders/order/[id].js:93-99`, button at `:132`.

**Why the first reviewer went partly wrong.** "No undo" is right. "A wrong tap" is overstated: the admin app wrote it as 2 taps, with the order number in the question. The first reviewer read only the server side (its section 7 says so).

**Is the second checker right?** Yes.

Side note (outside these 4 items): the old staff app's shipment route, on the old server that is still on, sets **any** order back to "shipped" with no status check (`old/src/modules/admin/admin.service.ts:353-378`). That is not a real undo. It goes away when the old server is switched off.

**Final.** A mistaken "Delivered" can't be undone, and the customer gets "We hope you love it". It takes a tap and a confirm, so it is rare. **Small.**

---

## Lead. The old server's `payment.captured` handler

**What the old server does with a notice** (still running on the same database).
- The route: `old/src/app.ts:68` (`/api/v1/webhooks`) and `old/src/modules/webhooks/webhooks.routes.ts:10` (`/razorpay`). The `api.nandamhandlooms.com` nginx block that serves it was not changed on 26 Oct (`docs/deployment/live-v2-server.md:50`).
- The signature check: HMAC-SHA256 of the body with its **one** secret, `RAZORPAY_WEBHOOK_SECRET`: `old/src/providers/payment/razorpay.provider.ts:47-55`. A bad signature gives 401 and nothing changes (`old/src/modules/webhooks/webhooks.controller.ts:13-15`).
- Only `payment.captured` is used: `old/src/modules/orders/orders.service.ts:211`. It finds the `Payment` row by the Razorpay order id (`:218`) and calls `finalizeCapturedPayment` (`:224`).
- `finalizeCapturedPayment` (`:180-207`) only asks "is the Payment already paid?" (`:187`, `:190-198`). It does not look at the order's status, holds, stock, cancel or refunds. It then sets the Payment paid (with no method and no capture time), the order to `processing` (`:200`), and converts only holds that are still **active** (`old/src/modules/inventory/inventory.service.ts:153-164`). It also fires its own `order.paid` step: the old invoice maker and the old staff push (`old/src/modules/events/events.service.ts:23-29`).

**Why new website orders are exposed.** This server writes a `Payment` row with the Razorpay order id and status `created` when the customer presses Pay (`backend/src/services/shop/checkout.service.js:232-236`). Column types match the old schema (strings, not enums), so the old server can read and update these rows.

**What goes wrong, if a valid notice reaches the old server** (all confirmed in code):
1. **Old server first, payment after the hold ended** (the likely order: in a late payment the page usually didn't confirm, and this server only re-checks a "created" payment every 5 minutes, `backend/src/models/checkout.model.js:70-77`, while Razorpay's notice comes in seconds): the order becomes paid and "Being packed" with no stock taken, since the holds already ended. When this server checks, it sees "already paid" (`checkout.service.js:465`) and stops. So no stock is taken. **If the saree had sold meanwhile, the customer is charged, the order says "Being packed", and no refund is ever made.** The second checker's note missed this worse case.
2. **This server first, then the old server** (a slow or retried notice): this server refunds a late payment whose saree sold (`checkout.service.js:526-529`, `:579-594`). It cancels the order and marks the try `refund_due`, but leaves the `Payment` row at `created`. The old server then marks it paid and `processing`. The customer sees "Being packed" (`checkout.service.js:83`) while the money goes back, and the order sits in To ship (`backend/src/models/order.model.js:10`). If the shop then cancels it, stock that this order never took is put back on sale (`order.service.js:284-293`).
3. **Even an on-time payment, old server first:** the stock is right (active holds are converted), but this server's own "after paid" steps never run (`checkout.service.js:465`, `:531-532`): no "Order confirmed" notice, no owners' alert, and the sarees stay in the customer's bag.

**Can a valid notice reach the old server today?**
- Website payments today are on Razorpay **TEST** keys (`live-v2-server.md:96`, `:101`). Razorpay sends notices for test payments only to webhooks set up in **Test mode**. Test-mode and Live-mode webhooks are set up separately, each with its own secret typed in by the owner.
- LIVE-mode notices go to the old server with the matching secret, but they can never name a test payment request. So **today they can't touch new website orders**.
- A TEST-mode notice changes something only if **both** of these are true:
  - (a) Razorpay's Test-mode dashboard has a webhook with `payment.captured` pointing at an address that reaches the old server (`api.nandamhandlooms.com/api/v1/webhooks/razorpay`);
  - (b) that webhook's secret is the same text as the old server's `RAZORPAY_WEBHOOK_SECRET` (the live one).
  
  Otherwise the old server answers 401 and nothing changes. Neither (a) nor (b) can be seen from the code; both are unknown.
- **It becomes certain** the day this server gets live keys while the old webhook still reaches the old server and the old server is still on. Live notices are signed with exactly the secret the old server holds. The plan's go-live steps (move the webhook by nginx, switch the old server off: `docs/modules/web-04-checkout.md:36`, `:225-232`; `docs/to-do-list.md:202`) remove it. But nothing in the code forces that order, and on 26 Oct checkout went live without those two steps (`live-v2-server.md:102`).

**Is the second checker right?** Yes, about both effects, and its line references hold. Its condition "if its webhook secret is set" is incomplete: the old server's secret is set, but today it only matters for test payments if the Test-mode dashboard sends there with the same secret. It also missed case 1's worst ending (charged, no refund) and case 3.

**How to settle "today" without changing anything:** look at Razorpay's dashboard in **Test mode**, under Webhooks, for an address on `api.nandamhandlooms.com`. Or look at the old server's log for 401 "Invalid webhook signature" against 200 on test payments. Or, read-only, look for a website order that has payment tries and a `paid` Payment with no method and no capture time: that is the old server's mark.

**Final.** The old server marks any order it knows as paid and "processing" with no stock, hold or refund check. Today that needs a Test-mode webhook to the old server with the same secret. It is certain once live keys are used before the webhook is moved and the old server is switched off. **Must fix** (a blocker before live keys).

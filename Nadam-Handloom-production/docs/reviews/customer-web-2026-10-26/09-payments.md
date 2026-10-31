# Module 9: Payments (Razorpay): review

| | |
|---|---|
| **Date** | 26 Oct 2026 |
| **What was looked at** | From the moment Razorpay's payment window opens to the order being paid, failed, closed, cancelled or refunded. Also Razorpay's notices, the background checks, refunds, the owners' payment alerts and the invoice made after payment. |
| **How** | Reading the code only. Nothing was run, changed, or tried on the live website, Razorpay or the database. |
| **Not in this review** | Checkout up to the Pay button (address, review, making the order and the hold). Another reviewer covers that. |
| **Live state (as told)** | Live since 26 Oct 2026 on Razorpay **test keys**, open to every visitor. Razorpay's notices still go to the **old** server, so the new server checks Razorpay by itself every minute. |

Words used in this report:
- **Payment request**: what our server asks Razorpay to make for one order and one exact amount (Razorpay calls it an "order").
- **Payment try**: our own record of one payment request (the table `PaymentAttempt`). Pressing Pay again makes a new one.
- **Hold**: the sarees kept aside for the customer for 15 minutes after Pay, so nobody else can buy them.
- **Captured**: Razorpay has really taken the money.
- **Signature**: a secret stamp that proves a message really came from Razorpay.
- **Notice (webhook)**: a message Razorpay's computers send to our server by themselves when something happens to a payment.

---

## 1. What this module does

It takes the customer's money through Razorpay. It makes sure an order is marked paid only after Razorpay itself says the money arrived, for the right amount. If a payment can't be used (for example, it came after a saree was sold at the store), the whole amount goes back to the customer by itself. After a payment it makes the GST invoice, tells the customer, and tells the owners' phones.

## 2. The steps a customer goes through

1. The customer presses **Pay ₹X** on the checkout page. Our server holds the sarees for 15 minutes and asks Razorpay for a payment request for the exact total.
2. **Razorpay's window opens** on our page. It shows the shop's name, "Order NH…", the amount, and the customer's name, mobile and email filled in. It closes by itself when the 15 minutes are up.
3. The customer pays (UPI, card, net banking, wallet).
4. Razorpay gives the page a receipt. The page sends it to our server (**Check payment**). A spinner says "Confirming your payment".
5. Our server checks the secret stamp, then asks Razorpay directly: was this payment taken, for this amount, in rupees, for this request?
6. If yes: the order becomes **paid**. The sarees become "sold online", they leave the bag, an empty shipment is made, and the GST invoice is made. The customer sees **"Thank you … Order confirmed"**.
7. If our server couldn't reach Razorpay, the customer sees **"Payment received, confirming with your bank"**. The page keeps asking, and the server keeps checking with Razorpay every minute for up to 3 days.
8. Other endings:
   - **Window closed without paying**: "Payment not completed", with **Pay now** and **Change my bag**.
   - **Payment failed**: "Payment didn't go through. Nothing was taken.", with **Try again**.
   - **15 minutes over**: "The 15 minutes are over", with **Check my bag again**.
   - **Paid after the 15 minutes**: if every saree is still there, the order still goes through. If not, the whole amount is refunded automatically.
   - **Paid twice**: the second payment is refunded automatically.

**What the shop sees:**
- The paid order in the admin app's **To ship**.
- A phone alert to owners: **"New online order · ₹X"**.
- The admin app's **Online payments** screen lists every try: paid, confirming, not paid, refunded, refund stuck, and cancelled after paying.
- If Razorpay refuses a refund three times, owners get **"Refund stuck"** and must refund it by hand in Razorpay's dashboard.

---

## 3. Each API

All website calls are under `/api/v2/shop`. The customer must be signed in, and can only touch their **own** orders. Any other order number gets "We couldn't find this order".

### 3.1 Pay again: `POST /orders/NH12345678/pay`

| | |
|---|---|
| **For** | A new payment request for an order whose sarees are still held. Used after the window was closed or a payment failed. It also gives another 15 minutes, but never more than 30 minutes from the first Pay. |
| **What goes in** | Only the order number in the address (`NH` + 8 digits). |
| **Checks, in order** | 1. Signed in. 2. At most 10 Pay presses a minute per customer. 3. Order number shape. 4. Website not switched off. 5. Online payment switched on, and this customer may pay. 6. The order is theirs. 7. It is locked so nothing else changes it at the same moment. 8. It is not already paid. 9. It is still waiting for payment, its sarees are still held, and it is under 29 minutes old. 10. The hold is renewed. 11. Razorpay is asked for a new payment request. 12. The order is checked again (still unpaid and held) before the new request is saved. |
| **What comes back** | The order (number, sarees, total, address, "held until") and what the page needs to open Razorpay: the public key, the payment request id, the amount in paise (₹1 = 100 paise), INR, the shop name, "Order NH…", the customer's name, email and mobile (+91…), and the time left in seconds (at least 60). |
| **What is saved** | Hold end times (`Reservation.expiresAt`). A new payment try (`PaymentAttempt`, status "created"). The order's one `Payment` row now points to the newest request (status "created"). |
| **What can go wrong** | `PAYMENTS_OFF`: "Online payment isn't open yet…" · `ORDER_NOT_FOUND`: "We couldn't find this order." · `ORDER_PAID`: "This order is already paid." (the page reloads the order) · `HOLD_ENDED`: "The 15 minutes are over and your sarees were released…" (the page reloads the order) · `ORDER_TOO_LARGE`: above the most one payment may be · `PAYMENTS_UNAVAILABLE`: "We couldn't open the payment just now. Nothing was charged…" · `RATE_LIMITED`, `MAINTENANCE`, sign-in errors. |

### 3.2 Check payment: `POST /orders/NH12345678/verify`

| | |
|---|---|
| **For** | The page hands over Razorpay's receipt after a payment. The server decides what it means. |
| **What goes in** | `razorpayOrderId` (`order_` + 6–40 letters/digits), `razorpayPaymentId` (`pay_` + 6–40), `razorpaySignature` (64 hex characters). Anything else: "This payment can't be checked." |
| **Checks, in order** | 1. Signed in. 2. At most 30 a minute per customer. 3. The order is theirs. 4. The payment request belongs to this order. 5. The secret stamp matches. It is worked out from **our** stored request id, never the one the page sent. 6. Razorpay is asked for its own record of the payment. 7. That record must be for this request, in rupees, and for exactly this amount. Only then does its status count. |
| **Then** | **Captured**: the order is completed (see 3.5) or refunded. **Authorised but not yet taken**: our server takes it if the sarees are still held; otherwise it waits ("confirming"). **Failed**: the try is marked failed, but a failed try never overwrites a try that is being confirmed. **Returned by Razorpay**: marked failed. **Razorpay can't be reached**: the try becomes "confirming" and the background check finishes it later. |
| **What comes back** | The order as the customer should see it now (paid / confirming / waiting for payment / 15 minutes over / refunded / cancelled). |
| **What is saved** | See 3.5. Also an audit entry when a stamp is wrong. |
| **What can go wrong** | `ORDER_NOT_FOUND` · `PAYMENT_NOT_FOUND`: "This payment isn't for this order." · `PAYMENT_NOT_VERIFIED`: "We couldn't confirm this payment. If money left your account, it is safe…" · `VALIDATION_FAILED` · `RATE_LIMITED` · `MAINTENANCE` (the website switch also blocks this call; the background check still completes the payment). Note: this call works even when online payment has been switched off, which is right: money already paid must still count. |

### 3.3 Change my bag: `POST /orders/NH12345678/cancel`

| | |
|---|---|
| **For** | The customer gives up this checkout. The sarees go back on sale. |
| **What goes in** | The order number. |
| **Checks** | Signed in · at most 120 a minute · their own order · locked · only an order still waiting for payment is changed. Any other order is returned as it is. |
| **What comes back** | The order (now "cancelled"). |
| **What is saved** | Holds become "released"; held sarees go back to "in stock" (or the old stock count goes back up); a stock-history line "release". The order becomes "cancelled" with "The customer went back to change the bag". An audit entry. |
| **What can go wrong** | `ORDER_NOT_FOUND`. If a payment still arrives later, it is handled like any late payment: the order goes ahead if the sarees are still there, otherwise it is refunded. |

### 3.4 Razorpay's notices: `POST /api/v2/payments/razorpay/webhook`

| | |
|---|---|
| **For** | Razorpay telling our server about a payment by itself, for example when the customer's phone lost the connection after paying. **Today these notices still go to the old server, not this one.** |
| **What goes in** | The message exactly as Razorpay sent it (up to 256 KB), with its stamp (`x-razorpay-signature`) and its message number (`x-razorpay-event-id`). |
| **Checks, in order** | 1. A notice secret is set up (otherwise "Payment notices are not set up", 503). 2. The stamp matches the exact bytes received (otherwise "Invalid signature", 401). 3. It is readable (otherwise 400). 4. The same message number was already handled → answered "duplicate" and skipped. |
| **Handled** | `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid` → the same rules as Check payment (3.2). A payment not from the website (a QR code or payment link) is noted and answered, so Razorpay doesn't keep retrying. `refund.processed` / `refund.failed` → the refund is marked done or failed. A refund the owners made by hand in Razorpay is also noted, so the customer's page can show it. A failed refund alerts the owners once. |
| **What is saved** | Whatever the payment rules save (3.5), then one `PaymentEvent` row: message number, kind, request id, payment id and the result. |
| **What comes back** | `{ ok: true, result }`. On a database error: an error, so Razorpay sends it again. |
| **Safety** | Outside the website switch, so it is never blocked by maintenance. A replayed old notice is either skipped (same number) or changes nothing (the rules are safe to repeat). |

### 3.5 What happens to the order when money arrives (inside 3.2, 3.4 and 3.6)

| Situation | What the server does |
|---|---|
| The order still holds its sarees | Holds → "converted"; sarees → "sold online"; order → "processing" (To ship); `Payment` → "paid" with the method and time; try → "paid"; empty shipment made; the sarees leave the bag; any other unpaid checkout of this customer is cancelled. Then: invoice, customer notification, audit, owners' alert. |
| The hold ended, or the checkout was cancelled | Every saree must still be in stock. Then it is taken again and the order goes ahead as above. If any one is gone, nothing is taken: the order stays or becomes cancelled ("Paid after the sarees were sold; refunded"), and the **whole** amount is refunded. |
| The same payment is told twice (page and notice) | Nothing more is done. Each step is locked per order. |
| A different payment for an order already paid | Refunded in full ("Paid twice"). |
| A captured payment for a different amount | Refunded in full ("The amount paid didn't match the order"), and the order is cancelled. |

### 3.6 The background jobs (`src/jobs/payments.job.js`)

| Every | What it does |
|---|---|
| **30 seconds** | Ends holds whose time is up (up to 200 orders each time). The sarees go back on sale. The order stays "waiting for payment" (it shows in the admin app's Unpaid checkouts). |
| **1 minute** | Looks at up to 50 payment tries: **(a)** "confirming" tries: asks Razorpay every minute; after 3 days with no answer the try is marked failed. **(b)** Tries not known to be paid (window opened, closed or failed): first looked at 3 minutes after the request was made, then every 5 minutes, up to 2 hours. This catches payments whose page and notice were both lost. **(c)** Refunds waiting to start: tried again after 1, 5, 15 and 60 minutes, then every 6 hours. After the 3rd refusal the owners are told once and it shows as **Refund stuck**. **(d)** Up to 20 paid online orders (last 30 days) with no invoice yet get one. |
| **No overlap** | A run that is still going is not started again. |
| **Server restart** | Everything important is in the database, so after a restart the jobs carry on where they were. Lost on restart: an owners' alert or customer message that was about to be sent at that moment. |

**Razorpay settings on every payment request:** amount in paise, rupees, the order number as the receipt, and our order id in the notes. Razorpay takes the money automatically if the bank approves within 15 minutes. A payment approved later is never taken: Razorpay returns it by itself.

**Also read:** `GET /config` tells the website whether payments are on, whether only some customers may pay, the hold minutes, test or live mode, and the largest amount. `GET /orders/NH…` gives the order's status; it only reads our database and does not ask Razorpay.

---

## 4. The data kept

### PaymentAttempt: one row per payment request (new in W6)

| Field | What it means | Must have it? |
|---|---|---|
| id | Our id for this try | Yes (made automatically) |
| orderId | Which order | Yes |
| razorpayOrderId | Razorpay's payment request id (`order_…`); never repeated | Yes, unique |
| amount | Rupees asked for | Yes |
| status | created / confirming / paid / failed / refund_due / refunded (default created) | Yes |
| razorpayPaymentId | Razorpay's payment id (`pay_…`) | No |
| method | upi, card, netbanking, wallet… | No |
| failureReason | Why it failed (from the bank) | No |
| capturedAt | When the money was taken | No |
| refundId / refundStatus / refundReason / refundedAt | The automatic refund: Razorpay's refund id, pending / processed / failed, why, and when | No |
| refundTries (default 0) / refundError / nextRefundAt / alertedAt | Refund retries: how many refusals, the last error, when to try next, and when the owners were told | No |
| lastCheckedAt | When the background check last asked Razorpay | No |
| createdAt / updatedAt | When made / changed | Automatic |

### Payment: one row per order (the admin app reads this)

| Field | What it means | Must have it? |
|---|---|---|
| orderId | The order (only one Payment per order) | Yes, unique |
| provider | "razorpay" (default) | Yes |
| razorpayOrderId | The newest payment request, or the one that paid | Yes, unique |
| razorpayPaymentId / razorpaySignature | The payment that paid, and its stamp (when it came from the page) | No |
| status | created / paid (old rows may say failed) | Yes (default created) |
| amount | The order total | Yes |
| method / capturedAt | How and when it was paid | No |

### PaymentEvent: each Razorpay notice, once

| Field | What it means | Must have it? |
|---|---|---|
| id | Razorpay's message number (or a fingerprint of the message) | Yes, unique |
| type | e.g. payment.captured, refund.processed | Yes |
| razorpayOrderId / razorpayPaymentId | Which request / payment | No |
| result | What our server did ("paid", "unknown order", "refund processed"…) | Yes |
| receivedAt | When | Automatic |

### Order (the parts payments use)

| Field | What it means | Must have it? |
|---|---|---|
| orderNumber | NH + 8 digits, shared with counter and WhatsApp bills | Yes, unique |
| authAccountId | The customer | No (yes for website orders) |
| channel | "online" for the website | Yes |
| status | pending_payment → processing → shipped → delivered, or cancelled | Yes |
| subtotal / total | Rupees (no delivery fee) | Yes |
| shippingAddress | A copy of the address at Pay time | Yes |
| invoiceRequired | Always true online | Yes |
| paymentMethod | How it was paid | No |
| cancelledAt / cancelledById / cancelReason | When, who and why it was cancelled | No |
| placedAt | When Pay was first pressed | Automatic |

### The other tables touched

| Table | What payments do with it |
|---|---|
| **OrderItem** | One line per tagged saree (or per counted quantity): name, price, photo and quantity copied at Pay time. Not changed by payment. |
| **Reservation** (hold) | Saree (or quantity), order, `expiresAt`, status **active / converted / released / expired**. Paying turns active → converted. |
| **Piece** (a tagged saree) | Status **in_stock → reserved → sold_online**, or back to in_stock. `soldAt` is set when sold. |
| **Product.stock** | The old counted stock (sarees without tags). Goes down on hold, up on release. |
| **StockLedger** | A history line for each move: reserve (−), release (+), online_sale, with the order number. Never changed afterwards. |
| **Shipment** | An empty one (DTDC, not shipped) is made when the order is paid. |
| **Invoice** | One per order: number `INV-000123`, or `TEST-000001` while test keys are used on the live server; tax split, place of supply, PDF address, made by "system". |
| **StaffPushToken** | One per signed-in admin phone: its token, Android or iPhone, and "payments" on or off (default on). Used for owners' alerts. |
| **Notification** | The customer's web notifications: "Order confirmed" (`order_paid`) and "Your payment is being refunded" (`payment_failed`). |
| **BagItem** | The bought sarees are removed from the customer's bag. |
| **EventsOutbox** | **Not used** by the new payment code. Only the old server writes to it. |

### The statuses and the moves between them

**Payment try** (`PaymentAttempt.status`):
- created → **paid** (money taken, order goes ahead)
- created → **confirming** (the page said paid but Razorpay couldn't be asked, or the bank hasn't finished) → paid, or failed after 3 days
- created or confirming → **failed** (the bank refused, or Razorpay returned a late payment) → can still become paid if a later try on the same request succeeds within 2 hours
- created / confirming / failed → **refund_due** (money taken but can't be used) → **refunded** once Razorpay accepts the refund. `refundStatus` then goes pending → processed (or failed), but **only through Razorpay's notices**.

**Order** (`Order.status`):
- pending_payment → **processing** (paid; To ship) → shipped → delivered
- pending_payment → **cancelled** (Change my bag, replaced by a newer checkout, sold at the counter with "Sell anyway", Razorpay unreachable, paid by another order, or a refunded payment)
- cancelled → **processing** (a late payment, and every saree was still in stock)
- processing → cancelled (an owner cancels in the admin app; the refund is then done by hand in Razorpay)

**What the customer sees** (from `customerStatus`): awaiting_payment ("Waiting for payment"), confirming, paid ("Being packed"), shipped, delivered, hold_ended ("Not paid"), refunded, cancelled_paid ("Cancelled by the shop"), cancelled ("Not paid").

**What owners see in Online payments**: Paid, Confirming, Not paid, Refunded, Refund stuck, Cancelled after paying.

---

## 5. On the website

| Screen / moment | What the customer sees |
|---|---|
| **Checkout, test keys** | A yellow note: "Test payment: no real money is taken … test card 4111 1111 1111 1111 … Test orders are not shipped." (also a short note in the bag and side panel) |
| **Pay pressed** | The button spins; Razorpay's script loads while our server makes the request. |
| **Razorpay window** | The shop's maroon colour, the logo (only on the real https site), the amount, "Order NH…", the mobile, name and email filled in, and a countdown equal to the hold. Razorpay lets the customer try again inside the window after a failure. Closing asks "are you sure". |
| **Paid** | A spinner box "Confirming your payment … Please don't close this page" (it can't be closed). Our server is asked up to 4 times (waiting 1.5, 3 and 6 seconds between). Then the order page. |
| **Order confirmed** | A big tick, "Thank you, (first name)", "Your order NH… is confirmed and paid: ₹X by UPI", the four steps (Paid, Packed, Shipped by DTDC, Delivered), the sarees, the address, "Paid ₹X by UPI (Razorpay)", and "Your GST invoice is being made" until it is ready, then **Download it**. |
| **Confirming** | "Payment received, confirming with your bank … You can close this page … If the bank doesn't confirm, the money goes back to you automatically." It asks again every 4 seconds for a minute, then every 15. **Check again** button. |
| **Our server not reached after paying** | The order page shows "confirming" by itself for up to 10 minutes while it keeps asking. |
| **Window closed** | "Payment not completed. Your sarees are held for you until 4:35 pm." **Pay now** · **Change my bag**. |
| **Payment failed** | "Payment didn't go through. Nothing was taken." plus the bank's reason and the hold time. **Try again** · **Change my bag**. |
| **Window didn't load** | "The payment window didn't open. Check your connection and press Pay again. Nothing was charged." Inside Instagram and similar apps: also "open this page in Chrome or Safari", with **Copy the link**. |
| **Offline** | "You're offline. Nothing was charged. Pay works again when you're back online." |
| **Something changed** | "Something changed before you paid … Nothing was charged." (checkout reviewer) |
| **Too large** | "This order is too large to pay online in one go", with **Order on WhatsApp**. |
| **15 minutes over** | Checkout: "The 15 minutes are over … Check your bag again", with **Check my bag again**. Order page: "The 15 minutes are over. Your sarees were released … Nothing was charged for order NH…". |
| **Paid in another tab or in a UPI app** | "Your payment for order NH… went through. It's confirmed, so you don't need to pay for it again." **See the order**. |
| **Refunded (late)** | "We couldn't keep your order. Your payment … arrived after the 15 minutes … a saree had sold at our store. Your ₹X is being refunded … 5 to 7 working days." **See what's new** · **Ask us for a similar saree**. |
| **Paid twice** | The normal "Thank you" page, plus "A second payment of ₹X is being refunded". |
| **Cancelled checkout** | "This checkout was cancelled. Nothing was charged for order NH…". |
| **Cancelled by the shop after paying** | "Cancelled by the shop: ₹X is being refunded", later "…was refunded" (only through Razorpay's notices). |
| **Later visits** | The order's own page: status badge, progress, tracking, **Download invoice**, **Buy again**, **Help on WhatsApp**, and for an unpaid held order **Pay ₹X** and **Change my bag**. |

---

## 6. Problems found

Good news first. The core money rules are careful:
- Never trusting the page alone; always asking Razorpay.
- Checking the amount and the currency.
- Locking each order.
- One answer per payment, even when the page and a notice arrive together.
- The 15-minute automatic-take window, so very late payments are returned by Razorpay.
- Automatic refunds that retry and warn the owners.

The problems below are mostly about **test payments acting like real sales**, and about the **minutes when our server doesn't yet know a payment went through**.

### Must fix

**M1. Test payments act like real sales: real sarees are taken off sale, shown as orders to ship, and counted as income.**
- *What happens:* With test keys open to everyone, any visitor can pay with the test card that our own checkout page prints. The saree is then marked "sold online" for real:
  - it disappears from the website;
  - the counter can't sell it;
  - it appears in **To ship**;
  - it is counted in sales;
  - owners get "New online order · ₹X";
  - the customer gets "Order confirmed … We pack it within 2 working days".

  Its TEST invoice also goes into the invoice list and the sales summary used for GST.
- *Why it matters:*
  - One person (or a bot) can "buy" every one-of-a-kind saree for free and block real customers.
  - Staff may pack and ship a saree that was never paid for. The website says "Test orders are not shipped", but nothing in the admin app marks them as tests.
  - These orders can only be cancelled in the admin app **in the same month**. Test orders from October can't be cleaned up in the app from 1 November.
- *Where:*
  - stock and order: `Nadam-backend/src/services/shop/checkout.service.js:473-507`;
  - messages: `checkout.service.js:567-573`, `src/services/ownerAlerts.service.js:19-24`;
  - To ship and sales: `src/models/order.model.js:10`, `src/models/stats.model.js:7-8`;
  - invoice summary: `src/models/invoice.model.js:63-68`;
  - the promise: `Nadam-frontend/customer-web/src/payments/TestPayNote.jsx:16`;
  - the month rule: `src/services/order.service.js:142`;
  - the setting that allows it: `src/config/env.js:105`, `src/config/env.js:158`;
  - the counter refusing the saree: `src/services/sale.service.js:73`.

> **Second check: ✅ Correct.**

**M2. A customer can pay twice when a UPI payment finishes while our page isn't watching.**
- *What happens:*
  1. On a phone, the customer pays in GPay or PhonePe.
  2. The browser tab is closed by the phone, or the customer closed Razorpay's window before approving the UPI request.
  3. Back on our site, the checkout page shows "held until 4:35 pm" and an active **Pay ₹X**. The order page says "Waiting for payment … Nothing was charged yet" with **Pay**.
  4. Our server doesn't ask Razorpay when the page asks. It only learns about the payment 3 to 8 minutes later, from the background check.
  5. Pressing Pay again opens a new payment, and the customer pays twice.
  6. Even when the server already knows a payment is being confirmed, the checkout page says "You don't need to pay for it again" but still offers the Pay button. Pressing it either reuses that order or cancels it and starts a new one.
- *Why it matters:* Real money is taken twice. The second payment is refunded automatically, but the customer waits 5 to 7 days and gets a confusing "Paid twice" refund.
- *Where:*
  - the order read never asks Razorpay: `checkout.service.js:385-391`;
  - first check only after 3 minutes, then every 5: `src/models/checkout.model.js:73-77`;
  - reload shows Pay again: `CheckoutPage.jsx:137-144`, `CheckoutPage.jsx:166-180`;
  - Pay allowed while a try is confirming: `checkout.service.js:289-297` and `checkout.service.js:349-359`;
  - "don't pay again" with Pay still on: `CheckoutPage.jsx:55` and `CheckoutPage.jsx:420`;
  - order page: `OrderPage.jsx:103-108`.

> **Second check: ⚠️ Partly correct: the double-pay path is real and Must is right before live keys, but the timing is off: the server first looks 3–4 min after Pay, then every 5 min (`checkout.model.js:73-77`), so it is at most ~5–6 min behind the payment (not "3 to 8 min after"); and today, on test keys, no real money is taken twice.**
> **Third check: Second checker right. Final: until the server's next look at Razorpay (3–4 min after Pay, then every 5 min, so up to about 5 min after the payment) the website still offers Pay for an order already paid in a UPI app, and the server opens new payments even while one is "confirming", so a customer can pay twice and one payment is refunded later (no real money moves on today's test keys). Final group: Must fix.**

### Should fix

**S1. Without Razorpay's notices, a refund never shows as done.**
- *What happens:* Every automatic refund stays "is being refunded" for ever, on the customer's page and in the admin app. A shop-cancelled order stays "₹X is being refunded" even after the owners refunded it by hand. If Razorpay fails a refund, nobody is told.
- *Why it matters:* The notices still go to the old server, so refunds are only ever updated by those notices. Customers will ask "where is my money?" when it is already back.
- *Where:* `checkout.service.js:620` (saved as "pending"), `checkout.service.js:669-681` (only notices update it), `checkout.model.js:44-51`; shown at `OrderPage.jsx:63`, `OrderPage.jsx:119`, `OrderPage.jsx:126-129`, `src/orders/status.js:33`, `src/orders/status.js:36`.

> **Second check: ⚠️ Partly correct: shop-cancelled hand refunds and later-failed refunds are right, but "every automatic refund stays being refunded" is overstated: `checkout.service.js:620` saves `processed` when Razorpay's first answer already says processed (then the page says "was refunded"); only refunds first answered `pending` stay stuck (which answer comes is Razorpay's behaviour).**
> **Third check: Second checker right. Final: while Razorpay's notices go to the old server, a shop-cancelled order's hand refund never shows as done, a refund Razorpay first answers "pending" stays "being refunded" for ever, and a refund that fails later is never reported (refunds first answered "processed" do show as refunded). Final group: Should fix.**

**S2. A UPI request the customer never approved is shown as "Payment received, confirming with your bank".**
- *What happens:* The customer types a UPI ID, doesn't approve, and closes the window. 3 minutes later the background check sees Razorpay's half-started payment and marks the try "confirming". The order page then says "Payment received", and the checkout says "You don't need to pay for it again". The Pay button on the order page disappears while the sarees' time runs out.
- *Why it matters:* No money was taken, and the customer may lose their sarees waiting. *Not sure* how long Razorpay keeps such a payment half-started before marking it failed.
- *Where:* `checkout.service.js:454` (Razorpay "created" → "confirming"), `checkout.service.js:718` (takes any first payment), `checkout.service.js:85`; `OrderPage.jsx:298`, `CheckoutPage.jsx:55`.

> **Second check: ✅ Correct.**

**S3. "Nothing was charged" is shown as a fact when a payment may still be on its way, and such an order can vanish from My orders.**
- *What happens:*
  - **15 minutes over:** "Nothing was charged for order NH…". A UPI payment approved in the last minute is still on its way, and we only learn of it up to 8 minutes later.
  - **Cancelled while the bank is confirming:** the customer pressed Pay again, the counter used "Sell anyway", or another payment settled it. The order shows "This checkout was cancelled. Nothing was charged" and **is not listed in My orders**, though money may be on its way (it is refunded later).
  - **Payment failed:** "Nothing was taken" can be wrong when a UPI payment is approved late.
- *Why it matters:* A wrong promise about money; the customer may pay again or panic.
- *Where:* `OrderPage.jsx:312`, `OrderPage.jsx:342`, `src/orders/status.js:38`, `CheckoutPage.jsx:65`, `CheckoutPage.jsx:68`; the cancelled status: `checkout.service.js:90-92`; My orders list: `checkout.model.js:33`; counter cancel: `src/services/sale.service.js:119-133`.

> **Second check: ⚠️ Partly correct: the wrong "Nothing was charged" texts and the missing My orders row are real, but the server learns of such a payment within ~5–6 min (not "up to 8"), and the cancelled order is not always refunded: if every saree is still in stock, `complete()` revives it as paid (`checkout.service.js:489-507`).**
> **Third check: Second checker right. Final: "Nothing was charged/taken" is shown as a fact (hold ended, failed try, cancelled checkout) while a payment may still turn up to about 5 min later, and a checkout cancelled while a payment is confirming drops out of My orders; that payment then brings the order back if every saree is still in stock, otherwise it is refunded. Final group: Should fix.**

**S4. A refund that went through, but whose answer we missed, is retried for ever and reported as "Refund stuck".**
- *What happens:* Razorpay is slow (over 10 seconds) or the server restarts just after Razorpay accepted a refund. Our record still says "refund waiting". The next tries are refused ("already refunded"). After 3 tries the owners get "Refund stuck — refund it by hand". The customer never gets the "being refunded" message. It keeps retrying every 6 hours for ever.
- *Why it matters:* A false alarm about money, and owners may try to refund twice in the dashboard.
- *Where:* `checkout.service.js:600`, `checkout.service.js:605-619`; the 10-second limit: `src/services/payments/razorpay.provider.js:8`, `razorpay.provider.js:21-30`.

> **Second check: ⚠️ Partly correct: the mechanism is right (timeout or crash leaves `refund_due`, refusals, false "Refund stuck", endless 6-hour retries), but it needs a >10 s Razorpay answer or a crash at that exact moment, and Razorpay never lets a refund exceed the payment, so the harm is a false alarm, not money: Small, not Should.**
> **Third check: Second checker right. Final: a refund Razorpay accepted but whose answer we lost (an answer over 10 s, or a restart at that instant) is retried every 6 hours for ever and gives the owners a false "Refund stuck"; it is rare and no money can go out twice. Final group: Small.**

**S5. Razorpay's notice is answered only after the invoice PDF, its upload and the customer's notification are done.**
- *What happens:* Once the notices are moved to this server, a slow storage upload or push can make the answer late. Razorpay then counts the notice as failed, sends it again, and in the end can turn the notices off. The plan itself says to answer within 5 seconds (web-04 rule 11).
- *Why it matters:* The safety net that completes payments could be switched off by Razorpay. (Not live yet: the notices still go to the old server.)
- *Where:* `src/controllers/payments.controller.js:9-10` → `checkout.service.js:531-533`, `checkout.service.js:559-574`.

> **Second check: ✅ Correct.**

**S6. The old server still runs on the same database and can work against the new one.**
- *What happens, part (a):* The old server's notice handler marks any captured payment "paid" by the old rules. It doesn't check the amount, the hold, or a saree already sold at the counter. When live keys go in, the dashboard's notices still go to the old server unless the nginx step is done first.
- *What happens, part (b):* The old server's 15-second hold sweep and our 30-second sweep can release the same hold at the same moment. For sarees without tags, the stock count then goes up twice, so the website may offer a saree that isn't there. Our late-payment path can also take counted stock a second time for a hold the old sweep hadn't finished releasing.
- *Why it matters:* A saree sold twice, or wrong stock numbers. *Not sure* how often (b) happens: it needs both sweeps in the same split second.
- *Where:* old code `Nadam-Handloom/backend/src/modules/orders/orders.service.ts:180-225` and `Nadam-Handloom/backend/src/modules/inventory/inventory.service.ts:192-199`, `inventory.service.ts:758`; new code `checkout.service.js:66-74`, `checkout.service.js:489-503`.

> **Second check: ✅ Correct.**
> **Third check (second checker's extra notes): Real only if Razorpay's test-mode dashboard has a webhook to the old address with the same secret text as the old server's live one (unknown); certain from the day live keys go in unless the webhook is moved or the old server switched off first. Final: the old server then marks any captured payment paid by its old rules (even a cancelled order, no amount or stock check), and when it gets there first our server skips "Order confirmed", the new app's owners' alert and the bag clean-up (in a rare same-moment race it can even refund a payment the old server just marked paid), so this must be fixed before live keys. Final group: Should fix.**

**S7. Switching from test to live keys leaves traps.**
- *What happens:*
  - Whether an invoice is "TEST-" is decided by today's keys, not by the keys that took the payment. A test order whose invoice is made after the switch (the job retries for 30 days) gets a **real INV number**.
  - Test tries still "confirming" or "refund waiting" are then checked with the live keys. That gives errors and false "Refund stuck" alerts.
- *Why it matters:* Real GST invoice numbers used up by test money; alarms about refunds that don't exist.
- *Where:* `src/services/invoice.service.js:39`, `invoice.service.js:90`; `checkout.service.js:711`, `checkout.service.js:717`, `checkout.service.js:724-726`.

> **Second check: ✅ Correct.**

### Small

1. A "paid twice" refund notification says "We couldn't keep order NH…" though the order is kept and paid. `checkout.service.js:622-625`.
   > **Second check: ✅ Correct.**
2. When a second payment lands on a payment request that was already paid, its refund is not saved on any record (only in the audit log). If Razorpay's two notices for that payment both arrive, the second refund attempt fails and owners get a false "Refund stuck". `checkout.service.js:536-551`.
   > **Second check: ✅ Correct.**
3. The page and the background job can start the same refund at the same moment. Razorpay refuses the second, but an error can be left on a refunded try in Online payments. `checkout.service.js:602-619`, `checkout.model.js:79`.
   > **Second check: ✅ Correct.**
4. Refunds Razorpay keeps refusing are retried every 6 hours with no end. `checkout.service.js:600`, `checkout.service.js:610`.
   > **Second check: ✅ Correct.**
5. Pay again between minute 29 and 30 is refused with "your sarees were released" though they are still held. On the order page nothing is shown at all. `checkout.service.js:356`, `OrderPage.jsx:259`.
   > **Second check: ✅ Correct.**
6. "Nothing was charged" appears twice in one message when Razorpay can't be reached ("Payment didn't start. We couldn't open the payment just now. Nothing was charged… Nothing was charged."). `CheckoutPage.jsx:63` with `checkout.service.js:336`, `checkout.service.js:363`.
   > **Second check: ✅ Correct.**
7. The owners' alert and the customer's "Order confirmed" are lost if the server restarts at that moment (kept in memory only). `ownerAlerts.service.js:61-65`, `checkout.service.js:531-533`.
   > **Second check: ✅ Correct.**
8. The late-refund screen always says "a saree had sold at our store". It may have sold online, or be held by the customer's own newer checkout. `OrderPage.jsx:320-328`.
   > **Second check: ✅ Correct.**
9. The checkout says "The 15 minutes are over" for any checkout that ended, including one cancelled at the counter. `CheckoutPage.jsx:159`, `CheckoutPage.jsx:49`.
   > **Second check: ✅ Correct.**
10. The invoice catch-up takes 20 orders each minute in no set order, for 30 days only. A few that always fail can keep others waiting. `checkout.model.js:86-90`, `checkout.service.js:724-726`.
    > **Second check: ⚠️ Partly correct: 20 a minute, no `orderBy` and the 30-day cut-off are right, but "a few" failing orders can't block others: the rest still fit in the same 20 and are done in that run. It takes 20 or more always-failing orders to keep the others waiting.**
    > **Third check: Second checker right. Final: the invoice catch-up tries up to 20 orders a minute in no set order and stops after 30 days, so only 20 or more always-failing orders can keep the others waiting. Final group: Small.**
11. The customer waits for the invoice PDF and its upload before seeing "Order confirmed". `checkout.service.js:532`, `checkout.service.js:562`.
    > **Second check: ✅ Correct.**
12. A late payment on an older order cancels the customer's newer open checkout, even if it has different sarees. `checkout.service.js:518-523`.
    > **Second check: ✅ Correct.**
13. The database notes list the try statuses without "refund_due". `Nadam-backend/prisma/schema.prisma:622`.
    > **Second check: ✅ Correct.**

---

## 7. What I could not check

- **Razorpay's dashboard:**
  - Whether test mode has its own notice address, and whether it points at the old server.
  - Whether "customer pays the fee" (convenience fee) or offers are on. Either would make the paid amount differ from the order, and then **every** payment would be refunded.
  - The account's largest allowed payment.
- **The live server:** I did not open `.env` or log in. I don't know whether the notice secret is set, the exact payment flags, or whether the old server (`nandam-api`) is still running and sweeping (my notes say it shared the database on 18 Oct).
- **Real data:** how many test orders already exist, and how much stock has no tags (this decides how much S6(b) matters).
- **Razorpay's exact behaviour** was not tried:
  - how long a half-started UPI payment stays "created";
  - that a second full refund is refused;
  - the notice time limit.

  These are from Razorpay's documents and the project notes.
- **iPhone alerts to owners:** the notes say they need Apple's push key on the server. I didn't check whether it is set, so iPhone owners may get no payment alerts.
- **The admin app's screens:** only the server side was read.
- Nothing was run: no tests, no browser, no payments.

---

## 8. For the developer

Paths are from `Nadam-Handloom-production/` unless they start with `Nadam-Handloom/backend` (the old server). Backend = `Nadam-backend/`, web = `Nadam-frontend/customer-web/`.

**M1 — test payments are real sales**
- `checkout.service.js:459-529` `complete()` sells stock and moves the order to `processing` whatever `env.payments.mode` is.
- `afterPaid()` `checkout.service.js:559-574` sends the customer message and the owners' alert.
- `ensureInvoice` → `TEST-` (`invoice.service.js:39`, `invoice.service.js:90`), but:
  - `invoice.model.js:63-68` `forSummary` and `totals` don't exclude `TEST-`;
  - `stats.model.js:8` counts it as income;
  - `order.model.js:10` lists it in To ship;
  - `order.service.js:154`, `order.service.js:169` show it as "Paid online (Razorpay)".
- **Fix:** while `env.isProduction && env.payments.mode === 'test'`, don't take stock and don't move to `processing` (keep the order in a `test_paid` state and release the holds), or auto-cancel test orders after N minutes. Store the mode on `Payment` (e.g. `provider: 'razorpay_test'`). Exclude them from To ship, stats and invoice summaries. Prefix owner and customer messages with "TEST". Clean up October test orders before 1 Nov (`cancelBlock` NOT_THIS_MONTH at `order.service.js:142`).

**M2 — paying twice**
- `getOrder` (`checkout.service.js:385-391`) only reads the database.
- `attemptsToCheck` (`checkout.model.js:73-77`) first looks after 3 minutes, then every 5.
- `checkout()` (`checkout.service.js:289-297`) reuses or cancels an order with a `confirming` attempt; `payAgain` (`checkout.service.js:349-359`) doesn't look at attempts.
- **Fix:** in `getOrder` for a `pending_payment` order (and before `openPayment` in `checkout`/`payAgain`), call `gateway().orderPayments()` for its attempts from the last 30 minutes (throttled per order, e.g. once every 10 s) and `settle()` them. Refuse a new payment request with a new `PAYMENT_IN_PROGRESS` 409 while any attempt is `confirming`. On the web, hide or disable Pay when the 'earlier' notice says confirming (`CheckoutPage.jsx:55`, `CheckoutPage.jsx:420`).

**S1 — refund status never updates without notices**
- `refundNow` sets `refundStatus` from the immediate answer (`checkout.service.js:620`); only `handleWebhook` (`checkout.service.js:669-681`) moves it on. `handRefunds` (`checkout.model.js:44-51`) needs `refund.processed` events.
- **Fix:** in `checkPending`, poll `GET /payments/:id/refunds` (or `/refunds/:id`) for attempts with `status='refunded' AND refundStatus='pending'`, and for paid-then-cancelled orders, until processed or failed. Alert on failed.

**S2 — Razorpay "created" shown as confirming**
- `settle()` falls through to `status: 'created' → 'confirming'` for a Razorpay payment in `created` (`checkout.service.js:454`). `checkPending` picks `payments[0]` when nothing is captured or authorised (`checkout.service.js:718`).
- **Fix:** treat Razorpay `created` as "no change" (return `'pending'` and leave the attempt `created`/`failed`). Only move to `confirming` for `authorized` or after a valid verify.

**S3 — "Nothing was charged" stated too early**
- `customerStatus` returns `cancelled` for a cancelled order with a `confirming` attempt (`checkout.service.js:90-92`). `shownWhere` lists `confirming` only while `pending_payment` (`checkout.model.js:33`).
- **Fix:** return `confirming` for any non-paid order with a `confirming` attempt, and include it in `shownWhere`. Soften the copy at `OrderPage.jsx:312`, `OrderPage.jsx:342`, `orders/status.js:38`, `CheckoutPage.jsx:65`, `CheckoutPage.jsx:68` ("If money left your account, it is confirmed or returned automatically").

**S4 — refund accepted but answer missed**
- **Fix:** in `refundNow`'s catch (`checkout.service.js:608-618`) call `fetchPayment(att.razorpayPaymentId)`. If `amount_refunded >= amount` (or `refund_status` is `full`), read the refund id via `/payments/:id/refunds` and mark the attempt `refunded` instead of counting a refusal. Also cap retries (e.g. stop after 7 days and leave it stuck) at `checkout.service.js:600`, `checkout.service.js:610`.

**S5 — slow notice answer**
- `handleWebhook` → `settle` → `complete` → `await afterPaid()` (`checkout.service.js:531-533`, `checkout.service.js:559-574`).
- **Fix:** do the invoice, customer push and audit in the background (`setImmediate`; the invoice job already retries), and write `PaymentEvent` before the slow work so a resend is recognised.

**S6 — the old server on the same database**
- The old webhook finalises any captured payment by `Payment.razorpayOrderId` (`Nadam-Handloom/backend/src/modules/orders/orders.service.ts:210-225`; no amount, hold or stock checks, at `orders.service.ts:180-206`).
- The old sweep reads the reservation, then increments `Product.stock` without a condition (`Nadam-Handloom/backend/src/modules/inventory/inventory.service.ts:192-199`, every 15 s at `inventory.service.ts:758`).
- **Fix:** move the webhook (web-04 section 18, step 5) **before** putting in live keys, and stop `nandam-api` (or at least its sweep) as planned in 6.14 A.
- Also in `complete()`'s not-held branch (`checkout.service.js:489-503`), skip the stock decrement for items whose reservation is still `active` (convert those instead).

**S7 — test-to-live switch**
- **Fix:** decide TEST from the payment, not the current keys. Save `mode` on `Payment` or the attempt at `openPayment` (`checkout.service.js:231-236`) and use it in `testPaymentInvoice` (`invoice.service.js:39`).
- On the switch, mark old test attempts in `confirming`/`refund_due` as failed or done before restarting, so `checkPending` (`checkout.service.js:711`, `checkout.service.js:717`) doesn't call live Razorpay with test ids.

**Small fixes, one line each**
1. Use a different body for the "Paid twice" refund message (`checkout.service.js:622-625`): "A second payment for order … is being refunded".
2. Save the extra refund on a new attempt row (or `refundId` on a side table), and before refunding again check `fetchPayment(...).amount_refunded` (`checkout.service.js:536-551`).
3. Set `nextRefundAt` before calling Razorpay in the request path, or exclude `nextRefundAt IS NULL AND updatedAt > now-2min` from the job (`checkout.model.js:79`). Use `updateMany where status='refund_due'` in the catch (`checkout.service.js:612-615`).
4. Stop retrying refunds after a set age (`checkout.service.js:600`).
5. Make the 29-minute rule match `renewedUntil`, or answer a clear `HOLD_MAXED` message; show it on the order page (`checkout.service.js:356`, `OrderPage.jsx:259`).
6. Drop "Nothing was charged." from the server message or from the `error` notice (`CheckoutPage.jsx:63`).
7. Put owner alerts in a table (the unused `EventsOutbox`) instead of the in-memory chain (`ownerAlerts.service.js:61-65`).
8. Word the late-refund text from the reason without naming the store (`OrderPage.jsx:327`).
9. In `settleOpen`, use `{ kind: 'expired' }` only for `hold_ended`; add a `cancelled` notice (`CheckoutPage.jsx:159`).
10. Add `orderBy: placedAt asc` and skip orders that failed recently in `paidWithoutInvoice` (`checkout.model.js:86-90`).
11. Make the invoice after answering in `verify` (same change as S5) (`checkout.service.js:562`).
12. In `complete()`, cancel only other checkouts that hold some of the same products (`checkout.service.js:520-523`).
13. Update the status comment at `prisma/schema.prisma:622` (add `refund_due`).

**Checked and fine:**
- The signature is checked against the stored request id, in constant time (`signature.js:8-18`, `checkout.service.js:400`).
- The amount, currency and request are checked on Razorpay's own record before any status counts (`checkout.service.js:420-427`).
- One change at a time per order (`checkout.model.js:8`); repeated notices are skipped (`checkout.service.js:658-659`).
- A failed try never overwrites a confirming one (`checkout.service.js:446`).
- The late-payment stock re-claim is conditional (`checkout.service.js:479-501`).
- The fake payment provider is refused in production (`env.js:148-150`; `app.js:25`).
- Test keys in production need two flags on purpose (`env.js:151-160`).
- Verify works even when payments are switched off.
- The receipt fields the web sends match the validator (`usePayment.js:49`, `checkout.validators.js:19-23`). The Razorpay options match the server's answer (`razorpay.js:47-70`, `checkout.service.js:244-256`).

---

## Second check (26 Oct 2026)

Every finding in "Problems found" (2 Must, 7 Should, 13 Small) was checked against the code.

**✅ 17 · ⚠️ 5 · ❌ 0**

- ✅ Correct: M1, S2, S5, S6, S7, Small 1–9, 11–13.
- ⚠️ Partly correct: M2 (timing; no real money while on test keys), S1 (refunds first answered "processed" do show as refunded), S3 (timing; a cancelled order may be revived, not refunded), S4 (rare, false alarm only: Small, not Should), Small 10 (it takes 20+ failing orders to block others).

Details and evidence: [checks/09-payments-check.md](checks/09-payments-check.md).

## Third check (26 Oct 2026)

Only the 5 findings marked ⚠️ and the second checker's extra notes on S6 were checked again, against the code (new server, website and the old server).

- **Second checker right: 5** (M2, S1, S3, S4, Small 10)
- **First reviewer right: 0**
- **Both partly right: 0**
- **Neither right: 0**
- **S6 extra notes: Real only if …** a Razorpay test-mode webhook points at the old address with the same secret text (unknown today). It becomes certain from the day live keys go in, unless the webhook is moved or the old server switched off first.

Group changes: only S4 (Should → Small). The rest keep their group.

Details and evidence: [checks/09-payments-third-check.md](checks/09-payments-third-check.md).

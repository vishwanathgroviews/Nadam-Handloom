# Module 10: Orders (My orders), review

| | |
|---|---|
| **Date** | 26 Oct 2026 |
| **How** | Read the code only. Nothing was run, changed, built or tested. No live server or database was touched. |
| **Server code** | `Nadam-backend/` (`src/routes/shop/index.js`, `controllers/shop/checkout.controller.js`, `services/shop/orders.service.js`, `orderNotices.service.js`, `checkout.service.js`, `services/order.service.js`, `invoice.service.js`, `invoicePdf.service.js`, `models/checkout.model.js`, `order.model.js`, `invoice.model.js`, `services/shop/bag.service.js`, `prisma/schema.prisma`) |
| **Website code** | `Nadam-frontend/customer-web/` (`pages/orders/`, `orders/`, `components/OrderNotice.jsx`, `pages/account/OverviewPage.jsx`, `App.jsx`, `bag/store.js`, `api/`) |
| **Design notes used** | `docs/modules/web-05-my-orders.md`, `docs/modules/web-04-checkout.md` (sections 16 to 21) |

**Short answer:** this module is in good shape. Nobody can see another customer's order or invoice. Amounts, dates (India time) and statuses match between the server and the website. I found **no "Must fix" problem**. I found **5 "Should fix" problems**. They are all about refunds and cancelling, where the order page can say the wrong thing about money or stay on "Being packed". There is also a list of small polish items.

---

## 1. What this module does

After a customer pays on the website, they can always find their order again. They see a list of their orders and one page per order. Each order shows where it is (being packed, shipped, delivered), the DTDC tracking number, a GST invoice to download, and a "Buy again" button. When the shop marks an order shipped or delivered in the admin app, the customer gets a notification on their phone or computer.

---

## 2. The steps a customer goes through

1. **Pays at checkout.** The website opens the "Thank you" page for that order (`/order/NH12345678`).
2. **Paid but the page closed** (for example the phone switched to the UPI app and never came back). Later, a strip at the top of any page says "Your order NH… is confirmed and paid: ₹X · See the order". It shows once per order and per state. It never shows on the checkout or on the order page itself.
3. **My account → My orders** (`/account/orders`). Cards, newest first, 20 at a time, then "Show more". The overview page of My account also shows the latest order.
4. **Opens one order.** It shows:
   - the status and a progress line (Paid → Packed → Shipped → Delivered);
   - the tracking card (courier, number, Copy, "Track on DTDC");
   - Download invoice, Buy again, Help on WhatsApp;
   - while it is being packed: "Need to cancel or change something? WhatsApp us";
   - the sarees, the delivery address saved with the order, and the payment.
5. **Downloads the invoice.** The browser saves a PDF named like `INV-000123.pdf`.
6. **Presses Buy again.** The sarees go back into the bag, at today's price. A message says which ones have sold, and the bag panel opens.
7. **Opens an old link from the old website** (`/account/orders/<id>` or `/order-confirmation/<id>`). It goes to My orders.

**What the shop does in the admin app, and what the customer then sees**

| The shop does | The customer sees |
|---|---|
| **Ship** (scan the DTDC label) | Status "Shipped", the tracking card, and a notification: "Your order has shipped · NH… is on its way with DTDC. Tracking number …" |
| **Change the tracking number** (a wrong label) | The order page shows the new number. **No new notification** (see Small item 2). |
| **Mark delivered** | "Delivered" with the date, and a notification: "Your order was delivered · We hope you love it." |
| **Cancel** (owners only, before shipping, only in the same calendar month as the order) | "Cancelled · refund on its way". The sarees go back on sale. The invoice gets a CANCELLED stamp. **No notification** (see Should fix 4). The shop's reason is not shown to the customer. |
| **Refund in the Razorpay dashboard** (the admin app never moves money) | When Razorpay tells our server, the page says "Cancelled by the shop: your ₹X was refunded" with the date. **This only works if the order was cancelled in the admin app first** (see Should fix 1 and 2). |

---

## 3. Each API

(An API is a "door" the website uses to ask the server for something.)

**Rules that apply to all four:**
- The customer must be signed in. If not, the website opens the sign-in page and then comes back.
- Only the customer's own **website** orders are used. Counter and WhatsApp bills never show.
- Another person's order number gets exactly the same answer as a wrong number: "We couldn't find this order". So a stranger can't even learn that an order number exists.
- If the shop has switched the website off, every call answers `MAINTENANCE` and the website shows the maintenance page.
- A server fault answers "Something went wrong on our side. Please try again."

### 3.1 `GET /api/v2/shop/orders?offset=` (the My orders list)

| | |
|---|---|
| **What it is for** | The customer's orders, 20 at a time, newest first. |
| **What goes in** | `offset`: where the next page starts. A whole number from 0 to 10,000; 0 if left out. Nothing else is sent. |
| **Which orders are listed** | Paid orders (being packed, shipped, delivered, cancelled by the shop after paying), refunded orders, orders whose payment is being confirmed with the bank, and a checkout still waiting for payment while its sarees are held. **Never** a checkout that ended without paying. |
| **What comes back** | `orders`, and `nextOffset` (empty when there are no more). Each order has: number, status, date placed, total (whole rupees), pieces, how many different sarees, the first saree's name, up to 4 photos plus "+N more", hold time (if waiting), paid time and method (UPI, Card…), refund (amount, state, reason), cancelled (when, and when the refund went through), shipping (courier, tracking number, shipped and delivered dates, DTDC link), invoice (number, ready or not, cancelled or not), whether Buy again is offered, and whether it came from the old website. |
| **What is saved** | Nothing, except one row for the "too many requests" counter. |
| **What can go wrong** | Signed out (401): sign-in page, then back. Bad `offset` (400): the website never sends one. More than 120 asks a minute (429): "Your orders didn't load. Too many requests from this network…". Offline, slow or server error: "Your orders didn't load" with **Try again**. It never says "No orders yet" by mistake. |

### 3.2 `GET /api/v2/shop/orders/:number` (one order)

| | |
|---|---|
| **What it is for** | Everything the order page shows. |
| **What goes in** | The order number: `NH` followed by exactly 8 digits. |
| **What comes back** | `order` with: number, status, date placed, total, pieces; the sarees (name, code, photo, price, pieces, line total); the **address copied onto the order** when it was paid (name, mobile, house, area, landmark, city, state, pincode), never the saved address, which can change later; hold time and "can pay" (only while waiting for payment); payment (method, "UPI", paid time; only if paid); refund; cancelled; invoice (number, ready, cancelled; only if paid); shipping (only once shipped); Buy again offered or not; old website or not. |
| **Never sent** | Payment signatures, Razorpay ids, storage file names, the invoice's stored web address, internal ids, the shop's own cancel note. |
| **What is saved** | Nothing. |
| **What can go wrong** | A badly typed number (400): the website catches this itself and shows "We couldn't find this order". Not theirs, or not found (404 `ORDER_NOT_FOUND`): "We couldn't find this order. Check the link, or sign in with the mobile number you ordered with." with My orders and Continue shopping. Network or server problem: "Your order didn't load" with Try again. If the order was already on screen, it stays on screen. |

### 3.3 `GET /api/v2/shop/orders/:number/invoice` (download the invoice)

| | |
|---|---|
| **What it is for** | The GST invoice PDF, only for the customer whose order it is. |
| **What goes in** | The order number. |
| **What comes back** | The PDF file, named `INV-000123.pdf` (or `TEST-000001.pdf` for test payments). No browser or proxy is allowed to keep a copy. The server reads the stored PDF. If it can't be read, the same invoice is drawn again from the records. A cancelled order always gets the copy stamped CANCELLED. |
| **What is saved** | One line in the activity log ("invoice downloaded"). |
| **What can go wrong** | Not theirs or not found (404): "We couldn't find this order." Never paid (404 `NO_INVOICE`): "This order has no invoice: it wasn't paid." The website never offers the button then. Not made yet (409 `INVOICE_NOT_READY`): a blue message, "Your invoice is being made. Check back in a few minutes." More than 30 a minute (429). Slow: the website waits up to 60 seconds, then says "This is taking too long. Please try again." While it waits, the button shows that it is busy. |

### 3.4 `POST /api/v2/shop/orders/:number/buy-again`

| | |
|---|---|
| **What it is for** | Put an order's sarees back into the customer's bag. |
| **What goes in** | The order number only. |
| **Rules** | The bag's own rules apply. Only sarees still on the website and in stock are added, never more pieces than are in stock, and at most 20 different sarees in the bag. The price is today's price. A saree already in the bag keeps the larger number of pieces. Buy again is **not** offered while the order is still waiting for payment. |
| **What comes back** | The whole bag, plus lists of what was added, raised, already there, and skipped (by name, with the reason: sold out, no longer on the website, or bag full). |
| **What is saved** | Bag rows (added or raised), and one activity-log line. |
| **What can go wrong** | Not found (404). Waiting for payment (409 `CANT_BUY_AGAIN`): "This order is waiting for payment: pay for it, or change your bag." Too many bag actions in a minute (429; this limit is shared with the bag). |
| **What the customer reads** | For example: "2 sarees added to your bag. Kanchi Pattu has sold since." with an "Ask on WhatsApp" button. Or "None of these sarees can be bought now." Or "1 didn't fit: your bag is full (20 sarees)." |

### 3.5 The shop's side (admin app, `services/order.service.js`), as the customer sees it

| Action | Rule | Customer effect |
|---|---|---|
| Ship | Only a paid website order that is being packed. Tracking number: 8 to 20 letters or digits, and used on one order only. | Shipped, tracking card, one notification. |
| Change tracking | Only while shipped. | The new number shows. No notification. |
| Mark delivered | Only after shipped. It can't be undone. | Delivered with the date, one notification. |
| Cancel | Owners only, before shipping, **same month as the order only**. | "Cancelled · refund on its way". No notification. |

---

## 4. The data kept

### 4.1 Tables and fields (only what this module uses)

**Order**: one per sale (website, counter, WhatsApp).

| Field | What it means | Must have it? |
|---|---|---|
| orderNumber | "NH" + 8 digits. No two orders share one. | Yes |
| authAccountId | The customer's account. This is how "only their own orders" is checked. | Website orders: yes |
| channel | `online` (website), `store` (counter), `whatsapp`. Only `online` shows here. | Yes (default online) |
| status | See the list in 4.2. | Yes |
| subtotal, total | Rupees with paise. The website shows whole rupees. No delivery fee is ever added. | Yes |
| shippingAddress | **A copy of the delivery address** made when the order was placed: name, mobile, house, area, landmark, city, state, pincode, country. Editing a saved address later never changes it. | Yes |
| addressId | The saved address it came from. It is emptied if that address is deleted. | No |
| paymentMethod | upi, card, netbanking… | No |
| cancelledAt, cancelledById, cancelReason | When and who cancelled, and why. The reason is the shop's note, not shown to the customer. | No |
| placedAt | When the order was made (stored in world time, UTC; shown in India time). | Yes (automatic) |

**OrderItem**: one per saree line.

| Field | What it means | Must have it? |
|---|---|---|
| productId | The saree design. Lines of the same design are shown as one line with the pieces added up. | Yes |
| pieceId | The exact tagged piece, if the saree is tracked piece by piece. | No |
| nameSnapshot, priceSnapshot | Name and price **at the time of sale**. A later price change never changes old orders. | Yes |
| imageSnapshot | The photo's web address at the time of sale. | No |
| quantity, lineNo | Pieces, and the line's place on the bill. | Pieces: yes |

**Payment**: one per order, the payment that counted.

| Field | What it means | Must have it? |
|---|---|---|
| status | `created`, `paid`, `failed`. Only `paid` shows the payment and invoice. | Yes |
| amount, method, capturedAt | How much, how paid, and when Razorpay took the money. | Amount: yes |
| razorpayOrderId, razorpayPaymentId, razorpaySignature | Razorpay's references. **Never sent to the website.** | Order id: yes |

**PaymentAttempt**: one per press of "Pay" (website W6).

| Field | What it means | Must have it? |
|---|---|---|
| status | `created`, `confirming` (the bank is slow), `paid`, `failed`, `refund_due` (to refund), `refunded` | Yes |
| amount | The amount asked for. | Yes |
| refundStatus, refundReason, refundedAt | The refund's state (`pending`, `processed`, `failed`), why, and when. Shown to the customer as "being refunded" or "refunded". | No |
| refundTries, nextRefundAt, refundError, alertedAt | Retries when Razorpay refuses a refund; the owners are told after 3 refusals. | No |

**PaymentEvent**: each message Razorpay sends to our server (a "webhook"), kept once. This module reads only one thing from it: **when a refund the owners made by hand went through**. It stores the type, the payment id and the time. **It does not store the amount** (see Should fix 2).

**Shipment**: one per order.

| Field | What it means | Must have it? |
|---|---|---|
| carrier | Courier name, "DTDC" by default | Yes |
| awbNumber | Tracking number | No |
| status | `not_shipped`, `shipped`, `delivered` | Yes |
| shippedAt, shippedById, deliveredAt, deliveredById | When, and who | No |

**Invoice**: one per order, never re-numbered.

| Field | What it means | Must have it? |
|---|---|---|
| invoiceNumber | `INV-000123` (or `TEST-000001` for test money). Unique. | Yes |
| storageKey, url | Where the PDF is kept. **Never sent to the website.** | Yes |
| totals, GST split, place of supply | Stored once, when the invoice is made | Yes |
| cancelledAt | Set when the order is cancelled; the PDF then carries a stamp | No |

**Reservation** (the 15-minute hold while paying): status `active`, `converted` (sold), `released`, `expired`, plus the time it ends.

**BagItem** (Buy again writes here): the customer, the saree, the pieces, and the price they saw.

**Notification**: a log of every notice sent to a customer (type, title, text, link, sent or not).

### 4.2 The statuses

**Order status in the database:** `pending_payment` (checkout, not paid), `processing` (paid, to ship), `shipped`, `delivered`, `cancelled`. The old app also used `active`, `paid` and `payment_failed`.

**What the customer sees** (the server works this out from the order, the payment and the holds):

| Shown status | When | What the page says |
|---|---|---|
| Waiting for payment | Not paid; sarees still held | "Held for you until 4:35 pm", Pay, Change my bag |
| Confirming payment | Paid in the window; the bank is slow | "Payment received, confirming with your bank"; the page checks again by itself |
| Being packed | Paid, not shipped yet | "We pack within 2 working days" |
| Shipped | The shop shipped it | Date, courier, tracking number, Copy, Track on DTDC |
| Delivered | The shop marked it delivered | Delivered date |
| Refunded | The payment came after the sarees sold, or did not match | Why, how much, "5 to 7 working days" |
| Cancelled · refund on its way / refunded | The shop cancelled after payment | The amount, and the refund date once Razorpay confirms it |
| (Checkout ended / cancelled) | Never paid | "Nothing was charged". Never listed in My orders. |

**Shipment status:** `not_shipped`, `shipped`, `delivered`. The website follows the order's status, not this one.

---

## 5. On the website

**My orders** (`/account/orders`, a tab in My account)
- Loading: three grey placeholder cards.
- Couldn't load: "Your orders didn't load" with Try again. Never "No orders yet".
- No orders: "No orders yet" with New in and All collections.
- Each card shows:
  - the order number, date and time (India time), and "Our old website" if it came from there;
  - a coloured status badge;
  - up to 4 photos plus "+N". A broken photo turns into a plain tile;
  - "Kanchi Pattu and 2 more", the pieces, the method, and the amount ("Paid", "To pay", "Being refunded"…);
  - a one-line "what's next".
- Buttons on a card: View order, Pay now (only while waiting), Track (only when shipped), Invoice (only while being packed, shipped or delivered), Buy again.
- More than 20 orders: Show more. The focus moves to the first new card. A failed Show more gives a red message.

**One order** (`/order/NH…`)
- **Right after paying** (and from the "confirmed" strip): the "Thank you, Priya" page, with the order number, what happens next, a My orders link, and the sarees, address, payment and invoice link below.
- **Any other visit:**
  - the number, date and status badge;
  - the progress line (only while being packed, shipped or delivered);
  - the tracking card;
  - Download invoice, Buy again, Help on WhatsApp;
  - "Need to cancel or change something? WhatsApp us" (only while being packed or waiting);
  - the sarees with the GST line, the address ("Delivering to", "Delivered to" or "Delivery address"), and the payment.
- Invoice not made yet: "Your GST invoice is being made. It will be here in a few minutes." No button shows.
- Waiting for payment: "Your sarees are held for you until 4:35 pm" with Pay ₹X and Change my bag. When the hold ends while the page is open, the page updates by itself.
- Confirming with the bank: it asks again every 4 seconds for a minute, then every 15 seconds. There is also a "Check again" button.
- Refunded: "We couldn't keep your order", why, the amount, 5 to 7 working days, and "Ask us for a similar saree".
- Cancelled by the shop: "Cancelled by the shop: ₹X is being refunded", or "…was refunded" with the date, and "Ask about it".
- A checkout that ended: "The 15 minutes are over" or "This checkout was cancelled. Nothing was charged."
- Not theirs or a wrong number: "We couldn't find this order".
- Didn't load: "Your order didn't load" with Try again.

**Download invoice:** the button shows that it is busy. On success: "Invoice INV-000123 downloaded". Not ready yet: a blue message. Other problems: a red message.

**Tracking card:** "Shipped 20 Oct 2026 · DTDC tracking number", the number in large type, Copy ("Tracking number … copied", or "Couldn't copy. Select the number and copy it instead."), and "Track on DTDC". DTDC has no link for each number, so its page opens and the customer pastes the number. With another courier, there is no link, only the number.

**"Your order is confirmed" strip:** only for an order from the last 3 days that is paid, being confirmed or refunded, and not yet seen in this browser. It never shows on the checkout or order pages. Opening the order or closing the strip hides it for that state.

**My account overview:** "Your latest order" with its status and a View order or Pay now button, a "My orders" tile, and "All my orders (N)".

**Old links:** `/account/orders/<id>` and `/order-confirmation/<id>` open My orders (after sign-in if needed).

---

## 6. Problems found

### Must fix
**None found.**
- I found no way to see another customer's order or invoice.
- I found no way to charge the wrong amount, lose an order or sell stock twice through this module.
- I found no way for a customer to get stuck.

### Should fix

1. **A paid website order that can't be cancelled in the admin app stays "Being packed" for ever, even after the money is returned.**
   - The admin app allows cancelling only in the **same calendar month** as the order.
   - Example: an order paid on 30 October that the shop can't send, and wants to cancel on 2 November. The shop refunds it by hand in Razorpay. The customer's page keeps saying "Being packed · We pack within 2 working days". The order also stays in the admin's To ship list.
   - The same happens if the owner refunds in Razorpay but forgets to cancel in the admin app.
   - Why it matters: the customer sees a promise the shop won't keep, and money returned with no word on the page.
   - Where: `Nadam-backend/src/services/order.service.js:142`, `:277`, and `Nadam-backend/src/services/shop/checkout.service.js:83`, where a hand refund is only looked at for cancelled orders (`:389`).
   > **Second check: ✅ Correct.**

2. **After the shop cancels, the page says the full order amount was refunded, even if the owner refunded less, or refunded part of it earlier.**
   - The server only knows "a refund went through on this payment". It does not know how much.
   - Example: the owner refunds ₹12,000 of a ₹12,400 order. The page says "your ₹12,400 was refunded on 2 Nov".
   - Why it matters: a wrong money statement to the customer can start a dispute.
   - Where: `Nadam-backend/src/models/checkout.model.js:44-51`, `Nadam-backend/src/services/shop/checkout.service.js:683` (the amount is not kept), `Nadam-frontend/customer-web/src/orders/status.js:36`, `Nadam-frontend/customer-web/src/pages/orders/OrderPage.jsx:126-128`.
   > **Second check: ⚠️ Partly correct: the code reasoning is right, but on live today it can't happen, because Razorpay's notices go to the old server, so no refund is ever recorded here and the page always says "being refunded", even after a full hand refund. The wrong amount would show only once the webhook is moved to this server; Should is still the right group.**
   > **Third check: Second checker right. Final: the server never stores how much was refunded, so once Razorpay's refund notices reach it a shop-cancelled order will say its full total was refunded even after a part refund; today (no webhook secret on this server, the old address still goes to the old server) no refund is ever recorded and the page says "being refunded" for ever. Final group: Should fix.**

3. **A refund that got stuck and was then done by hand still shows "being refunded" for ever.**
   - This is for an automatic refund (a payment that came after the saree sold) that Razorpay refused, or later said failed. The owners are told to refund it by hand in the dashboard.
   - When they do, our server does not recognise that refund as belonging to this order.
   - So the customer's page keeps saying "₹X is being refunded (5 to 7 working days)". The server also keeps trying to refund it again every 6 hours, for ever. Razorpay refuses each try, so no money moves twice. But Online payments keeps showing "Refund stuck".
   - Where: `Nadam-backend/src/services/shop/checkout.service.js:671-675` (matched only by the refund id our server started), `:602-618` (endless retries), `Nadam-frontend/customer-web/src/orders/status.js:33`.
   > **Second check: ✅ Correct.**

4. **No notification when the shop cancels a paid order.**
   - Shipped and delivered each send a notification. A cancel, which is the one that involves the customer's money, sends nothing.
   - The customer only finds out by opening the website, or if the shop remembers to WhatsApp them.
   - Where: `Nadam-backend/src/services/order.service.js:271-305` (no notice), `Nadam-backend/src/services/shop/orderNotices.service.js:9-22` (only shipped and delivered exist).
   > **Second check: ✅ Correct.**

5. **The "Thank you" page comes back days later if the browser reloads that tab. It then hides the tracking card and Buy again.**
   - "Just paid" is remembered in the browser tab's history, and a reload keeps it. Phones often reload old tabs when you return to them.
   - Example: a customer pays and leaves the tab open. Five days later they open it. They see "Thank you, Priya" again instead of the order page with "Track on DTDC", Copy and Buy again.
   - Where: `Nadam-frontend/customer-web/src/pages/orders/OrderPage.jsx:176`, `:210`, `Nadam-frontend/customer-web/src/pages/checkout/usePayment.js:59`.
   > **Second check: ⚠️ Partly correct: the cause is right (the "just paid" mark survives a reload and nothing clears it), but it belongs in Small, not Should. The "Thank you" view still shows "Order shipped/delivered", the tracking number in its steps and a My orders button; only Copy, Track on DTDC, the progress card and Buy again are missing.**
   > **Third check: Second checker right. Final: reloading or reopening the tab used to pay shows "Thank you" again, even days later, with the right status, tracking number and invoice link but without the tracking card, progress card or Buy again. Final group: Small.**

### Small

1. **Invoice "being made" for ever.** If the shop cancels a paid order before its invoice was made (rare: only if storage was failing), the invoice is never made. The page says "being made… a few minutes" for ever. Where: `Nadam-backend/src/models/checkout.model.js:87` (cancelled orders skipped), `Nadam-frontend/customer-web/src/pages/orders/OrderPage.jsx:71`.
   > **Second check: ✅ Correct.**
2. **A corrected tracking number sends no new notification.** The first notification still shows the wrong number. Where: `Nadam-backend/src/services/order.service.js:236-250`.
   > **Second check: ✅ Correct.**
3. **The "Thank you" steps always say "Shipped by DTDC"**, even when the shop typed another courier. Where: `Nadam-frontend/customer-web/src/pages/orders/OrderPage.jsx:48`.
   > **Second check: ✅ Correct.**
4. **Old-website orders read "Paid ₹X by Online (Razorpay)".** The old site didn't record the method. For the same reason, their "paid" time is the payment record's last-change time, not the payment time. Where: `Nadam-backend/src/services/shop/checkout.service.js:128`, `Nadam-frontend/customer-web/src/pages/orders/OrderPage.jsx:68`.
   > **Second check: ✅ Correct.**
5. **The GST line on the order page uses today's settings, not the invoice's.** If the IGST switch or the GST rate changes later, old orders' pages can disagree with their invoice. Where: `Nadam-frontend/customer-web/src/pages/orders/OrderPage.jsx:84`.
   > **Second check: ✅ Correct.**
6. **A refunded second payment is mentioned only on the "Thank you" page.** On later visits the order page and its card never mention it. Where: `Nadam-frontend/customer-web/src/pages/orders/OrderPage.jsx:286`, `:61-74`.
   > **Second check: ✅ Correct.**
7. **Different buttons on the card and the page.** A cancelled-by-shop order's card has no Invoice button, but its page has "Download invoice". Where: `Nadam-frontend/customer-web/src/orders/parts.jsx:59`.
   > **Second check: ✅ Correct.**
8. **"Too many requests from this network"** is shown although these limits count per customer, not per network. Where: `Nadam-backend/src/middlewares/rateLimit.js:26`.
   > **Second check: ✅ Correct.**
9. **The offline message ends "What you typed is kept."** That makes no sense on the orders pages. Where: `Nadam-frontend/customer-web/src/api/errors.js:35`.
   > **Second check: ✅ Correct.**
10. **"We pack within 2 working days" stays** on an order that is still unshipped after 10 days. Where: `Nadam-frontend/customer-web/src/orders/status.js:28`.
   > **Second check: ✅ Correct.**
11. **The fallback text for a status the website doesn't know says "Not paid. Nothing was charged."** This is safe today: the server never sends such a status. But a future status (for example "returned") would get a wrong money line. Where: `Nadam-frontend/customer-web/src/orders/status.js:38`.
   > **Second check: ✅ Correct.**
12. **Show more can skip or repeat one order** if a new order arrives while a customer with more than 20 orders is browsing. Pages are counted by position. Where: `Nadam-backend/src/services/shop/orders.service.js:48-57`, `Nadam-frontend/customer-web/src/orders/useMyOrders.js:24`, `:31`.
   > **Second check: ✅ Correct.**
13. **Shipped and delivered notices wait in the server's memory for a moment.** A server restart at that moment loses them. A failed send is not tried again. Where: `Nadam-backend/src/services/shop/orderNotices.service.js:24-31`.
   > **Second check: ✅ Correct.**
14. **A "Waiting for payment" card does not change when its hold ends** while My orders is open. Pay now then leads to "The 15 minutes are over". Where: `Nadam-frontend/customer-web/src/pages/orders/MyOrdersPage.jsx` (no timer), `Nadam-frontend/customer-web/src/orders/status.js:26`.
   > **Second check: ✅ Correct.**
15. **"Delivered" can't be undone in the admin app.** A wrong tap sends the customer "We hope you love it". Where: `Nadam-backend/src/services/order.service.js:253-267`.
   > **Second check: ⚠️ Partly correct: there is no undo, but one wrong tap can't do it, because the admin app first asks "Mark NH… delivered?" with a separate confirm button (`Nadam-frontend/admin-app/src/app/(app)/orders/order/[id].js:93-99`). Stays Small.**
   > **Third check: Second checker right. Final: a mistaken "Delivered" can't be undone (nor its tracking number changed) and the customer gets "We hope you love it", but it takes a tap plus a confirm, so it is rare. Final group: Small.**
16. **Not sure: invoice download inside in-app browsers.** In Instagram or Facebook's built-in browser, a download made this way often does nothing, but the website still says "Invoice … downloaded". I could not test it. Where: `Nadam-frontend/customer-web/src/orders/invoice.js:5-17`, `Nadam-frontend/customer-web/src/orders/actions.js:38`.
   > **Second check: ✅ Correct.**
17. **An order number typed in small letters** (`/order/nh12345678`) says "We couldn't find this order". Where: `Nadam-frontend/customer-web/src/pages/orders/OrderPage.jsx:177`.
   > **Second check: ✅ Correct.**

---

## 7. What I could not check (and why)

- **Whether W6 and W7 are live now.** The design notes (17 and 18 Oct) say "built and tested, local only, live on the user's go". I did not look at the live server.
- **Live data:** how many real orders, refunds or old invoices there are. I was not allowed to touch databases.
- **Razorpay's webhook settings:** whether "refund.processed" is switched on in the live dashboard. Hand refunds show on the order page only if it is.
- **Amazon S3 (where files are stored):** whether the server's key may *read* invoice files, and whether the `invoices/` folder is public. If reading is refused, customers still get an invoice (drawn again from the records), but it is a re-drawn copy. Old invoice PDFs from the old website had public web addresses. The website never shows them, but they may still open for anyone who has the link.
- **Real phones and in-app browsers** for the invoice download and Copy. I ran nothing.
- **Firebase delivery** of the notifications (the design notes say it was tested on 17 Oct).
- **The admin app's screens.** I read only the server side of ship, deliver and cancel.
- **The tests.** The server has 20 tests for this module (`tests/api/shop/orders.test.js`) and the website has page tests, but I did not run them.

---

## 8. For the developer

| # | Finding | Where | Suggested fix (one line) |
|---|---|---|---|
| S1 | Paid online order can't be cancelled after its month (`NOT_THIS_MONTH`); a hand refund on a `processing` order is invisible; stays "Being packed" | `src/services/order.service.js:142`, `:277`; `src/services/shop/checkout.service.js:83`, `:389` | Allow owners to cancel **online** orders in a later month (invoice stamped, a credit note in the summary), or let `customerStatus` show `refunded_by_shop` when a `refund.processed` exists for the paid payment of a `processing` order. |
| S2 | Hand refund shown as `rs(order.total)`; any `refund.processed` (partial, or before the cancel) counts | `src/models/checkout.model.js:44-51`; `src/services/shop/checkout.service.js:683`; `customer-web/src/orders/status.js:36`; `customer-web/src/pages/orders/OrderPage.jsx:126-128` | Add `amount` (and `refundId`) to `PaymentEvent`; sum processed refunds received after `cancelledAt`; show that sum, and "₹X of ₹Y refunded" when partial. |
| S3 | `refund_due` or failed automatic refund done by hand in the dashboard: webhook matches only `refundId`, so the attempt stays `refund_due` (retried every 6 h) or `refundStatus: failed`; the customer sees "being refunded" for ever | `src/services/shop/checkout.service.js:671-675`, `:602-618`; `customer-web/src/orders/status.js:33` | When `r.count === 0`, also match `paymentAttempt { razorpayPaymentId: refund.payment_id, status in [refund_due, refunded] }` and mark it `refunded` / `processed` with `nextRefundAt = null`. |
| S4 | No customer notice on a shop cancel | `src/services/order.service.js:271-305`; `src/services/shop/orderNotices.service.js:9-22` | Add `noticeFor.cancelled` ("Your order NH… was cancelled. ₹X is being refunded to the same account") and call `tellCustomer` after the cancel transaction for `channel === 'online'`. |
| S5 | `state.paid` persists in `history.state`, so reloading or reopening the tab shows the "Thank you" hero for shipped or delivered orders without Tracking or Buy again | `customer-web/src/pages/orders/OrderPage.jsx:176`, `:210`; `customer-web/src/pages/checkout/usePayment.js:59` | After the first successful load, `navigate(pathname, { replace: true, state: null })`, or pass `paidAt` and honour it only for about 30 minutes. |
| s1 | `paidWithoutInvoice` skips `cancelled` orders, so a paid order cancelled before its invoice was made never gets one | `src/models/checkout.model.js:87`; `src/services/shop/orders.service.js:65` | Include `status: 'cancelled'` with `payment.status = 'paid'` (`ensureInvoice` already stamps when `cancelledAt` is set). |
| s2 | `changeTracking` sends no notice | `src/services/order.service.js:236-250` | `tellCustomer(order, noticeFor.shipped(order, t))` with "Tracking number updated" wording. |
| s3 | "Shipped by DTDC" hard-coded | `customer-web/src/pages/orders/OrderPage.jsx:48` | Use `order.shipping?.carrier \|\| 'DTDC'`. |
| s4 | `methodText` falls back to "Online": "by Online (Razorpay)"; `paidAt` falls back to `payment.updatedAt` | `src/services/shop/checkout.service.js:128`; `customer-web/src/pages/orders/OrderPage.jsx:68` | Word the fallback as "Paid ₹X online (Razorpay)"; for old orders prefer the `order_paid` audit time or `placedAt`. |
| s5 | GST note from `config.gst`, not the invoice | `customer-web/src/pages/orders/OrderPage.jsx:84` | Send `invoice.igst` / `ratePercent` with the order and use it when present. |
| s6 | Second-payment refund only in the hero | `customer-web/src/pages/orders/OrderPage.jsx:286`, `:61-74` | Show `order.refund` in `PaymentPart` when `status` is `paid`, `shipped` or `delivered`. |
| s7 | Card hides Invoice for `cancelled_paid` | `customer-web/src/orders/parts.jsx:59` | Use `o.invoice?.ready` alone (as the page does). |
| s8 | Per-account limit says "from this network" | `src/middlewares/rateLimit.js:26` | Use a different message when `by` is set ("Too many tries. Please wait a minute."). |
| s9 | Offline text "What you typed is kept." | `customer-web/src/api/errors.js:35` | Drop that sentence, or add it only on form pages. |
| s10 | "We pack within 2 working days" never changes | `customer-web/src/orders/status.js:28` | After 3 days, say "Being packed. Questions? WhatsApp us." |
| s11 | Unknown-status fallback claims "Nothing was charged" | `customer-web/src/orders/status.js:38` | Neutral fallback: "See the order for details." |
| s12 | Offset paging can skip or repeat across a new order | `src/services/shop/orders.service.js:48-57`; `customer-web/src/orders/useMyOrders.js:24`, `:31` | Page with a cursor (`placedAt` + `id` of the last row) and dedupe all pages by `number`. |
| s13 | In-memory notice queue, no retry | `src/services/shop/orderNotices.service.js:24-31` | Write the notice as a pending `Notification` row first and let the existing jobs resend unsent ones. |
| s14 | Waiting card is not refreshed when the hold ends | `customer-web/src/pages/orders/MyOrdersPage.jsx`; `customer-web/src/orders/status.js:26` | Set a timer to `holdUntil` and call `reload()` (as `OrderPage.jsx:222-227` does). |
| s15 | Delivered can't be undone | `src/services/order.service.js:253-267` | Owners-only "Not delivered yet" within 24 h (no notice). |
| s16 | Not sure: blob download in in-app browsers | `customer-web/src/orders/invoice.js:5-17`; `customer-web/src/orders/actions.js:38` | Detect in-app browsers (as checkout does) and say "Open the website in Chrome or Safari to save the invoice". |
| s17 | Lowercase order number refused | `customer-web/src/pages/orders/OrderPage.jsx:177`; `src/validators/shop/checkout.validators.js:17` | `toUpperCase()` the param before checking, on both ends. |

**Checked and fine:**
- Ownership on all four endpoints (`findOwn` by `authAccountId` + `channel: 'online'`, `checkout.model.js:19-20`), with the same 404 for "not yours" and "doesn't exist".
- No secrets in the replies (`presentOrder`, `checkout.service.js:100-144`), and `no-store` on JSON and PDF (`checkout.controller.js:9`, `:29-34`).
- Every website date is formatted with `Asia/Kolkata`. The server's cancel-month rule and the invoice dates use India time.
- Rupees are rounded the same way on both ends.
- The address is always the copy kept on the order.
- An order with many lines works: up to 4 photos plus "+N", all lines on the page, and the PDF paginates.
- Broken photos fall back to a plain tile.
- The not-ready invoice is a 409 with an info message, not a broken link.
- A cancelled order's invoice is always stamped (drawn again if the stamp failed).
- Buy again follows the bag's rules (`bag.service.js:184-213`).
- The notices go only to online orders, only once for delivered, never block the admin app, and fetches have timeouts (`push/fcm.provider.js:63`).
- The old links match the old website's routes (`frontend/customer-web/src/App.jsx:49-52` of the old site).

---

## Second check (26 Oct 2026)

- **✅ Correct: 19 · ⚠️ Partly correct: 3 · ❌ Wrong: 0.**
- Partly correct: **S2** (can't happen on live today, because refund notices go to the old server; the live problem is "being refunded" for ever), **S5** (real, but Small), **s15** (no undo, but the admin app asks for confirmation first).
- The "For the developer" table has no extra findings. Its rows are the same findings, with the same verdicts.
- Full check, with evidence for every finding and two extra notes (hand refunds never show as "refunded" on live today; a lead for Module 09 about the old server's payment notices): [checks/10-orders-check.md](checks/10-orders-check.md)

> **Third check (lead: the old server's `payment.captured` handler): Real only if Razorpay's Test-mode dashboard sends `payment.captured` to the old server's address signed with the same secret the old server holds (unknown); certain once live keys are used before the webhook is moved and the old server is switched off. Final: the old server marks any new website order it knows as paid and "processing" with no stock, hold or refund check, so a late payment can be kept with no stock taken (or with no refund if the saree sold) and a refunded order can go back to "Being packed". Final group: Must fix.**

---

## Third check (26 Oct 2026)

- **Second checker right: 3 (S2, S5, s15) · First reviewer right: 0 · Both partly right: 0 · Neither right: 0.**
- **Lead (old server's payment notices): Real only if** a Test-mode webhook reaches the old server with the same secret; certain at the switch to live keys unless the webhook is moved and the old server is switched off first. Final group: Must fix.
- Final groups: S2 Should fix · S5 Small · s15 Small · lead Must fix (before live keys).
- Full tie-break, with evidence: [checks/10-orders-third-check.md](checks/10-orders-third-check.md)

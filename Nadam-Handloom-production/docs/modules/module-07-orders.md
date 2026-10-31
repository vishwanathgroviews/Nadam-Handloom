# Module 7: Orders and shipping

| | |
|---|---|
| **Status** | **Built and tested on a real Android phone, 2026-10-12** (sections 16–17). All decisions per the ⭐ recommendations (owner: "ok proceed"); mock-up picks A and A (defaults; the owner didn't choose). Open checks: section 19. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners and Staff see orders and ship them (`orders.manage`). Owners also cancel a paid order and see unpaid checkouts (`sell.override`, `sales.view`) |
| **Builds on** | [Module 2](module-02-roles-and-team.md) (roles), [Module 5](module-05-scan-to-sell.md) (WhatsApp orders, cancel), [Module 6](module-06-invoices.md) (invoices) |
| **Mock-up** | [`docs/design/ui-mockup/module-7-orders/`](../design/ui-mockup/module-7-orders/index.html) |
| **Old system notes** | [`current-system/admin-app-3-selling-orders-invoices.md`](../current-system/admin-app-3-selling-orders-invoices.md), sections 2 (Orders, OrderShipment), 4 and 6 |

## 1. Goal
Every online and WhatsApp order **packed, shipped and tracked without anything slipping**: nothing waits unnoticed in "To ship", a tracking number is never typed twice or onto the wrong order, and the customer gets the tracking details and invoice on WhatsApp in one tap.

## 2. What is in this module
- **The Orders tab** (bottom bar): **To ship**, **Shipped**, **Delivered**, with search; a count on the tab when something is waiting.
- **One order:** the sarees, the customer and address (Call, Copy address, WhatsApp), payment, invoice.
- **Ship it:** scan or type the courier's tracking number (AWB), **Mark shipped**, then **Send tracking on WhatsApp** (message + invoice PDF).
- **Fix a wrong tracking number; mark delivered.**
- **Cancel an order not yet shipped** (owners): sarees back in stock, invoice marked CANCELLED; an online refund is done in Razorpay.
- **Unpaid online checkouts** (owners): who tried to buy and didn't pay, to call them back.

**Not in this module:**
- Counter sales (Module 5, Today's sales) and the invoices list (Module 6).
- Returns after delivery and parcels sent back by the courier: later (6.10).
- Phone notifications for a new order: later (6.9); the tab shows a count now.
- The website's checkout and payments: the website (still the old backend for now).

## 3. How the shop ships today (copy of the live data, 2026-10-11)
| What | Number |
|---|---|
| WhatsApp orders | **15, all shipped by DTDC**, tracking numbers like H1001830791, marked shipped about 20 minutes after the order |
| Online orders paid | **2**, both look like tests (tracking numbers "123456789" and "BECAME"; one is the ₹10 test, INV-000015) |
| Online checkouts never paid | **18 checkouts from only 4 customers** on 9–10 Oct (₹2,74,911 in all), so people tried several times: possibly trouble at the payment step (worth checking on the website). The old app leaves them "waiting for payment" forever |
| Orders marked delivered | **0** (the old app has no way to) |
| Courier | DTDC only |

## 4. Problems in the old app
1. **No channel badge and no search** in the Orders tab; the Shipped list is filtered by order date, not shipped date.
2. **The same tracking number can go on two orders**, and a wrong one can only be replaced by typing over it with no record.
3. **"Delivered" can't be set**, so Shipped grows forever.
4. **A paid order can't be cancelled** (customer changed mind, saree damaged while packing).
5. **Unpaid checkouts are invisible** and stay "pending" forever (18 so far, from 4 customers who tried again and again).
6. **WhatsApp orders show a blank name and a stray ", -" line** on the ship-to card; the message greets "Hi there".
7. **Nothing tells you an order is waiting**: the "To ship" tile shows no number; push notifications are switched off.
8. **The old server deletes every order older than 6 months** (`retention.service.ts`, checked every 6 hours). The first deletions would come in **April 2027**. GST rules expect sales records to be kept for years (6.11).

## 5. How it will work

### 5.1 The Orders tab
- Three lists: **To ship** (paid online orders and WhatsApp orders not shipped yet, oldest first, so the longest-waiting is on top), **Shipped** (newest shipped first), **Delivered**.
- Each row: order number, Online / WhatsApp, the customer's name and town, sarees (photo of the first), total, and how long it has waited ("waiting 2 days" in amber after a day).
- **Search**: order number, customer name, mobile, tracking number, tag.
- The **Orders** tab shows a count when something is waiting to ship.
- Owners: an **Unpaid checkouts** entry (6.7).

### 5.2 One order
- The sarees (photo, name, tag, price), the total, payment (Online: paid via Razorpay; WhatsApp: Cash / UPI / Card), the invoice (opens Module 6).
- **Ship to:** name, mobile, the address in clean lines; **Call**, **Copy address**, **WhatsApp chat**.
- A timeline: ordered → paid → shipped → delivered, with times and who did it.

### 5.3 Shipping
1. **Courier:** DTDC (chosen already), or another courier by name (6.4).
2. **Tracking number:** scan the label's barcode with the camera, or type it. Checked: 8–20 letters and digits; **refused if it is already on another order** ("H1001830791 is already on order NH… (Padma)") (6.5).
3. **Mark shipped.** The order moves to Shipped.
4. **Send tracking on WhatsApp:** Android opens the customer's chat with the tracking message, then the invoice PDF; iPhone: the share menu. The message (as today, with the customer's name):
   > Hi Padma, your Nandam Handlooms order NH12345678 has shipped via DTDC.
   > Tracking ID (AWB): H1001830791
   > Track it here: https://www.dtdc.com/track-your-shipment/
   > Your order: Rainbow checks sarees, https://… Thank you for shopping with us!
- **Wrong tracking number** (6.6): "Change tracking number"; the old one is kept in the order's history.
- **Mark delivered** (6.8): one tap on a shipped order (owners and staff).

### 5.4 Cancelling an order not yet shipped (6.3)
Owners: **Cancel order** with a reason. The sarees go back in stock, the invoice is marked CANCELLED (kept, its number never reused). For a paid online order the app says "Refund ₹3,000 in Razorpay": the app never moves money.

### 5.5 Unpaid checkouts (6.7)
Owners: a list of website checkouts that weren't paid: customer, mobile, sarees, amount, when. **Call** or **WhatsApp** the customer. Nothing in them is reserved after 15 minutes, so the sarees are back on sale. Older than 30 days: hidden.

## 6. Decisions
| # | Question | Options | Recommendation |
|---|---|---|---|
| 6.1 | **Who ships** | ⭐ Owners and Staff (as today) | Staff pack and ship |
| 6.2 | **Order of "To ship"** | A Newest first (as today) · B ⭐ Oldest first, with "waiting 2 days" | **B.** The longest-waiting parcel is on top |
| 6.3 | **Cancel an order not yet shipped** | A Not possible (as today) · B ⭐ Owners, before it ships, in the same month as the sale · C Owners, any time before it ships | **B.** Same month keeps a filed GST month unchanged; an online refund is done in Razorpay |
| 6.4 | **Couriers** | A DTDC only (as today) · B ⭐ DTDC by default, or another courier by name (no tracking link for unknown couriers) | **B.** Costs nothing, covers India Post or a local courier |
| 6.5 | **Same tracking number on two orders** | ⭐ Refused, saying which order has it | A typo or a double scan is caught at once |
| 6.6 | **Changing a tracking number** | ⭐ Allowed (owners and staff), the old number kept in the order's history | Wrong labels happen |
| 6.7 | **Unpaid checkouts** | A Hidden (as today) · B ⭐ Owners see them (30 days), with Call and WhatsApp | **B.** 4 customers tried 18 times (₹2.7 lakh) in two days; a call can win the sale and shows whether payment is failing |
| 6.8 | **Delivered** | A Not used (as today) · B ⭐ "Mark delivered" by hand; Shipped orders older than 10 days get a "Check delivery" note | **B.** DTDC has no automatic updates for us; the note keeps Shipped tidy |
| 6.9 | **Phone notification for a new order** | A ⭐ Not now: a count on the Orders tab · B Notifications now | **A.** Online orders are rare today; notifications need extra setup on both phones. Plan them with Home (Module 8) |
| 6.10 | **Returns and parcels sent back by the courier** | ⭐ Later | Rare today; needs its own rules (refund, stock) |
| 6.11 | **The old 6-month order deletion** | A Keep deleting after 6 months · B ⭐ Never delete sales (keep at least 8 years, as GST records); switch the old job off before April 2027 | **B.** Ask your accountant; the new backend has no deletion at all |

## 7. Screens
| Screen | What's on it |
|---|---|
| Orders tab | To ship / Shipped / Delivered, search, counts, Unpaid checkouts (owners) |
| One order | Sarees, payment, invoice, ship-to with Call / Copy / WhatsApp, timeline |
| Ship | Courier, tracking number (scan or type), Mark shipped |
| Shipped | Send tracking on WhatsApp, Change tracking number, Mark delivered |
| Cancel order | Reason; refund note for online orders |
| Unpaid checkouts | List with Call / WhatsApp |

## 8. Rules
| Rule | Value |
|---|---|
| To ship | Online orders paid (status processing) and WhatsApp orders not shipped, not cancelled |
| Tracking number | 8–20 letters and digits, capitals, no spaces; unique across orders (a cancelled order's number can be reused) |
| Mark shipped | Order → shipped, shipment → shipped with time and who; an online order must be paid |
| Mark delivered | Only a shipped order |
| Cancel | Owners; not shipped; same calendar month (India) as the order; a reason; sarees back in stock; invoice CANCELLED |
| Unpaid checkout | Online, waiting for payment, older than 15 minutes, newer than 30 days |
| "Waiting" warning | To ship for more than 24 hours |

## 9. Data (same live database)
- Uses `Order`, `OrderItem`, `Shipment` (carrier, awbNumber, status, shippedAt), `Invoice`, `Payment`, `Address`, `AuthAccount` as they are.
- **Additive changes:** migration `v2_orders`: `Shipment.deliveredAt`, `Shipment.shippedById`, `Shipment.deliveredById`. The "one tracking number, one order" rule (6.5) is checked by the new server itself (a lock, then a check), **not** by the database: on 2026-10-13 the live data had one number (NH3915) on 13 orders shipped from the old app, and a database rule would also have started refusing the old app. Migration `v2_tracking_number_rule` removes the database rule where the first version had made it. Migration `v2_order_lines`: `OrderItem.lineNo`, so a bill's sarees keep the order they were scanned in (a Module 5 fix found while testing).
- Changes to tracking numbers and deliveries are written to the activity log (who, when, old number).

## 10. API (as built, under `/api/v2`)
| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/orders?tab=to_ship\|shipped\|delivered&q=` | The lists and their counts | orders.manage |
| GET | `/orders/counts` | The count on the tab | orders.manage |
| GET | `/orders/:id` | One order with timeline | orders.manage |
| POST | `/orders/:id/ship` | `{ carrier, awb }` → shipped | orders.manage |
| PATCH | `/orders/:id/tracking` | `{ carrier, awb }` → changed, old kept | orders.manage |
| POST | `/orders/:id/delivered` | Mark delivered | orders.manage |
| POST | `/orders/:id/cancel` | `{ reason }` | sell.override |
| GET | `/orders/unpaid` | Unpaid checkouts (30 days) | sales.view |

## 11. Building blocks
**Backend:** `models/order.model.js`, `services/order.service.js` (lists, ship, tracking, delivered, cancel, unpaid), the shipping message text (product links use the website's address, a server setting `WEBSITE_URL` to fill in at switch-over), reuse Module 5's cancel and Module 6's invoice code, routes, validators, tests.

**App:** the Orders tab (replacing the placeholder), order page, ship sheet with the camera scanner from Module 4, the WhatsApp message + invoice (Module 3's `nandam-share`), cancel sheet, unpaid checkouts.

## 12. Steps
1. Plan (this document). ✅ All ⭐ recommendations agreed.
2. Mock-up, clickable, in Chrome. ✅ (73/73 browser checks; picks A and A)
3. Backend + tests. ✅ (section 16)
4. App + tests. ✅ (section 16)
5. Real-phone test ✅ (section 17): a WhatsApp order from Module 5 through To ship → scan a tracking label → Mark shipped → send on WhatsApp (to the owner's own number) → change the number → Mark delivered; a duplicate number refused; cancel before shipping (owner; staff refused); unpaid checkouts; search.
6. Results written here; open checks to the full-app test list. ✅

## 13. Testing plan
- **API:** lists and order; counts; ship (format, duplicate refused, online must be paid, cancelled refused); tracking change keeps the old number; delivered only after shipped; cancel rules (owner, not shipped, same month, stock back, invoice cancelled); unpaid list (15 minutes, 30 days); Staff refused cancel and unpaid.
- **App:** message text, tracking number tidying, waiting text.
- **Real phone:** section 12, step 5.

## 14. Risks
| Risk | Handling |
|---|---|
| A customer pays for an order an owner cancelled | Online orders cancelled only by owners, with the refund note; the website's own payment check is unchanged until the website moves over |
| The old app ships the same order at the same time | The ship step only works on a "to ship" order; the second sees "already shipped" |
| The old 6-month deletion | Decision 6.11; a switch-over action before April 2027 |

## 16. Build status (2026-10-12)
| Part | What | Checks |
|---|---|---|
| Database | `20261012000000_v2_orders` and `20261012010000_v2_order_lines` (both additive), applied to the local copy; no drift | — |
| Server | `models/order.model.js` (lists, search, unpaid), `services/order.service.js` (lists, one order with its history, ship, change number, delivered, cancel, unpaid, the WhatsApp message), routes `/api/v2/orders`. Product links in the message use the `WEBSITE_URL` setting (fill it in at switch-over) | **230/230** server tests (Module 7: 13 API + 5 unit) |
| App | The Orders tab (pick A: tabs at the top) with a count on the tab, order page (ship sheet = pick A), unpaid checkouts; the camera scanner from Module 4 for courier labels; tracking + invoice sent into the customer's WhatsApp chat (Android) | **75/75** app tests (Module 7: 3), lint clean |

Changes from the draft: "Copy address" goes through the phone's share menu (which has Copy), as the old app did, because adding a clipboard module clashed with an old package conflict in the app; the tracking message and the invoice PDF go together in one share (the message is the PDF's caption).

## 17. Real-phone test (2026-10-12, Samsung Note10 Lite, test app)
Owner = Lakshmi (test), Staff = Anil (test), local copy through the USB cable. A paid online test order and a WhatsApp test order were made on the local copy for the test.

| # | Check | Result |
|---|---|---|
| 1 | Orders tab: To ship 2, oldest first ("waiting 1 day" in amber), Shipped 17, Delivered 0; a red 2 on the Orders tab | ✅ |
| 2 | Order page: the sarees, ship-to, payment, invoice, what happened | ✅ |
| 3 | Ship: a too-short number refused; **a number already on another order refused, naming it** (NH31070032) | ✅ |
| 4 | Ship with "h100 1830-900" → tidied to H1001830900; shipped; "Send on WhatsApp now?" (Later chosen, so no chat opened with a stranger); history "Shipped by Lakshmi" | ✅ |
| 5 | The WhatsApp message from the server: "Hi Anitha… shipped via DTDC. Tracking ID (AWB)… Track it here…" | ✅ |
| 6 | Change number: the same number refused; changed, the old one kept in the history | ✅ |
| 7 | Mark delivered → Delivered; the tab count went to 1 | ✅ |
| 8 | Owner cancels the paid online order: "Refund ₹2,800 in Razorpay"; reason; saree back in stock; invoice CANCELLED | ✅ (stamp fixed, see below) |
| 9 | Search by tracking number and by name (finds the cancelled order too) | ✅ |
| 10 | Unpaid checkouts (owners): 4 customers · 18 checkouts, one tried 11 times (looked at only, no calls) | ✅ |
| 11 | A WhatsApp address typed on several lines shows in its lines; Copy address opens the share menu with Copy and the whole address | ✅ (after fix 2) |
| 12 | Staff: no unpaid checkouts, "Cancelling is for owners", no Cancel on the order; Staff ship it ("Shipped by Anil") | ✅ |

**Problems found and fixed (re-checked):**
1. The Call / Copy address / WhatsApp buttons were squeezed onto one row ("WhatsAp/p"); now two rows.
2. A WhatsApp delivery address typed on several lines was saved as one long line (Module 5); it now keeps its lines.
3. **Cancelling an online order didn't stamp its invoice PDF CANCELLED** (the stamping only looked at counter and WhatsApp sales). Fixed, with a test.
4. **A bill's sarees could come back in a different order than scanned** (found by the full test run): lines now store their place on the bill (`lineNo`).

Not tested: scanning a real courier label with the camera (nobody was holding the phone; the same scanner reads tags in Modules 4 and 5), and sending into a real WhatsApp chat (to avoid messaging a stranger).

## 18. Switch-over notes
- **Website W7 (17 Oct):** marking a website order shipped or delivered now also tells its customer (a web notification, if they turned order updates on; sent in the background). WhatsApp orders are never notified. See `web-05-my-orders.md` section 16.
- Run the migrations `v2_orders` and `v2_order_lines` (additive). The unique tracking number index needs no duplicates in the live data (none on 11 Oct; check again).
- Set `WEBSITE_URL` (the shop's website address) on the new server so the message carries product links.
- **Switch off the old server's 6-month order deletion** (`retention.service.ts`, decision 6.11) before April 2027, or as soon as the old server is retired.
- Look into the 18 unpaid checkouts from 4 customers (one tried 11 times): the website's payment step may be failing.

## 19. Left for the full-app test
Added to [`docs/testing/full-app-test-list.md`](../testing/full-app-test-list.md): scanning a real DTDC label with the camera, sending tracking + invoice into a real WhatsApp chat (the owner's own number), iPhone (share menu instead of the chat), tablet layout, a paid order arriving from the real website, and the old app shipping the same order at the same time.

## 20. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-11 | Plan | Data: 15 WhatsApp orders all shipped by DTDC; 2 online orders (tests); 18 unpaid checkouts from 4 customers (₹2.7 lakh, repeated tries: check the website's payment step); found the old 6-month order deletion. Waiting for decisions 6.1–6.11. |
| 2026-10-12 | Decisions | Owner: "ok proceed": all ⭐ recommendations; picks left as A and A. |
| 2026-10-12 | Built and phone-tested | Server 230/230, app 75/75; 12 phone checks passed; 4 problems fixed (2 of them in Module 5's data: address lines, line order). |

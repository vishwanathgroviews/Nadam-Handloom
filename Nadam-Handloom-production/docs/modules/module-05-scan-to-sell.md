# Module 5: Scan to sell

| | |
|---|---|
| **Status** | **Built and tested on a real Android phone, 2026-10-11** (sections 16–17). Decisions 6.1–6.4 by the owner, the rest per the ⭐ recommendations, mock-up picks in 6B. Open checks for the full-app test: section 19. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners and Staff sell (`sell.use`). Only Owners cancel a sale or sell a saree an online checkout is holding (`sell.override`) |
| **Builds on** | [Module 2](module-02-roles-and-team.md) (roles), [Module 3](module-03-categories.md) (store prices), [Module 4](module-04-products.md) (sarees and tags, the camera scanner) |
| **Mock-up** | [`docs/design/ui-mockup/module-5-scan-to-sell/`](../design/ui-mockup/module-5-scan-to-sell/index.html) |
| **Old system notes** | [`current-system/admin-app-3-selling-orders-invoices.md`](../current-system/admin-app-3-selling-orders-invoices.md), sections 1, 3, 6 and 7 |

## 1. Goal
At the counter: scan the sarees, agree the price, take the payment and hand over the invoice, quickly and without mistakes. **A saree is never sold twice. A bill is never lost. Every bargain and cancellation is recorded.**

## 2. What is in this module
- **The Scan tab** (the round button in the middle of the tab bar): scan or type tags to build one bill.
- **The bill:** each saree with its store price; type the agreed price for a bargain; remove a saree; a running total.
- **Completing the sale:** counter or WhatsApp; Cash / UPI / Card; invoice yes or no; the customer's details when needed.
- **The result:** sold, with the invoice to share on WhatsApp or print, and "Make the invoice again" if it failed.
- **Price check:** scan to see a saree's price and status, without touching the bill.
- **Today's sales** on the Scan tab, and **Cancel a sale** (owners, same day).
- **A saree held by an online checkout:** owners can sell it anyway; that online checkout is cancelled properly.

**Not in this module:**
- The invoice list, searching invoices and the sales-summary PDF: Module 6.
- Shipping WhatsApp orders (courier, AWB): Module 7. A WhatsApp sale made here lands in Module 7's "To ship".
- Today's sales totals on Home: Module 8. Analytics: Module 9.
- Returns and refunds after the day of the sale: later (see 6.2).

## 3. How the shop sells today (copy of the live data, 2026-10-11)
| What | Number |
|---|---|
| Counter bills | 20 since 5 Oct (16 without an invoice, 4 with) |
| WhatsApp orders | 15 (9 with an invoice) |
| Biggest bills | Invoiced counter bills average about 15 sarees |
| Bargained prices | **95 lines in 29 of 35 bills** |
| How much bargaining | Paid on average **54%** of the store price; **26 of 95 under half**; lowest 11%; never above the store price |
| Invoices | INV-000001 to INV-000015 |
| Payment mode | **Not recorded** for any counter or WhatsApp sale |
| Online checkouts left unpaid | 18 (Module 7) |

The bargaining figures suggest some store prices are set high on purpose (or by mistake, e.g. "Gap Border bramini sarees" at ₹54,310 from Module 3). Worth a look at the catalogue prices.

## 4. Problems in the old app
1. **Switching to Price check wipes the bill** without asking.
2. **No protection against sending the sale twice.** If the network is slow and the app repeats the request, staff see "already sold" for a sale that did go through.
3. **The owner's "sell anyway" for a saree held online almost never appears**, and when it does, **the online order isn't cancelled**: if that buyer pays, the saree is sold twice.
4. **Cash, UPI or card is never recorded.**
5. **No cancel, no undo** after "Complete sale".
6. **"Online only" or switched-off sarees can be sold at the counter.**
7. **A failed invoice can't be made again** for a counter or WhatsApp sale.
8. **WhatsApp invoices have no customer name**; the ship-to card prints blank lines.
9. **Errors don't say which saree** on the bill failed.
10. **The bill lives only on the screen:** closing the app loses it.
11. The stock ledger records WhatsApp sales as "store".

## 5. How selling will work

### 5.1 Building the bill
1. Tap **Scan** (the round button). The camera opens with a strip at the bottom: "Bill · 3 sarees · ₹10,800 · View bill".
2. **Scan a tag** (or type its number, or use a Bluetooth scanner). The same camera and checks as Module 4: a tag is accepted after two matching reads.
3. **Can be sold:** it goes straight onto the bill at its **store price** (from its subcategory), with a short tick, and the camera stays open for the next one.
4. **Can't be sold:** a card says exactly why, with the saree's photo:
   - "NH2264 is already sold (at the counter, 9 Oct)."
   - "NH6 is on this bill already."
   - "Saree damaged: not for sale." · "Set to Online only." · "No saree has NH9999."
   - "A customer is paying for it online right now (until 4:15 pm)": owners see **Sell anyway** (6.8).
5. **The bill is kept on the phone** as a draft (like Module 4's batch), so closing the app or a phone call loses nothing. It belongs to the person who started it.

### 5.2 The bill
- Each saree: photo, name, tag number, **store price**, and an **agreed price** box. Leave it, or type the price the customer agreed.
- The total updates as you type, with the saving shown ("₹2,000 off").
- **Very low price warning (6.3):** a price under half the store price asks "₹1,200 is under half the store price (₹3,600). Is this right?" with **Yes, sell at ₹1,200** / **Change it**.
- Remove a saree (swipe or ✕), clear the whole bill (asks first), **Add more** (back to the camera).

### 5.3 Completing the sale
One screen with three required choices and a big button:
1. **Where:** At the counter / WhatsApp order.
2. **Paid by (6.1):** Cash / UPI / Card.
3. **Invoice:** Yes / No.
- **Customer:** for a counter sale, name and mobile are optional (they go on the invoice and are used to send it on WhatsApp). For a WhatsApp order: name, mobile and the delivery address are required.
- **Complete sale.** One tap sells everything together, or nothing: if one saree became unavailable a moment ago, the bill stays and that saree is marked ("NH3528 was just sold on another phone. Remove it to continue.").
- **Safe to tap twice / slow network:** every bill has its own id from the phone; sending it again returns the same sale.
- **No internet (6.4):** "Complete sale" waits and says so; the bill stays on the phone.

### 5.4 After the sale
- "Sold · ₹10,800 · Cash · Order NH12345678 · Invoice INV-000016" (or "Recorded without an invoice").
- **Share invoice on WhatsApp** (Android: straight into the customer's chat when the mobile is given; iPhone: share menu), **Print**, **Share another way**.
- If the invoice couldn't be made: "The sale is saved. The invoice couldn't be made just now." with **Make the invoice again**.
- **Next customer** starts a new bill.
- WhatsApp order: "It's in Orders → To ship" (Module 7).

### 5.5 Price check
A separate screen (from the Scan tab): scan to see photo, name, store price, website price and status. It never touches the bill.

### 5.6 Today's sales and cancelling (6.2)
- The Scan tab lists **today's sales** (newest first): time, items, total, payment mode, who sold it. Owners see every sale and the day's total; Staff see only their own sales (6.13).
- Open one to see the bill and the invoice.
- **Owners:** **Cancel sale** (only on the day of the sale): asks for a short reason ("Customer changed mind", "Wrong saree"…), then the sarees go **back in stock**, the order is marked cancelled and its invoice is marked **CANCELLED** (kept, its number never reused). Recorded in the activity log.
- Staff see the sale but not Cancel ("Ask an owner to cancel this sale").

### 5.7 A saree held by an online checkout (6.8)
An online customer has 15 minutes to pay. If the same saree is at the counter:
- Staff: "A customer is paying for it online right now. Ask an owner, or wait until 4:15 pm."
- Owners: **Sell anyway**. That online checkout is cancelled and its hold released, in the same step as the sale.

## 6. Decisions
| # | Question | Decision |
|---|---|---|
| 6.1 | **Record the payment mode?** | ✅ **Agreed:** Cash / UPI / Card, one tap, required on every sale |
| 6.2 | **Cancel a sale?** | ✅ **Agreed:** Owners only, same day only. Sarees back in stock, order cancelled, invoice marked CANCELLED (kept) |
| 6.3 | **Warn about very low bargains?** | ✅ **Agreed:** under half the store price, a quick "Is this right?". Note: today 1 in 4 bargains is under half (section 3), so this will show often; the owner may want to change the line later |
| 6.4 | **Sell without internet?** | ✅ **Agreed:** No (so a saree is never sold twice). The bill stays on the phone and waits |
| 6.5 | Counter customer's name and mobile | ⭐ Optional; saved on the invoice only when given (old app never saved them) |
| 6.6 | WhatsApp order details | ⭐ Name, mobile and address required (fixes the blank name on invoices and ship-to cards) |
| 6.7 | Invoice yes / no | ⭐ Asked on every bill, no default (as today), so no one forgets |
| 6.8 | Saree held by an online checkout | ⭐ Owners can "Sell anyway"; that checkout is cancelled properly |
| 6.9 | "Online only" or switched-off sarees at the counter | ⭐ Refused, with "Change it to Online + store" on the saree page |
| 6.10 | Sarees per bill | ⭐ Up to 100 |
| 6.11 | Price check | ⭐ Its own screen; never touches the bill |
| 6.12 | Old "quantity" stock (no tags) | ⭐ Not sold in the new app: all stock today is tagged (old `stock` counter is 0 everywhere) |
| 6.13 | Who sees today's sales | ⭐ Owners: everyone's sales and the day's total. Staff: only their own sales, no total (Module 2: money totals are for owners) |

## 6B. Mock-up picks (owner, 2026-10-11)
| Choice | Picked |
|---|---|
| Theme | Follows the phone |
| Scan screen | **A: camera full, the bill strip at the bottom** |
| Complete sale | **A: one page** |

## 7. Screens
| Screen | What's on it |
|---|---|
| Scan tab | Camera, "Type", torch, zoom, the bill strip; Price check; Today's sales |
| "Can't be sold" card | Photo, tag, why, and the way out (Sell anyway for owners when held) |
| Bill | Sarees with store price and agreed price, total, savings, Add more, Clear |
| Low price check | "Is this right?" |
| Complete sale | Where · Paid by · Invoice · Customer · Complete sale |
| Sold | Order and invoice, Share on WhatsApp, Print, Make the invoice again, Next customer |
| Invoice preview | The PDF as the customer gets it |
| Price check | Photo, prices, status |
| Today's sales | List; a sale; Cancel sale (owners) |

## 8. Rules
| Rule | Value |
|---|---|
| Sellable | Tag in stock; saree not deleted; sells at the counter (both or store only); not damaged; held only with an owner's Sell anyway |
| Price | The subcategory's store price, unless an agreed price is typed: more than ₹0, at most ₹10,00,000 |
| GST | All prices include GST (5%, a setting). Per line: taxable value = price ÷ 1.05 (to the paisa), GST = the rest, split CGST / SGST. Same as the old backend |
| Order number | "NH" + 8 random digits (as today) |
| Invoice number | INV-000016, the next number (as today) |
| One bill = one order | All sarees sold together or none; one order, one invoice |
| Same bill sent twice | Returns the same sale (the phone's bill id) |
| A bargain | Saved on that sale line only; recorded in the activity log (same event name as the old app, so old entries show too) |
| Cancel | Owners, the same calendar day (India time); needs a reason |
| WhatsApp order | Status "processing", goes to To ship (Module 7); a counter sale is "delivered" (as today) |

## 9. Data (same live database)
### 9.1 Tables used as they are
`Order` (one bill), `OrderItem` (one saree on it, `priceSnapshot` = the agreed price), `Piece` (tag status → `sold_offline`), `StockLedger` (`offline_sale`, and new `sale_cancelled`), `Reservation` (holds), `Invoice` (number, GST, PDF), `Shipment` (created for WhatsApp orders, as today), `AuthEvent` (activity log).

### 9.2 Additive changes (migration `v2_sales`)
| Table | Column | Why |
|---|---|---|
| `Order` | `clientRef` (text, unique, empty for old orders) | The phone's bill id: a repeated "Complete sale" returns the same sale |
| `Order` | `paymentMethod` (text: cash / upi / card) | 6.1 |
| `Order` | `cancelledAt`, `cancelledById`, `cancelReason` | 6.2 |
| `Invoice` | `cancelledAt` | A cancelled sale's invoice is marked, never deleted |

Who sold it comes from the ledger's `actorId` (as in Module 4). The old backend ignores the new columns; it already knows the `cancelled` order status.

## 10. API (as built, under `/api/v2`)
| Method | Path | Purpose | Who |
|---|---|---|---|
| POST | `/sales/lookup` | `{ code }` → the saree, its store price and whether it can be sold (and why not). Used by the bill and Price check | sell.use |
| POST | `/sales` | Complete a sale: `{ clientRef, lines: [{ pieceId, price, storePrice, sellHeld }], channel, paymentMethod, invoice, customer }` → `{ sale, actions, repeated, invoiceFailed }`. 201 new, 200 repeated | sell.use (a line with `sellHeld` needs sell.override) |
| GET | `/sales/today` | Today's sales | sell.use |
| GET | `/sales/:id` | One sale with its lines and invoice | sell.use |
| POST | `/sales/:id/invoice` | Make the invoice again (if it failed) | sell.use |
| POST | `/sales/:id/cancel` | `{ reason }` → cancelled, sarees back in stock | sell.override |

Why a saree can't be sold (`problem.code` from lookup, `details.reason` in `LINE_CHANGED`): `ALREADY_SOLD`, `DAMAGED`, `ONLINE_ONLY`, `SWITCHED_OFF`, `HELD_ONLINE`, `TAG_RETIRED`, `DELETED`, `NOT_FOR_SALE`, and at sale time `GONE` and `PRICE_CHANGED` (the store price changed while the bill was open; the phone updates it). Other codes: `TAG_UNKNOWN` (404), `TAG_INVALID`, `AMBIGUOUS_CODE`, `HELD_ONLINE` (409, with the line), `LINE_CHANGED` (409, with the line), `NO_INVOICE`, `INVOICE_FAILED` (503), `NOT_TODAY`, `ALREADY_CANCELLED`, `SHIPPED`, `NOT_YOURS` (Staff opening someone else's sale), `FORBIDDEN`, `VALIDATION_FAILED`. "On this bill already" is checked on the phone (the server refuses a bill with the same saree twice).

What changed from the draft, and why:
- **"Sell anyway" is per saree** (`lines[].sellHeld`), not for the whole bill, so a second saree that becomes held while the bill is open is never sold without the owner being asked.
- **Each line carries the store price the phone showed** (`storePrice`). If the catalogue price changed meanwhile, nothing is sold and the phone updates the line (`PRICE_CHANGED`), so the customer always pays what they were told.
- **Two copies of the same bill at the same moment** (a double tap on a slow network): the second waits for the first and returns its sale (a lock on the bill id), instead of saying "just sold".

## 11. Building blocks
**Backend:** `models/sale.model.js`, `services/sale.service.js` (lookup, sell in one transaction, idempotent, held override, cancel), `services/invoice.service.js` and `invoicePdf.service.js` (numbering, GST split, PDF like today's), `utils/gst.js`, controllers, routes, validators. Company details (name, address, GSTIN, logo) and the GST rate are settings, as in the old backend.

**App:** the Scan tab (camera from Module 4, the bill strip), the bill, Complete sale, Sold, Price check, Today's sales, sale detail with Cancel; the bill draft kept on the phone; invoice share (WhatsApp straight to the chat on Android, from Module 3's `nandam-share`), print (`expo-print`).

## 12. Steps
1. Plan (this document). ✅ Main decisions agreed.
2. Mock-up, clickable, in Chrome: every screen above, with the agreed design. ✅ (picks in 6B)
3. Backend + tests. ✅ (section 16)
4. App + tests. ✅ (section 16)
5. Real-phone test ✅ (section 17): a real bill of several sarees, bargains, each payment mode, invoice yes and no, share and print, a WhatsApp order, a held saree (owner and staff), a saree sold on another phone mid-bill, no internet, tap twice, cancel (owner; staff refused; not next day).
6. Results written here; open checks to the full-app test list. ✅

## 13. Testing plan
- **API:** sell one and many sarees; all-or-nothing; the same clientRef twice gives one sale; two phones selling the same saree (one wins, the other gets LINE_CHANGED); sold / damaged / online-only / unknown refused with the right code; held refused for staff, sold with sellHeld for owners and the online checkout cancelled; bargain recorded; GST split adds up to the total to the paisa; invoice numbers in order; invoice "make again" works and never makes two; cancel: owners only, same day only, sarees back in stock, invoice marked cancelled, twice refused.
- **App:** bill maths (total, savings, low-price rule), draft kept, tag tidying.
- **Real phone:** section 12, step 5.

## 14. Risks
| Risk | Handling |
|---|---|
| Selling twice (two phones, slow network) | One transaction that only succeeds if the tag is still in stock; the phone's bill id for repeats |
| An online buyer pays for a saree the owner just sold anyway | The checkout is cancelled in the same step. Until the website moves to the new backend (later), a payment finishing in that same minute could still clash; the website's own payment check is unchanged, so this needs a look when the website is rebuilt |
| Invoice PDF slow or failing | The sale never waits on it; "Make the invoice again" |
| Cancelling after GST filing | Same day only (6.2) |

## 16. Build status (2026-10-11)
| Part | What | Checks |
|---|---|---|
| Database | Migration `20261011230000_v2_sales` (additive: `Order.clientRef`, `paymentMethod`, `cancelledAt`, `cancelledById`, `cancelReason`; `Invoice.cancelledAt`). Applied to the local copy; no drift | — |
| Server | `services/sale.service.js` (lookup, sell in one step, held override, today, cancel), `services/invoice.service.js` (numbering, make again, CANCELLED stamp), `services/invoicePdf.service.js` (same layout as today's invoices + order number + "Paid by"; the logo travels with the server in `assets/logo.png`), `models/sale.model.js`, `utils/gst.js` (same sums as the old backend), `utils/day.js` (the shop's day is India time), validators, controller, routes `/api/v2/sales`. Company details and the GST rate are settings (`COMPANY_*`, `GST_RATE_PERCENT`), with the old defaults | **195/195** server tests (Module 5: 22 API + 5 unit) |
| App | Scan tab: `scan/index` (camera full, bill strip), `bill`, `complete` (one page), `sold`, `price-check`, `today`, `sale/[id]`; the bill kept on the phone per person (`src/sales/bill.js`); invoice share and print (`src/utils/invoice.js`, new `expo-print`) | **65/65** app tests (Module 5: 8), lint clean, expo-doctor 21/21 |
| Live run on the computer | Sell with a bargain and UPI → same bill twice = one sale → invoice PDF → "already sold" → today's total → cancel (back in stock, invoice stamped) | passed |

**Invoice numbers on the local copy** now run to INV-000020 (test sales). The live database is untouched; its next invoice is still INV-000016.

## 17. Real-phone test (2026-10-11, Samsung Note10 Lite, test app)
Staff = Anil (test), Owner = Lakshmi (test), on the local copy of the data through the USB cable. Test tags NH9930xx; the camera read barcodes shown on the Mac screen (the owner held the phone).

| # | Check | Result |
|---|---|---|
| 1 | Scan tab: camera full, Type / Torch / Zoom, bill strip at the bottom (pick A) | ✅ |
| 2 | Add sarees by typing the number (993050 → NH993050), each at its store price | ✅ |
| 3 | Real camera scanning on the sell screen (NH993051, NH993052, NH2264 at its own price ₹6,499) | ✅ |
| 4 | Same saree again → "on this bill already" | ✅ |
| 5 | Can't be sold, with the reason and the saree's photo: damaged, Online only, unknown tag (with "Add as a new saree") | ✅ |
| 6 | Held by an online checkout, Staff → "Ask an owner, or wait until 10:37 pm", no Sell anyway | ✅ |
| 7 | Price check shows store / website / MRP and status ("On your bill"); the bill stays as it was | ✅ |
| 8 | Bargain ₹3,000 on a ₹3,600 saree: total and saving update while typing | ✅ |
| 9 | ₹1,500 (under half) → "Is this price right?"; Change it / Yes, sell at ₹1,500 | ✅ |
| 10 | App closed completely in the middle of a bill → "Your bill is back", prices kept | ✅ |
| 11 | Complete sale with nothing chosen → asks Where, Paid by, Invoice (no defaults) | ✅ |
| 12 | Staff counter sale: 3 sarees, 2 bargains, Cash, invoice → Sold ₹8,100, INV-000017; database: pieces sold, both bargains in the activity log, GST ₹7,714.28 + ₹192.87 + ₹192.85 = ₹8,100.00 | ✅ |
| 13 | Print → the phone's print screen with the real invoice | ✅ |
| 14 | Share on WhatsApp with no mobile on the sale → asks for the number, refuses a short one (cancelled before opening any chat) | ✅ |
| 15 | Share another way → share menu with "Nandam-Invoice-INV-000017.pdf" | ✅ |
| 16 | Next customer → empty bill | ✅ |
| 17 | Today's sales, Staff → only their own sales, no total; their sale shows "Ask an owner to cancel this sale" | ✅ |
| 18 | WhatsApp order: name, mobile and address required; UPI, no invoice → "It's in Orders → To ship"; database: processing, shipment, address saved, stock entry marked WhatsApp | ✅ |
| 19 | Saree sold on another phone while on this bill → "Nothing was sold. NH993005 was just sold on another phone"; the other saree stayed unsold; "Remove it and complete" sold the rest | ✅ |
| 20 | Server got "Complete sale" but the phone never heard (server frozen, phone gave up after 30 s): bill locked ("Waiting for an answer"); Send again → the same order NH73297987, "Already saved", nothing sold twice | ✅ |
| 21 | No internet → "A saree can be added only when the phone is online"; works again when back | ✅ |
| 22 | A bill belongs to the person: Lakshmi didn't see Anil's bill; Anil got his back after signing in again | ✅ |
| 23 | Owner: held saree → Sell anyway (asks again) → sold; the online checkout cancelled ("Sold at the counter (order NH33592540)") and its other saree back in stock | ✅ |
| 24 | Owner's Today's sales: everyone's sales, 6 sales · 8 sarees · ₹26,100, Cash/UPI/Card split adds up; cancelled sale shown, not counted | ✅ |
| 25 | Owner cancels Staff's sale with a reason → 3 sarees back in stock, invoice INV-000017 kept and stamped CANCELLED | ✅ |
| 26 | Yesterday's sale → "Sales can be cancelled only on the day they were made", no Cancel | ✅ |
| 27 | Invoice couldn't be made (server storage blocked) → sale saved, "Make the invoice again" → INV-000020, exactly one, no number skipped | ✅ |
| 28 | Store price changed while the bill was open → nothing sold, the bill updated, sold at the new price on the next tap | ✅ |
| 29 | Remove one saree (✕), Clear the bill (asks first) | ✅ |
| 30 | Dark mode (theme follows the phone) | ✅ |

**Problems found and fixed (all re-checked on the phone):**
1. The "Added NH… · ₹3,600" message covered the bill strip. Now scan results show in a green (or amber) line on the camera.
2. The empty agreed-price box showed the store price in a grey that looked like a typed price. The hint is now light grey.
3. With no internet, the top bar said "changes will send when it's back", which is wrong for selling. On the Scan tab it now says "Selling waits until it's back; the bill stays on this phone."
4. On a long sale's page, the last button sat under the phone's own navigation bar. Space added below.
5. "Store price changed" message said two things at once. Now: "A store price changed: nothing was sold · NH993011 now costs ₹3,800 in the catalogue. The bill shows the new price; check it with the customer, then tap Complete sale again."
6. "All 1 saree come off the bill" → "The saree comes off the bill."

Not app problems: the grey box behind the tick on Sold was Android's keyboard-focus highlight from the test script's Enter key; one test saree's photo is black because it was taken face down in the Module 4 test.

## 18. Switch-over notes
- Run the migration `v2_sales` on the live database with the others (additive only; the old backend ignores the new columns).
- Check the shop details on invoices (`COMPANY_NAME`, address, mobile, GSTIN) and `GST_RATE_PERCENT` with the owner; the defaults are the old backend's.
- Until Modules 6 and 9 replace them, **the old app's reports and sales-summary PDF still count a cancelled counter sale** (the old code counts every `store` order). Tell the owner, or switch reports over together with Module 6.
- "Sell anyway" cancels the online checkout in our database. The website still runs on the old backend: if that customer's payment finishes in the same minute, the old backend could still mark the order paid (section 14). Check this when the website moves to the new backend.

## 19. Left for the full-app test
Added to [`docs/testing/full-app-test-list.md`](../testing/full-app-test-list.md): iPhone (share menu, print), tablet layout, Share on WhatsApp straight into a real chat (with the owner's own number), printing on a real printer, a Bluetooth tag scanner, a very big bill (50–100 sarees), two real phones selling at the same moment, cancel refused after midnight for real, Sell anyway against a real website checkout.

## 20. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-11 | Plan | The owner agreed: payment mode (Cash / UPI / Card), cancel = owners same day, low-bargain warning under half, no selling without internet. Data shows 1 in 4 bargains is under half the store price (section 3). |
| 2026-10-11 | Mock-up picks | Scan screen A (camera full, bill strip), Complete sale A (one page), theme follows the phone. |
| 2026-10-11 | Built and phone-tested | Backend 195/195, app 65/65. 30 phone checks passed; 6 small problems fixed and re-checked. Changes from the draft: Sell anyway is per saree, lines carry the store price shown, a repeated bill waits for the first. |
| 2026-10-12 | Fixes found in Module 7 | A WhatsApp address now keeps its lines (it was saved as one line); a bill's lines keep their scanned order (`OrderItem.lineNo`, migration `v2_order_lines`). |
| 2026-10-12 | Fixes found in Module 8 | Typing a one- or two-digit tag number ("10" for NH10) on the Sell and Price check screens was refused; the server now searches any typed number. Today's sales (owners) also lists today's paid online orders, with totals by channel, so it matches Home; an unpaid checkout cancelled by "Sell anyway" is not listed. |
| 2026-10-12 | Change from Module 10 | Each sale line now keeps the store price it was sold against (`OrderItem.storePrice`); the sale page reads it before the bargain record. |

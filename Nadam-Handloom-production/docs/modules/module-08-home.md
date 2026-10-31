# Module 8: Home

| | |
|---|---|
| **Status** | **Built and tested on a real Android phone, 2026-10-12** (sections 16–17). All decisions per the ⭐ recommendations (owner: "ok great implement end to end"); mock-up picks A and A (defaults). Open checks: section 19. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Everyone signed in. Owners see money totals, unpaid checkouts, stock running low and the monthly reminder (`sales.view`). Staff see no money totals (Module 2) |
| **Builds on** | [Module 4](module-04-products.md) (stock, uploads), [Module 5](module-05-scan-to-sell.md) (sales, the bill), [Module 6](module-06-invoices.md) (sales summary), [Module 7](module-07-orders.md) (orders to ship, unpaid checkouts) |
| **Mock-up** | [`docs/design/ui-mockup/module-8-home/`](../design/ui-mockup/module-8-home/index.html) |
| **Old system notes** | [`current-system/admin-app-3-selling-orders-invoices.md`](../current-system/admin-app-3-selling-orders-invoices.md), sections 2 (AdminHome, StaffHome) and 5; [`admin-app-1-login-team-settings.md`](../current-system/admin-app-1-login-team-settings.md) (Home tab) |

## 1. Goal
Open the app and know in **five seconds** how the day is going and **what needs doing**: today's sales, orders waiting to ship, anything left unfinished on this phone, and designs running out. Every line on Home is one tap from the screen that deals with it.

## 2. What is in this module
- **Today's sales** (owners): the total, bills and sarees, split Counter / WhatsApp / Online, with yesterday and this month in one small line. An eye button hides the amounts.
- **Staff:** their own sarees and bills today, no money totals.
- **Needs attention:** one list of things to act on, each shown only when there is something (an unfinished bill, orders to ship, an invoice not made, unpaid checkouts, parcels to check, sarees not uploaded, the monthly sales summary, designs running low, sarees without a photo).
- **Shortcuts:** Sell, Price check, Add sarees, Today's sales.
- **Recent sales:** the last 3 today, newest first.
- **Running low** (owners): designs sold out in the last 30 days and designs with 1–3 sarees left.

**Not in this module:**
- Charts, date ranges, best sellers: Analytics (Module 9).
- Recent activity (who did what): Activity log (Module 10).
- Phone notifications for new orders: later (6.9).

## 3. How the shop sells today (copy of the live data, 2026-10-11)
| What | Number |
|---|---|
| Counter bills | **1 to 5 a day** (26 bills from 5 to 10 Oct), **₹10,600 to ₹1,28,238 a day** |
| When | Almost every counter sale is between 1 pm and 11 pm; busiest 7–10 pm |
| WhatsApp orders | 15 on 10 Oct (₹52,500) |
| Online | 2 paid (tests); 18 unpaid checkouts from 4 customers (Module 7) |
| Stock | **1,436 sarees in stock** (limit 5,000). Of the designs (subcategories) with sarees: 60 have more than 3 left, **2 have 1–3 left, 5 are sold out** |
| Sarees without a photo | 6 (in stock) |

## 4. Problems in the old app
1. **The quick-action carousel moves by itself every 3 seconds**, so a button slides away as you reach for it.
2. **"To ship" and "Shipped" tiles show no numbers**: you have to open them to know.
3. **"Recent sales" is sorted by amount, not time**, and scrolls inside its card after about 4 rows.
4. **"Today" follows the server's clock**: on a server set to UTC, the day starts at 5:30 am India time.
5. **Low stock is counted by the server but never shown.**
6. **Nothing reminds you** of unpaid checkouts, a bill left unfinished, photos not uploaded, or the month's sales summary for the accountant.
7. **Money totals are always on screen**, also when a customer at the counter can see the phone.
8. **The Manage grid repeats the tabs and the More page.**

## 5. How it will work

### 5.1 Owner
1. **Top:** "Good evening, Lakshmi", the date, and an eye button (6.2).
2. **Today's sales** (6.1): **₹51,850** · 5 bills · 10 sarees; Counter ₹40,150 · WhatsApp ₹7,200 · Online ₹4,500; below it, small: "Yesterday ₹16,000 · October so far ₹2,74,938". Tap: Today's sales.
3. **Needs attention** (6.4), for example:
   - 🟠 **3 orders to ship**, oldest waiting 2 days → Orders.
   - **1 parcel to check**: shipped 12 days ago → Orders, Shipped.
   - **4 customers didn't finish paying** this week (18 tries) → Unpaid checkouts.
   - **Your bill has 3 sarees**, not finished → the bill.
   - **2 sarees not uploaded yet** → the upload list.
   - **6 sarees without a photo** → Products, "No photo".
   - **5 designs sold out, 2 running low** → Running low.
   - **Send September's sales summary to your accountant** (1st–7th) → the summary.
   - Nothing to do: "All caught up ✓".
4. **Shortcuts** (6.7): Sell · Price check · Add sarees · Today's sales.
5. **Recent sales** (6.8): the last 3 today; "See all".
6. Small at the bottom: "1,436 sarees in stock".

### 5.2 Staff (6.3)
Same page without money totals: "Your sales today: **4 sarees** sold · 2 bills", Needs attention (their unfinished bill, orders to ship, an invoice not made on their own sale, parcels to check, sarees not uploaded, sarees without a photo), the shortcuts, and their own last 3 sales.

### 5.3 Running low (6.5, owners)
Two lists of designs (subcategories), each with photo, name and category:
- **Sold out** (last 30 days): "Last sold 9 Oct · 4 sold in 30 days".
- **Running low** (1–3 left): "2 left · 6 sold in 30 days".
Tap a design: its sarees in Products. Designs that never had a tagged saree are left out.

### 5.4 Keeping it fresh (6.10)
Home updates when opened, when pulled down, and every minute while it is on screen. Offline: the last numbers stay with "Updated 7:52 pm" and the offline banner.

## 6. Decisions
| # | Question | Options | Recommendation |
|---|---|---|---|
| 6.1 | **The owner's sales card** | A Today only (as today) · B ⭐ Today (total, bills, sarees, Counter / WhatsApp / Online) + "Yesterday ₹… · October so far ₹…" | **B.** One look tells you if today is a good day |
| 6.2 | **Hide amounts** | A Always shown · B ⭐ An eye button hides every ₹ on Home ("₹ ••••"), remembered on this phone | **B.** Customers at the counter can see the screen |
| 6.3 | **Staff Home** | ⭐ No money totals: their own sarees and bills today, Needs attention, shortcuts, their own last sales | Same rule as Module 2 and Today's sales |
| 6.4 | **Needs attention** | ⭐ One list, each line only when there is something (section 5.1); "All caught up" when empty | One place to look; nothing to read when all is fine |
| 6.5 | **Stock running low** | A Not shown (as today) · B ⭐ Owners: designs sold out in the last 30 days and designs with 1–3 left · C Owners and staff | **B.** Tells you what to order from the weavers; 5 sold out and 2 low today |
| 6.6 | **Monthly sales summary reminder** | A None · B ⭐ Owners, 1st–7th of the month: "Send September's sales summary to your accountant"; gone once opened on that phone | **B.** GST returns are filed early each month |
| 6.7 | **Shortcuts** | A Moving carousel (as today) · B ⭐ 4 fixed buttons: Sell, Price check, Add sarees, Today's sales | **B.** Buttons that stay still; the rest is in the tabs and More |
| 6.8 | **Recent sales** | A By amount (as today) · B ⭐ The last 3 today, newest first; "See all" | **B.** "Did my last sale go through?" at a glance |
| 6.9 | **Phone notifications for new orders** (from Module 7, 6.9) | A ⭐ Not now: the count on the Orders tab and the line on Home · B Now | **A.** Online orders come from the website, which still runs on the old server; notifications need a Firebase account and an Apple push key. Plan them with the website move |
| 6.10 | **Keeping Home fresh** | ⭐ On open, pull down, every minute while open; offline: last numbers with "Updated 7:52 pm" | Cheap, and always close to live |

## 7. Screens and mock-up picks
| Screen | What's on it |
|---|---|
| Home · Owner | Sales card, Needs attention, shortcuts, recent sales, stock count |
| Home · Staff | Their sarees today, Needs attention, shortcuts, their recent sales |
| Home · All caught up | Nothing to do |
| Home · Amounts hidden | Every ₹ as "₹ ••••" |
| Home · Offline | Last numbers, "Updated 7:52 pm" |
| Running low | Sold out and running low designs |
| Home · Tablet | Two columns |

**Picks (mock-up "Design options"):**
- **Home layout:** A · one list (sales card, then Needs attention as rows) / B · tiles (a grid of number tiles: Today, To ship, Unpaid, Running low, then the rest).
- **Sales card:** A · one card with a coloured bar for Counter / WhatsApp / Online / B · three small channel cards under the total.

## 8. Rules
| Rule | Value |
|---|---|
| A sale counts | Counter and WhatsApp sales not cancelled; online orders paid (processing, shipped, delivered), not cancelled. By the day it was placed, India time. Module 9 uses the same rule |
| Yesterday · this month | The whole of yesterday · the 1st of this month until now (India time) |
| Today's sales screen (Module 5) | Also lists today's paid online orders (owners), so its total matches Home |
| Orders to ship | Module 7's To ship; amber when the oldest has waited more than 24 hours |
| Parcel to check | Shipped more than 10 days ago, not marked delivered |
| Unpaid checkouts on Home | From the last 7 days (the full list keeps 30 days) |
| Invoice not made | A sale that asked for an invoice and has none (last 30 days, not cancelled). Staff: their own sales |
| Running low · sold out | 1–3 sarees in stock in a design · none left, at least one sold in the last 30 days |
| Monthly reminder | Owners, 1st–7th; hidden on that phone once the summary is opened |
| Hide amounts | On this phone; Home only (Today's sales still shows amounts) |
| Staff | The server never sends money totals to staff (not just hidden) |

## 9. Data (same live database)
- **No database changes.** Reads `Order`, `OrderItem`, `Invoice`, `Shipment`, `Piece`, `Product`, `Subcategory`.
- Phone-only items (unfinished bill, uploads, unsaved batch, hide amounts, summary reminder seen) come from the phone, not the server.

## 10. API (as built, under `/api/v2`)
| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/home` | `{ date, day, updatedAt, scope, sales, attention, recent, stock }`. Owners: `sales.today` (amount, bills, sarees, byChannel), `yesterday`, `month`; Staff: `sales.mine` (bills, sarees) only. `attention`: toShip (count, oldestDays), toCheck (count, oldest date, its order when there is one), invoiceMissing (staff: their own), noPhoto; owners also unpaid (7 days), stock (soldOut, low), monthSummary (1st–7th) | Everyone signed in (reply depends on role) |
| GET | `/home/stock` | `{ days, soldOut, low }`: design, category, photo, left, sold in 30 days, last sold | sales.view |

## 11. Building blocks
**Backend:** `models/stats.model.js` (which sales count, sums by day and channel: reused by Analytics), `services/home.service.js`, controller, routes, tests; Module 5's `today()` adds paid online orders for owners.

**App:** the Home tab (replacing the placeholder), `api/home.js`, the Running low page, Home pieces (sales card, attention rows, shortcuts), the phone's own items from the bill, upload queue and batch stores.

## 12. Steps
1. Plan (this document). ✅ All ⭐ recommendations agreed.
2. Mock-up, clickable, in Chrome. ✅ (83/83 browser checks; picks A and A)
3. Backend + tests. ✅ (section 16)
4. App + tests. ✅ (section 16)
5. Real-phone test ✅ (section 17): owner and staff Home after a few sales; hide amounts; each attention line opens the right screen; running low; offline; tablet layout if a tablet is free.
6. Results written here; open checks to the full-app test list. ✅

## 13. Testing plan
- **API:** which sales count (cancelled, unpaid, online paid), India day edges (11:59 pm / 12:01 am), yesterday and month sums, staff get no money and only their own sales, attention counts (to ship, 10 days, unpaid 7 days, invoice missing), running low and sold out, owners only.
- **App:** greeting, hidden amounts, attention list building, "Updated" time.
- **Real phone:** section 12, step 5.

## 14. Risks
| Risk | Handling |
|---|---|
| Home becomes slow as sales grow | Sums run in the database with indexes on the order date; the reply is small |
| Totals on Home and in Today's sales disagree | One shared rule (section 8) and a test comparing both |
| A busy Needs attention list nobody reads | Each line only when there is something; most urgent first (unfinished bill, orders to ship) |

## 16. Build status (2026-10-12)
| Part | What | Checks |
|---|---|---|
| Database | No changes | — |
| Server | `models/stats.model.js` (which sales count, day sums, to ship / to check / unpaid / invoice missing / no photo / running low), `services/home.service.js`, routes `/api/v2/home`. Module 5's Today's sales now also lists today's paid online orders for owners, with totals by channel, so it matches Home | **244/244** server tests (Module 8: 8 API + 6 unit) |
| App | Home tab (picks A and A) in `app/(app)/home/` (Home and Running low), `utils/home.js` (the Needs attention list), `home/prefs.js` (hide amounts and the reminder, kept on the phone), `hooks/useBack.js` (Back from a screen opened on Home returns to Home). Products opens on a filter, Orders on a tab, the summary on "Last month" when Home asks | **81/81** app tests (Module 8: 6), lint clean |
| Mock-up | `docs/design/ui-mockup/module-8-home/` | 83/83 browser checks |

Changes from the plan: "1 parcel to check" opens that order straight away (more than one: the Shipped list); a photo draft not saved ("Sarees not saved yet: 3 of 8 photos tagged") is also a Needs attention line.

## 17. Real-phone test (2026-10-12, Samsung Note10 Lite, test app)
Owner = Lakshmi (test), Staff = Anil (test), local copy through the USB cable. Test orders made on the local copy: a WhatsApp order waiting 2 days, a parcel shipped 12 days ago, a paid online order, and a counter sale whose invoice wasn't made.

| # | Check | Result |
|---|---|---|
| 1 | Staff Home: "Your sales today", no money totals, no eye button; only their own to-dos | ✅ |
| 2 | "6 sarees without a photo" → Products on the "No photo" filter, 6 sarees | ✅ |
| 3 | Staff sale from the Sell shortcut: Home first shows "Your bill has 1 saree, not finished" → the bill → Complete sale; Home then shows "1 saree sold · 1 bill" and the sale in Recent | ✅ (after fix 1) |
| 4 | Staff: "2 orders to ship · Oldest waiting 2 days" (amber), "Invoice not made" on their own sale → the sale → Make the invoice → the line is gone; "1 parcel to check" | ✅ |
| 5 | Owner Home: today ₹13,600 · 4 bills (Counter ₹7,200 · WhatsApp ₹3,600 · Online ₹2,800), yesterday ₹21,800, October so far ₹3,01,498.10, **all equal to the database** | ✅ |
| 6 | Eye button: every ₹ on Home hidden (also in Recent sales), still hidden after closing and reopening the app; Today's sales still shows the amounts | ✅ |
| 7 | Sales card → Today's sales: same total, the online order with an "Online" badge, "Online ₹2,800" in the payment line | ✅ (after fix 2) |
| 8 | Running low: 5 sold out (last sold, how many in 30 days), 2 with 1–3 left (Test1, Scallop Kollam); a design opens its sarees in Products | ✅ |
| 9 | Unpaid checkouts (4 customers · 18 tries), parcel to check, orders to ship: each opens the right screen | ✅ (after fixes 4 and 5) |
| 10 | A sale made "on another phone" (from the Mac) appeared on Home by itself within a minute (4 → 5 bills) | ✅ |
| 11 | Server cut off: "Can't reach the server" bar, the last numbers stay, "Updated 7:13 am" in amber | ✅ |
| 12 | Back from a sale and from Today's sales opened on Home returns to Home; the Scan tab still opens on the camera | ✅ (after fix 3) |

**Problems found and fixed (re-checked):**
1. **Typing a one- or two-digit tag number on the Sell screen ("10" for the old tag NH10) was refused** as "doesn't look like a tag" (Module 5; 96 such tags in the shop). The server now searches any typed number. Scanning the label always worked.
2. Today's sales listed an **unpaid website checkout that an owner's "Sell anyway" had cancelled** (Module 5 test leftover) as a cancelled online sale. Only paid online orders are listed now.
3. Back from a screen opened on Home (a sale, Today's sales, the bill, unpaid checkouts…) went to that tab's first screen, e.g. the Sell camera. It now returns to Home.
4. "1 parcel to check" opened the Shipped list with that parcel at the bottom; one parcel now opens its order.
5. "Orders to ship" opened the Orders tab on whichever list was open last (Shipped); it now always opens To ship.
6. Found by the full test run: **two taps at once on "make an invoice later" (Module 6) could give the second phone "This sale was recorded with an invoice"**. The second now gets the same invoice.
7. Offline, the time shows as "Updated 7:13 am" at once (it said "just now" for up to a minute).

Not tested: tablet (two columns, tested in the mock-up only), iPhone, the phone's own back button (the test never presses it unless the keyboard is open), the monthly reminder (only shows 1st–7th; covered by tests), photo draft / upload lines with real uploads.

## 18. Switch-over notes
- No database changes for Home.
- "Test1" (₹10, Fabrics) shows under Running low: it looks like a test design. The owner didn't say; it was left as it is. Delete it in Catalogue if it is a test.

## 19. Left for the full-app test
Added to [`docs/testing/full-app-test-list.md`](../testing/full-app-test-list.md): tablet layout, iPhone, the monthly reminder (1st–7th), the phone's own back button from a screen opened on Home, the photo draft and upload lines with real uploads, a phone with no internet at all, and the "sale waiting for an answer" line.

## 20. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-12 | Plan and mock-up | Data: 1–5 counter bills a day, busiest 7–10 pm; 1,436 sarees in stock; 5 designs sold out, 2 low; 6 without a photo. Decisions 6.1–6.10, picks A/B. Asked about "Test1". |
| 2026-10-12 | Decisions | Owner: "ok great implement end to end": all ⭐ recommendations; picks left as A and A; "Test1" not answered, left as it is. |
| 2026-10-12 | Built and phone-tested | Server 244/244, app 81/81, mock-up 83/83; 12 phone checks passed; 7 problems fixed (1 in Module 5's tag lookup, 1 in Module 6's invoice later, 1 in Module 5's Today's sales). |
| 2026-10-12 | Fix found in Module 9 | Back from a screen opened on Home now always leaves that tab at its first screen (before, the More tab could still show the screen). The "October so far" line opens Analytics. |

## Change 15 Oct 2026: pages open on top, so Back and the iPhone swipe work

**What the testers saw:** on iPhone, swiping from the left edge did not go back, and Home → "Add sarees" did nothing.

**Why:** each tab had its own pile of pages, and links from Home (Price check, Today's sales, a sale, an order, Add sarees…) opened their page inside another tab. The on-screen Back arrow was coded to jump to Home (`?back=home`), but the iPhone swipe can only go back within one pile, and under those pages there was nothing, or the wrong page (for example the Sell camera). Separately, "Add sarees" on Home opened step 2 without a subcategory.

**Now:**
- `app/(app)/_layout.js` is one stack. At the bottom: `(tabs)/` with only the five main pages (`home.js`, `orders.js`, `scan.js`, `products.js`, `more.js`) and the menu. Every other page (all the folders under `app/(app)/`) opens on top of whatever is showing. Web addresses are unchanged (`/scan/today`, `/products/add/pick`…).
- Back, the iPhone swipe and Android's back all return to the page the new one was opened from, in any tab. `hooks/useBack.js` is now just "the page before"; `?back=` is only used when there is no page before (the app reopened on that page).
- The floating menu shows on the five main pages only; pages on top use the full screen (`hooks/useTabBarSpace.js` leaves room for the menu only on main pages).
- To go back to a tab from a page on top, use `router.dismissTo('/products')` (Back to Products, Hide, Go to Home). `router.navigate()` or `router.replace()` to a tab from there would open a second copy of the tabs; a test guards this.
- "Sold" (after a sale) has a Back arrow that starts the next customer; the iPhone swipe is off there, because it would land on the finished bill.
- "Add sarees" on Home opens step 1, choose the subcategory, like Products → Add.

**Checked:** 117/117 app tests, including `hooks/navigation.test.js` (Expo Router's own navigation over the real list of pages: Home → Add sarees and back, pages from Home return to Home, chains, tabs, after a sale, Back to Products, a page opened from a link) and `hooks/useTabBarSpace.test.js`; lint clean; the app bundles for iPhone and Android. Not yet checked by hand on a phone at the time of writing: iPhone build 8 (TestFlight, Dheeraj) and Android build 26.

## Change 16 Oct 2026: staff Home counts every bill
A staff member's "Today" on Home counted only the first page of the day's bills (20). It now counts every bill of the day (`today()` returns `counts`). Live 16 Oct 15:33 IST. Test: 25 bills show 25.

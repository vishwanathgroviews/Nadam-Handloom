# Module 9: Analytics

| | |
|---|---|
| **Status** | **Built and tested on a real Android phone, 2026-10-12** (sections 16–17). Picks: **Layout B (tabs)**, **Chart A (bars)**, theme follows the phone (light and dark). Decisions per the ⭐ recommendations (the owner sent the picks without changing any). Open checks: section 19. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners (`analytics.view`) |
| **Builds on** | [Module 5](module-05-scan-to-sell.md) (sales, bargains, who sold), [Module 7](module-07-orders.md) (online and WhatsApp orders), [Module 8](module-08-home.md) (the rule for which sales count) |
| **Mock-up** | [`docs/design/ui-mockup/module-9-analytics/`](../design/ui-mockup/module-9-analytics/index.html) |
| **Old system notes** | [`current-system/admin-app-3-selling-orders-invoices.md`](../current-system/admin-app-3-selling-orders-invoices.md), section 5 (Analytics) |

## 1. Goal
For any period, see **how much was sold, what sold, how it sold** (counter, WhatsApp, online; cash, UPI, card; how much was bargained), **who sold it and when**, so the owner can decide what to order from the weavers, how to price, and how to staff the shop.

## 2. What is in this module
- **Period:** Today, 7 days, 30 days, This month, Last month, or any dates. **Channel:** All, Counter, WhatsApp, Online.
- **The headline:** sales ₹, bills, sarees, average bill, each compared with the period before ("↑ 12% vs the 7 days before").
- **Sales chart:** a bar per day (per hour for a single day).
- **Best-selling designs:** the top 10 by sarees sold, with ₹; tap one to see its sarees.
- **Bargains:** what customers paid compared with store prices.
- **By person:** each person's bills, sarees, ₹ and bargains.
- **Payment:** Cash, UPI, Card, Online.
- **Busiest hours** (and days of the week, once there are 4 weeks of sales).
- **Stock:** sarees in stock, their value at store prices, designs that haven't sold for 60 days.

**Not in this module:**
- Profit: the buying price of sarees isn't recorded anywhere (6.11).
- Website visits and how many visitors buy: needs the website (later).
- GST figures and the accountant's file: the sales summary (Module 6).
- Returns: not handled yet (Module 7, 6.10).

## 3. What the data shows today (copy of the live data, 2026-10-11)
| What | Number |
|---|---|
| History | **Tagged sales started on 5 Oct 2026** (all sarees were added in October), so there is about one week of sales so far. The charts fill in as the weeks go by |
| Sales 5–10 Oct | **40 bills, 115 sarees, ₹2,69,698**; average bill ₹6,742 |
| Designs sold | 26 designs. Top by sarees: 50/50 Digital print (16), 50/50 Plain Saree (13), 50/50 dye Screen Printed Saree (10) |
| Bargains | **92 of 107 counter and WhatsApp sarees were sold below the store price; customers paid 51% of store prices on average** (₹2.42 lakh below store prices) |
| Who sold | 35 of 38 bills were made from two owner accounts named **"System Admin"** (27 bills) and **"Admin 8565"** (8): real accounts with their own phone numbers. Give them real names in Team so Analytics shows who they are |
| Payment | Not recorded on 35 of 40 bills (the old app didn't ask). The new app always asks |
| Busiest hours | Almost every counter sale between 1 pm and 11 pm; busiest 7–10 pm |
| Stock | 1,535 sarees in stock worth **₹64.5 lakh at store prices** (plus 44 "Gap Border bramini sarees" at the mistaken ₹54,310 each, see section 14) |

## 4. Problems in the old app
1. **Only Today, 7 days, 30 days or custom**: no "this month" or "last month".
2. **The comparison with the period before is worked out by the server but never shown.**
3. **No chart**: the app sends a "group by" choice that the server ignores.
4. **Top 5 subcategories by ₹ only**; the sarees count is sent but not shown.
5. **Nothing about bargains**, although almost every counter sale is bargained.
6. **Nothing per person, per payment type or per hour.**
7. "7 days" means today plus the 6 days before here, but 8 calendar days on the Orders and Invoices screens.

## 5. How it will work

### 5.1 Opening it
Owners: **More → Analytics**, or tap the "October so far" line on Home's sales card (opens This month).

### 5.2 The page (pick A: one page of cards)
1. **Period and channel** at the top (chips; "Any dates" opens the calendar from Module 6).
2. **Headline:** ₹2,69,698 · 40 bills · 115 sarees · average bill ₹6,742; under each, "↑ 12% vs the 7 days before" (green up, amber down; nothing when the period before had no sales). Cancelled sales are left out, with a small line "2 cancelled (₹13,140), not counted".
3. **Sales chart:** one bar per day; tap a bar for that day's ₹ and bills. A single day shows hours. Longer than 3 months: one bar per week.
4. **Best-selling designs:** top 10 with photo, sarees and ₹, and a small bar; "By sarees / By ₹" switch; "See all"; tap a design to see its sarees (Products).
5. **Bargains (counter and WhatsApp):** "Customers paid **51%** of store prices · ₹2.42 lakh below store prices · 92 of 107 sarees bargained". The designs bargained most.
6. **By person:** each person's bills, sarees, ₹ and the share of store price they sold at. Old-app sales show as "Not recorded".
7. **Payment:** Cash, UPI, Card, Online, Not recorded, with ₹ and bills.
8. **Busiest hours:** a bar per hour (10 am–11 pm). Days of the week appear once there are 4 weeks of sales.
9. **Stock:** sarees in stock, value at store prices, and designs in stock that haven't sold for 60 days (from early December, 60 days after tagging started).

## 6. Decisions
| # | Question | Options | Recommendation |
|---|---|---|---|
| 6.1 | **Who sees Analytics** | ⭐ Owners only (as today) | Money and staff figures |
| 6.2 | **Periods** | A Today, 7 days, 30 days, custom (as today) · B ⭐ Also This month and Last month; "7 days" = today and the 6 days before, everywhere | **B.** Months match the accountant's and GST months |
| 6.3 | **Compare with the period before** | A Not shown (as today) · B ⭐ "↑ 12% vs the 7 days before" under each figure; This month compares with the same days of last month | **B.** Tells you at once whether sales are growing |
| 6.4 | **Sales chart** | A None (as today) · B ⭐ A bar per day (hours for one day, weeks for over 3 months) | **B.** Shows good and bad days |
| 6.5 | **Best sellers** | A Top 5 by ₹ (as today) · B ⭐ Top 10 designs by sarees sold, switch to ₹, "See all", tap to open | **B.** Sarees sold tells you what to re-order |
| 6.6 | **Bargains** | A Not shown · B ⭐ What customers paid against store prices, overall, per design and per person | **B.** Almost every counter sale is bargained (51% of store price on average); this shows whether store prices or discounts need a look |
| 6.7 | **By person** | A Not shown · B ⭐ Each person's bills, sarees, ₹ and bargains (owners only) | **B.** Fair comparison of the counter staff; old sales show "Not recorded" |
| 6.8 | **Payment** | ⭐ Cash, UPI, Card, Online for the period | For checking the cash and the bank; old sales "Not recorded" |
| 6.9 | **Busiest times** | ⭐ Hours now; days of the week after 4 weeks of sales | For deciding who works when |
| 6.10 | **Stock** | A Not in Analytics · B ⭐ Sarees in stock, value at store prices, designs not sold for 60 days | **B.** Shows money sitting on the shelf and what isn't moving |
| 6.11 | **Profit** | A ⭐ Later: needs a buying price per design, which isn't recorded today · B Add a buying price to each design now (Catalogue) | **A.** Tell us if you want B: it adds one field to every design |
| 6.12 | **Download or share Analytics** | A ⭐ Not now: the sales summary PDF and Excel (Module 6) already go to the accountant · B A PDF of this page | **A.** Avoids a second report to keep up |

## 7. Screens and mock-up picks
| Screen | What's on it |
|---|---|
| Analytics | Period, channel, headline, chart, best sellers, bargains, by person, payment, busiest hours, stock |
| All designs | Every design sold in the period, by sarees or ₹ |
| One person | Their bills, sarees, ₹, bargains, best designs |
| Any dates | The calendar (Module 6) |
| Analytics · Tablet | Two columns |

**Picks (mock-up "Design options"):**
- **Layout:** A · one page of cards (scroll down) / B · four tabs at the top: Sales · Designs · People · Stock.
- **Chart:** A · bars / B · a line.

## 8. Rules
| Rule | Value |
|---|---|
| A sale counts | Same as Home: counter and WhatsApp sales not cancelled; online orders paid, not cancelled. By the day placed, India time |
| Amounts | Bill totals as paid (GST included, after bargains) |
| Periods | Today; 7 days = today and the 6 days before; 30 days = today and the 29 before; This month = the 1st to today; Last month; any dates up to today |
| The period before | The same number of days just before (This month: the same days of last month; Last month: the month before) |
| Chart | A bar per day; a single day: per hour; more than 92 days: per week |
| Best sellers | By design (subcategory); the old app's lines without a design are grouped by name |
| Bargains | Counter and WhatsApp only (online uses website prices). Store price = the price when sold (recorded with each bargain) |
| Who sold | The person who made the sale (Module 5); old-app sales "Not recorded" |
| Slow designs | In stock, nothing sold for 60 days, and in the shop for at least 60 days |
| Stock value | In-stock sarees × their design's store price |

## 9. Data (same live database)
- **No database changes.** Reads `Order`, `OrderItem`, `Piece`, `Product`, `Subcategory`, `Category`, `StockLedger` (who sold), `AuthEvent` (bargains: the store price when sold).
- All sums run in the database, so a year of sales stays quick.

## 10. API (as built, under `/api/v2`)
| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/analytics?period=today\|7d\|30d\|month\|last\|custom&from=&to=&channel=` | `{ range, previous (with its totals), history, totals, cancelled, chart, designs (every design sold), bargains, people, payments, hours, weekdays }`. The server works out the dates in India time | analytics.view |
| GET | `/analytics/people/:id?period=…` | One person: totals, share of store price, top 5 designs, last 10 bills | analytics.view |
| GET | `/analytics/stock` | Sarees in stock, value at store prices, the 5 designs holding most value, **prices to check**, designs not sold for 60 days (or the date they start) | analytics.view |

## 11. Building blocks
**Backend:** `models/stats.model.js` (Module 8's rule, extended with sums by day, design, person, payment, hour), `services/analytics.service.js`, routes, tests.

**App:** the Analytics page in More (owners), a small bar chart drawn with plain views (no new native module), the period chips and Module 6's calendar, design and person pages; Home's month line opens it.

## 12. Steps
1. Plan (this document). ✅ Decisions per ⭐.
2. Mock-up, clickable, in Chrome. ✅ (77/77 browser checks; picks B and A)
3. Backend + tests. ✅ (section 16)
4. App + tests. ✅ (section 16)
5. Real-phone test ✅ (section 17): each period and channel against the database; the comparison; tap a bar, a design, a person; bargains; staff can't open it; tablet if free.
6. Results written here; open checks to the full-app test list. ✅

## 13. Testing plan
- **API:** which sales count; period edges in India time (11:59 pm / 12:01 am, month ends); the period before; chart buckets (hour, day, week); top designs and grouping of old lines; bargains from the recorded store price; people (old sales "Not recorded"); payment; slow designs; staff refused.
- **App:** period dates, percentage text, chart scaling.
- **Real phone:** section 12, step 5.

## 14. Risks
| Risk | Handling |
|---|---|
| **"Gap Border bramini sarees" still has the mistaken store price ₹54,310** (raised in Module 3) | It makes its 6 sales look like 4% of store price and adds ₹24 lakh to the stock value. **Fix the price in Catalogue**; Analytics then corrects itself (bargains use the price recorded at each sale, so past sales keep the old figure) |
| Only one week of history | The page says so ("Sales recorded from 5 Oct 2026"); charts and comparisons fill in over the weeks |
| Old-app sales without a person or payment | Shown as "Not recorded", never guessed |
| Slow queries over a long period | Sums in the database, with the existing index on channel and date |

## 16. Build status (2026-10-12)
| Part | What | Checks |
|---|---|---|
| Database | No changes | — |
| Server | `utils/period.js` (periods and the period before, India days), `models/analytics.model.js`, `services/analytics.service.js` (figures, chart, designs, bargains from the store price recorded at each sale, people, payment, hours, days, stock, prices to check), routes `/api/v2/analytics` (owners) | **259/259** server tests (Module 9: 7 API + 8 unit) |
| App | More → Analytics (owners) and Home's "October so far · Analytics" link; tabs Sales · Designs · People · Stock (pick B), bars from plain views (pick A, no new native module); All designs; One person; the Module 6 calendar for any dates | **85/85** app tests (Module 9: 4), lint clean |
| Mock-up | `docs/design/ui-mockup/module-9-analytics/` | 77/77 browser checks |

Changes from the plan:
- **Prices to check** (Stock tab): designs in stock whose store price is above the MRP or more than 3 times the website price. Found while building: besides the ₹54,310 typo, **46 designs still have the starting price ₹11,999** (website ₹2,000, MRP ₹16,999); 3 of them have 67 sarees in stock and 4 have sold at that "store price", which makes their bargains look like 11–20%. Two designs are priced ₹9 and ₹10 (150 checks embroidery, 20 in stock; Test1).
- Every design sold comes with the main figures, so "All designs" needs no separate call.
- Stock counts sarees by tag (1,579); Products counts listings (1,430) because some old listings hold more than one saree. The Stock tab says so.
- A rise of 1,000% or more reads "↑ 74×".

## 17. Real-phone test (2026-10-12, Samsung Note10 Lite, test app)
Owner = Lakshmi (test), Staff = Anil (test), local copy through the USB cable.

| # | Check | Result |
|---|---|---|
| 1 | Home's "October so far · Analytics" opens This month: ₹3,05,098.10 (same as Home), 50 bills, 125 sarees, average ₹6,102; "Nothing to compare yet" against 1–12 Sep; 3 cancelled (₹15,940) not counted | ✅ |
| 2 | Bar per day; tapping 5 Oct shows "Mon 5 Oct: ₹1,31,238.10 · 6 bills" | ✅ |
| 3 | 7 days (6–12 Oct, "↑ 29% vs the 7 days before"), Today (by hour, "↓ 21% vs yesterday"), Last month (Sep against August), any dates 5–10 Oct (₹2,66,098.10 · 39 bills · 114 sarees, **equal to the database**) | ✅ |
| 4 | Designs: top 10 by sarees, See all 26 designs; Bargains 48% of store prices, "Bargained most" | ✅ |
| 5 | People: System Admin, Lakshmi (test), Admin 8565, Anil (test) with bills, sarees, share of store price; Anil's page with his designs and last bills | ✅ |
| 6 | Stock: 1,579 sarees, ₹88.35 lakh; Prices to check lists the ₹54,310 and ₹11,999 designs; "Not sold for 60 days" from 3 Dec 2026 | ✅ |
| 7 | Online: "no bargains", "placed by customers on the website" | ✅ |
| 8 | Back from Analytics opened on Home returns to Home; from More returns to More | ✅ (after fix 1) |
| 9 | Staff: no Analytics in More; opening it says it's for owners (the server refuses too) | ✅ |
| 10 | Dark mode (phone switched to dark for the check, then back to light) | ✅ |

**Problems found and fixed (re-checked):**
1. After going back to Home from Analytics, the More tab still showed Analytics instead of the More page (Back from a screen opened on Home only cleared that tab when something was under it). The tab now always starts at its first screen; this also covers Module 8's links.
2. Comparing with a nearly empty week showed "↑ 7292%"; above 1,000% it now reads "↑ 74×".

Not tested: tablet (two columns, checked in the mock-up only), iPhone, days of the week (they appear after 4 weeks of sales), slow designs (from 3 Dec 2026).

## 18. Switch-over notes
- No database changes.
- **Fix the store prices** listed under Analytics → Stock → Prices to check (the ₹54,310 typo, the ₹11,999 starting prices, ₹9 and ₹10). Past sales keep the store price recorded when they were sold.
- Rename the owner accounts "System Admin" (9494170180) and "Admin 8565" (7382388565) in Team to the people who use them.

## 19. Left for the full-app test
Added to [`docs/testing/full-app-test-list.md`](../testing/full-app-test-list.md): tablet layout, iPhone, days of the week after 4 weeks of sales, slow designs from 3 Dec 2026, and the figures once the prices are fixed.

## 20. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-12 | Plan and mock-up | Data: tagged sales only since 5 Oct (one week); customers paid 51% of store prices on 92 of 107 counter/WhatsApp sarees; who sold and payment mostly not recorded by the old app; stock ₹64.5 lakh at store prices; the ₹54,310 typo still distorts figures. Waiting for decisions 6.1–6.12 and picks (layout, chart). |
| 2026-10-12 | Picks and decisions | Owner: Layout B (tabs), Chart A (bars), theme light/dark/auto (follows the phone). Decisions not changed, so ⭐ throughout (profit and a download stay "later"). |
| 2026-10-12 | Built and phone-tested | Server 259/259, app 85/85, mock-up 77/77; 10 phone checks passed; 2 problems fixed. Found 46 designs still at the starting price ₹11,999 and 2 at ₹9/₹10: added "Prices to check". |
| 2026-10-12 | Change from Module 10 | Bargains read each sale line's own store price first (the log only for older lines), so the old server's 30-day log deletion can't change them. A design opened from Analytics comes back to Analytics. |

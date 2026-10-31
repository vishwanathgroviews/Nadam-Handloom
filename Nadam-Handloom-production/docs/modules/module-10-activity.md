# Module 10: Activity log

| | |
|---|---|
| **Status** | **Built and tested on a real Android phone, 2026-10-12** (sections 16–17). Picks: **List A (rows under each day)**, **Filters B (one Filter sheet)**, theme light / dark / auto. Decisions per the ⭐ recommendations (the owner sent picks without changing any). Open checks: section 19. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners (`activity.view`) |
| **Builds on** | Every module writes to the activity trail: [Module 1](module-01-sign-in.md) (sign-in), [2](module-02-roles-and-team.md) (team), [3](module-03-categories.md) (catalogue, prices), [4](module-04-products.md) (products, tags), [5](module-05-scan-to-sell.md) (sales, bargains), [6](module-06-invoices.md) (invoices), [7](module-07-orders.md) (orders) |
| **Mock-up** | [`docs/design/ui-mockup/module-10-activity/`](../design/ui-mockup/module-10-activity/index.html) |
| **Old system notes** | [`current-system/admin-app-1-login-team-settings.md`](../current-system/admin-app-1-login-team-settings.md) (Audit Log) |

## 1. Goal
Answer **"who did what, and when?"** in seconds: who changed a price, who cancelled a sale, who sold a saree below half its price, who deleted a product, who signed in on a new phone. In plain words, searchable, and kept long enough to settle any question later.

## 2. What is in this module
- **Activity** (More → Activity, owners): every action in the shop, newest first, grouped by day, in plain words: "System Admin changed the store price of Gap Border bramini sarees: ₹3,800 → ₹54,310".
- **Filters:** kind (Sales, Orders, Prices and catalogue, Products and tags, Team, Sign-in), person, period, **Important only**; **search** by tag, order number, design or person.
- **One entry:** every detail (before → after, tags, amounts, phone used) and a link to the sale, order, saree, design or person.
- **Repeated actions grouped:** "System Admin added 48 sarees to Rainbow checks sarees" is one line; open it to see each.
- **Important actions marked:** price changes, cancellations, "Sell anyway", big bargains, deletions, tag replacements, role changes, new phones, locked PINs.
- **Kept for years**, not 30 days (6.2), and bargain prices copied onto the sale itself (6.3).

**Not in this module:**
- Website customers' sign-ins (the website, later).
- Phone notifications for alerts (notifications are planned with the website move).
- Undo: the log records; changes are made on their own screens.

## 3. What is recorded today (copy of the live data, 4–12 Oct 2026)
| What | Number |
|---|---|
| Staff-app records | **3,687 in 9 days**: 1,530 sarees added and 1,532 photos (the big stock entry), 95 bargains, 72 price changes, 88 catalogue PDFs, 50 product edits, 29 products deleted, 20 orders shipped, sign-ins and team changes |
| Busiest days | 790 records a day while the stock was being entered (7–9 Oct) |
| **Example** | **10 Oct, 4:31 pm: "System Admin" changed the store price of Gap Border bramini sarees from ₹3,800 to ₹54,310**: the typo found in Modules 3 and 9 (the right price is probably ₹3,800) |
| Without a person | Catalogue PDFs and some old sign-in records name nobody |
| Website customers | 47 records (sign-ups and sign-ins) |
| **Kept** | **30 days only: the old server deletes every staff-app record older than 30 days, every 6 hours** (`retention.service.ts`). The first deletions come around **4 Nov 2026**, and they include the **bargain records that Analytics uses** (Module 9) and the new app's records too |

## 4. Problems in the old app
1. **Records are deleted after 30 days**, including the bargain prices Analytics needs and the history of tracking numbers (Module 7).
2. **Only date chips** (Today, 7 days, 30 days): no kind, person or search, although the server can filter by kind.
3. **Bulk work floods the list**: 1,530 "Product created" rows in a week.
4. **Unknown kinds show their code** ("subcategory_catalog_pdf_generated" made readable).
5. **Some entries name nobody** ("Person not recorded").
6. An error while loading more is never shown once some entries are on screen.
7. Asking for a PIN reset code isn't recorded (asking for a first-time code is).

## 5. How it will work

### 5.1 The list (pick A: rows by day)
- Under **Today**, **Yesterday**, **Sat 10 Oct**: each row has an icon for its kind, one plain sentence, the time and the phone ("Lakshmi's iPhone").
- **Important** rows have an amber mark (6.7).
- Grouped rows: "System Admin added **48 sarees** to Rainbow checks sarees · 10:02–10:41 am" → opens the 48.
- Loads 20 at a time as you scroll (all lists, 2026-10-12); pull down to refresh.

### 5.2 Filters and search (pick A: chips + Filters)
- Chips: All · Sales · Orders · Prices and catalogue · Products and tags · Team · Sign-in.
- **Filters** button: person (everyone in the team, also former members), period (Today, 7 days, 30 days, any dates), Important only.
- **Search**: a tag (NH2264), an order or invoice number, a design name, a person.

### 5.3 One entry
A sheet with the sentence, who, when (date and time), which phone, and the details: before → after (prices, names, roles, tags), amounts, the order or invoice number. **Open** goes to the thing itself (sale, order, saree, design, person) when it still exists.

### 5.4 Keeping the records (6.2, 6.3)
- The new server **never deletes** sales, price, stock, order or team records (8 years and more); sign-in records are kept 1 year.
- **Switch off the old server's 30-day deletion before 4 Nov 2026** (a one-line setting on the old server; ask the developer who runs it).
- Each sale line also keeps **the store price it was sold against** (a one-time copy of the 95 old bargains, then every new sale), so Analytics' bargains never depend on the log.

### 5.5 Security alerts on Home (6.8)
For 24 hours, owners' Home shows "1 security alert: Ravi's PIN was locked after 5 wrong tries" or "A stolen sign-in was blocked" → opens Activity on Sign-in.

## 6. Decisions
| # | Question | Options | Recommendation |
|---|---|---|---|
| 6.1 | **Who sees Activity** | ⭐ Owners only (as today) | It shows everyone's actions |
| 6.2 | **How long records are kept** | A 30 days (as today) · B ⭐ Sales, prices, stock, orders and team: 8 years and more; sign-ins: 1 year; **switch the old 30-day deletion off before 4 Nov 2026** | **B.** They settle questions months later (who changed this price?) and Analytics needs the bargain records. Storage is tiny |
| 6.3 | **Bargain prices on the sale itself** | A Only in the log (as today) · B ⭐ Also on each sale line (copy the 95 old ones once, then every sale) | **B.** A sale's store price is sales data, not just a log entry |
| 6.4 | **How entries read** | A Titles like "Price changed" (as today) · B ⭐ One plain sentence with the details: "Lakshmi changed the store price of Rainbow checks sarees: ₹3,400 → ₹3,600" | **B.** Readable without opening anything |
| 6.5 | **Repeated actions** | A One row each (as today: 1,530 rows) · B ⭐ Grouped: same person, same action, same design, minutes apart → one row with a count | **B.** Big stock entries stay readable |
| 6.6 | **Filters and search** | A Dates only (as today) · B ⭐ Kind, person, period, Important only, and search (tag, order, design, person) | **B.** "Who touched NH2264?" in one search |
| 6.7 | **Important actions** | A Not marked · B ⭐ Amber mark and an "Important only" filter: price changes, cancellations, "Sell anyway", bargains under half the store price, deletions, tag replaced or removed, role changes, people removed, new phones, locked PINs, stolen sign-ins blocked | **B.** The few entries worth a look stand out |
| 6.8 | **Security alerts on Home** | A None · B ⭐ Owners' Home shows a line for 24 hours after a locked PIN or a blocked stolen sign-in | **B.** Rare, but worth knowing the same day |
| 6.9 | **Website customers' records** | ⭐ Not shown here | They belong to the website (later) |
| 6.10 | **IP addresses** | A Show them · B ⭐ Not shown; the phone's name and type instead | **B.** The phone means something to you; an IP address doesn't |
| 6.11 | **Download** | A ⭐ Not now · B A file of the filtered list | **A.** Ask if you need it for a dispute; it can be added |
| 6.12 | **Staff seeing their own activity** | A ⭐ No (as today): staff already see their sales in Today's sales · B "My activity" for staff | **A.** Keeps it simple |

## 7. Screens and mock-up picks
| Screen | What's on it |
|---|---|
| Activity | Day groups, rows, important marks, chips, Filters, search |
| Filters | Person, period, Important only |
| One entry | Sentence, who, when, phone, details, Open |
| A group | The single entries inside "added 48 sarees" |
| Home · security alert | The 24-hour line (6.8) |
| Activity · Staff | "For owners" |

**Picks (mock-up "Design options"):**
- **List:** A · rows under each day, with coloured icons / B · a timeline (a line with dots, like an order's history).
- **Filters:** A · kind chips on top + a Filters button / B · everything in one Filter sheet.

## 8. Rules
| Rule | Value |
|---|---|
| Kinds | **Sales:** sale made, sale cancelled, bargain, Sell anyway, invoice made / made later / customer corrected. **Orders:** shipped, tracking number changed, delivered, cancelled. **Prices and catalogue:** categories and designs added, changed, deleted, prices, photos, catalogue PDFs. **Products and tags:** sarees added, edited, moved, deleted, photos, tags changed / replaced / removed. **Team:** invited, re-invited, role changed, renamed, removed, main owner, phones signed out. **Sign-in:** signed in, wrong PIN, locked, new phone, PIN changed or reset, Face ID on or off, sign-out, stolen sign-in blocked |
| Grouping | Same person, same action, same design, less than 10 minutes between entries |
| Important | The list in 6.7; a bargain counts as important when under half the store price |
| Kept | Sign-in kinds 1 year; everything else never deleted by the new server |
| Person | The person who did it; "System" for the server's own work (e.g. an online invoice); "Not recorded" for old entries without one |
| Times | India time |

## 9. Data (same live database)
- Reads `AuthEvent` (the activity trail), with names from `AuthAccount`, designs, sarees, orders.
- **Additive changes:** migration `v2_activity`: `OrderItem.storePrice` (the store price a line was sold against, 6.3) and two indexes on `AuthEvent` (by date, and by kind and date) so filtering stays quick. A one-time script copies the store price from the existing bargain records.
- A daily job in the new server removes sign-in records older than 1 year (6.2).
- **Switch-over:** switch off the old server's audit-log deletion (`purgeOldAuditLogs`, 30 days) before 4 Nov 2026.

## 10. API (as built, under `/api/v2`)
| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/activity?kind=&person=&period=today\|7d\|30d\|all\|custom&from=&to=&q=&important=&before=` | `{ period, entries, next }`: 20 lines a page (was 50 until 2026-10-12), newest first; each entry has its sentence, kind, important mark, who, phone, details and link; a group carries its entries (up to 300) | activity.view |
| GET | `/activity/people` | Everyone who appears as a doer (former members too), for the Filter sheet | activity.view |

## 11. Building blocks
**Backend:** `models/activity.model.js`, `services/activity.service.js` (the sentence and details for each kind, old-app and new-app records alike; grouping; important), routes; the migration and copy script; Module 5's sale writes `storePrice` on each line, Module 9 reads it first; Home's security line (Module 8).

**App:** More → Activity (owners), the list with day headers, filters, search, the entry sheet, a group's entries.

## 12. Steps
1. Plan (this document). ✅ Decisions per ⭐.
2. Mock-up, clickable, in Chrome. ✅ (64/64 browser checks; picks A and B)
3. Backend + tests. ✅ (section 16)
4. App + tests. ✅ (section 16)
5. Real-phone test ✅ (section 17): change a price, cancel a sale, bargain under half, replace a tag, change a role, sign in on a new phone, lock a PIN; find each in Activity by chip, person and search; open each; grouping of a batch; staff refused.
6. Results written here; open checks to the full-app test list. ✅

## 13. Testing plan
- **API:** every kind reads as a sentence (old and new records); grouping; important; filters (kind, person, period, search); paging; staff refused; the store price copy and Analytics using it; the 1-year clean-up leaves everything else.
- **App:** sentence parts, day headers, filter chips.
- **Real phone:** section 12, step 5.

## 14. Risks
| Risk | Handling |
|---|---|
| **The old server deletes records after 30 days** | Switch it off before 4 Nov 2026; until then the store price copy (6.3) protects Analytics' bargains |
| Old records with different details | Each kind reads what it can; anything missing is left out, never guessed |
| A very long list | 20 at a time, indexes on date and kind, grouping |

## 16. Build status (2026-10-12)
| Part | What | Checks |
|---|---|---|
| Database | Migration `20261012020000_v2_activity`: `OrderItem.storePrice` and two `AuthEvent` indexes (date; kind and date), applied to the local copy. `scripts/copy-store-prices.js` filled 128 sale lines (98 from bargain records, 30 sold at the store price); Analytics' bargains stayed exactly the same | — |
| Server | `models/activity.model.js`, `services/activity.service.js` (a sentence and details for every kind, old app and new; who did it; important; grouping; search by name, design, saree, tag, order), routes `/api/v2/activity`; Module 5's sale writes each line's store price, Modules 5 and 9 read it first; Home's security line; sign-in records over a year old removed by the 15-minute housekeeping job | **274/274** server tests (Module 10: 10 API + 5 unit) |
| App | More → Activity (owners): search, one Filter sheet (pick B: kind, person, period with any dates, Important only), rows under each day with coloured icons (pick A), amber mark for important, the entry sheet with Open, a group's entries; Home's security alert | **90/90** app tests (Module 10: 4), lint clean |
| Mock-up | `docs/design/ui-mockup/module-10-activity/` | 64/64 browser checks |

Changes from the plan:
- No separate "one entry" call: each entry arrives with its details, and a group with its entries.
- Adding a saree and adding its photos count as one action when grouping (the old app logged them in turns): "System Admin added 6 sarees to Gap Border bramini sarees with 6 photos".
- Sales, cancellations and important entries are never grouped.
- Pages in another tab opened from Activity (a sale, an order, a saree, a design) come back to Activity; the same now for Analytics and the Catalogue's link to a design's sarees.

## 17. Real-phone test (2026-10-12, Samsung Note10 Lite, test app)
Owner = Lakshmi (test); staff = Ravi (test); Anil (test)'s PIN locked on purpose. Local copy through the USB cable.

| # | Check | Result |
|---|---|---|
| 1 | More → Activity: rows under Today / Yesterday / dates, coloured icons, one sentence each with time and phone; "signed in 2 times · 2 entries" grouped | ✅ |
| 2 | Filter sheet: kind, person (former members marked), period, Important only; Prices and catalogue + Important only shows the price changes and deletions | ✅ (after fix 1) |
| 3 | The real entry: "System Admin changed the prices of Gap Border bramini sarees: store price ₹3,800 → ₹54,310, website price ₹3,200 → ₹25,888", 10 Oct 4:31 pm, note "above the MRP"; Open the design | ✅ |
| 4 | Search "bramini": 14 entries, including a sale on 9 Oct at ₹2,000 against the store price ₹3,800 (before the typo) | ✅ |
| 5 | Back from the design opened from Activity returns to Activity, search kept | ✅ (after fix 2) |
| 6 | A group ("added 6 sarees … with 6 photos · 12 entries") opens its entries; one opens its details | ✅ |
| 7 | 5 wrong PINs lock Anil; owner's Home shows "1 security alert: Anil (test)'s PIN was locked…"; tapping it opens Activity on Sign-in · Today with "4 wrong PINs for Anil (test)" | ✅ (after fix 3) |
| 8 | Ravi's first sign-in on this phone: "signed in on a new phone" marked important | ✅ |
| 9 | Staff: no Activity in More; opening it says it's for owners (the server refuses too) | ✅ |
| 10 | Dark mode (switched for the check, then back to light) | ✅ |

**Problems found and fixed (re-checked):**
1. The Filter button showed an "i" icon (no filter icon in the app's set): now the sliders icon.
2. **Back from a page opened in another tab, with nothing under it there, went to Home** (Activity → a design → Back). Such links now say where to return (Activity, Analytics, the Catalogue design page), and Back goes exactly there.
3. Four wrong PINs read "Wrong PIN for Anil (test) (and 3 more like it)": now "4 wrong PINs for Anil (test)".
4. Old-app entries showed "Phone —": now "Not recorded".
5. Found by the full test run: the security alert count stopped at 5; it now counts them all.
6. Found while testing search: a design's name didn't find the sarees added to it; it does now.

Not tested: tablet, iPhone, the phone's own back button (the test never presses it unless the keyboard is open), loading more pages on the phone (tested in the server tests: 65 entries over 2 pages).

## 18. Switch-over notes
- **Before 4 Nov 2026: switch off the old server's 30-day activity deletion** (`purgeOldAuditLogs` in `retention.service.ts`, `AUDIT_LOG_RETENTION_DAYS`). Until then it deletes every staff-app record older than 30 days, the new app's too.
- Run migration `v2_activity`, then `node scripts/copy-store-prices.js --yes` on the live database (as soon as possible, while the bargain records still exist).
- The right price of "Gap Border bramini sarees" is probably ₹3,800 store and ₹3,200 website (the values before the 10 Oct change).

## 19. Left for the full-app test
Added to [`docs/testing/full-app-test-list.md`](../testing/full-app-test-list.md): tablet, iPhone, the phone's own back button from pages opened in another tab, scrolling far down the list on the phone, a stolen sign-in blocked showing on Home.

## 20. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-12 | Plan and mock-up | Data: 3,687 staff-app records in 9 days (mostly the big stock entry); the ₹54,310 typo was made on 10 Oct 4:31 pm from "System Admin" (was ₹3,800). **The old server deletes staff-app records after 30 days (first deletions about 4 Nov 2026), including Analytics' bargain records and the new app's records.** Waiting for decisions 6.1–6.12 and picks (list, filters). |
| 2026-10-12 | Picks and decisions | Owner: List A (rows under each day), Filters B (one Filter sheet), theme light / dark / auto. Decisions not changed, so ⭐ throughout. |
| 2026-10-12 | Built and phone-tested | Server 274/274, app 90/90, mock-up 64/64; 10 phone checks passed; 6 problems fixed. Store prices copied onto 128 sale lines on the local copy. |

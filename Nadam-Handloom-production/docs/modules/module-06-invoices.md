# Module 6: Invoices and the sales summary

| | |
|---|---|
| **Status** | **Built and tested on a real Android phone, 2026-10-11** (sections 16–17). All decisions per the ⭐ recommendations (owner: "ok"); mock-up picks A and A (defaults; the owner didn't choose). Open checks: section 19. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners and Staff find, open, share and print invoices (`sell.use`). Only Owners see money totals and make the sales summary (`sales.view`), as agreed in Module 2 |
| **Builds on** | [Module 2](module-02-roles-and-team.md) (roles), [Module 5](module-05-scan-to-sell.md) (sales, invoice numbers, the invoice PDF, cancel) |
| **Mock-up** | [`docs/design/ui-mockup/module-6-invoices/`](../design/ui-mockup/module-6-invoices/index.html) |
| **Old system notes** | [`current-system/admin-app-3-selling-orders-invoices.md`](../current-system/admin-app-3-selling-orders-invoices.md), sections 2 (Invoices, InvoiceDetail), 3 and 7 |

## 1. Goal
Find any invoice in seconds and send it again; give the owner (and the accountant) a sales summary for any period that is **correct to the paisa and matches the invoice list**.

## 2. What is in this module
- **Invoices list** (More → Invoices): every invoice, newest first, with search and filters.
- **One invoice:** its sarees, GST, customer, payment, and Share on WhatsApp / Print / Share another way.
- **Sales summary** (owners): a PDF for a month or any dates, for the accountant and the GST return, plus an Excel-friendly file (6.6).
- **Invoice for a sale recorded without one** (6.5): when a customer comes back and asks.
- **Correct the customer's name or mobile on an invoice** (6.11).

**Not in this module:**
- Online orders and shipping: Module 7 (their invoices do show in this list).
- Today's sales and money on Home: Module 8. Analytics charts: Module 9.
- Returns after the day of the sale: later (Module 5, decision 6.2).

## 3. How the shop uses invoices today (copy of the live data, 2026-10-11)
| What | Number |
|---|---|
| Invoices | **15** (INV-000001 to INV-000015), 5–10 Oct |
| By channel | Counter 4 (₹1,20,888), WhatsApp 9 (₹28,300), Online 2 (₹3,010) |
| Biggest invoice | 47 sarees on one invoice |
| Sales **without** an invoice | **22 of 37 sales** (₹1,06,700): 16 counter, 6 WhatsApp |
| Customer name on the invoice | Online 2 of 2; **counter 0 of 4, WhatsApp 0 of 9** (fixed for new sales in Module 5) |
| Online orders paid but with no invoice | 0 |

About 2–3 invoices a day so far, so roughly 70–100 a month.

## 4. Problems in the old app
1. **An invoice's page shows no sarees**, only totals; the lines are only in the PDF.
2. **No search.** A customer who comes back can only be found by scrolling.
3. **Dates are wrong at the edges:** a custom "From" date starts at 5:30 am, the server's "today" can start at 5:30 am, and "7 days" is really 8 days.
4. **"All time" + Complete Invoice prints only the current month.**
5. **The list and the summary count different things:** the list uses the invoice date, the summary the sale date, so the same filter can give two totals.
6. **Staff can download the sales summary** (all the money totals), against the Module 2 rule.
7. **A failed sales-summary download says nothing** (no time limit, no retry).
8. **No invoice can be made later** for a sale recorded without one, and **a typo in a name can't be fixed**.
9. **Nothing for the accountant in Excel**; the summary groups by saree name only (no invoice-by-invoice list).
10. **Cancelled sales (new in Module 5) would still count** in the old summary.
11. WhatsApp invoices read "Walk-in customer" because no name was saved (Module 5 fixed this for new sales).

## 5. How it will work

### 5.1 The invoices list
- More → **Invoices**. Newest first, 20 at a time (more load as you scroll, or "Show more"; all lists, 2026-10-12).
- Each row: **INV-000017**, date and time, customer ("Sita Devi", or "Walk-in customer"), Counter / WhatsApp / Online, **total**, and a **CANCELLED** badge when the sale was cancelled.
- **Search** (6.9): invoice number (17 or INV-000017), order number, customer name, mobile, or a saree's tag number.
- **Filters:** period (Today · This month · Last month · Custom · All), channel (All · Counter · WhatsApp · Online), and "Cancelled".
- **Owners** see a line above the list: "42 invoices · ₹1,62,400 (2 cancelled, not counted)". **Staff** see the list without totals (6.1).

### 5.2 One invoice
- Number, date, **CANCELLED** stamp if cancelled.
- Customer (name, mobile; address for WhatsApp orders), paid by, order number, who sold it.
- **Every saree** (photo, name, tag, price), then taxable value, CGST, SGST and total: the same figures as the PDF.
- **Share on WhatsApp** (Android: straight into the customer's chat), **Print**, **Share another way**, as in Module 5.
- **Open the sale** (Module 5 page: cancel there, owners, same day). Online invoices: "Open the order" (Module 7).
- Owners: **Correct the customer's name or mobile** (6.11).

### 5.3 The sales summary (owners)
1. Choose the **period**: This month · Last month · Custom (from and to dates on a calendar).
2. Choose the **channels**: All, or Counter / WhatsApp / Online.
3. **Make the summary.** The app shows the totals first, then: **Share PDF**, **Print**, **Excel file** (6.6).
- The PDF (6.2): a first page with the totals (invoices, taxable value, CGST, SGST, total; by channel; by payment mode), then **every invoice in the period** (number, date, customer, taxable, CGST, SGST, total), then **sarees by name** (quantity, average price, total) as today.
- Cancelled invoices are listed and marked CANCELLED, **not counted** (6.4).
- Sales without an invoice: a separate line, outside the GST totals (6.3).
- **Dates are the invoice date in India time** (6.7): the list and the summary always agree.
- Nothing in the period: "No invoices from 1 Oct to 31 Oct."

### 5.4 An invoice for a sale recorded without one (6.5)
On the sale's page (Module 5): **Make an invoice**. It takes the next number and today's date (the sale date is printed too). Allowed in the same month as the sale, so a filed GST month never changes.

### 5.5 Correcting the customer on an invoice (6.11)
Owners only, same month: change the name or mobile. The PDF is made again **with the same number and amounts**; the change is recorded in the activity log. Amounts can never be changed (cancel the sale instead, same day).

## 6. Decisions
| # | Question | Options | Recommendation |
|---|---|---|---|
| 6.1 | **Who sees invoices?** | A Everyone sees everything (as today) · B ⭐ Staff: list, open, share, print, **no totals, no summary**; Owners: everything · C Staff only invoices of their own sales | **B.** Module 2's rule (money totals are for owners), and Staff still help a customer who comes back for their invoice |
| 6.2 | **What the sales summary PDF shows** | A Sarees grouped by name with average price (as today) · B One line per invoice (an invoice register) · C ⭐ Both: totals page, then every invoice, then sarees by name | **C.** The accountant needs the invoice list for GST; the owner knows the by-saree view |
| 6.3 | **Sales recorded without an invoice** (22 of 37 so far) | A Leave them out (as today) · B ⭐ Show them as one separate line ("22 sales without an invoice: ₹1,06,700"), outside the GST totals · C Count them in the totals | **B.** The owner sees the whole picture, and the invoice totals stay exactly the invoices. Ask the accountant whether these need GST reporting |
| 6.4 | **Cancelled invoices in the list and summary** | ⭐ Listed and marked CANCELLED, never counted | Their numbers stay in sequence (no gaps), as GST expects |
| 6.5 | **Make an invoice later** for a sale recorded without one | A No (as today) · B ⭐ Yes, in the same month as the sale · C Yes, any time | **B.** Customers do come back; the month limit keeps a filed GST month unchanged |
| 6.6 | **Excel for the accountant** | A PDF only · B ⭐ PDF plus a CSV file (opens in Excel / Google Sheets) with one row per invoice | **B.** No retyping for the accountant |
| 6.7 | **Which date counts** | ⭐ The invoice date, India time, for both the list and the summary | Fixes old problems 3–5 |
| 6.8 | **Period choices** | ⭐ Today · This month · Last month · Custom · All (list only) | GST is filed monthly, so Last month is one tap |
| 6.9 | **Search by** | ⭐ Invoice number, order number, customer name, mobile, saree tag | |
| 6.10 | **Customer's GSTIN** (business buyers) on invoices | A ⭐ Not now · B An optional GSTIN box on Complete sale, printed on the invoice | **A.** No business buyer seen in the data; easy to add later |
| 6.11 | **Correcting a name or mobile** on an invoice | A Never · B ⭐ Owners, same month, same number and amounts, logged | **B.** Typos happen; amounts never change |

## 7. Screens
| Screen | What's on it |
|---|---|
| Invoices | Search, period and channel chips, Cancelled filter, totals line (owners), the list |
| One invoice | Status, customer, sarees, GST, paid by, sold by; Share on WhatsApp, Print, Share another way; Open the sale; Correct customer (owners) |
| Correct customer | Name, mobile, Save (the PDF is made again) |
| Sales summary | Period, channels, Make the summary; totals; Share PDF, Print, Excel file |
| Calendar | From and to dates (custom period) |
| Make an invoice (on the sale page) | "Make an invoice for this sale?" |

## 8. Rules
| Rule | Value |
|---|---|
| Invoice date | `generatedAt`, India time |
| Period | From the first day's midnight to the last day's 23:59:59.999, India time |
| Counted | Invoices that are not cancelled |
| Customer shown | The invoice's name; "Walk-in customer" when none; WhatsApp without a name: "WhatsApp customer" |
| Make an invoice later | Sale not cancelled, recorded without an invoice, same calendar month (India) as the sale |
| Correct customer | Owners, invoice not cancelled, same month as the invoice; name ≤ 60 characters, mobile 10 digits or empty |
| Summary size | Up to one year per summary (about 1,200 invoices) |
| Summary speed | Made fresh each time, never stored; a limit of 10 a minute (as today) |

## 9. Data (same live database)
No new tables or columns are needed:
- The list reads `Invoice` with its `Order` (lines, payment mode, who sold it from the stock entries).
- "Make an invoice later" sets `Order.invoiceRequired` to true and makes the invoice as in Module 5.
- "Correct customer" updates `Invoice.customerName` / `customerMobile` and the order's customer, re-makes the PDF (same number) and writes an activity entry.

## 10. API (as built, under `/api/v2`)
| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/invoices?q=&from=&to=&channel=&cancelled=&offset=` | The list (30 a page); `totals` only for owners. A search ignores the dates | sell.use |
| GET | `/invoices/without?from=&to=&channel=` | Counter and WhatsApp sales recorded without an invoice (6.3, 6.5) | sales.view |
| GET | `/invoices/:id` | One invoice with its lines | sell.use |
| PATCH | `/invoices/:id/customer` | `{ name, mobile }` → PDF re-made, same number | sales.view |
| POST | `/sales/:id/make-invoice` | Invoice for a sale recorded without one | sell.use |
| POST | `/invoices/summary` | `{ from, to, channels }` → the totals the app shows | sales.view |
| GET | `/invoices/summary/pdf` and `/csv` `?from=&to=&channels=` | The PDF and the Excel (CSV) file, made fresh; fetched with the sign-in key, never a public link | sales.view |

## 11. Building blocks
**Backend:** `models/invoice.model.js` (list, search, totals), `services/invoiceList.service.js`, `services/salesSummary.service.js` + `salesSummaryPdf.service.js` (the 3-part PDF and the CSV), reuse Module 5's `invoice.service.js` (numbering, PDF) and `utils/day.js` (India dates), routes, validators, tests.

**App:** More → Invoices list, invoice page (reusing Module 5's invoice buttons), correct-customer sheet, sales summary screen, a small calendar for custom dates, "Make an invoice" on the sale page.

## 12. Steps
1. Plan (this document). ✅ All ⭐ recommendations agreed.
2. Mock-up, clickable, in Chrome. ✅ (87/87 browser checks; picks A and A)
3. Backend + tests. ✅ (section 16)
4. App + tests. ✅ (section 16)
5. Real-phone test ✅ (section 17): search by each kind; filters and totals; open an invoice and share/print it; a cancelled one; Staff (no totals, no summary); the summary for this month and a custom range, its PDF and CSV; make an invoice later; correct a name; dates around midnight.
6. Results written here; open checks to the full-app test list. ✅

## 13. Testing plan
- **API:** list order and paging; each search kind; period edges in India time (23:59 and 00:01); channel filter; totals exclude cancelled; Staff get no totals and are refused the summary and corrections; the summary totals equal the sum of the listed invoices to the paisa; CSV rows match the PDF; "make later" refused when cancelled, already invoiced or another month; correct customer keeps number and amounts, refused next month.
- **App:** period dates, totals text, search tidying.
- **Real phone:** section 12, step 5.

## 14. Risks
| Risk | Handling |
|---|---|
| A summary that doesn't match the invoices | Both come from the same query and the same India-time dates; a test compares them |
| A year-long summary is slow | Limit one summary to a year; the PDF is plain text tables |
| Changing a filed month | "Make later" and "correct customer" only within the same month |
| The old app is still used during the switch-over | It ignores the new behaviour; its summary still counts cancelled sales (Module 5, section 18) |

## 16. Build status (2026-10-11)
| Part | What | Checks |
|---|---|---|
| Database | No change (no migration) | — |
| Server | `models/invoice.model.js` (search, India-time periods, totals that never count cancelled), `services/invoiceBook.service.js` (list, one invoice, correct the customer, sales without an invoice), `services/salesSummary.service.js` + `salesSummaryPdf.service.js` (totals, the 3-part PDF, the CSV), `makeInvoiceLater` in `sale.service.js`, routes `/api/v2/invoices` and `/sales/:id/make-invoice`. Invoice PDFs now print the invoice's own date, plus "Sale date" when made later | **212/212** server tests (Module 6: 12 API + 5 unit) |
| App | More → Invoices (list A), `more/invoices/[id]`, `summary` (A: one page), `without`; calendar, correct-customer sheet; "Make an invoice" on the sale page; summary files saved on the phone before sharing | **72/72** app tests (Module 6: 7), lint clean |
| Live run on the computer | List, search, one invoice, summary, PDF and CSV from the local copy | The shop's 15 invoices (5–10 Oct) total ₹1,52,198.10, exactly the database |

Changes from the draft: the summary files are fetched with the sign-in key and saved on the phone (no public links for the money totals); owners also get a "sales without an invoice" list, so an old sale can be found for "Make an invoice"; correcting is refused for online orders (their customer comes from the website account).

**Found in the live data:** INV-000015 is a **₹10 online test order** ("Test1", customer "Navadeep", order NH25425661, status shipped). It is counted in October's sales and GST. Ask the owner whether to cancel it before the October summary goes to the accountant.

## 17. Real-phone test (2026-10-11, Samsung Note10 Lite, test app)
Staff = Anil (test), Owner = Lakshmi (test), local copy of the data through the USB cable. The phone had no internet of its own (only the cable), so the yellow "Offline" bar showed; everything else worked.

| # | Check | Result |
|---|---|---|
| 1 | Staff: More → Invoices ("Find, share and print invoices"); list without totals, "owners only" note, no Summary button | ✅ |
| 2 | Newest first; cancelled marked and struck through | ✅ |
| 3 | Search (Staff): 17 → INV-000017; "Test Customer" → INV-000017; tag NH993050 → both invoices it was on | ✅ |
| 4 | Staff open the owner's invoice: share and print, no "Open the sale", no correcting; their own: "Open the sale" | ✅ |
| 5 | Owner: totals line (18 invoices, 2 cancelled not counted), "26 sales without an invoice", Summary button | ✅ |
| 6 | Periods: Last month (none), Today (3), channel WhatsApp (9 invoices, 7 sales without), Cancelled (the 2) | ✅ |
| 7 | Cancelled invoice: reason; Print and Share only (no WhatsApp, no correcting) | ✅ |
| 8 | Correct the customer: a 5-digit mobile refused; name and mobile saved; same number, date and amount; new PDF with the name; logged | ✅ |
| 9 | Sales without an invoice → a 6 Oct sale → Make an invoice → INV-000021, "Made later"; PDF "Date: 11 Oct 2026 · Sale date: 6 Oct 2026" | ✅ |
| 10 | A sale from last month → no button, "only in the month of the sale" | ✅ |
| 11 | Summary this month: 19 invoices ₹1,73,598.10, GST adds up, channels and payment modes, 25 sales without an invoice (one fewer after #9) | ✅ |
| 12 | Share PDF (share menu, "Nandam-Sales-summary-2026-10-01-to-2026-10-11.pdf"), Print (2 pages, the corrected name shown), Excel file (share menu, .csv) | ✅ |
| 13 | Custom dates on the calendar (Monday first, future days greyed): 5–10 Oct → the shop's 15 invoices, ₹1,52,198.10 | ✅ |
| 14 | No channel → "Choose at least one channel"; Online only → 2 invoices, ₹3,010 | ✅ |

**Problems found and fixed (re-checked on the phone):**
1. Amounts with paise showed one digit ("₹1,62,998.1"). Now always two ("₹1,62,998.10"), everywhere in the app (the formatter dated from Module 3).
2. After making the summary there were two big green buttons; "Make it again" is now the plain style.

Not app problems: one of the test script's sideways swipes started at the screen edge and opened another app (nothing was tapped there); the phone being offline was the phone's own setting.

## 18. Switch-over notes
- Nothing to migrate.
- Ask the owner about INV-000015 (the ₹10 test order) before the October summary (section 16).
- The old app's invoice list and summary keep working on the old backend; its summary still counts cancelled counter sales (Module 5, section 18).

## 19. Left for the full-app test
Added to [`docs/testing/full-app-test-list.md`](../testing/full-app-test-list.md): the Excel file opened in Excel or Google Sheets (Telugu names, ₹), a long period (a year, many pages), iPhone (share menu, print, calendar), tablet layout, invoices made around midnight on the real clock, and the summary on a real printer.

## 20. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-11 | Plan | Data: 15 invoices, 22 of 37 sales without one, biggest invoice 47 sarees. Waiting for decisions 6.1–6.11. |
| 2026-10-11 | Decisions | Owner: "ok great continue end to end": all ⭐ recommendations; picks left as A and A. |
| 2026-10-11 | Built and phone-tested | Server 212/212, app 72/72; 14 phone checks passed; 2 small problems fixed. Found a ₹10 test invoice (INV-000015) in the live data. |
| 2026-10-12 | Fix found in Module 8 | Two taps at once on "make an invoice later" could give the second phone "This sale was recorded with an invoice"; the second now gets the same invoice. |

## Change 16 Oct 2026: invoices made again, and the accountant's spreadsheet
- A PDF made again for an existing invoice (customer corrected, cancelled stamp) prints each line's **quantity** (old-app lines can be 2 or more of a design; it printed 1) and uses the invoice's **own GST rate** stored with it, not today's setting.
- The CSV for the accountant: a text cell that starts like a formula (= + - @, e.g. a website customer's name) gets a leading apostrophe so Excel shows it as text; numbers are unchanged.
- Live 16 Oct 15:33 IST. Tests: `tests/api/admin-edge-cases.test.js` (the PDF's text is read back).

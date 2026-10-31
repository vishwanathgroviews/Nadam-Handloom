# Full-app test list

Checks left over from each module, to do when the whole admin app is tested together (and in the store field test). Tick them off there.

## Parked from Module 1 (Sign in)
- [ ] Fingerprint sign-in on the real phone (enrol a fingerprint first)
- [ ] iPhone build and test (needs Xcode 26 or EAS)
- [ ] Tablet test

## Module 4 (Products and barcodes): not yet tested on a phone
Tested on the phone 2026-10-11: 27 checks, all passed ([module-04-products.md](../modules/module-04-products.md), section 16). Still to do:

| # | Check | Why it's open |
|---|---|---|
| 4.1 | Camera on Scan to find, the Quick add tag step, Change tag and Replace tag | Tags were typed there; the camera was tested only on the batch scan screen |
| 4.2 | A big batch (up to 50 photos), and picking more than 50 | Only batches of 8, 3 and 2 were tried |
| 4.3 | The 5,000-limit warning and the "limit reached" block on the phone | Tested only in backend tests |
| 4.4 | App closed while sarees are uploading: they send again after reopening, with no duplicates | No duplicates is proven in backend tests; not tried on the phone |
| 4.5 | Another person signs in on the same phone: the first person's draft and unsent sarees wait for them | Not tried |
| 4.6 | New sarees appear on the customer website (photo, name, price) | Not checked |
| 4.7 | Retail barcodes (EAN-13 / UPC) read by the camera | Tested only in backend tests |
| 4.8 | A Bluetooth tag scanner typing into the "Type" box | No scanner available yet |
| 4.9 | iPhone and tablet (camera, photo picker, layout B on a tablet) | Parked, as for Modules 1–3 |
| 4.10 | Dark mode and large text sizes on the Module 4 screens | Not checked on the phone |
| 4.11 | Old app and new app adding sarees at the same time on the same data | Not tried |

## Module 5 (Scan to sell): not yet tested on a phone
Plan with results: [module-05-scan-to-sell.md](../modules/module-05-scan-to-sell.md), sections 17–19.

| # | Check | Why it's open |
|---|---|---|
| 5.1 | Share on WhatsApp straight into a real customer's chat (Android) | Not opened during the test, so no chat went to a stranger; try it with the owner's own number |
| 5.2 | Printing the invoice on a real printer | Only the phone's print screen was opened; no printer in the test |
| 5.3 | iPhone: share menu with the invoice, print, the camera on the sell screen | Parked, as for Modules 1–4 |
| 5.4 | Tablet layout of the Scan tab, bill and Complete sale | Parked |
| 5.5 | A Bluetooth tag scanner typing into "Type" on the sell screen | No scanner available yet |
| 5.6 | A very big bill (50–100 sarees): speed, the invoice running to several pages | Tested with up to 5 sarees on the phone; 100 lines only in server tests |
| 5.7 | Two real phones selling the same saree at the same moment | Done with the Mac as the "other phone" and in server tests |
| 5.8 | Cancel refused after midnight for real (a sale from the evening, tried next morning) | Tested by moving a sale to yesterday |
| 5.9 | "Sell anyway" against a real website checkout, incl. the customer trying to pay afterwards | The checkout was made in the database; the website still uses the old backend (plan section 18) |
| 5.10 | ~~Large text sizes on the selling screens~~ | ✅ 2026-10-12: bill and Complete sale at 1.3× text |

## Module 6 (Invoices and the sales summary): not yet tested on a phone
Plan with results: [module-06-invoices.md](../modules/module-06-invoices.md), sections 17–19.

| # | Check | Why it's open |
|---|---|---|
| 6.1 | The Excel (CSV) file opened in Excel and Google Sheets: Telugu names, ₹, amounts as numbers | Only the share menu was opened on the phone |
| 6.2 | A summary for a long period (a year, hundreds of invoices, many pages) | Tested with 150 lines in server tests only |
| 6.3 | iPhone: share menu, print, the calendar | Parked, as for Modules 1–5 |
| 6.4 | Tablet layout of the list, an invoice and the summary | Parked |
| 6.5 | Invoices made around midnight on the real clock (11:59 pm and 12:01 am) land on the right day | Done with moved dates in server tests |
| 6.6 | The summary printed on a real printer | No printer in the test |

## Module 7 (Orders and shipping): not yet tested on a phone
Plan with results: [module-07-orders.md](../modules/module-07-orders.md), sections 17–19.

| # | Check | Why it's open |
|---|---|---|
| 7.1 | Scanning a real DTDC courier label with the camera | Nobody held the phone during the test; the number was typed |
| 7.2 | Send tracking + invoice into a real WhatsApp chat (Android), with the owner's own number | Not sent, so no chat opened with a stranger |
| 7.3 | iPhone: the share menu with the message and the invoice | Parked |
| 7.4 | Tablet layout of the Orders tab and an order | Parked |
| 7.5 | A real paid order arriving from the website and shipped from the app | The online order in the test was made on the local copy |
| 7.6 | The old app and the new app shipping the same order at the same moment | Not tried (the server refuses the second ship) |
| 7.7 | Product links in the WhatsApp message | Need the website address setting (`WEBSITE_URL`) on the server |

## Module 8 (Home): not yet tested on a phone
Plan with results: [module-08-home.md](../modules/module-08-home.md), sections 17–19.

| # | Check | Why it's open |
|---|---|---|
| 8.1 | Tablet: Home in two columns, Running low | No tablet; checked in the mock-up only |
| 8.2 | iPhone: Home, the eye button, pull down to refresh | Parked |
| 8.3 | Monthly reminder on the 1st–7th: "Send October's sales summary" opens the summary on Last month, then disappears on that phone | Only shows 1st–7th; covered by tests |
| 8.4 | The phone's own back button on a screen opened from Home (a sale, Today's sales, unpaid checkouts) returns to Home | The test never presses Back unless the keyboard is open |
| 8.5 | "Sarees not saved yet" (photo draft) and "Uploading / not uploaded" lines with real photos | Not produced during the test |
| 8.6 | ~~Phone with no internet at all~~ | ✅ 2026-10-12: Wi-Fi and data off: "Offline. You're still signed in", Home keeps its numbers, Products shows the phone's saved copy, Orders says it needs internet; all back when the internet returns |
| 8.7 | "A sale is waiting for an answer" line after a Complete sale that got no answer | Not produced during the test |

## Module 9 (Analytics): not yet tested on a phone
Plan with results: [module-09-analytics.md](../modules/module-09-analytics.md), sections 17–19.

| # | Check | Why it's open |
|---|---|---|
| 9.1 | Tablet: each tab's cards in two columns | No tablet; checked in the mock-up only |
| 9.2 | iPhone: Analytics, the calendar, tabs | Parked |
| 9.3 | Days of the week appear for a 4-week period | Only one week of sales so far (from 5 Oct 2026) |
| 9.4 | "Not sold for 60 days" lists designs | Starts 3 Dec 2026 (60 days after the first tags) |
| 9.5 | After the store prices are fixed: Prices to check empties, stock value and bargains look right | Waiting for the owner to fix the prices |
| 9.6 | The comparison with the period before on real weeks (no test data) | Needs a few weeks of real sales |

## Module 10 (Activity log): not yet tested on a phone
Plan with results: [module-10-activity.md](../modules/module-10-activity.md), sections 17–19.

| # | Check | Why it's open |
|---|---|---|
| 10.1 | Tablet: Activity, the Filter sheet, the entry sheet | No tablet |
| 10.2 | iPhone: Activity, the Filter sheet | Parked |
| 10.3 | The phone's own back button on a page opened from Activity, Analytics or the Catalogue returns there | The test never presses Back unless the keyboard is open |
| 10.4 | ~~Scrolling far down Activity loads more~~ | ✅ 2026-10-12: 10 pages of 20 loaded while scrolling |
| 10.5 | ~~"A stolen sign-in was blocked" appears on Home and in Activity~~ | ✅ 2026-10-12: a copied key used on another device was blocked (everyone's sign-in ended); the phone's Home and Activity showed it |
| 10.6 | After switch-over: the old server's 30-day deletion is off and old records stay | Switch-over action (before 4 Nov 2026) |

## Module 11 (Settings): not yet tested on a phone
Plan with results: [module-11-settings.md](../modules/module-11-settings.md), sections 17–19.

| # | Check | Why it's open |
|---|---|---|
| 11.1 | The phone's own Back button on the maintenance or update screen leaves the app | The test never presses Back unless the keyboard is open |
| 11.2 | Tablet: Settings in two columns | No tablet; checked in the mock-up only |
| 11.3 | iPhone: the iPhone buttons, "Open TestFlight", Update required | Parked |
| 11.4 | The old website shows its maintenance message when the website switch is on | The old website reads the same switch; check on the live site at switch-over |
| 11.5 | A phone on an older build updates from the Play Store after "Require this version" | Needs a release in the Play Store (decision 6.8) |
| 11.6 | After switch-over: the newest versions are set from an updated phone ("Tell phones…") | Switch-over action |

## Whole app: seen during Module 11's dark-mode check (fixed 2026-10-12)
Both fixed and checked on the phone the same day ([module-11-settings.md](../modules/module-11-settings.md), section 17):
- A.1 Android's own button strip now follows light/dark while the app is open (our module `modules/nandam-system-bars`).
- A.2 Text on solid red buttons and the red tab count uses the new colour `onDanger` (dark on the dark theme's red), readable in dark mode.

Still to look at on an iPhone (parked with the other iPhone checks): the red buttons in dark mode.

## Full walk-through on the phone (2026-10-12, after pagination)
Real app on the Samsung Note10 Lite, real API calls to the local server (copy of the live data), as owner (Lakshmi test) and staff (Anil test). Only the taps were scripted.

| Area | Checked | Result |
|---|---|---|
| Home | Numbers, eye button hides/shows amounts, every "Needs attention" line opens its screen and Back returns | ✅ |
| Products | All / No photo filters; scrolling loads 20, 40, 60…; a search ("pattu") also loads page by page; a saree's page; Move picker scrolls all 8 pages | ✅ |
| Add sarees | Design picker: 8 pages of 20 while scrolling; search "lehanga" finds 13 by category name (server search) | ✅ |
| Catalogue | 6 categories; the biggest (102 designs) loads in 6 pages, "That's all 102"; search inside it; Needs photo filter; Reorder loads all 102 first (cancelled, nothing saved); price search ₹2,800 finds 7 | ✅ |
| Team | 10 people; search by name and by last digits (server search); Removed tab | ✅ |
| Invoices | Header totals cover the month; second page loads while scrolling ("That's all 36"); search INV-000028; invoice page with GST split; Sales without an invoice: 2 pages, "That's all 27" | ✅ |
| Orders | All three tabs; an order's page; Unpaid checkouts; staff can't cancel; **ship an order from the phone** (typed tracking, "Later" for WhatsApp); counts drop everywhere | ✅ |
| Scan to sell | A bill kept on the phone; under-half-price warning; Complete sale (counter, cash, invoice, customer); Sold screen with INV-000037; Today's sales updates at once; owner cancels it with a reason, saree back in stock | ✅ |
| Analytics | This month matches Home (₹3,23,098.10); Designs, People, Stock tabs; Today | ✅ |
| Activity | 20 lines a page while scrolling (10 pages); Filter by person and day; entry sheet | ✅ after fix 1 |
| Settings | Opens; pause sheet opens and closes without changing anything (all of Module 11 tested earlier the same day) | ✅ |
| Sign-in | Wrong PIN ("4 tries left"); staff signs in; an owner signs out the staff phone → "This phone was signed out"; signing in again asks for an SMS code (test mode) | ✅ |
| Staff | No Analytics, Team, Activity, Settings; own sales only, no totals; invoices without money totals | ✅ |
| Server not answering | Paused the server: "Can't reach the server… still signed in", "Selling waits until it's back; the bill stays on this phone"; after it returned, the tag was found straight away | ✅ |
| No internet | Wi-Fi and data off (see 8.6) | ✅ |
| Large text (1.3×) | Home, bill, Complete sale, Orders: text wraps or shortens, nothing overlaps | ✅ |

**Problem found and fixed:**
1. **The Activity Filter sheet didn't scroll** when a drag started on a heading or empty space, and its Show button was below the screen at normal text size, so a filter could look impossible to apply. Cause: the sheet sat inside the tap-to-close layer, which took those touches. Fixed in all 5 sheets built that way (Activity filter and entry, Pause the staff app, Cancel order, Cancel sale): the tap-to-close layer is now behind the sheet. The Filter sheet's Show / Clear filters buttons now stay at the bottom, always visible. Re-checked: drags from anywhere scroll, a tap outside closes, filters apply.

Test data added on the copy of the live data: one sale (INV-000037, cancelled), one shipped order (NH11434859). Phone left as found: light mode, text size 1.1, Wi-Fi and data on.


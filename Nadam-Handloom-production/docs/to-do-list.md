# To-do list: admin app (after all 11 modules were built)

Written 2026-10-13, from the review "did we miss any situations?". Everything planned for the 11 modules is built and tested; these are the real shop situations the app does not handle yet, the checks still to do on devices, and the switch-over steps. Tick items off here as they are done.

## 1. GST and invoices (check with the accountant first: these are GST rules, not convenience)

| # | Situation | What the app does today | Status |
|---|---|---|---|
| 1 | An online or WhatsApp order shipped **outside Andhra Pradesh** | Always prints CGST + SGST (`utils/gst.js`, `invoicePdf.service.js`). An order to another state normally needs **IGST** instead | [ ] Ask the accountant · [ ] Build |
| 2 | Items with a **different GST rate** (e.g. lehenga sets, dress material) | One rate, 5%, for everything (`GST_RATE_PERCENT`) | [ ] Ask the accountant · [ ] Build |
| 3 | A **business customer** wants their GSTIN on the invoice (B2B) | There's no place to enter it | [ ] Ask the accountant · [ ] Build |
| 4 | An invoice cancelled **after the month's GST return was filed** | The app only stamps it CANCELLED; there's no credit note | [ ] Ask the accountant · [ ] Build |

## 2. Selling

| # | Situation | Today | Status |
|---|---|---|---|
| 5 | A customer **returns or exchanges** a saree | No way to do it (decided "later" in Module 7, 6.10) | [ ] Owner: does it happen? · [ ] Plan · [ ] Build |
| 6 | **Part cash, part UPI** on one bill | Only one payment method per bill (`PAYMENT_METHODS`: cash, upi, card) | [ ] Owner: does it happen? · [ ] Plan · [ ] Build |
| 7 | A customer pays an **advance** to keep a saree aside | Not possible | [ ] Owner: does it happen? · [ ] Plan · [ ] Build |
| 8 | Selling something **without a tag** (fall & pico, blouse stitching, fabric by the metre) | Can't be billed; every bill line must be a tagged saree | [ ] Owner: does it happen? · [ ] Plan · [ ] Build |
| 9 | **Refund** after cancelling a paid online order | The app says "Refund in Razorpay"; the refund is done by hand in Razorpay and the app never records that it was done | [ ] Owner: does it happen? · [ ] Plan · [ ] Build |
| 13 | Shipping an order **without its own courier tracking number** (hand delivery, pickup, one parcel for several orders). Found 2026-10-13: 13 WhatsApp orders were shipped from the old app with the same number, "NH3915" | The new app needs a tracking number of 8–20 letters and digits, and refuses one already on another order. Old orders are left as they are | [ ] Owner: why one number on 13 orders? · [ ] Plan · [ ] Build |

## 3. Stock and alerts

| # | Situation | Today | Status |
|---|---|---|---|
| 10 | **Stock-taking**: counting the shelf against the app, or marking a saree **missing or lost** | Not available; only "damaged" | [ ] Owner: does it happen? · [ ] Plan · [ ] Build |
| 11 | **Profit** (buying price of each design) | Not recorded (decided "later", Module 9, 6.11) | [ ] Owner decides |
| 12 | A **new online order** arrives | No phone notification; staff see it only when they open the app (the red badge on Orders). Needs Firebase + an Expo account in the shop's name | [ ] Plan · [ ] Build |

**Recommendation:** after the accountant's answers on 1–4, plan and build **5 (returns/exchanges)** and **6 (part cash, part UPI)** first, the same way as the other modules: plan, mock-up, build, phone test.

## 4. Built, but not yet checked on a real device (about 40 checks)
Full details: [`testing/full-app-test-list.md`](testing/full-app-test-list.md).
- [ ] Camera on real saree tags and DTDC courier labels
- [ ] WhatsApp to the owner's own number (invoice, tracking)
- [ ] A real printer (invoice, sales summary), if the shop has one
- [ ] The phone's own Back button on the screens that use it
- [ ] Fingerprint sign-in on a real phone
- [ ] iPhone (all modules) and tablet (two-column layouts)
- [ ] A Bluetooth tag scanner typing into "Type"
- [ ] Big photo batches (up to 50) and the 5,000-saree limit on the phone
- [ ] The website side: new sarees appearing on the website, a real paid website order shipped from the app, the old website's maintenance message
- [ ] Time-based checks: midnight edges, the 1st–7th monthly summary reminder, 4 weeks of sales for days of the week, slow designs from 3 Dec 2026

## 4a. Found in live use (first iPhone, from 2026-10-13)
- [x] Home → "Add sarees" did nothing: it opened step 2 (photos or quick add) with no subcategory, so the screen said "Couldn't load the subcategory – Unknown item" and both options stayed greyed out (testers, 13–15 Oct; the server log shows the app asking for subcategory "undefined"). Fixed 2026-10-15: it opens step 1, choose the subcategory, like Products → Add. iPhone build 8, Android build 26
- [x] iPhone: swipe from the edge did not go back. Pages opened from Home (Price check, Today's sales, a sale, an order, Add sarees…) opened inside another tab, where there was nothing (or the wrong page) under them. Fixed 2026-10-15: the five tabs sit at the bottom of one stack and every other page opens on top of the page it came from, so the swipe, the Back arrow and Android's back all return there. Details in [`modules/module-08-home.md`](modules/module-08-home.md), section "Change 15 Oct 2026". iPhone build 8, Android build 26. Check on both phones
- [ ] Sign-in screen: the link "First time here? Set up your account" is small and at the very bottom, so a newly invited person sees only mobile + PIN and no way to get a code (Dheeraj, 2026-10-13). Make it a clear button, or take an invited number straight to "Send code"

- [x] App theme choice (owner, 2026-10-15): More → This phone → App theme: Auto (follows the phone, the default), Light, Dark. Kept on each phone (not per person), read before the first screen so a dark phone never flashes light, and passed to the system (`Appearance.setColorScheme`) so the status bar and keyboard match. Code: `theme/themePref.js`, `components/ThemeChoice.js`, `theme/ThemeProvider.js`. Tests: `theme/themePref.test.js`, `components/ThemeChoice.test.js`. iPhone build 9, Android build 27

- [x] Sets: one photo, several tags (client, 2026-10-15). Owner's picks: count first ("Sarees in this photo − 1 +"), every tag shown on the check screen, up to 50 tags, "Add more tags" on the saree page. Server and app built and tested on the Mac (server 298 tests, app 133); details in Module 4, section 6C.
- [x] Sets: server change live (2026-10-15 13:20 IST); Android build 28 made (`apk/Nandam-Admin-v2.0.0-build28.apk`).
- [ ] Sets: try a set end to end on a real Android phone; iPhone build 10 uploaded to TestFlight 2026-10-15 (owner's request); added to "Current app" for everyone the same day.

## 4b. Website W1: customer sign-in (live on nandamhandlooms.com since 16 Oct 2026)
Details: [`modules/web-01-sign-in.md`](modules/web-01-sign-in.md) (section 14); going-live steps: [`deployment/live-v2-server.md`](deployment/live-v2-server.md) → "Website W1".
- [x] Phases 0 to 8: backups, database update (local), server `/api/v2/shop`, website sign-in and My account, every error case, tests (server 411, website 28, Chrome 245, WebKit 122), Firebase dry run
- [x] Phase 9 (2026-10-16): backups, live database update + pincodes, new settings, server, website on `nandamhandlooms.com` in place of the old one (kept aside), nginx with strict security headers, outside checks
- [ ] Real phones on `https://nandamhandlooms.com`: sign in with a real number; notifications on Android and on iPhone (Add to Home Screen first), "Send a test notification"
- [ ] The shop reads and approves the **privacy** and **terms** drafts on the website
- [ ] Message Central: consider raising "Validity Time" from 60 seconds to 5–10 minutes (then set `MESSAGE_CENTRAL_CODE_TTL_SECONDS` to match); customers on slow networks need longer
- [ ] Small (found 16 Oct by the W1 browser test on a phone): a short message ("Address added") can cover the address pop-up's "Save address" button for its 4 seconds; let messages sit above a pop-up's buttons or close when a pop-up opens
- [ ] With MSG91 (after DLT): end the SMS template with `@new.nandamhandlooms.com #{code}` so Android Chrome fills the code in by itself

## 4c. Website W2–W4: Home, shop lists, saree page (live on nandamhandlooms.com since 16 Oct 2026, 11:40 IST)
Details: [`modules/web-02-home-and-shop.md`](modules/web-02-home-and-shop.md).
- [x] Server `/api/v2/shop` home, catalogue, lists with filters and counts, saree page; one "on the website" rule shared with the admin app
- [x] Website: Home (entrance, opening, collections, new, spotlight, edits, craft story, sets, store, new-arrival alerts), All collections, category, collection, all sarees with filters and search, saree page with "Order on WhatsApp", old addresses redirected
- [x] Tests: server 444, website 36, Chrome 379, WebKit 184 (W1's still pass: Chrome 245, WebKit 122); production build with the live security policy
- [x] 16 Oct: check of every website API for rare situations; all 14 fixed with tests (module doc section 12): hidden characters, SMS limits under bursts and on shared mobile networks, code guessing, sign-outs crossing renewals, the old server and website cookies, huge photos, email taken, deletion with an order on the way, alerts on a linked browser, the sign-up step reused, closed staff accounts, per-network limits. Server 468, website 41, Chrome W1 245, WebKit W1 122
- [x] Live 16 Oct 11:40 IST (owner: "do it end to end"): backups, server, website, outside checks; live browser tests Chrome 376 and Safari's engine 184; two small fixes found by the live run and redeployed (record in `deployment/live-v2-server.md`)
- [ ] The owner checks the craft groups (section 6) and fixes the website prices ₹2 / ₹8 / ₹9 / ₹10 / ₹55 / ₹200 and checks ₹25,888 (section 8); photos for 6 online sarees
- [ ] Real phones: the new pages on Android and iPhone

## 4c-2. Website W5: the bag (live on nandamhandlooms.com since 16 Oct 2026, about 23:45 IST)
Details: [`modules/web-03-cart.md`](modules/web-03-cart.md); mock-up [`design/ui-mockup/web-5-bag/`](design/ui-mockup/web-5-bag/index.html).
- [x] Step 1, plan: what the old bag did, live-data facts, 12 decisions, rules, every situation, server and website plan
- [x] Step 2, clickable mock-up in the live look with real sarees: every screen and state, design options, kit, device preview; checked in Chrome and Safari's engine
- [x] Owner's picks: every recommendation (A), 16 Oct
- [x] Server: 6 bag APIs, new `BagItem` table (applied to the local databases only), 24 tests (server 506 / 506)
- [x] Website: Add to bag, side panel, bag page, header and menu bag, WhatsApp message, sign-in joining, sign-out clearing, old bag brought back; unit 64 / 64; browser test Chrome 111 / 111, Safari's engine 111 / 111
- [x] Live 16 Oct about 23:45 IST (owner: "ok put it live"): backups, database update `20261016180000_w5_bag_items` (additive), server, website; live checks Chrome 35 / 35, Safari's engine 35 / 35 (record in `deployment/live-v2-server.md`)
- [ ] After it is live: the owner tries it on a phone (section 15); a signed-in bag with a real SMS

## 4c-3. Website W6: checkout and payment (planned 16–17 Oct, built 17 Oct 2026, not live)
Details: [`modules/web-04-checkout.md`](modules/web-04-checkout.md); mock-up [`design/ui-mockup/web-6-checkout/`](design/ui-mockup/web-6-checkout/index.html).
- [x] Step 1, plan: what the old checkout did and got wrong (any payment marked paid, even for a cancelled or released order), live facts, 15 decisions, rules, every ending, server and website plan, what's needed before going live
- [x] Step 2, clickable mock-up in the live look: bag → sign in → address → review → Razorpay (stand-in) → confirmed, and every other ending; policy page drafts; design options, kit, device preview
- [x] Picks: **all A** (user, 17 Oct): "use the old Razorpay details … all the webhooks from the old codebase; we will not create a new one"
- [x] Steps 4, 5, 7: server, website and tests built on 17 Oct (local only).
  - Server 546/546; website unit 96/96.
  - Browser test w6: Chrome 143/143, Safari's engine 143/143.
  - W1, W2 and W5 browser tests still pass.
  - Record: plan sections 16 and 17.
- [x] Razorpay test keys in `Nadam-backend/.env` (owner, 17 Oct); real test-mode run done: card success and refused, also on the production build with the live security settings (plan section 20)
- [x] Android end to end on a real phone (17 Oct): a website payment → "New online order" on the owner's phone → tap opens it (app in background or closed); 3 things found and fixed (plan section 20)
- [ ] Owner: the texts (delivery promise "packed within 2 working days, 3 to 7 days", shipping, cancellation and refunds, contact): drafts are on `/shipping`, `/refunds` and `/contact`
- [ ] Accountant: IGST for orders delivered outside Andhra Pradesh (decision 6.12; also item 1 above). Built behind `GST_IGST_OTHER_STATES` (off)
- [ ] Owner, Razorpay dashboard: live mode, registered website `nandamhandlooms.com`; the webhook stays as it is (nginx sends it to the new server)
- [ ] **Go live on the owner's go**, plan section 18:
  - backups;
  - add the new tables on the live database;
  - `.env`: the old live keys and the old webhook secret;
  - nginx: the old webhook address to the new server, and the security settings for Razorpay;
  - the website;
  - a real payment and a refund;
  - switch the old server off.
- [ ] Watch after go-live: one local test request stalled once (not repeated in 600-request stress); check the live logs for requests without an answer
- [x] 17 Oct: owners' **Online payments** in the admin app (list, filters, totals, one payment) and **payment notifications** (Android via Firebase: app registered in `nandam-cf952`; iPhone via Apple once the push key exists); "your order is confirmed" note on the website; refunds Razorpay refuses tried later and later, owners told; orders above ₹5,00,000 sent to WhatsApp. Android build 30 made (`apk/Nandam-Admin-v2.0.0-build30.apk`), not shared. Record: plan section 19
- [ ] **iPhone work (later, on the user's go): see [`ios-work-later.md`](ios-work-later.md)**. It covers the APNs push key, Push on the app id, a new profile, and ONE build 12 with `IOS_PUSH=true` (also carries build 11's Face ID change and Online payments)
- [x] Owner decides when to share Android build 30 (rebuilt 17 Oct with the phone-test fixes, SHA-256 `feb78616…`; replaces 29; new parts show after the server update): replaced by build 31 before sharing (26 Oct)

## 4g. Admin app changes from the client (from 23 Oct 2026, collected for one build)
The user: "don't push the iOS build until I say, we have changes to be made".
- [x] Subcategories as big photos, two side by side like the website (module-03 section 16): built, tested on the emulator
- [x] No shop name in the shared catalogue PDF; file named after the subcategory only (module-03 section 17): built, tested, server-only (no app build needed)
- [x] Catalogue PDF change on the live server (one file, `catalogPdf.service.js`): live 23 Oct ~18:30 IST
- [x] Website saree "Share" text without "at Nandam Handlooms" (user: "remove it"): live 23 Oct ~18:40 IST (web-02 section 14)
- [ ] Next client changes: (to come)
- [x] Android build 31 (26 Oct, `apk/Nandam-Admin-v2.0.0-build31.apk`, SHA-256 `adf81f43…`, owner key `AE:81:AD:22`, live server; app tests 145/145, lint clean; opened to Sign in on the test emulator; on the Desktop with `Nandam-Admin-v2.0.0-build31-guide.txt`; the user is sharing it with the testing team): the subcategory photos plus everything of build 30
- [ ] On the user's word, one iPhone build (12) with these and the waiting W6 items (Online payments, Face ID needs the PIN); later client changes go into Android 32

## 4h. Website home page: no carousel, categories first (client, 23 Oct 2026)
The client: "remove the first carousel on the home page, directly show the categories". The user: mock-up first, don't change the website code yet.
- [x] Mock-up with three layouts (A four category tiles, recommended; B round photos + largest collections; C each category with its collections), built from the live home page: `design/ui-mockup/web-8-home-categories/` (start page, home page, kit, phone and laptop). Checked 252/252 in Chrome's and Safari's engines
- [ ] Owner's picks (1 top A/B/C, 2 logo entrance, 3 order after the categories), then build it into the real home page (`HomePage.jsx`; the website goes live with W6/W7 or as a patch like 23 Oct)
- [ ] Shop: better category photos (upright, at least 900 × 1200); fix the "Kalamkari Lehanga Sets" photo (a laptop keyboard) and check "Plain Cotton Saree"; keep or hide Handloom cotton sarees (2 pieces)
- [x] 25 Oct: the client pictures a typical online shop (the sarees as soon as the site opens). Second mock-up, end to end: `design/ui-mockup/web-9-shop-first/` (home A/B/C, listing with filters and sort, search, saree page, bag, sign in, checkout, order placed, My orders; kit; phone and laptop). 226 real sarees; checked 224/224 in Chrome's and Safari's engines. The categories-first mock-up is kept aside to show the client too
- [ ] Owner's picks between the two mock-ups (and the lettered choices inside), then the website build
- [x] 25 Oct: the client accepted the categories-first home, layout A, and asked for: categories with photos → a category shows all its subcategories (collections) with photos → a subcategory shows all its sarees. Mock-up end to end: `design/ui-mockup/web-10-category-pages/` (all 4 categories, 76 collections, 1,730 real sarees; photos chosen; 169/169 in Chrome's and Safari's engines). The shop-first mock-up (web-9) is kept aside
- [x] 25 Oct (later): the client wants the home page in the "products first" design (web-9 option A) with all 6 categories and a "Latest collections" section; the category and collection pages stay. web-10 rebuilt on that design (the earlier web-10 is on the Desktop: "Nandam mock-up - categories, collections, sarees (25 Oct)"); 6 categories (cotton dress materials and fabrics "Coming soon": only test stock), 1,730 sarees; 229/229 in Chrome's and Safari's engines
- [x] 26 Oct: built into the website, every choice A (user: "do the end to end work entirely"): header with search and category menu, home (6 round categories, latest collections, every saree), category page (collections), collection page, card with Add to bag; the shop's details footer **only on the home page**, a line of links elsewhere; server `/catalog` adds `soon`, `newest`, `hasNew`, `totals.newSarees`. All browser tests pass in both engines. Record: `modules/web-02-home-and-shop.md` section 15. **Local only, not live**
- [x] **LIVE 26 Oct ~13:55 IST** with W6 (online payment on Razorpay TEST keys, open to everyone, "Test payment" note), W7, the number 7382388565 and the saree link previews. Record + undo: `deployment/live-v2-server.md` → Changes deployed, 26 Oct
- [ ] The user: a signed-in test payment on the live site (test card 4111 1111 1111 1111 or UPI success@razorpay), then the order in the admin app (To ship, Online payments) and cancel it
- [ ] Before real selling: live Razorpay keys + webhook, `PAYMENTS_TEST_FOR_EVERYONE=false`, final policy texts, the accountant on IGST, cancel test orders
- [ ] Shop: delete the test pieces (TEST02, TEST05 in Handloom Cotton Dress Material; Test1 in Fabrics) and add real stock to those two categories
- [ ] Shop content that a product grid needs: a name per saree with its colour (names repeat inside a collection), the colour filled in (for a colour filter), a second photo per saree

## 4f. The live database moved to our own server (18 Oct 2026, after the Neon outage)
Neon's free monthly limit ran out at 08:43 IST and the whole live shop was down; the user chose the 16 Oct backup on a database on the live EC2 (no Neon charges). Record: `deployment/live-v2-server.md` → "Changes deployed", 18 Oct.
- [x] PostgreSQL 18 on the EC2, the 16 Oct 23:26 IST backup restored, both servers moved, shop back up; nightly backup (14 kept) and a copy on the Mac
- [ ] **Tell the shop:** anything entered between **16 Oct 11:26 pm and 18 Oct 8:43 am** is gone from the live data: 17 Oct's bills and sales (those sarees show as in stock again), new sarees and photos added then, stock changes, staff and customer sign-ins (phones may ask to sign in again). Re-enter the sales of 17 Oct / early 18 Oct, or sell those sarees again by mistake
- [ ] Keep the Neon project `broad-dawn-60042267` (locked, holds 17 Oct's data; free); delete it only on the user's word
- [ ] Backups off the server too (today: the server's own disk + manual copies to the Mac). Options: a weekly copy to the Mac, or a private S3 folder (costs very little): user's choice
- [ ] The server is now 1 GB with both servers + the database (about 230 MB free + 3 GB swap): watch memory; switching off the old server (needed before 4 Nov anyway) frees about 200 MB

## 4e. Next steps (discussed 17 Oct 2026; still the development stage, going live later)
The user: "still it is in the development stage so we have some time to make it live". Order agreed for later; nothing goes live without the user's go.
- [ ] **1. Put checkout + Online payments live**: the website, the server, the old webhook moved by nginx, the old server switched off. Steps in `modules/web-04-checkout.md` section 18. Needs: the owner checks the shipping, refunds and contact texts; Razorpay in live mode; the user's go. **The old server must be off before 4 Nov 2026** (its Activity deletion starts then; its PIN sign-in can be guessed), or switch off only its deletion job first
- [ ] **2. Share Android build 31** (was 30) with the owners (Online payments and notifications; safe before step 1: the new parts appear only after the server update). Needs: the user's OK
- [ ] **3. Admin app fixes from live use** (no input needed):
  - "First time here? Set up your account" is too small (4a);
  - catalogue PDF for 250+ sarees may time out;
  - search ignores the filter chip;
  - order search stops at 60;
  - the other "Lower" items in 4d
- [ ] **4. Data clean-up before the switch-over** (section 5):
  - the wrong store prices: ₹54,310 typo, the 46 designs at ₹11,999, the ₹9 and ₹10 designs;
  - rename "System Admin" and "Admin 8565" to the real people;
  - set the main owner;
  - the website address in Settings.
  - Needs the owner's correct prices, names and number
- [x] **5. Website W7 "My orders": done end to end on 17 Oct 2026, on this Mac only (not live, not committed).** Full record: `modules/web-05-my-orders.md` (plan sections 1–15, built 16, tests 17, going live 18). The user (17 Oct): "note it end to end in the to-do list, we will discuss on this later".
  - **Done, step by step:**
    - [x] Plan with the old website's problems, facts from the live data, decisions 7.1–7.10, rules, every situation
    - [x] Clickable mock-up with every screen and state (`design/ui-mockup/web-7-my-orders/`)
    - [x] Picks: **all A** (the user: "implement it as you are recommended")
    - [x] Server: My orders list (20 at a time), one order with tracking and invoice state, invoice download only for its customer, Buy again by the bag's rules, "shipped" and "delivered" notices from the admin app, the owners' hand refund in Razorpay recognised. No database change
    - [x] Website: My orders tab, order cards, the order's page (progress line, tracking with Copy and "Track on DTDC", Download invoice, Buy again, Help on WhatsApp), latest order on My account, menu and footer links, old website links
    - [x] W6 slip fixed: a paid order cancelled by the shop says "refund on its way", never "Nothing was charged"
    - [x] Tests: server 581/581, website 125/125, browser 143/143 in Chrome, Safari's engine and the live-style build; W6 147/147, W5 111/111, W1 245/245 again
    - [x] **Android phone** (Samsung, its own Chrome): the whole journey 80/80, the "shipped" message on the open page, the "delivered" notification on the phone and its tap, the invoice in Downloads
    - [x] Found on the phone and fixed: two notification sign-ups at once (W1 code), the order page's bag update warning (W6 code)
  - **To discuss later (with the user):**
    - [ ] **Cancelling (7.10):** A a Cancel button before shipping, refunded automatically · B a cancel request the owner approves in the admin app · C WhatsApp only (as now). Until decided, each order says "Need to cancel or change something? WhatsApp us"
    - [ ] **Going live:** together with W6 (item 1), only on the user's go. Nothing extra to set up for W7 (no database change, no new setting)
    - [ ] **The owner confirms** the delivery promise shown on orders: "packed within 2 working days, delivered in 3 to 7 days"
    - [ ] **After going live:** one real order shipped in the admin app, checked as a notification on a customer's phone
    - [ ] **Later ideas, not built:** shop and WhatsApp bills in My orders (7.5 B, needs the mobiles cleaned first), SMS updates (7.8 B, needs DLT templates), returns and exchanges, live DTDC status
  - **Choices made while building** (can change if the user wants): the shop's cancel reason is not shown to the customer; a later visit to an order shows its own page (the "Thank you" page only right after paying)
- [ ] **To discuss later: Razorpay payment link for WhatsApp orders** (the user, 17 Oct: "we will discuss this part later"). Today "Order on WhatsApp" only opens a chat with the sarees typed in; the shop sends its UPI details by hand, checks the money in its own bank app, and records the sale in the admin app; nothing is held meanwhile. Idea: in the admin app, a WhatsApp order gets a "Payment link" (Razorpay, exact total) shared in the chat; the sarees are held; Razorpay's notice marks it paid and puts it in To ship. Same Razorpay fee as website payments. Suggested after W8
- [ ] **6. Owner questions** (section 2): returns/exchange, part cash part UPI, advance, untagged items (blouse stitching, fall & pico). Only if the shop needs them
- [ ] **iPhone (later)**: [`ios-work-later.md`](ios-work-later.md)

## 4d. Admin app: rare situations found on 16 Oct
From the same check (five reviewers, main findings confirmed by reading the code). Owner: "do 1–8 end to end"; Face ID with the PIN built for testing; the old server not to be changed.
- [x] PIN guesses sent at the same moment: tries taken before the PIN is checked (sign-in and Change PIN); SMS codes the same (live 16 Oct 15:33 IST)
- [x] A renewal whose reply was lost no longer signs everyone out (`Session.usedAt`, database update `20261016130000_v2_session_used_at`)
- [x] Tag changes refused when a sale landed a moment before (`TAG_CHANGED`)
- [x] Staff Home counts every bill of the day
- [x] Invoice PDFs made again: the right quantity and the invoice's own GST rate
- [x] The accountant's CSV: formula-like text kept as text
- [x] Database time limits (28 s per statement, set on each connection; 10 s to get one)
- [x] Settings → App updates refuses a version no phone has (and one that would block the phone making the change)
- [x] Face ID needs the PIN: server ready (checks a PIN when sent); app in Android build 29 (`apk/Nandam-Admin-v2.0.0-build29.apk`) and iPhone build 11 (built, kept on the Mac, NOT uploaded to TestFlight: owner said wait, iPhone builds are limited)
- [ ] **Owner decides when to push** Android 29 / iPhone 11; after every phone has it, set `BIOMETRIC_NEEDS_PIN=true` in the server `.env` and restart
- [ ] Old server (`/api/v1`): owner decided not to change it (it is switched off after the new website). Until then: its deletion of Activity older than 30 days starts **4 November 2026**, and its PIN sign-in can be guessed with many tries at once. Recommended: switch it off (`pm2 stop nandam-api`) before 4 Nov if no phone uses the old staff app
- [ ] Before online payment (W6): a cancelled order can still be paid in Razorpay and the old server brings it back ("processing"). **Fixed in the new server (W6, rule 7.6)**; it goes away when the webhook moves to the new server and the old server is switched off at W6 go-live
- [ ] Lower: deleted subcategory with damaged sarees can come back into stock; catalogue PDF for 250+ sarees may time out; search ignores the filter chip; photo-count limits under two uploads at once; order search stops at 60; numbers above ₹99,999,999 give an error; activity grouping over 300 items; analytics over two years on 1 GB; LoginThrottle never cleaned; Express 5 swallows "port in use"

## 5. Before the shop switches over (not missing, still to do)
Done on 2026-10-13 for the first iPhone (Dheeraj): details and undo steps in [`deployment/live-v2-server.md`](deployment/live-v2-server.md).
- [x] Run the database updates on live (11 migrations, up to `v2_tracking_number_rule`) and `scripts/copy-store-prices.js --yes` (160 sale lines)
- [x] Start the new server on the live EC2 beside the old one (`https://api.nandamhandlooms.com/api/v2`, real SMS)
- [x] iPhone: build 7 (version 2.0.0) uploaded to TestFlight as an update of the old app, for Dheeraj's group only
- [ ] Run `scripts/copy-store-prices.js --yes` once more at the final switch-over: sales made in the old app after 2026-10-13 have no saved store price yet
- [x] Release the iPhone build to the client: build 8 added to the TestFlight group "Current app" on 2026-10-15 (owner's go); Dheeraj moved into it and "Team (Expo)" removed. Android: the owner shares `Nandam-Admin-v2.0.0-build26.apk` (installs beside the old app)
- [ ] Switch off the old server's deletion of Activity records older than 30 days **before 4 November 2026** (and the old 6-month order purge)
- [ ] Fix the wrong store prices: "Gap Border bramini sarees" ₹54,310 (typo), the 46 designs still at ₹11,999, the ₹9 and ₹10 designs (Analytics → Stock → Prices to check)
- [ ] Rename the owner accounts "System Admin" (9494170180) and "Admin 8565" (7382388565) to the real people
- [ ] Set the main owner (`scripts/set-main-owner.js <mobile>`, after the owner confirms the number)
- [ ] Set the website address in Settings → Shop details (WhatsApp product links)
- [ ] Android: decide how phones move to the new app (Module 11, decision 6.8: same app id `com.nandamhandlooms.staff` with build 26+ if the old signing key and store access are available). iPhone is decided and built
- [ ] When done testing: remove the team test server (paused since 2026-10-13) (steps in [`testing/test-server.md`](testing/test-server.md))
- [ ] Commit everything to the `develop` branch (only when the owner says so)

# Review: Module 3 — Site frame (everything around every page)

Review of 26 Oct 2026. I only read the code on the Mac (website and server). Nothing was run, changed, or opened on the live server or database.

Website files are under `Nadam-frontend/customer-web/` (written below as `customer-web/…`). Server files are under `Nadam-backend/`.

---

## 1. What this module does

It is the "frame" of the website: the coloured strip at the top, the header (logo, search bar, Sign in or the customer's name, Bag), the category menu bar, the phone menu, the footer, the light/dark switch, the green WhatsApp button, the "you are offline" strip, and the special pages ("website is being updated", "page not found", "something went wrong").
When the website opens it also asks the server once for the shop's settings (the website switch, the shop's phone and address, whether online payment is on, and so on).

---

## 2. What a customer sees and does

1. Opens the website. Light or dark colours are chosen before anything is drawn, so there is no flash of the wrong colours.
2. At the very top: a wine-coloured strip "Free delivery across India". On computers it also says "Handwoven in Old Mangalagiri" and "Order on WhatsApp: +91 73823 88565".
3. The header stays at the top while scrolling: logo (goes to the home page), search bar, "Sign in" (or the customer's first name and photo), and Bag with the number of pieces.
4. Under it, the menu bar: All sarees, the 6 categories by short name (Pattu sarees, Pattu dress materials, …), New in, Sets.
5. On a computer, pointing the mouse at a category opens a panel: its biggest collections, its crafts and a photo. "Coming soon" categories show what is on the way.
6. On phones and small tablets: a Menu button (three lines) opens a side menu from the left with every category and its count, All collections, New in, Sets, the crafts, My orders and My account (or Sign in), Bag, WhatsApp us and Visit the store. It closes with the X, by tapping the dark area, with the Escape key, or after choosing a page.
7. Bottom of the home page only: the full footer. Four promises, shop links, help links, "WhatsApp us", "Call +91 73823 88565", the store's address and hours, a Google Maps link, the GSTIN, and the Theme switch (Auto, Light, Dark).
8. Bottom of every other page: one line with © and the links Shipping, Cancellation and refunds, Contact us, Privacy, Terms.
9. A green round WhatsApp button at the bottom right on the home page, lists, categories, collections, help pages and "not found". It is hidden on the saree page, bag, checkout, order pages, sign-in and My account (it would cover buttons there).
10. If the internet drops: a yellow strip "You are offline. What you type is kept; we'll try again when you're back."
11. If the owner switches the website off (admin app → Settings → Maintenance → Website): a full page "The website is being updated", the owner's message, a WhatsApp link and a "Try again" button.
12. A wrong address: "We couldn't find that page" with "See all sarees" and "Go to the home page".
13. If a page breaks: "Something went wrong", a short code to quote, "Reload the page" and "Go to the home page".
14. A new page starts at the top. The browser's Back button returns to the same place on the previous page. "Visit the store" goes to the store details in the home page footer.
15. Every page has its own title in the browser tab (for example "Pattu sarees · Nandam Handlooms").

---

## 3. Each API

API = an address on the server that the website asks for information. This module uses one: **GET `/api/v2/shop/config`** (the shop's settings).

| What it is for | What goes in | What comes back | What is saved | What can go wrong |
|---|---|---|---|---|
| Tells the website, once when it opens: is the website switched off, the shop's phone and address, WhatsApp number, whether online payment is on, tax details, form lists, and the public values for notifications. | Nothing. No sign-in needed. | The settings listed in the next table. | Nothing. It only reads. | See the error table below. In every failure the website quietly uses its own built-in copy, and online payment and notifications stay off for that visit. |

**What comes back, where it comes from, and what the website does with it**

| Part | What it holds | Comes from | Used on the website for |
|---|---|---|---|
| `maintenance` (on, message) | Is the website switched off, and the owner's message | Database (Settings row), re-read at most every 10 seconds | Showing the "being updated" page |
| `shop` (name, mobile, address, gstin, website) | The shop's business details | Database (Shop details in the admin app); if empty, the server's settings file | "Call" links (footer, Contact, saree page "Questions? Call"), GSTIN (footer, Contact, Terms), name and address (Contact, Privacy, Terms), phone for search engines. `website` is not used. |
| `store` (addressLines, hours, openingHours, whatsapp, mapUrl) | Store address in 3 lines, hours, WhatsApp number 917382388565, map link | Typed into the server's code (`Nadam-backend/src/config/constants.js:186-192`) | Every WhatsApp link and number on the site, the footer's "Visit the store", the Contact page, search-engine data |
| `signIn` (code length 6, resend 60 s, 30 days) | Sign-in rules | Server code | Not used. The website has its own copy of "6". |
| `payments` (enabled, testersOnly, holdMinutes, mode, maxAmount) | Is online payment on, only for some people, test or live, the most per payment | Server settings file + code | Whether "Pay" shows, the "Test payment: no real money" note, the "order on WhatsApp above ₹…" message. `holdMinutes` is not used. |
| `gst` (rate, shop state, IGST on/off) | Tax rules | Server settings file | The tax line on checkout and order pages |
| `limits` (addresses, photo size, name length, delete days, bag limits) | Size limits | Server code | Only the photo size is used. The website has its own copy of the bag limits (20 sarees, 50 pieces). |
| `states`, `languages`, `addressLabels` | Lists for forms | Server code | State list in the address form, language list in Profile. `addressLabels` is not used. |
| `push` | Public Firebase values for notifications, or nothing | Server settings file | Whether "Turn on alerts" can work |

**Saved copies (caching).** The server says a saved copy may be used for 60 seconds, but the website always asks fresh, so this has no effect today. The server itself remembers the website switch for up to 10 seconds. The shop details are read from the database every time.

**When the website asks.** Once, as the website starts. It does **not** wait for the answer: the page is drawn at once with the website's built-in copy (phone 73823 88565, the store address, the state list), and switches to the server's settings when they arrive. It never asks again during the visit.

**Errors**

| What goes wrong | Server's answer | What the customer sees |
|---|---|---|
| The database can't be read | 500 "Something went wrong on our side" with a code | Nothing visible. Built-in details are used. Online payment and notifications are off for the whole visit. |
| The server is stopped or restarting | 502 / 503 / 504 from the web server | Same as above. |
| Very slow connection (no answer in 20 seconds) | — (the website gives up) | Same as above. |
| Offline when the site opens | — | Same as above, plus the yellow offline strip. |
| Website switched off | Still answers (this address is checked **before** the switch), with `maintenance.on = true` | "The website is being updated" page. Every other website address answers 503 "MAINTENANCE", and the website switches to the same page whenever it gets that answer. |
| Too many calls | No limit on this address | — |

Related (belongs mostly to the saree page module): **GET `/api/v2/shop/pages/product/:slug`** sends the website's start page with that saree's name, price and photo in the hidden "link preview" part, so WhatsApp shows the saree. It works even when the website is switched off.

---

## 4. The data kept

**Settings row in the database (`AppConfig`, one row called "default")** — only the parts the website uses:

| Field | What it means | Must have it or not |
|---|---|---|
| `id` | Always "default" (there is only one row) | Must |
| `webMaintenanceEnabled` | Website switched off: yes / no | Must (starts as "no") |
| `webMaintenanceMessage` | The owner's message on the "being updated" page (up to 300 letters) | Must (can be empty) |
| `webMaintenanceSince`, `webMaintenanceBy` | When and by whom the website was switched off (shown in the admin app) | Optional |
| `shopName` | Shop name. Empty = the server's settings file | Optional |
| `shopAddress` | Shop address (invoices, Contact page). Empty = settings file | Optional |
| `shopMobile` | The shop's call number, 10 digits. Empty = settings file (which still has the old 94941 70180 as its default) | Optional |
| `shopGstin` | GST number. Empty = settings file | Optional |
| `websiteUrl` | The website address. Not used by the website | Optional |
| `shopChangedAt`, `shopChangedBy` | When and by whom shop details last changed | Optional |
| `maintenanceChangedAt/By`, `updatedAt/By` | Who last changed the switches / the row | Optional / automatic |
| Staff-app fields (`maintenanceEnabled`, app update numbers and links) | For the admin app only | Not used by the website |

Every change to the switch or the shop details is also written to the Activity log (before → after).

**Server settings file (`.env`, names only)** used by this API: `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_MOBILE`, `COMPANY_GSTIN`, `WEBSITE_URL` (fall-backs for shop details), `PAYMENTS_ENABLED`, `RAZORPAY_KEY_ID` (test or live), `PAYMENTS_TESTERS`, `PAYMENTS_MAX_AMOUNT`, `GST_RATE_PERCENT`, `SHOP_STATE`, `GST_IGST_OTHER_STATES`, `FIREBASE_WEB_*` and `FIREBASE_PROJECT_ID` (public notification values), `SHOP_WEB_ORIGINS` (which website addresses may call the server).

**Typed into the code:** the store's address lines, hours, WhatsApp number and map link (`constants.js` `STORE`), and a built-in copy in the website (`customer-web/src/config/config.js:7-22`) plus the number in `customer-web/index.html:29`.

**Kept in the customer's browser**

| What | What it means | Must have it or not |
|---|---|---|
| `nh-theme` | The customer's colour choice: "light" or "dark" (nothing = Auto) | Optional |
| `nh-reloaded-for-update` | Time of the last automatic reload after a website update (stops reload loops) | Optional |
| Scroll places (in memory only) | Where the customer was on each page, for Back. Lost on reload. | Optional |

---

## 5. On the website

**Loading the settings.** Starts at once; the page does not wait. No spinner, no message, no second try. If it fails, the built-in copy is used for the rest of the visit.

**Colours (theme).** A tiny script in the page head reads the saved choice and sets light or dark before anything is drawn. Auto follows the phone or computer and changes live when the device switches. The choice is kept in this browser only. The switch (Auto / Light / Dark) is only in the home page footer.

**Top strip and header.**
- Logo → home page. Search bar on every page (on phones it sits on its own row under the logo).
- Sign in / account: shows "Sign in" until the sign-in check finishes, then the first name (cut with "…" if long) and photo or initials. The full name is read out to screen readers.
- Bag: icon with the number of pieces ("99+" above 99), with a small bounce when something is added. Opens the bag panel; on the bag page it scrolls to the top.

**Menu bar and category panels (computers).** The categories appear when the shop's catalogue arrives; until then only All sarees, New in and Sets show. Category panels open on mouse-over or when a link inside gets keyboard focus. Panels only work on screens wider than 900 pixels with a mouse; touch tablets get the bar without panels. The current page's item is underlined.

**Phone side menu.** Opens from the left over the page, the page behind can't scroll, keyboard focus stays inside, Escape closes, focus returns to the Menu button. It closes after choosing a **different** page.

**Footer.** Home page: full footer with the shop's details and the Theme switch. Other pages: one line of help links (needed by Razorpay).

**WhatsApp button.** Green, bottom right, opens WhatsApp in a new tab with the shop's number. Lifted higher on phones so it doesn't cover the list's Filter/Sort bar. Hidden where it would cover buttons (see section 2, point 9).

**Offline strip.** Appears and disappears by itself when the device says it lost or got back its connection.

**Website switched off.** Full page with logo, "The website is being updated", the owner's message (or "Please check back in a little while."), WhatsApp link, "Try again" (reloads the page). Tab title "Back soon · Nandam Handlooms".

**Not found.** "We couldn't find that page — The link may be old, or the address has a typo." Buttons: See all sarees, Go to the home page. Also used for a saree, collection or category that is no longer on the website.

**Something went wrong.** Replaces the whole screen. Short code, "Reload the page", "Go to the home page".

**Waiting.** A page opened for the first time shows a small spinning circle while its part of the website downloads; the header and footer stay. If the phone is offline it waits and continues when the connection returns. If the website was updated in the meantime it reloads once by itself.

**Scroll position.** New page → top. Back/Forward → the old place (it keeps trying for 1.5 seconds while the page fills). Changing filters, sort or "Load more" keeps the place. "Visit the store" follows the store section for up to 6 seconds while the page above it is still loading, and stops below the sticky header.

**Messages (toasts).** Short messages at the bottom, at most 3 at a time; they go by themselves (4 s; errors 7 s) and have a close button. "Are you sure?" pop-ups keep the keyboard inside and close with Escape.

**Titles and descriptions.** Each page sets its tab title ("… · Nandam Handlooms"); shop pages also set the short description used by search engines.

**Security headers** (rules the browser follows to block other sites' tricks). The server adds the standard set (helmet). For the website pages the live web server (nginx) adds a strict "only our own files" rule, HTTPS-only, no framing by other sites, no camera/microphone/location. I could not see the live web server settings; the local preview uses the same rule.

**Checked and fine:** the colours never flash; the side menu's keyboard and Escape handling; the "Skip to content" link; footer only on the home page and one line elsewhere; every phone and WhatsApp number in the website code is 73823 88565; nothing secret is sent by `/config`; server errors never show inside details; other websites can't call the server with the customer's sign-in.

---

## 6. Problems found

### Must fix
None found in this module. Nothing here loses money, orders, stock or data, I found no security hole, and the customer always has a way out (Reload, Home, WhatsApp).
> **Second check: ✅ Correct.**

### Should fix

**S1. The shop's settings are asked for only once; if that fails, online payment and notifications are off for the whole visit, with no message.**
Why it matters: on slow mobile data the first call can take more than 20 seconds or fail. The customer then only sees "Order on WhatsApp" at checkout even though online payment is on, and "Turn on alerts" does not work, until they reload the page by chance.
Where: `customer-web/src/config/config.js:35-43`, `customer-web/src/main.jsx:25`; effect in `customer-web/src/pages/checkout/CheckoutPage.jsx:113` and `:199`.
> **Second check: ✅ Correct.**

**S2. Switching the website off also blocks the check that runs right after a customer pays.**
Why it matters: if the owner switches the website off while someone is in the Razorpay window, the customer pays, and then sees "The website is being updated" instead of "Order placed". The money is safe (the server asks Razorpay by itself within about 3–8 minutes and marks the order paid), but the customer doesn't know that and may worry or call.
Where: `Nadam-backend/src/routes/shop/index.js:33` (switch placed before) `:99` (the payment check); the website turns any such answer into the full "being updated" page: `customer-web/src/api/client.js:82`, `customer-web/src/App.jsx:53`.
> **Second check: ✅ Correct.**

**S3. On an iPhone, when the website is added to the Home Screen, the header slides under the clock and battery bar.**
Why it matters: the website asks iPhone customers to add it to the Home Screen to get alerts. In that mode the page is told to draw under the clock bar, but the header has no space reserved for it. After scrolling, the Menu, logo, Sign in and Bag buttons sit under the clock, and tapping there scrolls the page to the top instead.
Where: `customer-web/index.html:24` (with `:5`), `customer-web/src/theme/base.css:156` (top strip) and `:162` (sticky header): no `safe-area-inset-top`.
> **Second check: ✅ Correct.**

**S4. On a computer, a category panel stays open after clicking a link in it (Chrome and Edge, and always with the keyboard).**
Why it matters: after choosing a collection, the big panel keeps covering the top of the new page until the customer clicks somewhere else. Escape does not close it. Keyboard users must press Tab through every link in a panel (up to about 18) to reach the next category.
Where: `customer-web/src/theme/base.css:202` (the panel shows while anything inside has focus), `customer-web/src/components/Header.jsx:78-83` and `:123`.
> **Second check: ✅ Correct.**

**S5. The phone menu does not close when the customer picks the page that is already open.**
Why it matters: on the home page, tapping "Visit the store" (or the logo in the menu) leaves the menu open, and the page moves behind it, so it looks like nothing happened. Same for "All sarees" while on All sarees, or "New in" while on New in.
Where: `customer-web/src/components/SideMenu.jsx:20-23` (closes only when the address changes, not the `#store` part), links at `:31` and `:47`.
> **Second check: ✅ Correct.**

**S6. Moving between lists from the header keeps the old scroll position.**
Why it matters: a customer far down "All sarees" taps "New in" or "Sets" in the menu bar, or searches from the header while on a list. The new list loads but they stay far down the page, often at the very bottom, and must scroll back up to find it. Tapping the logo while on the home page does nothing.
Where: `customer-web/src/components/ScrollManager.jsx:96-102` (same page address `/shop` = keep the place); links in `customer-web/src/components/Header.jsx:122-125`, search in `customer-web/src/components/SearchBox.jsx:60`.
> **Second check: ✅ Correct.**

**S7. The "Something went wrong" screen has no WhatsApp link or number, and its code can't be looked up.**
Why it matters: it tells the customer to "message us on WhatsApp and quote" a code, but the screen has no link or number (the header is gone too). The code is made up on the spot and only written inside the customer's own browser, so the shop can't find anything with it, and nobody learns that the page broke.
Where: `customer-web/src/components/ErrorBoundary.jsx:11` (random code), `:15` (only written to the browser), `:25` (message, no link).
> **Second check: ✅ Correct.**

**S8. The offline strip promises "we'll try again when you're back", but most pages don't.**
Why it matters: when the connection returns, the strip goes away but the home page, lists and saree pages still show "couldn't load" until the customer presses "Try again". Only the bag and the page downloads retry by themselves.
Where: `customer-web/src/components/Layout.jsx:24`; only `customer-web/src/bag/store.js:406` and `customer-web/src/utils/lazyPage.js:25` listen for the connection coming back; `customer-web/src/data/resource.js:18-28` never retries.
> **Second check: ⚠️ Partly correct: the broken promise is real, but every failed page shows its own clear "Try again" button (HomePage.jsx:99-101, ShopList.jsx:111-113, ProductPage.jsx:103-105 …) and reopening a page retries, so nobody is stuck; wording/polish, right group Small.**
> **Third check: Second checker right. Final: after the connection returns, pages that failed don't reload by themselves (so "we'll try again" isn't quite true), but each one shows its own "Try again" button and reopening the page retries. Final group: Small.**

**S9. The home footer always says "Secure payment: UPI, cards and net banking".**
Why it matters: today payment is in test mode ("no real money is taken, test orders are not shipped"), and if payment is switched off again the site only takes WhatsApp orders. The promise stays the same in every case.
Where: `customer-web/src/components/Footer.jsx:25`.
> **Second check: ⚠️ Partly correct: the text is fixed, but online payment really is offered today and the test status is shown wherever one can pay (TestPayNote in bag panel, bag page, checkout), and checkout clearly says when payment is off; a generic footer promise, right group Small.**
> **Third check: Second checker right. Final: the home footer always promises "Secure payment: UPI, cards and net banking", even in test mode or with payment off, but the bag and checkout always show the true status before anyone pays. Final group: Small.**

**S10. The WhatsApp number is typed into the code in three places, and the call number lives in the admin app.**
Why it matters: next time the number changes, the owner can change the call number in the admin app but not WhatsApp; WhatsApp needs a developer to change three files and release the website and server. Until then the site shows two different numbers.
Where: `Nadam-backend/src/config/constants.js:190`, `customer-web/src/config/config.js:9` and `:13`, `customer-web/index.html:29`; call number from `Nadam-backend/src/services/settings.service.js:61`.
> **Second check: ⚠️ Partly correct: `config.js:9` is the call-number fallback, not WhatsApp; on a normal visit only the server's `STORE.whatsapp` counts (the other two are fallbacks for a failed `/config` or no JavaScript), and both numbers match today, so it is a maintenance risk: right group Small.**
> **Third check: Second checker right. Final: only a developer can change the WhatsApp number (mainly the server's `STORE`; the website's two copies are fall-backs), while the call number is changed in the admin app; both match today, so it matters only at the next number change. Final group: Small.**

**S11. The Light / Dark / Auto switch is now only at the very bottom of the home page.**
Why it matters: the owner chose "a visible switch on the site" (website plan, `docs/modules/web-00-website-plan.md:6`). Since the 26 Oct footer change, a customer on any other page, or on a phone, has to go home and scroll past the whole saree list to find it. The phone menu and the one-line footer don't have it.
Where: `customer-web/src/components/Footer.jsx:70` (only in the home footer), `customer-web/src/components/Layout.jsx:35`, `customer-web/src/components/Footer.jsx:79-88` (one-line footer, no switch).
> **Second check: ⚠️ Partly correct: true, but it follows from the user's own 26 Oct decision (shop-details footer only on home, `web-02-home-and-shop.md:159`) and Auto already follows the device; adding the switch elsewhere is the owner's design choice, right group Small.**
> **Third check: Second checker right (nuance: it is a side effect of the 26 Oct footer decision, which doesn't mention the switch). Final: since 26 Oct the Auto / Light / Dark switch is only at the very bottom of the home page (and on computers partly under the WhatsApp button); Auto still follows the device, and where else to put it is a question for the owner. Final group: Small.**

### Small

1. Screen readers are not told that a new page opened; the focus stays on the link that was pressed. Where: `customer-web/src/components/Layout.jsx:27`, `customer-web/src/components/ScrollManager.jsx:94-106`.
   > **Second check: ✅ Correct.**
2. When offline, the yellow strip and the header both stick to the top and the strip covers the top of the header (on a small phone the long message takes 2–3 lines). Where: `customer-web/src/theme/base.css:257` and `:162`.
   > **Second check: ✅ Correct.**
3. On computer windows about 900–1,130 pixels wide, the menu bar may not fit; the end items ("New in", "Sets") are cut off with no scroll bar, and mouse users can't reach them. Not sure of the exact width without opening it. Where: `customer-web/src/theme/base.css:195-199`.
   > **Second check: ✅ Correct.**
4. While the catalogue is loading (or if it failed), the menu bar and phone menu show no categories, and the header does not ask again by itself. Where: `customer-web/src/components/Header.jsx:74`, `customer-web/src/data/categories.js:33`, `customer-web/src/data/resource.js:37-41`.
   > **Second check: ✅ Correct.**
5. On the home page, "All sarees" is announced as "current page", though it leads to another page. Where: `customer-web/src/components/Header.jsx:21`.
   > **Second check: ✅ Correct.**
6. A saree link opened directly doesn't underline its category in the menu bar (the header isn't told when the saree arrives). Where: `customer-web/src/components/Header.jsx:31`.
   > **Second check: ⚠️ Partly correct: right reason, but it is not only direct links: any first opening of a saree from inside the site misses the underline too (the saree is fetched after the page opens and nothing pre-loads it); it shows only for a saree already in the cache, or by chance if the header redraws later.**
   > **Third check: Second checker right. Final: the first time any saree is opened, from inside the site or from a link, its category is not underlined in the menu bar; it shows only when that saree was already loaded. Final group: Small.**
7. A signed-in customer sees "Sign in" in the header for a moment while the sign-in is checked. Where: `customer-web/src/components/Header.jsx:105`.
   > **Second check: ✅ Correct.**
8. When the website is switched off, the normal page is drawn for a moment first; and the "being updated" page never notices the website is back (the customer must press "Try again"). Where: `customer-web/src/config/config.js:24`, `customer-web/src/App.jsx:53`, `customer-web/src/pages/info/MaintenancePage.jsx:17`.
   > **Second check: ✅ Correct.**
9. One broken page replaces the whole screen (header and menu too), and the browser's Back button doesn't clear it. Where: `customer-web/src/main.jsx:31`, `customer-web/src/components/ErrorBoundary.jsx:18-19`.
   > **Second check: ✅ Correct.**
10. Back loses its place after a page reload, and after changing sort or filters and opening a saree without scrolling first. Where: `customer-web/src/components/ScrollManager.jsx:9`, `:88`, `:99`.
    > **Second check: ✅ Correct.**
11. A colour choice made in one tab doesn't reach other open tabs; the phone's browser bar colour follows the device setting, not the customer's choice. Where: `customer-web/src/theme/theme.js:33`, `customer-web/index.html:15-16`.
    > **Second check: ✅ Correct.**
12. When opened from the Home Screen, the opening screen is near-black while the site is white by default. Where: `customer-web/public/manifest.webmanifest:9`.
    > **Second check: ✅ Correct.**
13. The server's fall-back call number is still the old 94941 70180 (used only if Shop details are ever empty). Where: `Nadam-backend/src/config/env.js:82`.
    > **Second check: ✅ Correct.**
14. The website keeps its own copies of the code length and bag limits instead of the server's, so a change on the server would not reach it. Where: `customer-web/src/components/CodeInput.jsx:4`, `customer-web/src/bag/store.js:17-18`.
    > **Second check: ✅ Correct.**
15. `/config` has no request limit and reads the database on every call (a cheap read; low risk). Where: `Nadam-backend/src/routes/shop/index.js:29`, `Nadam-backend/src/services/settings.service.js:56-57`.
    > **Second check: ✅ Correct.**
16. Not sure: on phones the green WhatsApp button may cover the last links of the one-line footer at the very bottom of a page. Where: `customer-web/src/theme/base.css:298` and `:288`.
    > **Second check: ⚠️ Partly correct: the overlap is real but on computers, not phones: above 900 px the button sits 20 px from the bottom (`base.css:295`) and covers "Terms" at the right end of the one-line footer (windows up to ~1,400 px); on phones the 66 px lift keeps it just above the links.**
    > **Third check: Second checker right (plus one extra). Final: on computers (about 900–1,450 px wide), at the very bottom of a page, the WhatsApp button covers most of "Terms" in the one-line footer, and on the home page most of the theme switch's "Dark" button; on phones it sits just above the links. Final group: Small.**

---

## 7. What I could not check

- **The live web server (nginx) settings**: the real security rules, the "saved copy" rules, whether "page not found" answers "200 OK" to search engines, and whether the saree preview address really swaps the server's own security rules for the website's (the deployment record says it does). Not allowed to log in to the server.
- **The live database**: that Shop details hold 7382388565 as the call number (the deployment record of 26 Oct says it was set). Not allowed to read the database.
- **Real phones and browsers**: S3 (iPhone Home Screen), S4 (panel staying open in Chrome), Small 3 (menu bar width) and Small 16 come from reading the code and how browsers normally behave; nothing was run.
- **How many copies of the server run** (one or several): only affects how fast the website switch takes effect (up to 10 seconds either way).
- **The "Skip to content" link after moving around the site**: not sure how the page-position code reacts to it, because that needs a real browser.
- Notifications, search suggestions, the bag panel and checkout belong to other modules; I looked at them only where the frame uses them.

---

## 8. For the developer

| # | Finding | Exact place | Suggested fix (one line) |
|---|---|---|---|
| S1 | `loadConfig()` runs once at import; on any error `status:'error'` with `FALLBACK` (no `payments`, `push:null`) for the session; `CheckoutPage` only waits on `'loading'` | `customer-web/src/config/config.js:35-43`, `customer-web/src/main.jsx:25`, `customer-web/src/pages/checkout/CheckoutPage.jsx:113,199` | Retry with backoff (and on `online` / `visibilitychange`) while `status==='error'`; let Checkout retry config before deciding "WhatsApp only". |
| S2 | `websiteOpen` guards every route after `/config`, incl. `POST /orders/:number/verify`; client turns any `MAINTENANCE` into the full maintenance page | `Nadam-backend/src/routes/shop/index.js:33,99`, `customer-web/src/api/client.js:82`, `customer-web/src/App.jsx:53` | Mount `/orders/:number/verify` (and probably `GET /orders/:number`) before `websiteOpen`, or exempt them inside it. |
| S3 | `apple-mobile-web-app-status-bar-style: black-translucent` + `viewport-fit=cover`, but `.top-strip`/`.hdr` have no top inset | `customer-web/index.html:5,24`, `customer-web/src/theme/base.css:156,162` | Add `padding-top: env(safe-area-inset-top)` to `.top-strip` and make `.hdr` `top: env(safe-area-inset-top)` with a filler, or use `default` status-bar style. |
| S4 | `.nav li:focus-within > .mega` keeps the panel after a click (Chrome focuses links) and after keyboard Enter; no Escape; panel links are in the Tab order | `customer-web/src/theme/base.css:202`, `customer-web/src/components/Header.jsx:78-83,123` | Blur the active element / close panels on `location.key` change, add Escape to close, consider a disclosure button per category instead of focus-within. |
| S5 | Close effect compares `pathname + search` with the first value; ignores `hash` and same-URL navigation (RR replaces with a new key) | `customer-web/src/components/SideMenu.jsx:20-23,31,47` | Close on `location.key` change (or `onClick={onClose}` on every link in the drawer). |
| S6 | `samePage = prevPath === pathname`, so PUSH `/shop` → `/shop?sort=new` (or `?q=`) never jumps to top; logo on `/` is a no-op | `customer-web/src/components/ScrollManager.jsx:96-102` | Jump to top on PUSH unless the navigation passes `preventScrollReset` (ShopList already sets it for filters / Load more). |
| S7 | Reference is `Math.random()`, logged with `console.error` only; no WhatsApp link (class component, header unmounted) | `customer-web/src/components/ErrorBoundary.jsx:11,15,25` | Add a `wa.me` link from `configStore.get().config.store.whatsapp`; send the error + reference to a small server log endpoint. |
| S8 | Banner text promises an auto-retry that only `bag/store.js` and `lazyPage` do; `resource.js` has no retry | `customer-web/src/components/Layout.jsx:24`, `customer-web/src/data/resource.js:18-28`, `customer-web/src/bag/store.js:406`, `customer-web/src/utils/lazyPage.js:25` | On `online`, re-`ensure(..., {force:true})` every entry in `'error'` (and reload config), or change the banner text. |
| S9 | Static "Secure payment: UPI, cards and net banking" | `customer-web/src/components/Footer.jsx:25` | Show it only when `paymentsOpen(config.payments)` and `mode==='live'`; else "Order on WhatsApp". |
| S10 | WhatsApp hard-coded in `STORE`, client `FALLBACK` and `noscript`; call number from `AppConfig.shopMobile` | `Nadam-backend/src/config/constants.js:190`, `customer-web/src/config/config.js:9,13`, `customer-web/index.html:29`, `Nadam-backend/src/services/settings.service.js:61` | Add `shopWhatsapp` to Shop details (AppConfig, additive column) with `STORE.whatsapp` as fallback. |
| S11 | `ThemeSwitch` rendered only in `Footer` (home) | `customer-web/src/components/Footer.jsx:70`, `:79-88`, `customer-web/src/components/Layout.jsx:35`, `customer-web/src/components/SideMenu.jsx` | Add the switch to `FooterLine` and the side menu. |
| Small 1 | No route-change announcement or focus move | `customer-web/src/components/Layout.jsx:27`, `customer-web/src/components/ScrollManager.jsx:94-106` | On PUSH, focus `#main` (preventScroll) or the page `h1`, or announce `document.title` in a live region. |
| Small 2 | `.net-banner` and `.hdr` both `position: sticky; top: 0` | `customer-web/src/theme/base.css:257,162` | Make the banner non-sticky, or offset `.hdr` by the banner's height while offline. |
| Small 3 | `.nav ul` overflows with `scrollbar-width: none` | `customer-web/src/theme/base.css:195-199` | Show the side menu button up to ~1,180 px, or add scroll arrows / smaller padding. |
| Small 4 | `allCategories(null)` → `[]`; Header's `useResource('catalog')` runs `ensure` once | `customer-web/src/components/Header.jsx:74`, `customer-web/src/data/categories.js:33`, `customer-web/src/data/resource.js:37-41` | Retry the catalogue from the header on error/online; keep a skeleton width to avoid the bar jumping. |
| Small 5 | `activeKey('/')` returns `'all'` → `aria-current="page"` on the /shop link | `customer-web/src/components/Header.jsx:21` | Return `''` for `/` (or use a visual class without `aria-current`). |
| Small 6 | `peek('saree:…')` is not subscribed | `customer-web/src/components/Header.jsx:31` | Read it through `useSaree(slug)` / `useResource` so the header re-renders. |
| Small 7 | `status` is `'unknown'` during bootstrap but the header shows "Sign in" | `customer-web/src/components/Header.jsx:105` | Render a neutral placeholder while `status === 'unknown'`. |
| Small 8 | `FALLBACK.maintenance.on=false` until `/config` answers; MaintenancePage has no re-check | `customer-web/src/config/config.js:24`, `customer-web/src/App.jsx:53`, `customer-web/src/pages/info/MaintenancePage.jsx:17` | Poll `/config` every 30–60 s on the maintenance page and lift it automatically. |
| Small 9 | Single `ErrorBoundary` outside `BrowserRouter` | `customer-web/src/main.jsx:31`, `customer-web/src/components/ErrorBoundary.jsx:18-19` | Add a boundary around `<Outlet/>` in `Layout`, reset on `location.key`. |
| Small 10 | `positions` is an in-memory Map; filter changes are `replace` (new key) and are saved only on the next scroll event | `customer-web/src/components/ScrollManager.jsx:9,88,99` | Save the position on every key change too, and keep positions in `sessionStorage`. |
| Small 11 | No `storage` listener; `theme-color` meta only by media query | `customer-web/src/theme/theme.js:33`, `customer-web/index.html:15-16` | Listen to `storage` for `nh-theme`; update the `theme-color` meta in `apply()`. |
| Small 12 | `background_color: #0D090C` | `customer-web/public/manifest.webmanifest:9` | Use `#FFFFFF` (light is the default for most visitors). |
| Small 13 | `COMPANY_MOBILE` default `+919494170180` | `Nadam-backend/src/config/env.js:82` | Change the default to `+917382388565` (and check the live `.env` value). |
| Small 14 | `CodeInput` `LEN = 6`, bag `MAX_LINES/MAX_QUANTITY` hard-coded; `config.signIn`, `config.limits.bag`, `payments.holdMinutes`, `shop.website`, `addressLabels` unused | `customer-web/src/components/CodeInput.jsx:4`, `customer-web/src/bag/store.js:17-18`, `Nadam-backend/src/services/shop/config.service.js:14,18` | Read them from config, or drop the unused fields from the reply. |
| Small 15 | `GET /config`: no limiter; `shopDetails()` uncached (`websiteMaintenance` has a 10 s cache) | `Nadam-backend/src/routes/shop/index.js:29`, `Nadam-backend/src/services/settings.service.js:56-57,92-95` | Reuse the 10 s settings cache for `shopDetails()` (call `forgetCache()` in `setShop`). |
| Small 16 | `.wa-fab` bottom 66 px on ≤900 px vs `.ftr-line` at the page end | `customer-web/src/theme/base.css:288,298` | Add bottom padding to `.ftr-line` on pages that show the button. |

**Other technical notes (not problems for customers today)**
- `GET /config` sends `Cache-Control: public, max-age=60` (`Nadam-backend/src/controllers/shop/public.controller.js:22`) but the client fetches with `cache: 'no-store'` (`customer-web/src/api/client.js:60`). If a shared cache (CDN, nginx `proxy_cache`) is ever added, the website switch would lag by up to a minute; `no-cache` would be safer.
  > **Second check: ✅ Correct.**
- The `MAINTENANCE` branch in `loadConfig` (`customer-web/src/config/config.js:41`) can't happen: `/config` is mounted before `websiteOpen`.
  > **Second check: ✅ Correct.**
- `useMeta` never resets `og:image` or the description when a page without `useMeta` opens (`customer-web/src/utils/useMeta.js:16-24`). No effect on link previews (they read the server's page), only on the in-browser head.
  > **Second check: ✅ Correct.**
- The toast area is `aria-live="polite"` and each toast also has `role="status"`/`"alert"` (`customer-web/src/components/Toasts.jsx:21-23`): some screen readers read it twice.
  > **Second check: ✅ Correct.**
- `requestContext` runs after `express.json` (`Nadam-backend/src/app.js:22-23`), so a malformed-JSON reply has no `X-Request-Id`; harmless (mapped to `BAD_JSON`).
  > **Second check: ✅ Correct.**
- helmet's default HSTS includes `includeSubDomains` on `/api/v2` answers; fine while every `*.nandamhandlooms.com` is HTTPS.
  > **Second check: ✅ Correct.**
- Old numbers remain only in tests (`customer-web/src/pages/orders/MyOrdersPage.test.jsx:14`, `OrderPage.test.jsx:16`, `checkout/CheckoutPage.test.jsx:22`) and in the design note `docs/modules/web-02-home-and-shop.md:28` ("WhatsApp 73829 68566"). Not shown to customers; worth updating so nobody copies them.
  > **Second check: ✅ Correct.**
- The e2e test checks "Visit the store" only from `/shop` (`customer-web/e2e/w2.e2e.cjs:176`) and does not check that the category panel closes after a click (`:166-170`), which is why S4 and S5 were not caught.
  > **Second check: ✅ Correct.**

---

## Second check (26 Oct 2026)

35 findings checked (11 Should, 16 Small, 8 developer notes) against the code. **✅ 29 · ⚠️ 6 · ❌ 0.** The "no Must fix" conclusion is also correct.
- ⚠️ S8, S9, S10, S11: real, but polish or the owner's choice: right group Small (S10 also: `config.js:9` is the call-number fallback, not WhatsApp).
- ⚠️ Small 6: also happens on any first opening of a saree from inside the site, not only a direct link.
- ⚠️ Small 16: the WhatsApp button covers "Terms" on computers (above 900 px), not on phones.

Details and evidence: [checks/03-site-frame-check.md](checks/03-site-frame-check.md).

---

## Third check (26 Oct 2026)

The 6 disputed findings (⚠️ S8, S9, S10, S11, Small 6, Small 16; no ❌) were checked again against the code, CSS and design notes. **Second checker right: 6 · First reviewer right: 0 · Both partly right: 0 · Neither right: 0.**
- S8, S9, S10, S11: real, but polish or the owner's call: final group **Small** (S10: `config.js:9` is the call-number fall-back; S11 is a side effect of the 26 Oct footer decision).
- Small 6: any first opening of a saree misses the underline, not only a direct link: **Small**.
- Small 16: the WhatsApp button covers "Terms" on computers (about 900–1,450 px), not phones; extra: on the home page it also covers most of the theme switch's "Dark" button on computers: **Small**.

Details and evidence: [checks/03-site-frame-third-check.md](checks/03-site-frame-third-check.md).

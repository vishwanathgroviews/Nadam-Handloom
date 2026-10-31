# Second check: Module 3, Site frame

| | |
|---|---|
| **Report checked** | [`../03-site-frame.md`](../03-site-frame.md) |
| **Date** | 26 Oct 2026 |
| **How** | I only read the code (website, server, CSS, tests, design and deployment notes). Nothing was run, built, tested or changed. No `.env` was opened. No live server or database was touched. Browser claims are worked out from the exact CSS/JS and normal browser behaviour; I say how sure I am. |
| **Live facts used** | Everything in this code is live since 26 Oct ~13:55 IST. Razorpay is on TEST keys, open to everyone. Razorpay's notices (webhook) still go to the **old** server (`docs/deployment/live-v2-server.md:102`), so this server learns about a payment the page couldn't confirm only from its own check every minute. |

Short paths: `web/` = `Nadam-frontend/customer-web/`, `backend/` = `Nadam-backend/`.

## Summary

| Id | Finding (one line) | Report's group | Verdict | Right group |
|---|---|---|---|---|
| S1 | Settings asked once; if that fails, online payment and alerts are off for the whole visit | Should | ✅ Correct | Should |
| S2 | Website switch also blocks the payment check right after paying | Should | ✅ Correct | Should |
| S3 | iPhone Home Screen: header slides under the clock bar | Should | ✅ Correct | Should |
| S4 | Category panel stays open after clicking a link in it | Should | ✅ Correct | Should |
| S5 | Phone menu doesn't close when the page chosen is the one already open | Should | ✅ Correct | Should |
| S6 | Moving between lists from the header keeps the old scroll place | Should | ✅ Correct | Should |
| S7 | "Something went wrong" screen: no WhatsApp link, code can't be looked up | Should | ✅ Correct | Should |
| S8 | Offline strip promises "we'll try again", most pages don't | Should | ⚠️ Partly correct | Small |
| S9 | Home footer always says "Secure payment: UPI, cards and net banking" | Should | ⚠️ Partly correct | Small |
| S10 | WhatsApp number typed into code; call number in the admin app | Should | ⚠️ Partly correct | Small |
| S11 | Light / Dark / Auto switch only at the bottom of the home page | Should | ⚠️ Partly correct | Small (owner's choice) |
| Sm1 | Screen readers not told a new page opened | Small | ✅ Correct | Small |
| Sm2 | Offline strip covers the top of the sticky header | Small | ✅ Correct | Small |
| Sm3 | Menu bar doesn't fit at ~900–1,130 px; end items cut off | Small | ✅ Correct | Small |
| Sm4 | No categories in the menus while the catalogue loads / failed | Small | ✅ Correct | Small |
| Sm5 | On home, "All sarees" is announced as the current page | Small | ✅ Correct | Small |
| Sm6 | Saree opened directly doesn't underline its category | Small | ⚠️ Partly correct | Small |
| Sm7 | Signed-in customer sees "Sign in" for a moment | Small | ✅ Correct | Small |
| Sm8 | Normal page flashes before "being updated"; that page never re-checks | Small | ✅ Correct | Small |
| Sm9 | One broken page replaces the whole screen; Back doesn't clear it | Small | ✅ Correct | Small |
| Sm10 | Back loses its place after reload, or after a filter change without scrolling | Small | ✅ Correct | Small |
| Sm11 | Theme choice doesn't reach other tabs; browser bar colour ignores it | Small | ✅ Correct | Small |
| Sm12 | Home Screen opening screen is near-black | Small | ✅ Correct | Small |
| Sm13 | Server's fall-back call number is still 94941 70180 | Small | ✅ Correct | Small |
| Sm14 | Website keeps its own copies of code length and bag limits | Small | ✅ Correct | Small |
| Sm15 | `/config` has no rate limit and reads the database every call | Small | ✅ Correct | Small |
| Sm16 | WhatsApp button may cover the last footer links on phones | Small | ⚠️ Partly correct | Small |
| X1 | (Dev note) `/config` says "cache 60 s" but the website fetches `no-store` | Note | ✅ Correct | Note |
| X2 | (Dev note) `MAINTENANCE` branch in `loadConfig` can't happen | Note | ✅ Correct | Note |
| X3 | (Dev note) `useMeta` never resets description / `og:image` | Note | ✅ Correct | Note |
| X4 | (Dev note) Toasts may be read twice by screen readers | Note | ✅ Correct | Note |
| X5 | (Dev note) Malformed-JSON reply has no `X-Request-Id` | Note | ✅ Correct | Note |
| X6 | (Dev note) helmet HSTS has `includeSubDomains` | Note | ✅ Correct | Note |
| X7 | (Dev note) Old numbers left in tests and one design note | Note | ✅ Correct | Note |
| X8 | (Dev note) e2e test misses S4 and S5 | Note | ✅ Correct | Note |

**Counts: ✅ 29 · ⚠️ 6 · ❌ 0** (11 Should + 16 Small + 8 developer notes = 35 checked).

"Must fix: none found": I agree. Nothing in this module loses money, orders, stock or data, and the customer always has a way out (S2's customer has paid and the order is completed by the server's own check; S3's customer can tap the clock bar to go to the top, where the buttons are reachable again).

The developer table in section 8 repeats S1 to Small 16; its technical notes match the code (one correction under S10).

---

## Should fix

### S1. Settings asked once; failure = no online payment, no alerts for the visit — ✅ Correct (Should)
- `web/src/main.jsx:25` calls `loadConfig()` once. `web/src/config/config.js:35-43`: on any error it sets `status: 'error'` and keeps `FALLBACK`, which has **no `payments`** and `push: null` (`config.js:7-22`). `loadConfig` is not called anywhere else (only `main.jsx:25`), and nothing retries on `online` or tab focus.
- `web/src/pages/checkout/CheckoutPage.jsx:199` waits only while `cfg === 'loading'`; `:113` then gives `paymentsOn = false` (`paymentsOpen` needs `payments.enabled === true`, `web/src/payments/usePaymentsOn.js:8`), so `:218-229` shows "Online payment isn't open yet … Send bag on WhatsApp".
- Alerts: `web/src/push/push.js:13` returns `'not-configured'` when `config.push` is null.
- Timeout is 20 s (`web/src/api/client.js:10`). The report is right; the only "message" the customer sees is the misleading "isn't open yet" one.

### S2. Website switch blocks the payment check — ✅ Correct (Should)
- `backend/src/routes/shop/index.js:33` `r.use(websiteOpen)` comes before the orders router, so `POST /orders/:number/verify` (`:99`) gets 503 `MAINTENANCE` when the switch is on (`backend/src/middlewares/shopGuard.js:45-48`).
- `web/src/api/client.js:82` emits `maintenance` on that answer; `web/src/config/config.js:46` sets `maintenance.on`; `web/src/App.jsx:53` then shows only the "being updated" page. `usePayment.confirm` (`web/src/pages/checkout/usePayment.js:45-62`) still retries 4 times and navigates to `/order/…`, but the App keeps showing the maintenance page.
- Money: the "3–8 minutes" is right for live. The webhook route (`backend/src/app.js:21`) is outside the switch, but on live Razorpay's notices go to the old server (`docs/deployment/live-v2-server.md:102`). The new server's own check runs every 60 s (`backend/src/jobs/payments.job.js:17`, `constants.js:128`) for attempts at least 3 minutes old, re-checked every 5 minutes (`backend/src/models/checkout.model.js:73-76`).
- Group: the scenario is rare (owner switches off during someone's payment), but a customer who has paid and sees "being updated" is badly confused. Should is fair.

### S3. iPhone Home Screen: header under the clock bar — ✅ Correct (Should). Fairly sure (about 80%).
- `web/index.html:24` `apple-mobile-web-app-status-bar-style: black-translucent` (the page is drawn under the status bar in Home Screen mode) and `:5` `viewport-fit=cover`.
- `web/src/theme/base.css:156` `.top-strip` and `:162` `.hdr { position: sticky; top: 0 }` have no `safe-area-inset-top`. A search of the whole website finds `safe-area-inset-top` only in the drawer, modal and lightbox (`shop.css:180,245,247`, `base.css:242`), never the header.
- On phones the header's first row is 60 px (`tokens.css:36`), buttons 44 px centred, so after scrolling they sit about 8–52 px from the top, under a 47–59 px status bar on notch / Dynamic Island iPhones. Tapping the status bar in iOS scrolls to the top. The site does ask iPhone users to add it to the Home Screen (`web/src/pages/account/NotificationsPage.jsx:34-38`, `web/src/pages/home/Alerts.jsx:60`).
- Not a Must: at the very top of the page the 34 px strip pushes the header down, so the buttons can be reached after the tap-to-top.

### S4. Category panel stays open after a click — ✅ Correct (Should)
- `web/src/theme/base.css:202` `.nav li:hover > .mega, .nav li:focus-within > .mega { display: grid }`.
- The header stays mounted across pages (it's in `Layout`) and the `li`/links keep stable keys (`web/src/components/Header.jsx:78-83,123`, `:54` keyed by collection id), so the clicked link keeps focus. Chrome/Edge focus a link on mouse click, and Enter on the keyboard does the same. Nothing moves focus on page change (no `.focus()` in `Layout`/`ScrollManager`).
- No Escape handler in `Header.jsx`. Panel links are tabbable once the panel shows: up to 8 collections + "All N collections" + up to 8 crafts + the photo link = 18.

### S5. Phone menu doesn't close for the page already open — ✅ Correct (Should)
- `web/src/components/SideMenu.jsx:20,23`: closes only when `pathname + search` differs from the value at opening. `/#store` on `/` has the same pathname and search (the hash is ignored); `/` on `/`, `/shop` on `/shop` and `/shop?sort=new` on itself are the same too.
- "Page moves behind it": `ScrollManager.jsx:100` glides to `#store` with `scrollIntoView`. `useDialog` only sets `body` `overflow: hidden` (`web/src/utils/useDialog.js:15`), which stops the user's scrolling but not a scroll started by code.

### S6. Header moves between lists keep the old place — ✅ Correct (Should)
- `web/src/components/ScrollManager.jsx:96-102`: `samePage = prevPath === pathname`; with no hash and not POP, it jumps to the top only when `!samePage`. "All sarees", "New in" and "Sets" are all `/shop…` (`Header.jsx:122,124,125`), and search goes to `/shop?q=` (`SearchBox.jsx:60`), so it never jumps. A logo tap on `/` is the same address: nothing happens.
- No other code scrolls on these moves. The only other `scrollTo` calls are `BagButton.jsx:14` and the checkout step, found by a search of the whole website.

### S7. "Something went wrong" screen — ✅ Correct (Should)
- `web/src/components/ErrorBoundary.jsx:11` code = `Math.random()…`; `:15` only `console.error`; `:25` says "message us on WhatsApp and quote …" with no link or number; `:27-28` only Reload and a home link. The boundary wraps the router (`web/src/main.jsx:31-39`), so the header is gone too.
- Group: crashes are rare and "Go to the home page" leads to WhatsApp. But the code is useless to the shop and crashes are never reported, so Should is fair.

### S8. Offline strip promises auto-retry — ⚠️ Partly correct (right group: Small)
- True: the text is at `web/src/components/Layout.jsx:24`. Only `web/src/bag/store.js:406` and `web/src/utils/lazyPage.js:25` listen for `online`. `web/src/data/resource.js:18-28` has no retry. Config is not reloaded either.
- Overstated harm: every page that fails shows a clear "Try again" button with the error (`HomePage.jsx:99-101`, `ShopList.jsx:111-113`, `CategoryPage.jsx:50`, `CollectionPage.jsx:26`, `CollectionsPage.jsx:39`, `ProductPage.jsx:103-105`). Leaving and reopening a page also retries, because `ensure` reloads any entry that isn't fresh and ready (`resource.js:21`). The customer is never stuck; it's a wording/polish issue. **Small.**

### S9. "Secure payment" promise always shown — ⚠️ Partly correct (right group: Small)
- True: the text is fixed at `web/src/components/Footer.jsx:25`.
- Overstated harm: online payment really is offered today (test keys, open to all), and the test status is shown wherever the customer can pay: `TestPayNote` in the bag panel, the bag page and the checkout (`web/src/payments/TestPayNote.jsx:9-17`, `BagPanel.jsx:55`, `BagPage.jsx:177`, `CheckoutPage.jsx:377`). If payment is switched off, checkout clearly says "Online payment isn't open yet" (`CheckoutPage.jsx:218-229`). It's a generic footer promise, not a wrong charge or a dead end. **Small.**

### S10. WhatsApp number typed into code — ⚠️ Partly correct (right group: Small)
- True: WhatsApp is `backend/src/config/constants.js:190` (`STORE.whatsapp`), the website's fallback `web/src/config/config.js:13`, and the no-JavaScript text `web/index.html:29`. The call number comes from Shop details (`backend/src/services/settings.service.js:61`).
- Wrong detail: `config.js:9` is the **call number** fallback (`shop.mobile`), not WhatsApp. Only the server's `STORE` matters on a normal visit, because `{ ...FALLBACK, ...config }` (`config.js:38`) replaces the whole `store`. The other two are used only if `/config` fails or JavaScript is off.
- Severity: both numbers are 7382388565 today, so customers see no mismatch. It is a maintenance risk for the next number change. **Small.**

### S11. Theme switch only on the home footer — ⚠️ Partly correct (right group: Small, owner's choice)
- True: `ThemeSwitch` appears only in `Footer` (`web/src/components/Footer.jsx:70`). `FooterLine` (`:79-88`) and the side menu (`SideMenu.jsx`) don't have it. `Layout.jsx:35` shows `Footer` only on `/`.
- Context: this follows from the user's own 26 Oct decision, "the lower footer with the shop's details only on the home page" (`docs/modules/web-02-home-and-shop.md:159`). The earlier "visible switch" decision is `web-00-website-plan.md:6`. Auto already follows the device, so nobody is harmed. Whether to add the switch elsewhere is a design question for the owner, not a defect. **Small.**

---

## Small

### Sm1. No page-change announcement — ✅ Correct
`web/src/components/Layout.jsx:27` `main` has `tabIndex={-1}` but nothing focuses it. `ScrollManager.jsx:94-106` only scrolls. A search of the website for `.focus(` finds no page-change focus and no live region for page titles.

### Sm2. Offline strip covers the header — ✅ Correct
`web/src/theme/base.css:257` `.net-banner { position: sticky; top: 0; z-index: 70 }` and `:162` `.hdr { position: sticky; top: 0; z-index: 60 }`. Both are in the same `Layout` wrapper, so after scrolling both stick at 0 and the strip (higher z-index) sits over the header's top. Nothing overrides them in other CSS files.

### Sm3. Menu bar overflow at ~900–1,130 px — ✅ Correct (estimate; fairly sure)
`web/src/theme/base.css:195-196` `overflow-x: auto; scrollbar-width: none` plus a hidden webkit scrollbar. Labels (`web/src/data/categories.js:5-12` plus All sarees, New in, Sets) at .86rem with .9rem side padding (`:199`) add up to about 1,100 px. That matches the report's "about 1,130". A plain mouse wheel doesn't scroll sideways, so the end items can't be reached that way. Keyboard Tab and trackpads can.

### Sm4. No categories while the catalogue loads / failed — ✅ Correct
`web/src/data/categories.js:33` `if (!catalog) return []`. `Header.jsx:74` `useCatalog()` loads once per key (`resource.js:37-41`). Small nuance: opening the phone menu mounts `SideMenu`'s own `useCatalog()` (`SideMenu.jsx:17`), and that does retry a failed catalogue (`resource.js:21`). The header itself never asks again.

### Sm5. "All sarees" is "current page" on home — ✅ Correct
`web/src/components/Header.jsx:21` `if (pathname === '/') return 'all'`; `:80` sets `aria-current="page"` on the `/shop` link.

### Sm6. Saree page doesn't underline its category — ⚠️ Partly correct (Small)
- Right reason: `Header.jsx:31` reads `peek('saree:…')`, which doesn't subscribe. The header's resource snapshot is the catalogue entry only (`resource.js:36`), so a saree arriving doesn't redraw the header.
- Understated scenario: it is not only "opened directly". Any **first** opening of a saree from a list does the same. The saree is fetched only after the page mounts (`web/src/data/shop.js:6`), and nothing pre-loads it (no other `saree:` key in the website). The underline shows only for a saree already in the cache, or by chance if something else (catalogue, sign-in check) redraws the header after the saree arrives.

### Sm7. "Sign in" flashes for a signed-in customer — ✅ Correct
`web/src/auth/session.js:17` starts with `status: 'unknown'`; `Header.jsx:105` shows the account only for `'signedIn'`, else "Sign in".

### Sm8. Maintenance: normal page first; no re-check — ✅ Correct
`web/src/config/config.js:8,24` start with `maintenance.on: false` until `/config` answers. `App.jsx:53` switches only then. `MaintenancePage.jsx:17` has only a manual reload, with no timer or re-check.

### Sm9. One crash replaces everything; Back doesn't clear it — ✅ Correct
`web/src/main.jsx:31-39`: the only `ErrorBoundary` wraps `BrowserRouter`. `ErrorBoundary.jsx:18-19` keeps `error` for good; there is no reset on location (the router is unmounted).

### Sm10. Back loses its place — ✅ Correct
`ScrollManager.jsx:9` `positions` is an in-memory `Map` (empty after reload). `:88` saves only on a scroll event, under the current key. Filter/sort changes are `replace` (`web/src/pages/shop/ShopList.jsx:67,71,76`), and React Router 7 gives each one a new key. With no scroll afterwards, that key has no saved place, so `:99` finds nothing on Back and `:102` jumps to the top.

### Sm11. Theme not shared across tabs; browser bar colour — ✅ Correct
`web/src/theme/theme.js:33` listens only to the device's dark-mode change; there is no `storage` listener. `web/index.html:15-16` `theme-color` metas are chosen by media query only, and `apply()` (`theme.js:18-23`) never updates them.

### Sm12. Near-black opening screen — ✅ Correct
`web/public/manifest.webmanifest:9` `"background_color": "#0D090C"`. Android uses it for the Home Screen splash. The site defaults to Auto, which is light on most phones (`web/public/theme-init.js:6-7`). Certain on Android; iPhones build their launch screen differently.

### Sm13. Old fall-back call number — ✅ Correct
`backend/src/config/env.js:82` `COMPANY_MOBILE … default('+919494170180')`, used by `settings.service.js:61` only when Shop details' mobile is empty. The live `.env` value was not checked (not allowed); the report says so.

### Sm14. Website's own copies of limits — ✅ Correct
`web/src/components/CodeInput.jsx:4` `LEN = 6`; `web/src/bag/store.js:17-18` `MAX_LINES = 20`, `MAX_QUANTITY = 50`. A search of the website finds no use of `config.signIn`, `limits.bag`, `holdMinutes`, `shop.website` or `addressLabels`, outside tests and the fallback itself. The server sends them at `backend/src/services/shop/config.service.js:12,14,16,18,21`.

### Sm15. `/config` unlimited and uncached shop details — ✅ Correct
`backend/src/routes/shop/index.js:29` has no `rateLimit`. `config.service.js:9` calls `shopDetails()`, which reads `Settings.get()` every time (`settings.service.js:56-57`). Only `websiteMaintenance()` uses the 10 s cache (`:92-95`). Low risk, as the report says.

### Sm16. WhatsApp button over the one-line footer — ⚠️ Partly correct (Small)
- The overlap is real, but on **computers**, not phones. Above 900 px the button is `bottom: 20px`, 54 px tall, 18–72 px from the right (`web/src/theme/base.css:295`). The one-line footer is a single row with the links pushed right (`:288-290`, `justify-content: space-between`). "Terms" sits about 18–38 px above the page bottom and ends 16 px from the right edge (window up to 1,360 px). At the very bottom of Shipping, Contact, lists and similar pages, the green button covers "Terms", partly up to about 1,450 px wide.
- On phones (≤900 px) the button is lifted to `bottom: 66px` (`:298`). With `.8rem` text and line-height 1.55 (`:14`), the footer's link rows end about 62 px above the bottom, so the button sits just above them. Right-hand links are not covered at normal text size; only a very large font setting could make them meet.
- The suggested fix (bottom padding on `.ftr-line` when the button shows) still works.

---

## Developer notes (section 8, "Other technical notes")

### X1. Cache header vs `no-store` — ✅ Correct
`backend/src/controllers/shop/public.controller.js:22` sets `public, max-age=60`, overriding the `no-store` from `shopGuard.js:32`. The website fetches with `cache: 'no-store'` (`web/src/api/client.js:60`).

### X2. `MAINTENANCE` branch in `loadConfig` can't happen — ✅ Correct
`backend/src/routes/shop/index.js:29` mounts `/config` before `:33` `websiteOpen`, so `/config` never answers `MAINTENANCE`. The branch is `web/src/config/config.js:41`.

### X3. `useMeta` never resets — ✅ Correct
`web/src/utils/useMeta.js:16-24` has no cleanup. Many pages don't call `useMeta` (bag, checkout, account, info pages), so they keep the previous page's description and `og:image`. Link previews come from the server's page, so they are not affected.

### X4. Toasts read twice — ✅ Correct
`web/src/components/Toasts.jsx` puts an `aria-live="polite"` container around toasts that each have `role="status"`/`"alert"`. Some screen readers announce both. "Some" is the right hedge.

### X5. No `X-Request-Id` on a malformed-JSON reply — ✅ Correct
`backend/src/app.js:22-23` `express.json` runs before `requestContext`, which is what sets `X-Request-Id` (`requestContext.js:11-12`). A parse error skips straight to `errorHandler.js:17` (`BAD_JSON`).

### X6. HSTS `includeSubDomains` — ✅ Correct
`backend/src/app.js:18` `helmet()` with defaults (`helmet ^8.3.0`, `package.json:29`). Its default HSTS includes `includeSubDomains`.

### X7. Old numbers in tests and a design note — ✅ Correct
`MyOrdersPage.test.jsx:14` and `OrderPage.test.jsx:16` have `917382968566`. `CheckoutPage.test.jsx:22` has `917382968566` and `9494170180`. `docs/modules/web-02-home-and-shop.md:28` says "WhatsApp 73829 68566".

### X8. e2e misses S4 and S5 — ✅ Correct
`web/e2e/w2.e2e.cjs:145` goes to `/shop`. `:176-178` taps "Visit the store" from there, a different page, so the menu closes. `:166-169` click a panel link and move the mouse away, but never check that the panel is hidden.

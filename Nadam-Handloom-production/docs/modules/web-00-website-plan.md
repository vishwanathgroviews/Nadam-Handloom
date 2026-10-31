# Website plan (W0): the customer website, from scratch

Started 2026-10-15, after the admin app went to everyone. Same method as the admin app: each module is planned, mocked up, chosen by the owner, built (server, tests, website), tested, then recorded here. **Status: folders made; nothing planned or built yet.**

## Step 0: the look (2026-10-15, owner's request)
Before planning modules, the owner asked for a clickable mock-up of the whole website in three premium designs, with the live data, because the client didn't like the old site. Mock-up: [`design/ui-mockup/web-0-design/`](../design/ui-mockup/web-0-design/index.html) (start page, website `site.html`, design kit, device preview). Three looks: **A Heritage** (ivory, maroon, zari gold), **B Atelier** (modern white, peacock), **C Utsav** (festive night and gold), plus options for theme, colours, fonts, corners, top menu, home banner, saree card, saree page and motion. 29 screens; live catalogue of 15 Oct (1,407 pieces, 61 collections, 355 photos copied in by `build/build-data.py`). **Owner's picks (15 Oct 2026):** Design **C Utsav**; colours C (kumkum and festive gold); fonts C (Bodoni Moda + Figtree); crisp corners; top menu C (minimal menu icon, full-screen menu); home opening C (full-screen cinematic, words centred); saree page **B** (large photos, details stay in view); motion full. Theme: visitors get **Dark, Light and Auto** (Auto follows the device; a visible switch on the site). Saree card: **A** (framed on a soft mat; the photos are white-background flat-lays).

## Ground rules (same as the admin app)
- One server and one database: the website uses the new server (`Nadam-backend`, `/api/v2`); its endpoints go under `/api/v2/shop/…`. Database changes stay additive.
- The old website keeps running at nandamhandlooms.com until the owner says to switch. The new one is tried on a test address first.
- Features stay the same as today unless the owner agrees a change, module by module.
- Every mock-up follows the owner's mock-up checklist; nothing is built before the owner's picks.
- Live actions (deploys, switching the address, payments) need the owner's go each time.

## Where things go

| What | Where |
|---|---|
| Website code | `Nadam-frontend/customer-web/` (see its README for the folders) |
| Website endpoints | `Nadam-backend/src/routes/shop.routes.js`, `controllers/shop.controller.js`, `services/shop.service.js`, `validators/shop.validators.js` (added when building) |
| Snapshot of the old website | `docs/current-system/customer-website.md` (step 1) |
| One decision record per module | `docs/modules/web-01-….md` … |
| One clickable mock-up per module | `docs/design/ui-mockup/web-1-…/` … |
| Deploy and test notes | `docs/deployment/`, `docs/testing/` |
| Handover | a website part in `Nandham-scratch-KT.md` |

## Modules (draft, to confirm in step 1)
Taken from the old website's pages (`frontend/customer-web/src/App.jsx`).

| # | Module | Old pages it replaces | Status |
|---|---|---|---|
| W1 | Customer sign-in and account (first, owner's order) | Old sign-in pages and `/account`; plan: [web-01-sign-in.md](web-01-sign-in.md) | **Live 2026-10-16** on nandamhandlooms.com (old site kept aside) |
| W2 | Site frame and Home | Layout, header/footer, Home (hero, categories), store location, maintenance message; plan: [web-02-home-and-shop.md](web-02-home-and-shop.md) | **Live 2026-10-16** (11:40 IST) |
| W3 | Shop: categories and listings | `/shop`, `/category/:slug`, `/category/:slug/:subcategoryId`: lists, filters, search; with W2 | **Live 2026-10-16** (11:40 IST) |
| W4 | Product page | `/product/:slug`: photos, price, stock (including sets), add to cart | **Lean version live 2026-10-16** with W2 (order on WhatsApp; no MRP, decision 3.4); "Add to bag" comes with W5 |
| W5 | Cart (the bag) | `/bag` (old `/cart` sends there); plan: [web-03-cart.md](web-03-cart.md) | **Live 2026-10-16** (about 23:45 IST; owner: every recommendation; mock-up [`web-5-bag/`](../design/ui-mockup/web-5-bag/index.html)) |
| W6 | Checkout and payment | `/checkout` (address, Razorpay, 15-minute hold), `/order/:orderNumber`, policy pages; plan: [web-04-checkout.md](web-04-checkout.md) | **Built and tested 17 Oct 2026, local only.** All A. Browser tests on Chrome and Safari: 147/147. Razorpay's real test window: card success and refused, also with the live security settings. Owners' Online payments and Android notifications tested on a real phone. Not live: the owner's policy texts, then go-live on the user's go ([section 18](web-04-checkout.md#18-going-live-only-on-the-owners-go)) |
| W7 | My orders | `/account/orders`, `/order/:number` | **Built and tested 17 Oct, local only** (all A; [`web-05-my-orders.md`](web-05-my-orders.md)). Cancelling parked to discuss. Live with W6 on the user's go. Checked on the Android phone too (80/80) |
| W8 | Go-live | Speed, search-engine basics, old links still working, switching nandamhandlooms.com to the new site | Not started |

## Steps
1. Write `docs/current-system/customer-website.md`: what the old website does, its rules, its problems.
2. Confirm the modules and the stack with the owner (recommendation: React + Vite, plain files served by nginx).
3. Module by module: plan → mock-up → owner's picks → server endpoints + tests → website pages + tests → check in a real browser and on a phone → record here.
4. Try the whole site on a test address with the live data; then the switch-over (W8) on the owner's go.

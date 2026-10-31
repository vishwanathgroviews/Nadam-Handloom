# Second check: Module 6, the saree page and the link preview

Date: 26 Oct 2026. Report checked: [`../06-saree-page.md`](../06-saree-page.md).
I only read code (server, website, schema, tests, deployment notes, and React's and React Router's own code in `node_modules`). I did not run, build or change anything, and I did not open `.env`.
All `path:line` references start from the project folder (`Nadam-Handloom-production/`). `web/` means `Nadam-frontend/customer-web/`, `api/` means `Nadam-backend/`.

Live facts used: everything in this code has been live on nandamhandlooms.com since 26 Oct, about 13:55 IST. Online payment uses Razorpay TEST keys and is open to every visitor (`docs/deployment/live-v2-server.md:96`). Live nginx sends `/product/<slug>` to `/api/v2/shop/pages/product/<slug>`. If that page errors, nginx serves the plain index.html (`docs/deployment/live-v2-server.md:101`: "falls back to index.html").

## Summary

| Finding | One-line title | Original group | Verdict | Right group |
|---|---|---|---|---|
| M1 | Saree added while the sign-in is still being checked vanishes from the bag | Must | ⚠️ Partly correct | Should |
| S1 | A card fades away and stays invisible after its "Add to bag" | Should | ✅ Correct | Should |
| S2 | Page still says the bag doesn't hold and to order by WhatsApp; Checkout is live | Should | ✅ Correct | Should |
| S3 | A saree held in someone's checkout shows "Sold out" for 15–30 min | Should | ✅ Correct | Should |
| S4 | After "This saree has just sold out" the page still shows it in stock | Should | ✅ Correct | Should |
| S5 | "Recently viewed" shows old price/stock and offers Add for gone sarees | Should | ✅ Correct | Should |
| Sm1 | Missing saree's tab says "Saree", not "Page not found" | Small | ✅ Correct | Small |
| Sm2 | Not-found text says "It may have sold out" | Small | ✅ Correct | Small |
| Sm3 | "Too many requests" / "server busy" shown as "check your connection" | Small | ✅ Correct | Small |
| Sm4 | More than 50 in stock: stepper goes past the bag's 50 | Small | ✅ Correct | Small |
| Sm5 | "All 2 pieces are in your bag" while the bag shows 3 | Small | ✅ Correct | Small |
| Sm6 | WhatsApp order text doesn't say how many pieces | Small | ✅ Correct | Small |
| Sm7 | Broken photo not handled in full screen and phone bar | Small | ✅ Correct | Small |
| Sm8 | Repeated photo address / highlight line gives duplicate React keys | Small | ✅ Correct | Small |
| Sm9 | "Hover to zoom" hint on a sideways iPad | Small | ✅ Correct | Small |
| Sm10 | Summary failing breaks the whole saree page | Small | ✅ Correct | Small |
| Sm11 | `$'`, `` $` ``, `$&` in a name copy page parts into the preview head | Small | ✅ Correct | Small |
| Sm12 | Preview route answers error text, not the page (nginx unknown) | Small | ❌ Wrong | None for customers (optional hardening) |
| Sm13 | Broken `%` code gives "Something went wrong" (500) | Small | ⚠️ Partly correct | Small |
| Sm14 | "Recently viewed" survives sign-out | Small | ✅ Correct | Small |
| Sm15 | Offline Add says "What you typed is kept." | Small | ✅ Correct | Small |
| Sm16 | Gone saree answers 200 with no noindex | Small | ✅ Correct | Small |
| Sm17 | Capital letters in a saree link give "not found" | Small | ✅ Correct | Small |
| Sm18 | No guard against a negative old stock count | Small | ⚠️ Partly correct | Small (hypothetical) |
| X1 | (Dev note) `product()` does two queries where one would do | Note | ✅ Correct | Note |
| X2 | (Dev note) `findBySlug` selects every in-stock piece row, never used | Note | ✅ Correct | Note |
| X3 | (Dev note) `Cache-Control: public, max-age=60` has no effect for the website | Note | ✅ Correct | Note |
| X4 | (Dev note) `og:image` keeps the last saree's photo on later pages | Note | ✅ Correct | Note |

**Counts: ✅ 24 · ⚠️ 3 · ❌ 1** (28 findings: 1 Must, 5 Should, 18 Small, 4 developer notes).

---

## M1. A saree added while the sign-in is still being checked vanishes from the bag

**Verdict: ⚠️ Partly correct. The problem is real and the cause is right, but it belongs under Should fix, not Must fix.**

Why: a returning customer's browser starts with the bag marked as the account's (`owner: 'account'`, read from storage), while the sign-in is still "unknown". `add()` only sends the saree to the account when the person is signed in *now*, so it saves the saree in this browser only. The bag check then does nothing, because it is "waiting for the sign-in". When the sign-in check succeeds, `joinAccount()` only merges a *visitor's* bag. This bag is marked as the account's, so it sends nothing, fetches the account's bag and replaces the local list with it. The new saree is gone, and the customer gets no message. I am sure of this flow: it is plain store code, with no React timing involved.

Evidence:
- `web/src/main.jsx:26-27`: `bootstrap(); startBag();`. The product route is not behind `RequireAuth` (`web/src/App.jsx:66`), so the page works while the sign-in is "unknown".
- `web/src/auth/session.js:17`: the start state is `status: 'unknown'`. In `session.js:103-111`, three tries (0, 1 s, 3 s) are made. On a network or server failure, only `bootError` is set, and the status **stays "unknown"**.
- `web/src/bag/store.js:182-183`: `isAccount = state.owner === 'account' && signedIn()`. Then `store.js:241-248`: if not `isAccount()`, the saree goes into local `items`, then `refresh()`.
- `store.js:203`: `if (state.owner === 'account' && !signedIn()) return Promise.resolve();`, so the bag is not checked.
- `store.js:329-332`: `const guest = state.owner === 'guest' ? state.items : [];`. Here that is `[]`, so `shopApi.bag()` runs, and `applyAccount` (`store.js:172-178`) replaces `items` with the server's list.

Why Should fix, not Must:
- The window is narrow. The sign-in check is sent before the page is even drawn (`main.jsx:26`), while the saree page still needs its code chunk and its API call. So normally the check finishes first. The loss needs a slow or failed sign-in check (a 20 s timeout, server trouble, or a 429 on `/auth/refresh`).
- What is lost is one bag line. No money, order or stock is wrong. The customer sees their bag on the Checkout page before paying and can add the saree again.

Small correction to the scenario: "later when they open Checkout" is not quite right. With the sign-in still "unknown", Checkout just shows the loading dot (`web/src/pages/checkout/CheckoutPage.jsx:199`). The loss happens on the next successful sign-in check: a page reload, "Try again" on an account page (`RequireAuth.jsx:20`), another tab signing in, or any call that needs the sign-in (`api/client.js:89`). (If that later check finds the sign-in has expired, `forgetAccount()` at `store.js:352-358` clears the bag with a "signed out" note instead.)

## S1. A saree card fades away and stays invisible after its "Add to bag"

**Verdict: ✅ Correct.** I am very sure about the cause (I read React's own code). I did not see it on screen.

Why: `useReveal` adds the class `in` by hand (`classList.add('in')`) and then stops watching the card. The card's `className` is set by React from props. When `inBag` changes, the class string changes from `"pcard reveal"` to `"pcard reveal added"`. React then writes the whole `class` attribute again, and the hand-added `in` is lost. The CSS rule `.js-motion .reveal:not(.in) { opacity: 0 }` makes the card fade to transparent. Nothing watches it any more, and the hook only runs again when the saree changes, so the card stays invisible.

Evidence:
- `web/src/components/SareeCard.jsx:17` (`inBag` from the bag store) and `:36`: ``className={`pcard reveal${sold ? ' soldout' : ''}${inBag ? ' added' : ''}`}``.
- `web/src/utils/motion.js:35`: `e.target.classList.add('in'); io.unobserve(e.target);`.
- `web/src/theme/shop.css:18-19`: a transition on opacity, and `.js-motion .reveal:not(.in) { opacity: 0; transform: translateY(26px); }`.
- `web/src/pages/product/ProductPage.jsx:85`: `useReveal(box, [p?.slug])`, which does not run again on bag changes. Lists use `web/src/pages/shop/ShopList.jsx:65` with `[listKey, items.length, loadingFirst]`, which also does not change on Add.
- React 19.3.1 (`web/node_modules/react-dom/cjs/react-dom-client.development.js:21636-21637`): `case "className": setValueForKnownAttribute(domElement, "class", value)`. That function (`:1686-1698`) calls `node.setAttribute(name, value)`, which replaces the whole attribute. React only does this when the prop value changed.
- Tests: `web/e2e/w2.e2e.cjs:316` checks the card after Add with `seen()`, which is `waitFor({ state: 'visible' })`. Playwright counts an `opacity: 0` element as visible. The opacity check `shown()` (`:78-80`) is only used after filter and sort changes (`:271, :274, :292, :333`).

Small note: "when its stock changes after a background refresh" only applies when the card flips between in stock and sold out (the `soldout` class). A set going from 3 to 2 does not change the class. Visitors with "reduce motion" on are not affected (`shop.css:28`, `.no-motion .reveal { opacity: 1 !important }`).

## S2. The page still says the bag doesn't hold the saree and to order on WhatsApp

**Verdict: ✅ Correct.**

Why: payments are on for everyone on the live site. The bag panel and the bag page now lead with **Checkout**, and "Send bag on WhatsApp" only appears when payments are off. The saree page never checks whether payments are on. It always says to send the bag on WhatsApp, and it names a button ("Send bag on WhatsApp") that the bag no longer shows.

Evidence:
- `web/src/pages/product/ProductPage.jsx:223`: "The bag doesn't hold the saree: our store sells it too. Send your bag on WhatsApp and we confirm it is still here."
- `ProductPage.jsx:241-244`: "Tap **Send bag on WhatsApp**…", "We confirm they are available and share the payment details."
- There is no `usePaymentsOn` import in `ProductPage.jsx` (imports at lines 3-25).
- `web/src/components/BagPanel.jsx:54, 60-66`: with payments on, the panel shows Checkout plus a small "Order on WhatsApp instead". The "Send bag on WhatsApp" button appears only when payments are off.
- `web/src/pages/bag/BagPage.jsx:171-191`: the same. When payments are on, its note says "Sarees are held for you for 15 minutes once you press Pay".
- `web/src/payments/usePaymentsOn.js:7-10`; live has `PAYMENTS_TEST_FOR_EVERYONE=true` (`docs/deployment/live-v2-server.md:96`).

## S3. A saree only held in someone's checkout shows "Sold out" for 15–30 minutes

**Verdict: ✅ Correct.**

Why: Pay marks the saree's tagged piece "reserved", or lowers the old stock count. Stock on the website is only "old count + pieces in stock", so a held single piece counts as 0. The saree leaves every list. Its page still opens, because the page skips the stock check, and it shows "Sold out" with the "this saree is sold out" WhatsApp text. The preview adds "· Sold out", and the data for Google says `OutOfStock`. The hold lasts 15 minutes, and up to 30 minutes if the person presses Pay again.

Evidence:
- The hold: `api/src/services/shop/checkout.service.js:179` (`data: { status: 'reserved' }`) and `:185` (`stock: { decrement: rest }`).
- The count: `api/src/services/shop/catalog.service.js:49` is `available = p.stock + (p._count?.pieces ?? 0)`, with `_count` counting `in_stock` pieces only (`api/src/models/shopCatalog.model.js:10`).
- `catalog.service.js:324` is `soldOut: card.available < 1`. Lists use `visibility.js:17` (`OR: [{ stock: { gt: 0 } }, { pieces: { some: { status: 'in_stock' } } }]`).
- `api/src/services/shop/page.service.js:49` adds `' · Sold out'` to the preview.
- Website: `ProductPage.jsx:62` ("Sold out") and `:114-115` (the WhatsApp "sold out" text). The data for Google is at `:163`.
- Hold times: `api/src/config/constants.js:123-124` (15, max 30).

Note: taking held sarees off the website was planned (`docs/modules/web-04-checkout.md:89`, "back in stock (and back on the website)"). The real problem is the wording: a held saree is told to customers, and to the shop on WhatsApp, as "sold out". With test payments open to everyone, any visitor who presses Pay and stops causes it. Should fix is right.

## S4. After "This saree has just sold out", the page still shows it in stock

**Verdict: ✅ Correct.**

Why: for a signed-in customer, the server refuses with `SOLD_OUT` or `NOT_ON_WEBSITE`. The page only shows a message and never calls `reload()`, so the stock line and the Add button stay. For a visitor, the saree goes into the browser's bag, and the bag check marks it sold out in the panel. The page keeps "Only one piece…" (its button turns into "In your bag · View"). For a set whose stock dropped, the page works out the room left from its own old `p.available`, so it still offers "Add one more".

Evidence:
- `ProductPage.jsx:135-136`: the `catch` only does `toast(err.message…)`, with no `reload()`.
- `ProductPage.jsx:123-126`: `room = Math.max(0, p.available - inBag)` uses the page's own stock.
- The page data is only fetched again on a forced reload or after 60 s on a new visit (`web/src/data/resource.js:18-21`).
- Server: `api/src/services/shop/bag.service.js:124, :127` (`throw notOnWebsite()` / `throw soldOut(slug)`).

## S5. "Recently viewed" shows old prices and stock, and offers Add for gone sarees

**Verdict: ✅ Correct.**

Why: the card is saved as it was when the customer viewed it, and it is never refreshed. Only the limit of 12 removes old cards. `SareeCard` uses the saved `price` and `available` for the price, the "Set of N" badge and the Add button.

Evidence:
- `web/src/data/recent.js:14-19`: saves `price` and `available` as they were. `readRecent` (`:5-12`) only drops entries without a slug or photo.
- `ProductPage.jsx:81, :269`: the list is shown as saved.
- `SareeCard.jsx:19-27`: `sold = card.available < 1`, and Add uses `card.available`.

Small detail: "Tapping Add puts a sold saree in the bag" is exactly true for a **visitor**: the saree goes into the browser bag, and the check marks it sold out in the panel. For a **signed-in** customer, the server refuses with "This saree has just sold out." (`bag.service.js:127`). Tapping the card opens "This saree isn't on the website now" only for sarees that left the website. A sold-out one opens with "Sold out".

## Small 1. A missing saree's tab says "Saree · Nandam Handlooms"

**Verdict: ✅ Correct.**

Why: both components set the title in an effect. In one commit, React runs a child's effects before its parent's. `NotFoundPage` (the child) sets "Page not found", then `ProductPage` (the parent) sets "Saree", so "Saree" wins.

Evidence: `ProductPage.jsx:83` is `useTitle(p ? p.name : status === 'error' ? 'Saree' : 'Loading')`, and the hook runs before the early return at `:95-97`. `web/src/pages/info/NotFoundPage.jsx:7` is `useTitle('Page not found')`. `web/src/utils/useTitle.js:5-7` uses an effect.

## Small 2. "It may have sold out" on the not-found page

**Verdict: ✅ Correct.**

Evidence: `ProductPage.jsx:97`. The server finds the saree with `listedWhere()`, which leaves out the stock check (`api/src/services/shop/visibility.js:21-25`, `catalog.service.js:305`). So a sold-out saree opens with "Sold out" and never reaches this page.

## Small 3. "Too many requests" / "server busy" shown as a connection problem

**Verdict: ✅ Correct.**

Evidence: `ProductPage.jsx:95-108`. Every error other than 404, `PRODUCT_NOT_FOUND` or `VALIDATION_FAILED` shows "Please check your connection and try again." `RATE_LIMITED` comes from `api/src/middlewares/rateLimit.js:26`, and `SERVER_BUSY` from `web/src/api/errors.js:40-41`.

## Small 4. More than 50 in stock: the − / + goes past the bag's limit of 50

**Verdict: ✅ Correct.**

Evidence: `ProductPage.jsx:125` (`room = p.available - inBag`, with no cap of 50), `:203` (`max={room}`), and `:128` (`allIn` only when `room < 1`). `web/src/bag/store.js:236` caps at `MAX_QUANTITY` (50). With 60 in stock and 50 in the bag, the page says "up to 10 more" and "Add one more", and nothing changes.

## Small 5. "All 2 pieces are in your bag" while the bag shows 3

**Verdict: ✅ Correct.**

Evidence: `ProductPage.jsx:213` prints `p.available`, not `inBag`. With `inBag = 3` and `p.available = 2`, `room = 0`, so `allIn` is true (`:125, :128`). The bag only lowers the number at its next check (`store.js:164`, `bag.service.js:108`).

## Small 6. "Order on WhatsApp" doesn't say how many pieces

**Verdict: ✅ Correct.**

Evidence: `ProductPage.jsx:116` has the name, code, price and link, but no `pieces`.

## Small 7. A broken photo is not handled in full screen or in the phone bar

**Verdict: ✅ Correct.**

Evidence: the full-screen `<img>` at `web/src/pages/product/Gallery.jsx:33` and the phone bar `<img>` at `ProductPage.jsx:273` have no `onError`. The main view has one (`Gallery.jsx:66-67`). In full screen the alt text is not empty, so the browser shows its broken-picture icon with the alt text. The phone bar has `alt=""` and a fixed size (`web/src/theme/shop.css:232`, 44×58), so what shows depends on the browser (an empty box or the icon). Either way there is no fallback. Small is right.

## Small 8. Repeated photo addresses or highlight lines give duplicate React keys

**Verdict: ✅ Correct.**

Evidence: `Gallery.jsx:79` is `key={p.url}`, and `ProductPage.jsx:227` is `key={h}`. `catalog.service.js:30` does not remove repeated lines. `ProductImage.url` is not unique (`api/prisma/schema.prisma:489-499`). React warns about this. On first render both items show. On a later update, for example opening another saree in the same page, React may drop or repeat one. The wording "may not show or update properly" is fair.

## Small 9. "Hover to zoom" on touch tablets wider than 900 px

**Verdict: ✅ Correct.**

Evidence: `Gallery.jsx:69` draws the hint for the first photo every time. Zoom itself checks `canHover()` (`:8, :60`), but the hint does not. CSS only hides it at 900 px or less (`shop.css:236-241`). A sideways iPad is about 1180 px wide.

## Small 10. If the catalogue summary fails, the whole saree page fails

**Verdict: ✅ Correct.**

Evidence: `catalog.service.js:310-319`. `summary()` (`:314`) runs inside `Promise.all`, so a failure rejects all of `product()`. `summary()` (`:158-163`) throws when its rebuild fails and does not fall back to an older copy. This only happens for sarees that have a craft (`:309`).

## Small 11. `$'`, `` $` `` or `$&` in a name copies page parts into the preview head

**Verdict: ✅ Correct.**

Evidence: `api/src/services/shop/page.service.js:57`. `out.replace(/<title>…/, lines)` and `out.replace('</head>', …)` treat `lines` as a replacement pattern. `esc()` (`:16`) does not escape `$`. It even makes things worse: `'` becomes `&#39;` and `&` becomes `&amp;`, so `$'` and `$&` both end up as `$&…`, which inserts the matched `<title>`. A backtick is not escaped at all, so `` $` `` inserts everything before the match. Names come from staff only, so this is very unlikely. Small is right.

## Small 12. The preview route answers with error text, not the page

**Verdict: ❌ Wrong (for the live site). The code reading is accurate, but the problem does not reach customers.**

Why: the report left this open ("Not sure… nginx's settings are not in the code"). The live nginx `/product/` location **falls back to index.html** whenever this route errors (`docs/deployment/live-v2-server.md:101`: "the `/product/` preview location (the server's own security headers swapped for the website's; falls back to index.html)"). The code expects this too: `api/src/controllers/shop/page.controller.js:1-2` ("serves the plain page itself if this ever fails"). So on a 429, 500 or 400 the visitor still gets the website, and WhatsApp gets the general preview, the same as for a missing saree. Making the server send the plain page itself is optional extra safety, not a customer problem.

Code (correct as read): `page.service.js:60-63`, `api/src/routes/shop/index.js:32`, and `api/src/middlewares/errorHandler.js:27` (a JSON error).

## Small 13. A broken `%` code gives "Something went wrong" (500)

**Verdict: ⚠️ Partly correct. The server part is right, but the customer never sees "Something went wrong".**

What is right: Express 5's router marks a bad `%` code as a 400 (`api/node_modules/router/lib/layer.js:219-233`, `err.status = 400`). `errorHandler` turns every non-`AppError` into `500 INTERNAL` and logs it as an error (`api/src/middlewares/errorHandler.js:20-24`). So `/api/v2/shop/pages/product/abc%E0%A4` and `/api/v2/shop/products/abc%E0%A4` answer 500, and the server log fills with false errors.

What is wrong: for `/product/abc%E0%A4`, nginx serves the plain page when the preview route fails (see Small 12). React Router cannot decode the path, so it keeps the raw text `abc%E0%A4` (`web/node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs:847-856`). The website then encodes it before calling the server (`web/src/api/shop.js:11`, `enc(slug)`), so the server gets the literal text. The slug rule refuses it with `400 VALIDATION_FAILED` (`api/src/validators/shop/catalog.validators.js:25`), and the page shows "This saree isn't on the website now" (`ProductPage.jsx:96-97`). That is the correct result. Small is right (log noise and a wrong status code).

## Small 14. "Recently viewed" stays after signing out

**Verdict: ✅ Correct.**

Evidence: `web/src/data/recent.js` has no clear function. The sign-out path `store.js:352-358` (`forgetAccount`) and `web/src/auth/session.js:53-58` (`end`) never touch `nh-recent`. The bag page also shows it (`web/src/pages/bag/BagPage.jsx:61-63`).

## Small 15. Offline Add (signed in) says "What you typed is kept."

**Verdict: ✅ Correct.**

Evidence: `web/src/api/errors.js:35` is the shared `offlineError` text. `web/src/api/client.js:48` throws it when the browser is offline. `ProductPage.jsx:136` shows `err.message`.

## Small 16. A saree that left the website answers 200 with no noindex

**Verdict: ✅ Correct.**

Evidence: `page.service.js:63` returns the plain `html` (200) when `previewOf` is null. `NotFoundPage.jsx` sets only a title, and no file in `web/src` adds `robots`. Google sees a soft-404 page. (The same is true of every unknown address on this website, since nginx serves index.html, so this is a site-wide trait.)

## Small 17. A link with capital letters is "not found"

**Verdict: ✅ Correct.**

Evidence: `catalog.validators.js:25` allows `A-Z`, and `findBySlug` looks for an exact match (`api/src/models/shopCatalog.model.js:47-49`). Slugs are always made in lower case, both on this server (`api/src/models/product.model.js:132-133`, `slugify` → `toLowerCase()`) and on the old server (`../backend/src/utils/slug.ts`). So the suggested `.toLowerCase()` fix is safe.

## Small 18. No guard against a negative old stock count

**Verdict: ⚠️ Partly correct. The missing guard is real, but the case looks impossible today, and the effect described is a little off.**

What is right: `catalog.service.js:49` adds `p.stock` without `Math.max(0, …)`, and the schema has no CHECK on `stock` (`schema.prisma:362`; the only CHECKs in the migrations are on `BagItem`).

What is off:
- Every code path that lowers `stock` guards it with `stock: { gte: n }`: this server (`checkout.service.js:185, 484, 497`) and the old server (`../backend/src/modules/inventory/inventory.service.ts:115-117, 509-511`).
- The admin app's product validators have no `stock` field. So a negative count could only come from old data or a manual database edit.
- If it ever happened, the saree would still be in lists (`visibility.js:17`, a piece in stock). But its card would **also** say "Sold out" (`SareeCard.jsx:19`, `available < 1`), not only its page.

Small, and still marked "not sure", is right. The suggested guard is cheap.

## X1 (developer note). `product()` does a lookup plus a second count query

**Verdict: ✅ Correct** (speed only, not a bug). `catalog.service.js:303-305`: `findBySlug` then `Q.count({ AND: [listedWhere(), { id: p.id }] })`. `page.service.js:36-37` does the same. A single `findFirst` with both conditions would do.

## X2 (developer note). `findBySlug` selects every in-stock piece row, never used

**Verdict: ✅ Correct.** `api/src/models/shopCatalog.model.js:57` has `pieces: { where: { status: 'in_stock' }, select: { status: true } }`. Its only callers are `catalog.service.js:303` and `page.service.js:36`. Both use `presentCard`, which reads `_count.pieces` (`catalog.service.js:49`). No code reads `p.pieces`.

## X3 (developer note). `public, max-age=60` has no effect for the website

**Verdict: ✅ Correct.** `api/src/controllers/shop/catalog.controller.js:8` sets it, but every website call uses `cache: 'no-store'` (`web/src/api/client.js:60`), which skips the browser's HTTP cache. The website's own 60-second copy is in `web/src/data/resource.js:5, 21`.

## X4 (developer note). `og:image` keeps the last saree's photo on later pages

**Verdict: ✅ Correct, with no customer effect.** `web/src/utils/useMeta.js:23` only sets `og:image` when `image` is given and never resets it. Link previews come from the server (`page.service.js`), and crawlers that make previews don't run the website's code.

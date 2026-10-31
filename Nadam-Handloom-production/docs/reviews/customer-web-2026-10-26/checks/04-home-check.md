# Second check: Module 4, Home page

| | |
|---|---|
| **Report checked** | [`../04-home.md`](../04-home.md) |
| **Date** | 26 Oct 2026 |
| **How** | I only read the code (website, server, CSS, validators, design notes). Nothing was run, built, tested or changed. No `.env` was opened. No live server or database was touched. Browser claims are worked out from the exact CSS/JS and normal browser behaviour; I say how sure I am. |
| **Live facts used** | Everything in this code is live since 26 Oct ~13:55 IST, including this home page (1,813 sarees, 6 categories with 2 "Coming soon", "362 new sarees"). The report's line 3 ("not live yet") and section 3.4 ("the live website still uses `/home`") are now out of date, so every Should fix below affects real customers today. |

Short paths: `web/` = `Nadam-frontend/customer-web/`, `backend/` = `Nadam-backend/`.

## Summary

| Id | Finding (one line) | Report's group | Verdict | Right group |
|---|---|---|---|---|
| S1 | "Latest collections" arrows stay greyed out after the first load | Should | ✅ Correct | Should |
| S2 | About 4 craft circles cut off on a computer; mouse users can't reach them | Should | ✅ Correct | Should |
| S3 | If only the catalogue call fails, every saree is hidden too | Should | ⚠️ Partly correct | Small |
| S4 | Coming back after a minute can leave a new card or tile invisible | Should | ✅ Correct | Should |
| S5 | "N new sarees →" opens the full list, not the N new ones | Should | ✅ Correct | Should |
| S6 | Trial collections ("Test1") hidden from "Coming soon" names only | Should | ✅ Correct | Should |
| S7 | "New" only looks at when the saree was first entered | Should | ✅ Correct | Should |
| S8 | Any active category with nothing online shows "Coming soon"; no way to hide it | Should | ✅ Correct | Should |
| Sm1 | Collection tile says "N pieces" but N is designs | Small | ✅ Correct | Small |
| Sm2 | Error boxes always say "check your connection" | Small | ✅ Correct | Small |
| Sm3 | Grey circles keep pulsing above the error box | Small | ✅ Correct | Small |
| Sm4 | Empty shop says "No sarees match these filters"; empty Latest row | Small | ✅ Correct | Small |
| Sm5 | Numbers can disagree for a minute; an open tab never refreshes | Small | ✅ Correct | Small |
| Sm6 | Broken shop photo shows the browser's broken-picture mark | Small | ✅ Correct | Small |
| Sm7 | Craft circles download full-size photos to show at 78 px | Small | ✅ Correct | Small |
| Sm8 | Old `GET /home` still on the server, unused by the new home | Small | ✅ Correct | Small |
| Sm9 | Long category / collection names: tall labels, tile text cut off | Small | ✅ Correct | Small |
| Sm10 | When the 1-minute copy expires, callers wait; a failed rebuild fails everyone | Small | ✅ Correct | Small |
| D1 | (For the developer, "Minor") home never resets `og:image` left by a saree page | Small | ✅ Correct | Small |

**Counts: ✅ 18 · ⚠️ 1 · ❌ 0.**

"Must fix: none found": I agree. The home page only reads data; it changes no money, order or stock, and every error has a Try again button.

---

## Should fix

### S1. "Latest collections" arrows stay greyed out after the first load: ✅ Correct (Should)
**Why:** the arrows are set by `paint()`, which runs only once when the row first appears, on the row's own scroll, and when the row's box changes size. On a first visit the row first holds 6 grey tiles. On a computer 6 tiles exactly fill the row, so "next" is switched off. When the 10 real tiles arrive the row's box keeps the same size (tiles get their height from the same 4:5 shape), so nothing runs `paint()` again.
**Evidence:**
- `web/src/components/useRail.js:9-45`: effect with `[]` deps; `paint()` on `scroll`, `ResizeObserver(paint)` on the row, and once at `:36`; `nextRef.current.disabled = r.scrollLeft > max - 4` (`:17`), and `max` is 0 when 6 tiles fill the row.
- `web/src/pages/home/HomePage.jsx:62-64`: `<TileSkeletons n={6} />` until the catalogue arrives, in the same `Rail`, so the hook is not re-run.
- `web/src/theme/shop.css:68`: `.rail.tiles { grid-auto-columns: calc((100% - 5 * 14px) / 6) }`: 6 columns + 5 gaps = 100%.
- `web/src/theme/shop.css:86`: `.ctile { aspect-ratio: 4 / 5 }` is on both the grey tile and the real one, so the height does not change.
- `web/src/theme/home.css:31`: the progress line is hidden above 1000 px.
**Note:** "see only 6 of the 10" is a little strong. A mouse drag works (`useRail.js:20-26`, `cursor: grab` at `shop.css:66`), as do a touchpad swipe, Shift + wheel and Tab. Any of these scrolls the row and wakes the arrows up. Most visitors won't find them, so the group stays Should. It only happens when home is the first page opened; with the catalogue already in memory, the real tiles are there at mount. I am about 90% sure.

### S2. Craft circles cut off on a computer; a mouse user can't reach them: ✅ Correct (Should)
**Why:** the strip is one row, `overflow-x: auto` with its scroll bar hidden, and it has no arrows or drag. The page is at most 1,360 px wide. My sum for All + 6 categories + the line + 8 crafts at 1440 px is 15 × 96 px + 15 gaps × ~26 px + 1 ≈ 1,830 px. The strip shows about 1,344 px of it, so roughly the last 4 crafts (Kalamkari partly, Bandhani, Checks, Pure Pattu, in `CRAFTS` order) are off to the right.
**Evidence:**
- `web/src/theme/home.css:5-7`: `.cat-strip { display:flex; overflow-x:auto; scrollbar-width:none }` and `.cs { width: 96px }`.
- `web/src/theme/base.css:29`: `.wrap { max-width: 1360px }`.
- `web/src/pages/home/HomePage.jsx:29-44`: plain `<nav>` with no `useRail`.
- `backend/src/config/constants.js:165-174`: the 8 crafts in this order.
- `backend/src/services/shop/catalog.service.js:143-146`: every craft with sarees has a photo, so all of them show.
**Note:** the exact number cut off depends on how many crafts have sarees today; I could not read the database. Keyboard Tab and Shift + wheel do reach them. The crafts are also in the "All sarees" filter list lower down the same page (`ShopList.jsx:186`), so customers can still find them, just not from the circles.

### S3. If only the catalogue call fails, every saree is hidden too: ⚠️ Partly correct (Small)
**What is right:** the code does hide the whole list. When the catalogue has no data and has failed, the page swaps both `LatestCollections` and `ShopList` for one error box (`web/src/pages/home/HomePage.jsx:96-108`), even though `ShopList` has its own error handling (`ShopList.jsx:107-115`).
**What is overstated:** the server builds both answers from the **same** one-minute summary. `list()` first does `await summary()` (`backend/src/services/shop/catalog.service.js:255`), and a rebuild is shared by all callers (`:161`). So a slow or failing server or database breaks **both** calls together. The case "catalogue fails, list works" needs a network failure of just that one request. The 20-second timeout only counts until the reply starts (`web/src/api/client.js:51,67-69`), so a big reply on a slow line does not trip it either. That makes the case rare, and the customer has Try again (`HomePage.jsx:101`). Real, but Small polish rather than Should.

### S4. Coming back after a minute can leave a new card or tile invisible: ✅ Correct (Should)
**Why:** cards and tiles start see-through (`.js-motion .reveal:not(.in) { opacity: 0 }`) until the fade-in code marks them `in`. That code only looks for new cards when its listed inputs change. When the home page is opened again after more than 60 s, the saved list shows at once and a fresh copy is fetched quietly with the status kept as "ready". If the first 24 sarees changed (a new arrival, which is first because the list is newest first, or a sale moving another saree up), the new card is a new element. `items.length` (24), the list key and `loadingFirst` are all unchanged, so nothing marks it `in`. It stays invisible until "Load more" or a filter change. Latest collections works the same way: the page re-scans only when the catalogue's `status` changes, and it stays "ready".
**Evidence:**
- `web/src/data/resource.js:21-26`: `set(key, { status: e?.data ? 'ready' : 'loading', promise })`.
- `web/src/pages/shop/ShopList.jsx:65`: `useReveal(grid, [listKey(f, 0, PAGE), items.length, loadingFirst])`.
- `web/src/pages/home/HomePage.jsx:76`: `useReveal(page, [status])`.
- `web/src/utils/motion.js:24-48`: only observes the `.reveal:not(.in)` found when the effect runs.
- `web/src/theme/shop.css:19`, `web/src/components/SareeCard.jsx:36`, `web/src/components/CollectionTile.jsx:8`.

Visitors with "reduce motion" switched on are not affected (`shop.css:28`). About 90% sure. With ~36 new sarees a day plus sales, this is likely during shop hours.

### S5. "N new sarees →" opens the full list: ✅ Correct (Should)
**Why:** the link goes to `/shop?sort=new`. The website's filter reader drops `sort=new` because `'new'` is not one of its sorts, so it asks for the normal list (all 1,813, newest first). Only the title changes to "New in". The server would accept `sort=new`, but it has no "added in the last 10 days" filter. So "362 new sarees →" lands on "1,813 sarees".
**Evidence:**
- `web/src/pages/home/HomePage.jsx:59`.
- `web/src/pages/shop/filters.js:5-9` (SORTS has `''`, `price-asc` and `price-desc`) and `:23` (`SORT_KEYS.includes(sort) ? sort : ''`).
- `web/src/pages/shop/ShopPage.jsx:22`.
- `backend/src/validators/shop/catalog.validators.js:9-23`: the list query has no date filter.

The same link is used in the header, footer, side menu, bag, checkout and orders (for example `Header.jsx:124`). Those say only "New in", so the mismatch is mainly this home link with its number.

### S6. Trial collections hidden only from "Coming soon" names: ✅ Correct (Should)
**Why:** the trial-name rule `TRIAL_NAME` is only used for the `upcoming` names of "Coming soon" categories. The collections list behind Latest collections, the counts and the saree list have no such check. New sarees default to "both" (online + store) in the validator and the service. So a test collection with a website price of ₹500 or more and a photo goes straight online, and being newest it comes first in Latest collections, with "New", and as the first card. A test **category** has no name check either, so it would show as "Coming soon".
**Evidence:**
- `backend/src/services/shop/catalog.service.js:51` (rule), `:141` (its only use), `:99-117` (collections, no check) and `:134-136` (soon categories, no check).
- `backend/src/validators/product.validators.js:39` (`channel ... .default('both')`) and `backend/src/services/product.service.js:227`.

### S7. "New" only looks at when the saree was first entered: ✅ Correct (Should)
**Why:** all three ("New" badge, "N new sarees", and the order of Latest collections) use `Product.createdAt`. "Add tags" (more pieces of the same design) only adds Piece rows and never changes the saree's date. Switching a saree from Store only to Online (`updateProduct`) doesn't change it either. A collection switched back on or with its price fixed doesn't change it.
**Evidence:**
- `backend/src/services/shop/catalog.service.js:68`, `:94-95` and `:166`.
- `backend/src/services/product.service.js:285-305` (addTags creates pieces only) and `:324` (channel change).
**Note:** "photo added later" cannot happen for sarees made in the new admin app. A photo is required to create one (`product.service.js:243,258`) and the last photo can't be deleted (`:371`). It can still happen for sarees made through the old server, which shares the database. The rest of the finding stands.

### S8. Any active category with nothing online shows "Coming soon"; no way to hide it: ✅ Correct (Should)
**Why:** `soon` is simply every active category that is not among those with sarees online. A category whose sarees all sold out, or which is all "Store only", becomes "Coming soon", with its collection names on its category page. The admin app can only rename a category or delete it. It has no on/off switch, and deleting needs all its collections deleted first.
**Evidence:**
- `backend/src/services/shop/catalog.service.js:118-142` (`.filter((c) => c.count > 0)` then `!shown.has(c.slug)`).
- `backend/prisma/schema.prisma:284` (isActive "no longer exposed as an admin toggle").
- `backend/src/services/catalog.service.js:208-216` (updateCategory: name and description only) and `:227-232` (deleteCategory throws `HAS_SUBCATEGORIES`).

---

## Small

### Sm1. Tile says "N pieces" but N is designs: ✅ Correct
`backend/src/services/shop/catalog.service.js:89-91` counts 1 per saree (`c.count += 1`), whatever its pieces. `web/src/components/CollectionTile.jsx:13` prints it as "pieces". The list prints the same kind of number as "sarees" (`ShopList.jsx:21`).

### Sm2. Error boxes always say "check your connection": ✅ Correct
The text is fixed in `web/src/pages/home/HomePage.jsx:99-100` and `web/src/pages/shop/ShopList.jsx:111-112`. The real `ApiError` text is never shown, even though one exists for rate limit, server, busy, offline and timeout (`web/src/api/errors.js:35-44`, `client.js:78-81`). The "website off" (503) case is handled separately by the maintenance page.

### Sm3. Grey circles keep pulsing above the error box: ✅ Correct
`web/src/pages/home/HomePage.jsx:25-27` draws 8 `.skel` circles whenever `!catalog`, including after an error. `.skel` has `animation: shimmer 1.4s linear infinite` (`web/src/theme/base.css:137`).

### Sm4. Empty shop wording and empty Latest row: ✅ Correct
`web/src/pages/shop/ShopList.jsx:120`: the heading is "No sarees match these filters" whenever there is no search, even with no filter. The line under it does say "New pieces arrive every week…" (`:121`), so only the heading is wrong. `HomePage.jsx:51,62-64` renders the heading and an empty row when `cols` is `[]`. This cannot happen with today's 1,813 sarees; it is polish.

### Sm5. Numbers can disagree for a minute; an open tab never refreshes: ✅ Correct
- The summary is kept 60 s (`backend/src/services/shop/catalog.service.js:159`; `CACHE_SECONDS: 60` at `constants.js:146`).
- "All N" is `totals.sarees` from that copy (`HomePage.jsx:30`). The list total is a live `Q.count` (`catalog.service.js:267-269`).
- The website loads again only when a page opens (`web/src/data/resource.js:37-41`, effect on `[key]`).
- Extra: the list also uses the copy's collection ids (`catalog.service.js:265-266`). So a saree in a collection that had nothing online a minute ago is missing even from the live cards for up to a minute. Section 3.2 / 5.6 "the cards are live" is slightly too strong.

### Sm6. Broken shop photo shows the browser's broken-picture mark: ✅ Correct
The three images have no `onError`: `web/src/components/CategoryPhoto.jsx:7`, `web/src/components/CollectionTile.jsx:10` and `web/src/pages/home/HomePage.jsx:40`. The saree card has one (`SareeCard.jsx:39`). How it looks depends on the browser. These images have `alt=""` and a CSS size (`home.css:9`, `shop.css:88`): Chrome and Safari usually draw a thin box with a small broken-picture icon, and Firefox shows only the empty grey circle or tile. Medium certainty on the exact look; either way it is Small.

### Sm7. Craft circles download full-size photos: ✅ Correct
The craft photo is the biggest collection's photo (`catalog.service.js:145`), which falls back to its newest saree's photo (`:114`). Stored saree photos are up to 960 px and 80 KB (`backend/src/services/photo.service.js:10,13`). `HomePage.jsx:40` shows it in a 78 px circle with no smaller size. On computers the first crafts are in the first view. On phones the crafts start off to the right and are `loading="lazy"`, so the cost there comes mostly when the strip is swiped. The same applies to category circles that fall back to a collection photo (`:125`).

### Sm8. Old `GET /home` still on the server: ✅ Correct
- The route is still there (`backend/src/routes/shop/index.js:48`).
- `home()` does 3 `Q.cards` queries plus `shopDetails()` (`catalog.service.js:184-208`).
- Its only callers are `shopApi.home` (`web/src/api/shop.js:8`, never called by a page) and the browser-test fixture (`web/e2e/w2.e2e.cjs:461`).
- Update: the condition "keep while the old website is live" is now met. The 16 Oct website that used it was replaced on 26 Oct. It can go once the test fixture is changed.

### Sm9. Long names: ✅ Correct
- `web/src/data/categories.js:5-13` has short names for 6 slugs only. Any other category shows its full name (`:13`) in a 96 px label with no line limit (`home.css:7`). Category names can be 100 letters (`backend/src/validators/catalog.validators.js:26`).
- Collection names can be 150 (`catalog.validators.js:30`). The tile text is pinned to the bottom (`shop.css:92`) inside `overflow: hidden` (`:86`), so a long name grows upward and is cut off at the top of a ~130 px-wide phone tile.

### Sm10. Expired copy blocks callers; a failed rebuild fails everyone: ✅ Correct
`backend/src/services/shop/catalog.service.js:158-163`: after 60 s every call waits on `buildSummary()`. On failure `pending` is cleared and the error is thrown, and the old `cached.value` is never used again. Note: in a full database outage the saree list would fail anyway, because it queries the database directly (`:267-270`). Serving the old copy would mainly save the catalogue (round categories, Latest collections, menus) and slow rebuilds.

## For the developer: extra finding

### D1. Home never resets `og:image`: ✅ Correct (Small)
`web/src/utils/useMeta.js:23` sets `og:image` only when an image is passed. `HomePage.jsx:71` passes none, while the saree, collection and category pages set one (`ProductPage.jsx:84`, `CollectionPage.jsx:22`, `CategoryPage.jsx:46`). After visiting a saree, the home page keeps that saree's `og:image`. It only matters to previewers that run JavaScript. WhatsApp and Facebook read `index.html:13` (the loom photo).

"Checked and fine" list: I spot-checked it and agree.
- Prices are rounded with `Math.round` on cards and in the bag (`catalog.service.js:65`, `bag.service.js:47`).
- Moving a saree keeps its category in step (`product.service.js:254,321`).
- JSON-LD `<` is escaped (`HomePage.jsx:93`).
- `lamps` and `applique` exist in `public/img/site`.
- Every list field has `.catch`/`.default` (`validators/shop/catalog.validators.js:9-22`).
- `trust proxy` is set (`backend/src/app.js:16`, default 1).

## Extra note, not in the report (please confirm in a real browser)
- **Possible small jump in the Latest collections row (medium-low certainty).** Tiles that have not faded in yet sit 26 px lower (`shop.css:19`, `translateY(26px)`). The row is a scroll box: `overflow-x: auto` makes its up-down overflow scrollable too (`shop.css:66`). Tiles 7–10 stay lowered until they are scrolled into view, so the row may get ~20 px of hidden up-down scroll. The first mouse-wheel or finger swipe over the row could then move the tiles up a little instead of the page. This also fires `paint()`, which would quietly fix S1's arrows. Worth a quick look on a laptop and a phone; the fix would be `overflow-y: hidden` on `.rail`.

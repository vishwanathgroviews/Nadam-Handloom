# Second check: Module 5, Catalogue and search

Date: 26 Oct 2026. Report checked: [`../05-catalogue-and-search.md`](../05-catalogue-and-search.md).
I only read code (server, website, tests, design notes, mock-up data, the installed react-router library). I did not run, test or change anything, and I did not open `.env`.
All `path:line` references start from the project folder (`Nadam-Handloom-production/`). `web/` = `Nadam-frontend/customer-web/`, `api/` = `Nadam-backend/`.

Live facts used: since 26 Oct ~13:55 IST everything in this code is live; 1,813 sarees on the website, Pattu sarees 1,529; Razorpay TEST payments are open to all, and a saree held at checkout leaves the lists while held.
Real names: the mock-up data file `docs/design/ui-mockup/web-10-category-pages/assets/data.js` is a copy of the live website data of 25 Oct (1,730 sarees, 76 collections). I used it to check the search findings.

## Summary

| Finding | One-line title | Original group | Verdict | Right group |
|---|---|---|---|---|
| M1 | "Load more" goes dead after 480 sarees | Must | ⚠️ Partly correct | Should |
| S1 | Same saree twice, or one skipped, when stock changes between pages | Should | ✅ Correct | Should |
| S2 | Back after "Load more" opens at the top if the customer didn't scroll | Should | ✅ Correct | Should |
| S3 | Header link to another list on `/shop` keeps the old scroll position | Should | ✅ Correct | Should |
| S4 | Search finds nothing for plurals and common spellings | Should | ✅ Correct | Should |
| S5 | Collection page says "sold out" when only a filter (Sets only) finds nothing | Should | ✅ Correct | Should |
| S6 | A chosen collection with 0 matches shows its long code on the chip | Should | ⚠️ Partly correct | Small |
| Sm1 | Error messages always blame the connection | Small | ✅ Correct | Small |
| Sm2 | A search the server ignores still says "Results for …" | Small | ⚠️ Partly correct | Small |
| Sm3 | Admin changes take up to ~2 minutes to show | Small | ✅ Correct | Small |
| Sm4 | A failed once-a-minute refresh breaks every list | Small | ✅ Correct | Small |
| Sm5 | Filter number can differ from the list total for up to a minute | Small | ✅ Correct | Small |
| Sm6 | Telugu search finds nothing, no hint | Small | ✅ Correct | Small |
| Sm7 | Collection page applies extra address filters without chips | Small | ⚠️ Partly correct | Small |
| Sm8 | "Sets only" disappears when no filter group is worth showing | Small | ✅ Correct | Small |
| Sm9 | Search box: Tab leaves suggestions open; weak screen-reader roles | Small | ✅ Correct | Small |
| Sm10 | Category address with capitals says "not on the website" | Small | ✅ Correct | Small |
| Sm11 | Website keeps its own copy of craft keys and price ranges | Small | ✅ Correct | Small |
| Sm12 | Browser memory of answers never cleared | Small | ✅ Correct | Small |
| Sm13 | "pure pattu" also lists Plain and Butta collections | Small | ✅ Correct | Small (owner to decide) |
| X1 | (Dev) `craft=a&craft=b` drops all crafts | Note | ✅ Correct | Note |
| X2 | (Dev) `offset` over 10,000 becomes 0 | Note | ✅ Correct | Note |
| X3 | (Dev) Browse limit keyed by full IP; one locked transaction per call | Note | ✅ Correct | Note |
| X4 | (Dev) Search suggestions run 3 queries per typing pause | Note | ✅ Correct | Note |
| X5 | (Dev) `public, max-age=60` header vs website `no-store` | Note | ✅ Correct | Note |

**Counts: ✅ 21 · ⚠️ 4 · ❌ 0** (20 problems + 5 developer notes = 25 checked).

The developer table in section 8 repeats M1 to Small 13 with technical notes; I checked those notes too and they match the code (the line numbers are right).

---

## M1. "Load more" goes dead after 480 sarees: ⚠️ Partly correct (Must → Should)

**What is right.** The bug is real, exactly as described.
- `web/src/pages/shop/filters.js:27`: `readPages = … Math.min(20, …)`. The address can hold `page=21`, but the website reads it as 20.
- `web/src/pages/shop/ShopList.jsx:73-77`: Load more sets `page = pages + 1` = 21 → `readPages` gives 20 again → `useList` (`web/src/data/shop.js:21-24`) asks for the same 20 keys → nothing loads.
- `ShopList.jsx:63` `hasMore = … nextOffset != null` and `:138`: the server (`api/src/services/shop/catalog.service.js:286`) still sends `nextOffset = 480` while `480 < total`, so the button stays and "You've seen 480 of 1,813" stays.
- Lists over 480 today: All sarees and New in (1,813), and `/shop?category=…pattu…` (1,529). The test pins the cap (`web/src/pages/shop/filters.test.js:17-19`).

**What is overstated.**
- **Severity.** It does not touch money, orders, stock, data or security, and the customer is not stuck: every saree is still reachable through the category page → collection pages (largest collection is 81 pieces in the 25 Oct data), the filters, the three sorts and search. To hit it, a customer must press Load more 19 times. It looks broken when it happens, so it is a clear **Should fix**, not a Must.
- "Cannot reach more than 1,200 sarees without filters" is not right: the category and collection pages (no filters) reach all of them.

## S1. Same saree twice, or one skipped: ✅ Correct (Should)

- Each page is its own request by position: `web/src/data/shop.js:22` (`offset = i * 24`) → `api/src/services/shop/catalog.service.js:268` (`skip: f.offset, take: f.limit`).
- Pages are kept and reused for 60 s: `web/src/data/resource.js:21`.
- Pages are joined with no check for repeats: `ShopList.jsx:57`; cards keyed by slug: `ShopList.jsx:128` (`key={c.slug}`), so a repeat gives a duplicate React key.
- The visible rule is checked live on every list call (`api/src/services/shop/visibility.js:17`, `OR: [{ stock > 0 }, { pieces in_stock }]`), so a new upload moves everything down one place and a sold or held saree (a `reserved` piece is not `in_stock`) moves everything up one place. With test payments open to everyone, holds happen.
- Small note on the "window": it is not only the first minute after page 1. Any page younger than 60 s is reused while the next page is fetched fresh (`resource.js:21`), so drift can happen between any two pages fetched less than a minute apart. This does not change the finding.

## S2. Back after "Load more" opens at the top: ✅ Correct (Should)

- Load more and filters use `setSp(…, { replace: true, … })` (`ShopList.jsx:67,71,76`). In react-router 7.18.4 a replace with a string makes a **new key**: `node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs:245` (`key: … || createKey()`) inside `replace2` (`:322-325`). (The report says "new history entry"; strictly it replaces the entry with a new key. Same effect.)
- `web/src/components/ScrollManager.jsx:95` moves `current` to the new key; positions are saved only on a `scroll` event (`:88-90`). Adding cards below does not scroll the page, so nothing is saved for the new key.
- Clicking a card then Back: `:99` `nav === 'POP' && positions.has(key)` is false → `:102` `!samePage` → `jump(0)`. The list opens at the top with all pages loaded (`page=N` is in the address).

## S3. Header link to another list keeps the old scroll: ✅ Correct (Should)

- `ScrollManager.jsx:96` `samePage = prevPath.current === pathname`; `:102` jumps to the top only when the path changes. `/shop` → `/shop?sets=1` is the same path, so no jump.
- Same-path links: `web/src/components/Header.jsx:122-125` (All sarees, New in, Sets), `:60` (craft links in each category menu), `web/src/components/SearchBox.jsx:60` (`navigate('/shop?q=…')`), and the phone menu `web/src/components/SideMenu.jsx:36-42`.
- The header is sticky (`web/src/theme/base.css:162`, `.hdr { position: sticky; top: 0 }`), so these links are always reachable while scrolled.
- While the new list loads it shows only 8 grey cards (`ShopList.jsx:128`), so the page may get shorter and the browser clamps the position; either way it does not go to the top, and the title is off-screen.

## S4. Search finds nothing for plurals and common spellings: ✅ Correct (Should)

- `api/src/services/shop/catalog.service.js:234-251`: every word must be `contains` (case-insensitive) in the saree name, code, collection name or category name. Extra matching only for craft words (`:228-232`, `api/src/config/constants.js:165-174`). The suggestions use the same rule (`SearchBox.jsx:45-52`).
- None of "materials", "lehenga", "dupatta", "jute", "sarees"+"cotton" maps to a craft.
- Confirmed with the 25 Oct live data copy (`docs/design/ui-mockup/web-10-category-pages/assets/data.js`): categories "Handloom Pattu Dress Material" (singular) and "Handloom Cotton Saree" (singular); names use "Lehanga" (64 sarees), "Duppata" (54), "Zute" (45), "Material" (78). Running the same "every word contained" rule over the 1,730 sarees gives **0** for "pattu dress materials", "lehenga", "dupatta", "jute saree" and "cotton sarees" ("cotton saree" finds 2).
- "Pattu dress materials" is the website's own menu name (`web/src/data/categories.js:7`). The report's guess about the category names is right.

## S5. "Everything in this collection has sold out" shown for a filter: ✅ Correct (Should)

- `web/src/pages/shop/CollectionPage.jsx:40` always passes the sold-out sentence as `empty`; `ShopList.jsx:121` shows `empty ||` … whatever filters are on; `:120` heading is "No sarees match these filters" (or "Nothing found for …" when only a search is on).
- The page only says "This collection isn't on the website now" when the collection is missing from the catalogue (`CollectionPage.jsx:24`). If single pieces remain, the page opens, the toolbar shows "Sets only" because `f.sets` is in the address (`ShopList.jsx:157`), and with no sets left the list says "Everything in this collection has sold out", while the heading above still says "33 pieces · …" (`CollectionPage.jsx:34`).
- A "Clear filters" button does appear (`ShopList.jsx:122`), which softens it, but the sentence is false. Sets are made for families, so a sets link shared on WhatsApp is a realistic way to hit this. Should is fair.

## S6. Chosen collection with 0 matches shows its code on the chip: ⚠️ Partly correct (Should → Small)

**What is right.** The server drops collections with 0 from the facets, even the chosen one: `api/src/services/shop/catalog.service.js:291-294` (`.filter((c) => c.count > 0)`). The website's keep-the-chosen rule (`web/src/pages/shop/Filters.jsx:39`) therefore never sees it. The chip falls back to the raw value: `ShopList.jsx:81` (`… || labels[key]?.[value] || value`) and `:88`; and `ShopPage.jsx:38` / `HomePage.jsx:106` pass only `labels.craft`, no collection names. So the chip shows the UUID, and no collection radio is ticked. Both scenarios (pick a collection then Sets only; an old link to a sold-out collection) happen.

**What is overstated.** It only happens when the list is already empty ("No sarees match these filters" with a "Clear filters" button), and the chip still works (× removes it). It is a wrong label, nothing more: **Small** (polish).

## Small 1. Error messages always blame the connection: ✅ Correct (Small)

`web/src/api/client.js:81` keeps `code` (e.g. `RATE_LIMITED`, from `api/src/middlewares/rateLimit.js:26`), but `ShopList.jsx:111-112`, `CategoryPage.jsx:50`, `CollectionPage.jsx:26` and `CollectionsPage.jsx:39` always print "Please check your connection".

## Small 2. A search the server ignores still says "Results for …": ⚠️ Partly correct (Small)

**What is right.** Symbols only: `api/src/validators/shop/catalog.validators.js:19` turns `%`, `_`, `\` into spaces; empty → `refine` fails → `.catch(undefined)` → no search. The website keeps `q = "%"` (`filters.js:22`), so the title is "Results for “%”" (`ShopPage.jsx:12`) over all 1,813 sarees. The suggestions send `term` unshortened (`SearchBox.jsx:31`) and the input has no `maxLength` (`:77-81`), so a symbols-only or 61+ letter term shows the 4 newest sarees.

**What is wrong.** "Longer than 60 letters → the page shows every saree" does not happen on the results page: `filters.js:22` cuts the search to 60 letters (`.trim().slice(0, 60)`) before calling the server, and 60 passes `max(60)`. The page searches the first 60 letters. The over-60 problem is only in the suggestions.

## Small 3. Admin changes take up to ~2 minutes: ✅ Correct (Small)

`forgetCatalog` (`catalog.service.js:75`) is only used in `api/tests/api/shop/catalog.test.js:54`. Summary kept 60 s (`:158-159`, `CACHE_SECONDS: 60` in `constants.js:146`); browser reuses for 60 s (`resource.js:5,21`). Lists are limited to collections in the summary even with no filter (`:265`), so a new collection's sarees wait up to a minute. (Card prices come live from the server, but the browser can still show a list page up to a minute old.)

## Small 4. Failed refresh breaks every list: ✅ Correct (Small)

`catalog.service.js:159` returns the old summary only while it is fresh; after 60 s a failed rebuild (`:161`, `(err) => { cached.pending = null; throw err; }`) throws even though `cached.value` exists. Every catalogue, home and list call fails until a rebuild succeeds.

## Small 5. Filter number vs list total: ✅ Correct (Small)

`catalog.service.js:261-263`: with no search and no Sets only, counts come from the summary (`s.collections … c.count`); `:269` `Q.count(where)` is live. They can differ until the next rebuild (≤ 60 s).

## Small 6. Telugu search finds nothing: ✅ Correct (Small)

Same `contains` rule (`catalog.service.js:234-251`); the 25 Oct data has no Telugu in any saree, collection or category name. The empty page says "Nothing found for “…”" and "Try removing a filter, or see everything in the shop." (`ShopList.jsx:120-121`), with no hint to use English.

## Small 7. Collection page applies extra address filters without chips: ⚠️ Partly correct (Small)

**What is right.** `ShopList.jsx:45` (`{ ...readFilters(sp), ...fixed }`) applies `price`, `craft` and `q` from the address on a collection page, and the collection layout (`:152-171`) has no chip row.

**What is wrong in the example.** `?price=u25` cannot "show fewer sarees": every saree in a collection has the collection's one price (`catalog.service.js:65`, band per collection at `:110`), so price (and craft) gives all or nothing. When it gives nothing, a "Clear filters" button does show (`:122`), with the wrong sold-out sentence (S5). The case that really "shows fewer with no visible reason" is `?q=…`. Only hand-made or edited links do this.

## Small 8. "Sets only" disappears: ✅ Correct (Small)

`ShopList.jsx:93` `side = listing && (facets ? groups.length > 0 : true)`; `:186` and `:193` hide the panel and the phone Filter button when `side` is false; Sets only lives only inside `Filters.jsx:66-71`. `groupsFor` (`filters.js:44-47`) never counts Sets only. A search that hits one collection gives one category, one craft, one price band and one collection → no groups → no Sets only.

## Small 9. Search box keyboard and screen readers: ✅ Correct (Small)

`SearchBox.jsx:38-43` closes only on `pointerdown` outside; Tab away leaves the list open. `:77-81`: the input is `type="search"` with `aria-autocomplete`, `aria-controls`, `aria-expanded` but no `role="combobox"`, and `search-suggest` (`:84`) is not a `listbox`, so most screen readers won't announce a suggestion list; `aria-controls` points at nothing while closed.

## Small 10. Category address with capitals: ✅ Correct (Small)

React Router matches `category/:slug` (`web/src/App.jsx:64`) without case, but `CategoryPage.jsx:42` compares `c.slug === slug` exactly, so `/category/Fabrics` → "This category isn't on the website now" (`:48`). Only hand-typed or old links; the website's own links are lower case.

## Small 11. Website's own copy of crafts and price ranges: ✅ Correct (Small)

`filters.js:11` `PRICE_KEYS` and `filters.js:19` (keeps only crafts in `CRAFT_NAMES`, `web/src/data/crafts.js:2-23`). A new server craft is dropped from the address: the phone menu link `/shop?craft=<new>` (`SideMenu.jsx:42`) shows All sarees as the report says; the computer menu link (`Header.jsx:60`) shows the whole category with an empty link label (`CRAFT_NAMES[k]` undefined); the search box never suggests it (`crafts.js:28`). A new price band can be clicked but is dropped.

## Small 12. Browser memory never cleared: ✅ Correct (Small)

`resource.js:6` `const entries = new Map()`; nothing ever deletes from it.

## Small 13. "pure pattu" lists Plain and Butta collections: ✅ Correct (Small, owner to decide)

`constants.js:173` craft `pure` = `/pure pattu|plain|\bbutt?a\b/`, named "Pure Pattu & Plain". `catalog.service.js:228-232`: "pure" matches the key `pure`; "pattu" matches the word "Pattu" in the craft name. Both words then also match every `pure` collection (`:239`, `:246`). In the 25 Oct data that adds "50/50 Plain Saree", "300 Kanchi Border Plain Sarees", "350 Kanchi Border Buta Sarees" and even "Plain Cotton Saree" (cotton category).

## X1. `craft=a&craft=b` drops all crafts: ✅ Correct (Note)

Express 5 (`api/package.json`) parses a repeated key as an array; `catalog.validators.js:12-16` `z.string()` fails → `.catch([])`. The website builds the query with `p.set` (`web/src/data/shop.js:11`), so it never sends this.

## X2. `offset` over 10,000 becomes 0: ✅ Correct (Note)

`catalog.validators.js:21` `.max(10000).default(0).catch(0)`; the reply then says `offset: 0` with `nextOffset: 24`. The website never goes past 480, so harmless today.

## X3. Browse limit by full IP, one locked transaction per call: ✅ Correct (Note)

`api/src/middlewares/rateLimit.js:15` key uses `req.ip`; `:17-22` one transaction with a lock per call. `api/src/utils/network.js:4,21` groups IPv6 by /64 for SMS only.

## X4. Suggestions run 3 queries per typing pause: ✅ Correct (Note)

`SearchBox.jsx:31` calls `/products?q=…&limit=4`; with `q`, `catalog.service.js:261-262` runs `groupByCollection`, then `:267-270` runs `cards` and `count`, plus the facet work, for 4 cards.

## X5. `public, max-age=60` vs `no-store`: ✅ Correct (Note)

`api/src/controllers/shop/catalog.controller.js:8` sets `Cache-Control: public, max-age=60`; `web/src/api/client.js:60` fetches with `cache: 'no-store'`. `Vary: Origin` is already sent (`api/src/middlewares/shopGuard.js:23`, `res.vary('Origin')`).

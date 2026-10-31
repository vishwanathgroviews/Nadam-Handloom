# Third check: Module 5, Catalogue and search

Date: 26 Oct 2026. Report: [`../05-catalogue-and-search.md`](../05-catalogue-and-search.md). Second check: [`05-catalogue-and-search-check.md`](05-catalogue-and-search-check.md).

I am the tie-breaker. I only looked at the 4 findings the second checker marked ⚠️ (none were marked ❌). I read the code myself, from the website to the server and back. I did not run, test or change any code, and I did not open `.env`.

`web/` = `Nadam-frontend/customer-web/`, `api/` = `Nadam-backend/`. Counts marked "25 Oct" come from the copy of the live data in `docs/design/ui-mockup/web-10-category-pages/assets/data.js` (1,730 sarees). The live site had 1,813 on 26 Oct.

## Summary

| Finding | One-line title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| M1 | "Load more" goes dead after 480 sarees | Real; Must fix; customer can't reach 1,200+ sarees without filters | Real; Should fix; every saree is still reachable another way | **Second checker right** | **Should fix** |
| S6 | A chosen collection with 0 matches shows its long code on the chip | Should fix | Real, but only on an already-empty list: Small | **Second checker right** | **Small** |
| Small 2 | A search the server ignores still says "Results for …" | Symbols-only **or over 60 letters** shows every saree | Symbols-only yes; over 60 letters is cut to 60 by the website, so not on the results page (only in the suggestions) | **Second checker right** | **Small** |
| Small 7 | Collection page applies extra address filters without chips | `?price=u25` shows fewer sarees with no reason | Real, but price (and craft) give all or nothing; only `?q=` gives fewer | **Second checker right** | **Small** |

Counts: Second checker right **4** · First reviewer right **0** · Both partly right **0** · Neither right **0**.

---

## M1. "Load more" goes dead after 480 sarees

**What really happens.**
- The website reads the number of loaded pages from the address, but never more than 20: `web/src/pages/shop/filters.js:27` `Math.min(20, Math.max(1, …))`. The test fixes this cap: `web/src/pages/shop/filters.test.js:17-19` (`page=999` → 20).
- Load more writes `page = pages + 1` into the address (`web/src/pages/shop/ShopList.jsx:73-77`). On page 20 that is `page=21`, which is read back as 20 (`ShopList.jsx:46`). The list of page keys stays the same (`web/src/data/shop.js:21-23`), and the loader only runs when the keys change (`web/src/data/resource.js:51-56`, effect on `joined`). So nothing is fetched.
- The server would happily give page 21: `offset` may go up to 10,000 (`api/src/validators/shop/catalog.validators.js:21`), and it still sends `nextOffset = 480` (`api/src/services/shop/catalog.service.js:286`). So `hasMore` stays true (`ShopList.jsx:63`) and the button stays (`ShopList.jsx:138`), with "You've seen 480 of 1,813" (`:136`).
- To get there a customer must press Load more 19 times; the 20th press does nothing.

**Which lists are hit.** Lists over 480: All sarees on the home page (`web/src/pages/home/HomePage.jsx:106`) and `/shop` (`web/src/components/Header.jsx:122`), New in (`Header.jsx:124`, the same 1,813 sarees newest first), the Category filter set to Pattu (1,532 on 25 Oct), and the two cheapest price bands (574 and 742 on 25 Oct). The Pattu **category page** itself is a grid of collection tiles, not a saree list, so it is not hit. Craft lists, Sets and every collection are under 480 today (largest craft 386, Sets 151, largest collection 81 on 25 Oct).

**Can the customer still reach every saree?** Yes, in a few taps:
- The category menu is always on screen (sticky header: `web/src/theme/base.css:162`; links `Header.jsx:123`), and the home page starts with the category strip (`HomePage.jsx:31-35`). A category page shows **every** collection of that category (`web/src/data/categories.js:40`, no limit; `web/src/pages/shop/CategoryPage.jsx:73`). A collection page lists only that collection (`web/src/pages/shop/CollectionPage.jsx:38-39`), at most 81 pieces = 4 pages. No filters needed.
- On the same All sarees page, the Collection filter (with "Show all N", `web/src/pages/shop/Filters.jsx:72-83`) and the Craft filter also split the list into parts under 480. Search works too.
- The three sorts alone do **not** cover everything: the first 480 of each sort together reach only 1,144 of the 1,730 sarees (25 Oct data). This is the one loose point in the second checker's list of routes, but it does not change the answer, because the category → collection route alone reaches every saree.

**Why the first reviewer went wrong.** The bug is real and well found. But the severity rule for Must fix is money, orders, stock or data wrong, a security hole, or a customer **stuck**. Nothing here is wrong in money, orders or stock, and the customer is not stuck: the next step (pick a category or collection) is always on screen. "Cannot reach more than 1,200 sarees without filters" is true only for that one list; the category and collection pages reach them with no filters. The reviewer also named "Pattu sarees" as a hit list, but the Pattu menu link opens collection tiles; only the Pattu **filter** on All sarees is hit.

**Is the second checker right?** Yes. It is a real, visible fault (a button that does nothing, on the main list of the home page) and it will get more common as stock grows, so it is a clear Should fix, not a Must.

**Final.** On any list with more than 480 sarees (All sarees, New in, the Pattu filter, the two cheapest price bands), the 20th "Load more" does nothing and the button stays, so the rest of that list can't be shown; every saree can still be reached through the category → collection pages, the Collection or Craft filters, or search. **Should fix.**

---

## S6. A chosen collection with 0 matches shows its long code on the chip

**What really happens.**
- The server leaves collections with 0 out of the collection numbers, even the one the customer chose: `api/src/services/shop/catalog.service.js:291-294` (`.filter((c) => c.count > 0)`).
- The chip text looks for the name in those numbers, then in `labels`, then falls back to the raw value: `web/src/pages/shop/ShopList.jsx:81` (`… || labels[key]?.[value] || value`), used at `:88`. Both lists pass only craft names (`web/src/pages/shop/ShopPage.jsx:38`, `web/src/pages/home/HomePage.jsx:106`), so the chip shows the long code (UUID). The keep-the-chosen rule in `web/src/pages/shop/Filters.jsx:39` never sees it, so no collection is ticked.
- When does the chosen collection get 0? Its number is counted with all the other filters (`catalog.service.js:271-279`), and the list total uses the same filters plus the collection (`:265-269`). So a 0 for the chosen collection means the list itself is empty. Real ways in: **Sets only** ticked on a collection with no sets (Sets only is always shown, `Filters.jsx:66-71`), or an old shared link to a collection that has sold out. (Picking a craft or price that doesn't fit is not possible from the panel, because those groups hide when only one choice has sarees: `web/src/pages/shop/filters.js:46`.)
- The empty page then says "No sarees match these filters" with a **Clear filters** button (`ShopList.jsx:120-122`), and the chip's × still removes the collection (`ShopList.jsx:146`).

**Why the first reviewer went wrong.** The facts are right, but the harm is small: the result shown ("nothing matches") is true, the way out is right there, and only the label is ugly. That is polish, not "likely and harmful".

**Is the second checker right?** Yes, fully.

**Final.** When a chosen collection has no matching sarees (Sets only on a collection without sets, or an old link to a sold-out collection), the empty list's chip shows the collection's long code instead of its name; the × and Clear filters still work. **Small.**

---

## Small 2. A search the server ignores still says "Results for …"

**What really happens.**
- The server drops a search that is empty after turning `%`, `_` and `\` into spaces, or that is longer than 60 letters: `api/src/validators/shop/catalog.validators.js:19` (`.max(60)` … `.refine((v) => v.length > 0)`, then `.catch(undefined)`). With no search, every saree comes back.
- **Results page:** the website reads the search from the address as `(sp.get('q') || '').trim().slice(0, 60)` (`web/src/pages/shop/filters.js:22`), and that cut text is what it sends (`web/src/data/shop.js:11`) and what the title shows (`web/src/pages/shop/ShopPage.jsx:12`). So a long search is cut to 60 letters and searched normally; the server accepts it (60 passes `max(60)`). A symbols-only search like `%` is kept by the website but dropped by the server, so the page says "Results for "%"" over every saree.
- **Suggestions:** the search box sends the whole typed text (`web/src/components/SearchBox.jsx:31`) and the box has no length limit (`:77-81`). So a symbols-only term **or** a term over 60 letters shows the 4 newest sarees, which have nothing to do with the text.

**Why the first reviewer went wrong.** They cited `filters.js:22` but missed the `.slice(0, 60)` on it, so they thought a long search reaches the server whole and gets dropped on the results page too.

**Is the second checker right?** Yes, exactly.

**Final.** A search made only of `%`, `_` or `\` shows every saree under "Results for "%"", and the suggestion box shows the 4 newest sarees for such a term or for one over 60 letters; a long search on the results page is just cut to 60 letters and works. **Small.**

---

## Small 7. Collection page applies extra address filters without chips

**What really happens.**
- A collection page builds its filters from the whole address, then fixes only the category and collection: `web/src/pages/shop/ShopList.jsx:45` (`{ ...readFilters(sp), ...fixed }`, with `fixed` from `web/src/pages/shop/CollectionPage.jsx:39`). So `price`, `craft` and `q` from the address are applied.
- The collection layout has no chip row (`ShopList.jsx:152-171`). Sets only and Sort are visible there (`:157`, `:161`), so they are not hidden.
- Price and craft belong to the whole collection: one website price, one price band and one craft per collection (`api/src/services/shop/catalog.service.js:103-110`; filter test per collection at `:221-222`). So `?price=…` or `?craft=…` gives **all** the sarees or **none**, never "fewer". When it gives none, the page shows "No sarees match these filters" and a **Clear filters** button (`ShopList.jsx:120-122`, `filtered` is true because price is not fixed), though with the wrong sold-out sentence (that is S5).
- Only `?q=…` really shows fewer sarees with no visible reason (search works per saree: name, code, collection, category, `catalog.service.js:234-251`). The toolbar count ("1 saree") then disagrees with the heading ("33 pieces").
- The website never makes such links itself (collection links have no extras: `web/src/components/CollectionTile.jsx:8`, `SearchBox.jsx:88`), so only hand-edited links do this.

**Why the first reviewer went wrong.** The finding is real, but the example picked a filter that cannot thin out a collection.

**Is the second checker right?** Yes.

**Final.** A hand-edited collection link with `?q=…` shows fewer sarees with no chip to say why; `?price=` or `?craft=` show all or nothing (and nothing comes with Clear filters). **Small.**

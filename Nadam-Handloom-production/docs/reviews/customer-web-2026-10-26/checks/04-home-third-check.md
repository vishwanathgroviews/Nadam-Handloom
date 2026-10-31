# Third check: Module 4, Home page

Date: 26 Oct 2026. Report: [`../04-home.md`](../04-home.md). Second check: [`04-home-check.md`](04-home-check.md).
I only read code. I did not run, build, test or change anything, and I did not open `.env`.
All `path:line` references start from the project folder (`Nadam-Handloom-production/`). Short forms: `web/` = `Nadam-frontend/customer-web/`, `backend/` = `Nadam-backend/`.

What I re-checked: the one ⚠️ finding (Should fix 3) and the second checker's "possible extra issue" (hidden up-down scroll in the Latest collections row).

## Summary

| Finding | One-line title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| S3 | If only the catalogue call fails, every saree is hidden too | Real, and likely on a slow or patchy connection: Should fix | Real, but rare, because both calls wait on the same server summary; Try again fixes it: Small | Second checker right | Small |
| Extra | Latest collections row has ~20 px of hidden up-down scroll | (not in the report) | Possible, medium-low certainty; fix `overflow-y: hidden` on `.rail` | Real (about 85% sure) | Small |

Counts: Second checker right **1** · First reviewer right **0** · Both partly right **0** · Neither right **0**. Extra issue: **Real**.

---

## S3. Catalogue fails, the whole saree list is hidden: Second checker right. Final: Small

**What really happens.**
- On the home page, the catalogue (round categories, Latest collections) and the saree list are two separate calls. Both start at the same moment: the home page and the list are not loaded later (`App.jsx:12` imports `HomePage` directly; `HomePage.jsx:12` imports `ShopList`), and the header asks for the same catalogue entry, so there is only one catalogue call.
- If the catalogue call fails and the tab has no catalogue copy yet, the page shows one box, "We couldn't load the shop", in place of **both** Latest collections and the saree list. The list is hidden even though it has its own error box. That part of the report is right.
- But on the server, the catalogue answer is only the one-minute summary (`catalog()` = `await summary()`), and the list first waits for that same summary and then does two more database reads. So:
  - a server or database error in the summary breaks **both** calls;
  - a slow server cannot time out the catalogue alone: the catalogue always answers first, so if it is too slow, the list is too slow as well;
  - a "slow connection" does not trip the 20-second limit on its own, because that limit stops counting as soon as the reply starts to arrive.
- So "catalogue fails, list works" needs a problem with just that one request: the request is dropped on a patchy line, or (a case the second checker did not name) the network is exactly at its 240-calls-a-minute limit, where the server lets the first call through and refuses the next, so it can refuse the catalogue and let the list through. Both are rare.
- When it does happen: if the list had already appeared, it disappears and the error box takes its place. Try again reloads the catalogue; when that works, the list comes back at once from the browser's copy. The customer is never stuck.

**Why the first reviewer went wrong.** The code reading is right. They assumed the two calls fail on their own ("one call can time out while the other works"). They did not see that the list waits on the same server summary as the catalogue, or that the 20-second timer stops when the reply starts. So the case is much rarer than "slow or patchy connection" suggests, and the result is an honest error with Try again. That is polish, not Should fix.

**Is the second checker right?** Yes. Their two points (shared summary at `catalog.service.js:255`; the timer only counts until the reply starts) are correct. "Only a lone network failure" is slightly too narrow, because the 429 limit edge can do it too. That does not change the verdict.

**Evidence**
- `web/src/pages/home/HomePage.jsx:96-108`: `{!catalog && status === 'error' ? ( <div className="empty" role="alert"> … We couldn't load the shop … ) : ( <> <LatestCollections …/> <ShopList …/> </> )}`. The list is inside the "no error" branch.
- `web/src/pages/shop/ShopList.jsx:107-115`: the list's own "We couldn't load the sarees" box with Try again.
- `web/src/data/shop.js:5`, `web/src/components/Header.jsx:74`: one shared `'catalog'` entry. `web/src/data/resource.js:20`: a call already under way is reused.
- `backend/src/services/shop/catalog.service.js:169-170`: `catalog()` starts with `const s = await summary();` and then only reshapes it.
- `backend/src/services/shop/catalog.service.js:254-255` and `:267-270`: `list()` does `await summary()`, then `Q.cards(...)` and `Q.count(...)`.
- `backend/src/services/shop/catalog.service.js:158-163`: one rebuild shared by all callers; on failure the error goes to every waiting call.
- `web/src/api/client.js:51` (timer starts), `:59-62` (`fetch` resolves when the reply starts), `:67-69` (`finally { clearTimeout(timer) }`), `:75` (body read after the timer is gone).
- `backend/src/routes/shop/index.js:47-50`: catalogue and list share one `shop-browse` limit of 240 a minute. `backend/src/middlewares/rateLimit.js:9-22`: calls are counted one at a time, "the first `max` pass, the rest wait" (are refused).
- `web/src/data/resource.js:42` and `:21-26`: Try again forces a new catalogue call and the status goes back to "loading", so `ShopList` shows again. A list copy under a minute old is shown at once.

**Final.** If only the catalogue call fails on a first visit (a dropped request, or a 429 right at the per-network limit), the home page hides the whole saree list behind "We couldn't load the shop". It is rare, because both calls use the same server summary, and Try again fixes it. **Small.**

---

## Extra: hidden up-down scroll in the Latest collections row: Real (about 85% sure). Final: Small

**What really happens.**
1. The row (`.rail`) only says `overflow-x: auto`. CSS rules say that when one direction scrolls and the other is left as "visible", the other also becomes "auto". So the row can also scroll **up and down** whenever its content is taller than the row. Its scroll bars are hidden, so nobody sees this.
2. Each collection tile is itself the `.reveal` element, sitting directly in the row. Until it has faded in, the page CSS pushes it **26 px down** (`translateY(26px)`). Browsers count a moved box as extra room to scroll. This is the well-known cause of stray scroll bars with "slide in" effects.
3. A tile fades in only when the page code sees it on screen. A tile hidden off to the side of the row is clipped by the row, so it never counts as "on screen" until the visitor slides the row.
   - On a computer, 6 tiles fill the row exactly, and tile 7 starts 14 px past the right edge. So tiles 7–10 stay 26 px low.
   - On a phone (38% wide tiles), about 2½ tiles show, so tiles 4–10 stay low.
4. The row is the tile height plus 6 px of bottom padding. The low tiles reach the tile height plus 26 px. That leaves about **20 px of hidden up-down scroll** (26 − 6).
5. Effect: when a mouse wheel turn, touchpad swipe or finger swipe **starts over this row**, the browser can scroll the row by those 20 px instead of the page. The tiles jump up 20 px (their tops are cut off, with an empty strip below), and that one wheel step or swipe does little or nothing to the page. The next one scrolls the page. Going back up, the first swipe that starts on the row moves it back. On a phone this row sits in the first screen, so a first swipe often starts on it.
6. It lasts until every tile has faded in, that is, until the visitor slides the row to the end. Then the extra room is gone and the row snaps back. Visitors with "reduce motion" turned on are not affected: their tiles never move.

**Is the second checker right?** Yes, on all points: the 26 px push, `overflow-x: auto` making up-down scroll possible, tiles 7–10 staying low, "~20 px", and the fix. Their side remark is also right: an up-down nudge fires the row's `scroll` event, which runs `paint()` and so wakes up S1's arrows. That only helps visitors who happen to do it, so S1 stands.

**How sure.** The CSS and code facts are certain. That browsers count moved boxes as scroll room is standard behaviour in Chrome, Safari and Firefox. What I can't be sure of is the exact feel in each browser: whether a swipe that starts on the row passes the rest of its movement on to the page or stops there. So: about 85% sure it can be noticed. A 1-minute check on a phone and a laptop would confirm it.

**Evidence**
- `web/src/theme/shop.css:66`: `.rail { display: grid; … overflow-x: auto; … scrollbar-width: none; padding-bottom: 6px; … overscroll-behavior-x: contain; }`. There is no `overflow-y`, and `contain` is set for sideways only.
- `web/src/theme/shop.css:70`: `.rail::-webkit-scrollbar { display: none; }`.
- No other `.rail` overflow rule anywhere in `web/src/theme/` (checked; `home.css:29-31` only styles `.rail-bar`).
- `web/src/theme/shop.css:18-19`: `.reveal { transition: … }` and `.js-motion .reveal:not(.in) { opacity: 0; transform: translateY(26px); }`. `:28`: `.no-motion .reveal { … transform: none !important; }`.
- `web/src/components/CollectionTile.jsx:8`: `<Link className="ctile reveal" …>`, so the tile itself is pushed down. `web/src/components/Rail.jsx:16-17`: the tiles are direct children of `.rail`.
- `web/src/theme/shop.css:68`: `.rail.tiles { grid-auto-columns: calc((100% - 5 * 14px) / 6) }` (6 tiles fill the row). `:75`: phones `38%`. `:86`: `.ctile { aspect-ratio: 4 / 5; overflow: hidden }` (this clips the tile's inside, not the tile's own pushed box).
- `web/src/utils/motion.js:11-20`: `js-motion` is set on the page unless "reduce motion" is on. `:28`: only `.reveal:not(.in)` found at that moment is watched. `:33-37`: `IntersectionObserver` with the screen as root, `rootMargin: '0px 0px -8% 0px'`, `threshold: 0.08`. A tile clipped by the row does not count as seen.
- `web/src/pages/home/HomePage.jsx:62-64` (the row) and `:76` (`useReveal(page, [status])`).
- `web/src/components/useRail.js:29`: `r.addEventListener('scroll', paint, …)`, so any scroll of the row, up-down included, re-runs `paint()`.

**Same thing elsewhere.** Rows of saree cards use the same `.rail` and the cards are also `.reveal` (`web/src/components/SareeCard.jsx:36`). So the saree page rows (`web/src/pages/product/ProductPage.jsx:42-43`) and the bag's "Recently viewed" row (`web/src/pages/bag/BagPage.jsx:71-72`) have the same hidden scroll. One fix on `.rail` covers all of them.

**Fix (for the developer).** Add `overflow-y: hidden` to `.rail` (`shop.css:66`). This stops wheel and finger up-down scrolling of the row, and the fade-in still works. A cleaner alternative removes the cause: don't slide items that sit inside a row, for example `.rail > .reveal:not(.in) { transform: none; }`, which keeps the fade. (`overflow-y: clip` is not an option next to `overflow-x: auto`; browsers turn it into `hidden` anyway.)

**Final.** While some Latest collections tiles have not faded in yet, the row has about 20 px of hidden up-down scroll. A wheel turn or swipe that starts on the row can nudge the tiles up (tops cut off) instead of scrolling the page, once per direction. **Small.**

---

## Noticed in passing (other module, not part of this check)

- **The bag page's "Recently viewed" cards look likely to be invisible.** The cards are `.reveal` (`web/src/components/SareeCard.jsx:36`), so they start at `opacity: 0` (`web/src/theme/shop.css:19`). But `BagPage.jsx` never calls `useReveal`: the only callers are `HomePage.jsx:76`, `ShopList.jsx:65`, `ProductPage.jsx:85`, `CategoryPage.jsx:44` and `CollectionsPage.jsx:20`. So nothing ever adds `in` to the cards in `Recent` (`web/src/pages/bag/BagPage.jsx:61-75`, used at `:138` and `:200`). With "reduce motion" off, the row would show its heading over invisible (but still clickable) cards. Module 7's report and check do not mention this. I only read it in passing (about 90% sure); please check it in that module.

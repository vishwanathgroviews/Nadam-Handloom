# Second check: Module 7, the bag (cart)

Date: 26 Oct 2026. Report checked: [`../07-bag.md`](../07-bag.md).
I only read code (website, server, schema, migration, design notes). I did not run, test or change anything, and I did not open `.env`.
`W` = `Nadam-frontend/customer-web/`, `B` = `Nadam-backend/` (both under `Nadam-Handloom-production/`).

Live facts used: since 26 Oct ~13:55 IST all of this code is live, including checkout and online payment (Razorpay test keys, open to every visitor), and every saree card has "Add to bag". So every path below can happen on the live site today, including Must fix 1 (customers now really reach Pay).

## Summary

| Finding | One-line title | Original group | Verdict | Right group |
|---|---|---|---|---|
| M1 | Join at sign-in fails once: bag not in the account, Pay stays grey | Must | ✅ Correct | Must |
| S1 | Saree added while sign-in is "unknown" or while joining disappears | Should | ✅ Correct | Should |
| S2 | Undo on an older "Removed" message brings back the wrong saree | Should | ✅ Correct | Should |
| Sm1 | Sign-in ended elsewhere: "couldn't check your bag" shows next to "signed out" | Small | ✅ Correct | Small |
| Sm2 | Join into a full account bag says "can't be bought now", not "bag full" | Small | ✅ Correct | Small |
| Sm3 | Another customer's unpaid 15-minute hold shows as "Sold out: it sold"; sets lowered for good | Small | ✅ Correct | Small |
| Sm4 | Signed in: "Add to bag" sends "set to N" from this browser's copy, can lower a set | Small | ✅ Correct | Small |
| Sm5 | An older signed-in bag answer can land after a newer change | Small | ⚠️ Partly correct | Small (very rare) |
| Sm6 | Recently viewed cards add with old price and stock | Small | ✅ Correct | Small |
| Sm7 | Send on WhatsApp works before the bag was ever checked | Small | ✅ Correct | Small |
| Sm8 | Sign-out while a bag request is on its way can put the bag back | Small | ✅ Correct | Small |
| Sm9 | A saree untouched 60 days disappears from a signed-in bag with no message | Small | ✅ Correct | Small |
| Sm10 | After paying, the whole bag line goes even if raised in another tab | Small | ✅ Correct | Small |
| Sm11 | "Bags are joined" message only shows on the bag page | Small | ✅ Correct | Small |
| Sm12 | Menu's "Bag" has no number | Small | ✅ Correct | Small |
| Sm13 | Old-website "brought back N" count can be wrong / replaced | Small | ✅ Correct | Small |
| Sm14 | Per-customer limit message says "from this network" | Small | ✅ Correct | Small |
| Sm15 | Website's 20 / 50 limits hard-coded, not read from `/config` | Small | ✅ Correct | Small |
| Sm16 | Guessed link tells if a hidden saree exists | Small | ✅ Correct | Small |
| Sm17 | CORS allow-list has no PUT | Small | ✅ Correct | Small |
| X1 | (Dev note, M1) Same stuck state when the guest bag is empty and `GET /me/bag` fails | Note | ✅ Correct | Part of Must 1 |
| X2 | (Dev note, Sm10) Payment delete and clean-up skip the bag lock: a change at that instant can answer 500 | Note | ✅ Correct | Small (very rare) |
| X3 | (Checked-and-fine note) Design says 120/min "per network on all six"; code counts 5 signed-in routes per customer | Note | ✅ Correct | Doc only |

**Counts: ✅ 22 · ⚠️ 1 · ❌ 0** (20 problems + 3 developer notes = 23 checked).

---

## M1. Join at sign-in fails once: customer stuck, cannot pay (Must) — ✅ Correct

**Why:** at sign-in the website joins the two bags with one request. If it fails, the `.catch` only sets an error; the bag stays marked "visitor" (`owner: 'guest'`) while the customer is signed in. Nothing ever tries the join again (except the `online` event, and only while the status is still `error`). Every later check is a visitor check, which succeeds and clears the error, so the stuck state becomes silent. Checkout needs `bag.owner === 'account'`, so Pay never turns on.

**Evidence:**
- `W/src/bag/store.js:345` `.catch((error) => set({ status: 'error', error }))`: no change of `owner`.
- `W/src/bag/store.js:183` `isAccount = () => state.owner === 'account' && signedIn()` stays false.
- `W/src/bag/store.js:210` `isAccount() ? shopApi.bag()... : shopApi.bagCheck(...)` → visitor check; `applyCheck` (`:166`) sets `status: 'ready'`.
- `W/src/bag/store.js:387-391` the join only runs when the sign-in status *changes* to `signedIn`; key renewals set the same status, so `onAuth` returns at `:384`.
- `W/src/bag/store.js:406-411` the only retry: `online` event and `state.status === 'error'`.
- `W/src/bag/store.js:241-249` later adds take the local branch (not saved in the account).
- `W/src/pages/checkout/CheckoutPage.jsx:187` `bagReady = bag.status === 'ready' && bag.owner === 'account' && ...`; `:319` `canPay = ... && bagReady && ...`.
- `W/src/pages/bag/BagPage.jsx:112` Try again calls `refresh()`; `:98` "here and in your account" when `auth === 'signedIn'`; `W/src/bag/store.js:297` `clear()` then only clears this browser. `BagPage.jsx:193` also says "Saved in your account", which is not true here.

**Small precision:** right after the failure the checkout page does show "We couldn't check your bag just now · Try again" (`CheckoutPage.jsx:380`). The "grey Pay with no reason" starts once that Try again (or any later check) succeeds as a visitor check. The report's flow already says this; the finding stands. Reload (or signing out and in) fixes it, as the report says.

**Group:** Must is right: a ready-to-pay customer is stuck with no way forward except reloading, and their bag silently stops saving to the account.

## S1. Saree added while the sign-in is being checked, or while joining, disappears (Should) — ✅ Correct

**Why (a):** on page load `bootstrap()` leaves the sign-in status `unknown` while it renews the key (and keeps it `unknown` through its retries at 1 s and 3 s, or longer if all fail). Public pages and "Add to bag" work in that time. `add()` sees `isAccount()` false and changes only the browser copy; `refresh()` then does nothing because `owner === 'account' && !signedIn()`. When the status becomes `signedIn`, `joinAccount()` ignores the browser items (they belong to the account, so `guest = []`) and `applyAccount` replaces the whole list with the server's. The new saree is gone. If the sign-in turns out to have ended, `forgetAccount()` wipes everything, including it.

**Why (b):** during the join the bag is still `owner: 'guest'`; an add/remove goes to the browser copy only, `refresh()` returns the `joining` promise, and the join's answer replaces the list (`:335`). The added saree vanishes; a removed one comes back.

**Evidence:** `W/src/auth/session.js:17` (status starts `unknown`), `:98-112` (bootstrap and retries); `W/src/main.jsx:26-27` (bootstrap then startBag; pages render meanwhile, `W/src/App.jsx:58-95` has no wait for sign-in on public pages); `W/src/bag/store.js:241-250` (local branch, then "Added" panel), `:203` (no check while waiting), `:329` (`guest` only when `owner === 'guest'`), `:332-335` (answer replaces all), `:392` + `:352-358` (wipe on signed-out).

**Group:** Should is right. The windows are short on a good line but real (longer on a weak signal or when the renewal fails and is retried), and the customer saw "Added" and later loses it with no message.

## S2. Undo on an older "Removed" message brings back the wrong saree (Should) — ✅ Correct

**Why:** every Undo button calls the same `undo()`, which reads one shared `lastRemoved`. Removing B overwrites A's entry. Up to three toasts stay, each 6 seconds. Undo on A's toast restores B and clears `lastRemoved`; Undo on B's toast then finds nothing.

**Evidence:** `W/src/bag/useBagActions.js:30` `onClick: () => undo()` (no item passed); `W/src/bag/store.js:274` `set({ lastRemoved: { item, index } })`; `:279-281` `const r = state.lastRemoved; if (!r) return; set({ lastRemoved: null })`; `W/src/components/Toasts.jsx:14` `[...l.slice(-2), {...}]` (three at once), `:15` 6000 ms with an action.

**Group:** Should is right (customer loses the saree they meant to keep).

## Sm1. Sign-in ended elsewhere: two messages at once (Small) — ✅ Correct

**Why:** the server checks the session on every call (`B/src/middlewares/authenticateCustomer.js:18-23`) and answers 401 with a "signed out" code. `request()` emits `sessionEnded` before throwing (`W/src/api/client.js:105`, or via the failed renewal at `W/src/auth/session.js:80-83`). That runs `end()` → `forgetAccount()` (bag emptied, "signed out" notice). Then the error reaches `refresh()`'s catch, which sets `status: 'error'` (`W/src/bag/store.js:212`). The empty bag page shows both "We couldn't check your bag just now" (`BagPage.jsx:94`, `:111`) and the signed-out notice (`:116`, `:52-53`).

**Group:** Small is right (a wrong extra message, nothing lost).

## Sm2. Join into a full account bag gives the wrong reason (Small) — ✅ Correct

**Why:** in `merge`, a new saree that doesn't fit is counted with the others as `skipped` (`B/src/services/shop/bag.service.js:171` `if (count >= BAG.MAX_LINES) { joined.skipped += 1; continue; }`). The website copies that number (`W/src/bag/store.js:342`) and words every skip as "can't be bought now" (`W/src/pages/bag/BagPage.jsx:47`). Design rule 9 (`docs/modules/web-03-cart.md:77`) lists "bag full" as its own reason.

**Group:** Small is right (rare, wording only).

## Sm3. Another customer's unpaid hold shows as "Sold out: it sold"; a set is lowered for good (Small) — ✅ Correct

**Why:** a hold takes pieces out of the count: tagged pieces become `reserved` and the old counter is decreased (`B/src/services/shop/checkout.service.js:179`, `:185`). Stock on a card = `stock` + pieces with status `in_stock` only (`B/src/services/shop/catalog.service.js:49`, filter in `B/src/models/shopCatalog.model.js:10`). Only *this* customer's own holds are added back (`B/src/models/bag.model.js:26-33`). So for everyone else the line becomes `sold_out` or `fewer` (`bag.service.js:35-36`), the page says "Sold out: it sold since you added it" (`W/src/pages/bag/BagLine.jsx:33`), and the lower number is saved for good: `readBag` writes it (`bag.service.js:108`), and the visitor copy keeps it (`W/src/bag/store.js:164`).

**Small precision:** the "reserved pieces don't count" rule sits in `shopCatalog.model.js:10` (`status: 'in_stock'`) and in the counter decrement in checkout, not in `catalog.service.js:49` itself; same effect.

**Group:** Small is fine. With payment now open to every visitor on test keys, unpaid holds are more common than before, but two customers on the same saree within 15 minutes is still rare for this shop.

## Sm4. Signed in: "Add to bag" can lower a set's pieces (Small) — ✅ Correct

**Why:** `add()` works out the number from this browser's copy (`(had?.quantity || 0) + pieces`, `W/src/bag/store.js:236`) and sends it as "set to N" (`:242` → `PUT`). The server sets it (`B/src/services/shop/bag.service.js:130-132`, `Bag.update(had.id, { quantity: q })`). If this browser hasn't seen another phone's 2 pieces, adding 1 sets the saved number to 1.

**Group:** Small is right (needs the same set on two devices).

## Sm5. An older signed-in bag answer can land after a newer change (Small) — ⚠️ Partly correct

**What is right:** `applyAccount` has no "is this answer older?" guard and always replaces the list (`W/src/bag/store.js:172-180`); the "re-check after a newer change" at `:215` is for visitors only (`&& !isAccount()`).

**What is overstated:** the report's scenario ("a check already on its way when the customer changed something is applied after the change") does not normally cause a step back. Every `/me/bag` call takes the same per-customer database lock before reading (`B/src/models/bag.model.js:10`, `B/src/services/shop/bag.service.js:114-117`), and signed-in changes are not shown before the server answers (`store.js:242`, `:255`, `:267` all `await` the server). So if the GET got the lock first, its answer is sent before the change is even processed and is applied first; the change's answer lands last and wins. If the change got the lock first, the GET already reads the new bag. The old bag only comes back if the network delivers the two answers out of order. When that does happen, nothing re-checks by itself for a signed-in bag, so the old view stays until the next check or change (not just "for a moment"). The saved bag on the server is right either way.

**Group:** Small, very rare.

## Sm6. Recently viewed cards add with old price and stock (Small) — ✅ Correct

**Why:** `rememberSaree` saves `price` and `available` with no date (`W/src/data/recent.js:16`); the Recently viewed rails show those saved cards (`W/src/pages/bag/BagPage.jsx:63`, `W/src/pages/product/ProductPage.jsx:81`, `:269` via `CardRail` → `SareeCard`), and the card adds with them (`W/src/components/SareeCard.jsx:27`). An old price becomes `priceSeen`, so the check answers `priceWas` and "Price went up … since you added it" shows (`BagLine.jsx:40`).

**Small precision:** for a signed-in customer a saree that sold since is refused by the server (`SOLD_OUT`, `bag.service.js:127`) and shows the red "This saree has just sold out" strip instead of the bag note; the "Sold out: it sold since you added it" note applies to visitors. The finding is right either way.

**Group:** Small.

## Sm7. Send on WhatsApp works before the bag was ever checked (Small) — ✅ Correct

**Why:** a line with no check answer has state `unknown` and counts as buyable at the browser's saved price (`W/src/bag/useBag.js:13-16`, `:31`). The Send buttons only need `online` and pieces > 0 (`W/src/pages/bag/BagPage.jsx:95`, `W/src/components/BagPanel.jsx:61`, `:63`), and the message lists every buyable line (`W/src/bag/message.js:9`, `W/src/components/BagWhatsApp.jsx:16-18`).

**Group:** Small (the shop confirms by hand).

## Sm8. Sign-out at the same moment as a bag request can put the bag back (Small) — ✅ Correct

**Why:** `applyAccount` sets `owner: 'account'` and saves the items whatever the sign-in state is (`W/src/bag/store.js:172-180`). If `forgetAccount()` (`:352-359`) runs first and a bag answer that was authenticated before the sign-out arrives after it, the last customer's bag is shown and saved again. Then `refresh()` does nothing (`:203`: account bag, not signed in), so it stays until a reload (`startBag` → `onAuth` → `forgetAccount` at `:392`) or the next sign-in. Most likely when the sign-out comes from another tab, which ends this tab at once (`W/src/auth/session.js:165`).

**Group:** Small, very rare, as the report says.

## Sm9. A saree untouched for 60 days disappears with no message (Small) — ✅ Correct

**Why:** the clean-up deletes rows with `updatedAt` older than 60 days (`B/src/models/bag.model.js:56`, `B/src/config/constants.js:136`, run by `B/src/jobs/cleanup.job.js:27`). `GET /me/bag` doesn't change `updatedAt` (`readBag` only writes when stock is lower, `bag.service.js:108`). Also, the "price seen" update on every change is raw SQL (`bag.model.js:50-53`), which does not touch Prisma's `@updatedAt` (`prisma/schema.prisma:940`; no database default in the migration), so it is counted per saree, not per bag. The website just shows the server's list (`store.js:172-180`), no message. The 60 days is the design's choice (`docs/modules/web-03-cart.md:64`); the missing message is the point.

**Group:** Small.

## Sm10. After paying, the whole bag line goes (Small) — ✅ Correct

**Why:** on payment the server deletes the rows of every bought saree whole (`B/src/services/shop/checkout.service.js:519` `bagItem.deleteMany({ ... productId: { in: [...] } })`). During the hold the customer's own held pieces still count as theirs (`bag.model.js:26-33`), so another tab can raise a set above the paid number; those extra pieces are deleted too.

**Group:** Small, rare.

## Sm11. "Bags are joined" message only shows on the bag page (Small) — ✅ Correct

**Why:** the bag notice is drawn only in `W/src/pages/bag/BagPage.jsx:116`; the checkout page never shows `bag.notice` (its own `Notice` at `CheckoutPage.jsx:46-78` handles checkout notices only). Skipped visitor sarees are not in the account bag, so the checkout's "left out" line (`CheckoutPage.jsx:401`) doesn't mention them either.

**Small precision:** the notice is kept for the tab's visit (`W/src/bag/store.js:53-58`), so it does show if the customer opens `/bag` later in the same tab; "never" is true only for a customer who goes straight to Pay.

**Group:** Small.

## Sm12. Menu's "Bag" has no number (Small) — ✅ Correct

**Why:** `W/src/components/SideMenu.jsx:45` `link('/bag', 'Bag')` (no count); the design notes ask for it: `docs/modules/web-03-cart.md:152` "Menu: 'Bag' with the number."

**Group:** Small.

## Sm13. Old-website message can count wrong (Small) — ✅ Correct

**Why:** the notice uses `old.length` (`W/src/bag/store.js:373`), every valid old line read, while the bag keeps at most 20 lines after joining duplicates (`:101`, `:372`). A later check that drops dead links sends a "taken out" notice that replaces it (`:167`; one notice at a time, `:53-54`).

**Group:** Small.

## Sm14. Per-customer limit says "from this network" (Small) — ✅ Correct

**Why:** the limiter has one message for both kinds (`B/src/middlewares/rateLimit.js:26`), and the signed-in bag routes use the per-customer kind (`B/src/routes/shop/index.js:80-85`, `by: (req) => req.customer?.accountId`).

**Group:** Small.

## Sm15. Website limits hard-coded (Small) — ✅ Correct

**Why:** `W/src/bag/store.js:17-18` `MAX_LINES = 20`, `MAX_QUANTITY = 50`; the server sends `limits.bag` in `/config` (`B/src/services/shop/config.service.js:18`) and the website never reads it. Same numbers today (`B/src/config/constants.js:134-135`).

**Group:** Small.

## Sm16. Guessed link tells if a hidden saree exists (Small) — ✅ Correct

**Why:** `/bag/check` answers `not_found` for no saree (`B/src/services/shop/bag.service.js:89`) and `unavailable` for a hidden one (`:92`), with no other details.

**Group:** Small.

## Sm17. CORS doesn't list PUT (Small) — ✅ Correct

**Why:** `B/src/middlewares/shopGuard.js:26` `'GET, POST, PATCH, DELETE, OPTIONS'`, while the website sends `PUT` for the signed-in bag (`W/src/api/shop.js:17`). Today the website calls a same-address path (`W/src/api/client.js:8` defaults to `/api/v2/shop`; no other `VITE_API_BASE` setting outside `.env` files, which I did not open), so no preflight is needed and there is no effect now.

**Group:** Small.

## X1. (Dev note on M1) Empty guest bag + failed `GET /me/bag` — ✅ Correct

**Why:** with nothing in the browser, `joinAccount()` calls `shopApi.bag()` (`W/src/bag/store.js:332`); on failure `owner` stays `guest`. Later `refresh()` takes `!isAccount() && !state.items.length` (`:204-206`) and never loads the account's bag. After the error clears, checkout shows "Your bag is empty" (`CheckoutPage.jsx:233-238`) even if the account has sarees. Same root cause as M1.

## X2. (Dev note on Sm10) Payment delete and clean-up run without the bag lock — ✅ Correct

**Why:** `complete()` locks the order only (`checkout.service.js:462`) and deletes bag rows at `:519`; the clean-up job deletes with no lock (`bag.model.js:56`). `setItem` finds the row (`bag.service.js:128`) and then updates it by id (`:132`); if the row was deleted in between, Prisma throws "record not found" (P2025). Nothing maps P2025 (`B/src/middlewares/errorHandler.js:20-24` turns any unknown error into 500 `INTERNAL`). Very rare, as the report says.

## X3. (Checked-and-fine note) Rate-limit doc difference — ✅ Correct

**Why:** design notes say "Rate limit `shop-bag`, 120 a minute per network, on all six" (`docs/modules/web-03-cart.md:113`); the code uses `shop-bag` per network only for `/bag/check` (`B/src/routes/shop/index.js:54-55`) and `shop-my-bag` per customer for the five signed-in routes (`:80-85`). Doc only.

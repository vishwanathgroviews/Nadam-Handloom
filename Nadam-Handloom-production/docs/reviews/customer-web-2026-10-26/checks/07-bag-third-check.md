# Third check: Module 7, the bag (cart)

Date: 26 Oct 2026. Report: [`../07-bag.md`](../07-bag.md). Second check: [`07-bag-check.md`](07-bag-check.md).
I only read code. I did not run, test, build or change anything, did not use git or npm, did not open `.env`, and did not touch the live site or any database.
`W` = `Nadam-frontend/customer-web/`, `B` = `Nadam-backend/` (both under `Nadam-Handloom-production/`).

Live today: since 26 Oct ~13:55 IST all of this code is live, with checkout and online payment (Razorpay test keys) open to every visitor. So all three paths below can happen on the live site.

## Summary

| Finding | One-line title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| M1 (precision) | Join at sign-in fails once: what the checkout page shows | Pay stays grey "with no reason" until reload | ✅ Correct, but right after the failure checkout shows "We couldn't check your bag just now · Try again"; the silent grey Pay starts once Try again (or any later check) succeeds as a visitor check | **Second checker right** | **Must fix** |
| Sm5 | An older signed-in bag answer lands after a newer change | Can happen; the screen goes back "for a moment" until the next check | ⚠️ The server lock makes the old answer arrive first; only swapped network delivery shows the old bag, and then it stays until the next check or change | **Second checker right** | **Small** (very rare) |
| X2 (note on Sm10) | Payment's bag delete meets a bag change at the same instant: answer 500 | Can answer 500; very rare | ✅ Correct: nothing maps Prisma's "record not found", so it becomes 500 `INTERNAL`; very rare | **Second checker right** (it agrees with the first reviewer) | **Small** (very rare) |

**Counts: Second checker right 3 · First reviewer right 0 · Both partly right 0 · Neither right 0.**

---

## M1. Failed join at sign-in: what checkout shows (precision only)

**What really happens (usual path: visitor presses Checkout, signs in, comes back):**
1. Sign-in finishes: `signedIn(reply)` sets the status to signed in, and only then the page moves to `/checkout` (`W/src/pages/account/SignInPage.jsx:64` then `:68`; `W/src/auth/session.js:48`).
2. Setting the status runs the bag's listener at once, which starts the join (`W/src/bag/store.js:387-390` → `joinAccount()`, `:332` `shopApi.bagMerge(...)`). The bag is still marked visitor (`owner: 'guest'`).
3. The checkout page opens and asks for a check (`W/src/pages/checkout/CheckoutPage.jsx:134` `refreshBag()`); while the join is running, `refresh()` just waits for it (`store.js:202` `if (joining) return joining`).
4. The join fails (weak signal, 20-second time-out, server busy, rate limit). The only handling is `.catch((error) => set({ status: 'error', error }))` (`store.js:345`); `owner` stays `'guest'`.
5. Checkout now shows the red note **"We couldn't check your bag just now · Try again"** ("Prices and stock are checked before you pay.") (`CheckoutPage.jsx:380`, shown when `bag.status === 'error' && online`). Pay is grey because `bagReady` needs `bag.status === 'ready' && bag.owner === 'account'` (`:187`, `:319`).
6. **Try again** calls `refresh()` (`:380`), not the join. Because `isAccount()` is false (`store.js:183`), it sends a visitor check (`store.js:210` `shopApi.bagCheck(...)`), which succeeds; `applyCheck` sets `status: 'ready', error: null` (`store.js:166`). The red note goes away, `owner` is still `'guest'`, so Pay stays grey, now with no message at all.

**Extra points I found (they make the finding stronger, not weaker):**
- The red note also goes away **without** pressing Try again: any later visitor check clears it the same way. That includes adding a saree (`store.js:248`), opening the side panel (`W/src/components/BagPanel.jsx:24`), opening the bag page (`W/src/pages/bag/BagPage.jsx:87`), coming back to the tab after a minute (`store.js:403-404`), or leaving and re-opening checkout (`CheckoutPage.jsx:134`).
- If the customer signed in somewhere else (not from Checkout) and reaches checkout later, the checkout's own check when it opens (`CheckoutPage.jsx:134`) is already a visitor check. If it succeeds, the red note never shows on checkout: Pay is grey with no reason from the start.
- With an empty visitor bag (the second checker's X1), Try again leads to "Your bag is empty" (`store.js:204-206`, `CheckoutPage.jsx:233-238`) even if the account has sarees. Going offline and back does **not** retry the join here, because that retry needs sarees in the browser (`store.js:408`). So the report's "it retries by itself only if the phone went offline and came back" is true only when the browser bag has sarees.
- What fixes it: reloading the page, or signing out and in again (the join only runs when the status *changes* to signed in, `store.js:384`).

**Why the first reviewer was partly off:** "Pay stays grey with no reason" skips the first moment. In the usual path the customer first sees a red "couldn't check your bag · Try again" note. The finding itself is right: that note does not say what really went wrong, and its Try again cannot fix it. Pressing it only removes the last hint.

**Is the second checker right?** Yes. Its precision matches the code exactly, and its "(or any later check)" covers the other paths above. It kept the finding as ✅ and Must fix, which is right.

**Final:** if the bag join at sign-in fails once, the customer's bag stays a browser-only visitor bag while they are signed in. Checkout first shows "We couldn't check your bag just now · Try again", but Try again (or any later check) only re-checks the visitor bag, so the note goes and Pay stays grey with no reason until the page is reloaded. **Final group: Must fix** (a ready-to-pay customer is stuck, on the live site today).

---

## Sm5. An older signed-in bag answer lands after a newer change

**What really happens, step by step:**
- Browser: a check sends `GET /me/bag` (`W/src/bag/store.js:210`). The customer then presses − / + / Remove / Add, which sends `PUT` or `DELETE` (`store.js:242`, `:255`, `:267`). For a signed-in bag the screen does **not** change before the server answers: each of these `await`s the server, then calls `applyAccount`.
- Server: every `/me/bag` request opens a transaction and first takes the same per-customer lock (`B/src/services/shop/bag.service.js:114-117` `inTx` → `B/src/models/bag.model.js:10` `pg_advisory_xact_lock(hashtext('shop-bag:<account>'))`), held until the transaction ends. Before that, each request passes its own rate-limit and sign-in steps (`B/src/routes/shop/index.js:80-85`), so they may reach the lock in either order.
- **Case 1: the GET gets the lock first.** It reads the old bag, commits, and the controller sends the answer straight away (`B/src/controllers/shop/bag.controller.js:7-9`, `res.json(out)` right after the service). Only now can the change get the lock, and it still has about 8 to 10 database steps before it answers (`bag.service.js:123-136`: find saree, on-website, holds, find row, count, prices, update, then `readBag`). So the old answer leaves the server first and is applied first. It shows what was already on screen, so nothing visibly goes back. Then the change's answer arrives and wins.
- **Case 2: the change gets the lock first.** The GET waits, then reads the already-changed bag (each statement sees what was committed before it, the database's default mode). Both answers are new, so nothing goes back.
- **The only bad case:** the network delivers the two answers in swapped order (for example a lost packet on the GET's connection on a weak mobile line). Then `applyAccount` takes the old answer with no "is this older?" check (`store.js:172-180`). Nothing re-checks by itself for a signed-in bag (`store.js:215`, the follow-up check is `&& !isAccount()`, visitors only). The old view stays until the next check (bag page opened, side panel or tab return after a minute) or the next change.
- The saved bag in the account is right all the time. Checkout compares what the page shows with the saved bag and stops with `BAG_CHANGED` if they differ (`W/src/pages/checkout/CheckoutPage.jsx:256-257`), so no wrong charge.

**Why the first reviewer was partly off:** they saw only the browser side (no age guard for signed-in answers, unlike visitors) and did not follow the server lock and the order in which answers leave the server. So the scenario "a check already on its way when the customer changed something is applied after the change" does not normally happen. Also "for a moment" is wrong: when it does happen, the old view stays until the next check or change.

**Is the second checker right?** Yes, on every point: the guard is missing, the lock makes it rare, it needs swapped network delivery, the old view stays (not "a moment"), and the saved bag is right.

**Final:** the website has no "older answer" guard for a signed-in bag, but the server's per-customer lock makes the older answer arrive first. The old bag only comes back if the network swaps the two answers, and then it stays on screen until the next check or change, while the saved bag and payment stay right. **Final group: Small** (very rare).

---

## X2. Payment's bag delete meets a bag change at the same instant: answer 500

**What really happens:**
- When a payment succeeds, `complete()` locks the **order** only (`B/src/services/shop/checkout.service.js:462` `C.lockOrder`), not the customer's bag lock. Inside its transaction it deletes the bought sarees' bag rows (`:519` `tx.bagItem.deleteMany(...)`), then still ends other open checkouts (`:520-523`) before it commits. Its transaction uses the database's default mode; `TX` only sets time limits (`:36`).
- A bag change for the same customer (`setItem`, `B/src/services/shop/bag.service.js:122-137`) holds the bag lock, which the payment does not take, so the two can overlap. It finds the row (`:128` `Bag.find`), updates prices (`:131`), then updates the row **by id** (`:132` `Bag.update(had.id, …)`).
- If the change's "find" runs after the payment's delete but before the payment commits, it still sees the row (an uncommitted delete is invisible to others). Its update then waits for that row, and once the payment commits, the row is gone. Prisma throws "record to update not found" (P2025). Nothing maps it (`grep` finds no P2025 handling in `B/src`), so `B/src/middlewares/errorHandler.js:20-24` answers **500 `INTERNAL`** "Something went wrong on our side. Please try again." The website shows that in the red strip.
- The same can happen on the join's update (`bag.service.js:168`), Buy again (`:203`), and even a plain `GET /me/bag` when it lowers a line (`:108`). The 60-day clean-up job (`B/src/models/bag.model.js:56`) can hit it in the same way instead of the payment.
- The other order is harmless: if the change touches the row first, the payment's delete waits for it and then deletes the row. The change's answer still lists the bought saree until the next check.
- What is harmed: nothing is saved half-way (the change's whole transaction is undone). The order and money are untouched, and the next check shows the bag right. It needs the same account to change the very saree being paid for within a few milliseconds (another tab or phone), so it is very rare.
- Theory only (not proven, even rarer): with two or more bought sarees, the change and the payment could each wait for a row the other holds (a database deadlock), and the database then stops one of them. If it stops the payment step, the payment page's confirm call fails. But Razorpay's notice or the background check (unpaid requests are looked at again every 5 minutes for 2 hours, `B/src/models/checkout.model.js:65-73`) still finishes the order, or refunds it.

**Why the first reviewer was not wrong:** their note ("a `setItem` at the same instant can hit 'record not found' (`bag.service.js:132`) and answer 500 … very rare") is correct. They only named one caller. The window is also slightly wider than "find, then update", because it covers the rest of the payment's transaction. Neither point changes the size of the problem.

**Is the second checker right?** Yes: no lock shared with the bag, no P2025 mapping, 500 `INTERNAL`, very rare.

**Final:** a bag change made at the exact moment a payment of the same saree completes (or the clean-up job removes it) can answer 500 "Something went wrong"; nothing is lost and the next check is right. **Final group: Small** (very rare).

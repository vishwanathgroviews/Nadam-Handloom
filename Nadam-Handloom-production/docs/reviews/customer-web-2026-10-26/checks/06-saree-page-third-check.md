# Third check: Module 6, the saree page and the link preview

Date: 26 Oct 2026. Report: [`../06-saree-page.md`](../06-saree-page.md). Second check: [`06-saree-page-check.md`](06-saree-page-check.md).
I only read code and notes. I did not run, test, build or change any code, did not use git or npm, did not open `.env`, and did not touch the live site or any database.
`W` = `Nadam-frontend/customer-web/`, `B` = `Nadam-backend/` (both under `Nadam-Handloom-production/`). `old` = the old server's code in `Nadam-Handloom/backend/`.

Live today: since 26 Oct ~13:55 IST all of this code is live, including the saree link previews behind nginx, and checkout with Razorpay test payments open to every visitor.

About nginx: the deployment record only says the `/product/` block "falls back to index.html" (`docs/deployment/live-v2-server.md:101`). The exact lines are in the nginx file written for that go-live (`/private/tmp/claude-501/-Users-adusumillisrisumanthgmail-com-Documents-Nandam-Handlooms/02e37212-65dd-46e7-bafd-7d7518dc7d1b/scratchpad/nginx-live/site.new`, lines 43-75). These match the block described for this check. I did not read the live server itself.

## Summary

| Finding | One-line title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| M1 | A saree added while the sign-in is still being checked vanishes from the bag | Real, Must fix. Lost "straight away, or later when they open Checkout" | ⚠️ Real and the cause is right, but Should fix: needs a slow or failed check, one bag line, seen at Checkout. Checkout itself only waits | **Second checker right** (small correction: every bag change made in that time is undone, not just one line) | **Should fix** |
| Sm12 | The link-preview route answers with error text, not the page | Not sure (nginx unknown), Small | ❌ Wrong: nginx serves index.html whenever this route errors | **Both partly right**: nginx catches 400, 404, 500, 502, 503 and 504, but **not 429**. A visitor over the 240-a-minute limit gets raw JSON error text instead of the website | **Small** |
| Sm13 | A broken `%` code gives "Something went wrong" (500) | The visitor gets "Something went wrong" (500), Small | ⚠️ The server's 500 (and a false error in the log) is real, but the visitor gets the website and the correct "isn't on the website now" page | **Second checker right** | **Small** |
| Sm18 | No guard against a negative old stock count | Not sure. Would show in lists but "Sold out" on its page, Small | ⚠️ The missing guard is real, but no code can make stock negative today, and the card in lists would also say "Sold out" | **Second checker right** | **Small** (only from old data or a hand edit) |

**Counts: Second checker right 3 · First reviewer right 0 · Both partly right 1 · Neither right 0.**

---

## M1. A saree added while the sign-in is still being checked vanishes

**What really happens, step by step (a returning customer, signed in on an earlier visit):**
1. **When the check starts.** `main.jsx:26` calls `bootstrap()` before the page is drawn (`main.jsx:29`). The browser has the "was signed in" note, so it goes straight to `renew()` → `POST /auth/refresh` (`W/src/auth/session.js:98-106`, `:90-93`). That request leaves at about the moment React draws the first screen. The saree page's own code is loaded later (`W/src/App.jsx:23`, lazy), and its data later still: the request is made in an effect after that code has drawn (`W/src/data/shop.js:6`, `W/src/data/resource.js:37-38`). The customer can only tap Add after both of those, so normally the sign-in check finishes seconds before.
2. **How long "checking" can last.** The status starts as `unknown` (`session.js:17`) and stays so until the check answers.
   - Normal: one short request.
   - Weak signal: each try can wait 20 seconds (`W/src/api/client.js:10`). There are 3 tries, with 1 s and 3 s pauses (`session.js:103-104`), so up to about a minute.
   - All 3 tries fail for any reason other than "not signed in": no signal, time-out, a server restart (502), a server error, or "too many requests". `/auth/refresh` shares the `shop-auth` limit, 60 a minute per network by default (`B/src/routes/shop/index.js:37`, `B/src/config/env.js:58`). Then only `bootError` is set (`session.js:108-110`, `:80-85`) and the status stays `unknown` for the rest of that visit. Nothing tries again by itself. Only an account page's "Try again" (`W/src/auth/RequireAuth.jsx:20`), another tab signing in (`session.js:166`), a reload, or a signed-in call (`client.js:89`) starts a new check.
3. **The Add during that time.** `isAccount()` is false because the customer isn't "signed in" yet (`W/src/bag/store.js:182-183`). So the saree goes into the browser's copy only and is saved there (`store.js:243-247`). The check of the bag does nothing, "waiting for the sign-in" (`store.js:203`). The side panel opens with the saree (`store.js:250`). The customer sees "added".
4. **The exact moment it is lost.** When the status turns to signed in, the bag's listener runs the join (`store.js:387-390`). The browser bag is marked as the account's, so nothing from it is sent (`store.js:329`: `guest = owner === 'guest' ? items : []`). The website fetches the account's bag (`store.js:332`, `shopApi.bag()`), puts that list in place of the whole browser list, and saves it (`store.js:172-179`). Nothing was "joined", so no message is shown (`store.js:336`).
5. **What is lost:** every bag change made while the check was pending. Added sarees vanish, changed piece numbers go back, and removed sarees come back. If the check failed and the customer kept shopping, that can be several sarees, not one.

**Why the first reviewer went partly wrong:**
- The bug and its cause are exactly right.
- "Later when they open Checkout" is not quite right. Checkout does not start a check. While the status is `unknown` it shows only a loading dot (`W/src/pages/checkout/CheckoutPage.jsx:199`) and loads nothing (`:132`, `if (!signedIn) return;`). If the check is still running, the loss can happen while Checkout is open. If the check failed, Checkout is stuck on the dot (that is Module 1's M1) until a reload, and the reload's check then removes the sarees.
- Must fix is too high. It needs a slow or failed sign-in check at the moment the page opens. Nothing is paid, ordered or taken from stock. The customer sees the bag's list on Checkout before paying and can add the saree again. The same bug is already Should fix 1 (a) in the bag report (`../07-bag.md`), where it was checked ✅.

**Is the second checker right?** Yes, on the group, the timing ("sent before the page is even drawn") and the Checkout correction. One small slip: "only one bag line is lost" is too small. Every change made in that time is undone (step 5).

**Final:** a returning customer who adds, changes or removes sarees while the website is still checking (or failed to check) their sign-in loses those changes without a word as soon as the check succeeds. **Should fix.** Fix it once in `store.js` (see the bag report's fix: push those changes into `pending`, or wait for the check before choosing the path).

## Small 12. The link-preview route answers with error text, not the page

**What really happens:**
- The live `/product/` block in nginx has `proxy_intercept_errors on;` and `error_page 400 404 500 502 503 504 = @plain_page;` (`site.new:65-66`). `@plain_page` serves `index.html` (`site.new:71-75`). nginx only catches the codes in that list. Any other error code from the server is passed to the visitor as it is.
- Which errors the preview route can give:
  - Database trouble → 500 (`B/src/middlewares/errorHandler.js:20-24`): **caught**, plain page.
  - A broken `%` code like `%E0%A4` → 500 (see Small 13): **caught**.
  - Website page file missing → 503 `NO_WEBSITE_PAGE` (`B/src/services/shop/page.service.js:21-31`): **caught**.
  - The server down or slow → nginx's own 502 / 504 (`site.new:50-51`: 2 s to connect, 10 s to answer): **caught**.
  - A NUL code (`%00`) or a non-hex `%` code: nginx normally refuses these itself, before the server. No real link has them.
  - **More than 240 saree-link page loads in one minute from one network → 429 `RATE_LIMITED`** (`B/src/routes/shop/index.js:32`, `B/src/middlewares/rateLimit.js:26`): **not caught**. The visitor gets the server's JSON, `{"error":{"code":"RATE_LIMITED","message":"Too many requests from this network. Please wait a minute and try again.",...}}` (`errorHandler.js:26-27`), as plain text instead of the website, for up to a minute. A link preview fails the same way.
- The limit counts each visitor's own address (nginx sends it; `trust proxy` is 1 by default, `B/src/config/env.js:56`). Moving around inside the website doesn't count, only opening or reloading a `/product/` link. So for this shop it would take many phones behind one mobile-network address, or a bot. Rare.

**Why the first reviewer was partly wrong:** it could not see nginx and listed four causes. Three of them (database trouble, broken `%` code, hidden character) never reach a visitor, because nginx serves the plain page for them. It was right that the problem can happen, and its Small group and its fix (let the server, or nginx, fall back for every error) are right.

**Is the second checker right?** Partly. It is right about 400, 500 and 503. It is wrong that nginx falls back "whenever this route errors": the record's short note "falls back to index.html" hides that 429 is missing from the list.

**Final:** a visitor whose network opens more than 240 saree links in one minute gets raw error text instead of the website (and no link preview) for up to a minute, because nginx's fallback list leaves out 429. Fix: add `429` to that `error_page` line, or make the route answer the plain page on a 429. **Small.**

## Small 13. A broken `%` code gives "Something went wrong" (500)

**What really happens with `/product/abc%E0%A4`:**
- nginx passes it on to `/api/v2/shop/pages/product/abc%E0%A4`. Express cannot decode it and marks the error as 400 (`B/node_modules/router/lib/layer.js:219-233`, `err.status = 400`). The error handler does not know that error, logs it as `[error]` and answers 500 `INTERNAL` (`errorHandler.js:20-24`). nginx catches 500 (`site.new:66`) and serves the plain page. The visitor gets the website.
- In the browser, React Router cannot decode the path either, so it keeps the raw text `abc%E0%A4` as the slug (`W/node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs:847-856`, used at `:534`). The page encodes it before calling the server (`W/src/api/shop.js:11`, `enc(slug)`). The server receives the literal text `abc%E0%A4`, the slug rule refuses `%` (`B/src/validators/shop/catalog.validators.js:25`), and the answer is 400 `VALIDATION_FAILED` (`B/src/middlewares/validate.js:11`). The page shows "This saree isn't on the website now" (`W/src/pages/product/ProductPage.jsx:95-97`). That is the right result.
- So the 500 and "Something went wrong on our side" only come back to someone calling the server's address directly. The real harm is a false error line in the server log and a wrong status code.

**Why the first reviewer went partly wrong:** the server part is right. It did not follow the request through nginx and the website, where the visitor gets the correct not-found page.

**Is the second checker right?** Yes, every step matches the code.

**Final:** a hand-typed saree address with a broken `%` code makes the server answer 500 and log a false error, but the visitor still gets the website and the correct "isn't on the website now" page. **Small.**

## Small 18. No guard against a negative old stock count

**What really happens:**
- Stock on the website = old count + tagged pieces in stock, with no `Math.max(0, …)` (`B/src/services/shop/catalog.service.js:49`). The database has no rule against a negative count (the only CHECK rules in the migrations are on `BagItem`).
- Can it go negative? Not through today's code. On this server every decrease is guarded with `stock: { gte: n }` (`B/src/services/shop/checkout.service.js:185`, `:484`, `:497`), and every other write only adds (`B/src/services/sale.service.js:123`, `:501`; `B/src/services/order.service.js:290`; `checkout.service.js:71`). The old server is still on and uses the same database. It guards its decreases too (`old/src/modules/inventory/inventory.service.ts:116-117`, `:510-511`), and its admin forms never take a stock number from the app (`old/src/modules/catalog/catalog.admin.schema.ts:75-77`). So it could only come from old data or a hand edit of the database.
- If it ever happened (say stock −1 and one tagged piece): the saree is still in lists, because a piece is in stock (`B/src/services/shop/visibility.js:17`). But the card works out 0 and says "Sold out" (`W/src/components/SareeCard.jsx:19`), the page says "Sold out" (`catalog.service.js:324`), and the bag treats it as sold out (`B/src/services/shop/bag.service.js:31-35`). A real piece could not be sold online.

**Why the first reviewer went partly wrong:** the missing guard is real. But it said the saree would "show in lists" as if it were for sale there; the list card says "Sold out" too. It also didn't check whether any code can make the count negative (none can).

**Is the second checker right?** Yes, on both points.

**Final:** if an old or hand-edited record ever had a negative old stock count, a saree with a tagged piece in the shop would show as "Sold out" everywhere on the website and could not be bought online. No code can cause this today. The one-line guard is cheap. **Small.**

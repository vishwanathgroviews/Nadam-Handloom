# Website module W5: the bag (cart)

| | |
|---|---|
| **Status** | **Live since 16 Oct 2026, about 23:45 IST, on `https://nandamhandlooms.com`** (owner: "ok put it live"). The owner chose every recommendation (A) the same day. Record and undo: section 16 and `deployment/live-v2-server.md`. A signed-in bag on live (real SMS) is still for the owner to try. |
| **Where** | The website (`Nadam-frontend/customer-web`) and the server (`Nadam-backend`, `/api/v2/shop`) |
| **Users** | Everyone. Adding to the bag never needs a sign-in; a signed-in customer's bag is also kept in their account. |
| **Design** | Design C Utsav, as live. Mock-up: [`design/ui-mockup/web-5-bag/`](../design/ui-mockup/web-5-bag/index.html) |
| **Comes before** | W6 checkout and payment (address, Razorpay, holding the saree for 15 minutes), W7 My orders |
| **Plan of the whole website** | [`web-00-website-plan.md`](web-00-website-plan.md) |

## 1. Goal
A customer can collect the sarees they like in one place, see the total, change how many they want from a set, and come back to it later, on the same phone or (signed in) on another one. Every time the bag opens, it checks with the shop's live stock and prices, so nothing in it is ever out of date without saying so. Until online payment (W6) is ready, the whole bag can be sent to the shop on WhatsApp in one tap.

## 2. What is in this module
- **"Add to bag"** on the saree page (and in the sticky bar on phones). For a set: how many pieces (1 up to what is in stock).
- **The bag icon** in the header with the number of pieces, on every page; "Bag" in the full-screen menu.
- **After adding:** a side panel with the bag (or the choice in section 5.2).
- **The bag page** `/bag`: each saree with photo, name, **code**, price, how many, line total; remove (with Undo); the total; free delivery; "Send bag on WhatsApp"; "Checkout" once W6 is live.
- **Live checks:** sold out, fewer left, price changed, no longer on the website, all shown on the line and in one note at the top.
- **Kept safe:** in the browser for everyone; also in the account when signed in (another phone sees the same bag); brought together at sign-in; removed from the browser at sign-out.
- **The old website's bag** (saved in visitors' browsers before 16 Oct) is brought into the new bag once.
- Not in this module: address, payment and holding stock (W6), orders (W7), wishlist / "save for later", coupons and discounts, gift wrap, a delivery fee.

## 3. What the old website did (read from its code, `frontend/customer-web/src/context/CartContext.jsx`)
- The bag lived only in the browser (`localStorage` key `NANDAM_CART_V1`). No sign-in was needed to add sarees. A signed-in customer's bag did not follow them to another phone.
- **One line = one piece.** There was no quantity at all: a saree could be added once. (Sets came back on 15 Oct, so the new bag needs a quantity for them.)
- Each line kept the name, price, MRP, photo and stock **from when it was added**. Nothing was checked again until payment, so a sold or re-priced saree looked fine in the bag.
- **No delivery fee, ever** ("Nothing is added on top of the items"). The new server says the same (`Order.total` = the sum of the lines).
- Remove had no Undo. The empty bag said "Your cart is empty".
- The new website sends the old addresses `/cart` and `/checkout` to `/shop` today; W5 sends `/cart` to `/bag`.

## 4. Facts from the live data (copy of 16 Oct 2026)
| Fact | Number |
|---|---|
| Sarees on the website, in stock | **1,429** listings, **1,594** pieces |
| Sets (more than one identical piece) | **136**: 118 of 2, 9 of 3, 7 of 4, 2 of 5. Largest set today: **5** |
| Saree pages that open as "Sold out" | 152 |
| Website prices | ₹1,800 to ₹6,999, middle ₹2,900 (plus ₹25,888 for "Gap Border bramini sarees", to check) |
| How sarees are counted | Every saree has its own tag (one piece = one tag) |
| Sold at the store | About 2 to 16 pieces a day in the last 10 days (56 on 5 Oct) |
| Online orders on the old website, ever | 20: 1 delivered, 1 shipped, **18 never paid**. At most 3 sarees in one order; 1.6 on average |
| Names | A saree's name is its collection's name: 33 sarees are called "Pure Pattu 350k Butta Saree". **The bag must show the code and the photo on every line**, or two lines look the same |
| Prices | Set per collection (website price). Changing a collection's price changes every saree in it, including ones already in bags |

What this means: most sarees are one piece, and the store sells some every day, so "it sold while it was in your bag" will happen and must look calm and clear. Bags are small (1 to 3 sarees), and the old checkout lost 18 of 20 orders, so the bag should stay simple and lead straight to the next step.

## 5. Decisions for the owner (my recommendation first)
Layout choices (5.2 to 5.7) can be tried in the mock-up's **Design options** panel; each one has the same letter there. **Owner's decision (16 Oct 2026): A for all twelve.**

| # | Question | Options | Recommended |
|---|---|---|---|
| 5.1 | What do we call it? | **A "Bag"** (like the mock-up, Myntra, Nykaa, fashion houses) · B "Cart" (Amazon, Flipkart, the old site) | **A** |
| 5.2 | What happens after "Add to bag"? | **A side panel slides in with the bag** (keep shopping or view the bag) · B a short message at the bottom and the bag count jumps · C go straight to the bag page | **A** |
| 5.3 | The bag page's layout | **A two columns: sarees on the left, total on the right (stays in view)** · B one column with large photos, total at the end, a bar fixed at the bottom on phones · C compact rows (small photos, more on one screen) | **A** |
| 5.4 | Choosing how many from a set | **A − 1 + buttons** · B a drop-down list · C number buttons 1 2 3 4 5 | **A** |
| 5.5 | The bag in the header | **A bag icon with a small number** · B the word "Bag (2)" · C icon and the total amount | **A** |
| 5.6 | Saree page buttons (until W6) | **A "Add to bag" first, "Order on WhatsApp" under it** · B the two side by side · C "Add to bag" and "Buy now" (Buy now opens checkout: W6) | **A** |
| 5.7 | How problems show (sold, price changed) | **A a note on the saree's line, and one summary note at the top** · B problem sarees in their own group at the top ("Needs your attention") · C a pop-up when the bag opens | **A** |
| 5.8 | Until online payment (W6) is live | **A "Send bag on WhatsApp" is the main button** · B "Checkout (coming soon)" greyed, WhatsApp under it · C keep the bag hidden and put W5 live together with W6 | **A** |
| 5.9 | Keep the bag in the account for signed-in customers? | **A yes, so it follows them to another phone** · B no, only in the browser (like the old site) | **A** |
| 5.10 | At sign-out | **A remove the bag from this browser** (it stays in the account; a shared phone shows nothing) · B leave it in the browser | **A** |
| 5.11 | Bring back the old website's bags? | **A yes, once, quietly checked** · B no | **A** |
| 5.12 | Limits | **A up to 20 different sarees; a set up to what is in stock; kept 60 days after the last change** · B other numbers | **A** |

**Not a choice, the same as today:** delivery is free across India; MRP is never shown; adding to the bag does **not** hold the saree (only payment does, from W6), and the bag says so in one quiet line.

## 6. How it works (the rules)
1. **A line** is one saree listing and how many pieces. A single piece is always 1. A set is 1 up to the pieces in stock now.
2. **Adding the same saree again:** a single piece says "Already in your bag" (the button becomes "In your bag · View bag"); a set adds one more, up to the stock, then says "All 5 pieces are in your bag".
3. **The browser keeps** each saree's link name (slug), how many, the price shown when it was added, when, and the saree's name, code and photo address (to show a saree that has left the website). Nothing about the visitor (no name, phone or address).
4. **Checking:** when the bag page or side panel opens, after each change, and when the customer comes back to the tab after a minute or more, the website asks the server about every line. The server answers with today's name, code, photo, price, pieces in stock and a state for each line (section 7).
5. **Price:** the bag always uses **today's** website price. If it is not the price shown when the saree was added, the line says "Price changed from ₹2,600 to ₹2,800" (or "down from…") until the next change of the bag. W6 checks again at payment.
6. **Total** = the sum of (price × pieces) of the sarees that can be bought now. Sold-out and "no longer on the website" lines stay visible, greyed, **not** counted, with Remove and "Ask for a similar saree" (WhatsApp).
7. **Fewer left** (chose 4, now 2): the quantity is lowered to 2 by itself and the line says so. If the stock comes back, the bag never raises it by itself.
8. **Signed in:** every change is also saved in the account (one row per saree). Another phone or browser shows the same bag at its next check.
9. **Signing in with a bag in the browser:** the two bags are joined. The same saree on both: the larger number, capped by the stock (never the sum, so a bag isn't doubled). Then the browser uses the account's bag. A short message says what changed, from what the customer sees: sarees saved in the account that were added, sarees that now have more pieces, sarees that couldn't join (sold out, off the website, bag full). A brand-new customer whose bag simply moves into the account gets no message.
10. **Signing out** (here, everywhere, or the shop ending the sign-in): the bag is removed from this browser. It is still in the account.
11. **Account deleted:** the saved bag is deleted with the other personal details.
12. **Two tabs open:** a change in one shows in the other at once.
13. **The browser won't save** (private mode, storage blocked or full): the bag works for this visit only and says "Your browser isn't saving the bag. Sign in to keep it."
14. **The old website's bag** (`NANDAM_CART_V1`): read once, its sarees added (1 piece each), checked like any line, and the old key removed. Sarees that are gone show as sold out.
15. **"Send bag on WhatsApp":** opens WhatsApp with every saree that can be bought: name, code, pieces, price, line total, the total and "free delivery". Sold-out lines are left out. Afterwards the bag shows "Sent? Clear the bag" (the bag is not emptied by itself: the customer may not finish on WhatsApp).
16. **Removing:** at once, with "Removed · Undo" for a few seconds (no "Are you sure?" pop-up).

## 7. Every situation and what the customer sees

| Situation | What the customer sees | Total |
|---|---|---|
| All fine | The sarees, pieces, prices, total | counted |
| A single piece sold at the store | Line greyed: "Sold out. It sold at our store." Remove · Ask for a similar saree | not counted |
| A set has fewer left than chosen | "Only 2 left now. We changed it to 2." | counted at 2 |
| The whole set sold | As "sold out" | not counted |
| Price went up or down | "Price changed from ₹2,600 to ₹2,800" | today's price |
| Taken off the website (switched off, Store only, collection hidden, price fixed below ₹500, photo removed) | Greyed: "No longer on the website." Remove · Ask on WhatsApp | not counted |
| Saree deleted in the admin app | As "no longer on the website" | not counted |
| Saree link not found at all | Line removed by itself; one note "1 saree is no longer available and was taken out" | – |
| Moved to another collection | Its new collection name and price (as "price changed" when different) | today's price |
| 20 different sarees already | "Your bag is full (20 sarees). Remove one to add another." | – |
| Adding a single piece twice | "Already in your bag" + View bag | – |
| Adding more of a set than in stock | "All 5 pieces are in your bag" | – |
| No internet | The bag shows what was saved, with "You're offline. We'll check prices and stock when you're back." WhatsApp button off until checked | last known |
| The server can't answer | "We couldn't check your bag just now." Try again. The bag isn't changed | last known |
| The website is switched off by the shop | The maintenance page (as today); the bag stays in the browser | – |
| Empty bag | "Your bag is empty" with New in, Collections, Sets for the family | – |
| Bag from the old website found | "We brought back 2 sarees from your earlier visit." | checked |
| Signed in on another phone with a different bag | Joined at the next check (rule 9) | checked |
| Browser won't save | Note under the total (rule 13) | – |
| Very slow connection | The lines show at once from the browser, with a quiet "Checking…" line; numbers update when the answer comes | – |
| Someone sends a huge or broken bag to the server | The server refuses more than 20 lines, bad links or numbers, and limits how often one network can ask | – |

## 8. Server (built 16 Oct 2026; `/api/v2/shop`, MVC like the rest)
Files: `routes/shop/index.js`, `controllers/shop/bag.controller.js`, `services/shop/bag.service.js`, `models/bag.model.js`, `validators/shop/bag.validators.js`; limits `BAG` in `config/constants.js`. Rate limit `shop-bag`, 120 a minute per network, on all six. Every answer is `Cache-Control: no-store`.

| # | Endpoint | Sign-in | Body | What it does |
|---|---|---|---|---|
| 1 | `POST /bag/check` | no | `{ items: [{ slug, quantity, priceSeen? }] }` | Checks a visitor's bag. Keeps nothing |
| 2 | `GET /me/bag` | yes | – | The saved bag, checked. Fewer left than saved: the saved number is lowered (once) |
| 3 | `PUT /me/bag/items/:slug` | yes | `{ quantity, priceSeen? }` | Adds a saree or sets its pieces (capped by the stock; asked for more: that line says `fewer`) |
| 4 | `DELETE /me/bag/items/:slug` | yes | – | Removes one saree (already gone: fine) |
| 5 | `POST /me/bag/merge` | yes | `{ items: [...] }` | At sign-in: joins the browser's bag (rule 9); adds `joined: { added, raised, skipped }` |
| 6 | `DELETE /me/bag` | yes | – | Empties the bag |

- **Fields:** `slug` letters, digits and hyphens, at most 160; `quantity` a whole number 1 to 50; `priceSeen` rupees (a broken one is ignored); at most 20 items; the same saree twice becomes one line with the larger number.
- **Every answer:** `{ items: [line], totals: { lines, buyableLines, pieces, amount }, changes: { soldOut, unavailable, fewer, priceChanged, notFound }, maxLines: 20, checkedAt }`. A line: `{ slug, sku, name, collection: { id, name }, category: { slug, name }, craftName, photo: { url, alt }, price, priceWas, available, asked, quantity, lineTotal, state }`, state `ok`, `fewer`, `sold_out`, `unavailable` or `not_found`. Only `ok` and `fewer` lines count in the totals.
- **Not described to strangers:** in `/bag/check` a saree that is not on the website comes back only as `{ slug, state: 'unavailable', … }`, so a link guessed by someone shows nothing about a hidden saree; the browser shows the name and photo it kept. A signed-in bag can only hold sarees added while they were on the website, so `/me/bag` names them.
- **Rules kept by the server:** the same "on the website" rule as every list (`visibility.js`); one change at a time per customer (a database lock), so 20 sarees is exact even with two tabs; a change by the customer counts as having seen today's prices (the "price changed" notes go); PUT sets the number (the last change wins).
- **Errors** (`{ error: { code, message, details } }`): `VALIDATION_FAILED` 400, `NOT_SIGNED_IN` 401, `NOT_ON_WEBSITE` 404 ("This saree is no longer on the website."), `SOLD_OUT` 409 ("This saree has just sold out."), `BAG_FULL` 409 ("Your bag is full (20 sarees). Remove one to add another.", `details.maxLines`), `RATE_LIMITED` 429, and `MAINTENANCE` 503 when the shop has switched the website off.
- **`GET /config`** also sends `limits.bag: { maxLines: 20, maxQuantity: 50, keepDays: 60 }`.
- **Database (additive, migration `20261016180000_w5_bag_items`):** one new table, nothing else changes.

```prisma
model BagItem {
  id            String      @id @default(uuid())
  authAccountId String      // the customer (deleted with the account's personal details)
  productId     String      // the saree
  quantity      Int         // 1 to 50, also a database check
  priceSeen     Decimal     @db.Decimal(10, 2)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  @@unique([authAccountId, productId])
  @@index([updatedAt])
}
```
- **Clean-up:** the existing 15-minute job removes saved sarees unchanged for 60 days; `deleteCustomer` removes the bag with the account.
- **Tests:** `tests/api/shop/bag.test.js` (24): every state, totals, price notes, repeats, broken bags, sign-in needed, add/change/remove/empty, two customers apart, sold or hidden after adding, lowered once and never raised, 20 sarees with five added at the same moment (checked to fail without the lock), the database check, joining at sign-in (twice: nothing doubles; a full bag), account deletion, the 60-day clean-up, `/config`.

## 9. Website (built 16 Oct 2026)
- `src/bag/store.js`: the bag (browser storage `nh-bag-v1` with a memory fallback, the old bag `NANDAM_CART_V1` brought in once, checks, joining at sign-in, forgetting at sign-out, two tabs, Undo). `useBag.js` (what each line shows), `useBagActions.js` (changes with messages), `message.js` (the WhatsApp texts).
- `components/BagButton.jsx` (header: icon and number; opens the side panel), `BagPanel.jsx` (side panel), `BagWhatsApp.jsx` (the message before WhatsApp opens), `QtyStepper.jsx`; `pages/bag/BagPage.jsx` (`/bag`) and `BagLine.jsx`; `theme/bag.css`.
- Saree page: "Add to bag" (pieces for a set, "In your bag · View", "Add one more"), "Order on WhatsApp" under it, "Questions? Call", the hold note, the phone bar's "Add", and "Ordering and delivery" rewritten for the bag. Sold-out pages are as before.
- Menu: "Bag" with the number. `/cart` opens `/bag`; `robots.txt` keeps `/bag` out of search engines; the round WhatsApp button stays off the bag page.
- Tests: `src/bag/store.test.js` (21) and the browser test `e2e/w5.e2e.cjs` (section 14).

## 10. Privacy and safety
- A visitor's bag stays in their own browser; the server only sees it during a check and keeps nothing.
- A signed-in bag is only the sarees and numbers, tied to the account, deleted with it.
- The bag never shows the store price, MRP, staff names or tags' barcodes: only what the saree page shows.
- The WhatsApp message is made in the customer's browser and opened by them; nothing is sent by the website.

## 11. Steps
| Step | What | Status |
|---|---|---|
| 1 | Plan (this page) | **Done 16 Oct** |
| 2 | Clickable mock-up, every screen and state, design options | **Done 16 Oct** |
| 3 | Owner's picks | **Done 16 Oct: all A** |
| 4 | Server: endpoints, new table (local first), tests | **Done 16 Oct** |
| 5 | Website: bag, saree page, header, tests | **Done 16 Oct** |
| 6 | Check on a laptop and a phone locally; go live on the owner's go, backups first | **Live 16 Oct, about 23:45 IST** |
| 7 | Record here, in the website plan and the to-do list | Done 16 Oct |

## 12. The mock-up
`docs/design/ui-mockup/web-5-bag/`: open `index.html` (start page). Serve the folder with `python3 -m http.server 8765` in `docs/design/ui-mockup/` and go to `http://localhost:8765/web-5-bag/`. Real sarees, prices, codes and photos from the live data of 16 Oct; the customer "Priya" and every problem state are samples, marked as such. See the start page for every screen, the options and what is planned for later.

## 13. Later (not in W5)
- Wishlist / "Save for later" (the old website had a wishlist page).
- "Add to bag" straight from the saree cards in lists (risky on phones: easy to tap by mistake).
- In the admin app: what is sitting in customers' bags, to call or message them (needs the customer's permission first).
- A reminder for a bag left for a few days (web notification, only for customers who turned notifications on).

## 14. Built and tested (16 Oct 2026)
Owner: "we will go with the recommendation end to end completely precisely". Every decision A.

| Test | Result |
|---|---|
| Server, all tests (`npm test` in `Nadam-backend`) | 506 / 506 (24 new for the bag) |
| Website unit tests (`npm test`) | 64 / 64 (23 new: the bag store, the WhatsApp text) |
| Bag in a real browser (`npm run test:e2e:bag`, local copy of the live data) | Chrome 1440 light + 390 dark: 111 / 111; Safari's engine 390 light + 1440 dark: 111 / 111 |
| Earlier modules still pass (Chrome) | W1 sign-in 245 / 245; W2–W4 shop 379 / 379 (its saree-page checks updated for the new buttons, `/cart` → `/bag`) |
| Lint, production build | clean |

Found and fixed while testing: the Remove button sent the wrong thing (nothing was removed); the sign-in message counted from the server's side (a brand-new customer would have read "sarees from your account were added"), now told from what the customer sees; the one-time messages now last for the visit (a reload lost them); signing in again in one tab left "You're signed out" showing when another tab had done the joining.

Decisions made while building (all small, inside the owner's picks):
- The header's bag opens the side panel (on the bag page it goes back to the top).
- `/bag/check` doesn't describe a saree that isn't on the website (the browser shows what it kept), so a guessed link reveals nothing about hidden sarees.
- Setting pieces is "the last change wins" (two phones changing the same saree at once: the later one counts).
- Any change by the customer clears the "price changed" notes; fewer pieces left lowers the saved number once and never raises it again.

## 15. What the owner can try after it goes live
1. On a phone, open a saree and tap **Add to bag**: the side panel opens. Open a set and choose 2 pieces.
2. Open the bag (the bag icon at the top right): codes, pieces, total, free delivery.
3. **Send bag on WhatsApp**: the message shows first; WhatsApp opens with it.
4. Sign in: the bag stays. Sign out: it leaves this phone. Sign in again: it comes back.

## 16. Going live (done 16 Oct 2026, about 23:26–23:45 IST; full record in `deployment/live-v2-server.md`)
Done exactly as below: backups (live database 38 tables; server code with `.env`; website), 13 server files, the database update, restart, website copied (old files kept), checks from outside as a visitor in Chrome and Safari's engine (35 / 35 each). Live `BagItem` rows after the checks: 0.

One additive database update (`20261016180000_w5_bag_items`: a new table), no new packages, no `.env` change.
1. Backups: live database dump to `~/Documents/Nandam-Handlooms/db-backup-2026-10-DD-before-w5-live/`; on the server the code with its `.env` (`/home/ubuntu/nandam-v2-backend-before-w5-*.tgz`) and the website (`/home/ubuntu/nandam-web-dist-before-w5-*.tgz`).
2. Check first: `package-lock.json` the same on both sides; the new code loads with the live settings; the update is the only pending migration (`npx prisma migrate status`).
3. Server: rsync the changed files and the migration, `npx prisma migrate deploy`, `npx prisma generate`, `pm2 restart nandam-v2`. Check health, `/api/v2/shop/config` (`limits.bag`), `POST /api/v2/shop/bag/check` with a real saree, the old `/api/v1/app-config`.
4. Website: build on the Mac, copy `dist/` (no source maps) to `/var/www/nandam-web/dist`.
5. Check from outside, read-only: a visitor adds sarees, the side panel, the bag page, the WhatsApp message (not sent), `/cart` → `/bag`, laptop and phone, Chrome and Safari's engine. Nothing is written to the live database by these checks (a visitor's bag stays in the browser). Signed-in bags need a real SMS: for the owner.
6. **Undo:** website: unpack the website backup over `/var/www/nandam-web/dist`; server: unpack the code backup, `npx prisma generate`, `pm2 restart nandam-v2`. The new table can stay (nothing else uses it).


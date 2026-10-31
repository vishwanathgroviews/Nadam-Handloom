# Website modules W2–W4: Home, the shop lists and the saree page

| | |
|---|---|
| **Status** | **Live since 16 Oct 2026, about 11:40 IST, on `https://nandamhandlooms.com`**, with the rare-situation fixes (section 12). Built and tested the same day. Real-phone check by the owner still to do. |
| **Where** | The website (`Nadam-frontend/customer-web`) and the server (`Nadam-backend`, `/api/v2/shop`) |
| **Users** | Everyone (no sign-in needed). Ordering is on WhatsApp until the cart and payment modules (W5–W7). |
| **Design** | Design C Utsav, the approved mock-up ([`web-0-design/`](../design/ui-mockup/web-0-design/index.html)); saree card A; saree page B |
| **Plan of the whole website** | [`web-00-website-plan.md`](web-00-website-plan.md) |

## 1. Goal
A visitor lands on a home page that feels like a big fashion house, finds sarees by collection, craft, price or a search, and can order a saree they like straight away on WhatsApp. Everything shown is the shop's real stock, live from the admin app.

## 2. What is in these modules
- **W2, Home and the frame:** a two-second entrance (first visit of a session only), a full-screen opening with five photos, a statement, the collections grid, "New this week", a collection spotlight, five "edits", the craft story, the promise band, "More than one of a design" (sets), the store with address, hours, map, call and WhatsApp, and new-arrival alerts. Header with rotating messages, full-screen menu, search, footer with the store details.
- **W3, the shop:** All collections (`/collections`), a category (`/category/:slug`), one collection (`/category/:slug/:collectionId`) and every list (`/shop`, with search, craft, price, sets, category and collection filters, sort, grid size, chips for the chosen filters, "Load more", a filter drawer on phones).
- **W4 (lean), the saree page** (`/product/:slug`): large photos with zoom and a full-screen view, price, what is in stock, "Order on WhatsApp" (name, code, price and link filled in), call, highlights, details, delivery and care, share, sticky order bar on phones, "More from this collection", "You may also like", "Recently viewed", sold-out state.
- Not here: the bag, checkout and payment (W5–W7), MRP and discounts, reviews.

## 3. Decisions (16 Oct 2026, owner: "go with the recommendation")

| # | Decision |
|---|---|
| 3.1 | **Opening photos are fixed in the website's code** (the shop's own photos, resized to WebP and JPEG). Changing them is a small code change; an admin screen for them can come later. |
| 3.2 | **Edits are grouped automatically from collection names** (section 6). The owner checks the list once; a wrong group is a one-line fix. |
| 3.3 | **No email newsletter.** "Tell me about new arrivals" turns on a website notification (topic `arrivals`, W1's Firebase), with no sign-in needed. Where a browser can't do notifications, the button becomes "Get new arrivals on WhatsApp". |
| 3.4 | **MRP is never shown.** The admin app's MRP is a placeholder (₹16,999 on most collections). The website shows only the website price. |
| 3.5 | **Store hours, address and map** are the old website's real ones: #10-23, Opp. Brahmam Gari Temple, Hussain Katta, Old Mangalagiri, Guntur Dist, AP 522 503; Monday to Sunday, 9:30 am to 8:30 pm; WhatsApp 73829 68566; Google Maps link from the old site. Kept in the server's settings file (`STORE` in `constants.js`), sent with `/shop/config`. |
| 3.6 | **Ordering is on WhatsApp until the cart arrives.** The button opens WhatsApp with the saree's name, code, price and link. A sold-out saree asks for "a similar saree" instead. |
| 3.7 | **Search also understands crafts and the shop's spellings**: "kalamkari" finds the "kalankari" collections, "embroidered" finds embroidery, "print" finds digital and screen prints. |
| 3.8 | **Category banners use the website's own photos.** The admin app's category pictures are 400 px wide, too small for a full-width banner. |

## 4. When a saree is on the website (one rule, shared with the admin app)
A saree shows when **all** of these are true: switched on and not deleted; channel "Online only" or "Both"; its category and collection are active; the collection's website price is at least **₹500** (lower prices are typing mistakes, section 8); it has **a photo**; and it is **in stock** (stock above 0, or a tagged piece "in stock"). The same function (`services/shop/visibility.js`) gives the admin app its "On the website / Not on the website: …" line, so the two never disagree. A saree that sold out still opens by its link, marked "Sold out", but leaves every list.

**Pieces and sets:** available = stock + tagged pieces in stock. More than one available = a **set** ("Set of 3", "Sets only" filter, the family edit).

## 5. Pages and addresses

| Address | Page |
|---|---|
| `/` | Home; `/#craft` and `/#store` go to those sections |
| `/collections` | All collections by category, with craft chips (`?craft=embroidery`) |
| `/category/:slug` | Banner, its collections in a sliding row, then every saree in it with filters |
| `/category/:slug/:collectionId` | One collection's sarees ("Sets only", sort) |
| `/shop` | Every saree; `?q=` search, `craft=a,b`, `price=u25 / 25-35 / 35-50 / o50`, `sets=1`, `category=`, `collection=`, `sort=price-asc / price-desc` (newest by default), `page=2` (how many pages are loaded) |
| `/product/:slug` | The saree |
| Old website addresses | `/login`, `/register`, `/signup`, `/otp-verify`, `/mpin-setup`, `/forgot-password`, `/reset-password` → `/sign-in`; `/cart`, `/checkout`, `/products`, `/wishlist` → `/shop`; `/account/orders` → `/account` |

Filters live in the address, so a list can be shared and Back returns to it **at the same place** with the same sarees loaded. Unknown values in an address are ignored, never an error page.

## 6. Crafts and edits (owner to check)
A collection's craft comes from words in its name; the first group that matches wins (so "Middle Check hand painted" is Kalamkari, not Checks). Live data, 16 Oct:

| Craft | Collections |
|---|---|
| **Embroidery** (306 pieces, 12) | Gap border Embroidery sarees; 150 plain saree embroidery blouse; 100/50 border Chikankari Saree; Scallop Zute lines blouse embroidery; 50/50 border Embroidery sarees; Embossing scallop Embroidry blouse; Scallop Embroidry sarees; Embroidery Saree; 150/50 border Embroidry sarees; Scallop Zari Line Embroidery Blouse; Gap Border bramini Embroidry Saree; Scallop Bandini screenprint Embroidry blouse |
| **Applique** (144, 6) | Scallop Flower Bunch Applique Saree; 50/50 Flower Bunch Applique; Scallop Applique Saree; 50/50 Applique Saree; 150/50 border Applique Saree; Applique Top Applique Duppata Dress |
| **Digital Print** (173, 7) | 250/50, 150/50 and 50/50 Digital print; Gap Border Digital Print Saree; 250k Top Digital Duppata; Scallop Digital Print Saree; Full Digital Set Lehanga |
| **Screen & Block Print** (225, 9) | 50/50 dye Screen Printed Saree; 50/50 Border Baguru Printed Saree; 50/50 border bandini screen print sarees; 50/50 Embossing Screen Print Sarees; 150/50 screen printed sarees; 50/50 Middle Checks Screen Printed Saree; 50/50 Tanjore Screen Print Saree; 250k Baguru Printed Dress Material; 150/50 Screenprint dye sarees |
| **Kalamkari & Hand Painted** (208, 11) | Scallop Border Hand painted Saree; 50/50 silk kalankari sarees; Gap Border Mangalagiri Kalamkari Dress Material; Scallop border Tanjore Saree, Tanjore Blouse; 250k Tanjore Sticker Saree; 50/50 middle checks Kalamkari Patchwork Saree; 50/50 Middle Check hand painted sarees; Real Tanjore Painted Dress Material; Real Tanjore painting sarees; Gap border silk kalankari patch sarees; Gap border hand painted sarees |
| **Bandhani & Shibori** (72, 3) | Real Bandini Shibori Hardweaving Saree; 150 Border Real Bandini & Ajrakh; Shibori and real bandini lehanga type sarees |
| **Checks** (47, 2) | Rainbow checks sarees; Kanchi Border Triple Check Saree |
| **Pure Pattu & Plain** (194, 8) | 300k border Plain Saree; 150/50 border Plain Saree; Pure Pattu 350k and 250k Butta Saree; 50/50 Plain Saree; 350k Butta Saree; 250k border Butta Saree; 300 border hardweaving Buta sarees |
| **No craft** (only in "All" and their category) | Gap Border bramini sarees; 150/50 Ikkath Flower Bunch Saree; 50/50 Zute Line Saree; Scallop Kollam & Design Printed Saree |

**Edits on the home page:** The wedding edit = Pure Pattu & Plain · The festive edit = Kalamkari · Embroidered pastels = Embroidery + Applique · Everyday Mangalagiri = Checks + Digital + Screen + Bandhani · Buy for the family = every set.

**Spotlight:** the largest "pure pattu" collection (now Pure Pattu 350k Butta Saree, 33 pieces).

## 7. Server (`/api/v2/shop`, no sign-in)

| Call | Gives |
|---|---|
| `GET /home` | totals, categories, crafts, edits, 12 newest, the spotlight (collection + 3 sarees), 10 sets, the store |
| `GET /catalog` | categories, collections (craft, price band, counts, picture), crafts, price bands (menu, footer, filters) |
| `GET /products?…` | 24 sarees a page (max 48), total, next page, and the counts beside every filter option (each group's counts allow for the other groups' choices) |
| `GET /products/:slug` | the saree (photos, highlights read from the collection's notes, details), 12 more from the collection, 10 similar; 404 if not on the website |
| `GET /config` | now also `store` |

- The summary behind these (counts, sets, crafts) is built once a minute, in memory, one build at a time. Replies say `Cache-Control: public, max-age=60`; nothing personal is in them.
- 240 calls a minute per network for browsing (`shop-browse`).
- No database change and no new packages in W2–W4.

## 8. Data the owner should fix in the admin app (16 Oct)

| What | Where | Effect now |
|---|---|---|
| Website price **₹8** | Plain saree bunch Embroidry (38 sarees) | Hidden (price below ₹500) |
| Website price **₹9** | 50/50 Middle Checks Sarees (37) | Hidden |
| Website price **₹55** | 50/50 checks sarees (19) | Hidden |
| Website price **₹2** | 150 checks embroidery (18) | Hidden |
| Website price **₹10** | Test1 (2): a test collection; switch it off | Hidden |
| Website price **₹200** | 50/50 Plain Dress Materials (1) | Hidden |
| Website price **₹25,888**: please check | Gap Border bramini sarees (27) | **Shown**; much higher than similar collections |
| No photo | 6 sarees set to Online / Both | Hidden until a photo is added |
| Spellings in names | "Embroidry", "kalankari", "Zute", "Duppata" | Shown as typed (search still finds them) |

The admin app's product screen says the same for each saree ("Not on the website: its website price (₹9) looks wrong…", "…it needs a photo").

## 9. Tests (16 Oct)
- **Server:** 444 tests in 40 files, all passing (`tests/unit/shopCatalog.test.js`: the craft rules); `tests/api/shop/catalog.test.js` covers the rule in section 4, every filter and count, sort, pages, search (name, code, collection, craft and the shop's spellings), junk in the address, caching headers, home, catalogue, the saree page (on sale, sold out, hidden, store-only, no photo, wrong price, missing).
- **Website:** 36 unit tests (filters in the address, craft words, card labels, plus W1's).
- **Real browsers** (`npm run test:e2e:shop`, `e2e/w2.e2e.cjs`, read-only, real catalogue): Chrome 379 checks at 1440 and 390 wide, light and dark, plus "reduce motion"; Safari's engine 184. Against the production build with the live security policy: all pass. W1's test (`npm run test:e2e`) still passes: Chrome 245, Safari's engine 122.
- **Speed** (phone on slow 4G, processor 4× slower, production build): first paint about 1.2–1.4 s; largest paint 3.5 s on Home, about 4 s elsewhere (the first saree photo); layout shift 0.00–0.02 (good is below 0.1). Saree photos are already small (about 60 KB, 721 × 960).
- **Found and fixed while testing:** the announcement bar showed nothing; the search icon was invisible over the opening photo; cards stayed invisible after changing a filter when the count didn't change; Back sometimes lost the place in a list; a new page could glide up from the old position instead of starting at the top; the phone order bar missed fast scrolls; loading pages made the footer jump; Safari reported a cancelled page download as an error; the preview's security policy blocked the shop's photos; craft rules missed "Triple Check" and "Buta"; repeated names on cards; small phone layout issues (chips, tiles, badges, toolbar).

## 10. How to try it locally
Server on the live copy (`nandam_live_20261016`) on port 4300 and the website on 5180, as in the W1 e2e README; or the production build with `npm run build && NH_WEB_PORT=5181 npm run preview`. Then `npm run test:e2e:shop` (set `NH_WEB` for the preview, `NH_E2E_DB` for another local copy).

## 11. Going live (done 16 Oct 2026; record and undo in `deployment/live-v2-server.md`)
Same method as W1 ([`../deployment/live-v2-server.md`](../deployment/live-v2-server.md)):
1. **Backups:** the live database to the Mac (owner-only folder); on the server the code (`tar` of `/var/www/nandam-v2/backend` with its `.env`) and the current website files (`/var/www/nandam-web/dist`).
2. **Server code:** rsync `Nadam-backend` (no new packages, no schema change, no `.env` change), `pm2 restart nandam-v2`, then `/api/v2/health`, `/api/v2/shop/home`, `/catalog`, `/products` and one saree answer 200. With the section 12 fixes: customers already signed in stay signed in (their cookie is found under the older hash and moves over at the next renewal); the admin app gets the same input cleaning and per-network limits.
3. **Website:** build on the Mac and copy `dist` (without source maps) to `/var/www/nandam-web/dist`.
4. **Security policy:** confirm `/etc/nginx/snippets/nandam-web-headers.conf` allows the photo bucket in `img-src` (`https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com`); otherwise no saree photo would show.
5. **Checks from outside:** every page type on phone and laptop, both themes, no console or security-policy errors, old `/api/v1/app-config` and the admin app untouched.
6. **Undo:** put the previous `dist` back (a minute); the server code from the tarball and `pm2 restart nandam-v2`.

## 12. Rare situations (check of 16 Oct 2026, fixed the same day)
Five reviewers read every API and its tests for situations the tests didn't reach; I checked the main findings myself. For the website (W1–W4) every finding was fixed, each with a test (`tests/api/shop/edge-cases.test.js`, `tests/unit/shop.test.js`, `customer-web/src/pages/account/SignInPage.test.jsx`). **No database change.**

| Situation | Before | Now |
|---|---|---|
| A hidden character (NUL, from a shared link like `?utm_source=%00`) in a search, sign-up or address | Error page (the database refuses it); a bad link could block sign-up in that browser for 30 days | Control and invisible characters are removed before any check (`utils/text.js`, in `validate`), for the admin app too; the database refusing a character gives "Some text has a character we can't save" instead of an error page |
| Many "Send code" requests at the same moment, or from ~25 networks | The limits were read, then the code sent, then counted: bursts got through; the 500-a-day limit could be used up and block sign-in for **every** customer for a day | Limits are checked and the code's row reserved in one locked step; the daily limit counts only numbers with no account, so returning customers always get their code; codes paused → WhatsApp is offered |
| Customers on Airtel / Vi sharing one IPv4 address | 20 codes an hour per address could block real customers on a busy day | 60 an hour per IPv4 address; IPv6 counted per /64 block (one home or phone), 20 an hour |
| Guessing a code with many requests at once | Each request checked the code before counting the try: dozens of guesses per code | The try is counted before the code is checked (one database step); the SMS service failing doesn't use up a try |
| The SMS service says a code was "already verified" (its earlier reply was lost) | Counted as a wrong try | The code closes: "This code was already used. Get a new code." |
| "Sign out" or "Sign out of all devices" landing while a browser renews its sign-in | The renewal could create a new sign-in after the sign-out | Renewals and sign-outs take turns per customer; a renewal never brings back a signed-out browser |
| A copied website cookie used on the **old** server's renewal (`/api/v1/auth/refresh`) | The old server found it (same hash) and could keep it alive, or sign out the admin app | The cookie is stored under the website's own hash; the old server can't find it. Sign-ins from before the change still work and move over at their next renewal |
| A small photo file that is a huge picture (a "pixel bomb"), or another format named as JPEG | Opened in full: could fill the server's memory | The real type and size are read from the header first: JPEG up to 100 MP, PNG/WebP up to 25 MP, else a plain message |
| An email already on someone else's account | "Use a different one", no way out for the real owner | The message and a link offer WhatsApp help, with the email filled in |
| An order placed during the 7 days of "Delete my account" | The account was emptied anyway (delivery details gone) | Deletion waits until it is delivered; My account says "waiting to be deleted" |
| Turning on new-arrival alerts while not signed in, on a browser linked to a customer | Unlinked the customer and dropped their order updates | The link and its topics stay |
| The "Complete your profile" step used again later (shared computer) | Started more 30-day sign-ins, could change name and email | Used once: a second tap or retry within 60 s signs in without changes; later it is refused ("You have already signed up") |
| A closed account that still has a staff role (closed in the old app) | Opening it from the website would also give back the staff app | Refused, with WhatsApp help |
| Requests at the same moment past a per-network limit (every route) | Could all pass | Counted one at a time per network: exactly the limit passes |

Also found and fixed in the tests while re-running them: Safari reported requests cut off by a page reload as page errors (the W1 test now waits for requests to finish); the test database has 22 sample photos pointing to an old local address (now ignored by address).

**Admin app findings** (sign-in, tags, invoices, dashboards) are listed in the to-do list (section 4d); not part of this website work.

**Tests after the fixes (16 Oct):** server 468 (24 new), website 41 (5 new), Chrome W1 245, Safari's engine W1 122 (three clean runs), W2 on the production build: Chrome 379, Safari's engine 184. Against the live site after going live: Chrome 376 (4 rounds), Safari's engine 184, sign-in check 12. The live run found two more things, fixed and redeployed the same morning: "Visit the store" from the menu could land short on a slow connection (the page above was still loading; the section is now kept in place for a few seconds unless the visitor scrolls), and "Our craft" could stop short on a phone (the glide now finishes the move). The test's Back check now clicks like a person (Playwright's own click scrolls first).

## 13. Later
- The bag, checkout and online payment (W5–W7); then "Order on WhatsApp" can stay as a second button.
- An admin screen for the opening photos and the spotlight.
- `sitemap.xml` with every saree (search engines already get titles, descriptions and Product / Store data on each page).
- Owner's real-phone check of the new pages; the owner confirms the craft list (section 6) and fixes the data (section 8).

## 14. Change 23 Oct 2026: "Share" on a saree page without the shop name (client's request)
Same request as the catalogue PDF (module-03 section 17). The saree page's **Share** button sent "Pure Pattu 350k Butta Saree, ₹5,800 at Nandam Handlooms" + the link; it now sends "Pure Pattu 350k Butta Saree, ₹5,800" + the link (title: the saree's name). The link itself is the website's address, so a WhatsApp preview still shows the site's own name and page title: that is the website, not the message.
- Code: `src/pages/product/ProductPage.jsx` `share()`. Test: `e2e/w2.e2e.cjs` presses Share and checks the text (190/190, phone light + desktop dark); unit tests 138/138, lint clean.
- Not changed (go to the shop, not to a customer): the "Order on WhatsApp" / bag / order messages that start "Hello Nandam Handlooms, …".
- **Live 23 Oct 2026 ~18:40 IST** by editing the one live file in place (the local code also holds W6/W7, which are not live, so no full rebuild): record and undo in `deployment/live-v2-server.md`. Visitors whose browser already kept the old file may see the old text until it drops it; the full rebuild at W6/W7 go-live brings everyone the new one.

## 15. Change 26 Oct 2026: the client's design built into the website (local only, NOT live)
The client picked the "products first" home page (web-9 option A) with all 6 categories and "Latest collections", and the flow categories → collections → sarees (mock-up `design/ui-mockup/web-10-category-pages/`, every choice A). The user: "the lower footer with the shop's details only on the home page"; other pages get one line of links (Shipping, Cancellation and refunds, Contact us, Privacy, Terms: Razorpay needs them reachable).

**Server (additive, `src/services/shop/catalog.service.js`):** `GET /shop/catalog` now also sends
- `soon`: active categories with nothing on the website yet ("Coming soon"): `{ slug, name, description, image, upcoming }`, `upcoming` = the names of their active collections, never one made only for trying the app (`/^test\d|^test\b/i`, e.g. "Test1");
- on each collection `newest` (when its newest saree came in) and `hasNew` (that was in the last `NEW_DAYS`);
- `totals.newSarees`.
`categories` is unchanged (only those with sarees), so the live website keeps working if the server goes first. Tests: `tests/api/shop/catalog.test.js` (2 new); server 610/610.

**Website:**
- Look: white, soft corners, plain-case buttons, smaller Bodoni titles (`theme/tokens.css`, `base.css`); the opening slides, the entrance, the full-screen menu, the search pop-up and the moving pointer label are gone (`HeroCarousel`, `Intro`, `FullMenu`, `SearchOverlay`, `Cursor` removed).
- Header on every page (`Header.jsx`): the promise strip, logo, search bar with suggestions (`SearchBox.jsx`: crafts, collections, the first sarees; arrows and Escape), Sign in or the account, Bag; the menu bar (All sarees, the 6 categories by short name, New in, Sets), with a menu per category on computers (its biggest collections, its crafts, a photo); phones get `SideMenu.jsx`.
- Home (`HomePage.jsx`): the 6 categories as round photos (pattu sarees and dress materials use the website's photos, the others the shop's; "Coming soon" under the two without sarees) and the crafts; Latest collections (the 10 collections with the newest sarees, "New" on those from the last 10 days, "N new sarees" → New in); every saree with filters, sort and Load more; the new-arrival alerts; then the footer.
- Category (`CategoryPage.jsx`): a slim banner, "Choose a collection · N collections", every collection as a photo (most pieces first). A "soon" category: what's on the way, Ask on WhatsApp, the other categories.
- Collection (`CollectionPage.jsx`): name, pieces, price; toolbar with Sets only, count, sort, grid size (3 or 4, remembered); Load more.
- Lists (`ShopList.jsx`): the "listing" layout (title, count, sort, filters on the left; on phones a bar at the bottom opens Filter and Sort as sheets) and the "collection" layout. Category names in the filters are the short ones.
- Saree card (`SareeCard.jsx`): photo, label, name, price and code, **Add to bag** (one piece; "In your bag" opens the bag).
- `ScrollManager`: a section link (#store) stops below the sticky header.
- `data/categories.js`: short names, photos, the 6 categories in order (with sarees first, most pieces first; then coming soon).

**Checked (26 Oct, Mac):** lint clean; website unit 143/143; browser tests Chrome / Safari's engine: W1 sign-in 243 / 121, W2 shop (rewritten for this design) 581 / 287, W5 bag 115 / 115, W6 checkout 147 / 147, W7 My orders 144 / 144; the built site under the live security policy: W2 290 (Chrome) / 287 (WebKit).

**Going live:** the website can't be rebuilt from this code without W6 (checkout and online payment) and W7 (My orders), the new number 7382388565 and the WhatsApp photo previews, which are all in it. Needs the owner's go for all of them together. Server: rsync + `pm2 restart nandam-v2` (no database change). Backup of the code before this change: `~/Documents/Nandam-Handlooms/backups/code-2026-10-26-before-shop-design/` (website and server).

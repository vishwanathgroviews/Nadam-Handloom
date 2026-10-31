# Review 6: The saree page

Date: 26 Oct 2026. Read-only review of the code in `Nadam-Handloom-production` on this Mac. Nothing was run, built or opened in a browser. Line numbers are from today's code.

## 1. What this module does

The saree page shows one saree: its photos, name, code, price, how many are in stock, and buttons to add it to the bag or order it on WhatsApp. It also makes the small preview (photo, name, price) that WhatsApp and Facebook show when someone shares a saree link.

## 2. What a customer sees and does

1. Opens a saree link (from WhatsApp, a list or a search). While it loads, grey boxes show.
2. Sees the photos. On a computer, the mouse over a photo zooms in, and a click opens it full screen. On a phone, a tap opens it full screen and a swipe goes to the next one. Arrow keys and Escape work too.
3. Reads the collection (or the category, when the saree has the same name as its collection), the saree's name, its code, its craft, and a "New" badge if it came in during the last 10 days.
4. Sees the website price, never the MRP, with "Free delivery across India".
5. Sees one stock line: "Only one piece: once it sells, this design is gone", or "3 identical pieces in stock: a set for the family", or "Sold out".
6. For a set: chooses how many pieces with − and +. It never goes above what is left after what is already in the bag.
7. Taps **Add to bag**. The bag panel slides in. The button then says "In your bag · View", or "Add one more to bag" for a set.
8. Or taps **Order on WhatsApp**. WhatsApp opens to the shop's number with the name, code, price and link typed in.
9. Can call the shop, read the highlights, "About this saree", "Ordering and delivery" and "Care".
10. **Share** sends the name, price and link, without the shop's name. If the phone can't share, the link is copied.
11. On a phone, once the buttons scroll off the top, a bar at the bottom keeps the photo, name, price and an Add button.
12. Further down: "More from this collection", "You may also like" (same craft, other collections) and "Recently viewed" (remembered by this browser).
13. A sold-out saree shows "Sold out", "Ask for a similar saree" (WhatsApp) and "More from this collection".
14. A saree that is not on the website shows "This saree isn't on the website now", with links to all sarees and the home page.

## 3. Each API

(An API is a request the website sends to the server, and the server's answer.)

### 3.1 GET `/api/v2/shop/products/:slug`: the saree's details

| | |
|---|---|
| **What it is for** | Everything the saree page shows. |
| **What goes in** | The saree's web-address name, called the "slug" (for example `rainbow-checks-sarees-3`). Letters, numbers and dashes only, 1 to 160 characters. Spaces at the ends are trimmed. No sign-in is needed. |
| **How the server decides** | It finds the saree by its slug. Then it checks the "on the website" rule, leaving stock out: switched on, not deleted, set to "Online only" or "Both", its category and collection are active, the collection's website price is at least ₹500, and it has at least one photo. If any check fails, the saree is "not found". **Stock** = the old stock count + the tagged pieces that are "in stock". If that is 0, the page still opens, marked "Sold out". |
| **What comes back** | **product**: slug, code (`sku`), name (tidied: "MANGALAGIRI PATTU" becomes "Mangalagiri Pattu"), collection (id and name), category (slug and name), craft and craft name (worked out from words in the collection's name), price (the collection's website price, in whole rupees), `available` (pieces in stock), `soldOut`, the first photo, every photo in order (with a description for blind visitors), `isNew` (added in the last 10 days), when it was added, a description, highlights, and details (Technique, Border, Purity, Zari, Blouse, Pattern, Colour, Fabric, Occasion: only the ones the shop filled in). The **description** and **highlights** come from the collection's notes: short lines become highlights, and a paragraph becomes the description (about 240 characters, no emoji). If there is none, the category's text is used. **more**: up to 12 other in-stock sarees from the same collection, newest first. **similar**: up to 10 in-stock sarees of the same craft from other collections, newest first. |
| **What is saved** | Nothing about the saree. One row per request in the "too many requests" counter (the RateLimitHit table). |
| **Store price, MRP, staff data** | Never sent. |

| What can go wrong | Server answer | What the customer sees |
|---|---|---|
| The address has other characters or is too long | 400 `VALIDATION_FAILED` "This saree was not found." | "This saree isn't on the website now" page |
| No such saree, or hidden, store only, switched off, deleted, no photo, price under ₹500 | 404 `PRODUCT_NOT_FOUND` "This saree is not on the website." | The same not-found page |
| More than 240 requests a minute from one network | 429 `RATE_LIMITED` | "We couldn't load this saree. Please check your connection and try again." with Try again (the wrong reason; see Small 3) |
| The owner switched the website off | 503 `MAINTENANCE` | The website's "being updated" screen |
| Server or database trouble | 500 `INTERNAL` | "We couldn't load this saree…" with Try again |
| No internet, or no answer in 20 seconds | none | The same message with Try again |

The answer is labelled "may be kept for 60 seconds", but the website always asks for a fresh copy (`client.js:60`). The website reuses its own copy for 60 seconds when you come back to the same saree, then fetches it again in the background (`resource.js:5`).

### 3.2 GET `/api/v2/shop/pages/product/:slug`: the link preview

| | |
|---|---|
| **What it is for** | WhatsApp, Facebook and iMessage read only the top part of a page (the "head") and don't run the website's code. nginx (the web server in front) sends every visit to `/product/<slug>` here. The server sends back the website's own page with this saree's details in the head. |
| **What goes in** | The slug. There is only a length check (200 characters at most), no character check. No sign-in. It works even when the website is switched off. |
| **What goes into the head** | Title "<name> · Nandam Handlooms"; description "<name> (<code>), ₹<price>."; type "product"; preview title = the name; preview text "₹<price> · Code <code>", plus " · Sold out" when sold out; the link `https://<site>/product/<slug>`; the first photo and its description. The rest of the page (site name, scripts, body) is left exactly as built. |
| **Safety** | `& < > " '` in a name are turned into harmless codes, so a name like `<script>` shows as plain text and can't run. The site address used is only one of the shop's own addresses, never one sent by a stranger. |
| **Caching** | "no-cache" (browsers check again each time). The server reads the website's page file once and reads it again whenever the file changes. |
| **Saree missing or not on the website** | The plain page (the general title and loom photo), status 200. |
| **Page file not set or unreadable** | 503 `NO_WEBSITE_PAGE`. nginx is meant to serve the plain page itself in that case. nginx's settings are not in the code, so I could not check this. |
| **What is saved** | One row per request in the "too many requests" counter. |
| **Other errors** | 429 (more than 240 a minute from one network), 500 (database trouble, or a broken `%` code in the link), 400 `BAD_TEXT` (a hidden NUL character in the link). These come back as a short error text, not a page (see Small 12). |

### 3.3 Other requests this page uses (they belong to other modules)

- **GET `/config`**: the shop's WhatsApp number (917382388565) and call number. The website has both built in, in case this fails.
- **Add to bag, signed in**: PUT `/me/bag/items/:slug`. The server checks the saree is on the website (`NOT_ON_WEBSITE` "This saree is no longer on the website."), in stock (`SOLD_OUT` "This saree has just sold out.") and that the bag has fewer than 20 sarees (`BAG_FULL`). It saves at most what is in stock.
- **Add to bag, visitor**: saved in this browser only, then checked with POST `/bag/check`.

## 4. The data kept

### Product (one saree listing)

| Field | What it means | Must have it? |
|---|---|---|
| id | The saree's internal number (made automatically) | Yes |
| slug | Its web-address name, for example `rainbow-checks-sarees-3`. No two are the same. | Yes |
| sku | The code customers see (for example `NH-PPS-012`). No two are the same. | Yes |
| name | Its name (copied from its collection's name; it changes when the collection is renamed) | Yes |
| categoryId | Which category it is in | Yes |
| subcategoryId | Which collection it is in (price and notes come from here) | Yes |
| technique, borderStyle, purity, zariTier, blouseType, pattern, color, fabric | Free-text details shown under "About this saree" | No |
| occasion | A list of occasions; starts empty | No (empty list) |
| channelVisibility | Where it sells: online only, store only, both, hidden. Starts as "both". The website needs "online only" or "both". | Yes (default "both") |
| trackingMode | How the staff app lists it (a count or tagged pieces). Not used by the website. | Yes (default "quantity") |
| stock | The old count of pieces from before barcode tags. It only goes down. Added to the tagged pieces in stock. | Yes (default 0) |
| isFeatured | "Best seller" mark. Not used on this page. | Yes (default no) |
| isActive | Switched on | Yes (default yes) |
| deletedAt | Filled in when a saree with past sales is deleted. Must be empty to show. | No |
| clientRef, batchId | The admin app's own markers for adding sarees. Not used here. | No |
| createdAt | When it was added. Used for "New" (10 days) and "newest first". | Yes (automatic) |
| updatedAt | When it last changed | Yes (automatic) |

Links: its photos, tagged pieces, order lines, holds during payment, stock history, and bag lines.

### ProductImage (a saree photo)

| Field | What it means | Must have it? |
|---|---|---|
| id | Internal number | Yes |
| productId | Which saree. Deleted together with the saree. | Yes |
| url | The photo's address (the shop's photo store on Amazon S3) | Yes |
| storageKey | Where the file sits in the store, so it can be removed | No |
| altText | Words describing the photo for blind visitors (the admin app puts the collection's name) | No |
| sortOrder | Photo order; the lowest is the main photo | Yes (default 0) |

### Piece (one tagged physical piece)

| Field | What it means | Must have it? |
|---|---|---|
| id | Internal number | Yes |
| productId | Which saree | Yes |
| barcode | The tag's number. No two are the same. | Yes |
| status | in stock, reserved (held by a website payment), sold online, sold at the counter, damaged, returned, retired, removed. Only "in stock" counts on the website. | Yes (default "in stock") |
| soldAt | When it sold | No |
| createdAt, updatedAt | Automatic dates | Yes |

### Subcategory (a "collection")

| Field | What it means | Must have it? |
|---|---|---|
| id | Internal number | Yes |
| categoryId | Which category | Yes |
| name | The collection's name (also every saree's name) | Yes |
| description | The shop's notes. The page turns them into highlights or a short description. | Yes (can be blank text) |
| imageUrl, storageKey | Collection picture | No |
| sortOrder | Order in lists | Yes (default 0) |
| isActive | Shown on the website | Yes (default yes) |
| status | active or inactive ("deleted") | Yes (default active) |
| onlinePrice | **The website price** of every saree in it. Must be ₹500 or more to show. | Yes |
| storePrice | The counter price. Never sent to the website. | Yes |
| mrp | The "original" price. Never shown. | No |
| createdAt, updatedAt | Automatic dates | Yes |

### Category

| Field | What it means | Must have it? |
|---|---|---|
| id | Internal number | Yes |
| name | Its name | Yes |
| slug | Its web-address name. No two are the same. | Yes |
| description | Its text. Used when a collection has no notes. | Yes |
| imageUrl, storageKey | Picture | No |
| sortOrder | Order | Yes (default 0) |
| isActive, status | Must be on and "active" for its sarees to show | Yes (defaults on / active) |

The browser also keeps **"Recently viewed"** (`nh-recent` in this browser's storage): up to 12 sarees, each with the slug, code, name, collection, category, craft, price, pieces in stock and first photo, **as they were when the customer looked**. Entries without a slug or photo are thrown away. Nothing else is ever cleaned or refreshed.

## 5. On the website

| Part | What happens |
|---|---|
| **Waiting** | Grey boxes in the page's shape. Tab title "Loading · Nandam Handlooms". After 20 seconds with no answer: the error below. |
| **Error** | Wi-Fi icon, "We couldn't load this saree", "Please check your connection and try again.", **Try again** button. |
| **Not found** | "This saree isn't on the website now. It may have sold out. Take a look at what's new instead." with **See all sarees** and **Go to the home page**. |
| **Photos** | All photos, the first one large. Computer: zoom under the mouse, click for full screen. Phone: tap for full screen, swipe left and right. Full screen: ← → keys, Escape, a close button, "2 / 5" count, focus stays inside. A photo that fails to load in the main view becomes a plain thread icon. In full screen and in the phone bar it shows the browser's broken-picture icon (Small 7). |
| **Name, code, craft** | Collection name above (or the category, when the saree's name is the collection's name), the name as the heading, "Code NH-…", the craft, "New" if added in the last 10 days and not sold out. |
| **Price** | One price: the collection's website price. No MRP, no discount. "Free delivery across India". |
| **Stock line** | Green dot: "3 identical pieces in stock: a set for the family". Amber: "Only one piece…". Red: "Sold out". |
| **Pieces (sets only)** | − / + between 1 and what is left after the bag. Next to it: "Up to 3", or "1 in your bag · up to 2 more". |
| **Bag full** | When the bag already has 20 other sarees: a yellow box "Your bag is full. 20 different sarees is the most it holds…" with "Open the bag". The Add buttons are greyed out. |
| **Add to bag** | Shows a spinner while working; can't be pressed twice. Success: the bag panel opens. Errors appear as a red message at the bottom: "This saree has just sold out.", "This saree is no longer on the website.", "Your bag is full (20 sarees)…" with **View bag**, or the offline or timeout message. |
| **In your bag** | "In your bag · View" for one piece; "All 3 pieces are in your bag · View" for a full set. Tapping it opens the bag panel. |
| **Order on WhatsApp** | Opens `wa.me/917382388565` with: "Hello Nandam Handlooms, I'd like to order this saree:" + name + "Code: …" + "Price: ₹…" + link. Sold out: "Hello Nandam Handlooms, this saree is sold out. Do you have a similar one?" + name + code + link. |
| **Call** | "Questions? Call 73823 88565" (the number from Shop details). |
| **Notes** | "The bag doesn't hold the saree: our store sells it too. Send your bag on WhatsApp…" (out of date: Should fix 2). Four promises (free delivery, handwoven, WhatsApp help, see it at the store). |
| **Highlights / About / Ordering / Care** | Highlights as dots. "About this saree" opens by itself when there are no highlights, and shows the description, details and a colour note. |
| **Share** | **Share**: the phone's share sheet with "<name>, ₹<price>" and the link. No shop name, as the client asked. Without a share sheet, the link is copied and "Link copied" shows. If copying fails: "Couldn't share. Copy the address from the address bar." **WhatsApp**: opens WhatsApp with "<name>, ₹<price> <link>". |
| **Phone bar** | Shows after scrolling past the buttons (phones and small tablets only): photo, name, "₹… · code", and **Add**, **In bag** or **Ask** (sold out). |
| **Rails** | "More from this collection", "You may also like", "Recently viewed": sliding rows of saree cards, each with its own **Add to bag** (one piece). |
| **Search engines** | Tab title "<name> · Nandam Handlooms". A description with name, code, price and the first part of the text. Product data for Google (name, code, photos, description, brand, category, price in rupees, in stock or out of stock, new condition). |

**Do both ends match?** Yes for field names: every field the page reads is sent by the server. Stock is counted the same way (old count + tagged pieces in stock) on the page, the cards, the bag and the link preview, because they all use one function (`presentCard`). The price is always the collection's website price, rounded to whole rupees. When a saree's name equals its collection's name, the page shows the category instead, so the name isn't printed twice. A very long name (up to 150 characters) wraps on the page and is cut with "…" in the phone bar. HTML or script in a name is shown as plain text, both on the page and in the preview.

## 6. Problems found

### Must fix

**M1. A saree added while the website is still checking a returning customer's sign-in can vanish from the bag without a word.**
Why it matters: on a slow or patchy phone connection, a signed-in customer opens a saree link and taps Add to bag before the sign-in check has finished, or after it failed. The page says "Added", and the bag shows it. When the sign-in check then succeeds (straight away, or later when they open Checkout), the website replaces the bag with the account's copy, and the saree is gone. There is no message. The customer thinks it is in the bag.
Where: `Nadam-frontend/customer-web/src/bag/store.js:241` (signed-in is judged only by "signed in now", so an "unknown" sign-in takes the visitor path), `store.js:203` (the bag is not checked meanwhile), `store.js:329` (at sign-in only a visitor's bag is joined; this one is marked as the account's, so the new line is dropped).
> **Second check: ⚠️ Partly correct: the loss is real and the cause is right, but it belongs under Should fix. The sign-in check is sent before the page is even drawn, so this needs a slow or failed check, and only one bag line is lost (no money, order or stock), which the customer sees at Checkout before paying. Also, Checkout itself just waits while the sign-in is "unknown"; the loss happens at the next successful sign-in check (reload, another tab, an account page).**
> **Third check: Second checker right. Final: a returning customer who adds, changes or removes sarees while the website is still checking (or failed to check) their sign-in loses all those changes without a word as soon as the check succeeds; it needs a slow or failed check when the page opens, nothing is paid or ordered, and the bag is shown on Checkout before paying (it can be several sarees, not only one; same bug as the bag report's Should fix 1). Final group: Should fix.**

### Should fix

**S1. A saree card fades away and stays invisible after its "Add to bag" is tapped.**
Why it matters: on the saree page's three rows (and in every list), tapping "Add to bag" on a card opens the bag panel. When the panel closes, that card has turned invisible, leaving a blank gap. The same happens when the saree is removed from the bag, or when its stock changes after a background refresh. Customers will think the saree disappeared. The cause: the fade-in animation adds a marker ("in") by hand, and React wipes it out when the card's look changes ("added"). The cards stay invisible because nothing watches them any more. The browser tests miss this, because their "is it visible" check counts a fully transparent card as visible.
Where: `src/components/SareeCard.jsx:36`, `src/utils/motion.js:35`, `src/theme/shop.css:19`, `src/pages/product/ProductPage.jsx:85` (also `src/pages/shop/ShopList.jsx:65`).
> **Second check: ✅ Correct.**

**S2. The page still says the bag doesn't hold the saree and that ordering is by WhatsApp, but online Checkout is now live.**
Why it matters: since 26 Oct the bag's main button is "Checkout", which holds the saree for 15 minutes while paying. The page still says "The bag doesn't hold the saree: our store sells it too. Send your bag on WhatsApp and we confirm it is still here." and "Tap Send bag on WhatsApp… We confirm they are available and share the payment details." Both now point customers away from Checkout.
Where: `src/pages/product/ProductPage.jsx:223` and `ProductPage.jsx:241-244` (the page never asks whether payments are on).
> **Second check: ✅ Correct.**

**S3. A saree that is only held in someone's checkout shows as "Sold out" for up to 30 minutes.**
Why it matters: when anyone presses Pay (test payments are open to every visitor now), the saree's piece is marked "reserved", or its old stock count is lowered. For the next 15 minutes (30 if they press Pay again), it leaves every list. Its page says "Sold out". The WhatsApp button sends "this saree is sold out. Do you have a similar one?". The link preview and the data for Google also say sold out. If that customer gives up, the saree comes back, but other buyers may already have been told it's gone.
Where: `Nadam-backend/src/services/shop/catalog.service.js:49` and `:324`, `src/services/shop/visibility.js:17`, `src/services/shop/page.service.js:49`, held by `src/services/shop/checkout.service.js:179` and `:185`. Website: `src/pages/product/ProductPage.jsx:62` and `:115`.
> **Second check: ✅ Correct.**

**S4. After "This saree has just sold out", the page still shows it in stock with an Add to bag button.**
Why it matters: a signed-in customer taps Add on a saree that sold at the counter a minute ago. They get the red message, but the page keeps saying "Only one piece…" and offers Add again. The page is never reloaded. For a visitor it is the same: the bag panel says sold out, but the page doesn't. The same goes for a set whose pieces dropped: after the bag lowers the number, the page still offers "Add one more".
Where: `src/pages/product/ProductPage.jsx:135-136` (the error is shown, but `reload()` is never called); the page's own stock is used for its limits at `ProductPage.jsx:123-126`.
> **Second check: ✅ Correct.**

**S5. "Recently viewed" shows old prices and old stock, and offers "Add to bag" for sarees that have since sold out or left the website.**
Why it matters: most sarees are single pieces that sell within days. The browser keeps the card exactly as it was when viewed: the old price, the "Set of 3" badge, and the Add to bag button. Tapping Add puts a sold saree in the bag. Tapping the card opens "This saree isn't on the website now". Nothing ever refreshes or removes these cards, except the limit of 12.
Where: `src/data/recent.js:14-19`, `src/pages/product/ProductPage.jsx:81` and `:269`, `src/components/SareeCard.jsx:19-27`.
> **Second check: ✅ Correct.**

### Small

1. A missing saree's browser tab says "Saree · Nandam Handlooms", not "Page not found". The page's own title is set after the not-found page sets its title. Where: `src/pages/product/ProductPage.jsx:83`, `src/pages/info/NotFoundPage.jsx:7`.
   > **Second check: ✅ Correct.**
2. The not-found text says "It may have sold out", but sold-out sarees still open (marked Sold out). The real reasons are hidden, store only, deleted, no photo or a wrong price. Where: `ProductPage.jsx:97`.
   > **Second check: ✅ Correct.**
3. "Too many requests" and "server busy" answers are shown as "Please check your connection", which is not the reason. Where: `ProductPage.jsx:103-104`.
   > **Second check: ✅ Correct.**
4. For a saree with more than 50 in stock, the − / + allows more than the bag can hold (50). The bag quietly keeps 50, and the button never changes to "All in your bag". Where: `ProductPage.jsx:125` against `src/bag/store.js:236`.
   > **Second check: ✅ Correct.**
5. When the bag holds more pieces than are now in stock, the button says "All 2 pieces are in your bag" while the bag shows 3, until the bag is checked again. Where: `ProductPage.jsx:213`.
   > **Second check: ✅ Correct.**
6. For a set, "Order on WhatsApp" doesn't say how many pieces the customer chose with − / +. Where: `ProductPage.jsx:116`.
   > **Second check: ✅ Correct.**
7. A photo that fails to load shows the browser's broken-picture icon in full screen and in the phone bar. The main view handles it. Where: `src/pages/product/Gallery.jsx:33`, `ProductPage.jsx:273`.
   > **Second check: ✅ Correct.**
8. Two photos with the same address, or two identical highlight lines in a collection's notes, confuse React (it needs each item to be different). One of them may not show or update properly. Where: `Gallery.jsx:79`, `ProductPage.jsx:227`; the server doesn't remove repeated lines, `Nadam-backend/src/services/shop/catalog.service.js:30`.
   > **Second check: ✅ Correct.**
9. "Hover to zoom · click for full screen" shows on touch tablets wider than 900 px (an iPad turned sideways), where there is no hover. Where: `Gallery.jsx:69`, `src/theme/shop.css:241`.
   > **Second check: ✅ Correct.**
10. If the shared catalogue summary fails to build, the whole saree page fails ("We couldn't load this saree"), though only "You may also like" needs it. Where: `catalog.service.js:314`.
    > **Second check: ✅ Correct.**
11. In the link preview, a name, code or photo description containing `$'`, `` $` `` or `$&` would copy other parts of the page into the title. This is very unlikely with real names. Where: `Nadam-backend/src/services/shop/page.service.js:57` (the text is used as a replacement pattern).
    > **Second check: ✅ Correct.**
12. Not sure: when the link-preview request fails (more than 240 visits a minute from one mobile network, database trouble, a broken `%` code or hidden character in the link), the server answers with error text, not the page. A visitor sees the saree page only if nginx falls back to the plain page for that error. nginx's settings are not in the code. The server could simply send the plain page itself. Where: `page.service.js:60-63`, `Nadam-backend/src/routes/shop/index.js:32`.
    > **Second check: ❌ WRONG: live nginx serves the plain index.html whenever this route errors (deploy notes `live-v2-server.md:101`, "falls back to index.html"), so visitors always get the website and WhatsApp gets the general preview. The code reading is right, but there is no customer problem; serving the plain page from the server is optional extra safety.**
    > **Third check: Both partly right. Final: nginx serves the plain page for 400, 404, 500, 502, 503 and 504 (`error_page 400 404 500 502 503 504 = @plain_page`), so database trouble, a broken `%` code and a missing page file never reach visitors, but 429 is not in that list, so a visitor whose network opens more than 240 saree links in a minute gets the server's raw JSON error text instead of the website (and no link preview) for up to a minute; rare, fix by adding 429 to that line. Final group: Small.**
13. A link with a broken `%` code (for example `/product/abc%E0%A4`) gives "Something went wrong" (500) instead of "not found". Express marks it as a bad request, but the error handler turns it into 500. Where: `Nadam-backend/src/middlewares/errorHandler.js:20-24`.
    > **Second check: ⚠️ Partly correct: the server does answer 500 (and logs a false error) for a bad `%` code on the API and preview routes. But a visitor never sees "Something went wrong": nginx serves the plain page, React Router keeps the raw text, the website encodes it (`api/shop.js:11`), and the server refuses it with 400 `VALIDATION_FAILED`, so the page correctly shows "This saree isn't on the website now". Small is right.**
    > **Third check: Second checker right. Final: a hand-typed saree address with a broken `%` code makes the server answer 500 and log a false error, but nginx serves the website and the page correctly shows "This saree isn't on the website now". Final group: Small.**
14. "Recently viewed" stays after signing out, so the next person on a shared computer sees what the last one looked at. The bag, by contrast, is cleared at sign-out. Where: `src/data/recent.js:14-19`.
    > **Second check: ✅ Correct.**
15. Tapping Add to bag while offline (signed in) says "…What you typed is kept.", which makes no sense on this page. Where: `src/api/errors.js:35`.
    > **Second check: ✅ Correct.**
16. A saree that left the website still answers "200 OK" with the general page and no "don't list this" (noindex) tag, so Google may keep old saree links as empty pages. Where: `page.service.js:63`, `NotFoundPage.jsx`.
    > **Second check: ✅ Correct.**
17. A link typed with capital letters (`/product/Rainbow-Checks…`) is "not found", because addresses are matched exactly and the shop's are all small letters. Where: `Nadam-backend/src/validators/shop/catalog.validators.js:25`.
    > **Second check: ✅ Correct.**
18. Not sure: stock is "old count + tagged pieces" with no guard against a negative old count. If the old app ever left a negative count, a saree with a tagged piece would show in lists but say "Sold out" on its page. Where: `catalog.service.js:49`.
    > **Second check: ⚠️ Partly correct: the missing guard is real, but every stock decrease on both servers is guarded (`stock: { gte: n }`) and the admin app can't set stock, so it could only come from old data or a manual edit. If it happened, the card in lists would also say "Sold out" (`SareeCard.jsx:19`), not only the page.**
    > **Third check: Second checker right. Final: only if an old or hand-edited record had a negative old stock count would a saree with a tagged piece show as "Sold out" everywhere (card, page, bag) and be unbuyable online; no code on either server can cause it today, and the guard is one line. Final group: Small.**

## 7. What I could not check

- **nginx** (the web server in front): its settings are not in the code. I could not see which errors make it serve the plain page instead of the server's answer, whether it swaps the server's security headers for the website's on `/product/` (the notes say it does), or whether it keeps copies of answers.
- **Live data**: whether old sarees (from the old app) have web-address names with other characters, repeated photo addresses, negative old stock, or internal notes (for example a wholesale price) in a collection's notes. The page shows a collection's notes to everyone as highlights or a description, so it is worth a look in the admin app.
- **A real browser and real phones**: I read the code and React's own source for S1. I did not see it happen on screen. Speed on slow phones, and the zoom and swipe feel, were not tried.
- **WhatsApp, Facebook and Google themselves**: how they read the preview and the product data. I only checked what the server sends.
- **The bag, checkout and sign-in modules** were read only where this page touches them.

## 8. For the developer

Server
- `Nadam-backend/src/services/shop/catalog.service.js:302-338` `product()`: `findBySlug` + a second `count(listedWhere ∧ id)` query. Fix: one `findFirst({ where: { AND: [listedWhere(), { slug }] } })`.
  > **Second check: ✅ Correct.**
- `Nadam-backend/src/models/shopCatalog.model.js:57`: `pieces` (every in-stock piece row) is selected but never used by the saree page or the preview. Fix: drop it; `_count` already has the number.
  > **Second check: ✅ Correct.**
- `catalog.service.js:49` `available()`: fix: `Math.max(0, p.stock) + _count.pieces`.
- `catalog.service.js:314` (Small 10): fix: wrap the `summary()` part in a try/catch that falls back to `similar: []`.
- `catalog.service.js:30` `readText` points: fix: `[...new Set(points)]` before `.slice(0, 10)`.
- S3, `catalog.service.js:324` and `page.service.js:49`: fix: also return `held` = reserved pieces + active quantity reservations (`Reservation.status = 'active'`); `soldOut` only when `available + held < 1`; show "Someone is paying for this right now. Check back in 15 minutes." and keep it in lists with a badge.
- `page.service.js:57` (Small 11): fix: `out.replace(/<title>[^<]*<\/title>/, () => lines)` and the same for the `</head>` branch.
- `page.service.js:60-63` with `routes/shop/index.js:32` (Small 12): fix: catch every error after `indexHtml()` succeeds (lookup, bad text) and return the plain `html`. Put the rate limiter after reading the file, or make it fall back to the plain page too.
- `src/middlewares/errorHandler.js:20-24` (Small 13): fix: map errors with `err.status === 400` (Express URI decode) to a 400 `BAD_REQUEST` instead of 500.
- `src/validators/shop/catalog.validators.js:25` (Small 17): fix: `.toLowerCase()` before the regex (the slugs are made lower-case at `src/models/product.model.js:132`).
- `page.service.js:63` (Small 16): fix: for a missing saree, add `<meta name="robots" content="noindex">` (or answer 404 with the plain page).
- `src/controllers/shop/catalog.controller.js:8`: `public, max-age=60` has no effect for the website (`client.js:60` uses `cache: 'no-store'`). No change needed; noting it so nobody relies on it.
  > **Second check: ✅ Correct.**

Website
- M1, `src/bag/store.js:233-250` `add()`: fix: if `state.owner === 'account' && authStore.get().status === 'unknown'`, `await renew()` (or the bootstrap promise) before choosing the path. Or, when not signed in yet, put the line into `pending`, which `joinAccount` (`store.js:327-348`) already merges.
- S1, `src/utils/motion.js:35` + `src/theme/shop.css:19`: React resets `class` on every className change (react-dom 19.3.1 `setValueForKnownAttribute(domElement, "class", …)`), dropping the hand-added `in`. Fix: mark revealed elements with `el.dataset.in = ''` and use `.js-motion .reveal:not([data-in])` in CSS (React never touches an attribute it doesn't render). Add an e2e check on computed `opacity` after Add on a card.
- S2, `src/pages/product/ProductPage.jsx:223, 241-244`: fix: `const paymentsOn = usePaymentsOn()`; when on, say "Checkout holds your sarees for 15 minutes while you pay; the bag alone doesn't hold them", and keep the WhatsApp wording only when payments are off.
- S4, `ProductPage.jsx:135-136`: fix: `if (['SOLD_OUT','NOT_ON_WEBSITE'].includes(err.code)) reload();`. Also reload when the bag check marks this slug `sold_out`/`fewer`/`unavailable` (`bag.checked`).
- S5, `src/data/recent.js` + `ProductPage.jsx:81`: fix: refresh the stored slugs with POST `/bag/check` (it returns price, available and state per slug); drop `not_found`/`unavailable` ones and update price and available. Or render recent cards without price and Add.
- Small 1, `ProductPage.jsx:83`: fix: `useTitle(p ? p.name : status === 'error' && error?.status !== 404 ? 'Saree' : …)`, or let NotFoundPage's title win (call useTitle only when `p` exists).
- Small 2, `ProductPage.jsx:97`: fix: "It may have been taken off the website."
- Small 3, `ProductPage.jsx:103-104`: fix: show `error.message` for `RATE_LIMITED` / `SERVER_BUSY` instead of the connection text.
- Small 4, `ProductPage.jsx:125`: fix: `const room = Math.max(0, Math.min(p.available, MAX_QUANTITY) - inBag)`.
- Small 5, `ProductPage.jsx:213`: fix: show `inBag`, not `p.available`.
- Small 6, `ProductPage.jsx:116`: fix: add `Pieces: ${pieces}` when `isSet`.
- Small 7, `Gallery.jsx:33`, `ProductPage.jsx:273`: fix: an `onError` fallback like `Stage` has (`Gallery.jsx:66-67`).
- Small 8, `Gallery.jsx:79`, `ProductPage.jsx:227`: fix: `key={`${i}-${p.url}`}` and `key={`${i}-${h}`}`.
- Small 9, `Gallery.jsx:69`: fix: render the hint only when `canHover()`.
- Small 14, `src/data/recent.js`: fix: clear `nh-recent` in the sign-out path (`store.js:352` `forgetAccount`, or the auth store's `end()`).
- Small 15, `src/api/errors.js:35`: fix: drop "What you typed is kept." from the shared message, or pass a context-specific one.
- `src/utils/useMeta.js:23`: `og:image` keeps the last saree's photo on later pages (no customer effect, since previews come from the server). Fix if wanted: reset it to the default when `image` is empty.
  > **Second check: ✅ Correct.**
- Tests to add: an e2e that a card's computed opacity stays 1 after Add / Remove; a unit test for `add()` while `authStore.status === 'unknown'` followed by sign-in; an API test that a saree with all pieces `reserved` reports `held`, not sold out.

## Second check (26 Oct 2026)

Every finding was checked against the code (read only). Counts: **✅ 24 · ⚠️ 3 · ❌ 1** (1 Must, 5 Should, 18 Small, 4 developer notes).

- ⚠️ M1: real, but Should fix, not Must (narrow timing window; one bag line lost, nothing paid or ordered wrong).
- ❌ Small 12: live nginx falls back to index.html when the preview route errors, so visitors never see the error text.
- ⚠️ Small 13: the server's 500 is real, but the visitor gets the correct "not found" page.
- ⚠️ Small 18: no code path can make the stock negative today, and the list card would also say "Sold out".

Details and evidence: [checks/06-saree-page-check.md](checks/06-saree-page-check.md).

## Third check (26 Oct 2026)

A third checker re-checked the four disputed findings (M1, Small 12, Small 13, Small 18) against the code and the nginx block used at go-live. Read only, nothing run.
Counts: **Second checker right 3 · First reviewer right 0 · Both partly right 1 · Neither right 0.**
- M1: real; the sign-in check starts before the page is drawn, so this needs a slow or failed check. Every bag change made in that time is undone (it can be several sarees). **Should fix** (same bug as the bag report's Should fix 1).
- Small 12: nginx's fallback list is `400 404 500 502 503 504`. It leaves out **429**, so more than 240 saree-link loads a minute from one network gets raw JSON error text instead of the website. Rare. **Small**; add 429 to that line.
- Small 13: only a false 500 and a false error in the server log; the visitor gets the right "not on the website" page. **Small.**
- Small 18: no code can make stock negative today; if old data had it, the saree would say "Sold out" everywhere. **Small.**

Full evidence: [checks/06-saree-page-third-check.md](checks/06-saree-page-third-check.md).

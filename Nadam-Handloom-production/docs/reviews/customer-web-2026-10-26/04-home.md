# Module 4: Home page (review of 26 Oct 2026)

I only read the code. Nothing was run or changed. This is the new home page design from 26 Oct 2026. It is on the Mac only and **not live yet** (see `docs/modules/web-02-home-and-shop.md` section 15).

---

## 1. What this module does

The home page is the first page a customer sees. It shows:
- the shop's categories as round photos (the ones with no sarees yet say "Coming soon"), and the crafts;
- the 10 collections that got new sarees most recently;
- every saree on the website, with filters, sorting and "Load more";
- a box to sign up for new-arrival alerts, and the shop's address and hours at the bottom.

All of it comes live from what the shop enters in the admin app.

## 2. What a customer sees and does

1. The customer opens nandamhandlooms.com. The browser tab says "Nandam Handlooms · Handwoven in Mangalagiri".
2. At the top is a row of round photos:
   - **All**, with the number of sarees on the website;
   - the **6 categories** with their short names ("Pattu sarees", "Lehanga sets" …). Categories with sarees come first, the one with the most sarees first. Each shows its number of sarees. Then come the categories with nothing on the website yet, which say **"Coming soon"**;
   - a thin line, then the **crafts** (Embroidery, Kalamkari …), each with its number.
   On a phone the row slides sideways with a finger.
3. **Latest collections**: a sliding row of up to 10 collection photos. Each shows the name, "N pieces · ₹price", and a **"New"** badge if a saree came into that collection in the last 10 days. Next to the heading is a link, **"N new sarees →"**. On a computer there are left/right arrows.
4. **All sarees**: every saree on the website, newest first, 24 at a time, with a **Load more** button. Filters (category, craft, price, collection, "Sets only") are on the left. On a phone they open from a bar at the bottom, next to Sort. Each card shows the photo, collection or craft, name, price, code and **Add to bag**.
5. **"Be the first to see new sarees"**: a button to turn on new-arrival alerts. If the browser can't do that, the button offers WhatsApp instead.
6. **Footer**, on the home page only: the promises (free delivery and so on), shop links, help links, the store address, hours, Google Maps link and GSTIN, and the light/dark switch.
7. Where each item leads:
   - a category → its category page;
   - a craft → the list of that craft;
   - a collection photo → that collection's page;
   - "N new sarees" → the "New in" page;
   - a saree → its saree page.

## 3. Each API

An API is a call the website makes to the server to get data. The home page uses two of them, **catalog** and **products**. It also reads the shop details that the website loads once at the start (**config**). An older call, **home**, is still on the server, but the new home page no longer uses it.

All of them are open to everyone (no sign-in needed). If the "website switch" is off in the admin app, they all answer "website being updated" first. Each network (one Wi-Fi or one phone connection) can make at most **240 browsing calls a minute**.

### 3.1 GET /api/v2/shop/catalog — the shop's summary

| | |
|---|---|
| **What it is for** | The round categories, the crafts, "Latest collections", the "N new sarees" number, and (on other pages) the menus and filters. |
| **What goes in** | Nothing. |
| **What the server works out** | It reads every saree that is on the website (rules in section 4), every active category and every active collection. From those it counts sarees per collection, per category and per craft. It also finds each collection's newest saree (when it came in, and its photo), counts the sarees added in the last 10 days, and counts the "sets" (more than one piece of one design). **The result is kept in the server's memory for one minute.** During that minute every visitor gets the same copy, so a sale or a new saree can take up to a minute to change these numbers. |
| **What comes back** | **totals**: number of sarees, collections, sets, and new sarees (last 10 days).<br>**categories** (only those with sarees on the website): short web address name, name, description, photo, number of sarees, number of collections.<br>**soon** (active categories with nothing on the website): web address name, name, description, photo, and up to 12 names of their collections ("upcoming"), never ones named like "Test1".<br>**collections** (only those with sarees on the website): id, name, category, craft, price, price band, number of sarees, number of sets, photo, short description, when its newest saree came in (**newest**), and whether that was in the last 10 days (**hasNew**).<br>**crafts** (only those with sarees): key, name, number of sarees, number of collections, photo.<br>**priceBands**: the 4 price ranges for the filter. |
| **What is saved** | Nothing about the shop. One row per call in the "rate limit" table (used to count calls per network; old rows are cleaned up later). |
| **What can go wrong** | **Website switched off** (503 MAINTENANCE): the whole website shows the "being updated" page.<br>**Too many calls from one network** (429): the home page says "We couldn't load the shop. Please check your connection and try again." That is the wrong reason (see Small 2).<br>**Server or database error** (500): the same box.<br>**No internet, or no answer within 20 seconds**: the same box.<br>Whenever this call fails on a first visit, the whole saree list is hidden too (see Should fix 3). |

### 3.2 GET /api/v2/shop/products — the "All sarees" list

| | |
|---|---|
| **What it is for** | The saree cards under "All sarees", the count ("226 sarees"), and the numbers next to every filter. |
| **What goes in** | Read from the page address, all optional: category, collection, craft (one or more), price band, sets only, search words (up to 60 letters), sort (newest / price low to high / price high to low), where to start (0 to 10,000), how many (24 on the website, at most 48). A wrong or unknown value is **silently ignored**. It never causes an error. |
| **What the server works out** | It takes the sarees that are on the website, keeps those in the chosen collections, and applies the search and "sets only". It reads 24 of them in the chosen order and counts the total. The **cards and the total are read live**. The **filter numbers** come from the one-minute summary above. |
| **What comes back** | **items**: for each saree its web address name, code, name, collection (id and name), category, craft, price (rounded to whole rupees), pieces available, first photo (and its text for the blind), "new" (added in the last 10 days) and the date added.<br>**total**, where this page started, page size, and where the next page starts (empty when there is no more).<br>**facets**: the numbers next to each category, craft, price band and collection. |
| **What is saved** | Nothing, except the same one row in the rate-limit table. |
| **What can go wrong** | Same as catalog: 503 shows the "being updated" page.<br>429, 500, no internet or no answer in 20 s on the first page: "We couldn't load the sarees. Please check your connection and try again." with **Try again**.<br>If "Load more" fails: the cards already shown stay, and a button says "Couldn't load more. Try again". |

### 3.3 GET /api/v2/shop/config — the shop's details (loaded once, used by the home page)

| | |
|---|---|
| **What it is for** | The phone number, store address, hours, WhatsApp number and map link in the footer, and the store facts for Google (section 5.2). |
| **What goes in** | Nothing. |
| **What comes back** | Website on/off, the shop's name, mobile, address and GSTIN (from Settings in the admin app), and the store's address lines, hours, opening hours for Google, WhatsApp and map link (fixed in the server's settings file). |
| **What can go wrong** | If it fails, the website uses its own built-in copy of the same details. Nothing breaks. |

### 3.4 GET /api/v2/shop/home — old, not used by the new home page

The **live** website (built on 16 Oct) still uses this. It returns the totals, categories, crafts, the 5 "edits", 12 newest sarees, a "spotlight" collection, 10 sets and the store. The new home page does not call it (only a browser test does). It can be removed once the new website is live (Small 8).

## 4. The data kept

The home page only **reads** these tables. It changes nothing in them.

### When a saree is on the website (all must be true)

1. The saree is **switched on** and **not deleted**.
2. Its channel is **"Online only" or "Both"** (not "Store only" or "Hidden").
3. Its **category is active**.
4. Its **collection is active**, and the collection's **website price is ₹500 or more**. A lower price is treated as a typing mistake.
5. It has **at least one photo**.
6. It is **in stock**: the old stock number is above 0, **or** at least one tagged piece is "in stock".

The same rule (`visibility.js`) gives the admin app its "On the website / Not on the website: …" line.

- A **collection** shows when it is active, its category is active, and it has at least one saree on the website.
- A **category** shows with a number when it has at least one collection like that. Otherwise, if it is active, it shows as **"Coming soon"**.
- A **craft** shows when at least one collection of that craft has sarees on the website. The craft is guessed from words in the collection name, for example "kalankari" means Kalamkari. On the home page a craft also needs a photo.

### Category (the 6 big groups)

| Field | What it means | Must have it? |
|---|---|---|
| id | Its own number | Yes (made automatically) |
| name | Its name, e.g. "Mangalagiri Handloom Pattu Sarees" | Yes |
| slug | Its part of the web address, e.g. `mangalagiri-handloom-pattu-sarees`. It stays the same when the name changes. The website's short names and photos are tied to this. | Yes, and no two the same |
| description | Its text | Yes |
| imageUrl | Its photo from the admin app (about 400 px wide) | No |
| sortOrder | Its place in the admin app's list (the home page does not use it; it puts the category with the most sarees first) | Yes (0 if not set) |
| isActive | On/off. The admin app **no longer has a switch for this** | Yes (on if not set) |
| status | "active", or "inactive" after it is deleted | Yes ("active" if not set) |
| createdAt / updatedAt | When it was made / last changed | Automatic |

### Subcategory (a "collection", e.g. "Pure Pattu 350k Butta Saree")

| Field | What it means | Must have it? |
|---|---|---|
| id | Its own number (used in the collection's web address) | Yes |
| categoryId | Which category it belongs to | Yes |
| name | Its name. Every saree in it takes this name | Yes |
| description | Its text. The website shows a cleaned-up part of it | Yes |
| imageUrl | Its own photo. If empty, the website uses the photo of its newest saree | No |
| sortOrder | Its place in the admin app's list | Yes (0) |
| isActive | "Show on website" switch | Yes (on) |
| status | "active", or "inactive" after it is deleted | Yes ("active") |
| onlinePrice | **Website price** (paise allowed; the website shows and charges it rounded to whole rupees). Below ₹500 = hidden | Yes |
| storePrice | Shop counter price (never on the website) | Yes |
| mrp | The "original" price (never shown on the website) | No |
| createdAt / updatedAt | When it was made / last changed | Automatic |

### Product (one saree design)

| Field | What it means | Must have it? |
|---|---|---|
| id | Its own number | Yes |
| slug | Its part of the web address | Yes, and no two the same |
| sku | Its code, shown on the card | Yes, and no two the same |
| name | Its name (same as its collection's) | Yes |
| categoryId, subcategoryId | Its category and collection (kept matching by the admin app) | Yes |
| technique, borderStyle, purity, zariTier, blouseType, pattern, color, fabric, occasion | Details shown on the saree page | No |
| channelVisibility | Where it is sold: "online_only", "store_only", "both" or "hidden". **New sarees start as "both"** | Yes ("both") |
| trackingMode | Whether the staff app shows a count or a list of tags (display only) | Yes |
| stock | Old stock number from before barcode tags. It only goes down | Yes (0) |
| isFeatured | "Best seller" mark (not used by the home page) | Yes (off) |
| isActive | On/off | Yes (on) |
| deletedAt | Set when a saree that has sales is deleted | No |
| clientRef, batchId | Stop the phone from adding the same saree twice; which batch it came in | No |
| **createdAt** | **When the saree was first entered in the admin app.** This decides "New" (last 10 days), "N new sarees" and "Latest collections" | Automatic |
| updatedAt | Last change | Automatic |

**Pieces available** = stock + the number of its tags that are "in stock". More than 1 = a **set** ("Set of 3").

### ProductImage (a saree's photos)

| Field | What it means | Must have it? |
|---|---|---|
| productId | Which saree | Yes |
| url | Where the photo is stored | Yes |
| storageKey | The file's name in storage | No |
| altText | Words describing the photo for blind visitors. If empty, the website makes "name, collection" | No |
| sortOrder | Photo order. The first one is the card photo | Yes (0) |

### Piece (one tagged piece of a saree)

| Field | What it means | Must have it? |
|---|---|---|
| productId | Which saree | Yes |
| barcode | The tag's number | Yes, and no two the same |
| status | "in_stock", "reserved", "sold_online", "sold_offline", "damaged", "returned", "retired", "removed". Only **"in_stock"** counts for the website | Yes ("in_stock") |
| soldAt | When it was sold | No |
| createdAt | When the tag was added. **New tags on an old saree are not counted as "new"** (Should fix 7) | Automatic |

### Also touched

- **RateLimitHit**: one row per call (the network and the time), to stop more than 240 browsing calls a minute from one network.
- **AppConfig** (Settings): read for the website on/off switch (re-read every 10 seconds) and the shop's name, mobile and GSTIN.

## 5. On the website

### 5.1 Page title and description
- Tab title: "Nandam Handlooms · Handwoven in Mangalagiri".
- Description for Google and link previews: "Handwoven Mangalagiri pattu sarees, dress materials and lehanga sets from Nandam Handlooms, Old Mangalagiri. Free delivery across India."
- There is one hidden main heading for screen readers.
- WhatsApp and Facebook previews don't run the website's code. They read the fixed title, description and loom photo in `index.html`, which are similar.

### 5.2 Store facts for Google (structured data)
These are hidden facts that tell Google this is a clothing store: its name, web address, a photo (`lamps-1200.jpg`, which exists), phone (+91 and the shop's mobile from Settings), address (#10-23, Opp. Brahmam Gari Temple, Hussain Katta, Old Mangalagiri, Mangalagiri, AP 522503, India), hours (Mo–Su 09:30–20:30) and the map link. The text is made safe before it is put on the page. Google reads it after the page's code runs. I could not test this in Google's checker.

### 5.3 Round categories and crafts
- **Waiting:** 8 grey round placeholders.
- **Success:**
  - "All" plus the number of sarees;
  - the categories with sarees, most sarees first;
  - then "Coming soon" categories;
  - a line, then the crafts that have a photo.
- **Photos:** "Pattu sarees" and "Pattu dress materials" use the website's own photos (`lamps`, `applique`), because the admin app's photos are a poster with writing and a small picture. The others use the shop's category photo. If that is missing, they use the photo of the newest collection. A "Coming soon" category with no photo shows an empty grey circle.
- **Short names:** a fixed list of 6. A new category not on the list shows its full name.
- **Error:** the grey placeholders stay. The error box appears below them (5.6).

### 5.4 Latest collections
- **Waiting:** 6 grey tiles.
- **Success:** the 10 collections whose newest saree came in most recently, newest first. "New" appears if that was in the last 10 days. The link "N new sarees →" appears only when N is above 0. A collection without its own photo uses its newest saree's photo, so a tile is never empty unless the photo link is broken.
- **Empty shop:** the heading shows with an empty row and no message.
- **Error:** the whole section is replaced by the error box (5.6).

### 5.5 All sarees
- **Waiting:** "Loading…" and 8 grey cards. While "Load more" works: 4 grey cards and a "Loading…" button.
- **Success:**
  - "N sarees", the cards, and "You've seen 24 of 226" with a progress line and Load more;
  - filters and sort are kept in the page address, so Back and shared links show the same list;
  - "Load more" adds `page=2` to the address, up to 20 pages.
- **Nothing found:** "No sarees match these filters" plus "Clear filters". With no filters it still says "No sarees match these filters" (Small 4).
- **Error:** "We couldn't load the sarees" plus Try again. If a later page fails: "Couldn't load more. Try again".

### 5.6 When one part fails and the other works

| Situation | What the customer sees |
|---|---|
| Catalogue fails, list would work | On a first visit: "We couldn't load the shop" and Try again. **No sarees at all**, even though the list could have been shown. The grey circles stay above. |
| List fails, catalogue works | Categories and Latest collections show. Under "All sarees": "We couldn't load the sarees" and Try again. |
| Both fail | "We couldn't load the shop" and Try again. |
| Slow connection | Grey placeholders for up to 20 seconds, then the error box. Each part loads on its own. |
| Catalogue loaded before, later refresh fails | The old copy stays on screen. No error. |
| Server copy is up to 1 minute old | The numbers ("All 226", category numbers, collection "N pieces") can be a little off for up to a minute after a sale or a new saree. The cards themselves are live. |

### 5.7 New-arrival alerts box
It sits under the list. It shows a "Tell me about new arrivals" button, "Alerts are on for this device", iPhone instructions, or "Get new arrivals on WhatsApp". How the alerts work is for another reviewer.

### 5.8 Footer (home page only)
- **Promises:** free delivery, handwoven, secure payment, WhatsApp help.
- **Shop links:** all sarees, each category, all collections, New in, sets.
- **Help:** WhatsApp, Call, and the 5 help pages.
- **Visit the store:** address, hours, Google Maps link.
- **Bottom line:** © year, "All prices include taxes", GSTIN, and the theme switch.
- If the catalogue failed, the category links are missing. The rest still shows from the built-in copy.

### 5.9 The checks asked for

| Check | Result |
|---|---|
| Field names match on both ends | Yes. Every field the home page reads is sent by the server. |
| "All N" equals the list total | Yes. Both count the same sarees. They can differ for up to a minute after a change (Small 5). |
| "New" rule, server vs website | The same: 10 days, decided by the server. The website only shows it. But "new" means "entered in the admin app in the last 10 days" (Should fix 7). |
| Test collections ("Test1") | Kept out of the "Coming soon" names. **Not** kept out of Latest collections or the list (Should fix 6). Today "Test1" is hidden only because its price is ₹10. |
| A category with 1 collection | No problem on the home page. |
| A collection without a photo | Uses its newest saree's photo. Grey only if that link is broken (no fallback, Small 6). |
| Many categories | The round row gets wider than a computer screen with no way to scroll by mouse (Should fix 2). |
| Very long names | They wrap onto more lines. A 150-letter collection name (the admin app allows it) gets cut off at the top of a phone tile. A long category name makes a tall circle label (Small 9). |
| Slow connection | Grey placeholders, then an error after 20 s (see 5.6). |
| Stale numbers after the shop changes stock | Up to 1 minute on the server. A tab left open is never refreshed (Small 5). Coming back after a change can leave an invisible gap (Should fix 4). |

## 6. Problems found

### Must fix

**None found.** The home page only shows things. It does not change money, orders or stock, and I found no security hole. A customer is never stuck: every error has a Try again button.

### Should fix

1. **On a computer, the "Latest collections" arrows stay greyed out on a first visit, so customers see only 6 of the 10 collections.**
   - Why it matters: the arrows are worked out once, while the 6 grey placeholders are showing. The 6 placeholders exactly fill the row, so the "next" arrow is switched off. When the 10 real tiles arrive, nothing works the arrows out again until the visitor scrolls the row some other way. The thin progress line that would hint at more is hidden on computers.
   - Where: `Nadam-frontend/customer-web/src/components/useRail.js:9-45`, `src/pages/home/HomePage.jsx:62-64`, `src/theme/shop.css:68`, `src/theme/home.css:31`.

   > **Second check: ✅ Correct.**

2. **On a computer, about 4 of the 8 craft circles are cut off at the right edge, and a mouse user cannot reach them.**
   - Why it matters: All + 6 categories + 8 crafts need about 1,830 px of width, but the page is at most 1,360 px wide. The row has no scroll bar (hidden on purpose), no arrows and no drag, so only a touchpad or Shift + mouse wheel can scroll it. "Bandhani", "Checks" and "Pure Pattu" may never be seen from the home page.
   - Where: `src/theme/home.css:5-7`, `src/pages/home/HomePage.jsx:29-44`.

   > **Second check: ✅ Correct.**

3. **If only the catalogue call fails, the home page hides every saree too.**
   - Why it matters: on a slow or patchy connection one call can time out while the other works. The customer then sees "We couldn't load the shop" and no sarees, even though the saree list has its own error handling and could have been shown.
   - Where: `src/pages/home/HomePage.jsx:96-108`.

   > **Second check: ⚠️ Partly correct: the list is hidden as described, but the products call first waits on the same server summary (`catalog.service.js:255`), so a slow or failing server breaks both calls together. Only a lone network failure of the catalogue request causes this, and Try again recovers, so it belongs in Small.**
   > **Third check: Second checker right. Final: if only the catalogue call fails on a first visit (a dropped request, or a 429 right at the per-network limit), the home page hides the whole saree list behind "We couldn't load the shop"; it is rare because both calls wait on the same server summary, and Try again brings the list back. Final group: Small.**

4. **After coming back to the home page, a saree card or collection tile that changed meanwhile can stay invisible (a blank gap).**
   - Why it matters: cards fade in as they come into view. When the page is opened again after more than a minute, it shows the saved list and quietly fetches a fresh one. If a new saree arrived, or one sold and another moved up, the new card is added without being set up to fade in. It stays see-through. On the home page the newest saree is the first card, so a new arrival is exactly what would go missing. The same happens to a new tile in "Latest collections".
   - Where: `src/data/resource.js:24-26`, `src/pages/shop/ShopList.jsx:65`, `src/pages/home/HomePage.jsx:76`, `src/theme/shop.css:19`, `src/components/CollectionTile.jsx:8`, `src/components/SareeCard.jsx:36`.

   > **Second check: ✅ Correct.**

5. **"12 new sarees →" opens a page that shows every saree (for example "226 sarees"), not the 12 new ones.**
   - Why it matters: the link promises 12 sarees and the page shows 226 under the title "New in". The customer has to guess which ones are new (only the "New" badges tell). The website even drops the `sort=new` part of the address as unknown.
   - Where: `src/pages/home/HomePage.jsx:59`, `src/pages/shop/filters.js:5-9` and `:23`, `src/pages/shop/ShopPage.jsx:22`.

   > **Second check: ✅ Correct.**

6. **A trial collection (like "Test1") is hidden from the "Coming soon" names, but not from "Latest collections" or the saree list.**
   - Why it matters: if staff try the app with a test saree that has a photo and a realistic price, it goes straight onto the website, because new sarees start as "Online + Store". Being the newest, its collection would come **first** in Latest collections with a "New" badge, and the test saree would be the first card. Today "Test1" is hidden only because its price (₹10) is below ₹500. A test **category** would also show as "Coming soon".
   - Where: `Nadam-backend/src/services/shop/catalog.service.js:99-117` (no trial check) vs `:141` (trial check), `:134-136`, and `src/services/product.service.js:227` (new sarees default to "both").

   > **Second check: ✅ Correct.**

7. **"New", "N new sarees" and "Latest collections" only look at when a saree was first entered in the admin app.** Not sure how often this happens; it depends on how the shop adds stock.
   - Why it matters: new pieces scanned onto an existing saree ("Add tags") never count as new. Neither does a saree that only reaches the website later (photo added later, or switched from "Store only" to "Online"). A fresh batch of a popular design never shows as new, and an old saree going online for the first time is never "New".
   - Where: `Nadam-backend/src/services/shop/catalog.service.js:68`, `:94-95`, `:166`; tags added at `src/services/product.service.js:285`, photos at `:344`.

   > **Second check: ✅ Correct.**

8. **Any active category with nothing on the website is shown as "Coming soon", and the owner has no way to take a category off the home page.**
   - Why it matters: if, say, all lehanga sets sell out, "Lehanga sets" suddenly says "Coming soon", which is wrong for a sold-out category. A category the shop sells only at the counter (all "Store only") would be advertised as "Coming soon" forever, listing its collection names. The admin app no longer has a category on/off switch, and a category can only be deleted when it has no collections. Not sure such a category exists today.
   - Where: `Nadam-backend/src/services/shop/catalog.service.js:131-142`, `prisma/schema.prisma:284`.

   > **Second check: ✅ Correct.**

### Small

1. **A collection tile says "12 pieces", but 12 is the number of saree designs.**
   - A design with 4 pieces counts as 1, and the list calls the same number "sarees".
   - Where: `src/components/CollectionTile.jsx:13`, `Nadam-backend/src/services/shop/catalog.service.js:91`.

   > **Second check: ✅ Correct.**

2. **The error boxes always say "Please check your connection".**
   - This shows even when the network is fine: too many calls from a shared Wi-Fi (429), a server error, or the server being busy. The real message from the server is never shown.
   - Where: `src/pages/home/HomePage.jsx:99-100`, `src/pages/shop/ShopList.jsx:111-112`.

   > **Second check: ✅ Correct.**

3. **When the catalogue fails, the 8 grey round placeholders keep pulsing above the error box.** It looks as if something is still loading.
   - Where: `src/pages/home/HomePage.jsx:25-27`.

   > **Second check: ✅ Correct.**

4. **If nothing at all is on the website, the page says "No sarees match these filters" even though no filter is chosen.** "Latest collections" also shows a heading over an empty row.
   - Where: `src/pages/shop/ShopList.jsx:120`, `src/pages/home/HomePage.jsx:62-64`.

   > **Second check: ✅ Correct.**

5. **Numbers can disagree for up to a minute, and an open tab never refreshes.**
   - The round "All 226" and the category numbers come from the one-minute copy, while the list total ("225 sarees") is live, so they can differ after a sale. A tab left open for hours keeps old numbers and old cards until the page is opened again. The owner may also see "On the website now" in the admin app while the home page doesn't show it for up to a minute.
   - Where: `Nadam-backend/src/services/shop/catalog.service.js:159` and `:263-270`, `src/data/resource.js:37-41`.

   > **Second check: ✅ Correct.**

6. **A broken shop photo shows the browser's broken-picture icon.** This affects round categories, crafts and collection tiles. Saree cards already have a fallback.
   - Where: `src/components/CategoryPhoto.jsx:7`, `src/components/CollectionTile.jsx:10`, `src/pages/home/HomePage.jsx:40`.

   > **Second check: ✅ Correct.**

7. **The craft circles download full-size saree photos (about 60 KB each) to show at 78 px, right at the top of the page.** This slows the first view on a weak phone connection.
   - Where: `src/pages/home/HomePage.jsx:40`, `Nadam-backend/src/services/shop/catalog.service.js:145`.

   > **Second check: ✅ Correct.**

8. **The old `GET /home` still runs (3 saree queries and a Settings read per call) but the new home page doesn't use it.** Keep it while the old website is live, then remove it.
   - Where: `Nadam-backend/src/services/shop/catalog.service.js:184-208`, `src/routes/shop/index.js:48`.

   > **Second check: ✅ Correct.**

9. **A new category not in the short-name list shows its full, long name in the small circle label (several lines).** Very long collection names (up to 150 letters) get cut off at the top of a phone tile.
   - Where: `src/data/categories.js:5-13`, `src/theme/home.css:7`, `src/theme/shop.css:92-93`.

   > **Second check: ✅ Correct.**

10. **When the one-minute copy runs out, the next visitor waits while it is rebuilt.**
    - If the database is slow or fails at that moment, every shop call fails, even though last minute's copy is still in memory.
    - Where: `Nadam-backend/src/services/shop/catalog.service.js:158-163`.

    > **Second check: ✅ Correct.**

## 7. What I could not check

- **The live data.** Whether any test collection or category, a category with no photo, or a store-only category exists today. Also how the shop adds new stock (new saree vs new tags on an old one), which decides how much Should fix 7 matters. Reading the database was not allowed.
- **How many copies of the server run.** If more than one runs (pm2 "cluster"), each keeps its own one-minute copy, so numbers could jump between two values on refresh. The pm2 settings are not in the code folder.
- **Whether nginx keeps its own copy** of these replies (they are marked "may be kept 60 seconds"). The nginx settings are not in the code folder. The website itself always asks fresh.
- **Real browsers and phones.** Should fix 1, 2 and 4 come from reading the code and the page styles. Please confirm them on a 1366 or 1440 px laptop with a mouse, and by coming back to the home page after a stock change.
- **Google reading the store facts.** This needs Google's Rich Results test on the live site.
- **Speed** on a slow connection was not measured.
- **Other reviewers' parts**: the push logic behind the alerts box, the header and search, and the category, collection and saree pages that the home links lead to.

## 8. For the developer

- **Arrows stale after load** (`components/useRail.js:9-45`). `paint()` runs only on mount, scroll and ResizeObserver. The ResizeObserver watches the rail box, whose size does not change when 6 skeletons become 10 tiles of the same aspect ratio.
  - Fix: also run `paint` from a `MutationObserver({ childList: true })` on the rail, or pass the item count as an effect dependency and call `paint()`.
- **Category and craft strip overflow on desktop** (`theme/home.css:5-7`, `pages/home/HomePage.jsx:29-44`). The strip is `overflow-x: auto` with the scrollbar hidden, and has no rail behaviour.
  - Fix: reuse `useRail` + `RailNav` for `.cat-strip` (drag + arrows), or wrap the strip onto two lines from about 1000 px up.
- **Catalogue error hides the list** (`pages/home/HomePage.jsx:96-108`).
  - Fix: always render `<ShopList>`, and replace only `<LatestCollections>` (and the strip) with the error box when `!catalog && status === 'error'`.
- **Invisible cards and tiles after a background refresh**:
  - `data/resource.js:26` keeps `status: 'ready'` while refetching;
  - `ShopList.jsx:65` deps are `[listKey, items.length, loadingFirst]`, and `HomePage.jsx:76` deps are `[status]`;
  - a changed item with a new key mounts with `.reveal` but no `.in`, so `shop.css:19` keeps it at opacity 0.
  - Fix: add `items.map((c) => c.slug).join()` (and the tile ids) to the reveal deps, or have `useReveal` watch with a `MutationObserver`.
- **"N new sarees" link** (`HomePage.jsx:59`). `/shop?sort=new` is dropped by `filters.js:23` (`'new'` is not in `SORTS`), and the server has no "added since" filter.
  - Fix: add a `new=1` list filter (server: `createdAt >= now - NEW_DAYS`) and link to `/shop?new=1`, or change the link text to "New in" with no number.
- **Trial names** (`services/shop/catalog.service.js:99-117`). `TRIAL_NAME` (`:51`) is applied only to `soon.upcoming` (`:141`).
  - Fix: apply `TRIAL_NAME` in `visibleWhere()` (exclude `subcategory.name` matching, via a name list or a flag) so the list, counts and Latest all agree, and also exclude trial category names from `soon`. Better long-term: a real "test" flag in the admin app, rather than defaulting new sarees to `channel = 'both'` (`services/product.service.js:227`).
- **"New" by `Product.createdAt` only** (`catalog.service.js:68`, `:94-95`, `:166`).
  - Fix: use `max(product.createdAt, newest in_stock Piece.createdAt)` as the "arrived" date. Optionally also record when a saree first became visible.
- **"Coming soon" for sold-out or store-only categories** (`catalog.service.js:131-142`).
  - Fix: only treat a category as `soon` if it has no products at all on the online channels (any stock), or add a "show on website" category switch back to the admin app (`schema.prisma:284`).
- **Wrong error wording** (`HomePage.jsx:99-100`, `ShopList.jsx:111-112`).
  - Fix: show `error.message` from the resource entry (the ApiError already has plain text for 429, 5xx, offline and timeout).
- **Skeleton circles during the error state** (`HomePage.jsx:25-27`).
  - Fix: render nothing, or a static row, when `status === 'error'`.
- **Empty-shop wording** (`ShopList.jsx:120`).
  - Fix: use "No sarees on the website right now" when `!filtered && !f.q`. In `LatestCollections`, hide the section when `cols.length === 0`.
- **"pieces" on tiles** (`CollectionTile.jsx:13`).
  - Fix: say "sarees", or send and show real piece totals (the sum of `available`) from `buildSummary`.
- **Stale numbers**:
  - `summary()` is time-only (`catalog.service.js:158-163`) and `forgetCatalog` is never called outside tests;
  - the website refetches only on mount (`resource.js:37-41`).
  - Fix: call `forgetCatalog()` after admin product, stock and collection changes, and refetch `catalog` on `visibilitychange` when it is older than 60 s.
- **Rebuild blocks all calls and doesn't fall back** (`catalog.service.js:158-163`).
  - Fix: serve `cached.value` while `pending` rebuilds (stale-while-revalidate), and on a failed rebuild keep serving the last value for a few minutes.
- **Broken photo fallback** (`CategoryPhoto.jsx:7`, `CollectionTile.jsx:10`, `HomePage.jsx:40`).
  - Fix: add an `onError` that swaps to `<span className="ph-missing" />`, as `SareeCard.jsx:39` does.
- **Heavy craft and circle photos** (`catalog.service.js:145`, `:114`, `:125`).
  - Fix: serve a small thumbnail variant (for example 160 px) for circles and tiles if the photo storage offers one; otherwise leave it.
- **Old `/home`** (`catalog.service.js:184-208`, `routes/shop/index.js:48`).
  - Fix: remove it, with `shopApi.home` (`api/shop.js:8`) and the e2e fixture (`e2e/w2.e2e.cjs:461`), after the new website goes live.
- **Long names** (`data/categories.js:5-13`, `theme/shop.css:92-93`).
  - Fix: add a 2-line clamp (`-webkit-line-clamp: 2`) to `.cs` labels and `.ctile .t b`.
- **Minor**: `useMeta` on home never resets `og:image` left by a saree page (`utils/useMeta.js:23`). This only matters for previewers that run JavaScript.
  - Fix: pass the default image from `HomePage.jsx:71`.

  > **Second check: ✅ Correct.**
- **Checked and fine**:
  - prices are rounded the same way on the cards, the bag and checkout;
  - product and collection category stay in sync (`product.service.js:254`, `:321`), so "All N" equals the unfiltered list total;
  - JSON-LD is escaped (`HomePage.jsx:93`);
  - all site photos named in `categories.js` exist in `public/img/site`;
  - the list query never returns 400 (every field has `.catch`);
  - `trust proxy` is set, so the 240-a-minute limit is per real visitor network.

## Second check (26 Oct 2026)

All 19 findings were checked against the code (8 Should fix, 10 Small, and the extra "Minor" one in "For the developer"): **✅ 18 · ⚠️ 1 · ❌ 0.**

- ⚠️ Should fix 3: real, but rarer than stated, because both calls share one server summary. Small, not Should.
- Since 26 Oct ~13:55 IST this home page is **live**, so line 3 ("not live yet") and section 3.4 are out of date. The Should fixes now affect real customers, and the old `/home` (Small 8) can be removed once its browser-test fixture is changed.
- Extra issue raised in the check file (hidden up-down scroll in the Latest collections row): **Third check: real (about 85% sure), Small.** Tiles not yet faded in sit 26 px low and the row only sets `overflow-x: auto`, so it gets ~20 px of hidden up-down scroll; a wheel turn or swipe starting on the row can nudge the tiles up instead of scrolling the page. Fix: `overflow-y: hidden` on `.rail` (`shop.css:66`), which also covers the saree-page and bag rows.

Details and evidence: [checks/04-home-check.md](checks/04-home-check.md).

## Third check (26 Oct 2026)

A third checker re-checked the one ⚠️ finding (Should fix 3) and the second checker's extra issue against the code (read only, nothing run).
Counts: **Second checker right 1 · First reviewer right 0 · Both partly right 0 · Neither right 0.** Extra issue: **real**.
- Should fix 3: the list really is hidden when only the catalogue fails, but the server builds both answers from one summary, so this needs a lone dropped request or a 429 at the limit. Rare, and Try again fixes it. **Small.**
- Extra: the Latest collections row has ~20 px of hidden up-down scroll until all its tiles have faded in. **Small**; fix `overflow-y: hidden` on `.rail`.
- Noticed in passing (Module 7, not verified there): the bag page's "Recently viewed" cards are probably invisible, because `BagPage.jsx` never runs `useReveal`.

Full evidence: [checks/04-home-third-check.md](checks/04-home-third-check.md).

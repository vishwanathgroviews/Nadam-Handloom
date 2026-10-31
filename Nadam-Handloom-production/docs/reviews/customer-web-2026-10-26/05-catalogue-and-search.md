# Module 5: Catalogue and search (review of 26 Oct 2026)

I only read the code: the server (`Nadam-backend`) and the website (`Nadam-frontend/customer-web`). I did not run anything, open the live site or touch any database. Every problem below names the file and line.

Words used once and explained:
- **Server**: the shop's computer that answers the website.
- **API**: a question the website asks the server, like "give me 24 sarees".
- **Cache**: a short-term copy kept in memory so the same answer isn't worked out again.
- **Address**: the web address in the browser bar (the URL).

---

## 1. What this module does

It lets customers find sarees. It covers the category pages, the collection pages, the "All collections" page, every saree list (with filters, sort and "Load more"), and the search bar in the header. It shows only sarees that can really be bought on the website today.

## 2. What a customer sees and does

1. In the header the customer sees: All sarees, the 6 categories (short names, the one with most sarees first, "Coming soon" ones last), New in, Sets. On a computer, each category opens a small menu with its biggest collections, its crafts and a photo.
2. They open a **category**: a slim banner, then every collection of that category as a photo tile, the one with most pieces first. A category with nothing on the website says **"Coming soon"**, lists the collections on the way and offers **Ask on WhatsApp**.
3. They open a **collection**: its name, number of pieces, price, and its text. Below that are all its sarees, with **Sets only**, **Sort**, **grid size** (3 or 4 in a row, remembered) and **Load more**.
4. Or they open **All sarees** (or the list on the home page): filters on the left (on phones, a **Filter** button at the bottom), the chosen filters as small chips with an ×, **Clear all**, sort, and Load more.
5. Or they open **All collections** and pick a craft chip to see only those collections.
6. Or they **type in the search bar**. After 2 letters, suggestions appear: crafts, collections and the first 4 sarees. **Enter** shows every result.
7. Everything they choose is kept in the address. Sharing the link or pressing **Back** should show the same list at the same place.

---

## 3. Each API

Both APIs are public (no sign-in). They are under `/api/v2/shop`. Each call counts toward a limit of **240 calls a minute per network** (`Nadam-backend/src/routes/shop/index.js:47-50`). When the website switch in the admin app is off, every call answers "website being updated" (`Nadam-backend/src/middlewares/shopGuard.js:45-52`).

### 3.1 `GET /catalog`: the shop's menu

| | |
|---|---|
| **What it is for** | Everything the menus, category pages, collection headings, the All collections page and the search suggestions need. |
| **What goes in** | Nothing. |
| **What comes back** | **totals**: number of sarees, collections, sets, and new sarees (last 10 days). **categories** (only those with sarees): web name, name, text, photo, number of sarees, number of collections. **soon** (categories with nothing on the website): web name, name, text, photo, and up to 12 names of collections on the way (never one whose name starts with "test1", "test …"). **collections** (only those with sarees, most sarees first): id, name, category, craft, price, price band, number of sarees, number of sets, photo, short text, when its newest saree came in, and "New" (newest saree in the last 10 days). **crafts** (only crafts with sarees): key, name, number of sarees, number of collections, photo. **priceBands**: the 4 price ranges. |
| **What is saved** | Nothing, except one row in the request counter (for the 240-a-minute limit). |
| **What can go wrong** | **Too many calls** from one network (code `RATE_LIMITED`): the page says "We couldn't load the collections. Please check your connection…" (the wrong reason, see Small 1). **Website switched off** (`MAINTENANCE`): the whole website shows the maintenance page. **Server fault** (`INTERNAL`): the same "couldn't load" message with **Try again**. **No answer in 20 seconds**: the same message. |

Code: `Nadam-backend/src/services/shop/catalog.service.js:169-179` (the reply) and `:77-156` (how it is worked out).

### 3.2 `GET /products`: one page of sarees

| | |
|---|---|
| **What it is for** | Every saree list: All sarees, a category or craft list, Sets, New in, a collection page, search results, and the 4 sarees in the search suggestions. |
| **What goes in** | The filters below, all optional. |
| **What comes back** | **items**: up to 24 saree cards (web name, code, name, collection, category, craft, price, how many are available, first photo, "New" if added in the last 10 days, date added). **total**: how many sarees match. **offset / limit**: which page this is. **nextOffset**: where the next page starts, or nothing if this is the last page. **facets**: the numbers shown beside each filter choice (category, craft, price, collection). |
| **What is saved** | Nothing, except one row in the request counter. |
| **What can go wrong** | It never refuses bad filters: anything wrong is ignored. Otherwise the same errors as `/catalog`. On the list the customer sees "We couldn't load the sarees. Please check your connection and try again." with **Try again**. If only a later page fails: "Couldn't load more. Try again". |

**Each filter, its rule, and what happens with junk** (`Nadam-backend/src/validators/shop/catalog.validators.js:9-23`):

| Field | Rule | Junk or old value |
|---|---|---|
| `category` | One category's web name: small letters, digits and dashes, up to 80. Capitals are made small. | Other characters: ignored (all categories). An unknown name that fits the rule is still applied, so it gives **0 sarees**. |
| `collection` | One collection id (a long code). | Not a valid code: ignored. A valid code that is not on the website: **0 sarees**. |
| `craft` | One or more of the 8 craft keys, separated by commas (`craft=pure,checks`). | Unknown keys are dropped. If the field is sent twice (`craft=a&craft=b`), **all** crafts are dropped. The website never does this. |
| `price` | One of `u25`, `25-35`, `35-50`, `o50`. | Ignored. |
| `sets` | `1` or `true`. | Anything else means off. |
| `q` (search) | Text, trimmed, up to 60 characters. `%`, `_` and `\` become spaces. | Over 60 characters, or nothing left after cleaning: the **whole search is ignored**, so every saree comes back. |
| `sort` | `new` (newest first), `price-asc`, `price-desc`. | Anything else: newest first. |
| `offset` | Whole number from 0 to 10,000. | Anything else, including over 10,000: 0 (the first page). |
| `limit` | 1 to 48. | Anything else: 24. |
| anything else | (`page`, `utm_source`…) | Dropped. |

Hidden characters (like `%00`) are removed from every field first (`Nadam-backend/src/utils/text.js:7-10`).

**What the server does, step by step** (`Nadam-backend/src/services/shop/catalog.service.js:254-297`):
1. It takes the one-minute summary of every visible saree (see 4.8).
2. It applies the saree-level filters: "visible on the website", "Sets only" (from the summary's list of sets) and the search.
3. It applies the collection-level filters (category, collection, craft, price) by picking the matching collections from the summary.
4. It fetches one page in the chosen order and counts the total, in two separate questions to the database.
5. It works out the filter numbers. Each group's numbers allow for the **other** groups' choices but not its own. Example: with "Embroidery" chosen, the price numbers count only embroidery sarees, but the craft numbers still show every craft. When search or Sets only is on, the numbers are counted fresh. Otherwise they come from the one-minute summary. Collections with 0 are left out of the collection list.
6. Sort: newest first = date added, newest first. Price = the collection's website price, then newest. The order never changes between two calls, so pages don't shuffle on their own.

**How search matches** (`catalog.service.js:228-251`): up to 6 words are used. **Every** word must be found somewhere: in the saree's name, its code, its collection's name or its category's name. Capitals don't matter. A word that names a craft also finds every collection of that craft ("kalamkari" finds the "kalankari" collections; "print" finds digital and screen prints; "embroidered" finds embroidery). It does not understand spelling mistakes (other than craft words), plurals ("materials", "sarees"), Telugu, prices or colours that are not in the name.

**How the search bar uses it** (`Nadam-frontend/customer-web/src/components/SearchBox.jsx:27-36`): 0.25 seconds after the customer stops typing (2 letters or more), it asks `/products?q=<text>&limit=4`. If they type again, the older question is cancelled. Errors are hidden: the crafts and collections suggestions (worked out on the website from `/catalog`) still show.

---

## 4. The data kept

These are the database tables this module reads. It never writes to them (only the request counter). On the website, a **subcategory** is called a **collection** and a **product** is called a **saree**.

### 4.1 Category (for example "Pattu sarees")

| Field | What it means | Must have it? |
|---|---|---|
| id | Its own code | Yes, made automatically |
| name | Full name, for example "Mangalagiri Handloom Pattu Sarees". The website tidies ALL-CAPITAL names. | Yes |
| slug | The name used in the web address (`/category/<slug>`). No two can be the same. | Yes, unique |
| description | The text under the banner (the pattu category uses fixed words written in the code instead) | Yes (can be empty) |
| imageUrl | Its photo. If empty, the newest collection's photo is used. 4 categories use the website's own photos instead. | No |
| storageKey | Where the photo file is kept (not used here) | No |
| sortOrder | The order set in the admin app. **The website ignores it**: the category with most sarees comes first. | Default 0 |
| isActive | Old on/off switch. Must be on. | Default on |
| status | "active", or "inactive" (deleted). Must be active. | Default active |
| createdAt / updatedAt | When it was made / last changed | Automatic |

### 4.2 Subcategory = Collection (for example "Pure Pattu 350k Butta Saree")

| Field | What it means | Must have it? |
|---|---|---|
| id | Its code. It is part of the collection page's address. | Yes, automatic |
| categoryId | Which category it belongs to | Yes |
| name | Its name. Every saree in it carries the same name. Words in the name decide its **craft** ("Embroidery", "Kalamkari"…). | Yes |
| description | Its text on the collection page (shortened to about 240 letters, or shown as points) | Yes (can be empty) |
| imageUrl | Its photo. If empty, the first photo of its newest saree is used. | No |
| storageKey | Where the photo file is kept | No |
| sortOrder | Admin order. The website ignores it: most sarees first. | Default 0 |
| isActive | The "Show on website" switch. Off hides all its sarees. | Default on |
| status | "active", or "inactive" (deleted) | Default active |
| onlinePrice | The website price of every saree in it. **Under ₹500 hides all its sarees** (treated as a typing mistake). It also decides the price filter and the price sort. | Yes |
| storePrice | Counter price. **Never sent to the website.** | Yes |
| mrp | Never shown on the website | No |
| createdAt / updatedAt | When made / changed | Automatic |

### 4.3 Product = Saree

| Field | What it means | Must have it? |
|---|---|---|
| id | Its own code | Yes, automatic |
| slug | Its web address (`/product/<slug>`) | Yes, unique |
| sku | The code shown on the card (for example "NH-…"). Search finds it. | Yes, unique |
| name | Always the same as its collection's name | Yes |
| categoryId | Its category. Used for "visible or not", for the card, and for search by category name. | Yes |
| subcategoryId | Its collection. Every filter works through this. | Yes |
| technique, borderStyle, purity, zariTier, blouseType, pattern, color, fabric | Details shown on the saree page. Not searched, not filtered. | No |
| occasion | A list of occasions (saree page only) | Default empty |
| channelVisibility | Where it is sold: `online_only` or `both` are shown; `store_only` and `hidden` are not | Default `both` |
| trackingMode | For the staff app only | Default "quantity" |
| stock | Old count of untagged pieces | Default 0 |
| isFeatured | Not used here | Default off |
| isActive | Switched on | Default on |
| deletedAt | When it was archived. Any date means never shown. | No |
| clientRef, batchId | Admin app only | No |
| createdAt | When it was added. It decides "Newest first" and the **New** badge (10 days). | Automatic |
| updatedAt | When changed | Automatic |

### 4.4 ProductImage = a saree's photo

| Field | What it means | Must have it? |
|---|---|---|
| id | Its code | Yes, automatic |
| productId | Which saree | Yes |
| url | The photo's address | Yes |
| storageKey | Where the file is kept | No |
| altText | Words read out by screen readers. If empty: "name, collection". | No |
| sortOrder | Order of photos. The first is the card photo. | Default 0 |

### 4.5 Piece = one tagged piece of a saree

| Field | What it means | Must have it? |
|---|---|---|
| id | Its code | Yes, automatic |
| productId | Which saree | Yes |
| barcode | The tag number | Yes, unique |
| status | Only **in_stock** counts as available. `reserved` (held during someone's payment), `sold_online`, `sold_offline`, `damaged`, `returned`, `retired` and `removed` do not. | Default in_stock |
| soldAt | When sold | No |
| createdAt / updatedAt | When made / changed | Automatic |

**Available** = old stock count + tagged pieces in stock. **More than 1 available = a set** ("Set of 3", Sets only).

### 4.6 Other tables touched

| Table | Field | What it means |
|---|---|---|
| RateLimitHit | bucketKey, createdAt | One row per call, to count the 240-a-minute limit per network. Old rows are deleted after about 2 hours. |
| AppConfig | webMaintenanceEnabled, webMaintenanceMessage | The website on/off switch and its message (read at most every 10 seconds) |

### 4.7 When a saree is on the website (the exact rules)

From `Nadam-backend/src/services/shop/visibility.js:9-19`. **All** must be true:
1. The saree is switched on, and not archived.
2. It is set to "Online only" or "Both".
3. Its category is switched on and active.
4. Its collection is switched on, active, and its website price is **₹500 or more**.
5. It has **at least one photo**.
6. It is **in stock**: old stock above 0, or at least one tagged piece "in stock".

For lists there is one more condition: its collection must be in the one-minute summary (so a brand-new collection can be missing for up to a minute).

**"Coming soon" category**: a category that is switched on but has no saree passing the rules above.

### 4.8 The memories (caches)

- **On the server**: a summary of every visible saree (counts, sets, crafts, collection photos) is worked out at most **once a minute**, one at a time (`catalog.service.js:158-163`). It is **not** refreshed when the owner changes something in the admin app. The refresh function (`catalog.service.js:75`) is only used by the tests.
- **In the browser**: the website keeps each answer in memory. It reuses an answer for 60 seconds. After that it still shows the old answer at once and asks again quietly (`Nadam-frontend/customer-web/src/data/resource.js:5-28`). Nothing is ever cleared while the tab is open.
- The server labels the answers "can be kept for 60 seconds by anyone". The website itself tells the browser not to store them (`src/api/client.js:60`), so only a go-between server (like a CDN) could use that label.

---

## 5. On the website

### Category page (`/category/<name>`), `src/pages/shop/CategoryPage.jsx`
- **Waiting**: a banner with no photo, the word "Category", and 8 grey tiles.
- **Ready**: banner photo, "1,532 pieces · 40 collections", the name and text. Then "Choose a collection · N collections" and "The most pieces first · tap one to see its sarees". Each tile shows a photo, a **New** badge if a saree came in during the last 10 days, the name, and "33 pieces · ₹5,800".
- **Coming soon**: "Coming soon" on the banner. A box says "<Name>: new pieces coming soon" and "We're adding them to the website. Ask us on WhatsApp…". It shows chips with the collections on the way, an **Ask on WhatsApp** button (message: "Hello, do you have … ? Please send photos."), and "Or see:" with the other categories.
- **Not found** (unknown or switched-off category): "This category isn't on the website now", with **See all sarees** and **Go to the home page**.
- **Error**: "We couldn't load the collections. Please check your connection and try again." with **Try again**.

### Collection page (`/category/<name>/<collection code>`), `src/pages/shop/CollectionPage.jsx`
- **Heading**: Home › category › collection. The craft name, the collection name, "33 pieces · ₹5,800 each · 4 available as sets", and its text.
- **Toolbar**: **Sets only** (shown only if the collection has sets), the count ("33 sarees", or "Loading…" while waiting), **Sort by** (Newest first / Price: low to high / Price: high to low), and **grid size** (3 or 4 in a row, remembered in this browser).
- **Cards**, then "You've seen 24 of 33" with a bar and **Load more**.
- **Sold out**: "This collection isn't on the website now. It may have sold out." If it sold out within the last minute, the list instead says "No sarees match these filters. Everything in this collection has sold out. See the other collections."
- **Error**: "We couldn't load this collection…" with **Try again**.

### All collections (`/collections`), `src/pages/shop/CollectionsPage.jsx`
- "All collections" and "76 collections, 1,7xx pieces in stock". Craft chips: "All 76", "Embroidery 12"… The chosen craft is kept in the address (`?craft=embroidery`). An unknown craft in the address means All.
- One section per category, with a "Shop all N" link and the collection tiles.
- **Waiting**: grey tiles. **Error**: "We couldn't load the collections. Please check your connection." with **Try again**.

### Saree lists (`/shop`, and "All sarees" on the home page), `src/pages/shop/ShopList.jsx`, `ShopPage.jsx`, `Filters.jsx`
- **Title**, by what is chosen: "Results for "red"", "Sets for the family", a craft name, a category name, "New in", or "All sarees". Then the count and a line of text.
- **Sort**: a drop-down on computers. On phones, a "Sort: …" button at the bottom opens a sheet.
- **Chips** for each chosen filter, each with an ×. "Clear all" appears when there are 2 or more.
- **Filters** (left column on computers; on phones the **Filter** button opens a sheet with "Clear all" and "Show 1,234 sarees"):
  - Category: pick one.
  - Craft: pick several.
  - Price: pick one.
  - Sets only.
  - Collection: pick one. The first 8 are shown, then "Show all N".
  - Each choice has a number beside it. Choices with 0 are faded but can still be clicked. A group shows only when it offers a real choice.
- **Cards**: photo; badges **New**, **Set of 3** or **Sold out**; a small label; name, price and code; **Add to bag**.
- **Load more**, with "You've seen X of Y" and a bar. If a later page fails: "Couldn't load more. Try again".
- **Nothing found**: "Nothing found for "x"" (search only) or "No sarees match these filters". Below that: "Try removing a filter, or see everything in the shop." and **Clear filters**.
- **Error**: "We couldn't load the sarees. Please check your connection and try again." with **Try again**.
- **Waiting**: 8 grey cards and "Loading…". On a slow connection the website waits up to 20 seconds, then shows the error.

### Search bar (header), `src/components/SearchBox.jsx`
- Placeholder: "Search sarees, crafts, codes…".
- From 2 letters it suggests: **Crafts** (up to 2), **Collections** (up to 4, by name), **Sarees** (up to 4, with photo, name, code and price) and **See all results for "x"**.
- **Arrow down/up** move through the suggestions. **Escape** closes them (a second Escape empties the box). **Enter** opens the results page. A click outside closes them.
- The results page is the saree list titled "Results for "x"".

### Header menus, `src/components/Header.jsx`
- Menu items: All sarees, the 6 categories, New in, Sets. On computers each category opens a menu with up to 8 collections and "All N collections", its crafts (links to that category + craft), and a photo with "Shop all N". A "Coming soon" category lists what is on the way.

### What the address keeps
- `category`, `collection`, `craft=a,b`, `price`, `sets=1`, `q`, `sort`, and `page` (how many pages are loaded, 1 to 20) (`src/pages/shop/filters.js:14-27`).
- Changing a filter **replaces** the address. So Back leaves the list rather than undoing one filter.
- Unknown values are dropped on the website as well as on the server.
- Grid size is kept in the browser, not in the address.

---

## 6. Problems found

### Must fix

**M1. "Load more" stops working after 480 sarees, but the button stays.**
- What happens: the website loads at most 20 pages of 24 (480 sarees). On page 20 the button still says "Load more". Pressing it changes the address to `page=21`, but nothing loads. "You've seen 480 of 1,7xx" stays on screen.
- Why it matters: "All sarees" (on the home page and `/shop`) has about 1,700 sarees, and Pattu sarees about 1,500 (late-October counts). A customer who keeps scrolling hits a dead button and cannot reach more than 1,200 sarees without filters. It looks broken.
- Where: `Nadam-frontend/customer-web/src/pages/shop/filters.js:27` (the limit of 20), `src/pages/shop/ShopList.jsx:73-77` (Load more adds a page), `ShopList.jsx:63` and `:138` (the button shows whenever the server says there is more). The limit is also written into the tests (`filters.test.js:17-19`). The live site probably has it too, since lists went live on 16 Oct. Not checked on the live site.

> **Second check: ⚠️ Partly correct: the dead button after 480 sarees is real (`filters.js:27` caps at 20 pages while the server still sends `nextOffset`), but it is a Should fix, not a Must: no money, order, stock or data is wrong and the customer is not stuck, because every saree is still reachable through the category → collection pages (no filters needed), the filters, the three sorts and search; "cannot reach more than 1,200 sarees without filters" is overstated.**
>
> **Third check: Second checker right. Final: on any list over 480 sarees (All sarees, New in, the Pattu filter, the two cheapest price bands) the 20th "Load more" does nothing and the button stays, but every saree is still reachable through the category → collection pages, the Collection or Craft filters, or search, so the customer is not stuck. Final group: Should fix.**

### Should fix

**S1. The same saree can appear twice, or one can be skipped, when "Load more" is pressed while stock changes.**
- What happens: each page is fetched separately, as "sarees 25 to 48". Say the shop adds a saree (newest first) between page 1 and page 2. Everything moves down one place, so the last saree of page 1 shows again at the top of page 2. If a saree sells or is held at checkout in between, everything moves up one, and one saree is never shown. A saree shown twice can also make the page draw cards wrongly, because the website expects each card to appear once.
- Why it matters: it is likely while the owner is uploading a batch or during a busy sale. The window is the first minute after page 1 loads (after that, all pages are fetched again together).
- Where: `Nadam-frontend/customer-web/src/data/shop.js:21-24` (pages by position), `src/data/resource.js:21` (pages reused for 60 seconds), `src/pages/shop/ShopList.jsx:57` (pages joined with no check for repeats) and `:128` (each card is identified by its web name), `Nadam-backend/src/services/shop/catalog.service.js:268` (skip N, take 24).

> **Second check: ✅ Correct.**

**S2. Back doesn't return to the same place after "Load more" if the customer doesn't scroll first.**
- What happens: the place on the page is only saved when the customer scrolls. "Load more" (and each filter change) creates a new history entry with nothing saved yet. On a computer, the new cards appear where the button was. If the customer clicks one straight away and then presses Back, the list opens at the **top**, with all pages loaded, and they must scroll through everything again.
- Why it matters: "Back keeps the place" is a promised feature, and this is a common way to use Load more on a computer.
- Where: `Nadam-frontend/customer-web/src/components/ScrollManager.jsx:88` (saved only on scroll), `:95` (moves to the new entry with no saved place), `:99-102` (no saved place means jump to the top).

> **Second check: ✅ Correct.**

**S3. Going to another list from the header while already on a list keeps the old scroll position.**
- What happens: the header stays on screen while scrolling. A customer is halfway down "All sarees" and taps **Sets**, **New in**, a craft in a category menu, or searches. The new list opens at the same height on the page, in the middle of the new results. The title ("Sets for the family", "Results for …") and the first sarees are above the screen.
- Why it matters: the customer sees sarees from the middle of the list and may think the first ones are the results, or miss that the list changed.
- Where: `Nadam-frontend/customer-web/src/components/ScrollManager.jsx:96` and `:102` (jumps to the top only when the page path changes, and `/shop` → `/shop?sets=1` is the same path). The links are at `src/components/Header.jsx:122-125` and `:60`, and the search at `src/components/SearchBox.jsx:60`.

> **Second check: ✅ Correct.**

**S4. Search finds nothing for everyday words: plurals and common spellings.**
- What happens: each word must appear exactly inside a name. The shop's names say "Dress Material", "Lehanga", "Duppata", "Zute", and the cotton category is (by its address) "Handloom Cotton Saree". So "pattu dress materials" (the menu's own words), "lehenga", "dupatta", "jute saree" and "cotton sarees" probably all say "Nothing found", even though such pieces are on the website. The extra spelling help exists only for craft words.
- Why it matters: these are likely searches, and "Nothing found" loses the customer.
- Where: `Nadam-backend/src/services/shop/catalog.service.js:234-251` (exact "contains" match per word), `Nadam-backend/src/config/constants.js:165-174` (spelling help only for crafts), and the same for suggestions in `Nadam-frontend/customer-web/src/components/SearchBox.jsx:45-52`. Not sure of the exact category names: I read them from their web addresses.

> **Second check: ✅ Correct.**

**S5. A collection page says "Everything in this collection has sold out" when only the "Sets only" filter finds nothing.**
- What happens: someone shares a collection link with **Sets only** on (`?sets=1`). Later the last set sells. The person opening the link reads "No sarees match these filters. Everything in this collection has sold out", although single pieces are still in stock. The same wrong sentence shows for any filter in the address. Also, when the collection really has just sold out (and nothing was chosen), the heading still says "No sarees match these filters".
- Why it matters: the customer believes the collection is gone and leaves.
- Where: `Nadam-frontend/customer-web/src/pages/shop/CollectionPage.jsx:40` (the sold-out sentence) and `src/pages/shop/ShopList.jsx:120-121` (it is used whatever filters are on).

> **Second check: ✅ Correct.**

**S6. A chosen collection with no matching sarees shows its long code on the filter chip.**
- What happens: on All sarees, a customer picks a collection, then ticks Sets only, and that collection has no sets. Or they open an old shared link to a collection that has sold out. The chip then shows something like "3f2a9c1e-…", and no collection is ticked in the filter list.
- Why it matters: a confusing code instead of a name, at the moment the customer is already seeing "No sarees match".
- Where: `Nadam-backend/src/services/shop/catalog.service.js:291-294` (collections with 0 are left out of the numbers), `Nadam-frontend/customer-web/src/pages/shop/ShopList.jsx:81` and `:88` (chip text falls back to the code), `src/pages/shop/Filters.jsx:39`.

> **Second check: ⚠️ Partly correct: the code chip is real (server drops the chosen collection at `catalog.service.js:294`, and `ShopPage.jsx:38` / `HomePage.jsx:106` pass no collection names), but it only shows when the list is already empty, with "Clear filters" and a working ×; it is a wrong label only, so Small, not Should.**
>
> **Third check: Second checker right. Final: when a chosen collection has no matching sarees (Sets only on a collection without sets, or an old link to a sold-out collection), the empty list's chip shows the collection's long code instead of its name, while the × and Clear filters still work. Final group: Small.**

### Small

1. **Wrong reason in error messages.** "Too many requests" or a server fault shows "Please check your connection". Where: `Nadam-frontend/customer-web/src/pages/shop/ShopList.jsx:111-112`, `CategoryPage.jsx:50`, `CollectionPage.jsx:26`, `CollectionsPage.jsx:39`.
   > **Second check: ✅ Correct.**
2. **A search the server ignores still says "Results for …".** If the search is only symbols (`%`, `_`, `\`) or longer than 60 letters, the server drops it and sends every saree. The page then shows all 1,7xx sarees under "Results for "%"". The suggestions show the 4 newest sarees, unrelated to the text. Where: `Nadam-backend/src/validators/shop/catalog.validators.js:19`, `Nadam-frontend/customer-web/src/pages/shop/filters.js:22`, `src/pages/shop/ShopPage.jsx:12`, `src/components/SearchBox.jsx:31` and `:77` (the box has no 60-letter limit).
   > **Second check: ⚠️ Partly correct: symbols-only searches (and the suggestions for a 61+ letter term) are ignored as described, but a search longer than 60 letters does NOT show every saree on the results page, because the website cuts it to 60 letters first (`filters.js:22`, `.trim().slice(0, 60)`), which the server accepts.**
   >
   > **Third check: Second checker right. Final: a search made only of `%`, `_` or `\` shows every saree under "Results for "%"", and the suggestion box shows the 4 newest sarees for such a term or one over 60 letters; a long search on the results page is just cut to 60 letters and works. Final group: Small.**
3. **Admin changes take up to about 2 minutes to show** on collection tiles, counts and filter numbers: up to 1 minute on the server plus up to 1 minute in the browser. A brand-new collection's sarees are missing from every list for up to a minute. Saree prices on cards are always current. Where: `Nadam-backend/src/services/shop/catalog.service.js:75` (the refresh is never called), `:158-163`, `:265`, and `Nadam-frontend/customer-web/src/data/resource.js:5`.
   > **Second check: ✅ Correct.**
4. **A database hiccup during the once-a-minute refresh breaks every list** instead of using the older summary. Where: `Nadam-backend/src/services/shop/catalog.service.js:161`.
   > **Second check: ✅ Correct.**
5. **The number beside a filter can differ from the list total** for up to a minute (for example "Embroidery 306" but "305 sarees"). Where: `catalog.service.js:261-264` (from the summary) and `:269` (counted fresh).
   > **Second check: ✅ Correct.**
6. **Telugu search** always finds nothing ("Nothing found for "పట్టు""), with no hint to try English. Where: `catalog.service.js:234-251`.
   > **Second check: ✅ Correct.**
7. **The collection page doesn't show extra filters from the address.** It has no chips, so a link like `/category/x/<id>?price=u25` shows fewer sarees with no visible reason. Where: `ShopList.jsx:45` and `:152-171`.
   > **Second check: ⚠️ Partly correct: extra address filters are applied with no chips, but the example is wrong: a collection has one price (and one craft), so `?price=u25` gives all or nothing, never "fewer" (and an empty result does show a Clear filters button); only `?q=…` really shows fewer sarees with no visible reason.**
   >
   > **Third check: Second checker right. Final: a hand-edited collection link with `?q=…` shows fewer sarees with no chip to say why, while `?price=` or `?craft=` show all or nothing (and nothing comes with Clear filters). Final group: Small.**
8. **"Sets only" disappears** when no other filter group is worth showing (for example a search that finds one collection only), because it lives inside the filter panel. Where: `ShopList.jsx:93`, `:186`, `:193`, and `Filters.jsx:66-71`.
   > **Second check: ✅ Correct.**
9. **Search bar and keyboard or screen-reader users.** Tabbing away leaves the suggestions open. The box doesn't tell screen readers it has a suggestion list. Where: `SearchBox.jsx:38-43` and `:77-81`.
   > **Second check: ✅ Correct.**
10. **A category address with capitals** (`/category/Fabrics`) says "This category isn't on the website now". Where: `CategoryPage.jsx:42`.
    > **Second check: ✅ Correct.**
11. **The website keeps its own copy of the 8 craft keys and 4 price ranges.** If the server adds one, the website drops it from links (for example a header link to the new craft shows All sarees). Where: `Nadam-frontend/customer-web/src/pages/shop/filters.js:11` and `src/data/crafts.js:2-23`.
    > **Second check: ✅ Correct.**
12. **The browser's memory of answers is never cleared** in a long visit: every search and filter mix is kept. Where: `src/data/resource.js:6`.
    > **Second check: ✅ Correct.**
13. **"pure pattu" also lists Plain and Butta collections**, because they share the craft group "Pure Pattu & Plain". Not sure if the owner wants this. Where: `Nadam-backend/src/config/constants.js:173` and `catalog.service.js:228-246`.
    > **Second check: ✅ Correct.**

### Checked and fine
- The visible-or-not rule is the same for lists, counts, the menu and the admin app's "On the website" line.
- The price ranges cover every whole rupee (no gaps between ₹2,499, ₹2,500, ₹3,500, ₹3,501…).
- One-choice and many-choice filters match on both ends: one category, one price, one collection; several crafts.
- Search text is passed to the database safely, and `%` and `_` (which would match everything) are removed.
- No store price, MRP or personal data is sent.
- Old search suggestions can't replace newer ones: they are cancelled, and each answer is checked against the current text.
- Two filters that give 0 sarees show a clear message, and each option shows its 0.

---

## 7. What I could not check

- **The live website and its data**: I was not allowed to open them. The saree counts (about 1,700 on the website) come from the project notes of 25 Oct and the design note's table of 16 Oct.
- **Which version is live**: the design note says the 26 Oct design is local only. M1 and S1 were probably already in the 16 Oct lists. Not checked.
- **A go-between cache** (nginx or a CDN) that might keep the "public, 60 seconds" answers: I did not read the server's settings.
- **Old sarees whose own category differs from their collection's category.** The new admin app keeps them the same (`Nadam-backend/src/services/product.service.js:254,321`). The browser tests on a copy of real data agreed on totals, so probably none today. If any exist, the card would name one category while the filter puts it under another.
- **Old collection codes**: the server accepts only standard codes (UUIDs). The browser tests on real data opened collection pages fine, so probably all are standard.
- **How many customers share one network address** (offices, some mobile networks), and so whether 240 calls a minute per network is ever reached.
- **Real category names** (I used the web names in the code), and how the menus behave with the mouse and keyboard (that depends on the page styles).

---

## 8. For the developer

Paths: backend files are under `Nadam-backend/`, website files under `Nadam-frontend/customer-web/`.

| # | Where | Note | Suggested fix (one line) |
|---|---|---|---|
| M1 | `src/pages/shop/filters.js:27`, `ShopList.jsx:63,73-77,138` | `readPages` clamps to 20, so `page=21` gives the same keys and nothing happens. The catalogue has about 1,700 rows. | Remove or raise the cap and load restored pages in bigger chunks (e.g. allow `limit` up to 240 for a restore, or a `pages` param); at least hide Load more when `pages >= 20`. |
| S1 | `src/data/shop.js:21-24`, `ShopList.jsx:57,128`, backend `catalog.service.js:268` | Offset pages fetched at different times drift when rows are added or removed. Duplicate `key={slug}`. | De-duplicate by slug when joining pages, and switch to keyset paging (cursor = last `createdAt,id`; for price sort `onlinePrice,createdAt,id`). |
| S2 | `src/components/ScrollManager.jsx:88,95-102` | A REPLACE gets a new `location.key` (react-router `createLocation` → `createKey()`) with no saved position until the next scroll event. | In the layout effect, when `nav === 'REPLACE'`, do `positions.set(key, window.scrollY)`. |
| S3 | `ScrollManager.jsx:96,102` | A PUSH to the same pathname (`/shop` → `/shop?sets=1`, header search) never jumps to the top. | `else if (!samePage \|\| nav === 'PUSH') jump(0)`; filters already use replace, so they keep their place. |
| S4 | backend `catalog.service.js:234-251`, `constants.js:165-174`, `SearchBox.jsx:45-52` | Plain `contains` per word, no stemming or synonyms. | Strip a trailing `s`/`es` from words of 5+ letters and add a small synonym map (lehenga→lehanga, dupatta→duppata, jute→zute); mirror it in `data/crafts.js` for suggestions. |
| S5 | `CollectionPage.jsx:40`, `ShopList.jsx:120-121` | `empty` overrides the message even when the visitor chose filters. | Use `empty` (and a "Sold out" heading) only when `!filtered`. |
| S6 | backend `catalog.service.js:291-294`, `ShopList.jsx:81,88`, `Filters.jsx:39` | The chosen collection is dropped from the facets when its count is 0. | Keep it: `.filter((c) => c.count > 0 \|\| c.key === f.collection)`, and pass `labels.collection` from the catalogue as a fallback. |
| 1 | `ShopList.jsx:107-114` (and `CategoryPage.jsx:50`, `CollectionPage.jsx:26`, `CollectionsPage.jsx:39`) | `r.error.code` is available but not used. | Choose the sentence by code: `RATE_LIMITED` ("too many requests, wait a minute"), `SERVER*` ("our side"), else connection. |
| 2 | backend `catalog.validators.js:19`; web `filters.js:22`, `SearchBox.jsx:31,77`, `ShopPage.jsx:12` | Server and website disagree on when a search exists. | Add `maxLength={60}` to the input; apply the same `%_\` clean-up on the website and treat an empty result as no search. |
| 3 | backend `catalog.service.js:75,158-163,265` | `forgetCatalog()` is only called by tests; the cache is per process. | Call it after admin catalogue and product writes (or lower `CACHE_SECONDS`); don't restrict unfiltered lists to `ids`. |
| 4 | backend `catalog.service.js:161` | A failed rebuild throws even when `cached.value` exists. | On error return the stale `cached.value` if present and log the error. |
| 5 | backend `catalog.service.js:261-264` vs `:269` | Facets come from the summary; total is live. | Accept, or count facets live with `groupBy` when cheap. |
| 6 | backend `catalog.service.js:234-251` | No Telugu terms. | Map a few common Telugu words (చీర, పట్టు) to English, or say "Try English words" on the empty page. |
| 7 | `ShopList.jsx:45,152-171` | Collection variant reads every filter from the address but shows no chips. | In the collection variant build `f` only from `sets` and `sort`. |
| 8 | `ShopList.jsx:93,186,193`; `Filters.jsx:66-71` | `side` is false when no group is useful, which hides Sets only. | Count Sets only as a group (show the panel when sets are possible). |
| 9 | `SearchBox.jsx:38-43,77-81` | No close on focus leaving; no `role="combobox"`; `aria-controls` points at nothing when closed. | Close on `focusout` outside the form; add `role="combobox"`; set `aria-controls` only when open. |
| 10 | `CategoryPage.jsx:42` | Case-sensitive slug compare. | Compare `slug.toLowerCase()` (or redirect to the lower-case address). |
| 11 | `filters.js:11`, `data/crafts.js:2-23` | Hard-coded copies of `CRAFTS` and `PRICE_BANDS`. | Read keys from `/catalog` (`crafts`, `priceBands`), keeping the copies only as a fallback. |
| 12 | `data/resource.js:6` | Map never trimmed. | Keep the last ~200 keys (LRU). |
| 13 | backend `constants.js:173`, `catalog.service.js:228-246` | "pure" and "pattu" both map to the `pure` craft, which includes Plain and Butta. | Owner to confirm; if not wanted, don't expand the words "pure" and "pattu" to the craft. |
| dev | backend `catalog.validators.js:12-16` | `craft=a&craft=b` (array) fails `z.string()` and becomes `[]`. | Accept `string \| string[]` and join. |
| dev | backend `catalog.validators.js:21` | `offset > 10000` is caught to 0, so a client paging past it loops on page 1. | Clamp to 10000 (or return an empty page). |
| dev | backend `src/middlewares/rateLimit.js:15` | Browse limit keyed by full IP; IPv6 visitors can rotate within a /64; every call is one locked database transaction. | Group IPv6 by /64 (as `utils/network.js` does for SMS) if abuse appears. |
| dev | backend `catalog.service.js:261-262`; `SearchBox.jsx:31` | Suggestions (`limit=4`) also compute every facet, and with `q` run a `groupBy`: 3 queries per typing pause. | Add a `facets=0` flag (or a light `/suggest`) for the search box. |
| dev | backend `catalog.controller.js:8` | `Cache-Control: public, max-age=60`, but the website fetches with `cache: 'no-store'` (`src/api/client.js:60`). | Fine as is; if a CDN is added, make sure it varies on `Origin` (already sent). |

Second check of the five "dev" rows above (the M1 to 13 rows repeat the findings already marked in section 6):

> **Second check (dev: `craft=a&craft=b`): ✅ Correct.**

> **Second check (dev: `offset > 10000`): ✅ Correct.**

> **Second check (dev: browse limit by full IP): ✅ Correct.**

> **Second check (dev: suggestions compute every facet): ✅ Correct.**

> **Second check (dev: `Cache-Control` vs `no-store`): ✅ Correct.**

---

## Second check (26 Oct 2026)

25 findings checked (1 Must, 6 Should, 13 Small, 5 developer notes): **✅ 21 · ⚠️ 4 · ❌ 0**.

- ⚠️ M1: real, but Should fix, not Must (every saree is still reachable through the collection pages, filters, sort and search).
- ⚠️ S6: real, but Small (a wrong label on an already-empty list).
- ⚠️ Small 2: the "longer than 60 letters shows every saree" part is wrong for the results page (the website cuts the search to 60 first); true only for the suggestions.
- ⚠️ Small 7: real, but the `?price=u25` example is wrong (a collection has one price: all or nothing); `?q=…` is the real case.

Details and evidence: [checks/05-catalogue-and-search-check.md](checks/05-catalogue-and-search-check.md).

---

## Third check (26 Oct 2026)

4 disputed findings re-checked from the code (4 marked ⚠️, 0 marked ❌): **Second checker right 4 · First reviewer right 0 · Both partly right 0 · Neither right 0**.

- M1: Should fix (dead "Load more" after 480 is real; every saree is still reachable through category → collection pages, filters or search).
- S6: Small (long code on the chip, only on an already-empty list).
- Small 2: Small (symbols-only search shows every saree; over 60 letters only affects the suggestions).
- Small 7: Small (only `?q=…` thins a collection page without a chip; price and craft are all or nothing).

Details and evidence: [checks/05-catalogue-and-search-third-check.md](checks/05-catalogue-and-search-third-check.md).

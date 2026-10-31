# Module 4: Products and barcodes

| | |
|---|---|
| **Status** | Built and tested on a real Android phone 2026-10-11 (sections 15–16): backend 168/168, app 57/57, all 27 phone checks passed, 9 small problems found and fixed. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners and Staff (Module 2: `products.manage` is for both) |
| **Builds on** | [Module 1: Sign in](module-01-sign-in.md), [Module 2: Roles and team](module-02-roles-and-team.md), [Module 3: Categories and subcategories](module-03-categories.md) (prices, photos, delete = inactive) |
| **Mock-up** | [`docs/design/ui-mockup/module-4-products/`](../design/ui-mockup/module-4-products/index.html) |
| **Old system notes** | [`current-system/admin-app-2-catalog.md`](../current-system/admin-app-2-catalog.md): Product list, Product form, sections 2–3 and 5 |

## 1. Goal
Getting sarees into the shop's system takes **seconds each, not a minute**. The owner chooses a subcategory once, picks the photos, and scans each saree's tag while its photo is shown. The app saves everything in the background. Every saree is its own listing with its own photo and tag, ready for the website and the counter.

## 2. What is in this module
- **Adding products, the new way** (section 5): batch add from the gallery with guided tag scanning (the main way), and Quick add for one or two sarees.
- **Products tab:** the list, search (name, SKU, tag number), scan a tag to find its saree, filters.
- **Product page:** photo(s), the tag and its status, price (from the subcategory), where it sells, Best Seller, move to another subcategory, change a wrong tag, replace a damaged tag, delete.
- **Tags (barcodes):** camera scanning, typing the number, or a Bluetooth tag scanner; **one tag per saree**, and a **set** (several identical sarees, one photo) has one tag per saree (section 6C, since 15 Oct 2026); instant "already used" warnings (section 6A).
- **Delete = inactive** (decision 6.1), as for categories.
- **Audit** of every change (shown in Module 10).

**Not in this module:**
- Selling at the counter (scan to sell): Module 5.
- Invoices: Module 6.
- Online orders and shipping: Module 7.

## 3. Today's products (copy of the live data, 2026-10-11)
| What | Number |
|---|---|
| Products (listings) | **1,496**, all added in the last week (4–11 Oct) |
| Most added in one day | **347** on 9 Oct, about **36 seconds each** for one person, over 3 hours |
| Tags (pieces) | 1,688: 1,576 in stock, 110 sold at the counter, 2 sold online |
| Tags per listing | 1,356 listings have **1** tag; 140 have 2–6 |
| Tag format | Almost all "**NH** + number" (NH207, NH2238…): 1,684 of 1,688 |
| Photos per listing | Always 1 (the website can already show more) |
| Listings without a photo | 6 |
| Name different from its subcategory | **501** (the old "name goes stale" bug, shown on the website) |
| Colour, fabric, border and other details filled in | **0** (the old app can't set them) |
| Where it sells | 1,495 online + store, 1 online only |
| Deleted (archived) | 0 |
| The old cap | 5,000 "active listings", counting sold-out ones too |

## 4. Problems in the old app
1. **One saree at a time:** Products → New → find the category → find the subcategory (102 in Pattu sarees) → photo and crop → scan → save and wait → start again. About 36 seconds each, at best.
2. **Category and subcategory picked again for every saree**, even when adding 30 from the same subcategory.
3. **Waiting on every save**, and a slow network stops the work.
4. **A used tag is found only at save time**, and then the whole saree has to be redone.
5. **The product name goes stale:** it's copied from the subcategory once. 501 listings show an old name, on the website too.
6. **Tags can't be added to or removed from an existing listing.**
7. **Deleting** either erases the product, its pieces and some customer orders, or archives it. An archived product's tags stay blocked forever.
8. **Colour, fabric, border, occasion:** the website can filter by them, but they can't be set, so none are filled in.
9. **The 5,000 cap counts sold-out listings too.** With 1,496 already listed and 5,000 planned, it would block new listings while old ones sit sold out.
10. **The app and the server tidy tags differently** ("NH 001" vs "NH001"), giving confusing errors.
11. **"Photo and at least one tag" is checked only in the app**; the server accepts a product with neither.

## 5. The new way to add products (agreed with the owner, 2026-10-11)

### 5.1 Main way: photos from the gallery, then scan one by one
Handloom sarees are all different (colour and design), so every saree gets its own photo and its own tag.

1. **Take the photos first**, in good light, or a photographer does it.
2. In the app, open the **subcategory** (for example "Rainbow checks sarees") and tap **Add products**. Category, subcategory, price and description come from it automatically.
3. **Choose the photos**: many at once from the gallery (up to 50 per batch, section 6.5).
4. The app shows **photo 1, big**: *"Scan the tag for this saree."* Find that saree and scan its tag.
   - Free tag: a tick, and the app moves to photo 2.
   - Tag already used: the app says so at once ("NH207 is already on *Rainbow checks sarees*"), and you scan a different tag.
5. Repeat until the last photo. Two buttons on every photo:
   - **Undo last**: the previous scan was the wrong saree.
   - **Skip**: can't find this saree right now; it waits at the end.
6. **Review screen:** every photo with its tag number, in a grid. Tap any one to re-scan, re-crop or remove it.
7. **Save all.** Saving happens in the background ("12 of 30 saved"), so you can carry on. If the internet drops, it continues when it's back (section 6.13).

**Why the order can't go wrong:** the app never matches "photo 1 = first scan" blindly. You always see the photo you are tagging.

### 5.2 Small batches: Quick add
For 1–3 new sarees: open the subcategory → **Quick add** → 📸 take the photo → 🏷️ scan the tag → saved → the camera is ready for the next one. It's the same screen without the gallery step.

### 5.3 Time for 30 sarees
| | Old app | New app |
|---|---|---|
| Category and subcategory | Picked 30 times | **Once** |
| Steps per saree | ~7 | **1 scan** (photos were taken beforehand) |
| Waiting after each save | Yes | **No** |
| 30 sarees | ~20–30 minutes | **~5–10 minutes** |

### 5.4 Dropped from the discussion
"Same design, many tags" (one photo, several tags) is **not part of adding**, because every handloom saree is different. The rare listing that really has identical pieces (140 today have 2–6 tags) can use **Add another tag** on the product page (section 7.4).

## 6. Decisions
All ⭐ recommendations were **accepted by the owner on 2026-10-11** ("ok to all"). 6.9 was then replaced by the owner's tag rules in section 6A.

| # | Question | Options | Recommendation |
|---|---|---|---|
| 6.1 | **Deleting a product** | A ⭐ Like categories: delete = **inactive, never erased**. It disappears from the app, website and counter; sold history stays. Refused while an online checkout is holding it. Its unsold tags become **free to reuse**. · B As the old app: erase it if never sold, archive it if sold. | **A.** Same rule as categories; nothing is ever lost; a wrongly added saree's tag can be used again. |
| 6.2 | **Product name** | A ⭐ Always the subcategory's name, kept in step when moved or renamed. Fix the 501 stale names once at switch-over. · B As today: copied once. | **A.** The website then always shows the right title. |
| 6.3 | **Photos per saree** | A ⭐ One main photo when adding (fast); up to **4 extra** (border, pallu, blouse) on the product page later. The website already shows extra photos. · B One photo only. | **A.** |
| 6.4 | **Cropping in a batch** | A ⭐ Each photo is fitted to the website's product shape (3:4, portrait) automatically, centred; adjust it only if needed, in the review. · B Crop every photo by hand. | **A.** Cropping 30 photos by hand would undo the time saved. |
| 6.5 | **Batch size** | Up to **50 photos** per batch ⭐ (more can be done as a new batch) | ⭐ 50 |
| 6.6 | **Colour, fabric, border, occasion** | A Leave them out, as today. · B ⭐ Optional, on the product page only, never asked while adding. · C Asked for every saree while adding. | **B.** Adding stays fast; the website filters can be filled in over time. |
| 6.7 | **Where it sells** (online + store / online only / store only) | ⭐ Chosen once per batch (default online + store), changeable per saree | ⭐ |
| 6.8 | **The 5,000 limit** | A ⭐ Count only listings **in stock** (sold-out ones don't count), and show "N of 5,000 in stock". · B Count every listing, as today. · C Remove the limit. | **A**, unless the limit has a reason we don't know about (for example a hosting plan). Please confirm. |
| 6.9 | **Tags on an existing listing** | ~~Add another tag; Remove; mark Damaged~~ | **Replaced by section 6A** (owner, 2026-10-11) |
| 6.10 | **How tags are read** | ⭐ Phone camera, **or** type the number, **or** a Bluetooth tag scanner (it types like a keyboard) | ⭐ |
| 6.11 | **Moving sarees** | ⭐ Move one saree to another subcategory from its page; moving many at once can come later | ⭐ |
| 6.12 | **Who can add, edit and delete** | Owners and Staff (decided in Module 2: `products.manage`) | Decided |
| 6.13 | **No internet while adding** | ⭐ Photos and scans are kept safely on the phone and upload by themselves when the internet is back. "Already used" checks happen when online; any clash is shown in the results. | ⭐ |

## 6A. Tag rules (owner, 2026-10-11)
The owner: *"one product should not get multiple scan barcode, we have to alert him if already the scanned barcode is assigned, and if any wrong barcode is assigned we need an edit option, and if the barcode is damaged in any case."*

| # | Rule | How it works |
|---|---|---|
| T1 | **One saree, one tag** *(changed 15 Oct 2026, section 6C: a photo may be a set with one tag per saree)* | A new saree gets exactly one tag. Scanning again on a saree that already has one asks **"Replace NH3301 with NH3302?"**. It never adds a second tag by accident. There is no "Add another tag". The 140 old listings that already have 2–6 tags keep them, and each one can still be sold. The mock-up has an option B that allows "Add another tag", in case the owner ever wants it. |
| T2 | **Already used: alert at once** | The moment a tag is scanned (or typed), the app checks it. **On another saree in the shop:** "NH207 is already on *Rainbow checks sarees* (SKU NH-HPS-001, in stock)", with that saree's photo to compare. Choices: *Scan a different tag* · *Open that saree*. **On another photo in this batch:** "You already gave NH3301 to photo 2." Choices: *Scan a different tag* · *Give it to this photo instead* (photo 2 then needs a tag). **Sold before:** "NH6 was sold on 9 Oct. A tag can't be used twice." Checked again on the server when saving. |
| T3 | **Wrong tag: Change tag** | While adding: tap the photo in Review → *Change tag* → scan the right one. After saving: on the saree's page, tap the tag → **Change tag** → scan the right one → "Change NH3301 to NH3302?". The wrong number becomes **free** for its real saree. Allowed while the saree is in stock; not after it's sold or while an online order holds it. Recorded in the activity log (who, when, old → new). |
| T4 | **Damaged tag: Replace tag** | Tag torn, faded or won't scan: on the saree's page, tap the tag → **Tag damaged** → scan the new tag → "Replace NH207 with NH3302?". The damaged number is **retired**: never used again, so an old torn sticker can't be confused with another saree. If the same number can be printed again, just stick the new copy on; nothing changes in the app. At the counter (Module 5) a tag that won't scan can always be typed. |
| T5 | **Saree damaged** (not the tag) | Tap the tag → **Saree damaged, not for sale**: it leaves the website and the counter. **Back in stock** undoes it. |
| T6 | **Can't read a tag while adding** | After a few seconds without a read: "Can't scan it? **Type the number**", plus a tip to clean the lens or move closer. Typed numbers get the same checks. |

## 6B. Mock-up picks (owner, 2026-10-11)
| Choice | Picked |
|---|---|
| Theme | Follows the phone (light or dark), as in every module |
| Product list | **Rows with photo** by default. A **rows / grid switch** sits above the list on the Products tab and on a subcategory's sarees. The phone remembers the choice, like the theme. |
| Scan screen | **B: the camera fills the screen and the photo being tagged sits in a card** (top-left). On a tablet the scanning frame sits to the right of the photo. |
| Tags per saree | **A: one saree = one tag.** No "Add another tag". |

## 6C. Sets: one photo, several tags (client's request, 15 Oct 2026)

The client asked for the old app's "one photo, many barcodes" back: a set of 5 identical sarees gets **one photo and 5 tags**, one listing with 5 in stock. This changes T1 and 5.4. Mock-up: [`design/ui-mockup/module-4b-tag-sets/`](../design/ui-mockup/module-4b-tag-sets/index.html).

| Decision | Owner's pick (15 Oct) |
|---|---|
| How a photo becomes a set | **A: count first.** Under the photo while scanning: **"Sarees in this photo − 1 +"**. 1 = a normal saree (moves on after its tag, as before). Tap + to 5, scan 5 tags; the next photo comes after the 5th. |
| Check screen | **A: every tag shown** on each photo, with a set mark. |
| Tags on one photo | **Up to 50.** |
| Add more tags later | **Yes:** "Add more tags (same design)" on the saree page. |

Rules:
- Each tag is one saree: it sells, changes, is replaced or marked damaged on its own. The listing stays on the website until the last one sells. The 5,000 limit counts listings in stock, so a set counts once.
- Every tag is checked the moment it is scanned. The same tag read twice on a photo is ignored with a note.
- A second tag on a one-saree photo asks: **Replace** (wrong tag) or **A set: keep both**. A tag past the count asks **Make it a set of 6?** or **No, it's for another photo**.
- Save warns about a set with fewer tags than its count: scan the rest, or save it as a set of what was scanned.
- A set is saved **all or nothing** (one listing, every tag); if one tag was used meanwhile, Fix replaces just that tag.
- Server: `POST /products` takes `tags` (comma-separated, 1–50, no repeats); older app builds still send one `tag`. New `POST /products/:id/tags` `{ codes }` adds tags to a listing (Add more tags), all or nothing, refuses a tag already on this saree (`TAG_ON_THIS_SAREE`) and more than 50 (`TOO_MANY_TAGS`). No database change.

## 7. How it will work (screens)

### 7.1 Products tab
- "**N sarees in stock** · N of 5,000" (6.8), and **+ Add products** (asks which subcategory, with recent ones on top).
- **Search:** name, SKU, or a **tag number** (typing "2238" finds NH2238).
- **Scan to find:** scan a tag → opens its saree. Unknown tag → "No saree has this tag. Add a new saree with it?"
- Filters: **All · In stock · Sold out · No photo · Online only · Store only**.
- Each row: photo, name, "SKU · Category › Subcategory", store price, tag numbers, a stock badge.
- **Rows / grid switch** above the list (6B): rows with photo by default, or a photo grid like the website. Remembered on the phone.
- Offline: the last list, with its time (as in Module 3).

### 7.2 From a subcategory (Module 3 page)
"**36 products · 32 in stock**" opens that subcategory's sarees. **Add products** and **Quick add** live here, so the subcategory is already chosen.

### 7.3 The batch screens
1. **Choose photos** (the gallery).
2. **Scan screen (6B, layout B):** the camera fills the screen; the current photo sits in a card at the top-left with "Photo 7 of 30"; below it Undo last · Type · Skip and a strip of all the photos (tick = tagged).
3. **Review:** a grid of photo + tag number; anything wrong is marked; tap one to fix it.
4. **Saving:** "12 of 30 saved", then a summary: "30 sarees added to Rainbow checks sarees". Anything that failed is listed with what to do.

### 7.4 Product page
- Photo(s), name (= subcategory), SKU, "Added 9 Oct by Lakshmi".
- **Price:** store, website, MRP, from the subcategory ("change it in the catalogue").
- **Tag:** the tag number with **In stock / Sold (counter or online, date) / Held by an online order / Saree damaged**. Tapping it offers **Change tag** (wrong tag, T3), **Tag damaged → Replace tag** (T4) and **Saree damaged** (T5). Old listings with 2–6 tags show each tag, and a never-sold extra tag can be **removed**.
- **Where it sells**, **Best Seller**.
- **Details** (optional, 6.6): colour, fabric, border, technique, blouse, zari, occasion.
- **Move to another subcategory.**
- **Extra photos** (up to 4, 6.3).
- **Delete** (6.1), asking first.

### 7.5 What Staff see
The same: adding, editing and deleting products are allowed for Staff (Module 2). Prices remain view-only (changed only in the catalogue by owners).

## 8. Rules
| Rule | Value |
|---|---|
| A new saree needs | A subcategory, **one photo** and **at least one tag**, checked on the server too (fixes problem 11) |
| Tag | 3–64 characters. Spaces removed and upper case, the same in the app and on the server. Retail barcodes match in all their forms (UPC-A, UPC-E, EAN-13, 14-digit), as today |
| One saree, one tag | A new saree has exactly one tag, and a tag can be on only one saree. Checked the moment it's scanned and again when saving (6A) |
| Changing a tag | Only while in stock (not sold, not held). Wrong tag → its number is freed. Damaged tag → its number is retired |
| Name | Always the subcategory's name (6.2) |
| Price | Always the subcategory's (store, website, MRP); never stored on the product |
| SKU | `NH-<category initials>-<number>`, the next number, as today (NH-MHPS-1378) |
| Web address (slug) | Made once from the name; never changes |
| Photo | Fitted to 3:4; stored as a JPEG of 80 KB or less, location removed (Module 3's photo service) |
| On the website when | Active, not deleted, sells online, its subcategory and category are shown, and at least one tag is in stock |
| Delete | Inactive, never erased (6.1); refused while held by an online checkout |
| Batch | Up to 50; each saree is saved on its own, so one problem doesn't stop the rest |
| Saving twice by accident | Impossible: each saree has an id made on the phone, and the server ignores a repeat (section 9) |

## 9. Data (same live database)

### 9.1 Tables used as they are
| Table | Used for |
|---|---|
| `Product` | The listing: `id`, `slug`, `sku`, `name`, `categoryId`, `subcategoryId`, `channelVisibility` (both / online_only / store_only / hidden), `trackingMode` (serialized for new ones), `isFeatured` (Best Seller), `isActive`, `deletedAt` (delete = inactive), the detail fields (`technique`, `borderStyle`, `purity`, `zariTier`, `blouseType`, `pattern`, `color`, `fabric`, `occasion[]`), `stock` (old counter; 0 everywhere today) |
| `Piece` | One tag: `barcode` (unique), `status` (in_stock, reserved, sold_online, sold_offline, damaged, returned, and new: **retired** for a damaged tag (T4), **removed** for an extra tag taken off an old listing), `soldAt` |
| `ProductImage` | Photos: `url`, `storageKey`, `sortOrder` (0 = main) |
| `StockLedger` | Every tag movement: `restock` when added; new reasons `tag_changed` (T3, `ref` = "NH3301 → NH3302"), `tag_retired` and `tag_replaced` (T4), `damaged` / `back_in_stock` (T5), `deleted`; sales from Modules 5 and 7 |
| `Reservation` | Online checkout holds (read only here: "Held by an online order", refuse delete) |
| `Category`, `Subcategory` | Module 3: name, prices, active / shown |

### 9.2 Additive changes (migration `v2_products`)
On `Product`:
| Column | Type | Why |
|---|---|---|
| `clientRef` | text, unique, nullable | The id the phone makes for each new saree, so a retry (slow network, app closed mid-save) never creates a duplicate |
| `batchId` | text, nullable, indexed | Which batch it came in with ("30 added on 12 Oct") |

"Added by Lakshmi" needs no new column: it comes from the `restock` row in `StockLedger`, which already records who added each tag (`actorId`).

Nothing else changes shape. `Piece.status` and `StockLedger.reason` are text, so "removed" and the new reasons need no migration. The old backend keeps working: it ignores the new columns.

### 9.2a How the tag rules are stored (no new tables)
- **Change tag (T3):** the tag's `Piece.barcode` is changed in place (same row, same history). The old number is free at once.
- **Replace a damaged tag (T4):** the old `Piece` gets status `retired` and keeps its number, so it can never be used again. A new `Piece` is made with the new number, in stock.
- **Delete a saree (6.1):** its unsold tags are renamed (for example `NH207` → `NH207~del~3f2a91`) so the number can be used again. The ledger keeps the original number.

### 9.3 Data fixes at switch-over (6.2 agreed)
- Set each product's `name` to its subcategory's name (501 rows). The web address stays the same.

### 9.4 Worked out, not stored
- **In stock:** at least one tag `in_stock`.
- **Sold out:** has tags, none `in_stock` or `reserved`.
- **Held:** a tag `reserved` by an active online checkout.

## 10. API (all under `/api/v2`; everything needs `products.manage`, so Owners and Staff)
| Method | Path | Purpose |
|---|---|---|
| GET | `/products?q=&filter=&subcategoryId=&offset=&limit=` | The list (newest first, 40 a page) and search. Also returns the filter counts and `totals` (`inStock`, `listings`, `limit` 5,000) |
| GET | `/products/:id` | Saree page: photos, tags with status and their allowed actions, price from the subcategory, website status, added by, history, `actions` |
| POST | `/products` | **Add one saree** (multipart): `photo`, `subcategoryId`, `tag`, `channel`, `clientRef`, `batchId`. One transaction: tag checked, SKU and web address given, photo stored, product, tag and ledger row made. 201 new; 200 with `repeated: true` when the same `clientRef` comes again |
| POST | `/tags/check` | `{ codes[] }` → each `free`, `taken`, `sold`, `retired` or `invalid`, with the saree it's on. Used the moment a tag is scanned |
| GET | `/tags/:code` | Scan to find: the whole tag in any camera form, or just its number |
| PATCH | `/products/:id` | Move (`subcategoryId`), `channel`, `bestSeller`, `details` |
| POST | `/products/:id/photos` | Add a photo (up to 5) |
| PUT | `/products/:id/photos/order` | `{ ids }`: the first is the main photo |
| DELETE | `/products/:id/photos/:photoId` | Remove a photo (never the last one) |
| POST | `/products/:id/tags/:pieceId/change` | Wrong tag → `{ code }` (T3) |
| POST | `/products/:id/tags/:pieceId/replace` | Damaged tag → `{ code }`; old number retired (T4) |
| POST | `/products/:id/tags/:pieceId/damaged` · `/back-in-stock` | Saree damaged, and undo (T5) |
| POST | `/products/:id/tags/:pieceId/remove` | Remove a never-sold extra tag (old multi-tag listings only) |
| DELETE | `/products/:id` | Delete = archived, unsold tags freed |

Refusal codes the app handles: `TAG_TAKEN` / `TAG_SOLD` / `TAG_RETIRED` (with the saree it's on), `TAG_INVALID`, `SAME_TAG`, `TAG_LOCKED`, `LAST_TAG`, `NOT_DAMAGED`, `HELD_BY_ORDER`, `LIMIT_REACHED`, `SUBCATEGORY_GONE`, `TOO_MANY_PHOTOS`, `LAST_PHOTO`, `ORDER_OUT_OF_DATE`, `TAG_UNKNOWN`, `AMBIGUOUS_CODE`, `PHOTO_MISSING` and the other photo codes from Module 3, `VALIDATION_FAILED`.

"Already used in this batch" and "one saree, one tag" while adding are checked on the phone (the batch isn't on the server yet); the server refuses a used tag again when each saree is saved.

## 11. Building blocks
**Backend:**
- `models/product.model.js`, `models/piece.model.js`
- `services/product.service.js`: add (idempotent), list, search, move, delete
- `services/tag.service.js`: tidy, retail-barcode forms, check, add, remove, damaged
- `services/sku.js`: the next SKU per category, safe when two phones add at once
- reuse of `photo.service.js` and `storage/` from Module 3
- controllers, routes, validators

**App:**
- **Products tab**, product page, batch screens (choose → scan → review → saving), Quick add.
- **Rows / grid switch** for product lists, saved in the phone's storage (AsyncStorage) like the theme.
- **Tag scanner** with `expo-camera` (codes read on several frames before accepting, as today, to avoid misreads), a type-in box, and Bluetooth scanner input.
- **Gallery picking** with `expo-image-picker` (many at once).
- **Auto-fit** each photo to 3:4 with `expo-image-manipulator`, shrunk on the phone before upload (faster on shop Wi-Fi).
- **Upload queue** on the phone: photos and scans kept in the app's own storage until the server confirms each one. It survives the app closing and a lost connection, and shows progress.
- The upload uses Expo's native uploader, as fixed in Module 3.

## 12. Steps to build (same as every module)
1. **Plan** (this document) → owner decisions on section 6.
2. **Mock-up** in the chosen design, clickable, opened in Chrome: Products tab, batch screens, Quick add, product page, tags.
3. **Backend + tests:** migration, add/list/search/move/delete, tags, idempotent adding, SKU safety, the cap rule, permissions.
4. **App + tests:** screens, scanner, gallery, auto-fit, upload queue; lint, `expo-doctor`, bundle check.
5. **Real-phone test** with real tags: a batch of 10–30 photos, Quick add, a used tag, undo and skip, no internet mid-batch, scan to find, add, remove and damaged tags, move, delete, Staff.
6. **Results** written into this document. No commits until the whole app is done.

## 13. Testing plan
- **API tests:** a saree can't be added without a photo or a tag, or with two tags; used, sold and retired tags refused (all retail-barcode forms); change tag frees the old number; replace retires it; neither allowed after a sale or while held; the same `clientRef` twice gives one saree; two phones adding at once get different SKUs; name follows the subcategory; delete = inactive, tags freed, refused while held; remove only never-sold tags; damaged; search by tag number; the cap counts in-stock listings only (6.8); Staff allowed, signed-out refused; nothing appears on the website until it has a tag in stock.
- **App tests:** tag tidying (same as the server), the batch state (undo, skip, re-scan), queue retry rules, the 3:4 fit maths.
- **Real phone:** as in step 5.

## 14. Risks and how they're handled
| Risk | Handling |
|---|---|
| Wrong photo gets a tag | The photo is always shown while scanning; Undo; review before saving |
| Duplicate sarees from retries | `clientRef` makes every save safe to repeat |
| The internet drops mid-batch | The upload queue keeps everything on the phone and resumes |
| The old app adds products at the same time | Same tables and SKU rule; a clash retries with the next number |
| A misread barcode | Several matching frames before accepting; the number is shown big to confirm |
| Live data during development | Development uses the local copy and a local photo folder only (as in Module 3) |

## 15. Build status (2026-10-11)
| Part | Result |
|---|---|
| Database | Migration `20261011210000_v2_products` (additive: `Product.clientRef` unique, `Product.batchId` indexed), applied to the local copy |
| Backend | `src/utils/tags.js`, `models/product.model.js`, `services/product.service.js`, `validators/product.validators.js`, `controllers/product.controller.js`, `routes/product.routes.js`; a renamed subcategory now renames its sarees (Module 3 service) |
| Backend tests | **168 / 168** (all modules); Module 4: 23 API tests + 7 unit tests |
| Live smoke test (dev server, local copy) | Totals 1,427 in stock / 1,496 listings / 5,000 limit; search 2264 → NH2264; a new Rainbow checks saree got SKU NH-MHPS-1417; the same clientRef again → the same saree; photo served; tag then "taken"; delete freed the tag |
| App | Products tab, a subcategory's sarees, saree page, Scan to find, Move, Details, Photos; adding: subcategory → start → gallery → scan (layout B) → review → adjust → saving; Quick add. Upload queue and draft batch kept on the phone (`src/products/`). New package: `expo-camera` (no microphone) |
| App checks | Lint clean · **57 / 57** app tests · `expo-doctor` 21 / 21 · Android bundle builds |
| Switch-over script | `scripts/fix-product-names.js`: dry run shows **501** names (27 distinct name pairs); `--csv` writes the list for the owner to check first |

## 16. Real-phone test (2026-10-11, Samsung Galaxy Note10 Lite, Android 12)
Test app beside the shop's app, signed in as the test owner "Lakshmi" and the test staff "Anil", against the local copy. Photos came from a separate test album of website saree photos (never personal photos); new tags were test numbers NH9930xx; real tags were used only to check refusals.

| # | Check | Result |
|---|---|---|
| 1 | Products tab: 1,427 in stock · 1,496 listings · 5,000 limit; filter counts; rows by default | ✅ |
| 2 | Rows / grid switch remembered after force-closing the app | ✅ |
| 3 | Search 2264 finds NH2264 | ✅ |
| 4 | Saree page of a real old listing: 2 tags with the note, price from the subcategory, website status | ✅ |
| 5 | Scan to find: typing 3528 opens its saree; camera permission asked first; an unknown tag offers "Add a new saree with NH993021" → subcategory → Quick add with the tag ready | ✅ (after fix 1) |
| 6 | Catalogue → subcategory → "36 sarees" opens its sarees | ✅ |
| 7 | Gallery batch: 8 photos from Android's photo picker in pick order; layout B; free tag; **used tag NH2264 refused at once with both photos**; **sold tag NH6 refused** ("sold on 9 Oct"); **same tag twice in the batch refused**; re-scanning a tagged photo asks "Replace? Each saree keeps one tag"; Undo last; Skip; the skipped photo comes back last | ✅ |
| 8 | Force-closed mid-batch: the draft (7 of 8 tagged) came back; Continue opens the same photo | ✅ |
| 9 | Review: untagged photo in red; change a tag by typing; Adjust photo | ✅ |
| 10 | Save 7 with 1 untagged: saved in about 10 s (NH-MHPS-1418–1424); one batch id, one tag and one photo each (≤ 80 KB), added by the signed-in person | ✅ |
| 11 | The subcategory shows 43 sarees; totals up by 7; the untagged photo stayed as a draft | ✅ (after fix 3) |
| 12 | Quick add: photo → tag → saved → camera ready again (counter 1, 2…) | ✅ |
| 13 | No internet (Wi-Fi and data off): Quick add still works, "No internet · 2 sarees kept on this phone"; back online one saved by itself and the one with a used tag was flagged; Fix → new tag → saved; "Don't save this saree" also works | ✅ (after fixes 4, 5) |
| 14 | Change a wrong tag: a used tag refused inside the scanner; then "Change the tag? NH993001 becomes free" | ✅ |
| 15 | Tag damaged: "NH993031 is retired"; new tag in stock; the retired number refused later in a new batch | ✅ (after fixes 6, 7, 9) |
| 16 | Saree damaged → off the website; Back in stock | ✅ |
| 17 | Where it sells → Store only ("Not on the website: set to Store only"); Best Seller | ✅ |
| 18 | Details: colour and occasion saved and shown | ✅ |
| 19 | Photos: add from the gallery with the 3:4 crop, make it the main photo, remove the other; the last photo can't be removed | ✅ (after fix 8) |
| 20 | Move: old → new prices shown first; name follows the new subcategory | ✅ |
| 21 | History lists every change with who and when | ✅ |
| 22 | Delete: archived (not erased); the in-stock tag freed, the retired tag kept blocked; totals down by 1 | ✅ |
| 23 | The freed tag was accepted again in a new batch; review opened by itself; Back after saving goes back to where you started | ✅ |
| 24 | Held by an online order (a test checkout on the local copy): "Held … until 6:41 pm", tag actions locked with the order number, delete refused | ✅ |
| 25 | Old listing with 2 tags: remove the extra one (its number freed); the last tag has no Remove | ✅ |
| 26 | Staff (Anil): adds a saree ("Added by Anil"), all saree actions, prices view-only | ✅ |
| 27 | **Camera scanning of real Code128 barcodes** (shown on the Mac screen, phone held by the owner): 3 tags read and saved (NH-MHPS-1433–1435) | ✅ |

**Found and fixed during the test** (each rechecked on the phone):
1. A typed new tag in Scan to find would have been added as "993001" instead of NH993001.
2. "Type the number" wrapped onto two lines → "Type".
3. After saving, Back from the sarees list went to the camera of the left-over draft → the camera steps leave the back history.
4. The Products list didn't refresh by itself when the internet came back (copy or failed search) → it does now.
5. Opened from the Saving bar, the summary said "0 sarees added" → it shows the whole group.
6. A long retired tag number wrapped onto two lines → status under the number.
7. "Replace to NH…" → "Replace with NH…".
8. The crop screen said "Uploads when you press Save" → "Added as soon as you tap Use".
9. A retired tag said "Already on:" → "Was on:".

**Test set-up note:** the Mac moved to a Wi-Fi network that keeps devices apart (the phone couldn't reach the Mac at all). The test app was rebuilt to reach the Mac through the USB cable (`adb reverse tcp:4100 tcp:4100`, API `http://localhost:4100/api/v2`, `PUBLIC_URL=http://localhost:4100`). This only matters for testing. The local copy now holds 19 test sarees (NH-MHPS-1417–1435, some deleted); refreshing the copy from live removes them.

## 17. Notes for switch-over
- **Check the 501 names before fixing them.** Most are subcategories renamed after their sarees were added (e.g. "300k Plain Saree" → "300k border Plain Saree"). A few may be sarees in the wrong subcategory (e.g. NH-HPS-268 "Gap Border bramini sarees" sits in "Gap Border Digital Print Saree"): move those in the app instead, because the price comes from the subcategory. Then run `node scripts/fix-product-names.js --yes`.
- The SKU counter counts deleted sarees too (as the old app), so numbers are never reused.
- Photos go to the local folder in development and to the shop's S3 bucket in production (as in Module 3).

## 18. Left for the full-app test
Not yet tested on a phone; listed in [`testing/full-app-test-list.md`](../testing/full-app-test-list.md) (items 4.1–4.11): camera on the other scan screens, a 50-photo batch, the 5,000-limit warning, app closed mid-upload, another person on the same phone, new sarees on the website, retail barcodes by camera, a Bluetooth scanner, iPhone and tablet, dark mode and large text, old and new app at the same time.

## 19. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-11 | Pain point | The owner: adding one product at a time, each with its tag, is too slow for ~5,000 listings. Data confirms: 347 in one day at ~36 s each. |
| 2026-10-11 | Ideas | Quick add, "same design many tags", photos from the gallery then tags. Explained with a 30-saree example. |
| 2026-10-11 | Gallery and scan order | The owner asked how the scan order matches the photos. Agreed: one photo at a time shown big while scanning, with Undo, Skip and a review screen; never blind order. |
| 2026-10-11 | Unique sarees | The owner: every handloom saree is different. "Same design, many tags" dropped. The main way is gallery + scan; Quick add stays for small batches. |
| 2026-10-11 | Decisions | The owner accepted every ⭐ recommendation and added the tag rules: one saree, one tag; alert when a tag is already used; an edit option for a wrong tag; a way to handle a damaged tag (section 6A). Mock-up next. |
| 2026-10-15 | Sets | The client asked for the old app's "one photo, several barcodes" (a set of identical sarees). Mock-up `module-4b-tag-sets`; the owner picked A (count first), check screen A (every tag), up to 50 tags, and kept "Add more tags". Built in the server and the app (section 6C). |
| 2026-10-11 | Mock-up picks | Theme follows the phone; product list rows with photo plus a rows / grid switch on the page (the owner's idea, "like the dark and light theme toggle"); scan screen B (camera full, photo in a card); one saree = one tag (section 6B). |
| 2026-10-11 | Real-phone test | 27 checks on the owner's phone, including camera scanning of real barcodes held by the owner. 9 small problems found and fixed (section 16). |
| 2026-10-11 | Open checks | The owner asked to note the untested edge cases for the full-app test (section 18) and plans an intern field test in the store. |

## Change 16 Oct 2026: a tag change crossing a sale
"Saree damaged", "Back in stock", "Remove tag", "Wrong tag" and "Damaged tag" (and deleting a saree) save only if the tag is still as it was read (`updateTag` in `product.service.js`). A sale that landed a moment before wins; the change is refused with "This tag changed a moment ago (it may have just been sold)" (`TAG_CHANGED`), so a sold saree can never become sellable again. Live 16 Oct 15:33 IST. Test: `tests/api/admin-edge-cases.test.js` (holds the tag's row while the sale lands, so it is not left to chance).

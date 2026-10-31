# Module 3: Categories and subcategories

| | |
|---|---|
| **Status** | Built and tested 2026-10-11 (mock-up, backend, app, real Android phone). See sections 13–15. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners add and change categories, subcategories, prices and photos. Staff view them (Module 2). Both can make and share catalogue PDFs. |
| **Builds on** | [Module 1: Sign in](module-01-sign-in.md), [Module 2: Roles and team](module-02-roles-and-team.md) (`catalog.view`, `catalog.edit`) |
| **Mock-up** | [`docs/design/ui-mockup/module-3-categories/`](../design/ui-mockup/module-3-categories/index.html): 17 screens, the shop's real catalogue |
| **Old system notes** | [`current-system/admin-app-2-catalog.md`](../current-system/admin-app-2-catalog.md), sections 0–6 |

## 1. Goal
The owner keeps the shop's catalogue right: the categories, the subcategories under them, their prices, photos and whether the website shows them. Every change appears on the customer website straight away, so changes must be hard to get wrong and easy to check. Staff can look anything up, and anyone can send a customer a catalogue PDF on WhatsApp.

## 2. What is in this module
- **Categories:** list, add, edit (name, description, photo), reorder, delete (never erased: see 5.0).
- **Subcategories:** list per category, search, add, edit (name, description, store price, website price, MRP, photo), show or hide on the website, reorder, delete (never erased: see 5.0).
- **Catalogue PDF:** one per subcategory, made from its in-stock products, shared with a customer on WhatsApp.
- **Read-only view for Staff** (Module 2: categories and prices are view-only for Staff).
- **Audit:** every change goes to the activity trail (shown in Module 10), with old and new prices.

**Not in this module:**
- Products, their photos and barcodes: Module 4.
- What the counter shows when a tag is scanned: Module 5.

## 3. Today's catalogue (from the copy of the live data, 2026-10-11)
| What | Count |
|---|---|
| Categories | 6, all with photos |
| Subcategories | 155 (102 of them under Mangalagiri Handloom Pattu Sarees) |
| Subcategories with no photo of their own | 99 |
| Subcategories with no products yet | 88 |
| Hidden from the website | 0 |
| With an MRP (the struck-through price on the website) | 149, though the old app can't edit MRP |
| Store price different from website price | 154 (website higher on 49, lower on 105) |
| Catalogue PDFs made so far | 48 |
| Most products in one subcategory | 73 |
| Test leftovers | e.g. "Test1" at ₹10, two subcategories at ₹9 |

## 4. Problems in the old app (what this module fixes)
1. **MRP can't be edited.** The website shows it struck through with a "% off", but the app has no field, so when a price changes the MRP and discount can go wrong.
2. **Deleting a subcategory really erases it, and its products too**, along with stock history, pieces and some unpaid customer orders. One bug removes unpaid orders that also held *other* products. Its catalogue PDF file is left behind in storage.
3. **No way to delete a category**, even an empty one, and no way to tidy up the test leftovers.
4. **Price changes save instantly with no check.** A typo (₹540 instead of ₹5,400) goes live on the website at once.
5. **Reordering means typing position numbers.**
6. **Renaming a category changes its web address**, so old links and Google results break.
7. **Duplicate names:** two categories can have the same name; a duplicate subcategory name gives a vague error.
8. **A photo can only be added after the first save**, and there's no crop, while the website shows category photos as landscape tiles.
9. **Search works only inside one category.** With 155 subcategories, finding "300k checks" means guessing the category first.
10. **Small text bugs:** product count labelled "pieces", the store price shown twice, "Tap Save Changes" when the button says "Save".
11. **Catalogue PDF:** the screen says it includes "every active product" but includes only in-stock products with a photo; on iPhone the caption isn't sent.

## 5. Decisions

### 5.0 Delete means "inactive", never erased (decided by the owner, 2026-10-11)
When an owner deletes a category or subcategory, it is set to **inactive**. Inactive items appear in no list and no API answer, in the app or on the website. They stay in the database, so old orders, invoices and history still show their names. Nothing in this module ever erases a row.

| # | Rule | Example |
|---|---|---|
| 1 | **Hide and Delete are different.** "Show on website" off: customers can't see it, but the app still shows it. Delete: gone from the app *and* the website, kept in the background. | Hide "Wedding Collection" for a season, show it again later. |
| 2 | **Delete also hides it from today's website**, which still runs on the old backend. | Deleted in the new app → gone from the current website at once. |
| 3 | **A subcategory can't be deleted while any of its sarees are in stock** (or held by an online order). Sold ones don't count. | "5 sarees are still in stock. Sell or move them first." Today 62 subcategories have stock; the other 93 can be deleted now. |
| 4 | **A category can't be deleted until all its subcategories are deleted.** | Delete the subcategories inside "Pattu Lehanga Sets" first. |
| 5 | **A deleted name can be used again.** | Delete "300k Checks"; months later, create a new "300k Checks". |

### 5.1–5.12 The other questions
The owner approved the recommendations ("ok this is great", 2026-10-11). The ⭐ option is the decision in every row; 5.2 and 5.3 are replaced by 5.0.

| # | Question | Options | Recommendation |
|---|---|---|---|
| 5.1 | **MRP** (the struck-through price on the website) | A ⭐ Add an optional MRP field. It must be higher than the website price, and the screen shows the "% off" the customer will see. · B Leave MRP out, as today. | **A.** 149 subcategories already have an MRP the owner can't see or change. |
| 5.2 | **Deleting a subcategory** | Replaced by 5.0: delete = inactive; refused while any of its sarees are in stock. | **Decided (5.0).** |
| 5.3 | **Deleting or hiding a category** | Replaced by 5.0: delete = inactive, only when all its subcategories are deleted. No category-level hide: hide the subcategories. | **Decided (5.0).** |
| 5.4 | **Price changes** | A ⭐ Before saving, show "old → new" for each price, and warn when a price drops by more than half or goes under ₹100. · B Save straight away, as today. | **A.** Prices go live on the website immediately; one look-over prevents expensive typos. |
| 5.5 | **Reordering** | A ⭐ A "Reorder" mode: drag rows by a handle (with ▲▼ buttons too). · B Type position numbers, as today. | **A.** |
| 5.6 | **Search** | A ⭐ One search box on the Catalogue screen that finds subcategories in every category (by name or price). · B Search only inside a category, as today. | **A.** |
| 5.7 | **Price history** | A ⭐ The subcategory page shows its last price changes (who, when, old → new), from the activity trail. · B No history on screen. | **A.** No new data needed: the trail already records it. |
| 5.8 | **Category web address on rename** | A ⭐ Keep the old address, so links never break. · B New address on every rename, as today. | **A.** |
| 5.9 | **Photos** | A ⭐ Add the photo while creating; an optional crop with a frame shaped like the website tile. · B As today: after the first save, no crop. | **A.** |
| 5.10 | **Sharing the catalogue PDF on Android** | A ⭐ Straight into the customer's WhatsApp chat with the PDF attached, as today. This needs a small piece of our own Android code, which Invoices (Module 6) will reuse. · B The phone's share menu on both Android and iPhone (pick WhatsApp and the contact yourself). | **A.** Staff are used to it, and it saves steps at the counter. iPhone uses the share menu either way (Apple doesn't allow the direct route). |
| 5.11 | **Who can make and share catalogue PDFs** | A ⭐ Owners and Staff, as today. · B Owners only. | **A.** It is part of selling. |
| 5.12 | **Offline** | A ⭐ The catalogue (names, prices, photos already seen) stays viewable without internet; changes need internet. · B Online only. | **A.** As today. |

## 6. How it will work

### 6.1 Catalogue screen (More → Catalogue; also from Home later)
- Categories in shop order: photo, name, "N subcategories · N products".
- **Search all subcategories** (5.6): results show the subcategory, its category and its store price.
- Filter chips: **All · Hidden · Needs photo · No products** (to tidy up the 99 without photos and the 88 empty ones). Deleted items never appear.
- Owners: **+ New category** and **Reorder**. Staff: view only.
- Offline: the last copy with "Saved on …" (5.12).

### 6.2 Category page
- Header: photo, name, description, Edit (owners).
- Its subcategories: photo, name, store price and website price, product count, badges **Hidden** and **Needs photo**.
- Search inside the category, the same filter chips, **+ New subcategory**, **Reorder**.
- **Delete category**: asks first; refused until all its subcategories are deleted (5.0). The category then disappears everywhere but stays in the database.

### 6.3 Subcategory page
- Photo, name, description.
- Prices: **Store ₹**, **Website ₹**, **MRP ₹** with the "% off" the website shows (5.1).
- **Show on website** switch: hiding asks first and says it also hides its N products from the website.
- Product count, with a link to its products (Module 4).
- **Price history** (5.7).
- **Catalogue PDF** card: last made, how many products, Make new, Share.
- **Delete**: asks first ("it disappears from the app and the website; old bills keep its name"); refused while any of its sarees are in stock, with the count (5.0).
- Staff see the same page with no edit controls.

### 6.4 Add / edit forms
- Category: name, description, photo (5.9).
- Subcategory: name, description, store price, website price, MRP (optional), photo, show on website (new ones start visible, as today).
- Price changes get the "old → new" check before saving (5.4).
- Photos upload with Save; if the photo fails, the other changes stay saved and the photo can be retried (as today).

### 6.5 Catalogue PDF
- **Make**: one A4 page per product that is in stock and has a photo, oldest first: subcategory name, "ID: <tag numbers>", photo. No price or shop name (as today).
- The screen states exactly which products are included: "N products in stock with a photo".
- **Share**:
  - Android: enter the customer's number → WhatsApp opens on their chat with the PDF and the caption "Nandam Handlooms – <name> catalogue. Please tell us the ID number of the piece you like." You press Send (5.10).
  - iPhone: the share menu with the PDF and the same caption.
- The customer's number is never saved.

### 6.6 What Staff see
The same screens with no add, edit, reorder, hide, delete or photo controls, and a note "Only owners can change the catalogue." They can search, view prices, and make and share PDFs (5.11).

## 7. Rules
| Rule | Value |
|---|---|
| Category name | 2–100 characters, unique among active categories (ignoring capital letters and extra spaces) |
| Subcategory name | 2–150 characters, unique among active subcategories in its category (same way). A deleted item's name is free again (5.0) |
| Description | 1–2000 characters (the website shows it) |
| Store price, website price | Required, more than ₹0, at most ₹10,00,000, 2 decimals |
| MRP | Optional; if set, must be higher than the website price (5.1) |
| Store price and MRP | **Refused** when a store price is above the MRP (equal is fine; no MRP, no check). Owner's decision, 2026-10-12: it is always a typing mistake (like ₹54,310 for ₹5,431). Checked in the form (both price mistakes shown at once) and by the server (`STORE_ABOVE_MRP`). Hiding a row that already has a wrong price still works; changing any of its prices asks for the store price to be fixed first |
| Price warning | When a price more than doubles, drops by more than half, or goes under ₹100 (5.4). "More than doubles" was added during the build after finding a real ₹3,800 → ₹54,310 change in the history. With a warning, "Go back and fix" comes first |
| Hide a subcategory | It and all its products disappear from the website at once |
| Delete | Sets status to inactive and turns off "Show on website"; never erases. Subcategory: refused while any piece is in stock or held by an online order. Category: refused while it has active subcategories (5.0) |
| Inactive items | In no list, search, count or API answer; the database keeps them for old orders and history |
| Web address | Kept when a category is renamed (5.8) |
| Photos | JPEG, PNG or WebP up to 8 MB; stored as a JPEG of 80 KB or less, location data removed (as today) |
| Catalogue PDF | At most 10 per minute; one stored per subcategory, replaced each time |
| Who | Change: `catalog.edit` (owners). View: `catalog.view`. PDF: `catalog.view` (5.11) |

## 8. Data (same live database)
- Uses `Category`, `Subcategory`, `SubcategoryCatalogPdf` and `AuthEvent`. Positions use the existing `sortOrder`; "Show on website" uses the existing `isActive`.
- **Additive change (migration `20261011180000_v2_catalog_status`), for delete = inactive (5.0):**
  - `status` on `Category` and `Subcategory`: `active` (default) or `inactive`. Every existing row starts `active`.
  - The old "same name in a category" rule becomes "same name among **active** subcategories in a category", ignoring capitals and extra spaces; the same for category names. (Checked 2026-10-11: no duplicates in the live data, so the change is safe.)
  - Who deleted it, and when, is in the activity trail (`category_deleted`, `subcategory_deleted`).
- **During the switch-over:** the old admin app doesn't know `status`, so it would still list deleted items. Deleting also turns off "Show on website", so they stay off the website either way. This ends when the old app is retired.
- **For later modules:** Products (Module 4) and scanning (Module 5) must also ignore anything under an inactive subcategory.
- Activity names stay the same as the old app's (`category_created`, `subcategory_price_changed` with old and new values, and so on), so the old Activity screen keeps working during the switch-over.
- **Photos and PDFs:** the live files are in the shop's Amazon S3 storage. In production the new backend uses the same storage.
  - **Safety in development:** photos go to a local folder, and the backend never deletes a file it didn't create in that environment. Replacing a photo on the copy of the live data must never delete the live file the website is showing.

## 9. API (all under `/api/v2`, as built)
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/catalog/categories` | view | Categories with counts |
| POST | `/catalog/categories` | edit | Add |
| PATCH | `/catalog/categories/:id` | edit | Edit name, description |
| DELETE | `/catalog/categories/:id` | edit | Delete = set inactive (refused while it has active subcategories) |
| PUT | `/catalog/categories/:id/photo` | edit | Upload or replace the photo |
| PUT | `/catalog/categories/order` | edit | Save a new order |
| GET | `/catalog/categories/:id?q=&filter=` | view | A category page: the category, its subcategories and filter counts |
| GET | `/catalog/subcategories?q=&filter=` | view | Search across all categories |
| GET | `/catalog/subcategories/:id` | view | Subcategory page, including price history and PDF status |
| POST | `/catalog/categories/:id/subcategories` | edit | Add |
| PATCH | `/catalog/subcategories/:id` | edit | Edit, prices, show or hide |
| DELETE | `/catalog/subcategories/:id` | edit | Delete = set inactive (refused while any piece is in stock or held) |
| PUT | `/catalog/subcategories/:id/photo` | edit | Upload or replace the photo |
| PUT | `/catalog/categories/:id/subcategories/order` | edit | Save a new order |
| POST | `/catalog/subcategories/:id/catalogue-pdf` | view | Make a new PDF (10 a minute). Answers with its address, page count, file name and WhatsApp caption |

The last PDF is part of the subcategory page answer (`catalogue`), so there is no separate "get PDF" call. Photos are sent as multipart with the field name `photo`.

Every answer says what the person may do (`actions`), as in Module 2, so the app never re-implements the rules. Inactive items are never returned; asking for one directly gives `NOT_FOUND`. New refusal codes: `HAS_STOCK` (with the count), `HAS_SUBCATEGORIES`, `NAME_TAKEN`.

## 10. Building blocks (as built)
**Backend** (`Nadam-backend/`):
```
src/models/catalog.model.js        active-only queries, counts (products, in stock, PDF-ready), name rules, positions
src/services/catalog.service.js    categories, subcategories, delete = inactive, reorder, photos, price history
src/services/catalogPdf.service.js the PDF (same design as today's), tag numbers, sharing details
src/services/photo.service.js      JPEG of 80 KB or less, upright, no location data (reused by Module 4)
src/services/storage/              local folder (development; never deletes a file it didn't create) or S3 (production)
src/middlewares/upload.js          one photo, 8 MB, JPEG / PNG / WebP
src/controllers/catalog.controller.js, src/routes/catalog.routes.js, src/validators/catalog.validators.js
```
New settings: `STORAGE_PROVIDER` (local / s3; local is refused in production), `LOCAL_STORAGE_DIR`, `PUBLIC_URL`, `S3_*`, `WEBSITE_URL`. New libraries: sharp, multer, pdfkit, the AWS S3 client (the same ones the old backend uses).

**App** (`Nadam-frontend/admin-app/`):
```
src/app/(app)/more/catalogue/      index, category/[id], sub/[id], category-form, sub-form, reorder, pdf
src/api/catalog.js                 the endpoints, the offline copy, photo upload (Expo's native uploader)
src/utils/catalog.js               prices, % off, warnings, form checks, filters, search
src/utils/photo.js, src/components/catalog/PhotoCropper.js   pick, then crop to the website tile (4:3)
src/utils/sharePdf.js, modules/nandam-share/                 download the PDF; Android straight into WhatsApp
src/components/catalog/            rows, chips, thumbnails, price check, notes; src/components/SearchBox.js
```
New Expo packages: expo-image-picker, expo-image-manipulator, expo-file-system. The phone's own crop is always square on iPhone, so the crop screen is our own.

## 11. Testing plan
- **API tests:** every rule in section 7; Staff refused on every change; delete sets inactive and never erases (rows still in the database, old orders still show the name); inactive items missing from every list, search and count; delete refused while stock is in stock or held, and while a category has active subcategories; a deleted name can be reused; delete also turns off "Show on website"; MRP and price checks; hide removes the subcategory from what the website reads; the web address kept on rename; activity entries with old and new prices; photo upload limits; PDF contents (only in-stock products with photos, tag IDs); development never deletes files it didn't create.
- **App tests:** price warnings, the "% off" maths, filters, search.
- **Real phone:** the owner adds a category and a subcategory with a photo, changes prices (sees the check), reorders, hides and shows, deletes one (it disappears) and tries to delete one with stock (refused with the count); Staff view only; make a PDF and share it on WhatsApp to a test number; offline viewing.

## 12. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-11 | Plan drafted | Old app read in full; data counted from the copy of the live database. |
| 2026-10-11 | Recommendations | The owner approved the plan ("ok this is great"). |
| 2026-10-11 | Delete | The owner decided: delete never erases; it sets status to inactive, and inactive items appear nowhere. The 5 follow-up rules in 5.0 were explained with examples and agreed. |
| 2026-10-11 | Mock-up | Built with the shop's real catalogue; 70 / 70 browser checks. Found live data problems: "Gap Border bramini sarees" is ₹54,310 in store / ₹25,888 on the website (above its ₹16,999 MRP), from a change on 10 Oct. |
| 2026-10-11 | Build and phone test | See sections 13–15. |
| 2026-10-12 | Store price above the MRP | Found in the full test: a store price above the MRP could be saved. Owner chose **Refuse** (not warn). Added to the form and the server; server 289/289 and app 105/105 tests; on the phone, the ₹54,310 row shows "Can't be above the MRP (₹16,999)." and "MRP must be higher than the website price (₹25,888)" together and nothing is sent. Until switch-over, the old app can still save such a price (it uses the old server); Analytics → Stock → Prices to check lists any. |

## 13. Build status (2026-10-11)
| Check | Result |
|---|---|
| Backend tests | **138 / 138** (Modules 1–3; Module 3: 23 API + 6 unit) |
| App tests | **46 / 46** |
| App lint (`npx expo lint`) | clean |
| `npx expo-doctor` | 21 / 21 |
| Mock-up browser test | 70 / 70 |

## 14. Real-phone test (2026-10-11, Samsung Galaxy Note10 Lite, Android 12)
| # | Check | Result |
|---|---|---|
| 1 | Catalogue: 6 real categories with photos and counts; filter counts All 155 · Hidden 0 · Needs photo 99 | ✅ |
| 2 | Search across all categories by name ("rainbow") and by price ("2800") | ✅ |
| 3 | Subcategory page: store, website, MRP with "84% off", the website preview line | ✅ |
| 4 | Price check: store ₹3,400 → ₹54,310 warns "More than double (16×). Is this a typo?"; "Go back and fix" keeps the typing | ✅ |
| 5 | A normal change (₹3,600) saves after "Change prices?"; price history shows it above a real old-app change (4 Oct, System Admin) | ✅ |
| 6 | Delete with 32 sarees in stock is refused with the count, offering "Hide from website instead" | ✅ |
| 7 | Hide from / show on the website asks first; the database shows it off the website but still active | ✅ |
| 8 | Catalogue PDF made from 32 in-stock sarees in about 4 s; page design and "ID: 3" (tag NH3) checked | ✅ |
| 9 | "Share another way" opens the phone's share menu with the PDF attached | ✅ (closed without sending) |
| 10 | New category and subcategory with a photo (library → crop to the tile → upload); stored at 34 KB; live "45% off" preview | ✅ (after fix 1 below) |
| 11 | Delete a category with a subcategory is refused; delete the subcategory, then the category: both disappear from the app, kept as inactive and off the website in the database | ✅ |
| 12 | Reorder categories by dragging the handle, and with ▼; saved, then put back | ✅ |
| 13 | No server: the Catalogue shows the copy saved on the phone with its time; New is hidden | ✅ |
| 14 | Staff (Anil): read-only note, no New / Edit / Delete / website switch; can make and share the PDF | ✅ |

**Bugs found on the phone and fixed:**
1. **Photo upload failed on Android** ("Can't reach the server") although the same upload from the Mac worked. The photo is now sent with Expo's own native uploader instead of the app's general request helper; rechecked on the phone (created, uploaded, shown).
2. The category list cut "1399 products" short with this phone's large text; the line now wraps.

**Not done on the phone, on purpose:** "Share on WhatsApp" straight into a chat was not opened, to avoid starting a chat with a stranger's number from the owner's personal WhatsApp. The share-menu route proved the PDF download and attachment. The owner can try it with their own number.

## 15. Notes and next steps
- **Switch-over:** set `STORAGE_PROVIDER=s3` with the shop's bucket (the old backend's settings) and `WEBSITE_URL`. Development keeps photos in a local folder, so testing never touches live photos.
- **Live data to check with the owner:** "Gap Border bramini sarees" (₹54,310 store / ₹25,888 website, MRP below the website price), "Test1" at ₹10, two subcategories at ₹9.
- The test build talks to the Mac over Wi-Fi; the Mac's address changes with the network (it moved from 192.168.0.4 to 192.168.1.154 today), so the test app is rebuilt when it does.
- Subcategory list style: A (rows), as recommended. B (photo grid) is in the mock-up.
- Nothing is committed yet: by the owner's decision, commits wait until the whole app is done.

## 16. Change 23 Oct 2026: subcategories as big photos (client's request)
The client: "while viewing sub-categories the images look small; they should look like the website's products view, two images side by side".
- A category's subcategories, and the catalogue search's results, are now **cards in a grid**: two side by side on a phone, three on a tablet (the screens' content stops at 760 wide). Each card: the photo in the saree's own shape (3:4, as the website's saree cards), "Hidden" / "Needs photo" on the photo, the name (two lines), "38 products · 36 in stock" (may take a second line on narrow cards), the store price and "Web ₹…". In the search each card also names its category. Tapping a card opens the subcategory as before; filters, search, Show more and Reorder are unchanged.
- Code: `src/components/catalog/SubGrid.js` (replaces `SubRow.js`), used by `more/catalogue/category/[id].js` and `more/catalogue/index.js`. Tests `SubGrid.test.js`; app tests 145/145, lint clean.
- Checked on the Android emulator (test app on a copy of the shop data): the category from the client's photo and a search for "checks".
- **Android: shipped in build 31** (26 Oct 2026, `apk/Nandam-Admin-v2.0.0-build31.apk`, live server, owner key; the new cards are in its bundle and not in build 30's; opened to Sign in on the test emulator). **iPhone: not yet**, waits for the user's word (more changes are coming).

## 17. Change 23 Oct 2026: no shop name in the shared catalogue PDF (client's request)
The client: no "Nandam Handlooms" or other shop hint anywhere in the catalogue PDF a customer receives; the file is named after the subcategory only.
- Before: file `Nandam-GAP-BORDER-DIGITAL-PRINT-SAREES-catalogue.pdf`, message "Nandam Handlooms – GAP BORDER DIGITAL PRINT SAREES catalogue. Please tell us…", PDF title property "… catalogue". The pages themselves never had the shop name.
- Now: file `GAP BORDER DIGITAL PRINT SAREES.pdf`, message "GAP BORDER DIGITAL PRINT SAREES. Please tell us the ID number of the piece you like.", PDF title property the subcategory name only (the maker property stays "PDFKit"). Names keep their spaces, case and Telugu letters; `/` and `\` become `-` ("150/50 PLAIN SAREE" → "150-50 PLAIN SAREE.pdf"); `: * ? " < > |` are left out; an empty name gives `Catalogue.pdf`.
- All from the server (`src/services/catalogPdf.service.js`: `catalogueFileName`, `shareInfo`, PDF info), so **no app update**: it covers Android "Share on WhatsApp" / "Share another way" and iPhone "Share PDF", and PDFs made before the change.
- Tests: `tests/api/catalog.test.js` (name in file/message/title, no "nandam" in the PDF text, raw file, file name, message or subcategory details; file-name cleaning); server 595/595.
- Cross-check: all 117 live subcategory names and 1,935 in-stock tag numbers have no shop name; 68 PDFs made from the shop data (5 categories) have none either. Emulator (test app): share sheet shows "Gap border Embroidery sarees.pdf", the message is "Gap border Embroidery sarees. Please tell us the ID number of the piece you like."
- Data notes for the shop (not code): the category description of MANGALAGIRI HANDLOOM PATTU SAREES says "NANDAM HANDLOOMS" (not used in the PDF); test pieces TEST02/TEST05 are in stock in "50/50 Plain Dress Materials" and a "Test1" subcategory exists; a photo with a shop board or watermark in it would still show.
- **Live since 23 Oct 2026 ~18:30 IST** (record and undo: `deployment/live-v2-server.md` → "Changes deployed"). The 62 live subcategories with a PDF all give `<name>.pdf` and a message without the shop name.


## 18. Change 27 Oct 2026: a category's photo is the website's tall card (3:4), with the frame on the camera (owner's request)
The website's home page now shows the 6 categories as cards at the top, only the photo and the name, the photo the shape of a saree card (3:4; live 27 Oct, `web-02-home-and-shop.md`, web-11 mock-up). The app cropped category photos 4:3 and offered "Use the whole photo", so the card cut them again (the owner: "the app is not taking size correctly … it is cropping"). Now a category photo is made for the card, like a saree's:
- **Take photo** opens the app's own camera with the white 3:4 frame on it (as Quick add's saree photo), torch and close; the crop screen then opens on that frame to adjust. **Choose from library** opens the same 3:4 crop.
- **No "Use the whole photo"** for a category, so every category photo fits its card. A photo too small for the card (its 3:4 cut under 800 px tall, e.g. a 522 × 397 picture) gets a warning on the crop screen: "This photo is small, so it will look blurry on the website…".
- In the app the category photo is shown tall too: the catalogue list thumbnail (54 × 72) and the category page photo (3:4, 58 % wide, as a saree's page).
- **Subcategories are unchanged**: landscape tiles (4:3) with "Use the whole photo", the system camera.
- The server is unchanged: it still stores every photo as a JPEG of 80 KB or less, longest side up to 960 px (720 × 960 for a card), enough for the website's card.
- Code: `components/catalog/PhotoField.js` (`shape="card" | "tile"`, `PHOTO_SHAPES`), new `components/catalog/PhotoCamera.js`, `PhotoCropper.js` (`allowWhole`, `smallBelow`), `TagScanner.js` (camera-permission words as props), `Thumb.js` (`HeroPhoto` ratio), `more/catalogue/category-form.js`, `category/[id].js`, `index.js`. Tests `components/catalog/PhotoField.test.js`; app tests 150/150, lint clean. Code backup before: `~/Documents/Nandam-Handlooms/admin-app-backup-2026-10-27-before-category-photo/`.
- Existing category photos stay as they are until replaced (on 27 Oct: Pattu sarees a poster with writing; three are 400 × 225; Cotton sarees the owner's test picture).
- **Android: shipped in build 32** (27 Oct 2026, `apk/Nandam-Admin-v2.0.0-build32.apk`, SHA-256 `71c5e2ee…9f6`, live server, owner key `AE:81:AD:22`; copy + `-guide.txt` on the Desktop for the testing team). The new camera and crop texts are in its bundle; it installed and opened to Sign in on the test emulator. The camera and crop were not tried on a real phone by me (no phone connected; signing in needs a real account). **iPhone: not yet**, waits for the user's word.

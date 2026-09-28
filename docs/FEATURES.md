# Nandam Handlooms: feature list (as built)

*Taken from the code on 28 Sep 2026 (staff app build 21). For what is switched off or missing, see [HANDOVER.md §8](HANDOVER.md#8-switched-off-missing-or-next-work).*

## A. Customer website (`frontend/customer-web`)

**Browsing**
- **Home page:**
  - hero banner with 5 slides that auto-rotate;
  - "Shop by Category" grid;
  - Bestsellers (8 featured products);
  - craft story section;
  - store location with address, call, directions and copy-address.
- **Header:** live category links, search (desktop), cart badge, account icon. On mobile there is a slide-in menu.
- **Footer:** shop links, account links, store address, phone, hours, Google Maps.
- **Category page:** subcategory cards.
- **Product list** (`/shop`, `/category/:slug/:subcategoryId`, `?q=` search):
  - Search looks in name, colour, pattern, technique and subcategory.
  - Sort by newest, price ↑, price ↓ or bestsellers.
  - 12 per page, with Previous/Next.
- **Product page:**
  - gallery with thumbnails;
  - online price, MRP crossed out and "% off";
  - attributes table: technique, border, purity, zari, blouse, pattern, colour, fabric, occasion;
  - Add to Cart and Buy Now.
- **Only in-stock items are listed.** A sold piece returns "No longer available".
- **The store price is never exposed.**

**Cart and checkout**
- The cart is stored in the browser (no login needed). One line per piece, with remove. No shipping fee.
- Checkout requires login. Pick a saved address or add a new one.
- Live stock check before paying; unavailable lines are flagged and must be removed.
- Payment through the Razorpay popup. Pieces are held for 10 minutes while the customer pays.
- Order confirmation page (paid / pending / failed) with invoice download.

**Account**
- **Sign up:** name, mobile, state, pincode → OTP → set a 4- or 6-digit MPIN.
- **Login:** mobile + MPIN (lockout after 5 wrong tries). Forgot MPIN works through an OTP.
- **Profile:** name, state, pincode.
- **Address book:** add, edit, delete, set default.
- **My Orders:** the latest 10.
- **Order detail:** items, address, status, DTDC AWB with a DTDC tracking link, invoice download.

## B. Staff app (`frontend/app`, Android)

**Login and session**
- Mobile + MPIN. The number is remembered.
- First-time **Activate** (OTP → set MPIN) and **Forgot MPIN**.
- Silent token refresh. Poor network never logs you out.
- Roles: **Owner (ADMIN)** and **Staff**.

**Home**
- **Owner:** "Sold today" (online, store and WhatsApp, with count and ₹) and today's sold products.
- **Staff:** welcome card, with no revenue shown.
- **Both:** To Ship / Shipped shortcuts, quick-actions carousel, manage tiles.

**Scanner: Scan to Sell**
- **Finding items:**
  - camera barcode scan (Code128, EAN, UPC, Code39/93, ITF, Codabar, QR);
  - or type the code, or just its short number.
- **The bill:**
  - add as many items as needed with Add More; remove any item;
  - **selling price can be changed per item** for bargaining. The catalogue price is unchanged and the change is recorded in the activity log.
- **Sale type:**
  - **Offline store**; or
  - **Through WhatsApp:** needs the customer's phone and address, and the order goes to To Ship.
- **Invoice:** "Invoice required" or "Not required".
- **One bill makes one order**, and one invoice if required.
- **Items reserved online:** only the owner can override.
- **After the sale:** send the invoice PDF straight to the customer's WhatsApp chat (Android), print it, or share it.
- **Price Check mode:** shows price and status without selling.
- Selling is blocked while offline.

**Products**
- **List:**
  - search, and scan-to-find (with "create product" if the code is unknown);
  - infinite scroll with stock badges;
  - live-listings meter (cap of 5,000);
  - offline cached view.
- **Add product:**
  - photo from camera or gallery, with **crop and rotate**;
  - category and subcategory pickers (with recent picks);
  - bestseller switch;
  - where it sells (online + store / online only / store only);
  - scan or type barcodes, with a duplicate check.
- **Edit product:** see its pieces and their status.
- **Delete:** archived instead if the product has sales history.

**Catalogue and prices (owner)**
- **Categories:** add, edit, photo, position.
- **Subcategories:**
  - website price, store price, description, photo, position;
  - **show or hide on the website**;
  - delete, which is blocked if any piece has been sold.
- Subcategory search, with recent searches.
- **Catalogue PDF** per subcategory: one photo per page with ID numbers, shared through the share sheet.

**Orders**
- **To Ship / Shipped** lists, with date filters.
- **All Orders (owner):** online, store and WhatsApp.
- **Order detail:**
  - items and ship-to address;
  - call the customer, copy the address.
- **Shipping:** enter or scan the **DTDC AWB** → mark shipped → share tracking details and the invoice on WhatsApp.

**Invoices**
- List with channel and date filters, including a custom range.
- Detail with the CGST/SGST split; print or share.
- Consolidated **sales summary PDF** for any period and channel.

**Owner only**
- **Analytics:** revenue, orders, average order value, split by channel, top subcategories; date and channel filters.
- **Activity log:** sign-ins, price changes, overrides, shipments, product and catalogue changes. Kept 30 days, grouped by day.
- **Team:** invite staff, revoke access (signs them out everywhere).

**Other**
- More/Profile screen, logout, animated splash, offline banners.
- Push notifications are built but switched off.

## C. Backend (`backend`)

- **REST API** under `/api/v1`: public catalogue, customer auth and account, orders, admin (staff app), webhooks. See each `src/modules/*/*.routes.ts`.
- **Auth:**
  - JWT access token (15 min) plus a rotating refresh token (1 day). Web uses an httpOnly cookie; the app keeps it in the response body.
  - Refresh-token reuse detection.
  - The account is re-checked on every request, so revoke or MPIN reset takes effect immediately.
  - Argon2id MPIN hashing; blocklist of trivial PINs.
- **Rate limits** on login, OTP, checkout, verification, reports and catalogue PDFs.
- **Inventory:**
  - pieces with unique barcodes;
  - barcode matching across EAN/UPC forms and short numbers;
  - atomic reservations;
  - append-only stock ledger;
  - low-stock report (≤3);
  - 5,000 active-listing cap.
- **Orders and payments:**
  - Razorpay order, signature verification and webhook (`payment.captured`), all idempotent;
  - the `order.paid` outbox event triggers the invoice and a staff push.
- **Invoices:** sequential numbers, GST-inclusive 5% split CGST/SGST, PDF with letterhead and GSTIN and the barcode per line, stored on S3. Also a sales summary PDF.
- **Catalogue PDF generation** per subcategory.
- **Analytics:** summary with previous-period comparison; top subcategories.
- **Audit log:** about 30 event types, plain-English presentation, 30-day retention for staff events.
- **Retention:** delete orders older than 6 months; monthly orders CSV backup; manual preview, purge and export endpoints (owner).
- **Integrations:** S3 or local storage; Razorpay; MSG91 or console SMS; Expo push.
- **Scripts:**
  - `prisma/seed.ts` (roles, bootstrap admin, catalogue, demo data);
  - `seed-demo-extra.ts`, `seed-analytics-demo.ts` (extra demo data);
  - one-off migration scripts.

# Nandam Handlooms: the scratch build (v2), knowledge transfer

Last updated: **15 Oct 2026**. Covers everything built from scratch since 10 Oct 2026: the new admin app, the new server (`/api/v2`), every module, every decision, how it runs, and what is still open.

**Who this is for:** a developer taking over or joining the project, and the owner as a single reference. It is the starting point. The per-module documents in `docs/modules/` hold the full detail (each one has the plan, options discussed, decisions, test results and switch-over notes). Where this document and a module document disagree, the code and the "as built" sections of the module document win.

**No secrets are in this document.** Keys, passwords, PINs, database addresses and server settings live only in the server's `.env` files and in private folders on the owner's Mac. Never put them in the repo or hand them to developers.

---

## Contents

1. [The project in one page](#1-the-project-in-one-page)
2. [Timeline](#2-timeline)
3. [Ground rules and standing decisions](#3-ground-rules-and-standing-decisions)
4. [How the old and new systems fit together](#4-how-the-old-and-new-systems-fit-together)
5. [Folders](#5-folders)
6. [Server (Nadam-backend)](#6-server-nadam-backend)
7. [Database](#7-database)
8. [Admin app (Nadam-frontend/admin-app)](#8-admin-app-nadam-frontendadmin-app)
9. [Security model](#9-security-model)
10. [The 11 modules](#10-the-11-modules)
11. [Rules that cut across modules](#11-rules-that-cut-across-modules)
12. [Environments, deploying and building](#12-environments-deploying-and-building)
13. [Testing](#13-testing)
14. [Changes after go-live (13 to 15 Oct)](#14-changes-after-go-live-13-to-15-oct)
15. [Open decisions, known issues and to-do](#15-open-decisions-known-issues-and-to-do)
16. [Do-not-break checklist](#16-do-not-break-checklist)
17. [Documentation that is out of date](#17-documentation-that-is-out-of-date)
18. [Glossary](#18-glossary)
19. [Where to find more](#19-where-to-find-more)

---

## 1. The project in one page

**The shop.** Nandam Handlooms, Mangalagiri: a saree shop selling at the counter, over WhatsApp, and on its website. Every saree carries a printed barcode tag (for example `NH1296`). Staff add sarees with photos and tags, sell them by scanning, ship WhatsApp and website orders by DTDC, and the owner watches sales and stock.

**Why a rebuild.** On 10 Oct 2026 the owner decided to rebuild the admin app, its server and (later) the customer website from scratch, because the old code had too many bugs. The aim is a clean, documented, hand-over-ready codebase that any developer can take over.

**What exists now (15 Oct 2026):**

| Part | Status |
|---|---|
| New admin app "Nandam Admin" (Expo / React Native, Android and iPhone) | All 11 modules built and tested on a real Android phone (11 to 12 Oct). Live for the whole team since 15 Oct |
| New server (Node, Express, Prisma), API `/api/v2` | Live since 13 Oct on the shop's server, on the **same live database** as the old system |
| New customer website | Not started. The old website still runs, on the old server |
| Old staff app, old server (`/api/v1`), old website | Still running. The old staff app is being replaced; the old website stays until its own rebuild |

**Who uses the new app.** Owners and staff of the shop. Customers never sign in to it. Two roles: **Owner** (database role `ADMIN`) and **Staff** (`STAFF`).

**Where it runs.** One AWS EC2 server in Mumbai runs the old server, the new server and nginx. The database is PostgreSQL on Neon (Singapore). Photos and PDFs are in the S3 bucket `nandamhandlooms-media`. SMS codes go through Message Central.

---

## 2. Timeline

| Date (2026) | What happened |
|---|---|
| 10 Oct | Owner decides to rebuild from scratch. Ground rules set. A snapshot of the old system written to `docs/current-system/` |
| 11 Oct | Modules 1 to 5 planned, mocked up, built and tested on a real Android phone (Sign in, Team, Catalogue, Products, Scan to sell). Module 6 (Invoices) too |
| 12 Oct | Modules 7 to 11 built and tested (Orders, Home, Analytics, Activity, Settings). Store price above MRP refused (owner's rule). Every list made 20 per page (owner's rule). A full Android walk-through passed. A team test server started (later paused) |
| 13 Oct | **Go-live for one person.** 11 database updates applied to the live database; new server started as pm2 `nandam-v2`; iPhone build 2.0.0 (7) to the tester (Dheeraj) only. Test server paused for memory |
| 15 Oct | Testers report: Home → "Add sarees" does nothing, and the iPhone swipe-back doesn't work. Both fixed (iPhone build 8, Android build 26). Build 8 **shared with everyone**, single TestFlight group. App theme choice added (iPhone build 9, Android build 27). Android testers moved to the live app |
| 15 Oct (afternoon) | Client asks for the old app's "one photo, several barcodes" back (a **set** of identical sarees). Mock-up `module-4b-tag-sets`; owner picks A (count first). Built, server change live 13:20 IST, Android build 28, iPhone build 10 shared with everyone |
| 15 Oct (evening) | **Website module W1 (customer sign-in and My account) built and tested** on the owner's Mac: one additive database update, `/api/v2/shop`, the React website in `customer-web` (design C, Auto/Light/Dark). Server 411 tests, website 28, browser runs Chrome 245 and WebKit 122 |
| 16 Oct (~01:50 IST) | **W1 live on `nandamhandlooms.com`**, replacing the old website for the rest of development (old files kept aside). Database update + pincodes on live, server restarted with W1, nginx with strict security headers |

---

## 3. Ground rules and standing decisions

These were set by the owner and apply everywhere.

**How the work is done**
- The old code in the repo stays untouched; it is only a reference. New code lives in `Nadam-Handloom-production/`.
- The new system works on the **same live database** as the old one. Database changes must be **additive only** (new tables, new nullable columns). Nothing the old app's habits could break goes into the database; such rules live in the new server's code.
- Features stay the same as today; improvements are agreed module by module.
- Admin app first, end to end. Then the customer website.
- Each module, in order: plan → mock-up (owner picks the design) → backend → tests → app screens → real-phone test → decision record. The owner reviews each module before the next starts.
- **Nothing is committed to git until the owner says so** (the whole `Nadam-Handloom-production/` folder is untracked). When it is, it goes to `develop`.
- Testing is on **real phones**. An emulator is used only after asking.
- Live actions (database updates, builds that reach people, server restarts, backups) need the owner's explicit go each time.

**Product decisions that shape everything**
- Phones and tablets only, Android and iPhone. No browser version for now.
- Sign-in lasts **7 days**, renewed on every use; nobody is logged out while working; a bad network never logs anyone out.
- Two fixed roles (Owner, Staff), no per-person switches. Staff never see money totals.
- **Delete never erases.** It marks things inactive and they disappear from every list, the app and the website, but stay in the database.
- **One saree = one tag.**
- Prices (store, website, MRP) belong to the **subcategory** ("design"). Every saree in it shares them.
- Every list loads **20 at a time**.
- No push notifications for now (they need Firebase and an Apple push key in the shop's name).
- Design system (11 Oct): theme follows the phone (now also a per-phone Auto/Light/Dark choice), **Peacock palette** (teal `#0D5C61` + copper `#C46A35`), **Plus Jakarta Sans**, soft corners, a woven header on sign-in, PIN boxes, a floating tab bar on phones and a side rail on tablets.

---

## 4. How the old and new systems fit together

```
                         api.nandamhandlooms.com (nginx, HTTPS)
                         │
        ┌────────────────┼──────────────────────┐
        │ /api/v1/…      │ /api/v2/…            │ /test/api/v2/… (paused)
        ▼                ▼                      ▼
  pm2 nandam-api   pm2 nandam-v2          pm2 nandam-v2-test
  old server       NEW server             test server
  port 4000        port 4200              port 4100
        │                │                      │
        └──── same live database (neondb) ──┐   └── nandam_v2_test database
                                            │
  old website (nandamhandlooms.com) ────────┘  S3: nandamhandlooms-media (real folders;
  old staff app ("Nandam Handlooms" 1.0.0)          test server only under v2-test/)
  NEW app ("Nandam Admin" 2.0.0) ── /api/v2
```

- The old server, the old website and the old staff app keep working exactly as before. The new app talks only to `/api/v2`.
- Both servers read and write the same tables. So a sale made in either app shows in both, and the old server's background jobs (below) still act on everything.
- **Old server jobs that matter to the new system** (they run until the old server retires):
  - Deletes staff-app activity records older than **30 days**, every 6 hours. The first deletions would come around **4 Nov 2026** and would remove the new app's history too. **Must be switched off before then.**
  - Deletes orders older than 6 months (first deletions about April 2027). Must be switched off: sales are GST records.
  - Reservation sweep every 15 s, events outbox every 5 s.
- iPhone: the new app is an **update of the old staff app** (same app id `com.nandamhandlooms.staff`, version 2.0.0, build 7 onwards). Android: the new app is a separate app (`com.nandamhandlooms.admin`) installed beside the old one, signed with the same owner key.

---

## 5. Folders

```
Nadam-Handloom-production/
├── README.md                    ground rules, folder guide
├── Nandham-scratch-KT.md        this document
├── Nadam-backend/               the new server
├── Nadam-frontend/
│   ├── admin-app/               the new admin app (live)
│   └── customer-web/            the new customer website (React + Vite; W1 sign-in and My account built 15 Oct, not live)
└── docs/
    ├── README.md                index and module status
    ├── current-system/          snapshot of the OLD app (3 files), what it did and its problems
    ├── modules/                 module-01 … module-11 (admin app) and web-00 … (website): plan, decisions, results, switch-over notes
    ├── design/ui-mockup/        clickable HTML mock-ups, one per module
    ├── testing/                 test-server.md, full-app-test-list.md (checks still to do on devices)
    ├── deployment/              live-v2-server.md (the live set-up, update and undo steps, builds)
    └── to-do-list.md            the owner's open list after all modules were built
```

To view a mock-up: `python3 -m http.server 8791` inside `docs/design/ui-mockup/`, then open the module's folder.

Private files that are **not** in the repo (owner's Mac): the Android signing key (`~/Documents/Nandam-Handlooms/signing/`), the iPhone signing files and App Store Connect key (`~/Documents/Nandam-Handlooms/ios-release/`), database backups, the live `.env` files (on the server only), built apps (`~/Documents/Nandam-Handlooms/apk/`).

---

## 6. Server (Nadam-backend)

**Stack:** Node 22+ (24 on the server), ES modules, Express 5, Prisma 7 with the `pg` adapter, zod 4, argon2, jsonwebtoken, helmet, morgan, multer, sharp, pdfkit, AWS S3 SDK. Tests: Vitest + Supertest.

### 6.1 Layout and request flow

```
server.js            starts the app, the clean-up job, and shuts down cleanly (10 s hard stop)
src/app.js           helmet, JSON limit 50 kb, request context, logging (never bodies), /api/v2, errors
src/config/          env.js (settings checked with zod), constants.js (sign-in rules),
                     permissions.js (role → permissions), database.js (the one Prisma client)
src/routes/          one file per area: auth, me, team, catalog, product (+ tag routes), sale,
                     invoice, order, home, analytics, activity, settings, index
src/controllers/     thin: read req.valid, call the service with { viewer, ctx }, send JSON
src/services/        all the rules, transactions and activity logging
src/models/          data access only (Prisma calls)
src/middlewares/     authenticate, requirePermission, validate, rateLimit, requestContext,
                     upload (one "photo" field, ≤ 8 MB, JPEG/PNG/WebP), errorHandler
src/validators/      zod schemas per area
src/utils/           errors, crypto, day.js + period.js (India time), gst.js, page.js (20 per page),
                     phone, pin, present (what the API returns), tags
src/jobs/            cleanup.job.js (the only job)
prisma/              schema.prisma, migrations/ (31), dev-seed.js (local only)
scripts/             one-off data scripts (6.4)
tests/               api/ (17 files), unit/ (13 files), support/
```

A request goes: **route** (path + `authenticate` + `requirePermission(...)` + `validate(schema)`) → **controller** → **service** → **model**.

Services by area:
- Sign-in and security: `auth`, `session`, `token`, `pin`, `lock`, `code` (SMS codes), `device`, `biometric`, `me`, `audit`, plus `sms/` (console or Message Central) and `storage/` (local or S3).
- Shop: `team` (+ `inviteMessage`), `catalog`, `catalogPdf`, `product`, `photo`, `sale`, `invoice`, `invoiceBook` (the invoice list), `invoicePdf`, `salesSummary`, `salesSummaryPdf`, `order`, `home`, `analytics`, `activity`, `settings`.

### 6.2 What every request carries

- The app sends `Authorization: Bearer <access key>`, plus `X-Device-Id`, `X-Platform` (ios/android) and `X-App-Version` on every request.
- `authenticate` checks, on **every** request: the key, the session (not ended, not expired), that the phone is still trusted and matches, that the account still has access and its security stamp matches, and **reads the role from the database** (so a role change applies at once). While the staff app is paused, staff get `503 MAINTENANCE` (except `GET /me`).
- Rate limit per IP, stored in the database, 60 per minute by default (generous because the shop's phones share one Wi-Fi). The real protection is per mobile number (PIN locks, SMS limits). Tighter limits: catalogue PDF 10/min, sales summary 20/min.

### 6.3 Errors

Always `{ "error": { "code", "message", "details"? } }`. The app switches on `code`; `message` is plain English that can be shown as is.

| Status | Codes |
|---|---|
| 400 | `BAD_JSON`, `VALIDATION_FAILED` (with `details.issues[{field, message}]`) |
| 401 | `SESSION_INVALID`, `SESSION_EXPIRED`, `ACCESS_TOKEN_EXPIRED`, `SIGNED_OUT_FOR_SAFETY`, `SIGNED_OUT_REMOTELY`, `PIN_CHANGED`, `ACCESS_REMOVED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | conflicts (for example `REFRESH_RACE`, `HELD_ONLINE`, `TAG_TAKEN`) |
| 413 / 423 / 429 | `TOO_LARGE` / `LOCKED` / rate limited with `Retry-After` |
| 503 | `MAINTENANCE` |
| 500 | `INTERNAL` (logged; internals never leak) |

### 6.4 Scripts (`scripts/`, dry run by default, `--yes` to write)

| Script | What it does |
|---|---|
| `copy-store-prices.js` | Copies the store price onto each counter/WhatsApp sale line (`OrderItem.storePrice`) from the bargain records, or the sold price if none. Ran on live 13 Oct (160 lines). **Run again at the final switch-over** |
| `fix-product-names.js` | Gives every saree its subcategory's name. `--csv` writes the list for the owner to check first (501 stale names, 27 pairs; some sarees may be in the wrong subcategory) |
| `invite-member.js <mobile> "<name>" <owner\|staff>` | Invites one person from the server (used for the first tester) |
| `set-main-owner.js <mobile>` | Sets the single main owner at switch-over (not set yet: the owner has to confirm the number) |
| `prepare-test-db.js`, `remake-test-invoices.js` | Test-copy only; refuse any database whose name doesn't contain `v2_test` |

### 6.5 Settings names (values only in the server `.env`)

`NODE_ENV`, `PORT`, `HOST`, `TRUST_PROXY`, `LOG_REQUESTS`, `RATE_LIMIT_PER_MINUTE`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_STEP_SECRET` (each 32+ characters, different), `SMS_PROVIDER` (`console` | `messagecentral`), `MESSAGE_CENTRAL_CUSTOMER_ID`, `MESSAGE_CENTRAL_KEY`, `INVITE_APP_LINK`, `PUBLIC_URL`, `WEBSITE_URL`, `STORAGE_PROVIDER` (`local` | `s3`), `LOCAL_STORAGE_DIR`, `S3_BUCKET_NAME`, `S3_REGION`, `S3_PUBLIC_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_KEY_PREFIX`, `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_MOBILE`, `COMPANY_GSTIN`, `GST_RATE_PERCENT` (default 5).

Website W1 (15 Oct): `JWT_SHOP_ACCESS_SECRET` (required, a third different secret), `SHOP_WEB_ORIGINS` (required in production), `SHOP_COOKIE_SECURE`, `SHOP_SMS_DAILY_LIMIT` (500), `SMS_PROVIDER` may also be `msg91` (`MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`), `MESSAGE_CENTRAL_CODE_TTL_SECONDS` (60), `PUSH_PROVIDER` (`fcm` | `console`), and the ten `FIREBASE_*` values.

At start-up the server refuses console SMS or local storage in production, Message Central without its keys, and S3 without bucket and region. SMS codes are shown in API replies only with the console provider outside production.

### 6.6 The clean-up job

`jobs/cleanup.job.js`, every **15 minutes**: deletes Face ID challenges older than 1 hour, the new server's rate-limit rows older than 2 hours, ended sessions past their own expiry, and **sign-in records older than 365 days**. Nothing else in the activity log is ever deleted by the new server. There is no other scheduler; time-based things (running low, reminders) are worked out when asked.

---

## 7. Database

PostgreSQL, Prisma schema `Nadam-backend/prisma/schema.prisma`. Old tables first, new v2 tables at the end.

### 7.1 Main tables

| Area | Tables |
|---|---|
| People and sign-in | `AuthAccount` (one login per phone; PIN hash, status, security stamp, tries, lock), `AdminProfile` (team member name, main owner, invited/removed), `UserProfile` (customers), `Role`/`UserRole`/`Permission`/`RolePermission` (old role tables: ADMIN, STAFF, CUSTOMER), `Session` (refresh-key hash), `TrustedDevice` (v2), `AuthChallenge` (v2), `LoginThrottle` (v2), `OtpCode`, `AuthEvent` (the activity log), `RateLimitHit`, `DeviceToken`, `PasswordResetToken`, `ApiToken` |
| Catalogue and stock | `Category`, `Subcategory` (the "design": prices, description, website switch), `Product` (one saree listing), `Piece` (one barcoded tag; `barcode` unique; status in_stock / sold_offline / sold / reserved / damaged / retired / removed …), `ProductImage`, `StockLedger` (every stock movement, append-only), `Reservation` (online checkout holds), `SubcategoryCatalogPdf` |
| Orders and money | `Order` (one bill or order; `channel` online / store / whatsapp), `OrderItem` (a line; the agreed price), `Payment` (Razorpay), `Shipment` (DTDC tracking number `awbNumber`), `Invoice` (one GST invoice per order), `Address`, `EventsOutbox` |
| Settings | `AppConfig` (one "default" row shared by both apps and the old website: maintenance switches, build numbers, shop details) |

### 7.2 The 11 v2 database updates (applied to live 13 Oct 2026, 12:29 IST)

The first 20 migrations in `prisma/migrations/` are copies of the old backend's, so the history matches the live database. The new ones, in order:

| Migration | Adds |
|---|---|
| `20261011120000_v2_admin_sign_in` | `AuthAccount.lockCount`; `Session.trustedDeviceId`, `revokeReason`, `stampAtIssue`; tables `TrustedDevice`, `AuthChallenge`, `LoginThrottle` |
| `20261011150000_v2_team` | `AdminProfile.isMainOwner` (partial unique index: at most one), `invitedAt/By`, `removedAt/By` |
| `20261011180000_v2_catalog_status` | `status` (active/inactive) on `Category` and `Subcategory`; name uniqueness only among active rows, ignoring case and spaces |
| `20261011210000_v2_products` | `Product.clientRef` (unique) and `batchId` |
| `20261011230000_v2_sales` | `Order.clientRef`, `paymentMethod`, `cancelledAt/ById`, `cancelReason`; `Invoice.cancelledAt` |
| `20261012000000_v2_orders` | `Shipment.shippedById`, `deliveredAt`, `deliveredById` |
| `20261012010000_v2_order_lines` | `OrderItem.lineNo` (the order the sarees were scanned) |
| `20261012020000_v2_activity` | `OrderItem.storePrice`; two `AuthEvent` indexes |
| `20261012030000_v2_settings` | `AppConfig` shop details, website address, "paused by/since", "changed by/at"; `TrustedDevice.appVersion` |
| `20261012040000_v2_settings_updates_changed` | Data fill for "App updates last changed" |
| `20261013070000_v2_tracking_number_rule` | **Removes** the database's unique rule on tracking numbers (see below) |

A backup was taken first: `~/Documents/Nandam-Handlooms/db-backup-2026-10-13-before-v2-live/` (holds customer data; private).

### 7.3 The shared-database lesson

The first version of `v2_orders` made tracking numbers unique in the database. That same night the shop shipped 13 orders with one number (NH3915) from the old app; the rule would have broken the old app. It was moved into the new server's code (checked under a lock) and the database rule removed. **Before any database change, check the real data against the new rule and ask whether the old app's habits could break it, then try it on a copy first.**

---

## 8. Admin app (Nadam-frontend/admin-app)

**Stack:** Expo SDK 57, React Native 0.86, Expo Router, **JavaScript** (not TypeScript), Jest with `jest-expo` and React Native Testing Library 14, ESLint (`expo lint`). Install with `npm install` (`.npmrc` has `legacy-peer-deps=true`).

### 8.1 Folders under `src/`

| Folder | Holds |
|---|---|
| `app/` | Expo Router screens (every file is a screen; `_layout.js` files are navigators) |
| `api/` | `http.js` (the only `fetch`: 30 s timeout, server address from `EXPO_PUBLIC_API_URL`, device headers), `client.js` (adds the key, renews once on `ACCESS_TOKEN_EXPIRED`), one file per area |
| `auth/` | `session.js` (sign-in state, renewal), `storage.js` (SecureStore, this device only), `device.js`, `biometrics.js`, `checkIn.js` (re-reads the profile at most every 15 s), `permissions.js`, `drafts.js`, `flow.js`, `codeRequests.js` |
| `components/` | design-system pieces (AppTabBar, Button, Banner, PinBoxes, CodeBoxes, Screen/TopBar, Feedback dialogs and toasts, ThemeChoice…) and per-area subfolders (sheets such as ShipModal, CancelSaleModal, TagScanner, PhotoCropper, CalendarModal) |
| `gate/` | the start-up check: "Update required" for everyone, the maintenance screen for staff |
| `hooks/` | `useBack`, `usePaged`, `useOnline`, `useCountdown`, `useKeyboardVisible`, `useTabBarSpace`, and the navigation tests |
| `theme/` | `tokens.js` (colours light and dark, spacing, type), `ThemeProvider.js`, `themePref.js` (Auto/Light/Dark per phone) |
| `products/` | `queue.js` (background upload queue), `batch.js` (photo batch draft), `photos.js`, `recent.js` |
| `sales/` | `bill.js` (the bill being built, per person, survives the app closing) |
| `orders/`, `home/`, `settings/`, `analytics/`, `activity/` | small shared state per area |
| `utils/` | pure logic per area, most with tests |

### 8.2 Screens and how pages open (changed 15 Oct 2026)

```
src/app/_layout.js            root Stack: fonts, theme, dialogs, the start-up Gate
src/app/index.js              → /home, a notice screen, or /sign-in
src/app/(auth)/               sign-in, setup, code, set-pin, forgot, new-device, locked, already, notice
src/app/(welcome)/            biometric-setup, done, reset-done
src/app/(app)/_layout.js      signed-in Stack. Bottom: (tabs). Everything else opens ON TOP.
src/app/(app)/(tabs)/         ONLY the five main pages: home, orders, scan, products, more (+ the menu)
src/app/(app)/home/low.js     … and every other page in folders under (app)/: home, orders, products,
src/app/(app)/scan/…               scan, more/activity, more/analytics, more/catalogue, more/invoices,
src/app/(app)/more/…               more/settings, more/team, more/change-pin, more/devices
```

- Every page other than the five main pages opens **on top of the page it was opened from**. Back, the iPhone's swipe from the edge and Android's back all return there, whichever tab it was in. Web addresses are unchanged (`/scan/today`, `/products/add/pick`).
- The floating menu shows on the five main pages only.
- `hooks/useBack.js` = "the page before". `?back=home` in a link is used only when there is no page before (the app was reopened on that page).
- **To go back to a tab from a page on top, use `router.dismissTo('/products')`.** `router.navigate()` or `router.replace()` to a tab from there opens a second copy of the tabs (Expo Router pushes). A test guards this.
- The "Sold" page after a sale has the swipe-back switched off (it would land on the paid bill); its Back arrow starts the next customer.
- Guarded by `src/hooks/navigation.test.js` and `navigation-link.test.js`, which run Expo Router's own navigation over the real list of pages (one app per test file: a second one in the same file never gets the router).

### 8.3 Signing in, inside the app

- The **access key (15 min) is kept in memory only**. The refresh key (7 days, rotated on every renewal) is in SecureStore, readable on this device only. `android.allowBackup` is off so keys never move to another phone.
- One renewal at a time; callers holding an old key get the new one. A network error or timeout **never** signs anyone out.
- Server codes `SESSION_EXPIRED`, `SIGNED_OUT_REMOTELY`, `PIN_CHANGED`, `SIGNED_OUT_FOR_SAFETY`, `ACCESS_REMOVED` end the sign-in and show the matching notice screen. Drafts are kept for the same person.

### 8.4 Kept on the phone

SecureStore: `nandam.deviceId`, `nandam.session`, `nandam.remembered`, `nandam.updateLater`. AsyncStorage: `nandam.theme.v1`, `nandam.drafts.v1`, `nandam.home.v1`, `nandam.batch.v1`, `nandam.uploads.v1`, `nandam.products.recentSubs`, `nandam.products.view`, `nandam.bill.v1.<userId>`, and offline copies of the catalogue and product lists.

### 8.5 Our own native modules (`admin-app/modules/`)

| Module | Platforms | What it does |
|---|---|---|
| `nandam-biometrics` | iOS (Swift) + Android (Kotlin) | A signing key in the Secure Enclave / Android Keystore that signs only after a strong biometric check. The server keeps the public key and checks signed one-time challenges. Written in-house because `react-native-biometrics` was unmaintained |
| `nandam-share` | Android | Sends a PDF straight into a customer's WhatsApp chat with a caption. iPhone uses the share menu |
| `nandam-system-bars` | Android | Keeps Android's button strip matching light/dark |

### 8.6 Two app variants (`app.config.js`)

| | `APP_VARIANT=test` (default) | `APP_VARIANT=production` |
|---|---|---|
| Name | Nandam Admin (Test) | Nandam Admin |
| Android id | `com.nandamhandlooms.admin.test` | `com.nandamhandlooms.admin` |
| iPhone id | same as Android | `com.nandamhandlooms.staff` (update of the old staff app) |
| Build numbers (15 Oct) | 1 / 1 | iPhone **9**, Android **27** |
| Network | plain HTTP allowed (developer Wi-Fi) | HTTPS only |

Version 2.0.0 for both. The Android production numbers started at **26** (after the old app's 25), because the live update check says "newest Android = 23" and a lower number would show testers a false "update available".

---

## 9. Security model

**Sign-in (Module 1)**
- Invite only; no self-registration. Replies never reveal whether a number is registered.
- **6-digit PIN**, stored only as an argon2id hash. Refused: all-same digits, straight runs, the last 6 digits of the person's own mobile. Old 4-digit PINs work once and must then be upgraded.
- **5 wrong PINs per mobile** → locked for **15, then 30, then 60 minutes**; 5 fresh tries after each lock; Forgot PIN unlocks any time.
- **SMS codes** (Message Central VerifyNow): 6 digits, valid **60 seconds**, 3 tries, resend after 60 s, at most 5 an hour; a new code cancels the old one. A setup or reset step must finish within 10 minutes.
- **New phone:** a correct PIN on an untrusted phone also needs an SMS code; the phone then becomes a trusted device.
- **Face ID / fingerprint:** on trusted phones only; a 60-second one-time challenge signed by the phone's hardware key; Android accepts only strong (class 3) biometrics. Signing out a device, a PIN reset, removal or a safety sign-out delete the key.
- **Keys:** a 15-minute access JWT inside a **7-day** session, renewed on every use and rotated. If an already-replaced renewal key comes back, the server treats it as theft and signs the account out on every phone (with a 10-second grace for the same phone). See 15.1: this currently also fires on lost answers.
- Changing the account's security stamp (PIN reset, removal, owner signs out all) ends every key at once, whatever its length.
- Every sign-in, failure, lock, code, PIN change, device trust and sign-out is written to the activity log.

**Permissions (Module 2).** Checked on the server on every request; the app only hides buttons.

| Permission | Owner | Staff |
|---|---|---|
| `catalog.view`, `products.manage`, `orders.manage`, `sell.use` | ✓ | ✓ |
| `catalog.edit` (incl. prices), `sell.override` (cancel; sell a saree an online checkout holds), `sales.view` (money totals), `analytics.view`, `activity.view`, `settings.manage`, `team.manage` | ✓ | – |

Everyone manages their own account (Change PIN, My devices, Face ID, theme, log out). The server returns `actions` on each item (what this person may do) so the app never re-implements the rules.

---

## 10. The 11 modules

Each module below: what it is for, the screens, the decisions (from the module document; ⭐ = the recommendation the owner accepted), what changed in the database, the API, and what is still open. All API paths are under `/api/v2`. Full detail: `docs/modules/module-NN-*.md`.

### Module 1: Sign in

**Purpose.** Only invited people get in; once in, they stay in for days with no interruptions; unfinished work is never lost; a stolen PIN alone is never enough. Also laid down the backend skeleton, app skeleton, design system and test set-up every later module uses.

**Screens.** First-time setup (mobile → SMS code → set PIN twice → optional Face ID); daily sign-in ("Welcome back, name"; Face ID first if on, PIN after 3 failures); new-phone check; Forgot PIN (signs out every other device); Change PIN (option to sign out other devices, off by default); My devices; Log out (asks first); message screens (signed out from another device, signed out for safety, access removed, no internet, server slow, sign in again, locked with countdown).

**Decisions (10 to 11 Oct).** Android and iOS phones and tablets only; no "switch user"; 7-day JWT sign-in renewed on use, no idle lock; unfinished work saved on the phone; enterprise flow approved (invite, SMS, 6-digit PIN, trusted devices, Face ID, lockout, device control, audit); Message Central with 60-second codes; 15-minute access key + 7-day rotating refresh; locks 15 → 30 → 60 min; Prisma; real-phone testing with a separate test app; hardware-backed Face ID with server-checked signatures (own native module); new API under `/api/v2` beside `/api/v1`. Owner recovery and security extras parked for the end.

**Database.** `v2_admin_sign_in` (see 7.2). Existing `AuthAccount`, `Session`, `OtpCode` (stores Message Central's verification id, never the code), `AuthEvent`.

**API.** `GET /health`; `POST /auth/setup/request-code`, `/auth/setup/verify-code`, `/auth/forgot/request-code`, `/auth/forgot/verify-code`, `/auth/pin/set`, `/auth/login`, `/auth/device/request-code`, `/auth/device/verify-code`, `/auth/biometric/challenge`, `/auth/biometric/login`, `/auth/refresh`, `/auth/logout`; `GET /me`, `GET /me/devices`, `DELETE /me/devices/:id`, `POST /me/devices/sign-out-others`, `POST /me/pin/verify`, `/me/pin/change`, `POST`/`DELETE /me/biometric`.

**Open.** Fingerprint on a real phone, iPhone checks of all sign-in screens, tablet. "First time here? Set up your account" is too small for newly invited people (found 13 Oct). Owner losing their number: handled by Module 11's rule (keep at least 2 owners).

### Module 2: Roles and team

**Purpose.** Owners decide who can use the app and what each person sees. Adding a person takes a minute and costs nothing (invite shared on WhatsApp); removing cuts them off at once on every phone, history kept. Defines the permission table every module uses.

**Screens.** More → Team (owners): tabs Team (Active, Invited) and Removed; search; + Invite (name, mobile, Staff/Owner) → share on WhatsApp or another way; member page (edit name, Make Owner/Staff, phones, share invite again, remove access, invite again, make main owner). Others see "Your access has been removed", a one-time role-change message, or "Only owners can open this".

**Decisions (11 Oct).** Owners can make other Owners; one **main owner** who can't be removed or demoted by others (only they hand it over); invites shared on WhatsApp (custom SMS would need a paid DLT sender); two fixed roles; removed people keep their history; the mobile number can't be edited (remove and re-invite); a website customer who joins or leaves keeps their PIN (it is shared with the website); the main owner is **not guessed** from data (5 owner accounts exist), set at switch-over; list style A (rows).

**Database.** `v2_team`. Status is worked out, not stored: Active, Invited, Removed.

**API.** `GET /team?tab=team|removed&q=`, `POST /team`, `GET /team/:id`, `PATCH /team/:id`, `PUT /team/:id/role`, `POST /team/:id/remove`, `POST /team/:id/reinvite`, `POST /team/:id/main-owner`, `DELETE /team/:id/devices/:deviceId`, `POST /team/:id/devices/sign-out-all`.

**Open.** Set the main owner (`scripts/set-main-owner.js`) once the owner confirms the number. Rename the owner accounts "System Admin" (…0180) and "Admin 8565" (…8565) to the real people.

### Module 3: Categories and subcategories

**Purpose.** The owner keeps the catalogue right (categories, subcategories, prices, photos, what the website shows). Changes go live on the website at once, so they must be hard to get wrong. Anyone can make a catalogue PDF and send it to a customer.

**Screens.** More → Catalogue: categories in shop order with counts; one search across all subcategories by name or price; filters All / Hidden / Needs photo / No products; category page; subcategory page (store ₹, website ₹, MRP with the website's "% off", Show on website switch, product count, price history, Catalogue PDF card, delete); add/edit forms with an "old → new" price check; reorder mode (drag or ▲▼). Staff: read-only plus PDFs.

**Decisions (11 to 12 Oct).** **Delete = inactive, never erased** (owner's rule): hide and delete are separate (`isActive` vs `status`); delete also hides it on today's website; a subcategory can't be deleted while any saree is in stock or held; a category can't be deleted until its subcategories are; deleted names can be reused. Optional MRP above the website price (5.1); old → new check and warnings (5.4); drag reorder (5.5); one search box (5.6); price history from the activity log (5.7); web address kept on rename (5.8); photo while creating with a tile crop (5.9); Android PDF straight into WhatsApp (5.10); owners and staff make PDFs (5.11); offline viewing (5.12). **Store price above the MRP is refused** (owner, 12 Oct: it is always a typing mistake). Warnings when a price more than doubles, drops by more than half, or goes under ₹100.

**Database.** `v2_catalog_status`.

**API.** `/catalog/categories` (GET, POST), `/catalog/categories/:id` (GET, PATCH, DELETE), `/catalog/categories/:id/photo` (PUT), `/catalog/categories/order` (PUT), `/catalog/subcategories?q=&filter=` (GET), `/catalog/subcategories/:id` (GET, PATCH, DELETE), `/catalog/categories/:id/subcategories` (POST), `/catalog/subcategories/:id/photo` (PUT), `/catalog/categories/:id/subcategories/order` (PUT), `/catalog/subcategories/:id/catalogue-pdf` (POST). Refusal codes `HAS_STOCK`, `HAS_SUBCATEGORIES`, `NAME_TAKEN`, `STORE_ABOVE_MRP`, `MRP_TOO_LOW`.

**PDF.** A4, one product per page, ivory and gold, no price or logo, "ID: <tag numbers>", only in-stock products with a photo, oldest first; 10 a minute; one kept per subcategory. The customer's number is never saved.

**Open.** The MRP question (15.2). Wrong prices on live data (15.6). The old app still lists deleted items until it retires (they stay off the website).

### Module 4: Products and barcodes

**Purpose.** Adding a saree should take seconds: pick the subcategory once, choose the photos, scan each saree's tag while its own photo is on screen. Each saree is one listing with its own photo and tag, except a **set** (since 15 Oct): several identical sarees share one photo and one listing, one tag per saree.

**Screens.** Products tab ("N sarees in stock · N of 5,000", search by name, SKU or tag, Scan to find, filters, rows/grid switch, offline copy). **Adding (main flow):** + Add → choose subcategory → Choose photos (up to 50) or Quick add (1–3 with the camera) → scan screen (camera full screen, the current photo in a card, Undo / Type / Skip, used tags refused at once) → Review (fix, re-scan, re-crop, remove) → Save all in the background → summary. Product page: photos, tag status and actions (Change tag, Replace tag, Saree damaged / Back in stock), where it sells, Best Seller, optional details, Move, up to 4 extra photos, Delete.

**Decisions (11 Oct, "ok to all").** Delete = inactive, unsold tags freed (6.1); name always the subcategory's (6.2); 1 main photo + 4 extra (6.3); automatic 3:4 portrait fit (6.4); 50 per batch (6.5); details optional, never asked while adding (6.6); where it sells chosen per batch, changeable per saree (6.7); the 5,000 limit counts in-stock only (6.8); camera, typing or Bluetooth scanner (6.10); move one at a time (6.11); owners and staff (6.12); works offline, uploads later (6.13). **Owner's tag rules (6A):** T1 one saree = one tag (changed 15 Oct: a photo can now be a set with one tag per saree, see "Sets" below); T2 alert at once when a tag is used; T3 wrong tag → Change tag (old number freed); T4 damaged tag → Replace tag (old number retired forever); T5 saree damaged → off the website and counter until "Back in stock"; T6 "Type the number" when a tag won't scan. Mock-up picks: scan screen B, rows with a rows/grid switch.

**Database.** `v2_products` (`Product.clientRef`, `batchId`). New piece statuses `retired`, `removed`; new stock-ledger reasons. Deleting renames unsold tags (`NH207` → `NH207~del~…`) so the number is free; the ledger keeps the original.

**API.** `GET /products`, `GET /products/:id`, `POST /products` (multipart: `photo`, `subcategoryId`, `tag` **or** `tags` (a set, comma-separated, 1–50, no repeats), `channel`, `clientRef`, `batchId`; 201 new or 200 `repeated: true`), `POST /products/:id/tags` `{ codes }` (Add more tags, since 15 Oct), `POST /tags/check`, `GET /tags/:code`, `PATCH /products/:id`, photos (`POST`, `PUT …/order`, `DELETE`), tag actions (`…/tags/:pieceId/change|replace|damaged|back-in-stock|remove`), `DELETE /products/:id`.

**Rules.** SKU `NH-<category initials>-<number>`, never reused, retried on a clash. Tag tidying is identical in app and server. Product photos 3:4 portrait; category/subcategory tiles 4:3; stored as JPEG ≤ 80 KB without location data. A saree is on the website only if active, sells online, its subcategory and category are shown, and a tag is in stock.

**Sets: one photo, several tags (client's request, 15 Oct 2026).** The old app's New Product screen took one photo and a list of barcodes; the client still needs that for sets of identical sarees (the live data has 140 such listings with 2–6 tags). This reverses the 11 Oct "same design, many tags dropped" decision.
- *Owner's picks* (from the mock-up `docs/design/ui-mockup/module-4b-tag-sets/`, options A/B/C): **A, count first**: under the photo while scanning, "Sarees in this photo − 1 +". 1 = a normal saree (moves on after its tag, as before); for a set tap + to 5, scan 5 tags, the next photo comes after the 5th. Check screen **A, every tag shown**. **Up to 50** tags on one photo. **Add more tags (same design)** button kept on the saree page.
- *Rules*: each tag is one saree (sells, changes, is replaced or marked damaged on its own); the listing stays on the website until the last one sells; the 5,000 limit counts listings, so a set counts once. Every tag checked the moment it's scanned; the same tag read twice on a photo is ignored with a note. A second tag on a one-saree photo asks "Replace" or "A set: keep both"; a tag past the count asks "Make it a set of 6?" or "No, it's for another photo". Save warns about a set with fewer tags than its count (scan the rest, or save as a set of what was scanned). A set is saved **all or nothing**; if one tag was taken meanwhile, Fix on the saving screen replaces just that tag.
- *Server* (`product.service.js`): `createProduct` takes `tags` (older builds' `tag` still works), checks every tag (`clearTags`), creates one piece + one `restock` ledger row per tag in one transaction, audit `product_created` with `barcodeCount`/`barcodes`. New `addTags` (`POST /products/:id/tags`): all or nothing, refuses a tag already on this saree (`TAG_ON_THIS_SAREE`) and more than 50 (`TOO_MANY_TAGS`), audit `product_tags_added`. `LIMITS.tagsPerSaree = 50`. **No database change.**
- *App*: batch photos carry `tags: []` + `want` (the count) instead of one `tag`; drafts and upload jobs saved before sets (with `tag`) are read too (`tagsOf`, `upgrade` in `products/batch.js`). Helpers `tagsOf`, `wantOf`, `itemDone`, `MAX_SET` in `utils/products.js`; components `SetCount` / `SetTags` (`components/products/SetCount.js`) and `AddTagsModal`. Upload sends `tag` for one tag and `tags` for a set, so it also works with a server without sets. The queue remembers which tag the server refused (`error.tag`) so Fix replaces only that one.
- *Testing*: server tests 298/298 (5 new for sets), app tests 133/133 (new set tests in `utils/products.test.js` and `products/queue.test.js`), lint clean. Barcodes to scan from a laptop screen for a real-phone test: `docs/testing/sets-test-tags.html` (TEST01–TEST15; delete the test sarees afterwards to free the tags). Not yet checked by hand on a phone.
- Full write-up: `docs/modules/module-04-products.md`, section 6C.

**Open.** 501 stale product names to check with the owner, then `fix-product-names.js --yes`. Device checks (4.1–4.11 in the test list), plus sets on a real phone (TEST tags page).

### Module 5: Scan to sell

**Purpose.** The counter sale: scan, agree the price, take payment, hand over the invoice. A saree is never sold twice, a bill is never lost, every bargain and cancellation is recorded.

**Screens.** Scan tab (full camera, Type, Torch, Zoom, bill strip). Bill (photo, store price, agreed price box, live total and saving, "under half the store price, is this right?" check). Complete sale (one page; **Where** counter/WhatsApp, **Paid by** cash/UPI/card, **Invoice** yes/no, all required, no defaults; WhatsApp needs name, mobile, address). Sold (share invoice: Android straight into the customer's chat, iPhone share menu; print; make the invoice again; next customer). Price check (never touches the bill). Today's sales (owners: everyone's + total + cancel; staff: only their own, no total).

**Decisions (11 Oct).** Payment mode required (6.1, owner); cancel = owners only, same day, invoice kept and stamped CANCELLED (6.2, owner); warn under half the store price (6.3, owner); no selling without internet, the bill waits (6.4, owner); counter customer details optional (6.5); WhatsApp details required (6.6); invoice asked every time (6.7); owners may "Sell anyway" a saree held by an online checkout, per saree (6.8); online-only or hidden sarees refused at the counter (6.9); up to 100 sarees per bill (6.10); separate price check (6.11); untagged quantity stock not sold (6.12); staff see only their own sales (6.13).

**Database.** `v2_sales`. Who sold = the stock ledger's actor. Each line keeps the store price shown at the time.

**API.** `POST /sales/lookup`, `POST /sales` (`clientRef`, lines with `pieceId`, `price`, `storePrice`, `sellHeld`; 201 new / 200 repeat), `GET /sales/today`, `GET /sales/:id`, `POST /sales/:id/invoice`, `POST /sales/:id/make-invoice`, `POST /sales/:id/cancel`.

**Rules.** One bill = one order + one invoice, all sarees or none, in one transaction. `clientRef` makes "Complete sale" safe to repeat (a lock waits if two copies arrive together). The invoice never blocks the sale. Counter sale = "delivered"; WhatsApp sale = "processing" and goes to Orders → To ship.

### Module 6: Invoices and the sales summary

**Purpose.** Find any invoice in seconds and send it again; give the owner and the accountant a summary that is correct to the paisa and matches the invoice list.

**Screens.** More → Invoices (newest first, search by number, order, name, mobile or tag; filters; owners see totals and "sales without an invoice"); one invoice (every saree, taxable value, CGST, SGST, total; share, print; owners can correct the customer); Sales summary (owners: period, channels → totals, PDF, print, CSV).

**Decisions (11 Oct).** Staff list/share/print with no totals (6.1); summary PDF = totals + every invoice + sarees by name (6.2); sales without an invoice on a separate line outside GST totals (6.3); cancelled invoices listed, never counted, numbers never reused (6.4); invoice later, same month only (6.5); PDF + CSV (6.6); invoice date in India time (6.7); no customer GSTIN for now (6.10); owners correct name/mobile in the same month, amounts never change (6.11).

**Database.** No changes.

**API.** `GET /invoices`, `GET /invoices/without`, `GET /invoices/:id`, `PATCH /invoices/:id/customer`, `POST /invoices/summary`, `GET /invoices/summary/pdf`, `/csv` (fetched with the sign-in key; never public links).

**Open.** INV-000015 is a ₹10 online test order counted in October's GST: ask the owner before the October summary. GST questions for the accountant (15.7).

### Module 7: Orders and shipping

**Purpose.** Every online and WhatsApp order gets packed, shipped and tracked: nothing waits unnoticed, a tracking number is never typed twice or onto the wrong order, the customer gets tracking and invoice on WhatsApp in one tap.

**Screens.** Orders tab (To ship oldest first with "waiting 2 days" in amber, Shipped, Delivered; search; count on the tab). One order (sarees, payment, invoice, ship-to with call / copy / WhatsApp, timeline). Ship sheet (DTDC by default, scan or type the tracking number, Mark shipped, Send tracking on WhatsApp with the invoice PDF). Change tracking number (old kept), Mark delivered, Cancel order (owners; "Refund ₹X in Razorpay": the app never moves money). Unpaid checkouts (owners, 30 days).

**Decisions (12 Oct).** Owners and staff ship (6.1); oldest first (6.2); cancel before shipping, same month (6.3); DTDC default or another courier by name (6.4); a tracking number on two orders is refused, naming the other (6.5); change number with history (6.6); unpaid checkouts for owners (6.7); delivered by hand, "check delivery" after 10 days (6.8); no push (6.9); returns later (6.10); **never delete sales**, keep 8+ years for GST (6.11).

**Database.** `v2_orders`, `v2_order_lines`, `v2_tracking_number_rule`. Tracking-number uniqueness is checked in the server, not the database (7.3).

**API.** `GET /orders?tab=to_ship|shipped|delivered&q=`, `GET /orders/counts`, `GET /orders/:id`, `POST /orders/:id/ship`, `PATCH /orders/:id/tracking`, `POST /orders/:id/delivered`, `POST /orders/:id/cancel`, `GET /orders/unpaid`.

**Open.** 18 unpaid checkouts from 4 customers on 9–10 Oct (₹2.75 lakh): the website's payment step may be failing; worth checking. Set the website address (Settings → Shop details) so product links work. Switch off the old order purge.

### Module 8: Home

**Purpose.** Within five seconds of opening: how the day is going and what needs doing. Every line is one tap from the screen that deals with it.

**Screens.** Owner: greeting, eye button (hides every ₹ on Home), sales card (today, bills, sarees, by channel; yesterday and month line), Needs attention, shortcuts (Sell, Price check, Add sarees, Today's sales), last 3 sales, stock count. Staff: their own sales count, their attention items, shortcuts, their last 3 sales. Running low (owners).

**Needs attention lines** (each only when it applies): unfinished bill, orders to ship (amber after 24 h), parcel to check (shipped 10+ days), unpaid checkouts (7 days), invoice not made, sarees not uploaded, photo draft not saved, sarees without a photo, sold out / running low, monthly summary reminder (1st–7th), security alert, staff app paused.

**Decisions (12 Oct, all ⭐).** Today + yesterday/month line (6.1); eye button, remembered on the phone (6.2); staff no money (6.3); one list, "All caught up" when empty (6.4); running low for owners (6.5); monthly reminder (6.6); 4 fixed shortcuts (6.7); last 3 sales (6.8); no push now (6.9); refresh on open, pull and every minute (6.10).

**API.** `GET /home` (reply depends on role; staff never get money totals), `GET /home/stock`.

**Rule.** "Which sales count" is one shared rule (`models/stats.model.js`): counter and WhatsApp sales not cancelled, plus online orders that are paid (processing, shipped, delivered) and not cancelled, by the day placed in India time. Home, Today's sales and Analytics all use it; a test compares them.

### Module 9: Analytics

**Purpose.** For any period: how much sold, what sold, how it sold (channel, payment, bargains), who sold and when. For re-ordering from weavers, pricing and staffing.

**Screens.** Owners only; More → Analytics (or Home's month line). Built as **4 tabs: Sales · Designs · People · Stock**, bar charts. Period chips (Today, 7 days, 30 days, This month, Last month, Any dates) and channel filter. Headline with % change vs the period before; top 10 designs; bargains; by person (+ one person page); payment; busiest hours (days of the week after 4 weeks); stock value, **Prices to check**, slow designs (from 3 Dec 2026).

**Decisions (12 Oct).** Picks: Layout B (tabs), Chart A (bars). All ⭐: owners only; This/Last month added; compare with the period before; top 10 by sarees; bargains overall/per design/per person; payment; profit later (no buying price recorded); no download (Module 6 covers the accountant).

**API.** `GET /analytics?period=&from=&to=&channel=`, `GET /analytics/people/:id`, `GET /analytics/stock`.

**Rules.** Amounts are bill totals as paid (incl. GST, after bargains). Bargains use the store price recorded on the sale line (`OrderItem.storePrice`), so the old server's log deletion can't change past figures. Old-app sales without a person or payment show "Not recorded", never guessed. All sums run in the database.

### Module 10: Activity log

**Purpose.** "Who did what, and when?" in plain sentences, searchable, kept for years.

**Screens.** Owners only; More → Activity: rows under Today / Yesterday / dates, one sentence each with time and phone; important rows marked amber; one Filter sheet (kind, person incl. former members, period, important only) + search; entry sheet with before → after and "Open"; grouped entries ("added 6 sarees … with 6 photos"). Home shows a security alert for 24 h after a locked PIN or a blocked stolen sign-in.

**Decisions (12 Oct).** Picks: List A (rows by day), Filters B (one sheet). All ⭐: owners only; keep sales/prices/stock/orders/team 8+ years, sign-ins 1 year, **switch off the old 30-day deletion before 4 Nov 2026** (6.2); store price copied onto each sale line (6.3); plain sentences (6.4); grouping (6.5); important marks (6.7); security alerts on Home (6.8); website customers not shown (6.9); no IP addresses shown, the phone's name instead (6.10); no download (6.11); no staff "My activity" (6.12).

**Database.** `v2_activity` + `scripts/copy-store-prices.js`.

**API.** `GET /activity?kind=&person=&period=&from=&to=&q=&important=&before=`, `GET /activity/people`.

**Rules.** Sales, cancellations and important entries are never grouped. Old records missing details show "Not recorded".

### Website W1: Customer sign-in and My account (built 15 Oct, live on nandamhandlooms.com since 16 Oct 2026)

**Purpose.** Customers sign in with their mobile and an SMS code (no password, no PIN), give name, email and pincode once, and stay signed in for 30 days. My account: profile and picture, change of mobile, up to 10 addresses, notifications (Firebase web push), signed-in devices, delete account (7 days to change one's mind). Record: `docs/modules/web-01-sign-in.md` (section 14 = what was built and how it differs from the plan).

**How it works.** Server under `/api/v2/shop` (`routes/shop`, `controllers/shop`, `services/shop`, `validators/shop`, `middlewares/authenticateCustomer.js` and `shopGuard.js`). A website key is a 15-minute JWT with audience `shop` and its own secret (`JWT_SHOP_ACCESS_SECRET`); the 30-day sign-in is an HttpOnly cookie limited to `/api/v2/shop/auth`, rotated on every renewal with a 10-second grace, theft detection, and `Session.kind = customer`. Admin-side sign-outs never touch customer sessions and the other way round. SMS codes for the website live in `PhoneCode` (a new customer has no account yet). Pincodes: `Pincode` table from India Post's list (`scripts/load-pincodes.js`). Push: Firebase HTTP v1 from the server; `firebase-messaging-sw.js` on the website.

**Website.** `Nadam-frontend/customer-web`: React 19, Vite 8, React Router 7; design C tokens; `src/api/client.js` (renews quietly, retries once, plain error messages), `src/auth/session.js` (short key in memory only, tabs in step). Run it on the Mac: `customer-web/README.md`. Browser test: `customer-web/e2e/`.

**Live (16 Oct).** On `nandamhandlooms.com` in place of the old website (kept in `/var/www/nandamhandlooms/app/frontend/customer-web/dist`; switch back in a minute, see `docs/deployment/live-v2-server.md` → "Changes deployed"). New website files: `/var/www/nandam-web/dist`; nginx sends `/api/v2/` on the website's address to the new server and `/api/` still to the old one. Still to do: real-phone checks (real SMS sign-in, Android and iPhone push), privacy and terms drafts reviewed by the shop.

### Module 11: Settings

**Purpose.** One owner-only page to run the app without a developer: pause the staff app or the website, force or announce new versions, edit shop details printed on invoices, see the shop's fixed rules.

**Screens.** More → Settings: Maintenance (staff app and website switches with messages; asks first), App updates (Android/iPhone: this phone's version, newest, oldest allowed; "Require this version for everyone", "Tell phones a new version is available"), Shop details (name, address, mobile, GSTIN, website, letterhead preview), Shop rules (read-only), About. Staff see the maintenance screen and "Update required".

**Decisions (12 to 13 Oct).** Picks: one page, each change saves on its own. Any owner can change, logged (6.1); confirm before pausing (6.2); the server also refuses paused staff (6.3); "Require this version" from an updated phone (6.4); owners edit shop details, new invoices only (6.5); fixed shop rules shown read-only (6.6); website address in Shop details (6.7); **app id (6.8): iPhone keeps the old id with build 7+ (decided 13 Oct); Android still to decide**; keep at least 2 owners (6.9); no app-switcher hiding now (6.10); no scheduled maintenance (6.11).

**Database.** `v2_settings`, `v2_settings_updates_changed`. `AppConfig` is shared with the old app and website.

**API.** `GET /app-status` (no sign-in; maintenance and update info, never cached), `GET /settings`, `PATCH /settings/maintenance`, `PATCH /settings/updates`, `PATCH /settings/shop`.

**Rules.** An old invoice keeps the shop details of its own day, even when its PDF is re-made. Build numbers must only go up (the old and new apps share these switches). The saved numbers are out of date (newest Android 23, iPhone 3): set them from an updated phone after the switch-over, and keep the new Android app's numbers above them.

**About the menu (More tab).** My account, Analytics, Invoices, Catalogue, Team, Activity, Settings (owners), Face ID switch, Change PIN, My devices, **This phone → App theme** (Auto / Light / Dark, added 15 Oct), Stays signed in, Trusted since, Log out.

---

## 11. Rules that cut across modules

- **India time.** The shop's day, periods, invoice dates and "same day / same month" limits all use India time (`utils/day.js`, `utils/period.js`).
- **Money and GST.** Every price includes GST at 5% (`GST_RATE_PERCENT`). Per line: taxable value = price ÷ 1.05, rounded to the paisa; GST = the rest, split into CGST and SGST. Only CGST + SGST today (no IGST, no HSN), same sums as the old backend. Amounts show two paise digits.
- **Numbers.** Order number "NH" + 8 random digits. Invoice numbers INV-0000NN in sequence, never reused. SKU `NH-<initials>-<n>`, never reused.
- **Lists.** 20 per page: the app asks with `offset`, then the `nextOffset` from each reply until it is `null` (Activity uses `next`). `total` and any ₹ totals cover everything. Asking for more than 20 is refused.
- **Safe to repeat.** `clientRef` on new sarees and on sales: a retried request returns the same record. Never create without it.
- **Timeouts.** App requests 30 s; database transactions 25 s (so they finish first).
- **Photos.** Uploaded once, compressed on the server to a JPEG ≤ 80 KB, location data removed. Android uploads use Expo's native uploader (plain `fetch` + FormData failed). In development, never delete a photo file the dev server didn't create (the dev copy points at live photos).
- **Files with money in them** (summaries) are fetched with the sign-in key and saved on the phone; never public links.
- **WhatsApp.** Android: straight into the chat via `nandam-share`. iPhone: the share menu. Customers' numbers are never saved for PDFs.

---

## 12. Environments, deploying and building

### 12.1 Local development (owner's Mac)

- PostgreSQL 18 (Homebrew). The backend `.env` points at **`nandam_dev`**, a copy of the live data (customer data: keep private). `SMS_PROVIDER=console` (codes appear on the phone), `STORAGE_PROVIDER=local`, port 4100.
- Backend: `npm install`, `npx prisma generate`, `npm run db:migrate` (local copy only), `npm run db:seed:dev`, `npm run dev`, then `http://localhost:4100/api/v2/health`.
- Tests re-create `nandam_test` from `nandam_dev` before each run; they never touch live.
- App against the local server: `EXPO_PUBLIC_API_URL=http://<mac-ip>:4100/api/v2 npx expo run:android --variant release --device` (or `adb reverse tcp:4100 tcp:4100` and `localhost` when the Wi-Fi keeps devices apart).
- **Never run `prisma migrate dev` or `reset` against the live database.**

### 12.2 Test server: paused since 13 Oct

pm2 `nandam-v2-test`, port 4100, `/test/api/v2`, database `nandam_v2_test`, files only under the `v2-test/` S3 prefix, codes shown on screen. Paused because the 1 GB server can't hold three Node processes. Android testers moved to the live app on 15 Oct. To-do: remove it when testing is done (steps in `docs/testing/test-server.md`).

### 12.3 Live new server

| | |
|---|---|
| Process | pm2 `nandam-v2`, port 4200 on 127.0.0.1, 300 MB cap, saved in pm2 |
| Folder | `/var/www/nandam-v2/backend` (its own `.env` there, different secrets from the old server) |
| Address | `https://api.nandamhandlooms.com/api/v2` (nginx `location /api/v2/`) |
| Database | the original live database |
| Files | S3 `nandamhandlooms-media`, real folders |
| Mode | production, real SMS |

**Update it:**
1. From `Nadam-backend` on the Mac: `rsync -az --delete --exclude node_modules --exclude '.env*' --exclude uploads --exclude tests --exclude tmp ./ ubuntu@<server>:/var/www/nandam-v2/backend/`.
2. On the server: `npm ci && npx prisma generate` (only if the lock file or schema changed); `npx prisma migrate deploy` only for a new, additive migration tried on a copy first; then `pm2 restart nandam-v2` at a quiet moment.
3. Check `…/api/v2/health`, the old `/api/v1/app-config` and the website answer 200, and `free -m` still has room.

**Undo:** `pm2 delete nandam-v2 && pm2 save`, put back the nginx backup, reload nginx. The database updates can stay (the old app ignores the new columns).

The exact server address, login and backups are in `docs/deployment/live-v2-server.md` and the owner's private notes, not here.

### 12.4 iPhone builds (Expo's cloud, free plan: 15 a month)

1. In `admin-app`, raise `IOS_BUILD` in `app.config.js` (production line).
2. `EAS_NO_VCS=1 APP_VARIANT=production npx eas-cli@latest build --platform ios --profile production --non-interactive --no-wait`. Signing uses local credentials (links to the private signing files).
3. Download the `.ipa`, then `API_PRIVATE_KEYS_DIR=~/Documents/Nandam-Handlooms/ios-release xcrun altool --upload-app -f <ipa> -t ios --apiKey <key id> --apiIssuer <issuer id>`.
4. Wait for Apple (about 5 minutes), then **add the build by hand to the TestFlight group "Current app"**. Since 15 Oct this is the only group (client, owner, the Groviews account, tester); nothing reaches anyone until it is added. Anyone can go back to an older build from TestFlight → Previous builds.

This Mac's Xcode (16.4) can't build Expo SDK 57 (needs Xcode 26), but it can upload.

### 12.5 Android builds (on the owner's Mac)

1. Raise `versionCode` on the production line in `app.config.js` (keep it above 25 and above the server's "newest" number).
2. `APP_VARIANT=production CI=1 npx expo prebuild --platform android --clean --no-install`.
3. Add the `release` signing block to `android/app/build.gradle` (it reads `NANDAM_STORE_FILE`, `NANDAM_STORE_PASSWORD`, `NANDAM_KEY_ALIAS`, `NANDAM_KEY_PASSWORD`) and point `buildTypes.release` at it; prebuild removes it each time.
4. `bash ~/Documents/Nandam-Handlooms/signing/build-admin-apk.sh` (sets the owner's key and the live address, builds ARM only).
5. Check the file (package, versionCode, signing certificate `AE:81:AD:22…`, live address), copy it to `~/Documents/Nandam-Handlooms/apk/Nandam-Admin-v2.0.0-build<N>.apk` with a checksum and a guide.
6. Put the project back on the test app: `APP_VARIANT=test CI=1 npx expo prebuild --platform android --clean --no-install`.

The owner shares the APK file. It installs beside the old staff app; a newer build installs over an older one. Never edit `android/` or `ios/` by hand otherwise; they are generated.

### 12.6 Builds so far

| Build | Date | What changed | Who has it |
|---|---|---|---|
| iPhone 2.0.0 (7) | 13 Oct | First release of the new app | Tester only (not in "Current app", so nobody can go back to it) |
| iPhone 2.0.0 (8) / Android 26 | 15 Oct | Add sarees fix; pages open on top (swipe-back works) | Shared with everyone 15 Oct |
| iPhone 2.0.0 (9) / Android 27 | 15 Oct | App theme Auto / Light / Dark | "Current app" group; APK with the owner |
| iPhone 2.0.0 (10) / Android 28 | 15 Oct | Sets: one photo, several tags; Add more tags (needs the server change, live 13:20 IST) | iPhone 10 added to "Current app" 14:20 IST (EAS `8d424e23…`, 10th of 15 free iPhone builds in October); APK `apk/Nandam-Admin-v2.0.0-build28.apk` (SHA-256 `ce11a7c7…`) with the owner |

---

## 13. Testing

| What | How | Last result |
|---|---|---|
| Server | `npm test` in `Nadam-backend` (Vitest + Supertest, on a fresh copy of `nandam_dev`) | **411/411** (15 Oct evening, with website W1; 298 before) |
| Website | `npm test` in `customer-web` (Vitest + Testing Library); `npm run test:e2e` (real browser, real server, test database) | **28/28**; browser **Chrome 245/245**, **WebKit 122/122** (15 Oct) |
| App | `npm test` in `admin-app` (Jest) | **133/133** (15 Oct, with sets) |
| Lint | `npx expo lint` | clean (15 Oct) |
| Expo health | `npx expo-doctor` | 20/21 on 15 Oct: only newer Expo patch versions available, not caused by the code |
| Mock-ups | Playwright checks per module | all passed when built (e.g. 125/125 Module 4) |
| Real phone | Samsung Galaxy Note10 Lite, Android 12, per module | every module passed; small fixes made and re-checked |

**Still to check on devices** (full list: `docs/testing/full-app-test-list.md`): iPhone across all modules, tablet layouts, real fingerprint, camera on real tags and DTDC labels, WhatsApp into a real chat, a real printer, Bluetooth scanner, 50-photo batches, the 5,000 limit, new sarees appearing on the website, a real paid website order shipped from the app, time-based checks (midnight, the 1st–7th reminder, weekdays after 4 weeks, slow designs from 3 Dec), the phone's own Back button on every screen, and the 15 Oct changes (Add sarees, swipe-back, theme, **sets**) on real phones.

Test people on the dev copy only: Lakshmi (owner), Ravi and Anil (staff). Their PINs are in the module documents for the dev copy; they don't exist on live.

---

## 14. Changes after go-live (13 to 15 Oct)

**1. Home → "Add sarees" did nothing** (testers, 13–15 Oct). The button opened step 2 (photos or quick add) without a subcategory, so the screen said "Couldn't load the subcategory – Unknown item" and both options stayed grey. The server log showed the app asking for subcategory "undefined" 7 times. Fixed: it opens step 1, choose the subcategory, like Products → Add.

**2. iPhone swipe-back didn't work.** Pages opened from Home (Price check, Today's sales, a sale, an order, Add sarees) used to open inside another tab, where there was nothing (or the wrong page) underneath. Fixed by the new page structure (8.2): one stack, tabs at the bottom, every other page on top. Also: "Back to Products", "Hide" and "Go to Home" now use `dismissTo`; the menu shows only on the five main pages and inner pages use the full screen; the two pages without a Back arrow ("Sold", "invite ready") got one. Expo Router's own navigation is tested over the real page list (12 new tests).

**3. App theme.** More → This phone → App theme: Auto (follows the phone, default), Light, Dark. Kept per phone (`nandam.theme.v1`), read before the first screen, handed to the system so the status bar and keyboard match.

**4. Distribution.** Build 8 shared with everyone; the tester moved into "Current app"; the old "Team (Expo)" group removed. Android testers moved from the paused test server to the live app (owner's choice).

**5. Sets: one photo, several tags** (client, 15 Oct; owner's picks). A set of identical sarees gets one photo and one tag per saree (up to 50): while scanning, "Sarees in this photo − 1 +" says how many tags to scan; the check screen shows every tag; the saree page has "Add more tags (same design)". Each tag sells on its own; a set saves all or nothing. Server: `POST /products` takes `tags` (old builds still send `tag`), new `POST /products/:id/tags`. App: batch items carry `tags` + `want` (old drafts and upload jobs with `tag` are read too). Details under Module 4 ("Sets") and in Module 4, section 6C. Server change live 2026-10-15 13:20 IST (only 4 product files; backup `/home/ubuntu/nandam-v2-backend-before-sets-20261015.tgz`); Android build 28; iPhone build 10 shared with everyone at 14:20 IST.

A code backup from before change 2 is at `~/Documents/Nandam-Handlooms/admin-app-backup-2026-10-15-before-back-fix/`.

---

## 15. Open decisions, known issues and to-do

### 15.1 False "stolen sign-in" alarms (found 15 Oct, fix proposed, not made)

What happens: a phone asks to renew its sign-in, the server issues a new key, but the answer never reaches the phone (app closed mid-renewal, weak signal). The phone later sends the old key; the server treats that as theft and signs that account out on every phone, and Home shows "A stolen sign-in was blocked". 10 alarms since 9 Oct, none real: old app 9 Oct and 15 Oct (11:01, Admin 8565), the old website 10 Oct (a customer, 7 times), and the **new app on 13 Oct** (the tester had to reset his PIN). The new server allows only a 10-second grace.

Proposed fix (new server only, no app build): if the old key comes back from the **same trusted phone** and the newer key that replaced it **has never been used**, treat it as a lost answer and hand out a fresh key. A key used on another phone, or an old key after the newer one was used, still signs everyone out. The old server has the same weakness; the plan is to leave it, as everyone moves to the new app. **Waiting for the owner's go.**

### 15.2 MRP (discussed 15 Oct, not decided)

- On live data no design has a real MRP: 97 at ₹16,999, 24 at ₹8,999, 17 at ₹2,999, 11 at ₹4,499, 8 with none (157 designs). These are the old system's category starting values, copied into each design when it was created; the old staff app had no MRP box, so nobody could fix them. The website therefore shows a false "% off" on almost every saree (typically 81%, up to 93%).
- The owner wants MRP **required**. Proposed: required in the new app and server when adding or editing a design (rules already exist: MRP above the website price, store price not above MRP); a "MRP to check" list in the app (or the owner sends a list); and no "% off" on the website until a design has its real MRP. The database column stays optional (the old app still creates designs without it).
- Open question for the owner: **one MRP per design (recommended, like the prices) or per saree?** Per saree only if sarees in one design really carry different MRPs on their tags; even then, the design MRP as the default with a per-saree change.

### 15.3 Before 4 November 2026 (date-bound)

- **Switch off the old server's 30-day activity deletion** (`purgeOldAuditLogs` in the old backend's `retention.service.ts`). Otherwise the new app's history, bargain records and the shop-details history old invoices rely on start disappearing.

### 15.4 At the final switch-over

- Run `copy-store-prices.js --yes` again (sales made in the old app since 13 Oct have no saved store price).
- Set the main owner (`set-main-owner.js`) after the owner confirms the number.
- Switch off the old 6-month order purge.
- Decide Android 6.8: release the new app under the old id `com.nandamhandlooms.staff` (build 26+; the old signing key is available) so Android phones update straight from the old app, or keep the separate `com.nandamhandlooms.admin`.
- Set the newest/oldest app versions in Settings from updated phones.
- Remove the paused test server.
- Commit everything to `develop`, only when the owner says.

### 15.5 Data to fix with the owner

- Wrong store prices: "Gap Border bramini sarees" ₹54,310 (typed on 10 Oct; probably ₹3,800 store / ₹3,200 website); 46 designs still at the starting ₹11,999 / website ₹2,000; designs at ₹9 and ₹10 (including "Test1"). Analytics → Stock → Prices to check lists them.
- 501 stale product names (`fix-product-names.js --csv` first).
- Rename "System Admin" (…0180) and "Admin 8565" (…8565).
- INV-000015 (₹10 online test order) before the October summary.
- 18 unpaid website checkouts from 4 customers (9–10 Oct): the payment step may be failing.
- Set the website address in Settings → Shop details.

### 15.6 Small app items

- Sign-in screen: make "First time here? Set up your account" a clear button, or take an invited number straight to "Send code".

### 15.7 The owner's to-do list after all modules (`docs/to-do-list.md`)

- **GST (ask the accountant first):** IGST for other states; different rates per item; a business buyer's GSTIN; credit notes after a filed month.
- **Selling:** returns and exchanges; part cash, part UPI on one bill; advance to keep a saree aside; untagged items (fall and pico, stitching, fabric by the metre); recording a Razorpay refund; shipping without a unique tracking number. Recommended first: returns/exchanges and split payment, after the accountant's answers.
- **Stock and alerts:** stock-taking and lost sarees; profit (needs buying price); push for new online orders (needs Firebase and an Expo account in the shop's name).

### 15.8 Parked for the end of the project

Owner recovery if the only owner loses their number (rule: keep 2+ owners); in-app alerts to the owner on a lock or new phone; hiding the screen in the app switcher.

---

## 16. Do-not-break checklist

**Database**
- Additive changes only; no database rule the old app's data or habits can break (enforce in the service under a lock). Try on a copy first. Keep the first 20 migrations identical to the old backend's.
- Delete never erases: `status = inactive` (and website switch off); inactive items vanish from every list, search, count and API answer, including anything under an inactive subcategory. Hide (`isActive`) and Delete (`status`) are separate.
- Never delete sales, invoices or orders. Never reuse an invoice number or SKU.

**Server**
- Every route: `authenticate` + `requirePermission` + `validate`. The role is read from the database on each request. Keep `permissions.js` in step with Module 2 (change the document first).
- Keep the error shape and the codes the app switches on.
- 20 per page; totals cover everything.
- `clientRef` on products and sales; one transaction per bill; the invoice never blocks a sale.
- Cancel only on the same India day (sales) or month (orders); stamp invoices CANCELLED, never delete.
- An old invoice keeps its own day's shop details.
- Never log request bodies (they carry PINs and codes). Production refuses console SMS and local storage.
- Never move money from the app.

**App**
- Pages open on top of the tabs; go back to a tab with `router.dismissTo`; keep swipe-back off on "Sold". Run the navigation tests.
- Never sign anyone out on a network error. Access key in memory only; refresh key in SecureStore (this device only); `allowBackup` off.
- Use the server's `actions` and `permissions`; don't re-implement rules in the app.
- Tag tidying identical in app and server; several matching camera frames before accepting a code; always show the photo being tagged.
- Android photo uploads through Expo's native uploader.
- Sets: `POST /products` must keep accepting a single `tag` (builds 9 and older send it), and the app sends `tag` for one tag and `tags` only for a set. A set is saved all or nothing.
- Raise build numbers for every build; Android above 25; never edit `android/` or `ios/` by hand.

**People and secrets**
- Keys, passwords, PINs, database addresses only in the server `.env` and the owner's private folders. Never commit them or give them to developers.
- Test against the dev copy and console SMS; never send SMS to real staff while testing.
- Live actions need the owner's go each time.

---

## 17. Documentation that is out of date

| Where | What is out of date |
|---|---|
| `Nadam-backend/README.md` | Says only Module 1 is built and "64 tests"; lists only the sign-in and `/me` endpoints |
| `Nadam-frontend/admin-app/README.md` | Says only Module 1; lists one native module (there are three) |
| `Nadam-backend/.env.example` | Missing `HOST`, `INVITE_APP_LINK`, `S3_KEY_PREFIX`, `COMPANY_*`, `GST_RATE_PERCENT` |
| `Nadam-backend/package.json` | `db:test:reset` points at a file that doesn't exist |
| `admin-app/AGENTS.md` | Generic Expo text that mentions TypeScript; the app is JavaScript |
| Module 6 document | Says 30 invoices per page in one place (it is 20); calls the list service `invoiceList` (it is `invoiceBook.service.js`) |
| Module 7 document, section 18 | Mentions a unique tracking-number index; it was removed (`v2_tracking_number_rule`), the rule is in the server |
| Module 9 document, section 5.2 | Says layout A; the build used B (tabs) |
| Module 10 document | Section 5.2 says filters A; the build used B (one sheet). Section 9 says a daily job; it is the 15-minute clean-up job |
| Module 3 document, decision 5.1 | Says MRP is optional; the owner now wants it required (15.2) |

---

## 18. Glossary

| Term | Meaning |
|---|---|
| Design / subcategory | A group of sarees sold at one price with one description (for example "Scallop Embroidery sarees"). Prices and MRP live here |
| Category | The top level (6 today, e.g. Mangalagiri Handloom Pattu Sarees) |
| Saree / product / listing | One saree, with its own photo(s) and tag |
| Tag / piece / barcode | The printed label on a saree (`NH1296`); one row in `Piece` |
| Store price / website price | The counter price and the online price, both from the design |
| Agreed price / bargain | The price actually charged at the counter, saved on the sale line |
| Bill | A counter or WhatsApp sale being built in the app; becomes one order and (optionally) one invoice |
| Owner / Staff | App roles; database roles `ADMIN` / `STAFF` |
| Main owner | The one owner who can't be removed or demoted by others |
| Trusted device | A phone that passed the SMS check for that person |
| `clientRef` | A unique id the phone makes so a retried save never makes a copy |
| AWB | The courier's tracking number (DTDC) |
| v1 / v2 | The old API (`/api/v1`, old server) and the new one (`/api/v2`, new server) |
| "Current app" | The single TestFlight group everyone is in |
| Dev copy | `nandam_dev`, the copy of live data on the owner's Mac used for development |

---

## 19. Where to find more

| Need | Document |
|---|---|
| A module's full plan, options, decisions, results | `docs/modules/module-01-sign-in.md` … `module-11-settings.md` |
| What the old app did and its problems | `docs/current-system/` (3 files) |
| The live set-up, update and undo steps, builds | `docs/deployment/live-v2-server.md` |
| The test server | `docs/testing/test-server.md` |
| Device checks still to do | `docs/testing/full-app-test-list.md` |
| The owner's open list | `docs/to-do-list.md` |
| Designs as the owner picked them | `docs/design/ui-mockup/module-N-*/` |
| Server code entry points | `Nadam-backend/src/config/`, `src/routes/index.js`, `prisma/schema.prisma` |
| App code entry points | `admin-app/app.config.js`, `src/app/(app)/_layout.js`, `src/auth/session.js`, `src/api/http.js` |

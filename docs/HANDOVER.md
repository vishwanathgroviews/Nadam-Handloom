# Nandam Handlooms: developer handover (start here)

*Updated 28 Sep 2026. Code state: `develop` = `main` = `f34c451` (staff app build 21).*

Nandam Handlooms sells handloom sarees, dress materials and lehenga sets from Mangalagiri, Andhra Pradesh. It sells through three channels:
- **online:** the customer website;
- **in the shop:** scan-and-sell in the staff app;
- **over WhatsApp:** staff record the order in the app and ship it.

This repo holds all three parts of the system.

- Run it locally: **[LOCAL_SETUP.md](LOCAL_SETUP.md)**
- Every feature that exists today: **[FEATURES.md](FEATURES.md)**

---

## 1. The system at a glance

```
 Customers (browser)            Shop staff / owner (Android app)
        │                                   │
        ▼                                   ▼
 nandamhandlooms.com  ──/api──►  api.nandamhandlooms.com
 (customer-web, static)          (backend: Node + Express, pm2)
                                        │
                  ┌─────────────────────┼──────────────────────┐
                  ▼                     ▼                      ▼
        PostgreSQL 18 (Neon)     AWS S3 (Mumbai)        Razorpay / SMS / Expo
        all shop data            photos, invoice PDFs,  payments, OTP SMS,
                                 catalogue PDFs         push (see §8)
```

| Part | Folder | Tech | Runs in production as |
|---|---|---|---|
| Backend API | `backend/` | Node 24, TypeScript, Express 5, Prisma 7 (`pg` adapter), Zod, PDFKit | AWS EC2 server (Mumbai) behind nginx, process `nandam-api` under pm2 |
| Customer website | `frontend/customer-web/` | React 19, Vite 8, react-router 7 | Static build served by nginx at https://nandamhandlooms.com |
| Staff app | `frontend/app/` | Expo SDK 57, React Native 0.86 | Android APK (`com.nandamhandlooms.staff`, current build 21), talks to https://api.nandamhandlooms.com |
| Database | `backend/prisma/schema.prisma` | PostgreSQL 18 (29 models) | Neon, Singapore region |
| Files | — | AWS S3 | Photos, invoice PDFs and catalogue PDFs. The database stores only their URLs. |

`DEPLOYMENT.md` (repo root) is the original server runbook. It is useful background, but parts are outdated. This file and the owner are the source of truth.

## 2. Repo layout

```
backend/
  src/app.ts, src/index.ts        Express app, startup, background jobs
  src/modules/<area>/             routes → controller → service (+ schema, tests)
    auth admin catalog catalog-pdf inventory orders invoices
    analytics retention events notifications webhooks user address
  src/providers/                  storage (local | s3 | console), sms (console | msg91), payment (razorpay)
  src/config/                     env.ts (all settings, validated), prisma.ts, company.ts
  src/test/fakePrisma.ts          in-memory database used by the tests
  prisma/schema.prisma            data model;  prisma/seed.ts demo data
frontend/customer-web/src/        pages/, components/, context/ (Auth, Cart), services/api.js
frontend/app/src/                 screens/, navigation/, components/, api/, context/, utils/, hooks/
frontend/app/plugins, patches/    WhatsApp package-visibility plugin; react-native-share patch
docs/                             this handover
```

## 3. Business rules you must know

- **Catalogue:** Category → **Subcategory** → Product → **Piece**.
  - **Subcategory** is the *pricing unit*. Every product in a subcategory shares its `onlinePrice` (website), `storePrice` (shop, shown only in the staff app), optional `mrp`, and description. It can be shown or hidden on the website.
  - **Piece** is one physical item with a unique barcode, printed on its tag by an external device. Almost every saree is a single piece.
- **Availability:** `product.stock` (legacy counter) + the number of pieces with status `in_stock`. Sold pieces disappear from the website.
- **Dual pricing:** the public API never returns `storePrice`.
- **Channels:** `online`, `store`, `whatsapp`.
  - A counter bill (Scan to Sell) with any number of items makes **one order**, plus an **optional invoice** ("invoice required" yes/no).
  - Store orders are `delivered` at once.
  - WhatsApp orders go to **To Ship**. Staff enter the DTDC AWB, which marks them shipped.
- **Online checkout:**
  1. Pieces are **reserved for 10 minutes** and a Razorpay order is created.
  2. Payment is confirmed by the browser callback or the Razorpay webhook. The confirmation is idempotent.
  3. The order becomes `processing` and an `order.paid` outbox event is written.
  4. A job generates the invoice and sends the staff push.
- **Invoices:** numbered `INV-000001`, `INV-000002`, … Prices are GST-inclusive at 5% (split CGST 2.5% / SGST 2.5%). The PDF is stored on S3.
- **Roles:**
  - ADMIN (owner) and STAFF use the staff app.
  - CUSTOMER uses the website.
  - Staff are invite-only (Team → Invite, then "Activate your account" with an OTP).
- **Logins:** everyone logs in with **mobile + MPIN**. OTPs are used for activation and for "Forgot MPIN". 5 wrong MPINs lock the account for 15 minutes.
- **Background jobs** (in-process, `src/index.ts`):

  | Job | Runs |
  |---|---|
  | Reservation expiry | every 15 s |
  | Outbox dispatch | every 5 s |
  | Rate-limit cleanup | every 10 min |
  | Retention: delete orders older than 6 months and staff activity older than 30 days; monthly orders CSV on the 1st | every 6 h |

## 4. How we work (Git)

- **`dev/sasi`** is your working branch. Commit and push there.
- The owner merges into **`develop`**, the shared working branch.
- **`main`** is what production runs. Only the owner decides when `develop` goes to `main`.
- Commit messages follow the existing style: one plain sentence saying what changed and why.
- **Before pushing, run the checks:**

  | Part | Command |
  |---|---|
  | Backend | `npx vitest run` (315 tests) |
  | Staff app | `npm run typecheck && npm test` (107 tests) |
  | Website | `npm test` |

- **Never commit:** `.env` files, database backups, signing keys, or anything copied from the server.

## 5. Database rules (important)

- **Production schema drift:** the tables `Invoice` and `SubcategoryCatalogPdf` exist in the live database but have **no migration**. The old `CategoryCatalogPdf` table is created by a migration but no longer exists live.
  - So **`prisma migrate deploy` on an empty database builds an incomplete schema.**
  - Local work: restore a backup, or use `npx prisma db push`.
- **Never run `prisma migrate dev` or `migrate reset`** against any shared database. Prisma will offer to wipe it.
- **Schema changes:** agree them with the owner first. The plan is to add a proper baseline migration before the next schema change.
- **Production and backups** are managed by the owner. Developers never connect to the live database.

## 6. How changes go live (owner, with approval)

- **Backend:** on the server, run `git pull origin main`, `npm ci --omit=dev`, `npx prisma generate`, `npm run build`, then `pm2 restart nandam-api`. The server has 1 GB RAM, so the build is slow.
- **Website:** run `npm run build` on a laptop, upload `dist/` to the server, and nginx serves it.
- **Staff app:**
  - The release APK is built on the owner's machine and signed with the owner's release key, which is kept outside Git and never shared.
  - Bump `expo.android.versionCode` in `app.json` for every release. Never change the package name.
  - The first APK signed with the new key (build 20 or later) needs the old app uninstalled once.
  - An iOS build needs Xcode and an Apple Developer account. It has not been done yet.

## 7. Recent changes (26–28 Sep 2026)

- Database moved to a new Neon project and restored from backup.
- Staff dashboard fix: the low-stock count now uses one query instead of ~500, so it loads in 0.9 s instead of 35 s.
- Large Scan to Sell bills: the backend transaction limit is 25 s (`config/prisma.ts`) and the app request timeout is 30 s (`api/client.ts`). Keep the server limit **below** the app timeout.
- New release signing key; APK builds 20 and 21.
- Team and access clean-up. The staff app now has one owner login.
- `develop` branch introduced; `main` = production.

## 8. Switched off, missing, or next work

**Switched off / waiting on accounts**
- **SMS OTP:** MSG91 is built (`providers/sms/msg91.provider.ts`) but production runs `SMS_PROVIDER=console`. It is waiting on DLT registration.
- **Payments:** Razorpay runs in test mode, and the webhook secret is not set yet.
- **Push notifications:** built, but switched off in the app (`PUSH_NOTIFICATIONS_ENABLED=false` in `frontend/app/src/utils/push.ts`). Android also needs a Firebase project and an Expo project owned by the business.

**Not built**
- "Mark delivered", order cancel, refund and return.
- Marking pieces damaged or returned.
- Adding barcodes to an existing product from the app.
- Automatic SMS/WhatsApp to customers on order or dispatch.

**Website gaps**
- No search box on phones.
- My Orders shows only the latest 10.
- No policy/contact pages, 404 page or SEO tags.
- Product filters exist in the API but not in the UI.

**Needs a decision or a fix**
- **Invoices/GST:** no HSN code or "Tax Invoice" title, and online orders to other states may need IGST. Check with the accountant.
- **Retention:** orders are deleted after 6 months. (a) GST record-keeping may require keeping them longer. (b) The purge will start failing on invoiced orders (the `Invoice` foreign key has no cascade) once they are 6 months old, around Feb 2027.
- **Late payments:** a payment captured after the 10-minute hold can oversell a piece that was sold meanwhile.
- **Migrations:** add a baseline migration (see §5).
- **Performance:** the database is in Singapore and the server in Mumbai, so each query is ~60 ms. Moving the database next to the server is planned.

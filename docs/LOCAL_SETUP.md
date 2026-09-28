# Run Nandam Handlooms on your laptop

This runs all three parts on your laptop: the **backend API**, the **customer website** and the **staff app**. You can then test from a browser and from your Android phone.

These steps were run and tested on 28 Sep 2026 with Node 24 and PostgreSQL 18. Nothing here touches the live shop.

> Read [HANDOVER.md](HANDOVER.md) first for what the system is and how it runs in production.

## 0. Install once

| Tool | Version | Used for |
|---|---|---|
| Git | any | code |
| Node.js | 24 LTS (npm 11) | all three parts |
| PostgreSQL | 18 | database. Mac: [Postgres.app](https://postgresapp.com). Windows: the EDB installer. |
| Android Studio | latest | staff app: Android SDK and USB drivers. Installs JDK 17 for you. |

Optional: `psql` / `pg_restore` (they come with PostgreSQL), and VS Code.

## 1. Get the code

```bash
git clone https://github.com/vishwanathgroviews/Nadam-Handloom.git
cd Nadam-Handloom
git switch dev/sasi        # your working branch
```

## 2. Create your local database

Create an empty database named `nandam_dev`:

```bash
createdb nandam_dev        # or create it in pgAdmin / Postgres.app
```

Then fill it using **one** of these two options.

### Option A — copy of the real shop data (use this to continue current work)

1. Get the latest backup file (`nandam-live-YYYYMMDD-HHMM.dump`) from the project owner. It is shared **privately**, never through Git.
2. Load it:

```bash
pg_restore --no-owner --no-privileges -d "postgresql://postgres:postgres@localhost:5432/nandam_dev" nandam-live-YYYYMMDD-HHMM.dump
```

The backup already contains the full database structure, so **do not** run any `prisma` database commands after restoring.

It also contains customers' names, phone numbers and addresses from real orders. Keep it on your laptop only, never commit or forward it, and delete it when you no longer need it.

### Option B — empty database with demo data

Run this after step 3 (it needs the `.env`):

```bash
cd backend
npx prisma db push          # creates every table from prisma/schema.prisma
npm run prisma:seed         # roles, a Dev Admin login, 6 categories, 150 subcategories, demo products
```

> **Use `prisma db push`, never `prisma migrate dev` / `migrate deploy` / `migrate reset`.** The migration history is missing two tables (`Invoice`, `SubcategoryCatalogPdf`). `migrate` would build an incomplete database, and it can generate migration files that break the production deploy. See HANDOVER.md → "Database rules".

## 3. Backend API

```bash
cd backend
cp .env.dev.example .env    # ready-made local settings
# edit .env → set DATABASE_URL and DIRECT_URL to your local database
npm ci
npx prisma generate
npm run dev
```

Open http://localhost:4000/health. It should return `{"status":"ok"}`.

The startup log shows the integrations:
- storage: `local`
- payments: not configured, unless you added Razorpay test keys
- sms: `console`

What the local settings do:
- **Photos, invoices and catalogue PDFs** are saved in `backend/uploads/`, which is git-ignored. Real product photos still load from the public image store.
- **OTPs** are printed in this terminal. In development the apps also show them on screen.
- **Payments:** add your own Razorpay **test** keys to `.env` to try checkout.

Run the tests with `npx vitest run`, or `npx vitest run path/to/file.test.ts` for one file. Two tests are flaky only in the full parallel run: analytics "ranks top subcategories" and webhooks "returns 503". Re-run, or run those files alone.

## 4. Customer website

In a second terminal:

```bash
cd frontend/customer-web
cp .env.example .env
npm ci
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` to the backend on port 4000.

**On your phone** (same Wi-Fi):
1. Find your laptop's LAN address:
   - Mac: `ipconfig getifaddr en0`
   - Windows: `ipconfig`
2. In `backend/.env`, uncomment `CORS_ALLOWED_ORIGINS` and `PUBLIC_API_URL`, put that address in both, and restart the backend.
3. Open `http://<laptop-ip>:5173` on the phone.

Customer sign-up works locally. The OTP is shown on screen and printed in the backend terminal.

## 5. Staff app (Android)

In a third terminal:

```bash
cd frontend/app
npm ci
npx patch-package           # only if npm did not run it: "Applying patches... react-native-share ✔"
```

**Phone:**
1. Enable Developer options and **USB debugging**.
2. Connect the phone by cable and accept the prompt on it.
3. Keep the phone on the **same Wi-Fi** as the laptop.

Or start an emulator from Android Studio instead.

```bash
npx expo run:android
```

The first run creates the `android/` folder, which is git-ignored and generated from `app.json`. It then builds and installs a development build (about 10 minutes), and after that starts the code server. Saving a file reloads the app.

**API address:** in development the app talks to `http://<your-laptop-LAN-IP>:4000` automatically. See `src/api/client.ts`. To point it elsewhere, start with `EXPO_PUBLIC_API_URL=http://host:port npx expo run:android`.

### Logging in to the staff app

- **Option A (real data):** the only login is the owner's admin account. Don't ask for its live MPIN. Set your own **local** MPIN:
  1. On the login screen tap **Forgot MPIN?**
  2. Enter the admin mobile number the owner gives you.
  3. The OTP appears on screen (development only).
  4. Choose a new MPIN.

  This changes only your laptop's copy. The live shop is not affected.
- **Option B (demo data):** mobile `9999999999`, MPIN `000000` (from `SEED_ADMIN_*` in `.env`).
- **Adding staff:** from the app go to **Team → Invite**, then log in with **Activate your account**. The OTP is shown on screen.

## 6. Common problems

| Problem | Fix |
|---|---|
| `Port 4000 / 5173 already in use` | Stop the other program, or change `PORT` in `backend/.env` (and set `VITE_API_URL=http://localhost:<port>` for the website). |
| `P1001: Can't reach database` | Check `DATABASE_URL`: user, password, port, database name. Local Postgres needs no `sslmode`. |
| `The table ... does not exist` | You ran `prisma migrate`. Drop and recreate `nandam_dev`, then use Option A or `db push`. |
| No OTP arrives | Correct: SMS is off locally. Read it from the backend terminal or the on-screen banner. |
| Photos don't load on the phone | Set `PUBLIC_API_URL` to the laptop's LAN IP and restart the backend. |
| Checkout says payments not configured | Add Razorpay **test** keys to `backend/.env`. |
| Staff app can't reach the server | Phone and laptop must be on the same Wi-Fi, and the laptop firewall must allow port 4000. |

## 7. Never commit

- `.env` files (all are git-ignored)
- database backups (`*.dump`, `*.sql`)
- signing keys (`*.jks`, `*.keystore`, `credentials.json`)
- anything from the live server

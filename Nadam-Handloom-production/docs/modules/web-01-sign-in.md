# Website module W1: Customer sign-in and account

| | |
|---|---|
| **Status** | **Live since 16 Oct 2026, about 01:50 IST, on `https://nandamhandlooms.com`** (the old website kept aside during development; section 14.7). Built and tested 15 Oct (phases 0 to 8, section 14). Real-phone checks by the owner still to do. |
| **Where** | The new website (`Nadam-frontend/customer-web`) and the new server (`Nadam-backend`, `/api/v2/shop`) |
| **Users** | Customers. Owners and staff sign in to the admin app (admin Module 1), never here. |
| **Design** | Design C Utsav (website plan, Step 0): Dark, Light and Auto for visitors |
| **Plan of the whole website** | [`web-00-website-plan.md`](web-00-website-plan.md) |

## 1. Goal
A customer signs in with their mobile number and an SMS code, gives a few details once, and stays signed in for 30 days. Nothing to remember. The shop gets the details it needs for delivery and analytics. A customer can never reach anything in the admin app.

## 2. What is in this module
- Sign in or sign up with mobile + SMS code (one flow for both).
- First-time profile: full name, email, pincode (city and state filled in from the pincode).
- Staying signed in for 30 days; sign out; sign out of all devices; signed-in devices list.
- My account: profile (name, email, profile picture, date of birth, anniversary, language, offer choices), change mobile (code on the new number), addresses, delete my account.
- Pincode lookup.
- Push notifications on the website with Firebase (subscribe, preferences; sending is wired to orders in the orders module).
- Not here: checkout and orders (W6, W7). The admin app's Customers list and "Send a notification" (later admin work).

## 3. Discussion and decisions (2026-10-15, owner)

| # | Decision |
|---|---|
| 3.1 | **No existing customers to carry over**: the website is still in development, so the sign-in is designed from scratch. |
| 3.2 | **Mobile + SMS code, no PIN.** Like the big Indian shopping sites: nothing to remember, no "forgot PIN" screens. |
| 3.3 | **Stay signed in 30 days** on that browser (today's site: 1 day). |
| 3.4 | **Checkout sign-in is the same flow**: mobile + code inside checkout; a new customer's account is made on the spot. No separate guest checkout. |
| 3.5 | **Details collected for analytics and delivery:** name, email, mobile, pincode, city, state at sign-up; address at first order; profile picture, birthday, anniversary, language later on the account page. Collected automatically: where they came from, device, dates. Gender is not asked. |
| 3.6 | **Admin, staff and customer kept apart (option A):** one `AuthAccount` per person (one mobile), roles ADMIN / STAFF / CUSTOMER, separate profiles (`AdminProfile` vs `UserProfile`), separate sign-in addresses, separate keys and secrets, `Session.kind`. Orders, invoices and analytics keep linking to `AuthAccount`, so the admin app does not change. |
| 3.7 | **JWT** for the sign-in keys, as in the admin app, with the website's own secret. |
| 3.8 | **Firebase** (Cloud Messaging) for push and web push. Keys in the one `backend/.env`. |

## 4. How it works

### 4.1 Sign in or sign up
1. Mobile number (10 digits, India). "Send code".
2. 6-digit SMS code. Android Chrome fills it in by itself (Web OTP); iPhone offers it above the keyboard (`autocomplete="one-time-code"`).
3. Known customer: signed in, back to where they were (bag, checkout, a saree).
4. New customer: "Complete your profile": full name, email, pincode (city and state appear; can be corrected), tick "Send me new arrivals and offers" (optional), a line on why we ask. "Create account". Signed in.

### 4.2 Staying signed in
A short key (JWT, 15 minutes) for each request, renewed quietly from a 30-day sign-in kept in a protected cookie. Each use of the 30-day sign-in extends it. Closing the browser does not sign out.

### 4.3 My account
Profile, profile picture, change mobile (SMS code on the new number), addresses (add, edit, delete, default), notifications (which ones), signed-in devices (sign one out, or all), delete my account (request; orders and invoices are kept for tax, personal details removed).

### 4.4 Sign out
"Sign out" ends this browser. "Sign out of all devices" ends every sign-in at once.

## 5. Rules (the numbers)

| Rule | Value |
|---|---|
| SMS code | 6 digits, valid 10 minutes, 3 tries, then a new code |
| Resend | after 60 seconds; at most 5 codes per hour per mobile; per network an hour: 60 per IPv4 address (mobile carriers share one among many customers), 20 per IPv6 /64 block (16 Oct) |
| Daily SMS limit | `SHOP_SMS_DAILY_LIMIT` (500) codes a day to numbers **with no account yet**; returning customers are never stopped by it (16 Oct) |
| Short key (JWT) | 15 minutes |
| Sign-in | 30 days, extended on use |
| Profile picture | JPEG, made small (about 256 px), location removed, on S3 |
| Name | 2 to 60 characters |
| Email | a valid address; one account per email |
| Pincode | 6 digits, must exist in the pincode list |

## 6. Edge cases and what the customer sees
- Wrong code: "That code isn't right. 2 tries left."; after 3: "Get a new code".
- Code expired: "This code has expired. Get a new one."
- Too many codes: "Too many codes for this number. Try again in N minutes."
- Email already used by another account: "This email is on another account. Use a different one or sign in with that mobile."
- Unknown pincode: "We couldn't find this pincode. Check it, or type the city and state."
- Account being deleted: sign-in says "Your account will be deleted on <date>" and offers "Keep my account" (7-day window).
- No internet while signing in: the form keeps what was typed; "Try again".
- A staff member's mobile: signs in as a customer like anyone else; the website never shows staff powers.
- Rare situations found in the 16 Oct check and how they are handled now: see [`web-02-home-and-shop.md`](web-02-home-and-shop.md), section 12.

## 7. Data (same live database, additive only)

**Reused:** `AuthAccount` (mobile, email, status, verified dates), `Role` + `UserRole` (CUSTOMER), `UserProfile`, `Session`, `Address`, `AuthEvent` (source `customer_web`), `RateLimitHit`. (Built: website codes went into a new `PhoneCode` table instead of `OtpCode`, see 14.3.)

**Not used for customers:** `AdminProfile`, `TrustedDevice`, `AuthChallenge`, `DeviceToken` (Expo, admin app), `LoginThrottle` and `mpinHash` (no PIN), `PasswordResetToken`, `ApiToken`.

**New fields (all optional):**
- `UserProfile`: `city`, `state`, `pincode`, `dateOfBirth`, `anniversary`, `language`, `marketingOptIn`, `marketingOptInAt`, `privacyAcceptedAt`, `signupSource`, `signupMedium`, `signupCampaign`, `signupReferrer`, `signupDevice`, `lastSeenAt`, `deleteRequestedAt`. (Profile picture: the existing `avatarUrl`.)
- `Address`: `label` (Home, Office, Other), `landmark`.
- `Session`: `kind` (`staff` or `customer`); built with `parentId` and `startedAt` too (14.3).

**New tables:**
- `Pincode` (pincode, area, city, state): India's pincodes from a free public list, loaded once by a script.
- `PushToken` (token, platform web/android/ios, account (optional, so visitors can subscribe), topics, user agent, last seen, removed).
- `Notification` (account, channel push/SMS/email, type, title, text, link, status, sent, read).

Worked out, not stored: number of orders, total spent, first and last order, new or repeat.

## 8. Security design

### 8.1 The JWT
- Signed with `JWT_SHOP_ACCESS_SECRET` (its own secret, in the one `backend/.env`), 15 minutes. Claims: `sub` (account), `aud: "shop"`, `sid` (session), `stamp` (security stamp at issue).
- The admin side requires `aud: "admin"`; the website side requires `aud: "shop"` and the CUSTOMER role. Neither accepts the other's key.
- The website keeps the short key in memory only (never in browser storage).

### 8.2 The 30-day sign-in
- A random 256-bit value, stored hashed in `Session` (`kind = customer`, `platform = web`), sent as an `HttpOnly; Secure; SameSite=Lax` cookie limited to `/api/v2/shop/auth`.
- Swapped for a new one on every refresh; reuse of an old one ends all of that customer's sessions, except within a 10-second grace (a lost answer on a slow network gets the same successor, so no false sign-outs).
- "Sign out of all devices" changes `securityStamp`.
- CORS and cookies allow only the shop's own website address; the refresh call also needs a custom header (against cross-site requests).

### 8.3 Everything else
- SMS codes stored hashed; same answer for known and new numbers.
- Rate limits per mobile and per network; a hidden trap field against bots (a free Cloudflare check can be added later).
- Every sign-in and change recorded in `AuthEvent`; no personal details in server logs.
- Privacy (DPDP 2023): reason shown at sign-up, offers only with a tick, edit everything, delete my account.

## 9. Backend (MVC, under `/api/v2/shop`)

Folders: `routes/shop/`, `controllers/shop/`, `validators/shop/`, `services/shop/`, middleware `authenticateCustomer.js`, tests in `tests/api/shop/`.

| API | What it does |
|---|---|
| `POST /shop/auth/code` | `{ mobile }`: sends the SMS code |
| `POST /shop/auth/verify` | `{ mobile, code }`: known customer → signed in; new → `{ next: "profile", stepToken }` (15 minutes) |
| `POST /shop/auth/complete` | `{ stepToken, fullName, email, pincode, city, state, marketingOptIn, source }`: account made, signed in |
| `POST /shop/auth/refresh` | new short key from the 30-day cookie |
| `POST /shop/auth/logout`, `/logout-all` | sign out here, or everywhere |
| `GET /shop/pincodes/:pin` | city and state |
| `GET /shop/me`, `PATCH /shop/me` | profile |
| `POST /shop/me/avatar`, `DELETE /shop/me/avatar` | profile picture |
| `POST /shop/me/mobile/code`, `/shop/me/mobile/verify` | change mobile |
| `GET /shop/me/sessions`, `DELETE /shop/me/sessions/:id` | signed-in devices |
| `GET/POST /shop/me/addresses`, `PATCH/DELETE /shop/me/addresses/:id`, `POST /shop/me/addresses/:id/default` | addresses |
| `POST /shop/me/delete-request` | delete my account |
| `POST /shop/push/subscribe`, `DELETE /shop/push/subscribe`, `PATCH /shop/push/preferences` | Firebase web push |

## 10. Firebase push and web push
- A Firebase project under the shop's Google account (free). The website registers a small background worker (`firebase-messaging-sw.js`) and asks for permission at a useful moment (after an order, "Notify me of new arrivals"), never on page load.
- The server sends with the Firebase Admin SDK; its service-account keys go in the one `backend/.env`. Tokens that Firebase reports as gone are removed.
- What gets sent: order paid, shipped (DTDC number), delivered, payment failed; new arrivals and offers only to customers who opted in; later back-in-stock and bag reminders.
- iPhone: web push works only after "Add to Home Screen" (iOS 16.4+), so the site gets a web app manifest, and key order updates also go by SMS.

### 10.1 Set up (2026-10-15)
- Firebase project **`nandam-cf952`** ("Nandam"), free Spark plan, under the shop's Google account. Web app "Nandam Website" registered; Cloud Messaging web push key pair made.
- All values are in the one `Nadam-backend/.env` (never in the repo): server `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (secret); website `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_AUTH_DOMAIN`, `FIREBASE_WEB_STORAGE_BUCKET`, `FIREBASE_WEB_MESSAGING_SENDER_ID`, `FIREBASE_WEB_APP_ID`, `FIREBASE_WEB_MEASUREMENT_ID`, `FIREBASE_WEB_VAPID_KEY` (public; the server hands them to the website, so there is still one `.env`). Names listed in `.env.example`.
- The service-account file is kept on the owner's Mac in `~/Documents/Nandam-Handlooms/firebase/` (owner-only access), outside the repo; the repo's `.gitignore` refuses `firebase/` and `*firebase-adminsdk*.json`.
- Not used: Firebase Authentication, Firestore, Hosting. Google Analytics came on with the web app (`measurementId`); we don't load it unless the owner decides to.

## 11. Testing plan
Server tests for every API and rule above (codes, limits, keys that can't cross, refresh rotation with grace, sign out everywhere, profile, addresses, pincodes, push tokens). Website tests for the forms. Then a real run on a laptop, an Android phone (code fills itself in, push) and an iPhone (home-screen push).

## 12. Answered (owner, 2026-10-15)
- **Firebase:** the project is made under the **shop's** Google account.
- **SMS:** Message Central for now (the server's existing `messagecentral` provider, about ₹0.30 per code). Once DLT registration is done, the shop moves to **MSG91**: the server's SMS sender is a swappable provider (`services/sms/`, chosen by `SMS_PROVIDER` in the one `backend/.env`), so an `msg91` provider is added then and nothing else changes.
- **Delete my account:** a **7-day** window to cancel. Signing in during those 7 days offers "Keep my account"; after 7 days the personal details are removed and the orders and invoices stay for tax.

## 13. Build steps
1. Database update (additive), tried on the local copy; on live only with the owner's go, after a backup. Load the pincode list.
2. Server: pincodes, sign-in, `authenticateCustomer`, my account, addresses, push; tests.
3. Website foundation (Design C, Dark/Light/Auto switch), then the sign-in and account pages, then the Firebase worker.
4. Test on laptop, Android and iPhone.
5. Live on a test address beside the old website, on the owner's go.

## 14. Built (15 Oct 2026, phases 0 to 8)

Everything in sections 4 to 11 is built, on the owner's Mac, against a local copy of the database. Nothing live has changed. Going live is phase 9 (section 14.7), on the owner's go.

### 14.1 Database (one additive update)
- Migration `20261015200000_w1_shop_sign_in`: the `UserProfile` fields of section 7 plus `avatarKey` (to delete a replaced picture) and `profileCompletedAt`; `Address.label` and `landmark`; `Session.kind` (every existing row becomes `staff`), `parentId`, `startedAt`; new tables `PhoneCode`, `Pincode`, `PushToken`, `Notification`. Only new columns with defaults or empty values and new tables: the old backend, old website and admin app are untouched.
- `Pincode`: India Post's directory, 19,297 pincodes in 36 states and union territories (`prisma/data/india-pincodes.csv`, how it was made in `prisma/data/README.md`). Loaded with `node scripts/load-pincodes.js --yes` (safe to run again; `--prune` removes pincodes no longer in the file). Army post offices (9xxxxx) and India Post's "TEST OFFICE" are left out: couriers don't deliver there, and the customer can type the city and state.
- Backups before the change: code `~/Documents/Nandam-Handlooms/backups/code-2026-10-15-before-w1/`, local database `~/Documents/Nandam-Handlooms/backups/db-local-2026-10-15-before-w1/` (both owner-only).

### 14.2 Server (`/api/v2/shop`, all of section 9)
| Part | Where |
|---|---|
| Routes | `src/routes/shop/index.js` (mounted at `/api/v2/shop`) |
| Controllers | `src/controllers/shop/` (`auth`, `me`, `public`, `cookie.js`) |
| Request rules | `src/validators/shop/` (`common`, `auth`, `me`, `push`) |
| Services | `src/services/shop/` (`auth`, `code`, `session`, `token`, `profile`, `address`, `account`, `push`, `place`, `config`, `present`), `src/services/push/` (Firebase and test-mode senders), `src/services/sms/msg91.provider.js` |
| Guards | `src/middlewares/authenticateCustomer.js`, `shopGuard.js` (CORS, cookie-call checks, website switch), `avatarUpload.js` |
| Models | `src/models/` `customer`, `shopSession`, `phoneCode`, `pincode`, `address`, `pushToken`, `notification` |
| Rules (numbers) | `src/config/constants.js` → `SHOP` (code 6 digits, 10 min, 3 tries, resend 60 s, 5 an hour per mobile, 20 an hour per network, 30-day sign-in, 10-second grace, 20 browsers, 10 addresses, 7 days, picture 5 MB → 256 × 256) |

Extra endpoints beyond section 9: `GET /shop/config` (website switch, shop details, states, languages, public Firebase values), `POST /shop/push/status` and `POST /shop/push/test` (the notifications page), `DELETE /shop/me/delete-request` ("Keep my account").

New settings (one `backend/.env`): `JWT_SHOP_ACCESS_SECRET` (required, its own secret), `SHOP_WEB_ORIGINS` (required in production: the website's address), `SHOP_COOKIE_SECURE` (default on in production), `SHOP_SMS_DAILY_LIMIT` (500), `PUSH_PROVIDER` (`fcm` / `console`), `MESSAGE_CENTRAL_CODE_TTL_SECONDS` (60), `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`. The Firebase values were already there.

Every reply that went wrong for an unexpected reason now carries a short reference (`details.reference`, also the `X-Request-Id` header) that the website shows and the server log has. This applies to the admin API too (it ignores it).

### 14.3 Changes from the plan, and why
| Plan | Built | Why |
|---|---|---|
| Codes in `OtpCode` | New `PhoneCode` table, keyed by mobile | `OtpCode` needs an account; a new customer has none until the profile is done. Making empty accounts for every typed number would fill the database with junk. |
| "Sign out of all devices" changes `securityStamp` | It ends every website sign-in directly (and stops their notifications) | The stamp is shared with the admin app: changing it would also sign a staff member out of the admin app, and the owner's "remove access" would sign them out of the website. Every website request checks its own sign-in row, so ending the rows takes effect at once. |
| Admin and website kept apart by key secrets | Also by `Session.kind` | Admin-side bulk sign-outs (remove access, PIN reset, theft) now touch only `staff` rows; a website cookie sent to the admin app is refused without triggering the admin app's theft alarm. |
| 10-second grace on renewal | Built with `Session.parentId` | A renewal repeated within 10 seconds (its reply was lost on mobile data, or two tabs) replaces the unused successor instead of signing the customer out. A replaced successor shown later only ends that one browser. Tabs also take turns renewing (Web Locks). |
| Firebase Admin SDK on the server | Firebase's HTTP v1 API, called directly (what the Admin SDK calls) | No heavy extra package on the 1 GB server. Checked for real on 15 Oct: the service account signs in to Google and Firebase answers. |
| Code valid 10 minutes | 10 minutes for our own codes (test mode, MSG91); **Message Central decides its own** (60 seconds now, "Validity Time" in its dashboard) | Message Central makes and checks the code itself. The website shows the real time it has. Raising it in the Message Central dashboard (and `MESSAGE_CENTRAL_CODE_TTL_SECONDS`) gives customers more time. |
| — | Owners and staff can't change their mobile or delete their account from the website ("managed by the shop") | Their number is their admin-app sign-in. |
| — | "Delete my account" is refused while an order is paid, packed or shipped | So a delivery isn't lost; the customer can delete after it arrives. |

### 14.4 Website (`Nadam-frontend/customer-web`)
- React 19 + Vite 8, plain JavaScript, React Router 7. Builds to plain files (`npm run build` → `dist/`, about 95 KB gzipped to start; Firebase's code loads only when a customer turns notifications on).
- Design C Utsav from the approved mock-up (`src/theme/tokens.css`, `base.css`, `pages.css`): Bodoni Moda + Figtree served with the site (no Google Fonts request), colours checked for contrast (text at least 4.5 : 1 in light and dark). Auto / Light / Dark switch in the footer, applied before the page draws.
- Pages: home (for now: says plainly that collections open soon), sign in (mobile → code → profile), My account (overview, profile, addresses, notifications, signed-in devices, delete account), privacy and terms (**drafts for the shop to review**), not found, website-switched-off page, crash page with a reference.
- `src/api/client.js`: one place for every call; adds the website header; renews the short key quietly and retries once; turns offline, timeouts, server errors and refusals into plain messages. `src/auth/session.js`: the short key in memory only (never in browser storage), renewal a minute before it runs out and when a tab comes back, tabs kept in step, a sign-in that ended by itself explained once.
- Notifications: `public/firebase-messaging-sw.js` (the worker that shows them), `public/manifest.webmanifest` + icons (needed for iPhone home-screen notifications), `src/push/push.js`. Permission is asked only when the customer presses "Turn on notifications".
- First-visit analytics without tracking scripts: utm values and the referring site, kept 30 days in the browser and sent once with sign-up.

### 14.5 Every error case, as built
Wrong mobile (field message) · code sent a moment ago (code step with the real countdown) · 5 codes an hour / 20 per network (wait time in minutes) · SMS paused or down (WhatsApp offered) · wrong code (tries left, boxes cleared, shake) · 3 wrong or expired (only "Get a new code") · profile step over 15 minutes (back to the mobile step, typed details kept) · email on another account · unknown pincode (type city and state) · key expired (renewed quietly) · signed out from another device / everywhere / for safety / after 30 days (told why, sent to sign in and back) · account being deleted ("Keep my account" on every account page) · offline (banner, nothing lost, saving works when back) · page code failing to download (waits for the connection, or reloads once after a website update) · unexpected error (reference to quote) · picture too big or not a photo (checked before uploading) · notifications blocked, unsupported, or iPhone not on the Home Screen (how to fix it) · website switched off (maintenance page with the owner's message).

### 14.6 Tests (all passing, 15 Oct 2026)
| What | Result |
|---|---|
| Server, whole suite (`npx vitest run` in `Nadam-backend`) | **411 / 411** (298 before W1 + 113 new: `tests/api/shop/*`, `tests/unit/shop.test.js`) |
| Website unit tests (`npm test` in `customer-web`) | **28 / 28** (field rules, API client, sign-in store, code boxes, the sign-in flow) |
| Real browser, real server, test database (`npm run test:e2e`) | **Chrome 245 / 245** (laptop and phone widths, light and dark, website switched off) · **Safari's engine (WebKit) 122 / 122** |
| Firebase dry run with the shop's real service account | Signed in to Google; Firebase answered (nothing delivered) |

Bugs the browser test found and that are fixed: a delayed cursor jump that dropped a typed code digit; labels not linked to some fields (screen readers); icon-only menu and sign-in buttons without names on phones; a signed-out device only finding out on its next save; a page failing when the connection dropped while it loaded; "Sign out" landing on the sign-in page instead of home; a few phone layout details.

### 14.7 Live (phase 9, 16 Oct 2026)
On the owner's go, the new website **replaced the old one on `nandamhandlooms.com`** for the rest of development (the old site's files are kept; switching back takes a minute). Details, checks and undo: `docs/deployment/live-v2-server.md` → "Changes deployed", 2026-10-16.
- Done: backups (live database, nginx, server code and settings), the database update and pincodes on live, the server with W1, the website files, nginx with strict security headers, outside checks (40 / 40 in Chrome and Safari's engine, no errors), Firebase key accepted from the website's address.
- To do by the owner (needs real phones): sign in with a real number (a real SMS, about ₹0.30); turn on notifications and press "Send a test notification" on an Android phone and on an iPhone (after Add to Home Screen).
- To do: the shop reviews the privacy and terms drafts. Message Central codes still live 60 seconds (raise "Validity Time" in its dashboard, then `MESSAGE_CENTRAL_CODE_TTL_SECONDS`).
- While the shopping modules are being built, visitors can sign in and manage their account but can't browse or buy; the home page says so and offers WhatsApp.

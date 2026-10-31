# customer-web: the new customer website (from scratch)

The shop's website, rebuilt from scratch the same way as the admin app: plan → mock-up → owner's picks → build → test → go live beside the old site. The old website (`frontend/customer-web` at the repo root) keeps running until the owner says to switch.

**Status (16 Oct 2026):** W1 (sign-in and My account) and W2–W4 (home, shop lists, saree page) are **live on `https://nandamhandlooms.com`**. **W5, the bag, is live too (since 16 Oct, about 23:45 IST)** ([decision record](../../docs/modules/web-03-cart.md)). Deploy: build here, copy `dist/` to `/var/www/nandam-web/dist` on the server (see `docs/deployment/live-v2-server.md`). Checkout and orders come next ([website plan](../../docs/modules/web-00-website-plan.md)).

## How it fits
- Talks only to the **new server** (`Nadam-backend`, `/api/v2/shop`), on the same address as the website (nginx passes `/api/v2/` to it), so the 30-day sign-in cookie is first-party.
- React 19 + Vite 8, JavaScript, React Router 7. `npm run build` makes plain files in `dist/` that nginx serves: nothing extra runs on the server (1 GB of memory).
- Design C "Utsav" from the approved mock-up (`docs/design/ui-mockup/web-0-design`), with Auto / Light / Dark for visitors.

## Run it on the Mac
```bash
# 1. The server, on a TEST copy of the database, with test-mode SMS and push
cd Nadam-backend
createdb -T nandam_dev nandam_e2e            # once (or after big changes)
NODE_ENV=development PORT=4300 HOST=127.0.0.1 DATABASE_URL="postgresql://$USER@localhost:5432/nandam_e2e" \
  SMS_PROVIDER=console PUSH_PROVIDER=console STORAGE_PROVIDER=local LOCAL_STORAGE_DIR=tmp/e2e-uploads \
  PUBLIC_URL=http://localhost:5180 SHOP_WEB_ORIGINS=http://localhost:5180,http://127.0.0.1:5180 node server.js

# 2. The website (another terminal): http://localhost:5180
cd Nadam-frontend/customer-web
npm install
NH_API_URL=http://127.0.0.1:4300 npm run dev
```
In test mode no SMS is sent: the code is shown on the code screen ("Test mode … the code is 123456") and in the server log. It is never shown in production (the server refuses test-mode SMS there).

## Tests
| Command | What |
|---|---|
| `npm test` | Website unit tests (Vitest + Testing Library): field rules, API client, sign-in store, code boxes, the sign-in flow |
| `npm run test:e2e` | Real browser against the real server and the test database: every W1 screen at laptop and phone widths, light and dark ([e2e/README.md](e2e/README.md)) |
| `npm run test:e2e:shop` | W2–W4 in a real browser (see [e2e/README.md](e2e/README.md)) |
| `npm run test:e2e:bag` | W5, the bag, in a real browser against a local copy it may change |
| `npm run test:e2e:checkout` | W6, checkout and payment, with a stand-in Razorpay window; the server runs with `PAYMENT_PROVIDER=fake` (see [e2e/README.md](e2e/README.md)) |
| `npm run lint` | ESLint (React hooks rules) |

## Folders (`src/`)
| Folder | What |
|---|---|
| `api/` | `client.js` (every call: website header, quiet renewal, retry, plain error messages), `shop.js` (all endpoints), `errors.js` |
| `auth/` | `session.js` (the sign-in on this browser), `useAuth.js`, `RequireAuth.jsx`, `SessionNotice.jsx` |
| `bag/` | The bag (W5): `store.js` (browser storage, checks, joining at sign-in, sign-out), `useBag.js`, `useBagActions.js`, `message.js` (WhatsApp texts) |
| `config/` | What the server says first (`/shop/config`): website switch, shop details, states, Firebase public values |
| `components/` | Header (design C), full-screen menu, footer, theme switch, buttons, fields, mobile and code inputs, pincode → city/state, dialogs, toasts, crash page |
| `pages/` | `home/`, `shop/`, `product/`, `bag/` (the bag page and a bag line), `account/` (sign in and My account), `info/` (privacy, terms, not found, maintenance) |
| `push/` | Firebase web push (loaded only when a customer turns notifications on) |
| `theme/` | `tokens.css` (colours, fonts, light and dark), `base.css`, `pages.css`, `theme.js` |
| `utils/` | Field rules (same as the server), formatting, first-visit analytics, page titles |
| `public/` | `firebase-messaging-sw.js`, `manifest.webmanifest`, icons, photos, `robots.txt` |

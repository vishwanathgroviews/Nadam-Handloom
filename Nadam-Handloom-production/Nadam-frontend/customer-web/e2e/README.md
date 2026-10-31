# End-to-end test (W1)

`w1.e2e.cjs` drives a real browser through every W1 screen against the real server and a **local test database** (`nandam_e2e`, a copy of `nandam_dev`). It refuses any other database. Screenshots of every screen go to `e2e/out/` (not committed).

1. Start the server and the website as in the main README (server on port 4300 with `SMS_PROVIDER=console`, `PUSH_PROVIDER=console`; website on 5180).
2. `npm run test:e2e` — Chrome (Playwright's `chrome-headless-shell`), four rounds: 1440 light, 390 dark, 390 light, 1440 dark, then the website-switched-off page (it turns the switch on in the test database for 20 seconds).
3. Safari's engine: `WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NH_ENGINE=webkit NH_ROUNDS=390-light,1440-dark npm run test:e2e`.

Covered: visitor pages, menu, sign-in steps and their errors, new and known customers, staying signed in (cookie flags, nothing in browser storage), profile and picture, change of mobile, addresses, notifications page and offers consent, signed-in devices with a second browser, delete and keep, offline, sign out everywhere, a sign-in unused for 30 days, sign out, theme switch, field labels, no sideways scrolling, and no page errors.

Real-phone checks (Android code autofill and push, iPhone home-screen push) need the https test address: phase 9.

# End-to-end test (W2–W4: home, shop lists, saree page)

`w2.e2e.cjs` only reads: it needs the server on a local copy **with real catalogue data** (default `nandam_live_20261016`; `NH_E2E_DB` for another, used only to find a sold-out saree) and the website (dev on 5180, or the production build: `npm run build && NH_WEB_PORT=5181 npm run preview`, then `NH_WEB=http://127.0.0.1:5181`).

- `npm run test:e2e:shop`: Chrome, four rounds (1440 light, 390 dark, 390 light, 1440 dark) plus "reduce motion". Screenshots `e2e/out/w2-*.png`.
- Safari's engine: `WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NH_ENGINE=webkit NH_ROUNDS=390-light,1440-dark npm run test:e2e:shop`. Against the production build add `NH_NO_SHOTS=1`: in WebKit each screenshot logs a refused `<style>` that Playwright itself injects (the website has none).

Covered (the client's design, 26 Oct 2026): the 6 categories as round photos ("Coming soon" ones too) and the crafts, Latest collections (newest first, "New"), every saree on the home page, the footer with the store only on the home page and the line of links elsewhere, store details and search-engine data, the menu bar and a category's menu (computers), the phone menu and `#store`, the search bar's suggestions (typo spellings, the craft, Escape) and results, all collections and craft chips, a category's collections, a collection (Sets only, grid size remembered), coming-soon categories, filters (side column; the sheet on phones with focus and Escape), Add to bag from a card, empty and junk addresses, sort, grid size remembered, "Load more" and Back to the same place, the saree page (price without MRP, WhatsApp text, call, photo viewer, details, rails, recently viewed, phone order bar), sold-out and missing sarees and collections, old addresses, one heading per page, alt text, named buttons and links, labelled fields, no sideways scrolling, no console errors.

# End-to-end test (W5: the bag)

`w5.e2e.cjs` needs the server on a **local copy of the live data that it may change** (default `nandam_w5e2e`: `createdb -T nandam_live_20261016 nandam_w5e2e`; it refuses anything but `nandam_w5e2e`, `nandam_e2e` or `nandam_test`) with `SMS_PROVIDER=console`, and the website (dev on 5180: `http://localhost:5180`). It signs up test customers, saves their bags, and for a moment marks one saree sold and raises one collection's price by ₹100 (both put back straight after).

- `npm run test:e2e:bag`: Chrome, 1440 light and 390 dark. Screenshots `e2e/out/w5-*.png`.
- Safari's engine: `WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NH_ENGINE=webkit NH_ROUNDS=390-light,1440-dark npm run test:e2e:bag`. WebKit can hang when Playwright closes a tab; the test gives each close 5 seconds and goes on.

Covered: `/cart` opens the bag; the empty bag; "Add to bag" for a single piece (side panel, total, header number, Escape, "In your bag") and for a set (pieces, "2 in your bag · up to N more"); the bag page (lines with codes, total, "checked just now"), one more piece, remove and Undo in its place; "Send bag on WhatsApp" (message with codes, pieces and total; the shop's chat link; "Sent on WhatsApp?"); a saree sold at the store and a new price while in the bag (marked on the line, one note, not counted, the note going after a change); offline; the old website's bag brought back once; two tabs; signing up (the bag moves into the account, saved in the database, no message for a new customer), adding while signed in, signing out (the bag leaves this browser), signing in again (bags joined, "Welcome back"); clearing (asks first, also in the account); a sold-out saree has no "Add to bag"; no sideways scrolling, one heading, named buttons, alt text, no console errors.

# End-to-end test (W6: checkout and payment)

`w6.e2e.cjs` buys sarees in a **local copy of the live data** (default `nandam_w5e2e`) and puts them back in stock at the end. Razorpay's window is a stand-in (`fixtures/fake-razorpay.js`, served in place of Razorpay's script), so the server must run with the stand-in for Razorpay's servers:

```bash
NODE_ENV=development PORT=4300 HOST=127.0.0.1 DATABASE_URL="postgresql://$USER@localhost:5432/nandam_w5e2e" \
  SMS_PROVIDER=console PUSH_PROVIDER=console STORAGE_PROVIDER=local LOCAL_STORAGE_DIR=tmp/e2e-uploads \
  PUBLIC_URL=http://localhost:5180 SHOP_WEB_ORIGINS=http://localhost:5180,http://127.0.0.1:5180 \
  PAYMENTS_ENABLED=true PAYMENT_PROVIDER=fake RAZORPAY_KEY_ID=rzp_test_fakeprovider01 \
  RAZORPAY_KEY_SECRET=e2e_key_secret_0123456789abcdef RAZORPAY_WEBHOOK_SECRET=e2e_webhook_secret_0123456789abcdef node server.js
```

- `npm run test:e2e:checkout`: Chrome, 1440 light and 390 dark. Screenshots `e2e/out/w6-*.png`.
- Safari's engine: `WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NH_ENGINE=webkit NH_ROUNDS=390-light,1440-dark npm run test:e2e:checkout`.

Covered:
- Checkout in the side panel, the bag and the phone bar; WhatsApp as a small link.
- A visitor is asked to sign in and comes back. The first address opens at once; the address is saved with its landmark.
- The review: codes, prices, the GST note.
- Pay opens Razorpay with the exact amount in paise, our payment request, name and mobile, and the hold as its time limit. "Held until" shows. The saree is reserved, then sold online, invoiced and shipped from the admin app's To ship. The bag empties.
- Window closed: Pay now reuses the order. Failed: "Nothing was taken", then Try again. Three requests make one order.
- Change my bag. A new price stops Pay.
- The phone loses the connection: Razorpay's notice completes the order, and a second notice changes nothing. Back at checkout, "went through" shows.
- Paid after a saree sold at the store: refunded, never sold twice.
- The server ends a hold by itself.
- The shipping, refunds and contact pages, and robots.txt.
- One heading, alt text, named buttons, labelled fields, no sideways scrolling, no console errors.

# End-to-end test (W7: My orders)

`w7.e2e.cjs` needs the same server as W6 (the stand-in for Razorpay, on `nandam_w5e2e`) and the test owner of `prisma/dev-seed.js` (90000 00001, PIN 246810) in that copy: the shop's side (ship, delivered, cancel) goes through the admin app's own endpoints, on a device the test trusts and removes at the end. It also adds 20 sample orders for "Show more" (removed at the end) and puts the sarees it bought back in stock.

- `npm run test:e2e:orders`: Chrome, 1440 light and 390 dark. Screenshots `e2e/out/w7-*.png`.
- Safari's engine: `WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NH_ENGINE=webkit NH_ROUNDS=390-light,1440-dark node e2e/w7.e2e.cjs`.
- The production build: `npm run build`, `NH_WEB_PORT=5181 npm run preview`, then `NH_WEB=http://localhost:5181`.

Covered: see `docs/modules/web-05-my-orders.md` section 17.
- **On the Android phone** (its own Chrome, over USB): `adb reverse tcp:5180 tcp:5180 && adb reverse tcp:4300 tcp:4300`, open Chrome on the phone, `adb forward tcp:9222 localabstract:chrome_devtools_remote`, then `NH_ENGINE=android node e2e/w7.e2e.cjs`. The server must send real notifications (`PUSH_PROVIDER=fcm` and the website's Firebase settings). Keep the phone unlocked. The test turns notifications on, checks "shipped" on the open page and "delivered" in the phone's notifications (and taps it), and at the end removes the website's data and the test invoice from the phone.


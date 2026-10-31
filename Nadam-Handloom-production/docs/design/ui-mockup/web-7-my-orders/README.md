# W7 My orders mock-up

A clickable mock-up of website module W7 (My orders: the list, one order with its progress, tracking, invoice, buy again and help), made on 17 Oct 2026 for the owner's picks. It is built on the W6 checkout mock-up and the live website's own look, with copies of the live styles, fonts and icons, and real sarees, codes, prices and photos from the live data of 16 Oct. Plan and decisions: [`docs/modules/web-05-my-orders.md`](../../../modules/web-05-my-orders.md).

**Cancelling is not in it:** it is parked for a later discussion (7.10). Each order says "Need to cancel or change something? WhatsApp us" until then.

## Open it
```bash
cd docs/design/ui-mockup
python3 -m http.server 8765 --bind 127.0.0.1
# then http://127.0.0.1:8765/web-7-my-orders/   (start page)
```

| Page | What |
|---|---|
| `index.html` | Start page: every screen, the decisions 7.1 to 7.10, what the old website got wrong, facts, what planning found, real / sample / parked |
| `site.html` | The website mock-up: `#/account`, `#/account/orders` (or `#/orders` with 7.1 B), `#/order/<number>`, plus the W6 bag and checkout; states with `?state=` |
| `kit.html` | The parts: status badges, order cards (A), compact rows (B), shop bill (7.5 B), progress line, tracking card, notes on one order, buttons, the phone notification, icons |
| `preview.html` | Any screen on a phone, a tablet, a laptop, or phone and laptop together |

The **Design options** panel (bottom left) switches the look (A is the live website) and decisions 7.1 to 7.5, 7.7 and 7.9, lists the current screen's states, and has **Copy my choices**.

## Files
| File | What |
|---|---|
| `assets/site/*.css`, `assets/fonts/`, `assets/icons.js` | The live website's styles, fonts and icons, copied unchanged |
| `assets/bag.css`, `assets/checkout.css` | The W5 bag and W6 checkout parts (as in their mock-ups) |
| `assets/orders.css` | The new My orders parts; the A parts become the website's when W7 is built |
| `assets/opts.js` | The Design options panel (W7 choices) |
| `assets/site.js` | The screens: the W6 mock-up plus My account, My orders and the order page's W7 states |
| `assets/data.js`, `img/` | 12 real sarees (from the W5 mock-up's `build/build-data.py`) |
| `build/check.cjs` | Real-browser check (Playwright) |

## Real, sample, parked
- **Real:** the sarees, codes, prices, photos; the shop's address, phone, WhatsApp; the website's look.
- **Sample:** the customer "Priya Sharma", her 7 orders (one from the old website, one still waiting for payment), dates, invoice numbers, DTDC tracking numbers, the shop bill (7.5 B) and the phone notification.
- **Owner to confirm:** "packed within 2 working days, delivered in 3 to 7 days".
- **Parked:** cancelling (7.10), returns, live courier status, SMS.

## Check it
```bash
cd docs/design/ui-mockup        # with the http.server above running
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-7-my-orders/build/check.cjs
# Safari's engine:
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules NH_ENGINE=webkit \
  WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NH_ROUNDS=390-light,1440-dark node web-7-my-orders/build/check.cjs
```

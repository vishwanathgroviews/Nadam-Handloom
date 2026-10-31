# W6 checkout and payment mock-up

A clickable mock-up of website module W6 (checkout and Razorpay payment), made on 16–17 Oct 2026 for the owner's picks. It is built on the W5 bag mock-up and the live website's own look, with copies of the live styles, fonts and icons, and real sarees, codes, prices and photos from the live data of 16 Oct. Plan and decisions: [`docs/modules/web-04-checkout.md`](../../../modules/web-04-checkout.md).

## Open it
```bash
cd docs/design/ui-mockup
python3 -m http.server 8765 --bind 127.0.0.1
# then http://127.0.0.1:8765/web-6-checkout/   (start page)
```

| Page | What |
|---|---|
| `index.html` | Start page: every screen, the 15 decisions, what the old checkout got wrong, facts, what's needed before going live, real / sample / planned |
| `site.html` | The website mock-up: `#/bag`, `#/checkout`, `#/sign-in?next=checkout`, `#/order/<number>`, `#/shipping`, `#/refunds`, `#/contact`; states with `?state=` |
| `kit.html` | The checkout's parts: steps, progress bar, addresses (A/B/C), review lines, summary with GST (CGST + SGST or IGST), hold line, buttons, every ending, Razorpay's window (stand-in), confirmation (A/B), policy draft note, icons |
| `preview.html` | Any screen on a phone, a tablet, a laptop, or phone and laptop together |

The **Design options** panel (bottom left) switches the look (A is the live website) and decisions 6.1 to 6.7, lists the current screen's states, and has **Copy my choices**.

## Files
| File | What |
|---|---|
| `assets/site/*.css`, `assets/fonts/`, `assets/icons.js` | The live website's styles, fonts and icons, copied unchanged |
| `assets/bag.css` | The W5 bag parts (as in the W5 mock-up) |
| `assets/checkout.css` | The new checkout parts; the A parts become the website's when W6 is built |
| `assets/opts.js` | The Design options panel (W6 choices) |
| `assets/site.js` | The screens: the W5 bag mock-up plus checkout, Razorpay's window (stand-in), the order page, the policy pages |
| `assets/data.js`, `img/` | 12 real sarees (from the W5 mock-up's `build/build-data.py`) |
| `build/check.cjs` | Real-browser check (Playwright) |

## Real, sample, stand-in, draft
- **Real:** the sarees, codes, prices, photos; the shop's address, phone, WhatsApp, GSTIN; the website's look.
- **Sample:** the customer "Priya Sharma", her addresses (one from the old website with a broken state), order numbers, every payment ending.
- **Stand-in:** Razorpay's payment window. The real one is Razorpay's own (in the shop's colour); the yellow box in the stand-in only chooses what happens next.
- **Draft for the owner:** the Shipping and Cancellation and refunds pages, and the delivery times ("Owner to confirm").
- **Planned:** My orders, tracking, the invoice download (W7).

## Check it
```bash
cd docs/design/ui-mockup        # with the http.server above running
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-6-checkout/build/check.cjs
# Safari's engine:
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules NH_ENGINE=webkit \
  WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NH_ROUNDS=390-light,1440-dark node web-6-checkout/build/check.cjs
```

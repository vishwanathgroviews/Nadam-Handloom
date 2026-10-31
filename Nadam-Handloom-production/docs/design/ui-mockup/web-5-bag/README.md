# W5 bag mock-up

A clickable mock-up of website module W5, the bag (cart), made on 16 Oct 2026 for the owner's picks. It is built in the live website's own look, using copies of the live styles, fonts and icons, and shows real sarees, codes, prices, stock and photos from the live data of 16 Oct. Plan and decisions: [`docs/modules/web-03-cart.md`](../../../modules/web-03-cart.md).

## Open it
```bash
cd docs/design/ui-mockup
python3 -m http.server 8765 --bind 127.0.0.1
# then http://127.0.0.1:8765/web-5-bag/   (start page)
```

| Page | What |
|---|---|
| `index.html` | Start page: every screen by customer type, the decisions, facts, content fixes, and what is real, sample or planned |
| `site.html` | The website mock-up (hash pages: `#/shop`, `#/product/<slug>`, `#/bag`, `#/sign-in`, `#/checkout`; states with `?state=`) |
| `kit.html` | Design kit: colours, type, buttons, quantity controls, header bag, bag lines in every state, summary, messages, toasts, badges, fields, table, loading, empty, icons |
| `preview.html` | Any screen on a phone, a tablet, a laptop, or phone and laptop together |

The **Design options** panel (bottom left on every page) switches the look (A is the live website) and the owner's decisions 5.1 to 5.8, lists the current screen's states, and has **Copy my choices**. Choices are remembered in this browser.

## Files
| File | What |
|---|---|
| `assets/site/*.css` | The live website's styles, **copied unchanged** from `Nadam-frontend/customer-web/src/theme/` |
| `assets/bag.css` | The new bag parts. This becomes the website's bag styles when W5 is built |
| `assets/mock.css` | Mock-up only: other palettes and fonts, the panel, start, kit and preview pages |
| `assets/opts.js` | The Design options panel |
| `assets/site.js` | The screens, the bag in this browser, and a stand-in for the server's bag check |
| `assets/data.js`, `img/` | Made by `build/build-data.py` |
| `build/build-data.py` | Reads sarees from the server's website API (default a local server on the 16 Oct live copy, port 4300), downloads their photos, copies the live styles, fonts, icons and logo |
| `build/check.cjs` | Real-browser check (Playwright) |

## What is real and what is a sample
- **Real:** 12 sarees (7 single pieces, 4 sets of 3 to 5, 1 sold out) with their names, codes, prices, stock and photos; the shop's address, hours, phone and GSTIN; the website's look.
- **Sample:** the customer "Priya Sharma" and her account's bag; every "something changed" state (sold at the store, fewer left, new price, off the website), each marked "Sample".
- **Not working here:** WhatsApp doesn't open (a preview shows the message), search, filters.
- **Planned:** checkout and payment (W6), My orders (W7).

## Check it
```bash
cd docs/design/ui-mockup        # with the http.server above running
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-5-bag/build/check.cjs
# Safari's engine:
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules NH_ENGINE=webkit \
  WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NH_ROUNDS=390-light,1440-dark node web-5-bag/build/check.cjs
```
Covers every screen and state at 1440 and 390 wide, light and dark, plus these flows: add a single piece and a set, the side panel, Escape, changing pieces, remove and Undo, the WhatsApp message, clearing the bag, signing in (bags joined), signing out, two tabs, every lettered option, and the panel. It also checks for page errors, sideways scrolling, unnamed buttons, pictures without alt text, and one heading per page. Screenshots go to `NH_SHOTS` (default `out/`, which is not committed).

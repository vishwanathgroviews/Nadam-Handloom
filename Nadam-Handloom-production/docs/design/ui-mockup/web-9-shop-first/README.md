# Products first: a typical online shop (mock-up)

The client (25 Oct 2026) pictures the website like most shopping sites: when it opens, the sarees are right there. This mock-up is that design, end to end, in the shop's own colours, with real sarees from the live website. **The website's code is not changed.** It sits beside the categories-first mock-up (`../web-8-home-categories/`), which keeps today's design and only replaces the carousel.

## Open it
```bash
cd docs/design/ui-mockup
python3 -m http.server 8765 --bind 127.0.0.1
# then http://127.0.0.1:8765/web-9-shop-first/   (start page)
```

| Page | What |
|---|---|
| `index.html` | Start page: the three home layouts, every screen grouped by visitor and customer, the choices, real and sample, content fixes for the shop |
| `site.html` | The shop (hash routes, see below) |
| `kit.html` | Colours, type, buttons, fields, chips, badges, messages, the saree card, placeholders, order card, progress, empty states, icons |
| `preview.html` | Any screen on a phone, a tablet, a laptop, or phone and laptop together |

Screens (`site.html#…`): `/` home · `/all` · `/c/<category>` · `/collection/<id>` · `/new` · `/sets` · `/search?q=` · `/p/<saree>` · `/bag` · `/signin` (mobile, code, name) · `/checkout` (address, review and pay, the payment window) · `/order/<no>` · `/orders` · `/orders/<no>`. Filters and sorting live in the address (`cat`, `craft`, `price`, `col`, `sets`, `sort`, `page`), so Back works. States: `?state=loading|error|soldout|empty|payfail`.

## Choices (Design options, bottom left; A is recommended)
| | A | B | C |
|---|---|---|---|
| 1. What opens first | The sarees straight away: round category photos, filters, grid | One banner, categories, rows of sarees | Category tabs over the grid |
| 2. Saree card | Photo, price, code, Add to bag | Minimal, + on the photo | Detailed: Only 1 left, WhatsApp |
| 3. Filters on a laptop | On the left | Drop-downs across the top | |
| 4. Search | Bar in the header | Icon | |
| 5. Saree page | Photo and details side by side | Bigger photo | |
| Look | Wine and gold (live), Bodoni + Figtree (live), soft corners | Classic red and gold, Figtree only, crisp corners | Modern teal, the phone's own font |

Theme Auto / Light / Dark and Motion are there too. **Copy my choices** copies the picks as text.

## Files
| File | What |
|---|---|
| `assets/ecom.css` | The design: one set of colour tokens (light and dark, three palettes), every part, phone layouts |
| `assets/app.js` | The shop: routes, listing with filters, facet counts and sort, saree page, bag, sign in, checkout, orders |
| `assets/data.js`, `img/p/`, `img/c/` | Live data and photos (WebP, 600 px), made by `build/fetch.py` |
| `assets/icons.js`, `assets/fonts/`, `img/site/`, `img/logo-*` | The live website's icons, fonts and photos |
| `assets/opts.js`, `assets/mock.css` | Mock-up only: the options panel, strip, start, kit and preview pages |
| `build/fetch.py` | Fetches the live data (read only): categories, crafts, collections with counts, up to 3 sarees per collection with their saree pages |
| `build/check.cjs` | Real-browser check (Playwright); `SHOTS=1` also makes the start page pictures |

## Rebuild and check
```bash
cd docs/design/ui-mockup/web-9-shop-first && python3 build/fetch.py && cd ..
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-9-shop-first/build/check.cjs
NH_ENGINE=webkit WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-9-shop-first/build/check.cjs
```
25 Oct 2026: 224 / 224 in Chrome's engine and in Safari's: home A at 1440, 390 light and dark, 820; B and C at 1440 and 390; filters, facet counts, sort, pages, Show more, search with suggestions and nothing found, menus; the saree page (set, pieces, photo, delivery check); bag (pieces, remove, Undo); sign in (wrong number, wrong code, right code), checkout (saved addresses), pay, order placed, My orders, a shipped order; a new customer (name, new address with the pincode filling the city, a failed payment); every option and state; every screen in "Go to screen"; reduce motion; start, kit and preview pages; no sideways scrolling, one main heading, names and labels, no page errors.

## Real, sample, planned
- **Real:** 226 sarees (up to 3 of the newest per collection, of 1,713 live) with photos, codes, prices and stock; the categories, collections, crafts, price bands and their live counts; the shop's address and hours; the new number +91 73823 88565 (waiting to go live).
- **Sample:** Priya Sharma (98765 43210) and her addresses and orders, DTDC numbers, the SMS code 123456, the pincode check, the payment window (a stand-in for Razorpay's own). Any other 10-digit number is a new customer.
- **Owner to confirm:** packing and delivery times, the return rule.
- **Not included:** wishlist, reviews and ratings, discounts.
- **Content for the shop:** names repeat inside a collection (e.g. 70 sarees named "50/50 Digital Print Sarees" or "50/50 Digital print"); colour, fabric and occasion are empty (no colour filter possible); one photo per saree; category photos and two collection photos (see the categories-first mock-up).

# The website, as the client wants it (mock-up)

25 Oct 2026. The client picked the "products first" home page (option A of `../web-9-shop-first/`) and the flow categories → collections → sarees. This mock-up is that, end to end, with every real category, collection and saree. **The website's code is not changed.**

- **Home:** the picked design: search in the header, all **6 categories** as round photos (the two without sarees on the website yet say "Coming soon"), the crafts, **Latest collections** (the collections with the newest sarees), then every saree with filters, sort and Add to bag.
- **A category:** a slim banner, then all of its collections (subcategories) as photos with pieces and price. A category without sarees says "Coming soon" with WhatsApp.
- **A collection:** all of its sarees: Sets only, sort, grid size, Load more.
- Then the saree page, bag, sign in, checkout, order placed and My orders, as in the picked design.

The earlier version (the home page in the website's current look) is kept on the Desktop: `~/Desktop/Nandam mock-up - categories, collections, sarees (25 Oct)` (opens by double-clicking `index.html`).

## Open it
```bash
cd docs/design/ui-mockup
python3 -m http.server 8765 --bind 127.0.0.1
# then http://127.0.0.1:8765/web-10-category-pages/   (start page)
```
The saree photos load from the shop's media (S3), as on the live website: it needs the internet.

| Page | What |
|---|---|
| `index.html` | Start page: the three steps with pictures, every screen, the choices, the 6 categories and their collections, notes for the shop |
| `site.html` | The website (`#/` · `#/c/<category>` · `#/collection/<id>` · `#/p/<saree>` · `#/bag` · `#/signin` · `#/checkout` · `#/orders` …) |
| `kit.html` | The parts in their states |
| `preview.html` | Phone, tablet, laptop, or phone and laptop together |

## Choices (Design options, bottom left; A recommended)
| | A | B |
|---|---|---|
| Home page | Option A, as picked (fixed) | |
| 1. A category page | Its collections only, as photos | Its collections, then all its sarees |
| 2. The category's banner | Slim | Big |
| 3. A collection's photo | Name on the photo | Name under the photo |
| 4. Order of the collections | Most pieces first | A to Z |
| 5. On a collection page | As shown | The other collections as chips on top |
| 6. The saree page | Photo and details side by side | A bigger photo |
| Look | Wine & gold, Bodoni + Figtree, soft corners (picked) | Red & gold · Figtree only · crisp (C: teal, the phone's font) |

## The 6 categories (25 Oct)
| Category | On the website | Collections |
|---|---|---|
| Mangalagiri Handloom Pattu Sarees | 1,532 pieces | 62 |
| Handloom Pattu Dress Material | 145 | 8 |
| Pattu Lehanga Sets | 51 | 5 |
| Handloom Cotton Saree | 2 | 1 (the admin app has 11; 10 are empty) |
| Handloom Cotton Dress Material | coming soon | the admin app has 6; the only stock is the test pieces TEST02, TEST05 (₹200) |
| Fabrics | coming soon | the admin app has "Test1" with a ₹10 test piece |

Read from the live database on 25 Oct (read only, `build/admin-categories.json`; a temporary SSH rule was added for this Mac and removed straight after).

## Photos chosen
Pattu sarees and pattu dress materials: the website's own photos; lehanga sets: a real set; cotton sarees: its real saree NH-HCS-002; cotton dress materials and fabrics: their admin app photos (banner for cotton dress materials: the website's photo of folded sarees). Collections use their own photos except Kalamkari Lehanga Sets (a keyboard → NH-PLS-022) and Plain Cotton Saree (→ NH-HCS-002).

## Files
| File | What |
|---|---|
| `assets/app.js` | The website: home (A), category page, collection page, latest collections, listing with filters, saree page, bag, sign in, checkout, orders |
| `assets/ecom.css` | The picked design (one set of colour tokens, light and dark), plus collection tiles, banner, collection page |
| `assets/data.js`, `img/c/` | 6 categories, 76 collections (photos, words), every saree (1,730), made by `build/fetch.py` |
| `assets/icons.js`, `assets/fonts/`, `img/site/`, `img/logo-*` | The live website's icons, fonts and photos |
| `assets/opts.js`, `assets/mock.css` | Mock-up only: the options panel, strip, start, kit and preview pages |
| `build/fetch.py`, `build/admin-categories.json` | The live data (public API) and the admin app's category list |
| `build/check.cjs` | Real-browser check; `SHOTS=1` makes the start page pictures |

## Rebuild and check
```bash
(cd docs/design/ui-mockup/web-10-category-pages && python3 build/fetch.py)
cd docs/design/ui-mockup
SHOTS=1 NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-10-category-pages/build/check.cjs
NH_ENGINE=webkit WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-10-category-pages/build/check.cjs
```
25 Oct 2026: 229 / 229 in Chrome's engine and in Safari's: the three steps at 1440, 390 light and dark, 820 (6 categories, 2 coming soon, menu bar, latest collections newest first, every saree, photos loading, all collections of a category, collections per row, Load more, Sets only, grid size, breadcrumb, Back); filters, sort, pages, phone sheets, search, menus; buying (set, bag, sign in, checkout, pay, My orders); all 6 categories and all 76 collections (1,730 sarees, counts as on the website); every choice, look and state; every screen in "Go to screen"; reduce motion; start, kit and preview pages; no sideways scrolling, one main heading, names, labels, no page errors.

## For the shop
Delete the test pieces (TEST02, TEST05, Test1) and add real ones to cotton dress materials and fabrics; fix the two collection photos; add upright category photos (900 × 1200 or more); rename "Plain Cotton Saree" (it holds printed sarees); tidy spellings ("Embroidry", "kalankari", "bramini"); a name with the colour on each saree and the colour filled in.

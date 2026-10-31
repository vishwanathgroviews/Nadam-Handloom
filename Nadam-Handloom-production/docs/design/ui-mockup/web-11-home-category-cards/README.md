# Home page: the 6 categories as cards (mock-up)

27 Oct 2026. The client asked for a **Shop by category** section at the very top of the home page: all **6 categories as cards, 3 in a row, 2 rows**, each card **only the photo and the category's name** (the photo the same tall 3:4 shape as the saree cards); tapping it opens the category's page with its subcategories. Only the top of the home page is new. Everything under it, and every other page, is the live website's design (web-10, live since 26 Oct). **The website's code is not changed.**

- **A card:** the photo and the name, nothing else (no button, price or labels; client, 27 Oct). The whole card is the link. The two without sarees yet open their "coming soon" page.
- **Order:** the categories with sarees first (most pieces first), then the two coming soon.
- **Under the cards:** the crafts as small round photos (choice 3), then **Latest collections**, then every saree with filters and sort, as live.
- **Phones:** 2 in a row, 3 rows, like the sarees. Tablets: 3 in a row.

## Open it
```bash
cd docs/design/ui-mockup
python3 -m http.server 8765 --bind 127.0.0.1
# then http://127.0.0.1:8765/web-11-home-category-cards/   (start page)
```
The saree photos load from the shop's photo store (S3), as on the live website, so it needs the internet.

| Page | What |
|---|---|
| `index.html` | Start page: the new cards (3 or 6 in a row) and the earlier style, with pictures, the choices, every screen, the 6 cards, notes for the shop |
| `site.html` | The website (`#/` is the new home; `?catcard=b`, `?catcols=b`, `?catphoto=b` open the other choices; `?state=loading` / `?state=error`) |
| `kit.html` | The category card in both styles, and its loading placeholder |
| `preview.html` | Phone, tablet, laptop, or phone and laptop together |

## Choices (Design options, bottom left)
| | A | B |
|---|---|---|
| 1. The category cards | A tall photo like the saree cards, the name under it (the client's request) | A wide photo, the name on it (the first mock-up) |
| 2. On laptops | 3 in a row, 2 rows (as asked): big photos, the first row fills the screen | 6 in a row: the saree cards' size, all 6 on the first screen |
| 3. Under the cards | The crafts as small round photos | Nothing (the crafts stay in the filters and menus) |
| 4. The card photos | The photo set in the admin app (what the website will show) | The category's newest saree (how a good tall photo looks) |
| Look | The live website's (wine & gold, Bodoni + Figtree, soft corners) | Other colours, fonts, crisp corners |

## The 6 cards (live, 27 Oct)
| Card | On the website | Collections | Admin app photo |
|---|---|---|---|
| Pattu sarees | 1,499 pieces | 61 | a tall poster with writing (640 × 960) |
| Pattu dress materials | 321 | 17 | small (400 × 225) |
| Lehanga sets | 51 | 5 | small (400 × 225) |
| Cotton sarees | 2 | 1 | a test picture (a gift card, 522 × 397, saved 27 Oct 11:56) |
| Cotton dress materials | Coming soon | | small (400 × 225) |
| Fabrics | Coming soon | | 960 × 540 |

Every card shows the category's photo from the admin app (More → Catalogue → the category → Edit → Photo), as the real website will (changed in its code on 27 Oct; not live yet). Without one, the server uses the newest collection's photo, then the website's own.

## For the shop
- Cotton dress materials and Fabrics show "Coming soon": their only stock is test pieces. Add real pieces and the cards fill in by themselves.
- Cotton sarees has only 2 pieces, so its card looks thin next to Pattu sarees.
- New photos are needed in the admin app, **upright like a saree photo (3:4)**, since the cards are now tall: Cotton sarees has a test picture (a gift card) that also shows on the live website; Pattu sarees' is a poster with writing; three are small and wide (400 × 225), so the tall card shows only their middle.
- The admin app crops category photos wide (4:3) today. For these cards it should take them like a saree photo (3:4, with the frame on the camera).

## Checked
`build/check-home.cjs`, in Chrome and Safari's engine: **251 / 251** each. It covers laptop (1440, light and dark), tablet (820) and phone (390, light and dark), with both card styles and both laptop layouts. It checks:
- 6 cards, 3 in a row (6 with choice 2 B; 2 on phones), the rows, the 2 "Coming soon";
- the photo is the same 3:4 shape as the saree cards, and every photo loads;
- each card is only the photo and the name (no button, price or label), and the whole card is the link;
- the order of the cards; the photo and the name open the category page with its subcategories; a category without sarees opens its coming-soon page;
- photos A are the admin app's, photos B the newest sarees (the 2 coming soon keep the admin photo);
- the crafts row (on and off), the latest collections and every saree still follow;
- one main heading, no sideways scrolling, no page errors;
- the loading and couldn't-load states, the start page and its pictures, the kit and the preview;
- the 4 choices are in Design options.

```bash
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-11-home-category-cards/build/check-home.cjs
SHOTS=1 …        # also remakes img/look-*.jpg
NH_ENGINE=webkit WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh …
```
The rest of the journey (saree page, bag, checkout, orders) is web-10's, checked by `../web-10-category-pages/build/check.cjs`.

## Files
| File | What |
|---|---|
| `assets/app.js` | The website. New: `categoryCard` (A uses the saree card's photo and name styles), `newestOf` (for photos B), `categoryCards`, `craftStrip`, and the home page (`homeA`) with the cards on top |
| `assets/opts.js` | Design options, with the 4 new choices (`catcard`, `catcols`, `crafts`, `catphoto`); saved under `w11mock.opts.v1` |
| `assets/ecom.css` | The live design, plus the category cards and the smaller crafts row (at the end) |
| `assets/data.js`, `img/c/` | 6 categories, 84 collections, every saree (1,873), made by `build/fetch.py` from the live website on 27 Oct |
| `img/look-*` | The start page pictures |

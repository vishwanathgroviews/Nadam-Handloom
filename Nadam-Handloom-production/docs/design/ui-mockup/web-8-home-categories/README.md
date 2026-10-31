# Home page without the carousel (mock-up)

The client (23 Oct 2026): remove the big sliding photos at the top of the website's home page and show the categories straight away. This mock-up shows the home page that way in three layouts, for the owner's picks. **The website's code is not changed.**

It is built from the live website itself (captured on 23 Oct 2026): the live styles, fonts, icons, header, top bar, footer, menu and every home section under the new top part are copies; the categories, collections, crafts, counts and photos are the live data. Only the top part is new.

## Open it
```bash
cd docs/design/ui-mockup
python3 -m http.server 8765 --bind 127.0.0.1
# then http://127.0.0.1:8765/web-8-home-categories/   (start page)
```

| Page | What |
|---|---|
| `index.html` | Start page: before (the live home page) and after (A, B, C), the choices, the real numbers, photo fixes for the shop |
| `site.html` | The home page. `?top=a|b|c`, `?state=loading|error` |
| `kit.html` | The new parts in every state, with the live colours, type and icons |
| `preview.html` | Phone, tablet, laptop, or phone and laptop together |

The **Design options** panel (bottom left): theme, motion, and the choices below, with **Copy my choices**.

| Choice | A (recommended) | B | C |
|---|---|---|---|
| 1. Top of the home page | Four category tiles + craft chips | Round photos (categories, then crafts) + the 8 largest collections | Each category with a row of its collections |
| 2. The logo entrance (first visit) | Removed: categories show at once | Kept as today | |
| 3. Right after the categories | As today: our story, then New this week | New this week first | |

In every layout the header is solid (no photo behind it any more) and the old "Woven for every occasion" four-tile block goes (the new top part replaces it).

## Files
| File | What |
|---|---|
| `assets/live.css`, `assets/fonts/`, `assets/icons.js` | The live website's styles, fonts and icons |
| `assets/captured.js` | The live home page's parts (built from `build/captured.json`) |
| `assets/data.js`, `img/s3/`, `img/site/` | Live categories, collections, crafts and photos |
| `assets/home-cats.css` | **The new top part (A, B, C)**: the CSS that becomes the website's once a layout is picked |
| `assets/home.js` | Draws the page: the new top part, then the live sections, with the live site's scroll behaviour |
| `assets/opts.js`, `assets/mock.css` | Mock-up only: the options panel, the mock-up strip, start, kit and preview pages |
| `build/capture.cjs` | Captures the live home page and data (read only) |
| `build/build.py` | Builds `assets/live.css`, `captured.js`, `data.js` and the photos from the capture |
| `build/before.cjs` | The "before" pictures of the live home page |
| `build/check.cjs` | Real-browser check (Playwright); `SHOTS=1` also makes the "after" pictures |

## Rebuild and check
```bash
cd docs/design/ui-mockup
NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-8-home-categories/build/capture.cjs
python3 web-8-home-categories/build/build.py
# with the http.server above running:
SHOTS=1 NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-8-home-categories/build/check.cjs
NH_ENGINE=webkit WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-8-home-categories/build/check.cjs
```
23 Oct 2026: 252 / 252 in Chrome's engine and in Safari's (A, B, C at 1440 light, 390 light and dark, 820 dark; states; options; menu; entrance; reduce motion; start, kit and preview pages; no sideways scrolling; no page errors).

## Real, sample, for the shop
- **Real:** everything on the page, from the live website on 23 Oct 2026.
- **Not live yet:** the shop's number shows as the new +91 73823 88565 (calls and WhatsApp); that change is ready and waiting for the go.
- **Photos for the shop to fix:** the category photos (pattu: a text poster; dress materials and lehanga sets: 400 × 225), so the tiles use the website's own photos and a lehanga collection photo; "Kalamkari Lehanga Sets" collection photo is a laptop keyboard; "Plain Cotton Saree" photo looks like a printed pattu saree; Handloom cotton sarees has 2 pieces (keep or hide: owner's call).

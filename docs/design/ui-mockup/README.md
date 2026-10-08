# Customer website mock-up

A clickable HTML mock-up of the whole Nandam Handlooms customer website, built from the live
catalogue on 2026-10-08. It is a design review tool, separate from the real app in
`frontend/customer-web/`. Nothing here is served to customers.

## Open it

- Locally: serve this folder and open `index.html`. For example
  `python3 -m http.server 8765` inside `docs/design/ui-mockup/`, then
  http://127.0.0.1:8765/ . Opening the file directly also works for everything except the
  device preview page.
- Start at `#/start`, which lists every screen. The **Design options** panel at the bottom left
  switches theme, palette, fonts, corners, layouts, motion and screen states, and copies your
  choices as text.

## What is real and what is sample

- Real: every saree, photograph, collection name, price and spec line (from the public catalogue
  API, 660 sarees, 23 collections with stock, 138 sarees shown with their photos); the shop
  address, phone, hours and map link.
- Sample: the customer Priya Sharma, her addresses, the three orders, AWB and invoice numbers,
  the OTP code 123456, the stand-in payment window. Anything marked *Sample* or *Planned* on a
  screen is not live data.
- Not on the live site today: wishlist, delivery and returns text, policy pages, the order
  timeline, the colour filter.

Sign-in, bag, wishlist, addresses and orders in the mock are kept in the browser's local
storage only.

## Files

- `index.html` – the page shell; everything renders into `<main>` by hash route.
- `assets/mock.css` – all styles. Colours are tokens on `:root`; palettes, dark mode, fonts,
  corners and layouts are switched by `data-*` attributes on `<html>`.
- `assets/app-core.js` – utilities, icons, options, storage, shell, router, overlays.
- `assets/app-home.js`, `app-shop.js`, `app-auth.js`, `app-orders.js` – the screens.
- `assets/app-mock.js` – start page, design kit, device preview, options panel, events, boot.
- `assets/data.js` – generated catalogue data. Do not edit by hand.
- `img/` – generated photos: `p/` sarees, `c/` collections, `site/` the shop's own pictures.
- `build/build-data.cjs` – rebuilds `assets/data.js` and `img/` from `products-raw.json`,
  `collections-raw.json` and the S3 photo backup. Run from `frontend/customer-web` with
  `NODE_PATH=./node_modules node ../../docs/design/ui-mockup/build/build-data.cjs`.
- `build/assemble.py` – builds `dist/artifact.html`, the single-file version published on
  claude.ai.

# Docs

## Old system snapshot (`current-system/`)
What the old admin app does today, read from its code on 2026-10-10. Each file lists the screens, the business rules, the edge cases already handled, the bugs and gaps observed, and the API endpoints used.

| File | Covers |
|---|---|
| [admin-app-1-login-team-settings.md](current-system/admin-app-1-login-team-settings.md) | Roles, sign-in (OTP, MPIN), sessions, team, profile, app settings, audit log, push notifications |
| [admin-app-2-catalog.md](current-system/admin-app-2-catalog.md) | Categories, subcategories, prices, products, photos, barcodes on products, catalog PDF |
| [admin-app-3-selling-orders-invoices.md](current-system/admin-app-3-selling-orders-invoices.md) | Scan to sell, price check, bills, GST, invoices, orders and shipping, dashboard, analytics |

## Rebuild plan and module decisions
Added as each module is planned and built.

| Module | Plan and decisions | Clickable mock-up | Status |
|---|---|---|---|
| 1 · Sign in | [module-01-sign-in.md](modules/module-01-sign-in.md) | [module-1-sign-in/](design/ui-mockup/module-1-sign-in/index.html) | Built; tested on a real Android phone (iPhone, tablet and real-phone fingerprint parked) |
| 2 · Roles and team | [module-02-roles-and-team.md](modules/module-02-roles-and-team.md) | [module-2-team/](design/ui-mockup/module-2-team/index.html) | Built; tested on a real Android phone (2026-10-11) |
| 3 · Categories and subcategories | [module-03-categories.md](modules/module-03-categories.md) | [module-3-categories/](design/ui-mockup/module-3-categories/index.html) | Built; tested on a real Android phone (2026-10-11) |
| 4 · Products and barcodes | [module-04-products.md](modules/module-04-products.md) | [module-4-products/](design/ui-mockup/module-4-products/index.html) | Built; tested on a real Android phone (2026-10-11) |
| 5 · Scan to sell | [module-05-scan-to-sell.md](modules/module-05-scan-to-sell.md) | [module-5-scan-to-sell/](design/ui-mockup/module-5-scan-to-sell/index.html) | Built; tested on a real Android phone (2026-10-11) |
| 6 · Invoices and the sales summary | [module-06-invoices.md](modules/module-06-invoices.md) | [module-6-invoices/](design/ui-mockup/module-6-invoices/index.html) | Built; tested on a real Android phone (2026-10-11) |
| 7 · Orders and shipping | [module-07-orders.md](modules/module-07-orders.md) | [module-7-orders/](design/ui-mockup/module-7-orders/index.html) | Built; tested on a real Android phone (2026-10-12) |
| 8 · Home | [module-08-home.md](modules/module-08-home.md) | [module-8-home/](design/ui-mockup/module-8-home/index.html) | Built; tested on a real Android phone (2026-10-12) |
| 9 · Analytics | [module-09-analytics.md](modules/module-09-analytics.md) | [module-9-analytics/](design/ui-mockup/module-9-analytics/index.html) | Built; tested on a real Android phone (2026-10-12) |
| 10 · Activity log | [module-10-activity.md](modules/module-10-activity.md) | [module-10-activity/](design/ui-mockup/module-10-activity/index.html) | Built; tested on a real Android phone (2026-10-12) |
| 11 · Settings | [module-11-settings.md](modules/module-11-settings.md) | [module-11-settings/](design/ui-mockup/module-11-settings/index.html) | Built; tested on a real Android phone (2026-10-12) |

## Customer website (from scratch, started 2026-10-15)
Same method as the admin app. Plan and module list: [web-00-website-plan.md](modules/web-00-website-plan.md). Code: `Nadam-frontend/customer-web/`. **Design mock-up (3 looks, every screen, live data):** [web-0-design/](design/ui-mockup/web-0-design/index.html).

| Module | Plan and decisions | Clickable mock-up | Status |
|---|---|---|---|
| W1 · Customer sign-in and account | [web-01-sign-in.md](modules/web-01-sign-in.md) | [web-0-design/](design/ui-mockup/web-0-design/index.html) | **Live 2026-10-16** |
| W2 · Site frame and Home | [web-02-home-and-shop.md](modules/web-02-home-and-shop.md) | [web-0-design/](design/ui-mockup/web-0-design/index.html) | **Live 2026-10-16** |
| W3 · Shop: categories and listings | [web-02-home-and-shop.md](modules/web-02-home-and-shop.md) | [web-0-design/](design/ui-mockup/web-0-design/index.html) | **Live 2026-10-16** |
| W4 · Product page | [web-02-home-and-shop.md](modules/web-02-home-and-shop.md) | [web-0-design/](design/ui-mockup/web-0-design/index.html) | **Live 2026-10-16** (lean: order on WhatsApp) |
| W5 · Cart | (to come) | (to come) | Not started |
| W6 · Checkout and payment | (to come) | (to come) | Not started |
| W7 · My orders | (to come) | (to come) | Not started |
| W8 · Go-live | (to come) | (to come) | Not started |

## Lists in the API: 20 at a time (owner's decision, 2026-10-12)
Every API that returns a list sends **20 at a time**: ask with `?offset=0`, then with the `nextOffset` each answer gives, until it is `null` (the Activity log follows its `next` mark instead). `total` says how many there are in all; counts and ₹ totals in the same answer always cover everything. Asking for more than 20 is refused. In the app, the next 20 load as you scroll (with "Show more" as a backup); searches run on the server so they cover everything. Reordering categories or subcategories loads every page first.

| List | API |
|---|---|
| Products (also a search) | `GET /products` |
| Orders | `GET /orders` |
| Invoices | `GET /invoices` |
| Activity log | `GET /activity` (`next` mark) |
| Team | `GET /team` |
| My devices | `GET /me/devices` |
| Categories | `GET /catalog/categories` |
| Designs in a category | `GET /catalog/categories/:id` |
| Design search | `GET /catalog/subcategories` |
| Today's sales | `GET /sales/today` |
| Sales without an invoice | `GET /invoices/without` |
| Unpaid website checkouts | `GET /orders/unpaid` |
| People in the Activity filter | `GET /activity/people` |

The other 19 GET APIs return one item, a summary or a file, so they have no pages. Tests: `Nadam-backend/tests/api/pagination.test.js`, `admin-app/src/hooks/usePaged.test.js`.

Open a mock-up with `python3 -m http.server 8791` in `design/ui-mockup/`, then `http://127.0.0.1:8791/`.

Checks left for the full-app test and the store field test: [testing/full-app-test-list.md](testing/full-app-test-list.md).

For a single overview of everything (modules, decisions, servers, builds, open items), read [`../Nandham-scratch-KT.md`](../Nandham-scratch-KT.md) first.

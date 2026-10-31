# Nandam Handlooms: production rebuild

A from-scratch rebuild of the Nandam Handlooms admin app, backend API and customer website. The old code in the rest of this repo stays untouched and is used only as a reference.

**Start here:** [`Nandham-scratch-KT.md`](Nandham-scratch-KT.md) is the knowledge-transfer document for the whole scratch build: every module, decision, how it runs and what is open.

| Folder | What goes here |
|---|---|
| `Nadam-backend/` | Node + Express API, MVC layout (models, controllers, routes, middlewares, `server.js`), on the same live PostgreSQL database |
| `Nadam-frontend/` | `admin-app/` (phone and tablet, Android and iOS; live) and `customer-web/` (the new customer website: module W1, sign-in and My account, live on nandamhandlooms.com since 2026-10-16 in place of the old site) |
| `docs/` | The master plan, one decision record per module, and the snapshot of the old system |

## Ground rules (decided 2026-10-10)
- The new system works on the **same live database** as the old one: products, orders, customers. The new models must stay compatible with the existing tables.
- Features stay the same as today. Optimisations are agreed module by module.
- The admin app is built first, end to end. The customer website follows.
- Each module is built in this order: backend, tests, app screens, end-to-end test, decision record. The owner reviews it before the next module starts.

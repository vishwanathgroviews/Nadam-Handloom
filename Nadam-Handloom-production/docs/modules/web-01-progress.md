# W1 build progress (customer sign-in and account)

The owner asked on 15 Oct 2026 for phases 0 to 8 to be done end to end while away. Details: [web-01-sign-in.md](web-01-sign-in.md), section 14.

| Phase | What | Status |
|---|---|---|
| 0 | Backups of the code and the local database | Done 15 Oct |
| 1 | Database: one additive update, pincode list loaded, old tests still pass | Done 15 Oct |
| 2 | Server foundation: settings, keys, customer guard, limits, SMS (MSG91 slot), errors | Done 15 Oct |
| 3 | Server APIs under `/api/v2/shop` | Done 15 Oct |
| 4 | Server tests: 411 / 411 | Done 15 Oct |
| 5 | Website foundation (React + Vite, design C, Auto/Light/Dark) | Done 15 Oct |
| 6 | Website screens (sign in, My account, notifications) | Done 15 Oct |
| 7 | Every API and error connected | Done 15 Oct |
| 8 | Testing: website 28 / 28, Chrome 245 / 245, WebKit 122 / 122, Firebase dry run | Done 15 Oct |
| 9 | Live on `nandamhandlooms.com` (old website kept aside): backups, database update, server, website, nginx, outside checks | **Done 16 Oct, ~01:50 IST** · real-phone checks: owner |

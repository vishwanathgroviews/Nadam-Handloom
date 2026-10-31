# Nadam-backend: Nandam Handlooms API v2

Node + Express 5, MVC, Prisma 7 on PostgreSQL. It serves the new admin app, and later the website. It runs on the **same database** as the old backend, and every schema change is additive.

Module 1 (Sign in) is built. Its plan, decisions and rules are in [`../docs/modules/module-01-sign-in.md`](../docs/modules/module-01-sign-in.md).

## Run it locally
```
cp .env.example .env            # fill in DATABASE_URL and two JWT secrets
npm install
npx prisma generate
npm run db:migrate              # applies migrations to DATABASE_URL (a local copy!)
npm run db:seed:dev             # sample test accounts 90000 00001..4 (local databases only)
npm run dev                     # http://localhost:4100/api/v2/health
npm test                        # 64 tests against a fresh copy (nandam_test)
```

## Layout (MVC)
```
server.js                 starts the server, the clean-up job and graceful shutdown
src/app.js                Express app: helmet, JSON, request context, routes, errors
src/config/               env.js (settings check), constants.js (every sign-in rule), database.js
src/models/               data access, one file per table (AuthAccount, Session, TrustedDevice, OtpCode, ...)
src/services/             business rules: auth, session, code (SMS), lock, pin, token, device, biometric, me, audit, sms/
src/controllers/          read the checked request, call a service, send the reply
src/routes/               /api/v2/auth/*, /api/v2/me/*, /api/v2/health
src/middlewares/          authenticate, validate, rateLimit, requestContext, errorHandler
src/validators/           request shapes (zod)
src/utils/                errors, crypto, phone, pin rules, presenters
src/jobs/                 clean-up every 15 minutes
prisma/                   schema.prisma, migrations (20 shared with the old backend + v2), dev-seed.js
tests/                    unit/ and api/ (Vitest + Supertest)
```

## API (all under `/api/v2`)
| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Database and SMS status |
| POST | `/auth/setup/request-code` | Setup code (same reply for every number) |
| POST | `/auth/setup/verify-code` | Returns `set_pin` or `already_set_up` with a step token |
| POST | `/auth/forgot/request-code` | Forgot-PIN code (same reply for every number) |
| POST | `/auth/forgot/verify-code` | Returns a reset step token |
| POST | `/auth/pin/set` | Sets the PIN (setup, reset or 4-digit upgrade) and signs in |
| POST | `/auth/login` | Mobile + PIN + device. Returns `signed_in`, `verify_device` or `upgrade_pin` |
| POST | `/auth/device/request-code` | New-phone check: sends the code |
| POST | `/auth/device/verify-code` | New-phone check: trusts the phone, signs in |
| POST | `/auth/biometric/challenge` | Face ID / fingerprint: one-time challenge |
| POST | `/auth/biometric/login` | Face ID / fingerprint: signed challenge, signs in |
| POST | `/auth/refresh` | Renews the sign-in (rotation, theft detection) |
| POST | `/auth/logout` | Ends this session |
| GET | `/me` | The person, this device, the sign-in expiry |
| GET | `/me/devices` | Trusted devices |
| DELETE | `/me/devices/:id` | Signs one device out (it needs an SMS check again) |
| POST | `/me/devices/sign-out-others` | Signs out every other device, old-app sign-ins included |
| POST | `/me/pin/verify` | Change PIN step 1 (wrong tries count toward the lock) |
| POST | `/me/pin/change` | Change PIN step 2 |
| POST / DELETE | `/me/biometric` | Turns Face ID / fingerprint on or off for this device |

Errors are always `{ error: { code, message, details } }`. The app switches on `code`.

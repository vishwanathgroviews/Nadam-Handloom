# Second check: Module 2, My account

Date: 26 Oct 2026. Report checked: [`../02-my-account.md`](../02-my-account.md).
I only read code (server, website, schema, tests, deployment notes). I did not run, test or change anything, and I did not open `.env`.
All `path:line` references start from the project folder (`Nadam-Handloom-production/`).

Live facts used: everything in this code is live on nandamhandlooms.com since 26 Oct ~13:55 IST; the live server sends **real SMS through Message Central** (`docs/deployment/live-v2-server.md:13`), which matters for M1.

## Summary

| Finding | One-line title | Original group | Verdict | Right group |
|---|---|---|---|---|
| M1 | "Change mobile" skips the daily SMS cap: unlimited paid SMS | Must | ✅ Correct | Must |
| S1 | New profile pincode not in the list can't be saved if city/state stay the same | Should | ✅ Correct | Should |
| S2 | A still-signed-in browser can take the account by changing the mobile | Should | ✅ Correct | Should |
| S3 | Signing out one device leaves its order notifications on | Should | ✅ Correct | Should |
| S4 | Delete page says orders are kept "without your contact details"; they are not | Should | ✅ Correct | Should |
| Sm1 | Profile form can undo a change made on another device | Small | ✅ Correct | Small |
| Sm2 | Any unused email can be put on an account without proof | Small | ✅ Correct | Small |
| Sm3 | A signed-in person can test if an email or mobile belongs to a customer | Small | ✅ Correct | Small |
| Sm4 | "Request deletion" / "Keep my account" can show an error though they worked | Small | ✅ Correct | Small |
| Sm5 | A new address can be saved twice after a 20-second timeout | Small | ✅ Correct | Small |
| Sm6 | Deleting the default quietly makes the most recently changed one default | Small | ✅ Correct | Small |
| Sm7 | Two uploads at once leave one unused photo in storage | Small | ✅ Correct | Small |
| Sm8 | Photo upload server error shows no reference | Small | ✅ Correct | Small |
| Sm9 | "Too many requests" on the code step doesn't say how long to wait | Small | ⚠️ Partly correct | Small (barely) |
| Sm10 | Dates between midnight and 5:30 am IST | Small | ✅ Correct | Small |
| Sm11 | IPs, browser details and the delete reason stay after deletion | Small | ✅ Correct | Small |
| Sm12 | Clean-up takes 50 due deletions in no fixed order | Small | ✅ Correct | Small |
| X1 | (Dev note) Address form: server error on `label`/`isDefault`/`id` would show nothing | Note | ✅ Correct | Note |
| X2 | (Dev note) `deleteCustomer` reads the profile without a row lock | Note | ✅ Correct | Note |
| X3 | (Dev note) "Last active" = last automatic renewal | Note | ✅ Correct | Note |
| X4 | (Dev note) `deleteRequestBody` `.catch({})` ignores a bad body | Note | ✅ Correct | Note |
| X5 | (Dev note) `Button` not `disabled` while loading; keyboard still works | Note | ✅ Correct | Note |
| X6 | (Dev note) Address and device calls always filter by owner | Note | ✅ Correct | Note |

**Counts: ✅ 22 · ⚠️ 1 · ❌ 0** (17 problems + 6 developer notes = 23 checked).

The developer table in section 8 repeats M1 to Sm12 with technical notes; I checked those notes too, and they match the code.

---

## M1. "Change mobile" can be used to send unlimited paid SMS: ✅ Correct (Must)

Why: the daily SMS cap only applies when no account id is passed, and change of mobile always passes one. Change-of-mobile codes are also left out of the daily count itself. There is no per-account limit: only per number, per network and per IP.

Evidence:
- `Nadam-backend/src/services/shop/code.service.js:57`: `if (!accountId && (await Code.countNewNumbersSince(...)) >= limits.dailyTotal)`: the cap is skipped when `accountId` is set.
- `Nadam-backend/src/services/shop/profile.service.js:145`: `codes.sendCode({ mobile, purpose: SHOP_CODE_PURPOSE.CHANGE_MOBILE, accountId: account.id, ip: ctx.ip })`: always sets it.
- `Nadam-backend/src/models/phoneCode.model.js:30`: `countNewNumbersSince` counts only rows with `authAccountId: null`, so change-mobile codes (which store the account id, `code.service.js:71`) never add to the daily total either.
- Remaining limits: 5 an hour per number (`code.service.js:46`), 20 an hour per IPv6 /64 or 60 per IPv4 address (`code.service.js:51-52`, `constants.js:60-61`), 60 a minute per exact IP on the route (`routes/shop/index.js:67`, `middlewares/rateLimit.js:12-15`). Nothing per account.
- `profile.service.js:137-140`: the target only has to be a number with no account, so any random 6–9 number works.
- Live: `docs/deployment/live-v2-server.md:13` says production sends real SMS through Message Central, so each code costs money.

Group: Must is right: direct money loss and possible block of the shop's SMS account. The attacker needs one account plus many IPv4 addresses or IPv6 /64 blocks (rented proxies). The report already says it could not check Message Central's own caps.

## S1. A new profile pincode not in the list can't be saved if city and state stay the same: ✅ Correct (Should)

Why: the Profile page sends only the fields that changed. With only `pincode` in the request, the server sets city and state to empty for a new pincode, and an unknown pincode with empty city/state is refused.

Evidence:
- `Nadam-frontend/customer-web/src/pages/account/ProfilePage.jsx:117-123`: only `now[k] !== base[k]` fields go in `patch`.
- `Nadam-frontend/customer-web/src/components/PlaceFields.jsx:32-38`: for an unknown pincode the lookup only shows a hint; city and state stay as saved, so they are not "changed".
- `Nadam-backend/src/services/shop/profile.service.js:41-46`: `city: patch.city ?? (newPin ? null : profile.city)` (same for state).
- `Nadam-backend/src/services/shop/place.service.js:16-17`: unknown pincode and `!city || !state` → `PINCODE_NOT_FOUND`.
- The parenthetical is also right: a known new pincode fills the district (`PlaceFields.jsx:30`); if the customer types the old city back, it equals `base.city`, is not sent, and the server saves the district (`profile.service.js:45`, `place.service.js:15`).

Small detail: the report says "the only way out is to pick a wrong state". Picking a wrong state alone still fails (city is still not sent, so it becomes empty). The customer must change **both** city and state in one save, then put them back in a second save. So the customer is even more stuck than written. Finding stands.

## S2. A still-signed-in browser can take the account by changing the mobile: ✅ Correct (Should)

Why: changing the mobile needs only a code sent to the **new** number. The current number is not asked, not told, and no other sign-in is ended.

Evidence:
- `Nadam-backend/src/services/shop/profile.service.js:142-148`: `requestMobileChange` checks staff, same number and "free", then sends the code to the new number only.
- `profile.service.js:150-160`: `verifyMobileChange` updates `phone` and writes an audit line; no `revokeAllFor`, no SMS to the old number.
- `Nadam-backend/src/services/shop/auth.service.js:65-80` and `:111-112`: the real owner signing in with the old number finds no account → "Complete your profile" → a new account. Their email is still on the taken account, so sign-up also says `EMAIL_TAKEN` (`auth.service.js:107-108`) until they use another email.
- The person who took it can also press "Sign out of all devices" (`session.service.js:198-207`) to end the real owner's other sign-ins.

Group: Should is right: real takeover, but it needs access to a browser that is already signed in.

## S3. Signing out one device leaves that browser's order notifications on: ✅ Correct (Should)

Why: "Sign out" on one device from the list only ends the session row. The push token stays linked to the account with the `orders` topic, so order messages keep going there.

Evidence:
- `Nadam-backend/src/services/shop/session.service.js:238-245`: `signOutSession` only calls `Sessions.revokeIfActive` and writes the audit line.
- Compare `session.service.js:203-204`: `logoutAll` unlinks every push token and drops `orders`.
- `Nadam-backend/prisma/schema.prisma:883-901`: `PushToken` has no session link, so the server can't tell which token belongs to the removed browser.
- `Nadam-backend/src/services/shop/push.service.js:108`: order messages go to every active token of the account with that topic. `orderNotices.service.js:12-13`: the "shipped" message includes order number, carrier and tracking number.
- The removed browser doesn't fix it itself: on a remote sign-out the website only ends the session (`customer-web/src/auth/session.js:156-160`), and a later visit while signed out keeps the link (`push.service.js:38-44`).

## S4. The Delete page promises orders are kept "without your contact details", but they are kept with them: ✅ Correct (Should)

Why: account deletion never touches the copy of name, mobile and address stored on each order, nor the name and mobile on each invoice.

Evidence:
- `Nadam-frontend/customer-web/src/pages/account/DeletePage.jsx:46`: "Orders and GST invoices stay with the shop for tax records, without your contact details."
- `Nadam-backend/src/services/shop/account.service.js:56-78`: clears account, profile, addresses, bag, sessions, push tokens, codes; no `order` or `invoice` update.
- `Nadam-backend/src/services/shop/checkout.service.js:51-54` and `:307`: each order stores `shippingAddress` with `fullName`, `phone`, `line1`, `line2`, `landmark`, `city`, `state`, `pincode`.
- `Nadam-backend/prisma/schema.prisma:692-693`: `Invoice.customerName`, `customerMobile`, filled at `invoice.service.js:68-69`. No code anywhere clears them (searched all of `src`).

## Sm1. The Profile form can quietly undo a change made on another device: ✅ Correct (Small)

Why: the form values are set once when the page opens; `base` (what the form compares with) follows the store, which the account menu refreshes on every tab change and whenever the window comes back. A field changed elsewhere then differs from the stale form value and is sent back.

Evidence: `ProfilePage.jsx:91-92` (`useMemo(... [customer])` vs `useState(base)` with no re-sync); `ProfilePage.jsx:119-122` (sends every field where `now[k] !== base[k]`); `AccountLayout.jsx:67-73` (fresh `me()` on tab change and on `visibilitychange`).

## Sm2. Any unused email can be put on an account without proving it is yours: ✅ Correct (Small)

Evidence: `profile.service.js:31-37` only checks the email is free, then saves it with `emailVerifiedAt = null`; there is no email proof anywhere. Sign-up needs an email (`validators/shop/auth.validators.js:11`) and refuses one on another account (`auth.service.js:107-108`). So the real owner of that email can't use it for sign-up.

## Sm3. A signed-in person can test whether an email or mobile belongs to a customer: ✅ Correct (Small)

Evidence: `profile.service.js:32-33` (`EMAIL_TAKEN`), `:137-140` (`MOBILE_TAKEN`, thrown before any SMS, so the SMS limits don't apply); `routes/shop/index.js:64`: `PATCH /me` has no `rateLimit`; `mobile/code` has only the 60-a-minute per-IP limit (`:67`).

Small detail: "Sign-in itself is careful not to tell" is true for mobiles (same reply for every number, `auth.service.js:29-38`), but the sign-up step does tell for emails (`auth.service.js:107-108`), after one SMS code. Finding stands.

## Sm4. "Request deletion" and "Keep my account" can show an error even though they worked: ✅ Correct (Small)

Evidence: `DeletePage.jsx:29-34`: `await shopApi.requestDeletion(...)` then `await shopApi.me()` in the same `try`; if only `me()` fails, the catch shows the error. Same in `AccountLayout.jsx:33-38` for `cancelDeletion` then `me()`. Pressing again is safe: both server calls return the existing state (`account.service.js:23`, `:33-38`).

## Sm5. A new address can be saved twice on a slow connection: ✅ Correct (Small)

Evidence: `api/client.js:10` (`TIMEOUT_MS = 20000`) and `:65` (timeout → `TIMEOUT` error); `AddressForm.jsx:59-65` shows the error and keeps the form; a second Save calls `addAddress` again. `address.service.js:34-43` creates a new row every time; nothing detects a copy.

## Sm6. Deleting the default address quietly makes another one default: ✅ Correct (Small)

Evidence: `address.service.js:72-75` picks `Address.newest`, which is `orderBy: { updatedAt: 'desc' }` (`models/address.model.js:19-20`), even though the comment says "most recently used". Checkout never updates an address when it is used (`checkout.service.js:266` only reads it). The toast says only "Address deleted" (`AddressesPage.jsx:42`).

## Sm7. Two photo uploads at the same moment leave one unused photo in storage: ✅ Correct (Small)

Evidence: `profile.service.js:110-114`: upload first, then `oldKey = account.userProfile?.avatarKey` from the account loaded when the request arrived, then update. Two parallel requests read the same old key; the photo of the one that saves first is replaced and never deleted.

## Sm8. A server error on photo upload shows no reference number: ✅ Correct (Small)

Evidence: `ProfilePage.jsx:49`: `setError(ex.message)` only. The reference is available (`api/client.js:77-81`, `middlewares/errorHandler.js:24`) and the save alert shows it (`ProfilePage.jsx:137`, `:187`).

## Sm9. "Too many requests" on the code step does not say how long to wait: ⚠️ Partly correct (Small, barely)

What is right: the code step drops `retryAfterSeconds` (`ChangeMobile.jsx:75`: `setAlert({ text: ex.message })`), while the number step adds "Try again in N seconds" (`ChangeMobile.jsx:45`).

What is overstated: the message shown is the server's own `RATE_LIMITED` text, "Too many requests from this network. **Please wait a minute** and try again." (`middlewares/rateLimit.js:26`). The window is 60 seconds, so "a minute" is already a correct wait. Only the exact seconds are missing. The only 429 the verify step can get is this one (`code.service.js` `verifyCode` throws only 400 errors). Pure polish.

## Sm10. Dates near midnight: ✅ Correct (Small)

Evidence: `ProfilePage.jsx:20`: `today = new Date().toISOString().slice(0, 10)` is the UTC date, used as `max` for both date pickers (`:181`, `:184`); between 00:00 and 05:30 IST that is yesterday. Server age check uses UTC (`validators/shop/common.js:51-62`); website age check uses the phone's local date (`utils/validate.js:40-45`). The server's anniversary check (`common.js:64`) also refuses today's date in that window.

## Sm11. After deletion, internet addresses and browser details stay forever: ✅ Correct (Small)

Evidence: `account.service.js:74-75` only revokes sessions (rows keep `ipAddress`, `userAgent`); the clean-up only deletes `rotated`/`superseded` rows (`models/session.model.js:33-34`), not `account_deleted` or `logout` ones. Activity rows: `account.service.js:29` stores the typed reason; the only activity delete is for `source: 'staff_app'` sign-in types (`models/activity.model.js:75-76`), so website rows are never deleted.

## Sm12. The clean-up takes 50 due deletions at a time in no fixed order: ✅ Correct (Small)

Evidence: `models/customer.model.js:43-44`: `findMany({ where: { deleteRequestedAt: { lte: before } }, take: 50 })`, no `orderBy`. An account with an order on its way is skipped and keeps `deleteRequestedAt` (`account.service.js:54`), so it stays in the list every run.

---

## Developer notes (section 8, "Other technical notes")

### X1. Address form: a server error on `label`, `isDefault` or `id` would show nothing: ✅ Correct
`AddressForm.jsx:63` sets `errors` from `ex.fieldErrors`; only name, mobile, line1, line2, landmark, pincode, city, state have a visible error (`:74-90`). The "Save as" choices and the default box show none. Not reachable: `label` comes from fixed radio values, `isDefault` is a boolean, the `id` is the server's own uuid.

### X2. `deleteCustomer` reads the profile without a row lock: ✅ Correct
`account.service.js:44-46` reads `deleteRequestedAt` with a plain read inside the transaction; `cancelDeletion` (`:33-38`) writes outside it with no lock. A "Keep my account" that commits after the read but before `:63-71` is overwritten and the account is still deleted. Very unlikely window, as the report says.

### X3. "Last active" is the last automatic renewal: ✅ Correct
`session.service.js:231`: `lastActiveAt: s.createdAt`; each renewal creates a new row (`:87-89`).

### X4. `deleteRequestBody` ignores a bad body: ✅ Correct
`validators/shop/me.validators.js:24`: `z.object({ reason: ... }).catch({})`.

### X5. `Button` is not `disabled` while loading: ✅ Correct
`components/Button.jsx:8` sets only `aria-busy`/`aria-disabled`; `theme/base.css:64` blocks mouse clicks with `pointer-events: none`, so Enter/Space still work. Save on Profile and Address forms checks `busy` (`ProfilePage.jsx:107`, `AddressForm.jsx:41`, `ChangeMobile.jsx:61`). Two spots have no `busy` check (Change mobile "Send code", `ChangeMobile.jsx:51-58`; Delete "Request deletion", `DeletePage.jsx:22-38`), but a repeat is harmless there (the server answers `CODE_RESEND_WAIT`, or returns the existing deletion request). So "no harm found" holds.

### X6. Address and device calls always filter by owner: ✅ Correct
`models/address.model.js:10` (`findOwn` uses `{ id, authAccountId }`, used by update/remove/default, `address.service.js:49, 57, 68, 84`); `session.service.js:240` checks `s.authAccountId !== accountId`; `listActive` filters by account (`models/shopSession.model.js:42-45`).

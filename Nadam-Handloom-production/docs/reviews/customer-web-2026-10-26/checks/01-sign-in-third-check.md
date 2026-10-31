# Third check: Module 1, Sign in

Checked 26 Oct 2026. Read only: no code, setting or test was changed, nothing was run, no `.env` file was opened, the live server and database were not touched.
Report: [`../01-sign-in.md`](../01-sign-in.md). Second check: [`01-sign-in-check.md`](01-sign-in-check.md).
Paths: server = `Nadam-backend/`, web = `Nadam-frontend/customer-web/`.

Only the disputed findings are checked here: the 2 marked ⚠️ (Small 2, Small 11). None was marked ❌.

## Summary

| Id | Title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| Small 2 | Wrong "sign-in key expired" text when a renewal fails | When the internet is down, the renewal fails and pages show the server's "Your sign-in key expired…" text instead of "no internet". | The bug is real, but not when the internet is simply down: the page's own call fails first and shows the correct "offline" text. The wrong text appears only when the call reached the server, got a 401, and the renewal right after it failed (weak signal, 429, 5xx). | **Second** | Small |
| Small 11 | Step 3 tells anyone which emails have an account | With one code, a person can test about 60 emails a minute on step 3. Fix: limit tries per pass on `/auth/complete`. | The leak is real, but the first email that is free creates the account and ends the pass. The unlimited version is the email change in My account (`PATCH /me`, no limit), so a limit on `/complete` alone would not close it. | **Second** | Small |

**Counts:** First reviewer right 0 · Second checker right 2 · Both partly right 0 · Neither right 0.

---

## Small 2. Wrong "sign-in key expired" text when a renewal fails

### What really happens
1. A page asks for something that needs the sign-in (`request()` with `auth`). If the short key looks old, the website first tries a renewal and ignores any failure: `web/src/api/client.js:89` (`await renewer().catch(() => {})`).
2. Then the page's own call goes out (`client.js:97`). **With no internet it fails right here**: "You are offline…" (`client.js:48`, `navigator.onLine === false`) or "We couldn't reach Nandam Handlooms…" (`client.js:66`). These errors carry no 401, so they are passed on unchanged (`client.js:99`). The customer sees the correct text.
3. The wrong text only appears when the call **reached** the server and the server answered 401 `ACCESS_TOKEN_EXPIRED`:
   - "Your sign-in key expired. The website renews it automatically." (`server/src/services/shop/token.service.js:29`), or
   - "Your sign-in key was renewed. Retry with the new one." (`server/src/middlewares/authenticateCustomer.js:21`; this is the usual one, after another tab renewed, Small 5).
4. The website then renews once (`client.js:102`). If that renewal fails for any reason, `.catch(() => false)` hides the real reason, and the old 401 error is thrown (`client.js:105-106`).
5. Pages show the message as it is. Example: "Your orders didn't load. Your sign-in key expired. The website renews it automatically. Your orders are safe." (`web/src/pages/orders/MyOrdersPage.jsx:26`). Other pages show it in a toast (for example `AddressesPage.jsx:36`).
6. The customer is **not** signed out by this. `ACCESS_TOKEN_EXPIRED` is not in the "sign-in ended" list (`web/src/api/errors.js:30-33`), so the listener does nothing (`web/src/auth/session.js:156-161`). Only the words are wrong.

When the renewal fails after such a 401:
- the signal drops in the second between the two calls (this is the only case that matches the first reviewer's "internet down");
- `/auth/refresh` is refused with 429, because it shares the 60-a-minute bucket with all sign-in calls (`server/src/routes/shop/index.js:37`, `:41`; Small 12);
- `/auth/refresh` gets a 5xx, an nginx 502 page, or the 20-second timeout (`client.js:10`, `:65`);
- one more case neither of them named: the renewal itself is refused with a 401 (for example "signed out for safety", S1). Then `doRenew` ends the sign-in with the right reason (`session.js:80-83`) and a toast says so (`web/src/auth/SessionNotice.jsx:16`), but the page's own error still shows the stale "key expired" text next to it.

### Why the first reviewer went wrong
He read the `catch` at `client.js:100-106` on its own and pictured "the internet is down". He did not follow the call one step back: with no internet the page's call never gets a 401, it fails first in `send()` with the offline/network error, which goes straight out at `client.js:99`. So the bug is real, but he named the wrong trigger (the one case the code already handles well) and missed the server-side triggers (429, 5xx, timeout).

### Is the second checker right?
Yes. Every line they cite says what they say (`client.js:48`, `:66`, `:89`, `:99`), and their list of real triggers is right. The fix in the report's section 8 (when the renewal fails with something other than a 401, throw that error instead of the old 401) still fits.

### Final
When a signed-in call is told "key expired" by the server and the renewal right after it fails (weak signal, too many requests, server trouble), the page shows "Your sign-in key expired. The website renews it automatically." instead of the real reason. The customer stays signed in. **Small.**

---

## Small 11. Step 3 tells anyone which emails have an account

### What really happens
1. Step 3 (`POST /auth/complete`) looks the email up in **all** accounts, any case (`server/src/models/customer.model.js:19-20`, `findByEmail` on `authAccount`). If another account has it: `EMAIL_TAKEN` (409), "This email is already on another account…" (`server/src/services/shop/auth.service.js:17`, `:107-108`). So the answer does tell.
2. The step key lasts 15 minutes and can be used again and again until then (`server/src/services/shop/token.service.js:44-52` checks only the signature and time; `server/src/config/constants.js:62`). The only limit is 60 a minute per network, shared with all sign-in calls (`server/src/routes/shop/index.js:37`, `server/src/middlewares/rateLimit.js:12-15`).
3. **But** as soon as an email is free, that same call creates the account (or completes the older one) with that email and signs in (`auth.service.js:110-118`, `:137-143`, `:150-156`). Every later call with the same step key stops at `hasCompleteProfile` (`auth.service.js:100-105`): a repeat sign-in within 60 seconds, then `STEP_USED`. Both come **before** the email check, so nothing more is learned.
4. I looked for a way to make a free-email call fail after the check (so it would be undone and the pass could go on). There is none: every field is checked before (`server/src/validators/shop/auth.validators.js:8-17`, `server/src/validators/shop/common.js`), and the database columns have no length limit (`prisma/schema.prisma`, `AuthAccount.email`, `UserProfile` names and `signup*` fields are plain `String`).
5. So one SMS code tests emails only **until the first free one**. "About 60 a minute with one code" holds only while every email tried is already taken.
6. After that the person is signed in, and My account's email change gives the same answer: `PATCH /me` → `EMAIL_TAKEN` (`server/src/services/shop/profile.service.js:31-33`). That route has **no** limit (`server/src/routes/shop/index.js:64`, `m.patch('/', validate(...), me.updateMe)`), and there is no site-wide limit in `server/src/app.js:18-38`. A free email simply becomes theirs, and they can keep testing without end. This is already reported in Module 2 as Sm3 (`../02-my-account.md:494`).
7. A detail neither of them said: the lookup covers every account, so owner and staff emails are revealed too, not only customers'.

### Why the first reviewer went wrong
He stopped reading at the email check (`auth.service.js:107-108`) and did not follow what a free email does (`:111-113`, the account is made) and what the next call meets (`:100-105`, the pass is over). He also looked only at the sign-in module, so his fix (limit tries per pass on `/complete`) would leave the open door in My account.

### Is the second checker right?
Yes, on both points: the pass ends at the first free email, and `PATCH /me` is the unlimited version. Their line numbers hold.

### Final
The answer "This email is already on another account" lets anyone find out whether an email has an account at the shop (owner and staff included). On sign-up step 3 it works only until the first free email, which creates the account; in My account (`PATCH /me`, no limit) it works without end. Fix both places together (with Module 2 Sm3). Only the fact "has an account here" leaks, no name, order or address, so **Small**.

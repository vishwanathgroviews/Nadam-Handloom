# Second check: Module 1, Sign in

Checked 26 Oct 2026 against the code in `Nadam-Handloom-production` (read only: nothing was changed, run or opened in `.env`).
Report checked: [`../01-sign-in.md`](../01-sign-in.md).
Paths: server = `Nadam-backend/`, web = `Nadam-frontend/customer-web/`.

Remember while reading: since 26 Oct ~13:55 IST all of this code is live on nandamhandlooms.com, checkout and online payment included. So M1 (checkout spinner) can now happen to real customers.

## Summary

| Id | Finding | Report's group | Verdict | Right group |
|---|---|---|---|---|
| M1 | Page-load sign-in check fails 3 times → checkout shows a bare spinner forever | Must | ✅ | Must (borderline; see note) |
| S1 | One lost renewal answer → "for your safety" sign-out on every device | Should | ✅ | Should |
| S2 | Anyone can use up the 500-a-day SMS cap for new numbers; 503 vs 202 shows who is a customer | Should | ✅ | Should |
| S3 | Codes work 60 s while the site says SMS can take up to a minute | Should | ✅ | Should |
| S4 | iPhone Safari forgets the sign-in after ~7 days (localStorage note gates the 30-day cookie) | Should | ✅ | Should |
| S5 | An earlier code typed after "Send a new code" → "That code isn't right" and a lost try | Should | ✅ | Should |
| Small 1 | Lost answer to Verify / Create account → wrong message | Small | ✅ | Small |
| Small 2 | Renewal fails → page shows "sign-in key expired" text instead of "no internet" | Small | ⚠️ | Small |
| Small 3 | Cookies blocked → silent sign-out after ~14 min | Small | ✅ | Small |
| Small 4 | Profile draft of one person shows for the next person in the same tab | Small | ✅ | Small |
| Small 5 | Two tabs keep cancelling each other's short key | Small | ✅ | Small |
| Small 6 | A closed account comes back with its old orders and addresses | Small | ✅ | Small |
| Small 7 | "Sign out" without internet leaves the server sign-in alive | Small | ✅ | Small |
| Small 8 | "Sign out" during another tab's renewal misses the new sign-in row | Small | ✅ | Small |
| Small 9 | Autofill could fill the hidden robot box → no SMS, no error | Small | ✅ | Small |
| Small 10 | Telugu/Hindi names with ZWJ/ZWNJ refused | Small | ✅ | Small |
| Small 11 | Email check on step 3 tells which emails belong to customers | Small | ⚠️ | Small |
| Small 12 | All six sign-in APIs share 60/min per IP, renewals included | Small | ✅ | Small |
| Small 13 | Step count jumps (2 of 2, then 3 of 3) | Small | ✅ | Small |
| Small 14 | Header shows "Sign in" for a moment on every load | Small | ✅ | Small |
| Small 15 | Missing NODE_ENV + SMS_PROVIDER would show codes on screen | Small | ✅ | Small |
| D1 | Design doc says the short key carries `stamp` | Doc note | ✅ | Doc note |
| D2 | Design doc says codes last 10 minutes | Doc note | ✅ | Doc note |
| D3 | Design doc says verify answers `{ next: "profile" }` | Doc note | ✅ | Doc note |

**Counts: ✅ 22 · ⚠️ 2 · ❌ 0** (24 findings).

---

## Must fix

### M1. Checkout spinner forever when the page-load sign-in check fails: ✅ Correct (Must)
- **Why:** `bootstrap()` tries `renew()` at 0 s, +1 s and +3 s. Any non-401 failure (offline, timeout, nginx 502 HTML, 429) is thrown by `doRenew` and only sets `bootError`. After the third failure the loop ends and `status` stays `'unknown'`. The `visibilitychange` handler only renews when `status === 'signedIn'`, and nothing listens to `online` for the sign-in. The checkout page returns a bare `<div className="boot">` spinner while `auth === 'unknown'`; it has no message and no retry. Only `RequireAuth` (account pages) shows `bootError` with Try again. The header shows "Sign in" because it only shows the name when `status === 'signedIn'`.
- **Evidence:**
  - `web/src/auth/session.js:98-112`: loop `for (const delay of [0, 1000, 3000])`, `catch (err) { set({ bootError: err }); }`, then nothing.
  - `web/src/auth/session.js:85`: `throw err; // offline or server trouble`.
  - `web/src/auth/session.js:178-180`: visibility renew needs `state.status === 'signedIn'`.
  - `web/src/pages/checkout/CheckoutPage.jsx:199`: `if (auth === 'unknown' || ...) return <div className="boot" ...>`.
  - `web/src/auth/RequireAuth.jsx:16-24`: the only place with "We can't reach Nandam Handlooms" and `retryBootstrap()`.
  - `web/src/api/errors.js:39-41`: a 502/503/504 HTML page becomes `SERVER_BUSY` (status 502, not 401).
- **Small precision:** "it never asks again" is true for the checkout page. Elsewhere, any later request that needs the sign-in (`request()` with `auth`, `client.js:89`), or a 'signed-in' message from another tab, would try again. Nothing on the checkout page does that.
- **Group:** Must is fair. A reload fixes it, but the customer gets no hint to reload, and this is the checkout page, which is now live with payments.

## Should fix

### S1. One lost renewal answer → signed out on every device: ✅ Correct (Should)
- **Why:** Each `/refresh` rotates the row (`revokeIfActive(..., ROTATED)`) and sets a new cookie. If the answer never reaches the browser, it still holds the old cookie. On the next renewal the old row is found `ROTATED`. It is accepted only within `REFRESH_GRACE_SECONDS` (10). After that, `signOutForSafety` revokes every website session with `compromised: true` and answers `SIGNED_OUT_FOR_SAFETY`. The website does not retry a failed renewal by itself. `scheduleRenewal` is not set again after a failure, so the next try is usually much later than 10 s: the next signed-in request or the tab coming back. The admin app (`renewLostReply`) instead checks whether the child was ever used (`usedAt`), which the customer side doesn't track.
- **Evidence:** `server/src/services/shop/session.service.js:151-156`; `server/src/config/constants.js:66` (`REFRESH_GRACE_SECONDS: 10`); `:130-136` (`revokeAllFor(..., REUSE_DETECTED, { compromised: true })`); admin `server/src/services/session.service.js:98-123` (`renewLostReply`, `kids.some((k) => k.usedAt ...)`); `server/src/middlewares/authenticate.js:36` (admin `markUsed`); `server/src/middlewares/authenticateCustomer.js` has no `markUsed`; `web/src/api/client.js:10` (20 s timeout).
- **Group:** Should is right: likely on weak mobile networks, harmful (SMS on every device), but no money or data lost.

### S2. The 500-a-day SMS cap for new numbers can be used up; 503 vs 202 reveals customers: ✅ Correct (Should)
- **Why:** Limits are per number (1/min, 5/h), per network (60/h per IPv4, 20/h per IPv6 /64) and a daily total for numbers **without** an account. Nine IPv4 addresses, or 25 IPv6 /64 blocks (one /56 or /48 server has hundreds or thousands), are enough for 500 in an hour. The cap counts **codes**, not numbers (`countNewNumbersSince` counts rows), so only 100 numbers at 5 an hour are needed. Once the cap is reached, only no-account numbers get `SMS_PAUSED` (503), and numbers with an account still get 202, so the difference shows who is a customer. The route limit is per `req.ip` only. The trap box only stops bots that fill every field. `trust proxy` is 1, so `X-Forwarded-For` can't be faked to get more addresses.
- **Evidence:** `server/src/services/shop/code.service.js:51-60`; `server/src/models/phoneCode.model.js:30` (`count({ where: { createdAt: { gte }, authAccountId: null } })`); `server/src/services/shop/auth.service.js:35-36` (`accountId: account?.id ?? null`); `server/src/routes/shop/index.js:37`; `server/src/config/env.js:25` (default 500), `:56` (TRUST_PROXY 1); `web/src/pages/account/signin/MobileStep.jsx:81`.
- **Not checkable in code:** the ₹0.30 per SMS price.

### S3. 60-second code vs "can take up to a minute to arrive": ✅ Correct (Should)
- **Why:** With Message Central, code life = `min(600, MESSAGE_CENTRAL_CODE_TTL_SECONDS)`, and the setting defaults to 60. The website blocks the code itself 60 s after the reply (`sent.expiresAt`) and prints both sentences. After 5 codes the number waits for the hour. The to-do item exists. The 506 → fixed 60 s `CODE_RESEND_WAIT` caveat in section 8 is also in the code.
- **Evidence:** `server/src/config/env.js:36-37`; `server/src/services/sms/messagecentral.provider.js:49`, `:57`; `server/src/services/shop/code.service.js:24`; `web/src/pages/account/signin/CodeStep.jsx:38`, `:120`; `web/src/pages/account/SignInPage.jsx:53`; `docs/to-do-list.md:65`.

### S4. iPhone Safari: signed out after ~7 days instead of 30: ✅ Correct (Should)
- **Why:** The "was signed in" note is in `localStorage`. With no note, `bootstrap()` sets `signedOut` without calling `/refresh`, and `renew()` refuses too. Safari's tracking prevention clears script-written storage (localStorage) after 7 days of Safari use without a visit, but not a first-party HttpOnly cookie set by the server. The 30-day cookie is set by the server on the same site (`cookie.js`), so it survives but is never used. The promise "You stay signed in for 30 days" is on the code step's picture panel, which also shows on phones (`pages.css:37`).
- **Evidence:** `web/src/auth/session.js:28-31`, `:91`, `:98-101`; `web/src/pages/account/SignInPage.jsx:18`; `server/src/controllers/shop/cookie.js:6-18`.
- **Precision:** Safari counts "7 days of Safari use", not 7 calendar days. A site added to the Home Screen is not affected. The browser behaviour comes from WebKit's documentation, not the code.

### S5. Earlier code after a resend → "That code isn't right": ✅ Correct (Should)
- **Why:** A new send closes every open code for that number (`closeOpen`), and `verifyCode` checks only `latestOpen` (the newest). An earlier code is checked against the newest one: wrong → `WRONG_CODE` with tries left, and the try is used up. The website shows the message, clears the boxes and shakes. Nothing says "use the newest SMS".
- **Evidence:** `server/src/services/shop/code.service.js:84`, `:99`, `:110`, `:133-139`, `:26`; `server/src/models/phoneCode.model.js:54`; `web/src/pages/account/signin/CodeStep.jsx:47-50`.
- **Context:** Today a code lives 60 s and "Send a new code" unlocks after 60 s, so the earlier code would have expired anyway. The real harm now is the misleading message and the lost try. It grows when S3 lengthens codes.

## Small

### Small 1. Lost answer gives a wrong message: ✅ Correct
- Verify: the first call closes the code (`closeIfOpen`, `code.service.js:142`). The retry finds no open code and `last.attempts < 3`, so it gets `CODE_EXPIRED` (`:99-104`). The website then shows only "Get a new code" (`CodeStep.jsx:51-54`). The network error before it showed "We couldn't check the code" with Try again (`CodeStep.jsx:59-60`, `:102`).
- Create account: NETWORK/TIMEOUT falls to `setAlert` (`ProfileStep.jsx:92`) under the title "Your account wasn't created yet" (`:115`), although the server may have made it. A retry within 60 s signs in (`auth.service.js:100-105`); after that it gets `STEP_USED`.

### Small 2. "Sign-in key expired" text instead of "no internet": ⚠️ Partly correct
- **What is right:** `request()` gets a 401 `ACCESS_TOKEN_EXPIRED`, tries `renewer()`. If that fails for any non-401 reason (`.catch(() => false)`), it throws the **401 error** with the server's text, not the renewal's error (`web/src/api/client.js:100-106`). So pages show "Your sign-in key expired. The website renews it automatically." (`server/src/services/shop/token.service.js:29`) or "Your sign-in key was renewed. Retry with the new one." (`server/src/middlewares/authenticateCustomer.js:21`).
- **What is wrong:** the trigger is not "the internet is down". With no internet, the call itself fails first. `client.js:89` renews before sending, that fails quietly, and then `send()` throws `OFFLINE` (`client.js:48`) or `NETWORK` (`:66`). Those are not 401 and are thrown as they are (`:99`), so the customer sees the correct "You are offline" / "We couldn't reach" text. The wrong text appears only when the main call **reaches** the server and gets a 401, and then the renewal fails. Examples: a flaky connection between the two calls, `/refresh` refused with 429 (shared bucket, Small 12), or a 5xx, often after another tab rotated the key (Small 5).
- **Group:** Small is right.

### Small 3. Cookies blocked → silent sign-out: ✅ Correct
- Verify returns the short key in the body, so sign-in works. ~14 min later (`scheduleRenewal`, 900 − 60 s) `/refresh` has no cookie, and the server answers `NOT_SIGNED_IN` (`server/src/services/shop/session.service.js:146`). `doRenew` treats that as a visitor: `end(err.code === 'NOT_SIGNED_IN' ? null : err)`, with no message (`web/src/auth/session.js:80-83`). A reload within those minutes signs out at once the same way.

### Small 4. Another person's typed profile can appear: ✅ Correct
- The draft is saved to `sessionStorage` on every change, including the first render (`ProfileStep.jsx:37`), and is cleared only on success (`:75`). It is not tied to a number. On the next mount, `d.fullName ?? p.fullName` puts the draft first (`:24-27`). Even an empty string from the draft hides the new person's own prefill.

### Small 5. Two tabs cancel each other's short key: ✅ Correct
- A renewal rotates the row. The other tab's key then gets `ACCESS_TOKEN_EXPIRED` (`server/src/middlewares/authenticateCustomer.js:20-22`), so it renews and rotates again. A tab coming back renews only if its key looks stale locally (`session.js:179`), so the first request after a switch costs a 401 plus a renewal. On a 'signed-in' message, every other tab renews (`session.js:166`), which kills the new tab's key at once. The bag-join retry is once only (`client.js:100-103`), so the "may fail once" part is plausible. The report marks it "Not sure", which is fair.

### Small 6. Closed account reopened with old orders and addresses: ✅ Correct
- Verify gives `needs_profile` for a closed account (`hasCompleteProfile` excludes closed, `customer.model.js:13`) with an empty prefill (`auth.service.js:43`). `/complete` then reopens the **same** account id: `{ status: 'active', deletedAt: null }` (`auth.service.js:116-117`). Addresses and orders are found by `authAccountId` (`server/src/models/address.model.js:5-6`), so they come back.
- **Precision:** the website's own "Delete my account" clears the phone (`server/src/services/shop/account.service.js:59`), so only accounts closed some other way with the number kept are affected. Closed accounts still holding ADMIN/STAFF are refused instead (`auth.service.js:99`). How many exist is unknown (no database access), as the report says.

### Small 7. "Sign out" offline leaves the server sign-in alive: ✅ Correct
- `signOut` swallows the logout error and ends locally (`web/src/auth/session.js:134-143`). The row stays active and is listed by `listSessions` → `Sessions.listActive` (`server/src/services/shop/session.service.js:219-220`), where it can be signed out.

### Small 8. "Sign out" during a renewal misses the new row: ✅ Correct
- `logout` ends only the row its cookie names: `revokeIfActive(s.id, LOGOUT)` (`server/src/services/shop/session.service.js:188-190`). It does not follow `parentId` children the way `activeFrom()` does (`:210-217`).
- **Precision:** the report says "ends the old row only". In fact it ends **nothing**. The old row was already ended by the rotation, so `revokeIfActive` returns false, and no push unlink or audit follows. The new row stays alive, as the report says.

### Small 9. Autofill may fill the trap → no SMS, no error: ✅ Correct (hedged correctly)
- The trap is `<input className="trap" name="alt_contact" autoComplete="off" tabIndex={-1}>` (`MobileStep.jsx:81`), moved off screen, 1px, opacity 0 (`theme/base.css:106`). Any value gives `decoyReply()`, so nothing is sent and the answer looks normal (`server/src/services/shop/auth.service.js:30-34`). "Send a new code" calls `shopApi.sendCode(mobile)` **without** the trap (`CodeStep.jsx:70`), so that one really sends. Whether Chrome fills it can't be proven from code, and the report says "Not sure".

### Small 10. ZWJ/ZWNJ in Telugu/Hindi names refused: ✅ Correct
- The name rule allows only `\p{L}\p{M}` plus ` .'-` (`server/src/validators/shop/common.js:21`, `web/src/utils/validate.js:19`). U+200C/U+200D are format characters (Cf), so they fail. The cleaner keeps them on purpose: `INVISIBLE` removes only U+200B, U+2060 and U+FEFF (bytes checked), and the comment is at `server/src/utils/text.js:5`.

### Small 11. Email check tells which emails belong to customers: ⚠️ Partly correct
- **What is right:** `/complete` answers `EMAIL_TAKEN` (409) when another account holds the email (`server/src/services/shop/auth.service.js:107-108`), so the answer does reveal it. The only limit is the shared 60/min per IP (`routes/shop/index.js:37`).
- **What is wrong:** "with one code ... about 60 emails a minute on step 3" is overstated. The first email that is **not** taken creates the account (`:111-113`) and ends the pass. Later tries hit `hasCompleteProfile` and get the 60-second repeat sign-in or `STEP_USED` (`:100-105`), before the email check. So one code tests emails only until the first free one, and each free hit needs a new number and SMS.
- **Missed by the report:** the same check is unlimited in My account. `PATCH /me` with a new email gives `EMAIL_TAKEN` (`server/src/services/shop/profile.service.js:32-33`), and the route has no rate limit (`routes/shop/index.js`, `m.patch('/', ...)`). A free email just becomes the person's email, and they can keep going. The suggested per-pass limit on `/complete` alone would not close it (belongs to Module 2).
- **Group:** Small is right.

### Small 12. One 60/min bucket per IP for all sign-in APIs: ✅ Correct
- `a.use(rateLimit({ name: 'shop-auth' }))` covers code, verify, complete, refresh, logout and logout-all (`server/src/routes/shop/index.js:36-43`). Max is `RATE_LIMIT_PER_MINUTE` (60), and the key is `v2-ip:shop-auth:${req.ip}` (`server/src/middlewares/rateLimit.js:12-15`). Three 429s at page load lead to M1.

### Small 13. Step count jumps: ✅ Correct
- `total = step === 'mobile' ? 3 : profile || step === 'profile' ? 3 : 2` (`SignInPage.jsx:72`). The code step prints `Step 2 of {total}` = "2 of 2" (`CodeStep.jsx:92`), the profile step prints "Step 3 of 3" (`ProfileStep.jsx:98`), and the progress bar goes 3 → 2 → 3 bars (`SignInPage.jsx:89-90`).

### Small 14. Header shows "Sign in" while checking: ✅ Correct
- `status === 'signedIn' && customer ? name : "Sign in"` (`web/src/components/Header.jsx:105`). `'unknown'` falls to "Sign in".

### Small 15. Codes on screen if both settings are missing: ✅ Correct (hedged correctly)
- `NODE_ENV` defaults to `development` (`server/src/config/env.js:8`), `SMS_PROVIDER` to `console` (`:33`), and `echoCodes = console && NODE_ENV !== 'production'` (`:205`). The only guard is `production && console` (`:121-123`). Anyone could then read `devCode` from `/auth/code` (`code.service.js:88`). It is hypothetical (live settings not read), as the report says.

## Design notes vs code (section 8)

### D1. `stamp` in the short key: ✅ Correct
- `docs/modules/web-01-sign-in.md:99` lists `stamp`. `signShopAccess` signs only `{ typ, sid }` + `sub`/`aud`/`iss` (`server/src/services/shop/token.service.js:17-20`). Every request checks the row (`authenticateCustomer.js:16-28`).

### D2. "Valid 10 minutes": ✅ Correct
- `web-01-sign-in.md:57` says 10 minutes. With Message Central it is 60 s (S3), and section 14.3 of the same doc explains it.

### D3. `{ next: "profile" }`: ✅ Correct
- `web-01-sign-in.md:122` says `{ next: "profile" }`. The server answers `status: 'needs_profile'` (`server/src/services/shop/auth.service.js:75`), and the website reads `reply.status === 'signed_in'` / otherwise profile (`CodeStep.jsx:43-44`).

---

## Other small slips noticed (not findings)
- Section 3.1 "500 a day in total to numbers without an account": it is 500 **codes** (rows), not 500 numbers (`phoneCode.model.js:30`).
- Section 3.4/S1 "20-second wait": correct (`client.js:10`). Section 2 "renews every 14 minutes": correct (`session.js:38`, 900 − 60 s).

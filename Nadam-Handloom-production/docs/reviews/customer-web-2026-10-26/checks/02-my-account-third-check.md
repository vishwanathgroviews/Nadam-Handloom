# Third check: Module 2, My account

Date: 26 Oct 2026. Report: [`../02-my-account.md`](../02-my-account.md). Second check: [`02-my-account-check.md`](02-my-account-check.md).
I only read code. I did not run, test or change anything, and I did not open `.env`.
All `path:line` references start from the project folder (`Nadam-Handloom-production/`).

What I re-checked: the one ⚠️ finding (Sm9) and the second checker's two "small detail" notes on S1 and Sm3.

## Summary

| Finding | One-line title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| Sm9 | "Too many requests" on the code step | The code step doesn't say how long to wait | Only the exact seconds are missing; the message already says "Please wait a minute" | Second | Small |
| S1 (note) | Unknown new pincode can't be saved on Profile | The only way out is to pick a wrong state | Changing only the state still fails; city **and** state must both be changed in one save, then put back | Second | Should fix (unchanged) |
| Sm3 (note) | Checking if an email or mobile belongs to a customer | "Sign-in itself is careful not to tell" | True for mobiles, but the sign-up step says a typed email is taken | Second | Small (unchanged) |

Counts: Second checker right **3** · First reviewer right **0** · Both partly right **0** · Neither right **0**.

---

## Sm9. "Too many requests" on the code step: Second checker right. Final: Small

**What really happens.** The code step's "Verify" can only get one "too many" error: the network limit on the route. Both change-of-mobile calls share one counter (60 a minute per internet address). When it trips, the server sends "Too many requests from this network. Please wait a minute and try again." The website shows that text in a red box. It does not add the exact seconds, while the number step does. The real wait is never more than 60 seconds, so "a minute" is true (just sometimes longer than needed). This is very rare: it needs 60 change-of-mobile calls in one minute from one internet address.

**Why the first reviewer went wrong.** They compared the two lines in `ChangeMobile.jsx` (the number step adds "Try again in N seconds", the code step does not) and stopped there. They did not read the server's own message, which already gives the wait. Their own table in 3.5 even says this error shows "the wait time". So the code fact is right, but "does not say how long to wait" overstates it.

**Is the second checker right?** Yes, on every point: the message, the 60-second window, and that this is the only 429 the code step can get.

**Evidence**
- `Nadam-frontend/customer-web/src/pages/account/ChangeMobile.jsx:75`: code step, `else setAlert({ text: ex.message });` (no wait added).
- `Nadam-frontend/customer-web/src/pages/account/ChangeMobile.jsx:45`: number step adds `Try again in ${waitText(ex.retryAfterSeconds)}`.
- `Nadam-backend/src/middlewares/rateLimit.js:26`: message "Too many requests from this network. Please wait a minute and try again."
- `Nadam-backend/src/middlewares/rateLimit.js:25`: `retryAfterSeconds` is between 1 and `windowSeconds` (60), so the wait is never over a minute.
- `Nadam-backend/src/routes/shop/index.js:67-68`: both `mobile/code` and `mobile/verify` use `rateLimit({ name: 'shop-mobile' })`, one shared counter; `Nadam-backend/src/config/env.js:58`: default 60 a minute.
- Only 429 on this step: `Nadam-backend/src/services/shop/code.service.js:98-143` (`verifyCode` throws only 400 errors: wrong, expired, used up, already used); `Nadam-backend/src/services/sms/messagecentral.provider.js:61-69` (`verify` throws only 503); `Nadam-backend/src/services/shop/profile.service.js:150-161` (403, 400, 409 only). No nginx `limit_req` anywhere in the repo.
- Same as sign-in: the sign-in code step also shows only `ex.message` for this error (`Nadam-frontend/customer-web/src/pages/account/signin/CodeStep.jsx:60`). So the website is consistent here.

**Final.** The code step shows "Please wait a minute" but not the exact seconds; pure polish and very rare. **Small.**

---

## S1 note. The way out for an unknown pincode: Second checker right. Final: Should fix (unchanged)

**What really happens.** On Profile, only changed fields are sent. With a new pincode that is not in India Post's list, the website does not touch city or state, so they are not sent. The server then sets city and state to empty for the new pincode and refuses it. If the customer only picks a wrong state, the state is sent but the city is still not sent, so the city is still empty and it is still refused. The customer must change **both** the city (any different spelling) and the state (a wrong one) in the same save, and then fix them in a second save. Extra spaces don't count as a change, because the city is cleaned before comparing.

**Why the first reviewer went wrong.** They saw that the state is the field the customer can't "fake" (it is a list) and assumed changing it was enough. They missed that the server fills **each** of city and state on its own, so both must be sent.

**Is the second checker right?** Yes. The finding stands, and the customer is even more stuck than the report says.

**Evidence**
- `Nadam-frontend/customer-web/src/pages/account/ProfilePage.jsx:117-123`: city is `squash`ed, then only `now[k] !== base[k]` goes in the patch.
- `Nadam-frontend/customer-web/src/components/PlaceFields.jsx:30`: city and state are filled only for a known pincode; `:32-38`: unknown pincode shows a hint only.
- `Nadam-backend/src/services/shop/profile.service.js:41`, `:45-46`: `newPin`, then `city: patch.city ?? (newPin ? null : profile.city)` and the same for state, each on its own.
- `Nadam-backend/src/services/shop/place.service.js:16-17`: unknown pincode and `!city || !state` → `PINCODE_NOT_FOUND`.
- `Nadam-backend/tests/api/shop/me.test.js:47-50`: the server test expects exactly this (pincode alone refused; pincode + city + state accepted).

**Final.** A new pincode not in the list can't be saved on Profile unless the customer changes both city and state to something else and then changes them back. **Should fix** (as before).

---

## Sm3 note. "Sign-in is careful not to tell": Second checker right. Final: Small (unchanged)

**What really happens.** Asking for a sign-in code gives the same reply for every mobile, so mobiles are not revealed there. But sign-in and sign-up are one flow. After one SMS code to a number with no finished account, the "Complete your profile" step answers "This email is already on another account" for a taken email. That step's pass lasts 15 minutes and can be used again after a refusal, so one code allows many email tries (limited only by 60 calls a minute per internet address).

**Why the first reviewer went wrong.** They checked only the first step (sending the code) and did not look at the "Complete your profile" step, which is part of the same sign-in flow.

**Is the second checker right?** Yes. The main finding (Profile and Change mobile reveal taken emails and mobiles; email changes have no limit) is unchanged.

**Evidence**
- `Nadam-backend/src/services/shop/auth.service.js:29-38`: `requestCode` sends a code for every number with the same reply.
- `Nadam-backend/src/services/shop/auth.service.js:107-108`: sign-up `findByEmail` → `emailTaken()`.
- `Nadam-backend/src/services/shop/token.service.js:44-53`: the step pass is checked only for signature and expiry; it is not single-use. `Nadam-backend/src/config/constants.js:62`: `PROFILE_STEP_MINUTES: 15`.
- `Nadam-backend/src/routes/shop/index.js:37`, `:40`: `/auth/complete` is limited only by `rateLimit({ name: 'shop-auth' })`, per internet address.

**Final.** A signed-in person can learn whether an email or mobile belongs to a customer (and sign-up also reveals taken emails after one SMS code). **Small** (as before).

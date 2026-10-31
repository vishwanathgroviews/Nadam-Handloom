# Review: Module 1, Sign in (customer website)

Reviewed 26 Oct 2026. Read-only: no code was changed, nothing was run, the live server and database were not touched, no `.env` file was opened.

Main files: server `Nadam-backend/src/...`, website `Nadam-frontend/customer-web/src/...` (paths below start from these two folders).

---

## 1. What this module does

A customer types their mobile number, gets a 6-digit code by SMS, and types it in. A known customer is then signed in. A new customer fills in a short profile once (name, email, pincode). The website then keeps them signed in for 30 days on that browser, and they can sign out here or on all devices.

---

## 2. The steps a customer goes through

1. Opens "Sign in" and types a 10-digit mobile number. Presses **Send code**.
2. An SMS with a 6-digit code arrives (now it works for only 60 seconds).
3. Types the code. On Android Chrome it may fill in by itself; iPhones offer it above the keyboard.
4. **Known customer:** signed in at once, taken back to where they were (or to My account).
5. **New customer** (or an older account without the new details): sees "Complete your profile": full name, email, pincode (city and state fill in), and a tick for offers. Presses **Create my account**. Signed in.
6. While they use the site, the website quietly renews the sign-in every 14 minutes (they see nothing).
7. Next visit (within 30 days of the last visit): still signed in.
8. **Sign out** ends this browser. **Sign out of all devices** ends every browser.

Words used below:
- **Short key**: a pass the website shows the server on every request. It lasts 15 minutes and is kept only in the page's memory.
- **30-day cookie**: a small protected note in the browser (the page itself can't read it) that lets the website get a new short key.
- **Renewal**: swapping the 30-day cookie for a fresh one and getting a new short key. The old cookie stops working.

---

## 3. Each API

All addresses start with `/api/v2/shop/auth`. Every one of them is limited to **60 requests a minute from one internet address** (all six together), and is switched off when the owner turns on website maintenance.

### 3.1 `POST /code`: send the SMS code

| | |
|---|---|
| **What it is for** | Sends a 6-digit code to the mobile number. Same answer whether the number has an account or not. |
| **What goes in** | `mobile`: 10 digits starting 6, 7, 8 or 9 ("+91", spaces, dashes and a leading 0 are removed). `trap`: a hidden box people never see; if a robot fills it, nothing is sent but the reply looks normal (max 200 characters). |
| **What comes back** | "Accepted" with: wait 60 seconds before a new code, how long the code works (60 seconds now with Message Central; 10 minutes with other SMS services), code length 6. Only in test mode (never on the live site): the code itself. |
| **What is saved** | One `PhoneCode` row (number, purpose "sign in", the account if the number has one, the code's hash or Message Central's reference, expiry, network address). One `AuthEvent` "shop_code_sent" (number partly hidden). One `RateLimitHit` row. |
| **Limits** | 1 code a minute per number; 5 an hour per number; 60 an hour per IPv4 address, 20 an hour per IPv6 home/phone block; 500 a day in total to numbers **without** an account. |

What can go wrong:

| Error code | Status | Message from the server | What the customer sees |
|---|---|---|---|
| VALIDATION_FAILED | 400 | "Enter a 10-digit mobile number starting with 6, 7, 8 or 9." | Red message under the box. |
| CODE_RESEND_WAIT | 429 | "A code was sent a moment ago. You can ask for a new one in N seconds." | Goes to the code screen: "A code was sent a moment ago. Enter that code, or ask for a new one when the timer ends." |
| CODE_TOO_MANY | 429 | "Too many codes for this number. Try again in N minutes." | Yellow box "Too many codes for now" with the wait time. |
| CODE_TOO_MANY_NETWORK | 429 | "Too many codes from this network. Try again in N minutes." | Same yellow box. |
| SMS_PAUSED | 503 | "We can't send codes right now. Please try again later or message us on WhatsApp." (only new numbers, after 500 in a day) | Red box with a WhatsApp button. |
| SMS_UNAVAILABLE | 503 | "We couldn't reach / send ... Please try again in a minute." | Red box with a WhatsApp button. |
| RATE_LIMITED | 429 | "Too many requests from this network. Please wait a minute and try again." | Yellow box with the wait time. |
| MAINTENANCE | 503 | The owner's message | The maintenance page. |
| INTERNAL | 500 | "Something went wrong on our side. Please try again." + reference | Red box "The code wasn't sent", Try again, reference. |
| (no internet / too slow) | none | made by the website | Red box with the reason and Try again; the number stays typed. |

### 3.2 `POST /verify`: check the code

| | |
|---|---|
| **What it is for** | Checks the code. Known customer: signed in. New customer: allowed to fill in the profile. |
| **What goes in** | `mobile` (same rule as above), `code` (exactly 6 digits). |
| **What comes back** | **Known customer:** `signed_in`, a short key (15 minutes), when the 30-day sign-in ends, and the customer's details (id, name, first name, mobile, hidden mobile, email, picture, pincode, city, state, birthday, anniversary, language, offers tick, member since, deletion status, "managed by the shop", "can pay online"). The 30-day cookie is set. **New customer:** `needs_profile`, a profile pass (works 15 minutes), the hidden mobile, and details to pre-fill from an older account (if any). |
| **What is saved** | The code's try count goes up by one before checking; the code is closed when right. `AuthAccount.phoneVerifiedAt`. For a known customer: a new `Session` row (30 days), and older sign-ins beyond 20 browsers are ended; `UserProfile.lastSeenAt`. `AuthEvent` "shop_signed_in" or "shop_code_failed". |
| **Limits** | 3 tries per code. |

What can go wrong:

| Error code | Status | Message | What the customer sees |
|---|---|---|---|
| WRONG_CODE | 400 | "That code isn't right. 2 tries left." / "1 try left." | Message under the boxes, boxes cleared and shake. |
| CODE_USED_UP | 400 | "Too many wrong tries. Get a new code." | Message, then only a "Get a new code" button (with countdown). |
| CODE_EXPIRED | 400 | "This code has expired. Get a new code." | Same as above. Also shown by the website itself if the 60 seconds are over, without asking the server. |
| CODE_ALREADY_USED | 400 | "This code was already used. Get a new code." | Same as above. |
| SMS_UNAVAILABLE | 503 | "We couldn't check the code right now. Please try again in a minute." | Red box "We couldn't check the code" with Try again. The try is given back. |
| ACCOUNT_MANAGED_BY_SHOP | 403 | "This number belongs to a closed shop account. Please message us on WhatsApp." | Red box with WhatsApp. |
| VALIDATION_FAILED | 400 | "Enter the 6-digit code from the SMS." | Message under the boxes. |
| RATE_LIMITED / MAINTENANCE / INTERNAL | 429 / 503 / 500 | as above | Red box with Try again (maintenance page for maintenance). |

### 3.3 `POST /complete`: create the account ("Complete your profile")

| | |
|---|---|
| **What it is for** | Saves the new customer's details and signs them in. |
| **What goes in** | `stepToken`: the profile pass from step 2 (20 to 2000 characters). `fullName`: 2 to 60 letters (spaces, dots, hyphens, apostrophes allowed; Telugu and Hindi letters allowed). `email`: a valid address, at most 254 characters (saved in small letters). `pincode`: 6 digits, not starting with 0. `city`: optional, 2 to 60 characters. `state`: optional, one of the 36 states and union territories. `marketingOptIn`: yes or no (no if missing). `attribution`: optional, where the visitor first came from (source, medium, campaign up to 100 characters; referring site up to 200); a bad value is silently dropped. |
| **What comes back** | `signed_in`, `isNew: true`, short key, details (as above). The 30-day cookie is set. |
| **What is saved** | `AuthAccount`: new (mobile, email, active, phone verified), or the email updated; a closed account is opened again. `UserRole`: CUSTOMER. `UserProfile`: first and last name, display name, pincode, city, state (from the pincode list if not typed), offers tick (and when it changed), privacy accepted time, profile completed time, sign-up source / medium / campaign / referring site / device (only the first time), last seen. A new `Session`. `AuthEvent` "shop_account_created" or "shop_profile_completed". |

What can go wrong:

| Error code | Status | Message | What the customer sees |
|---|---|---|---|
| VALIDATION_FAILED | 400 | The field's message, e.g. "Enter your full name." | Red message under that box; the cursor goes there. |
| STEP_EXPIRED | 400 | "This step timed out. Please enter your mobile number again." (over 15 minutes, or the number moved to another account meanwhile) | Back to the number screen: "Please confirm your number again. That took longer than 15 minutes ... What you typed in your profile is kept." |
| STEP_USED | 400 | "You have already finished signing up. Please sign in with your mobile number." (same pass used again after 60 seconds) | Back to the number screen: "You have already signed up." |
| EMAIL_TAKEN | 409 | "This email is already on another account ... message us on WhatsApp." | Message under the email box and a WhatsApp link. |
| PINCODE_NOT_FOUND | 400 | "We couldn't find this pincode. Check it, or type your city and state." | Message under the pincode, and city/state asked for. |
| ACCOUNT_MANAGED_BY_SHOP | 403 | (as above) | Red box with WhatsApp. |
| BAD_TEXT | 400 | "Some text has a character we can't save..." | Red box "Your account wasn't created yet" with Try again. |
| RATE_LIMITED / MAINTENANCE / INTERNAL | | as above | Red box "Your account wasn't created yet" with Try again. |

A second press of "Create my account" (double tap, or a retry after a lost answer) within 60 seconds simply signs in to the same account.

### 3.4 `POST /refresh`: renew the sign-in (the website does this by itself)

| | |
|---|---|
| **What it is for** | Gives a new short key from the 30-day cookie. Every renewal also gives a new cookie and makes the old one stop working. |
| **What goes in** | No details. The 30-day cookie, the website's own header (`X-Requested-With: nandam-web`), and the browser's "came from" address must be the shop's website. |
| **What comes back** | Same as "signed in" above, plus a new cookie. |
| **What is saved** | The old `Session` row is ended ("rotated") and a new one made (30 days from now). `UserProfile.lastSeenAt` at most every 5 minutes. |

What can go wrong (on every 401 the server also deletes the cookie):

| Error code | Status | Message | What the customer sees |
|---|---|---|---|
| NOT_SIGNED_IN | 401 | "You are not signed in." | Nothing (treated as a visitor). |
| SESSION_INVALID | 401 | "Please sign in again." | Message for 8 seconds; header shows "Sign in"; account pages go to sign in. |
| SESSION_EXPIRED | 401 | "You were signed out after 30 days without a visit..." | Same. |
| SIGNED_OUT_FOR_SAFETY | 401 | "For your safety, you were signed out on every device..." (an old cookie came back more than 10 seconds after it was replaced; every website sign-in of the customer ends) | Same. |
| SIGNED_OUT_REMOTELY / SIGNED_OUT_EVERYWHERE / SESSION_ENDED / ACCOUNT_DELETED / SIGNED_OUT | 401 | one plain sentence each | Same. |
| REFRESH_RACE | 409 | "This sign-in was just renewed. Please try again." | Nothing; the website waits 0.4 seconds and tries once more. |
| ORIGIN_NOT_ALLOWED / CLIENT_HEADER_MISSING | 403 | "This request did not come from the Nandam Handlooms website." | Stays signed in; tries later. |
| RATE_LIMITED / MAINTENANCE / INTERNAL / no internet | | | Stays signed in; tries later. At page load: 3 tries, then gives up (see Must fix 1). |

### 3.5 `POST /logout`: sign out on this browser

| | |
|---|---|
| **What it is for** | Ends this browser's sign-in. |
| **What goes in** | The 30-day cookie, the website header, optional `pushToken` (this browser's notification id; a bad one is ignored). |
| **What comes back** | Nothing (204). The cookie is deleted. Always "works", even with no cookie. |
| **What is saved** | `Session` ended ("logout"). This browser's notifications stop going to the account (order updates switched off for it). `AuthEvent` "shop_signed_out". |
| **What can go wrong** | 403 (wrong site/header), 429, 503, 500. The website ignores every failure and signs out on this browser anyway (see Small 7). |

### 3.6 `POST /logout-all`: sign out of all devices

| | |
|---|---|
| **What it is for** | Ends every website sign-in of this customer at once. The admin app is not touched. |
| **What goes in** | The short key. |
| **What comes back** | Nothing (204). The cookie is deleted. |
| **What is saved** | Every active website `Session` of the customer ended ("signed_out_all"); all their browsers' notifications unlinked from the account; `AuthEvent` "shop_signed_out_all" with how many ended. |
| **What can go wrong** | The sign-in errors of 3.7, 429, 503, 500. The website shows the error on the Signed-in devices page and does **not** sign out (correct: the server must confirm). |

### 3.7 How every other signed-in request is checked

Every signed-in request carries the short key. The server checks: the key is genuine and for the website (an admin-app key is refused), the sign-in row still exists and has not ended, it is within its 30 days, the account is not closed, and the account has the CUSTOMER role and a profile. Errors: NOT_SIGNED_IN, ACCESS_TOKEN_EXPIRED (key older than 15 minutes, or renewed in another tab; the website renews and retries once), SESSION_INVALID, SESSION_EXPIRED, ACCOUNT_DELETED and the "signed out ..." codes. The website handles all of them.

---

## 4. The data kept

### AuthAccount (one per person / mobile) — `prisma/schema.prisma:9`

| Field | What it means | Must have it? |
|---|---|---|
| id | The account's number (random) | Yes (made automatically) |
| phone | Mobile, 10 digits. No two accounts can share one | No (empty after "delete my account") |
| email | Email in small letters. No two accounts can share one | No |
| status | active, pending, locked, or deleted (closed) | Yes (default active) |
| phoneVerifiedAt | When the mobile was last proven by a code | No |
| deletedAt | When the account was closed | No |
| createdAt / updatedAt | When made / last changed | Yes (automatic) |
| passwordHash, mpinHash, mpinSetAt, emailVerifiedAt, securityStamp, failedLoginAttempts, lockCount, lockedUntil, mfaEnabled, isCompromised, passwordChangedAt | Used by the admin app or the old app, not by website sign-in | defaults |

Links: one UserProfile, one AdminProfile, many roles, sign-ins, SMS codes, notification ids, events.

### UserProfile (the customer's details) — `prisma/schema.prisma:55`

| Field | What it means | Must have it? |
|---|---|---|
| authAccountId | Which account (one profile per account; deleted with it) | Yes |
| firstName, lastName | Name split in two (last name can be empty text) | Yes |
| displayName | Full name as typed | No |
| pincode, city, state | Where they live | No |
| marketingOptIn / marketingOptInAt | Wants offers; when that choice changed | Yes (default no) / No |
| privacyAcceptedAt | When they created the account after seeing why we ask | No |
| profileCompletedAt | When "Complete your profile" was finished. Without it, the next sign-in asks again | No |
| signupSource, signupMedium, signupCampaign, signupReferrer, signupDevice | Where they first came from, and phone/tablet/computer | No |
| lastSeenAt | Last visit (written at most every 5 minutes) | No |
| deleteRequestedAt | "Delete my account" pressed; details go 7 days later | No |
| avatarUrl, avatarKey, dateOfBirth, anniversary, language, preferences, deletedAt, createdAt, updatedAt | My account fields (other module) | No / automatic |

### AdminProfile — `prisma/schema.prisma:93`
Only read: an owner or staff member's first and last name is used to pre-fill their website profile.

### Role and UserRole — `prisma/schema.prisma:115`, `:136`

| Field | What it means | Must have it? |
|---|---|---|
| Role.name | ADMIN, STAFF or CUSTOMER (no two the same) | Yes |
| Role.isSystem | Built-in role | Yes (default yes) |
| UserRole.authAccountId + roleId | "This account has this role" (each pair once) | Yes |
| UserRole.assignedAt | When given | Yes (automatic) |

### Session (one row per sign-in, and one per renewal) — `prisma/schema.prisma:157`

| Field | What it means | Must have it? |
|---|---|---|
| id | The sign-in's number; it is inside the short key | Yes |
| authAccountId | Whose sign-in | Yes |
| refreshTokenHash | A scrambled copy of the 30-day cookie (the real value is never stored). Unique | Yes |
| kind | "customer" for the website, "staff" for the admin app | Yes (default staff) |
| platform | "web" | No |
| deviceName, userAgent, ipAddress | Browser name ("Chrome on Android"), its full description, internet address | No |
| startedAt | When this browser first signed in (kept across renewals) | No |
| createdAt | When this row was made (= last renewal) | Yes |
| expiresAt | 30 days after the last renewal | Yes |
| parentId | The row it replaced at renewal | No |
| revokedAt / revokeReason | When and why it ended: rotated, superseded, logout, device_signed_out, signed_out_all, reuse_detected, too_many_sessions, account_deleted | No |
| isCompromised | Set when a copied cookie was suspected | Yes (default no) |
| trustedDeviceId, stampAtIssue, usedAt | Admin app only | No |

Old rows ended by renewal are deleted after their own 30 days.

### PhoneCode (website SMS codes) — `prisma/schema.prisma:853`

| Field | What it means | Must have it? |
|---|---|---|
| mobile | The number the code went to | Yes |
| purpose | shop_sign_in or shop_change_mobile | Yes |
| authAccountId | The account of that number, if it has one | No |
| codeHash | Scrambled code, or Message Central's reference ("provider:...") | Yes |
| attempts | Tries used (max 3) | Yes (default 0) |
| usedAt | When closed: right code, replaced by a newer code, or out of tries | No |
| expiresAt | When it stops working | Yes |
| ipAddress | The sender's network | No |
| createdAt | When sent | Yes |

Deleted after 2 days.

### AuthEvent (the activity record) — `prisma/schema.prisma:205`
id, authAccountId (optional), eventType (e.g. shop_signed_in), source ("customer_web" for the website), ipAddress, userAgent, metadata (extra details, mobile partly hidden), createdAt.

### RateLimitHit (counting requests) — `prisma/schema.prisma:264`
id, bucketKey (which limit and which internet address), createdAt. Deleted after 2 hours.

### Also touched
- `Pincode` (`:873`): pincode, area, city, state. Only read, to fill in city and state.
- `PushToken` (`:883`): at sign out, this browser's notification id is unlinked from the account and stops getting order updates.

---

## 5. On the website

### Sign-in page, step 1: mobile number (`pages/account/signin/MobileStep.jsx`)
- One box with "+91" in front. Typing anything other than digits, spaces, "+" and "-" is ignored.
- **Send code** button: shows a spinner while waiting; a second tap is ignored.
- Wrong number: red message under the box before anything is sent.
- Errors: as in 3.1. Every server error has a clear message. "Code sent a moment ago" goes straight to step 2.
- Links: terms, privacy, WhatsApp help.

### Step 2: the code (`pages/account/signin/CodeStep.jsx`, `components/CodeInput.jsx`)
- Six boxes. Typing moves on; Backspace moves back; pasting fills all six; filling the sixth box checks the code at once.
- "Change number" goes back to step 1 with the number kept.
- Countdown "You can ask for a new code in N s", then **Send a new code**.
- While checking: the boxes are locked and the button spins.
- Wrong code: message with tries left, boxes cleared, shake.
- Expired, used up or already used: only **Get a new code** is offered (waits for the countdown).
- Other errors: red box with Try again, or WhatsApp for "number belongs to a closed shop account".
- Note at the bottom: "Codes can take up to a minute to arrive. Each code works for 60 seconds."
- Test mode only: the code is shown on the page. This needs the server to be in test SMS mode **and** not live; the live server refuses to start with test SMS.

### Step 3: Complete your profile (`pages/account/signin/ProfileStep.jsx`)
- Full name, email, pincode, city, state (filled in from the pincode, can be changed), offers tick (off unless ticked).
- What is typed is kept in this tab, so it survives "start again".
- Checks every box before sending, same rules as the server.
- **Create my account** spins while waiting; a second tap is ignored.
- Errors: as in 3.3, each next to its box, or a red box "Your account wasn't created yet" with Try again.

### After sign-in
- Message "Welcome back, Name" or "Account created. Welcome, Name!".
- Goes back to where they came from (only pages of this website are allowed). An account waiting to be deleted goes to My account, where "Keep my account" is.
- Other open tabs of the site sign in too. The bag kept on this browser joins the account's bag.

### Staying signed in (`auth/session.js`, `api/client.js`)
- The short key is renewed a minute before it runs out (only while the tab is on screen), and when a tab comes back to the screen.
- Only one tab renews at a time.
- If the sign-in ended (signed out elsewhere, 30 days, for safety, account deleted): a message for 8 seconds, then "Sign in" in the header. Account pages send the customer to sign in and back.
- On page load, a small note in the browser ("was signed in") decides whether to ask the server at all.

### Signing out
- **Sign out** (My account): ends here even if the server can't be reached; goes to the home page.
- **Sign out of all devices** (Signed-in devices page): asks to confirm; only ends here if the server confirms.

---

## 6. Problems found

### Must fix

**M1. If the sign-in check fails when the page opens, the checkout page shows a loading dot forever.**
- When a page opens, the website asks the server three times in about 4 seconds whether the customer is signed in. If all three fail, it never asks again, and the sign-in state stays "not known yet".
- The checkout page waits for that answer and shows only a loading dot. It has no message and no Try again button. The header also shows "Sign in", even though the customer is signed in.
- When it happens: the server restarts during an update (nginx answers "502" for a few seconds), or the phone loses signal for a moment, or the network is busy ("too many requests"). A customer who opens the site at that moment and goes to checkout is stuck until they reload the page. The account pages do show "We can't reach Nandam Handlooms" with Try again, so they are fine.
- Where: `customer-web/src/auth/session.js:98-112` (gives up after 3 tries), `customer-web/src/pages/checkout/CheckoutPage.jsx:199` (spinner while the state is not known).

> **Second check: ✅ Correct.**

### Should fix

**S1. One lost answer on a weak mobile network can sign the customer out on every device, with a "for your safety" message.**
- Every renewal replaces the 30-day cookie. If the server makes the new one but the answer never reaches the phone (signal drops, the tab is closed, or the 20-second wait runs out), the phone still holds the old cookie.
- The server accepts the old cookie again only within 10 seconds. After that it treats it as stolen: it ends every website sign-in of that customer (all phones and computers), marks them as suspected theft, and shows "For your safety, you were signed out on every device."
- Example: a customer reading a saree page in a lift; the renewal answer is lost; two minutes later they tap "Add to bag". They are thrown out everywhere and need a new SMS code on each device.
- The admin app already handles this correctly: it checks whether the replacement was ever used. If not, the answer was lost, not stolen.
- Where: `Nadam-backend/src/services/shop/session.service.js:151-156`, `Nadam-backend/src/config/constants.js:66`. The admin app's fix is in `Nadam-backend/src/services/session.service.js:98-118`.

> **Second check: ✅ Correct.**

**S2. Anyone can use up the day's 500 SMS codes for new numbers in about an hour. After that, no new customer can sign up until the next day.**
- The limits are per number and per internet address. A person with a few internet addresses (cheap on any cloud server; one IPv6 server alone can have thousands of "home blocks") can send codes to 500 random numbers. Each code costs the shop about ₹0.30.
- After that, every new customer sees "We can't send codes right now" for up to 24 hours.
- It also gives a way to tell who is a customer. Once the limit is reached, a number with an account still gets "code sent", and a number without one gets "can't send".
- The hidden robot box only stops simple robots.
- Where: `Nadam-backend/src/services/shop/code.service.js:51-60` (limits), `Nadam-backend/src/routes/shop/index.js:37` (only a per-address limit), `customer-web/src/pages/account/signin/MobileStep.jsx:81` (the robot box).

> **Second check: ✅ Correct.**

**S3. A code works for only 60 seconds, but the site itself says codes can take up to a minute to arrive.**
- This is set by Message Central's "Validity Time" (60 seconds now).
- When it goes wrong: the SMS arrives after 45 seconds, and the customer has 15 seconds to type it. The code expires, and they must wait and ask again. After 5 codes in an hour the number is blocked for the rest of the hour. Older customers and slow networks are hit most.
- This is already on the to-do list (`docs/to-do-list.md:65`).
- Before raising it, check one thing with Message Central (see section 8).
- Where: `Nadam-backend/src/config/env.js:37`, `Nadam-backend/src/services/sms/messagecentral.provider.js:49`, `customer-web/src/pages/account/signin/CodeStep.jsx:120`.

> **Second check: ✅ Correct.**

**S4. On iPhones (Safari), the website forgets the customer after about 7 days away, although the sign-in should last 30 days.**
- The website first looks at a small note it keeps in the browser ("was signed in"). If the note is missing, it does not even try the 30-day cookie.
- Safari deletes notes like this after 7 days without a visit. The protected cookie survives, but the website never uses it.
- When it happens: an iPhone customer comes back after 8 days. They see "Sign in" and must get a new SMS code (₹0.30), although step 2 told them "You stay signed in for 30 days".
- Where: `customer-web/src/auth/session.js:28-31` and `:98-101`, promise shown at `customer-web/src/pages/account/SignInPage.jsx:18`.
- Not sure how many customers use iPhones; Android Chrome is not affected.

> **Second check: ✅ Correct.**

**S5. If the customer types an earlier code after asking for a new one, they are told "That code isn't right" and lose a try.**
- Asking for a new code makes every earlier code stop working. SMS messages often arrive late or out of order, especially when codes last only 60 seconds and customers press "Send a new code".
- When it happens: the customer presses "Send a new code", the first SMS arrives, and they type it. They see "That code isn't right. 2 tries left." Nothing tells them to use the newest SMS. Three such mistakes and they must wait for yet another code.
- Where: `Nadam-backend/src/services/shop/code.service.js:84` (old codes closed), `:26` (message), `customer-web/src/pages/account/signin/CodeStep.jsx:47-50`.

> **Second check: ✅ Correct.**

### Small

1. **A lost answer gives a wrong message.**
   - If the answer to "Verify" is lost and the customer presses Try again, they see "This code has expired" although they typed it right. They then wait for a new code.
   - If the answer to "Create my account" is lost, they see "Your account wasn't created yet", although it may have been created.
   - Where: `Nadam-backend/src/services/shop/code.service.js:99-104`, `customer-web/src/pages/account/signin/ProfileStep.jsx:115`.
   > **Second check: ✅ Correct.**
2. **Misleading message when renewal fails because of the internet.** When renewal fails because the internet is down, pages show the server's text "Your sign-in key expired. The website renews it automatically." instead of "no internet". Where: `customer-web/src/api/client.js:100-106`.
   > **Second check: ⚠️ Partly correct: the code does throw the stale 401 text when the renewal fails, but not when the internet is simply down (then the call itself fails first and shows "You are offline" / "We couldn't reach", `client.js:48`, `:66`, `:99`); the wrong text appears only when the main call reaches the server and gets a 401 and then the renewal fails (flaky signal, a 429 or 5xx on `/refresh`). Small is right.**
   > **Third check: Second checker right. Final: when a signed-in call is told "key expired" by the server and the renewal right after it fails (weak signal, too many requests, server trouble), the page shows "Your sign-in key expired. The website renews it automatically." instead of the real reason, while with the internet simply down the correct "offline" text shows and the customer stays signed in either way. Final group: Small.**
3. **Cookies blocked: signed out without a word.** If the browser blocks cookies, the customer signs in and is quietly signed out 15 minutes later, with no reason given (and again on every reload). Where: `customer-web/src/auth/session.js:80-83` (a missing cookie is treated as "never signed in").
   > **Second check: ✅ Correct.**
4. **Another person's typed profile can appear.** The profile typed in step 3 is kept in the tab and is used before the account's own details. If one person stops at step 3 and another person signs up in the same tab (a shared family phone), the second person sees the first person's name and email filled in. Where: `customer-web/src/pages/account/signin/ProfileStep.jsx:24-27`.
   > **Second check: ✅ Correct.**
5. **Two open tabs keep cancelling each other's short key.** Each renewal in one tab makes the other tab's key stop working, so every switch between tabs costs an extra renewal. Not sure: with two busy tabs right after sign-in, the bag join may fail once (it retries only once). Where: `Nadam-backend/src/middlewares/authenticateCustomer.js:20-22`, `customer-web/src/auth/session.js:166`.
   > **Second check: ✅ Correct.**
6. **A closed account can be opened again with its old orders and addresses.** A number whose old account was closed in the old app (number kept) opens that old account again when someone signs up with it. The profile form is empty, but the old orders and addresses come back. If the number has since been given to a new person by the phone company, they would see the previous owner's orders and addresses. Not sure how many such accounts exist in the live database. Where: `Nadam-backend/src/services/shop/auth.service.js:116`.
   > **Second check: ✅ Correct.**
7. **"Sign out" without internet leaves the sign-in alive on the server.** If "Sign out" can't reach the server, the website says signed out, but the 30-day sign-in stays alive on the server, and the customer is not told. It still shows in "Signed-in devices", where it can be ended. Where: `customer-web/src/auth/session.js:134-143`.
   > **Second check: ✅ Correct.**
8. **Not sure: "Sign out" can miss the real sign-in during a renewal.** If "Sign out" is pressed in one tab at the same moment another tab renews, the server ends the old row only, and the new one stays alive. Where: `Nadam-backend/src/services/shop/session.service.js:188-190`.
   > **Second check: ✅ Correct.**
9. **Not sure: autofill could stop the SMS without any error.** If a browser's autofill fills the hidden robot box, no SMS is sent and no error is shown. The customer waits, and only "Send a new code" (60 seconds later) really sends one. Where: `customer-web/src/pages/account/signin/MobileStep.jsx:81`, `customer-web/src/theme/base.css:106`, `Nadam-backend/src/services/shop/auth.service.js:30-34`.
   > **Second check: ✅ Correct.**
10. **Some Telugu or Hindi names are refused.** Names typed with the invisible joining marks some Telugu or Hindi keyboards add get "Use letters only", although the input cleaner keeps those marks on purpose. Where: `Nadam-backend/src/validators/shop/common.js:21`, `customer-web/src/utils/validate.js:19`.
    > **Second check: ✅ Correct.**
11. **Someone can check which emails belong to customers.** With one code, a person can try about 60 emails a minute on step 3 and learn which ones belong to customers ("This email is already on another account"). Where: `Nadam-backend/src/services/shop/auth.service.js:107-108`.
    > **Second check: ⚠️ Partly correct: the leak is real, but one code on step 3 only tests emails until the first free one, which creates the account and ends the pass (`auth.service.js:100-105`, `:111-113`); the unlimited version is My account's email change, `PATCH /me` (`profile.service.js:32-33`, no rate limit), so a per-pass limit on `/complete` alone would not close it. Small is right.**
    > **Third check: Second checker right. Final: the answer "This email is already on another account" lets anyone learn whether an email has an account here (owner and staff too); on sign-up step 3 it works only until the first free email, which creates the account, but in My account (`PATCH /me`, no limit) it works without end, so both places need the fix (with Module 2 Sm3). Final group: Small.**
12. **All sign-in requests from one internet address share 60 a minute, renewals included.** Many customers on one mobile network share one address. As visits grow, renewals could be refused and lead to M1. Where: `Nadam-backend/src/routes/shop/index.js:37`, `Nadam-backend/src/middlewares/rateLimit.js:15`.
    > **Second check: ✅ Correct.**
13. **The step count jumps.** The code screen says "Step 2 of 2", then a new customer sees "Step 3 of 3". Where: `customer-web/src/pages/account/SignInPage.jsx:72`.
    > **Second check: ✅ Correct.**
14. **The header shows "Sign in" for a moment.** On every page load the header shows "Sign in" until the server answers, even for signed-in customers. Where: `customer-web/src/components/Header.jsx:105`.
    > **Second check: ✅ Correct.**
15. **Safety setting depends on two settings being present.** If the live server ever started without its "this is live" setting and without its SMS setting, codes would appear on screen to anyone, because the defaults are "test". Not sure: I did not open the live settings, and today the server would show a clear error only when "live" is set. Where: `Nadam-backend/src/config/env.js:8`, `:33`, `:205`.
    > **Second check: ✅ Correct.**

---

## 7. What I could not check

- **Live settings:** I did not open the live settings file (`.env`), so I could not see the real values of "live mode", the SMS service, the secure cookie, or the code life.
- **Message Central's real behaviour:**
  - what it answers after many wrong tries on its side;
  - whether it refuses a new code while an earlier one is still valid (important before raising the code life);
  - whether its SMS ends with the line Android needs to fill the code in by itself (`@nandamhandlooms.com #123456`).
- **Real browsers:** I did not test autofill of the hidden box or Safari's 7-day clean-up. Those findings rest on how these browsers are documented to behave.
- **The old server (`/api/v1`):** it still runs on the same database. Website cookies made before 16 Oct were stored in the old scrambled form until their next renewal. I did not read the old server's code, so I can't say whether it would accept such a copied cookie.
- **The live database:** I could not see how many closed accounts still hold their mobile (Small 6), or whether older accounts' saved states match the 36 names (a mismatch only means the customer has to choose the state again).
- **No running:** I did not run tests, the server, the website or any browser. Everything here comes from reading the code.

---

## 8. For the developer

Paths: server = `Nadam-backend/`, web = `Nadam-frontend/customer-web/`.

**M1**
- Problem: `web/src/auth/session.js:98-112`. After 3 failed tries, `status` stays `unknown` for good; nothing retries on `online` or `visibilitychange` (only `RequireAuth` shows `bootError`). `web/src/pages/checkout/CheckoutPage.jsx:199` shows a bare spinner for `unknown`.
- Fix: retry `bootstrap()` on `online` and when the tab becomes visible while `bootError` is set, and make CheckoutPage show the `bootError` with "Try again" (as `RequireAuth.jsx:16-24` does).

**S1**
- Problem: `server/src/services/shop/session.service.js:151-156` with `REFRESH_GRACE_SECONDS = 10` (`server/src/config/constants.js:66`). Any parent cookie reuse after 10 s means `revokeAllFor(..., REUSE_DETECTED, compromised)`.
- Fix: copy the admin side (`server/src/services/session.service.js:98-118`). Mark a customer session used on its first authenticated request (`server/src/middlewares/authenticateCustomer.js`, `Session.markUsed`). On parent reuse, if no child was used or rotated, supersede the unused child and renew, whatever the time. Raise the alarm only when the child was used.

**S2**
- Problem: `server/src/services/shop/code.service.js:51-60`. The per-network limit counts an IPv6 /64, which attackers rotate freely. The daily cap of 500 applies only to numbers without accounts, and once reached, 503 vs 202 reveals which numbers have accounts.
- Fix: add a free bot check (Cloudflare Turnstile) to `/auth/code`, verified in `auth.service.js:29`. Count IPv6 per /48 as well. Send the owner an alert at 80% of the cap. Once the cap is reached, answer 202 for new numbers too, without sending.

**S3**
- Problem: `server/src/config/env.js:37` (default 60) and `server/src/services/sms/messagecentral.provider.js:49`.
- Fix: raise Message Central "Validity Time" to 300–600 s and `MESSAGE_CENTRAL_CODE_TTL_SECONDS` to match.
- Check first: `messagecentral.provider.js:57` maps responseCode 506 (REQUEST_ALREADY_EXISTS) to CODE_RESEND_WAIT with a fixed 60 s. If Message Central refuses resends while a code is valid, customers would loop on "wait 60 s" for the whole validity time.

**S4**
- Problem: `web/src/auth/session.js:28-31`, `:91`, `:99`. The localStorage hint gates every renewal; Safari ITP wipes localStorage after 7 days without a visit.
- Fix: have the server set a second, non-HttpOnly, `Path=/` cookie (e.g. `nh_shop_in=1`, same expiry, set and cleared in `server/src/controllers/shop/cookie.js:12-18`) and use it as the hint. Server-set cookies are not under the 7-day cap.

**S5**
- Problem: `server/src/services/shop/code.service.js:84` closes earlier codes on resend. `WRONG_CODE` (`:26`) does not tell the customer.
- Fix: after a resend, say "Use the newest code (sent at hh:mm)" in `web/src/pages/account/signin/CodeStep.jsx:47-50`. Or, for msg91/console codes (we hold their hash), also accept the code it replaced for its remaining life.

**Small**
1. Lost answers:
   - `server/src/services/shop/code.service.js:99-104`: when the newest code was closed by a successful check less than a minute ago, answer CODE_ALREADY_USED ("already used; sign in again or get a new code") instead of CODE_EXPIRED.
   - `web/src/pages/account/signin/ProfileStep.jsx:115`: for NETWORK/TIMEOUT, say "We're not sure it went through. Try again."
2. `web/src/api/client.js:100-106`: when `renewer()` fails with a non-401 error, throw that error (network) instead of the ACCESS_TOKEN_EXPIRED one.
3. `web/src/auth/session.js:80-83`: if `state.status === 'signedIn'` and the refresh says NOT_SIGNED_IN, end with a message such as "Your browser didn't keep the sign-in (cookies blocked?)".
4. `web/src/pages/account/signin/ProfileStep.jsx:24-27`: store the draft with the hidden mobile (`profile.mobileMasked`), and use it only for the same number.
5. Two tabs:
   - Problem: `server/src/middlewares/authenticateCustomer.js:20-22` refuses keys of rotated rows. `web/src/auth/session.js:166` renews in every other tab on sign-in.
   - Fix: send the new short key to the other tabs over the BroadcastChannel after a renewal, instead of each tab rotating again.
6. `server/src/services/shop/auth.service.js:116`: decide with the owner whether a closed account should come back with its orders and addresses. If not, create a fresh account and free the number on the closed one.
7. `web/src/auth/session.js:134-143`: when logout fails, keep a "sign out pending" flag and retry on `online`, or tell the customer to use "Sign out of all devices".
8. `server/src/services/shop/session.service.js:188-190`: on logout, follow the chain to the active descendant (as `activeFrom()` at `:210-217` does) and end that row too.
9. Trap field:
   - Problem: `web/src/pages/account/signin/MobileStep.jsx:81`. Chrome may ignore `autocomplete="off"`.
   - Fix: rename the field to something no autofill heuristic matches, use `autocomplete="new-password"`-style values, or record `shop_bot_trap` hits and review them.
10. `server/src/validators/shop/common.js:21` and `web/src/utils/validate.js:19`: allow U+200C/U+200D inside the name rule (`server/src/utils/text.js:5` keeps them on purpose).
11. `server/src/services/shop/auth.service.js:107-108`: limit `/auth/complete` per profile pass (for example 10 tries), or per mobile per hour.
12. `server/src/routes/shop/index.js:37`: give `/refresh` its own, larger bucket, separate from `/code` and `/verify`.
13. `web/src/pages/account/SignInPage.jsx:72`: show the code step as "Step 2" without a total, or always 3.
14. `web/src/components/Header.jsx:105`: show a neutral placeholder while `status === 'unknown'`.
15. `server/src/config/env.js:205`: require an explicit `SHOP_ECHO_CODES=true` to show codes, and refuse `SMS_PROVIDER=console` when `SHOP_WEB_ORIGINS` contains an https address.

**Design note vs code (no harm found; update the doc)**
- `docs/modules/web-01-sign-in.md:99` says the short key carries `stamp`. It doesn't (`server/src/services/shop/token.service.js:18`). It is not needed, because every request checks the sign-in row.
  > **Second check: ✅ Correct.**
- `:57` says codes last 10 minutes. With Message Central it is 60 seconds (explained in 14.3).
  > **Second check: ✅ Correct.**
- `:122` says verify answers `{ next: "profile" }`. The built answer is `status: "needs_profile"`, and the website matches the built one.
  > **Second check: ✅ Correct.**

**Checked and fine**
- Admin and website keys can't cross: different secrets and audiences (`token.service.js:17-31`), and `Session.kind` is filtered on both sides.
- The cookie is HttpOnly, SameSite=Lax, Secure in production, limited to `/api/v2/shop/auth`, and stored only as a prefixed SHA-256.
- Renewal and logout need the website header and an allowed Origin (`shopGuard.js:38-43`). Cross-site sign-in is blocked by the JSON body plus CORS.
- A try is counted before the code is checked, and two right answers can't both win (`code.service.js:110-142`).
- The "Create account" double tap is handled by the per-mobile lock and the 60-second repeat window.
- Open redirect after sign-in is blocked (`web/src/utils/validate.js:65-69`).
- Every error code the server sends in this module is handled on the website with a readable message.
- Test-mode codes can't be shown on a server started in production mode (`env.js:121-123`, `:205`).

---

## Second check (26 Oct 2026)

Every finding was checked against the code (24 in all: M1, S1–S5, Small 1–15, and the 3 design notes in section 8).

- ✅ Correct: **22**
- ⚠️ Partly correct: **2** (Small 2, Small 11)
- ❌ Wrong: **0**

All severity groups are right. Details and evidence: [`checks/01-sign-in-check.md`](checks/01-sign-in-check.md).

---

## Third check (26 Oct 2026)

The 2 disputed findings (Small 2, Small 11) were checked a third time against the code.

- Second checker right: **2** (Small 2, Small 11)
- First reviewer right: **0**
- Both partly right: **0**
- Neither right: **0**

Both stay **Small**. Details and evidence: [`checks/01-sign-in-third-check.md`](checks/01-sign-in-third-check.md).

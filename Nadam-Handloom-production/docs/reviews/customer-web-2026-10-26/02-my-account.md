# Review: Module 2 — My account (customer website)

Date: 26 Oct 2026. I only read the code in `Nadam-Handloom-production`. I did not run, test or change anything.
All `path:line` references start from the project folder (`Nadam-Handloom-production/`).

---

## 1. What this module does

"My account" is where a signed-in customer looks after their own details: name, email, photo, birthday, language, mobile number, delivery addresses, the browsers they are signed in on, and asking to delete the account.
It also includes the pincode look-up that fills in the city and state on forms.

---

## 2. The steps a customer goes through

1. The customer signs in (Module 1). If they had asked to delete the account, the website takes them straight to My account so they see the "Keep my account" bar.
2. **Overview**: a welcome card (photo, name, mobile, email, city), "Your profile is N% complete", their latest order, and links to orders, addresses and notifications.
3. **Profile**: add, change or remove the photo. Change name, email, pincode (city and state fill in by themselves), language, date of birth, anniversary. Press "Save changes".
4. **Change mobile**: press "Change" next to the mobile number, type the new number, get an SMS code on the new number, type the code. The number changes.
5. **Addresses**: add up to 10, edit, delete, and choose the default one (used first at checkout).
6. **Signed-in devices**: see every browser they are signed in on. Sign one out, or sign out everywhere.
7. **Delete account**: optional reason, tick "I understand", confirm. Personal details are removed 7 days later. Until then a yellow bar with "Keep my account" shows on every account page.
8. **Sign out** (button at the bottom of the account menu).

---

## 3. Each API

An "API" is a door the website knocks on to ask the server for something. All of these are under `/api/v2/shop`. All except the pincode one need the customer to be signed in.
A "rate limit" is a cap on how many times something can be asked per minute. "Per network" means per internet address (all phones on one Wi-Fi share one).

### 3.0 Errors every My account API can give

| Error code (status) | When | What the customer sees |
|---|---|---|
| `ACCESS_TOKEN_EXPIRED` (401) | The short sign-in key (15 minutes) ran out | Nothing. The website renews it quietly and tries again once. |
| `NOT_SIGNED_IN`, `SESSION_INVALID`, `SESSION_EXPIRED`, `SIGNED_OUT`, `SIGNED_OUT_REMOTELY`, `SIGNED_OUT_EVERYWHERE`, `SIGNED_OUT_FOR_SAFETY`, `SESSION_ENDED`, `ACCOUNT_DELETED` (401) | The sign-in has ended (signed out elsewhere, 30 days unused, account deleted…) | A message for 8 seconds saying why, then the sign-in page; after signing in they come back to the same page. |
| `MAINTENANCE` (503) | The owner switched the website off | The maintenance page with the owner's message. |
| `INTERNAL` (500) | Something unexpected broke on the server | "Something went wrong on our side. Please try again." with a short reference to quote (on most screens). |
| `BAD_JSON` (400), `TOO_LARGE` (413), `BAD_TEXT` (400) | Broken or huge request, or a character the database can't keep | The server's message. Not reachable from normal use. |
| Made by the website: `OFFLINE`, `NETWORK`, `TIMEOUT` (20 seconds; 60 for photos), `SERVER_BUSY`, `SERVER` | No internet, server unreachable, too slow, or a proxy error page | "You are offline…", "We couldn't reach Nandam Handlooms…", "This is taking too long…", "Our server is busy right now…". What was typed stays on the screen. |

Every change below also writes one line to the activity record (`AuthEvent`) with the time, internet address and browser. Every signed-in call also updates "last seen" (`UserProfile.lastSeenAt`), at most once every 5 minutes.

### 3.1 `GET /me` — read my details

| | |
|---|---|
| For | The customer's own details for every account screen. |
| Goes in | Nothing (only the sign-in key). |
| Comes back | `customer`: id, fullName, firstName, mobile, mobileMasked, email, avatarUrl, pincode, city, state, dateOfBirth, anniversary, language, marketingOptIn, memberSince, deletion (requestedAt, deletesOn, overdue — or empty), managedByShop (true for owner/staff numbers), payOnline. |
| Reads | `AuthAccount`, `UserProfile`, `AdminProfile`, `UserRole`/`Role`, `Session`. |
| Saved | Nothing (except "last seen"). |
| Limit | None. |
| What can go wrong | Only the common errors in 3.0. The account menu calls it on every tab change and when the window comes back; if it fails there, nothing is shown (the old details stay). |

### 3.2 `PATCH /me` — change my details

| | |
|---|---|
| For | Changing profile details. Only the fields sent are changed. |
| Goes in (all optional, at least one) | `fullName`: 2–60 characters, letters only plus spaces, dots, apostrophes, hyphens (any script, e.g. Telugu). Extra spaces are squeezed. · `email`: a valid address, up to 254 characters, kept in small letters. · `pincode`: 6 digits, not starting with 0. · `city`: 2–60 characters, letters, digits, spaces and `. , ' ( ) -`. · `state`: one of the 36 states and union territories. · `dateOfBirth`: YYYY-MM-DD, age 13 to 110, or empty to clear. · `anniversary`: YYYY-MM-DD, from 1 Jan 1940 to today, or empty. · `language`: en, te or hi, or empty. · `marketingOptIn`: yes/no. Any other field is refused. |
| Server checks | The email is not on another account (capital letters ignored). A new pincode takes the city and state from India Post's list unless they are typed in the same request. A pincode not in the list needs both city and state in the same request. |
| Saved | `AuthAccount.email` (and `emailVerifiedAt` is cleared). `UserProfile`: firstName, lastName, displayName, pincode, city, state, dateOfBirth, anniversary, language, marketingOptIn, marketingOptInAt. Activity `shop_profile_updated` with the names of the changed fields. |
| Comes back | `{ customer, changed }` (changed = names of the fields that really changed). |
| Limit | None. |

| Error (status) | When | Customer sees |
|---|---|---|
| `VALIDATION_FAILED` (400) | A field breaks a rule above | The message under that field (Profile page). |
| `EMAIL_TAKEN` (409) | Email is on another account | Under the email: "This email is already on another account…" plus a WhatsApp link "This is my email: message the shop". |
| `PINCODE_NOT_FOUND` (400) | Pincode not in the list and city or state not sent | Under the pincode: "We couldn't find this pincode. Check it, or type your city and state." (see problem S1) |

### 3.3 `POST /me/avatar` — upload a profile photo

| | |
|---|---|
| Goes in | A form with one file called `photo`: up to 5 MB, said to be JPEG, PNG or WebP. |
| Server checks | Reads the real picture type and size from the file itself. JPEG up to 100 million pixels; PNG and WebP up to 25 million. Turns it upright, puts it on white, crops it to a 256 × 256 square around the most interesting part, and saves it as a new JPEG with no location or camera details. |
| Saved | The new file in storage (`avatars/<random name>.jpg` on S3). `UserProfile.avatarUrl` and `avatarKey`. The old photo file is deleted. Activity `shop_avatar_changed`. |
| Comes back | `{ customer }`. |
| Limit | 10 per minute per network. |

| Error (status) | When | Customer sees (red line under the photo) |
|---|---|---|
| `PHOTO_TYPE` (400) | Not JPEG/PNG/WebP (e.g. HEIC, GIF, SVG) | "Use a JPEG, PNG or WebP photo." (the website checks this first: "Choose a JPEG, PNG or WebP photo.") |
| `PHOTO_TOO_LARGE` (400) | Over 5 MB | "The photo is larger than 5 MB…" (website checks first, same words) |
| `PHOTO_MISSING` (400) | No file in the form | "Choose a photo first." |
| `PHOTO_UPLOAD_FAILED` (400) | The form arrived broken | "The photo could not be received. Please try again." |
| `PHOTO_UNREADABLE` (400) | Damaged or fake picture | "This photo could not be read. Please choose another one." |
| `PHOTO_TOO_MANY_PIXELS` (400) | Picture too large in pixels | "This photo is too big to use. Please choose another one, or a screenshot of it." |
| `RATE_LIMITED` (429) | More than 10 tries a minute | "Too many requests from this network. Please wait a minute and try again." |
| `INTERNAL` (500) | Storage (S3) failed | "Something went wrong on our side…" (no reference shown here, see Sm8) |

### 3.4 `DELETE /me/avatar` — remove the photo

| | |
|---|---|
| Goes in | Nothing. |
| Saved | `avatarUrl` and `avatarKey` emptied; the file deleted from storage; activity `shop_avatar_removed`. If there was no photo, nothing happens. |
| Comes back | `{ customer }`. |
| Limit / errors | No limit. Only the common errors. |

### 3.5 `POST /me/mobile/code` — send a code to the new mobile

| | |
|---|---|
| Goes in | `mobile`: 10 digits starting with 6, 7, 8 or 9 (+91, a leading 0 and spaces are removed). |
| Server checks | Owner/staff accounts can't change it here. Not the same number. Not on any other account. The SMS limits below. Then the SMS is sent to the new number. |
| Saved | A `PhoneCode` row (number, purpose "shop_change_mobile", this customer, the code in scrambled form, network, expiry). Older open codes for that number are closed. Activity `shop_mobile_change_code_sent` with the number partly hidden. |
| Comes back (202) | resendInSeconds (60), expiresInSeconds (60 with Message Central today; up to 600), codeLength (6), mobileMasked; in test mode only, the code itself. |
| Limits | 60 a minute per network (shared with 3.6). One code per 60 seconds per number; 5 per hour per number; 60 per hour per IPv4 address; 20 per hour per IPv6 block. **The daily cap on SMS to new numbers does not apply here** (see M1). |

| Error (status) | When | Customer sees |
|---|---|---|
| `VALIDATION_FAILED` (400) | Not a valid mobile | Under the number field. |
| `SAME_MOBILE` (400) | Already their number | "This is already your mobile number." (the website checks this first) |
| `MOBILE_TAKEN` (409) | Number is on another account | "This number is already used by another account." |
| `MOBILE_MANAGED_BY_SHOP` (403) | Owner or staff number | Red box. (The "Change" button is hidden for them anyway.) |
| `CODE_RESEND_WAIT` (429) | A code was sent less than 60 s ago | Moves to the code step with the real countdown. |
| `CODE_TOO_MANY` / `CODE_TOO_MANY_NETWORK` (429) | 5 codes this hour for the number / too many from this network | Red box with "Try again in N minutes". |
| `RATE_LIMITED` (429) | Over 60 calls a minute | Red box with the wait time. |
| `SMS_UNAVAILABLE` (503) | The SMS company did not answer | Red box: "We couldn't send the code right now…" |

### 3.6 `POST /me/mobile/verify` — check the code and change the mobile

| | |
|---|---|
| Goes in | `mobile`, `code` (6 digits). |
| Server checks | Same owner/staff and same-number checks. The code must be the latest open one for that number, asked for by this customer, not expired, fewer than 3 wrong tries. The SMS company confirms it. |
| Saved | `AuthAccount.phone` and `phoneVerifiedAt`; the code row is closed. Activity `shop_mobile_changed` (old and new, partly hidden). **Other signed-in browsers stay signed in; the old number is not told** (see S2). |
| Comes back | `{ customer }`. |
| Limit | 60 a minute per network (shared with 3.5). |

| Error (status) | Customer sees |
|---|---|
| `WRONG_CODE` (400) | Under the boxes: "That code isn't right. N tries left." Boxes cleared, they shake. |
| `CODE_EXPIRED`, `CODE_USED_UP` (400) | Under the boxes; boxes cleared; "Send a new code" after the countdown. |
| `CODE_ALREADY_USED` (400) | Red box: "This code was already used. Get a new code." |
| `MOBILE_TAKEN` (409) | Back to the number step with the message (someone else took the number meanwhile). |
| `SAME_MOBILE`, `MOBILE_MANAGED_BY_SHOP`, `VALIDATION_FAILED`, `SMS_UNAVAILABLE`, `RATE_LIMITED` | Red box with the server's message (for `RATE_LIMITED` no wait time is shown, see Sm9). |

### 3.7 `GET /me/sessions` — my signed-in devices

| | |
|---|---|
| Comes back | `sessions`: id, label ("Chrome on Android"), browser, system, device (mobile/tablet/desktop), signedInAt, lastActiveAt (time of the last automatic renewal), isCurrent. This browser first, then the most recent. |
| Reads | `Session` rows of this customer that are website sign-ins, not ended, not expired. At most 20 (signing in on a 21st ends the one used longest ago). |
| Limit / errors | None / common only. Screen: "The list didn't load" + Try again. |

### 3.8 `DELETE /me/sessions/:id` — sign out one device

| | |
|---|---|
| Goes in | `id` of the device (from 3.7). |
| Server checks | Follows renewals to the live sign-in; it must belong to this customer; it can't be this browser. |
| Saved | `Session.revokedAt`, `revokeReason = device_signed_out`. Activity `shop_device_signed_out`. **That browser's order notifications are not switched off** (see S3). |
| Comes back | The fresh `sessions` list. |

| Error (status) | Customer sees (a short message at the bottom) |
|---|---|
| `SESSION_NOT_FOUND` (404) | "That device is no longer signed in." The list reloads. |
| `USE_SIGN_OUT` (400) | "This is the device you are using. Use "Sign out" instead." (The button is hidden for this device anyway.) |
| `VALIDATION_FAILED` (400) | "This item was not found." (bad id) |

### 3.9 `GET /me/addresses` — my addresses

| | |
|---|---|
| Comes back | `{ addresses, max: 10 }`. Each address: id, label (home/office/other), fullName, mobile, line1, line2, landmark, city, state, pincode, country, isDefault, updatedAt, and `problem` (what must be corrected before an order can go there, for addresses saved on the old website; otherwise empty). Default first, then most recently changed. |
| Reads | `Address` rows of this customer only. |
| Errors | Common only. Addresses page: "Your addresses didn't load" + Try again. Overview: just shows "Addresses" without a count. Also used by Checkout (Module 6). |

### 3.10 `POST /me/addresses` — add an address

| | |
|---|---|
| Goes in | `fullName` (rules as in 3.2), `mobile` (10 digits), `line1` (3–120 characters), `line2` (up to 120, optional), `landmark` (up to 80, optional), `pincode`, `city` and `state` (optional; filled from the list), `label` (home/office/other; default home), `isDefault` (default no). |
| Server checks | City and state from India Post's list if not given; an unknown pincode needs both. At most 10. The first address is always the default. One change at a time per customer (a lock, so two quick saves can't break the 10-limit or make two defaults). |
| Saved | A new `Address` row (country "India"); if it is the new default, the others lose "default". Activity `shop_address_added`. |
| Comes back (201) | `{ address, addresses, max }`. |

| Error (status) | Customer sees |
|---|---|
| `VALIDATION_FAILED` (400) | Under the wrong field. |
| `PINCODE_NOT_FOUND` (400) | Under the pincode. |
| `ADDRESS_LIMIT` (409) | Red box in the form: "You can save up to 10 addresses. Delete one to add another." (The Add button is already greyed out at 10.) |

### 3.11 `PATCH /me/addresses/:id` — edit an address

| | |
|---|---|
| Goes in | Any of the fields in 3.10 (at least one). The website always sends all of them. |
| Server checks | The address must be this customer's. A new pincode without city/state takes the list's. `isDefault: true` makes it the default; `false` is ignored. |
| Saved | The `Address` row. Activity `shop_address_updated`. Orders already placed keep their own copy and do not change. |
| Comes back | `{ address, addresses, max }`. |
| Errors | `VALIDATION_FAILED` (400; also "Nothing to change." and a bad id) → under the field or a red box. `ADDRESS_NOT_FOUND` (404) → red box "This address was removed. Refresh the page." `PINCODE_NOT_FOUND` (400) → under pincode. |

### 3.12 `DELETE /me/addresses/:id` — delete an address

| | |
|---|---|
| Saved | The `Address` row is deleted. Orders that used it keep their own copy (their link to the address is just emptied). If it was the default, the most recently changed other address becomes the default. Activity `shop_address_deleted`. |
| Comes back | `{ addresses, max }`. |
| Errors | `ADDRESS_NOT_FOUND` (404) → message at the bottom, list reloads. `VALIDATION_FAILED` (bad id). |

### 3.13 `POST /me/addresses/:id/default` — make default

| | |
|---|---|
| Saved | All this customer's addresses lose "default"; this one gets it. Activity `shop_address_default`. |
| Comes back | `{ addresses, max }`. |
| Errors | `ADDRESS_NOT_FOUND` (404) → message, list reloads. |

### 3.14 `POST /me/delete-request` — ask to delete my account

| | |
|---|---|
| Goes in | `reason` (optional, up to 300 characters; if the body is wrong in any way it is ignored, not refused). |
| Server checks | Owner/staff accounts can't (shop owner does it). Refused while an online order is paid, packed or shipped. If already asked, the existing request is returned. |
| Saved | `UserProfile.deleteRequestedAt` = now. Activity `shop_delete_requested` with the reason. |
| Comes back | `{ deletion: { requestedAt, deletesOn (7 days later), overdue } }`. |
| After 7 days | The clean-up job (every 15 minutes) removes the personal details (table in section 4.10). If an order is on its way then, it waits until it is delivered. |

| Error (status) | Customer sees |
|---|---|
| `ACCOUNT_MANAGED_BY_SHOP` (403) | Yellow box. (The page already hides the form for them.) |
| `OPEN_ORDERS` (409) | Yellow box: "You have orders on the way. You can delete your account after they are delivered." |

### 3.15 `DELETE /me/delete-request` — keep my account

| | |
|---|---|
| Saved | `deleteRequestedAt` emptied. Activity `shop_delete_cancelled`. |
| Comes back | `{ deletion: null }`. Always works, even if nothing was asked. |
| Customer sees | "Your account is kept. Nothing was deleted." and the yellow bar goes. |

### 3.16 `GET /pincodes/:pincode` — city and state from a pincode (no sign-in needed)

| | |
|---|---|
| Goes in | The 6-digit pincode in the address. |
| Comes back | `{ pincode, area, city, state }` (city = the district, e.g. 522503 → area Mangalagiri, city Guntur). The browser may keep the answer for a day. |
| Reads | `Pincode` table (19,297 pincodes; I checked the file: every state name matches the website's state list). |
| Limit | 60 a minute per network. |
| Errors | `PINCODE_NOT_FOUND` (404) → hint "We couldn't find this pincode. Check it, or type your city and state." · `VALIDATION_FAILED` (400) · `RATE_LIMITED` (429) or no internet → hint "Couldn't check the pincode right now. Type your city and state." |

---

## 4. The data kept

"Must have" = the database refuses the row without it. "Linked to" = points at a row in another table.

### 4.1 `AuthAccount` — one per person who can sign in (one per mobile)

| Field | What it means | Must have? |
|---|---|---|
| id | The account's own code | Yes (made automatically) |
| phone | Mobile, 10 digits. No two accounts can share it. | No (emptied when deleted) |
| email | Email. No two accounts can share it. | No in the database; the website always asks for it |
| status | active / pending / locked / deleted | Yes, default "active" |
| phoneVerifiedAt | When the mobile was last proven with a code | No |
| emailVerifiedAt | When the email was proven. The website never proves emails; it is emptied when the email changes. | No |
| securityStamp | A random value; changed when the account is deleted | Yes (automatic) |
| mpinHash, mpinSetAt, passwordHash, failedLoginAttempts, lockCount, lockedUntil, mfaEnabled, isCompromised, passwordChangedAt | Admin app and old app only | Defaults |
| createdAt | "With us since" | Yes (automatic) |
| updatedAt, deletedAt | Last change; when it was deleted | updatedAt automatic; deletedAt no |
| Links | One `UserProfile`, one `AdminProfile` (staff only), roles (CUSTOMER / STAFF / ADMIN), sessions, addresses, orders, phone codes, push tokens, notifications, bag items | — |

### 4.2 `UserProfile` — the customer's details (one per account)

| Field | What it means | Must have? |
|---|---|---|
| authAccountId | Which account (one profile per account) | Yes, unique. Removed with the account row. |
| firstName, lastName | Name split in two | Yes |
| displayName | The full name as typed | No |
| avatarUrl, avatarKey | Photo address and its storage name (so a replaced photo can be deleted) | No |
| pincode, city, state | Where they live (for analytics) | No in the database; the website always asks |
| dateOfBirth, anniversary | Dates only | No |
| language | en / te / hi | No |
| marketingOptIn, marketingOptInAt | Wants offers and new arrivals; when that changed | Default "no" |
| privacyAcceptedAt, profileCompletedAt | Saw the privacy note; finished the first profile | No |
| signupSource, signupMedium, signupCampaign, signupReferrer, signupDevice | Where they first came from | No |
| lastSeenAt | Last visit (written at most every 5 minutes) | No |
| deleteRequestedAt | When they asked to delete the account | No |
| preferences, createdAt, updatedAt, deletedAt | Old field; dates | Automatic / no |

### 4.3 `Address` — saved delivery addresses

| Field | What it means | Must have? |
|---|---|---|
| id | The address's own code | Yes |
| authAccountId | Whose address | Yes. Removed if the account row is removed. |
| fullName, phone, line1, city, state, pincode | Name and mobile for delivery, house/building, place | Yes |
| line2, landmark | Area/street; "near the temple" | No |
| label | home / office / other | No (shown as Home if empty) |
| country | "India" | Default |
| isDefault | The one used first at checkout | Default "no". The database itself does not stop two defaults; the server's lock does. |
| createdAt, updatedAt | Dates | Automatic |
| Links | Orders may point at it; if it is deleted the order's link is emptied, the order keeps its own copy | — |

### 4.4 `Session` — one row per signed-in browser

| Field | What it means | Must have? |
|---|---|---|
| id, authAccountId | Own code; whose sign-in | Yes |
| refreshTokenHash | A scrambled copy of the 30-day sign-in cookie (the real value is never stored). Unique. | Yes |
| kind | "customer" for the website ("staff" for the admin app) | Default "staff" |
| platform, deviceName, ipAddress, userAgent | "web", "Chrome on Android", internet address, browser details | No |
| startedAt | When this browser signed in (kept across renewals) | No |
| createdAt | When this row was made = the last renewal (shown as "Last active") | Automatic |
| expiresAt | 30 days after the last renewal | Yes |
| revokedAt, revokeReason | When and why it ended (rotated, logout, device_signed_out, signed_out_all, too_many_sessions, account_deleted…) | No |
| parentId | The row it replaced on renewal | No |
| isCompromised, usedAt, trustedDeviceId, stampAtIssue | Theft flag; admin app only | Defaults |

### 4.5 `PhoneCode` — SMS codes (sign-in and change of mobile)

| Field | What it means | Must have? |
|---|---|---|
| id, mobile, purpose | Own code; number the code went to; "shop_sign_in" or "shop_change_mobile" | Yes |
| authAccountId | For a change of mobile: the customer who asked | No |
| codeHash | The code in scrambled form, or the SMS company's reference | Yes |
| attempts | Wrong tries so far (3 allowed) | Default 0 |
| usedAt, expiresAt | When it was used up or replaced; when it runs out | expiresAt yes |
| ipAddress | The network it was asked from (for limits) | No |
| createdAt | When sent. Rows older than 2 days are deleted by the clean-up job. | Automatic |

### 4.6 `Pincode` — India Post's list

| Field | What it means | Must have? |
|---|---|---|
| pincode | 6 digits; the key | Yes |
| area | Main post office | Yes |
| city | The district | Yes |
| state | State name (same names as the website's list) | Yes |
| updatedAt | When loaded | Automatic |

### 4.7 `PushToken` — browsers that accepted notifications

| Field | What it means | Must have? |
|---|---|---|
| token | The browser's notification address; unique | Yes |
| platform | web / android / ios | Yes |
| authAccountId | The customer it belongs to (empty for visitors) | No |
| topics | orders / offers / arrivals | Default empty |
| userAgent, browser, lastSeenAt | Browser details; last seen | No / automatic |
| removedAt, removedReason | Switched off, expired or account deleted | No |

### 4.8 `BagItem` — the signed-in bag (only touched here by account deletion)

id, authAccountId (must), productId (must), quantity (must, 1–50), priceSeen (must), dates. One row per saree per customer.

### 4.9 `AuthEvent` — the activity record

id, authAccountId (optional), eventType (e.g. `shop_profile_updated`), source (`customer_web`), ipAddress, userAgent, metadata (extra details, e.g. which fields changed, the delete reason), createdAt.

### 4.10 What happens to each table when an account is deleted (7 days after asking)

| Table | What happens |
|---|---|
| AuthAccount | Mobile and email emptied, status "deleted", PIN/password cleared. The row stays (orders point at it). |
| UserProfile | Name becomes "Deleted customer"; photo, pincode, city, state, birthday, anniversary, language, offers choice, referring site, last seen emptied. Sign-up source/medium/campaign/device stay (not personal). |
| Photo file | Deleted from storage. |
| Address | All deleted. |
| BagItem | All deleted. |
| Session | All ended. The rows stay, with internet address and browser (see Sm11). |
| PushToken | Unlinked and marked removed. |
| PhoneCode, OtpCode | Deleted. |
| AuthEvent | Kept, including internet addresses and the reason typed on the Delete page. |
| Order, Invoice | Kept for tax, **with the customer's name, mobile and full delivery address** (Order) and name and mobile (Invoice). See S4. |
| Notification | Kept (order numbers, tracking numbers). |

Owner/staff accounts are never deleted this way. An account that became staff during the 7 days has its request cancelled.

---

## 5. On the website

### 5.1 Account menu and "Keep my account" bar (`AccountLayout.jsx`)
- Menu: Overview, My orders, Profile, Addresses, Notifications, Signed-in devices, Delete account, Sign out.
- Fresh details are fetched on every menu click and when the window comes back into view. If that fails, nothing is shown.
- If a deletion is waiting: a yellow bar "Your account will be deleted on <date>" (or "…waiting to be deleted" if orders are still on the way) with a "Keep my account" button (spinner while working; success message "Your account is kept. Nothing was deleted."; error message at the bottom).
- Sign out: ends this browser even if the server can't be reached, goes to the home page, says "Signed out".

### 5.2 Overview (`OverviewPage.jsx`)
- Welcome card: photo or initials, "Namaste, <first name>", mobile, email, city and state, "With us since".
- "Your profile is N% complete" with what is missing (photo, birthday, anniversary, language).
- Latest order (Module 7), tiles for orders, addresses (with count), notifications.

### 5.3 Profile (`ProfilePage.jsx`)
- Photo: "Add a picture" / "Change" / "Remove". Type and 5 MB are checked before sending. While uploading, the new photo shows faded with a spinner. Success: "Profile picture saved". Errors: red line under the photo.
- Fields: Full name, Email, Mobile (read-only, "Change" button), Pincode, City, State, Preferred language, Date of birth, Anniversary.
- "Save changes": every field is checked on the screen first (same rules as the server). Only the changed fields are sent. Nothing changed → "No changes to save". While saving: spinner on the button. Success: "Profile saved". Errors: under the field, or a red box "Your changes weren't saved" with the reason and a reference.
- Owner/staff: the hint says only the shop owner can change the mobile; no "Change" button.

### 5.4 Change mobile dialog (`ChangeMobile.jsx`)
- Step 1: "New mobile number" → "Send code" (spinner). Same number is caught on the screen.
- Step 2: 6 code boxes, "Sent to +91 …", "Change" link, countdown "New code in N s", then "Send a new code". Typing the 6th digit checks the code by itself. "Verify" button too.
- Success: "Mobile number changed", dialog closes. Errors: as in 3.5 and 3.6. The dialog can't be closed while it is working.

### 5.5 Addresses (`AddressesPage.jsx`, `AddressForm.jsx`, `PlaceFields.jsx`)
- "N of 10 addresses saved". Cards: name, Home/Office/Other, "Default", "Needs checking" (old-website address with a problem), address, mobile.
- Buttons: "Make default" (spinner), "Edit", "Delete" (asks "Delete this address?" first). "Add a new address" (greyed out at 10, with a note).
- While loading: grey placeholder boxes. Load error: red box + "Try again". No addresses: "No saved addresses" + "Add an address".
- Form (dialog): Full name and mobile (filled from the profile for a new address), House/flat/building, Area/street (optional), Landmark (optional), Pincode → "Finding your city…" → "✓ Area, City", City, State, "Save as" Home/Office/Other, "Make this my default address" (not shown for the first address). Old-website problems are shown at the top and under the field. Checks on the screen first; errors under the fields or in a red box.

### 5.6 Signed-in devices (`DevicesPage.jsx`)
- Table: device, signed in (date), last active ("Now" for this one), "This device" badge or "Sign out" (asks first).
- "Sign out of all devices" (asks first) → goes to the sign-in page, "Signed out of all devices". Errors: message at the bottom.

### 5.7 Delete account (`DeletePage.jsx`)
- Four lines explaining what happens. Owner/staff: a note that only the owner can close it. Already asked: a note to use "Keep my account".
- Otherwise: "Why are you leaving?" (optional, 300 characters), tick box, "Request deletion" (asks "Delete your account in 7 days?" first). Success: "Deletion requested. You have 7 days to change your mind." and the yellow bar appears. Errors: yellow or red box.

### 5.8 Do the website and the server agree?

| Item | Website | Server | Same? |
|---|---|---|---|
| Name | 2–60, letters, spaces, `. ' -` | Same | Yes |
| Email | Must have `@` and a dot, up to 254 | Stricter email check, up to 254 | Close; when the server is stricter its message shows under the email |
| Pincode | 6 digits, not starting with 0 | Same | Yes |
| City | 2–60, same characters | Same | Yes |
| House/building, area, landmark | 3–120, up to 120, up to 80 | Same | Yes |
| Mobile | 10 digits from 6–9, +91/0 removed | Same | Yes |
| Date of birth / anniversary | Checked with the phone's own date | Checked with world time (UTC) | Differ only between midnight and 5:30 am India time (Sm10) |
| Delete reason | Up to 300 | Up to 300 (longer is silently dropped) | Yes |
| Photo | JPEG/PNG/WebP, 5 MB | Same, plus real-type and pixel checks | Yes |
| Error codes | Every code in section 3 is shown with the server's own plain message; none is lost or shown as a blank failure | — | Yes (two small gaps: Sm8, Sm9) |

### 5.9 Special cases I checked

| Case | What happens | OK? |
|---|---|---|
| No internet / server down | Clear message; what was typed stays | Yes |
| Double press on Save | The button ignores a second press while saving; the server locks addresses so 10-limit and default stay right | Yes (one gap: a save that timed out can be saved twice, Sm5) |
| Deleting the default address | Another becomes default (the most recently changed) | Yes, but not told which (Sm6) |
| 11th address | Button greyed out; server refuses too | Yes |
| New mobile already used | "This number is already used by another account." at both steps | Yes |
| Photo too big / wrong type | Caught on the screen; server checks again | Yes |
| Signing out this device from the list | Button hidden; server refuses too | Yes |
| Delete request, then sign in again | Taken to My account; yellow bar with "Keep my account" | Yes |
| After deletion, sign in again with the same number | A new, empty account is made | Yes (as the Delete page says) |
| One customer reading or changing another's addresses, devices or photo | Every address and device call checks the owner; a wrong id gives "not found" | Yes |
| Photo upload safety | Real type read from the file, size and pixel caps, re-made as a clean small JPEG with a random name | Yes (memory use of very big pictures: see section 7) |

---

## 6. Problems found

### Must fix

**M1. "Change mobile" can be used to send unlimited paid SMS.**
A signed-in person can ask for change-of-mobile codes to any numbers. These codes skip the shop's daily SMS cap, and there is no limit per customer, only per network (20–60 an hour). Someone with one account and many internet addresses (easy with IPv6 or rented proxies) can send thousands of SMS an hour at about ₹0.30 each, with no daily stop.
Why it matters: the shop pays for every SMS; the SMS account could also be blocked for abuse.
Where: `Nadam-backend/src/services/shop/code.service.js:57`, `Nadam-backend/src/services/shop/profile.service.js:145`, `Nadam-backend/src/routes/shop/index.js:67`.
> **Second check: ✅ Correct.**

### Should fix

**S1. A new profile pincode that is not in India Post's list can never be saved if the city and state stay the same.**
The Profile page sends only the fields that changed. When only the pincode changes, the server forgets the saved city and state and asks for them. Example: a customer in Vijayawada moves to a newer pincode missing from the list, keeps "Vijayawada" and "Andhra Pradesh" → "We couldn't find this pincode… type your city and state", even though both are typed. The only way out is to pick a wrong state. (With a pincode that is in the list, a city the customer typed back to the old one is quietly replaced by the district name.)
Why it matters: the customer is stuck (rare, and only for the profile, not for delivery addresses).
Where: `Nadam-frontend/customer-web/src/pages/account/ProfilePage.jsx:117-123`, `Nadam-backend/src/services/shop/profile.service.js:41-47`.
> **Second check: ✅ Correct.**
> **Third check (on the second checker's note): Second checker right. Final: a new pincode not in the list can't be saved on Profile; picking a wrong state alone still fails, the customer must change both city and state in one save and then change them back. Final group: Should fix.**

**S2. Anyone using a browser that is still signed in can take the account for good by changing the mobile.**
Only the new number gets a code. The old number is not asked or told, and other devices stay signed in. Example: a customer stays signed in (30 days) on a family, office or shop-counter computer; someone else opens Profile → Change mobile → their own number. The orders and addresses are now theirs; the real customer signing in with their own number gets a new empty account.
Why it matters: account takeover; customer loses order history and support gets confusing.
Where: `Nadam-backend/src/services/shop/profile.service.js:142-161`, `Nadam-frontend/customer-web/src/pages/account/ChangeMobile.jsx:31-77`.
> **Second check: ✅ Correct.**

**S3. Signing out one device from "Signed-in devices" leaves that browser's order notifications on.**
"Sign out of all devices" switches them off, but signing out a single device does not. Example: a customer signs out a lost phone or a shared computer; it keeps showing "Your order has shipped … Tracking number …".
Why it matters: order details keep going to a device the customer removed.
Where: `Nadam-backend/src/services/shop/session.service.js:238-245` (compare `:203-204`).
> **Second check: ✅ Correct.**

**S4. The Delete page promises orders are kept "without your contact details", but they are kept with them.**
After deletion each order still has the customer's name, mobile and full delivery address, and each invoice still has the name and mobile.
Why it matters: the customer is told something untrue about their personal data (privacy law, DPDP 2023).
Where: `Nadam-frontend/customer-web/src/pages/account/DeletePage.jsx:46`; nothing in `Nadam-backend/src/services/shop/account.service.js:42-86` touches `Order.shippingAddress` (made at `Nadam-backend/src/services/shop/checkout.service.js:51-54`) or `Invoice.customerName`/`customerMobile` (`Nadam-backend/prisma/schema.prisma:692-693`).
> **Second check: ✅ Correct.**

### Small

**Sm1. The Profile form can quietly undo a change made on another device.** The form keeps the details it opened with; when fresher details arrive, the next save sends the old values back for fields that differ. Example: email changed on the phone, then the laptop's Profile page (opened with old details) saves a birthday → the old email comes back. `Nadam-frontend/customer-web/src/pages/account/ProfilePage.jsx:91-92`, `:117-123`.
> **Second check: ✅ Correct.**

**Sm2. Any unused email can be put on an account without proving it is yours.** If someone types another person's email (or a typo that is a real address), that person can't sign up later ("This email is already on another account"; sign-up needs an email). `Nadam-backend/src/services/shop/profile.service.js:31-37`, `Nadam-backend/src/services/shop/auth.service.js:107-108`.
> **Second check: ✅ Correct.**

**Sm3. A signed-in person can test whether an email or a mobile belongs to a customer.** "Already used" answers on Profile and Change mobile tell them; changing the email has no limit at all. (Sign-in itself is careful not to tell.) `Nadam-backend/src/services/shop/profile.service.js:32-33`, `:137-140`, `Nadam-backend/src/routes/shop/index.js:64`.
> **Second check: ✅ Correct.**
> **Third check (on the second checker's note): Second checker right. Final: a signed-in person can learn whether an email or mobile belongs to a customer; sign-in hides mobiles, but the sign-up step also says an email is taken (one SMS code gives a 15-minute pass for many tries). Final group: Small.**

**Sm4. "Request deletion" and "Keep my account" can show an error even though they worked.** After the request succeeds the page asks for fresh details; if only that second call fails, an error is shown. `Nadam-frontend/customer-web/src/pages/account/DeletePage.jsx:29-34`, `Nadam-frontend/customer-web/src/pages/account/AccountLayout.jsx:33-38`.
> **Second check: ✅ Correct.**

**Sm5. A new address can be saved twice on a slow connection.** If saving takes over 20 seconds the website says "This is taking too long", but the server may have saved it; pressing Save again adds a copy. `Nadam-frontend/customer-web/src/pages/account/AddressForm.jsx:59`, `Nadam-frontend/customer-web/src/api/client.js:10`.
> **Second check: ✅ Correct.**

**Sm6. Deleting the default address quietly makes another one default** (the most recently changed, not the most recently used), and the message only says "Address deleted". `Nadam-backend/src/services/shop/address.service.js:72-75`, `Nadam-backend/src/models/address.model.js:19-20`, `Nadam-frontend/customer-web/src/pages/account/AddressesPage.jsx:42`.
> **Second check: ✅ Correct.**

**Sm7. Two photo uploads at the same moment leave one unused photo in storage** (both read the same "old photo" before saving). `Nadam-backend/src/services/shop/profile.service.js:110-114`.
> **Second check: ✅ Correct.**

**Sm8. A server error on photo upload shows no reference number** to quote, unlike other screens. `Nadam-frontend/customer-web/src/pages/account/ProfilePage.jsx:49`.
> **Second check: ✅ Correct.**

**Sm9. "Too many requests" on the code step does not say how long to wait** (the number step does). `Nadam-frontend/customer-web/src/pages/account/ChangeMobile.jsx:75`.
> **Second check: ⚠️ Partly correct: the exact seconds are dropped, but the message shown is the server's "Too many requests from this network. Please wait a minute and try again." (`middlewares/rateLimit.js:26`), and the window is 60 seconds, so it already says how long to wait; pure polish.**
> **Third check: Second checker right. Final: the code step shows the server's "Please wait a minute" (the real wait is never over 60 seconds) but not the exact seconds the number step shows; very rare and pure polish. Final group: Small.**

**Sm10. Dates near midnight.** Between midnight and 5:30 am India time, today's date can't be picked as an anniversary (the date picker uses world time), and the "13 or older" check can differ by a day between website and server. `Nadam-frontend/customer-web/src/pages/account/ProfilePage.jsx:20`, `Nadam-backend/src/validators/shop/common.js:51-64`, `Nadam-frontend/customer-web/src/utils/validate.js:40-45`.
> **Second check: ✅ Correct.**

**Sm11. After deletion, internet addresses and browser details stay forever** in the ended sign-in rows and the activity record, and so does the reason typed on the Delete page. `Nadam-backend/src/services/shop/account.service.js:29`, `:74-75`, `Nadam-backend/src/models/session.model.js:33-34`.
> **Second check: ✅ Correct.**

**Sm12. The clean-up takes 50 due deletions at a time in no fixed order.** Accounts waiting for a delivery stay in that list; if 50 ever pile up, others would never be reached. Not likely at today's size. `Nadam-backend/src/models/customer.model.js:43-44`.
> **Second check: ✅ Correct.**

---

## 7. What I could not check

- **The live server and settings.** I did not open `.env` or log in. Rate limits are "60 a minute" only if `RATE_LIMIT_PER_MINUTE` is not changed there. The nginx upload size (the deployment notes say 6 MB, `docs/deployment/live-v2-server.md:134`) and the S3 bucket settings were not checked live.
- **The SMS company's own limits.** Message Central may cap or block mass sending by itself, which would soften M1. Not sure.
- **Memory used by very large photos.** A 25-million-pixel PNG or WebP opened in full needs about 100 MB of memory; four at once could strain a small server that also runs the database. The picture library may read them in pieces. Not sure without running it.
- **Old-website orders.** Deletion is blocked only by online orders marked paid, processing or shipped. If old-website orders on their way use other words (for example "active"), they would not block it. I did not look at live data.
- **Whether the clean-up job runs in only one copy of the server.** Two copies could both try to delete the same account (harmless, but double records).
- **Tests.** There are server tests for this module (`Nadam-backend/tests/api/shop/me.test.js`, `addresses.test.js`, `account.test.js`, `session.test.js`), but I was asked not to run anything.
- **Real phones** (code auto-fill, photo picking on iPhone and Android).
- **Neighbouring screens** — the Notifications page (also uses `PATCH /me` for the offers choice), sign-in and checkout — were only read where they meet this module.

---

## 8. For the developer

| # | Where | Note | Fix (one line) |
|---|---|---|---|
| M1 | `Nadam-backend/src/services/shop/code.service.js:57`; `profile.service.js:145`; `routes/shop/index.js:67-68` | `checkLimits` skips the daily total when `accountId` is set; change-mobile always passes it. Only per-mobile, per-network and per-IP limits remain; nothing per account. | Add a per-account cap for `SHOP_CODE_PURPOSE.CHANGE_MOBILE` (e.g. 5/day via `PhoneCode.authAccountId`) and count change-mobile codes to numbers with no account in the daily total. |
| S1 | `Nadam-frontend/customer-web/src/pages/account/ProfilePage.jsx:117-123`; `Nadam-backend/src/services/shop/profile.service.js:41-47` | Diff-only patch + `newPin ? null : profile.city/state` → `resolvePlace` throws `PINCODE_NOT_FOUND` for an unknown pincode when city/state equal the saved ones. Test `tests/api/shop/me.test.js:47-48` locks the server side in. | In `save()`, if any of pincode/city/state changed, send all three. |
| S2 | `Nadam-backend/src/services/shop/profile.service.js:142-161` | No step-up, no revoke of other sessions, no notice to the old number. | Require a fresh code to the current number (or a sign-in code within ~10 min) before `mobile/code`, then `Sessions.revokeAllFor(accountId, …, { exceptId: current })` and SMS the old number. |
| S3 | `Nadam-backend/src/services/shop/session.service.js:238-245` | `signOutSession` revokes the row only; push tokens stay linked (`logoutAll` unlinks at `:203-204`). `PushToken` has no session link. | Store `sessionId` (or the start session id) on `PushToken` at subscribe and unlink/remove `orders` topic in `signOutSession` (and on `TOO_MANY`/expiry). |
| S4 | `Nadam-frontend/customer-web/src/pages/account/DeletePage.jsx:46`; `Nadam-backend/src/services/shop/account.service.js:42-86` | `Order.shippingAddress` JSON and `Invoice.customerName/customerMobile` are untouched by `deleteCustomer`. | Reword to "kept for tax with the name, mobile and delivery address on them" (or decide with the accountant what can be masked, then mask it). |
| Sm1 | `ProfilePage.jsx:91-92` | `useState(base)` never re-syncs; `base` does (AccountLayout refreshes the store on tab change/visibility). | Diff against the values the form was opened with, or reset untouched fields when `customer` changes. |
| Sm2 | `profile.service.js:31-37` | Email uniqueness without ownership proof. | Verify by email link before it counts as "taken", or let an unverified email be replaced by a verified sign-up. |
| Sm3 | `profile.service.js:32-33`, `:137-140`; `routes/shop/index.js:64` | Enumeration via `EMAIL_TAKEN`/`MOBILE_TAKEN`; `PATCH /me` has no rate limit. | Add a per-account limit on `PATCH /me` email changes and on `mobile/code`; consider a neutral reply for `MOBILE_TAKEN` until the code step. |
| Sm4 | `DeletePage.jsx:29-34`; `AccountLayout.jsx:33-38` | Second call (`me()`) failure is reported as the action failing. | Use the returned `deletion` to patch the stored customer; refresh in the background. |
| Sm5 | `AddressForm.jsx:59`; `api/client.js:10` | POST is not idempotent. | Send a client id with the new address (unique per account) or detect an identical address saved in the last minute. |
| Sm6 | `address.service.js:72-75`; `models/address.model.js:19-20` | `newest` orders by `updatedAt`, which `clearDefault` also bumps. | Pick by last order use or `createdAt`, and name the new default in the toast. |
| Sm7 | `profile.service.js:110-114` | `oldKey` read from `req.customer.account` before the update. | Read and swap `avatarKey` inside one transaction (`UPDATE … RETURNING` old key), delete the old file after. |
| Sm8 | `ProfilePage.jsx:49` | `ex.reference` ignored. | Show `Reference: …` like the save alert. |
| Sm9 | `ChangeMobile.jsx:75` | `retryAfterSeconds` ignored in `verify`. | Reuse the wait text from `sendCode` (line 45). |
| Sm10 | `ProfilePage.jsx:20`; `validators/shop/common.js:51-64`; `utils/validate.js:40-45` | `toISOString()` (UTC) for "today"; server ages in UTC, website in local time. | Use Asia/Kolkata dates on both sides. |
| Sm11 | `account.service.js:29`, `:74-75`; `models/session.model.js:33-34` | Revoked customer sessions (non-rotated reasons) are never deleted; audit metadata keeps the free-text reason. | Delete or blank `ipAddress`/`userAgent` on the account's sessions in `deleteCustomer`; drop the reason after N days. |
| Sm12 | `models/customer.model.js:43-44` | `take: 50`, no `orderBy`; skipped (overdue) rows stay due. | `orderBy: { deleteRequestedAt: 'asc' }` and skip ids that have open orders in the query. |

Other technical notes (no change needed now, or outside this module):
- `AddressForm.jsx:63` puts every server field error into `errors`, but `label`, `isDefault` and `id` have no visible field, so such an error would show nothing. Not reachable from the current screens.
> **Second check: ✅ Correct.**
- `deleteCustomer` (`account.service.js:43-46`) re-reads the profile inside the transaction without a row lock; a "Keep my account" landing in the same millisecond could be overwritten. Very unlikely; `SELECT … FOR UPDATE` on the profile would close it.
> **Second check: ✅ Correct.**
- `listSessions` "Last active" is the last automatic renewal (`Session.createdAt`), not the last click (`session.service.js:231`). Fine for this screen.
> **Second check: ✅ Correct.**
- `deleteRequestBody` uses `.catch({})` (`validators/shop/me.validators.js:24`): a bad body is ignored, not refused. Fine because the reason is optional.
> **Second check: ✅ Correct.**
- `Button` (`components/Button.jsx:8`) does not set `disabled` while loading; CSS blocks mouse clicks (`theme/base.css:64`) but Enter/Space still work. Forms guard with `busy`, so no harm found.
> **Second check: ✅ Correct.**
- The address and device calls always filter by `authAccountId` (`models/address.model.js:10`, `session.service.js:240`); I found no way to read or change another customer's data.
> **Second check: ✅ Correct.**

---

## Second check (26 Oct 2026)

Every finding above was checked again against the code (read only, nothing run).
Counts: **✅ 22 · ⚠️ 1 · ❌ 0** (17 problems M1–Sm12 plus the 6 developer notes).
- ⚠️ Sm9: the wait is not shown in exact seconds, but the message already says "Please wait a minute", which matches the 60-second window.
- Small details on correct findings (no change to the verdict): S1's way out needs **both** city and state changed in one save, not only the state; Sm3's "sign-in is careful not to tell" holds for mobiles, but the sign-up step does reveal a taken email.

Full evidence: [checks/02-my-account-check.md](checks/02-my-account-check.md).

## Third check (26 Oct 2026)

A third checker re-checked the one ⚠️ finding (Sm9) and the second checker's two small-detail notes (S1, Sm3) against the code (read only, nothing run).
Counts: **Second checker right 3 · First reviewer right 0 · Both partly right 0 · Neither right 0.**
- Sm9: the code step already says "Please wait a minute"; only the exact seconds are missing. Stays Small.
- S1: picking a wrong state alone does not get the customer out; both city and state must change in one save. Stays Should fix.
- Sm3: sign-in hides mobiles, but the sign-up step reveals a taken email. Stays Small.

Full evidence: [checks/02-my-account-third-check.md](checks/02-my-account-third-check.md).

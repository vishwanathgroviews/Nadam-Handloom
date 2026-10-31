# Module 1: Sign in

| | |
|---|---|
| **Status** | Built 2026-10-11 (backend + app); automated tests pass. Waiting for real-phone testing (section 15). |
| **Apps** | Admin app on Android and iOS, phone and tablet. No browser version for now. |
| **Users** | Owner and Staff. Customers never sign in to this app. |
| **Mock-up** | [`docs/design/ui-mockup/module-1-sign-in/`](../design/ui-mockup/module-1-sign-in/index.html) |
| **Old system notes** | [`current-system/admin-app-1-login-team-settings.md`](../current-system/admin-app-1-login-team-settings.md) |

## 1. Goal
Only people the owner has invited can get into the admin app. Once in, they stay in for days without being interrupted, and nothing they were doing is ever lost. A stolen PIN on its own is never enough to get in.

## 2. What is in this module
- The groundwork every later module uses: backend setup (`server.js`, MVC folders, connection to the live database), app setup for Android and iOS phones and tablets, design basics, and the test setup.
- First-time setup: SMS code, then a 6-digit PIN, then optional Face ID or fingerprint.
- Daily sign-in with PIN or Face ID / fingerprint.
- New-phone check: a correct PIN on an unknown phone also needs an SMS code.
- Forgot PIN, change PIN, and the one-time upgrade from an old 4-digit PIN.
- Account lock after wrong PINs.
- Staying signed in for 7 days, renewed on every use.
- My devices: see where you're signed in and sign out any of them.
- Log out.
- The messages for "signed out from another device", "signed out for safety", "access removed", "no internet", "server slow or down" and "please sign in again (your work is safe)".

**Not in this module:**
- Inviting staff, removing staff, and the owner signing out a staff member's devices. These are Module 2 (Roles and team); this module only provides what they need underneath.
- Force update and maintenance mode. These are Module 11 (Settings).

## 3. Discussion and decisions

| Date | Topic | What was discussed | Decision |
|---|---|---|---|
| 2026-10-10 | Platforms | Phone, tablet and a Windows browser version were considered. The browser needs extra work for scanning, printing and secure sign-in. | **Android and iOS, phone and tablet only.** The browser version is dropped for now. |
| 2026-10-10 | Who uses the devices | Shared counter tablets would need a "switch user" button. | **Not needed.** Only the owner runs the counter tablet. The shop's devices are the owner's own iPhones and iPads, kept in the shop. |
| 2026-10-10 | How long sign-in lasts | The old app's 15-minute access key looked like a logout risk. In handloom work a phone can sit for hours mid-task. | **Sign-in lasts 7 days with JWT and is renewed on every use.** No idle auto-lock and no surprise logouts. A bad network never logs anyone out. |
| 2026-10-10 | Losing work | A re-sign-in must not wipe a half-built bill or form. | **Unfinished work is saved on the phone as you go** and is restored after signing in. |
| 2026-10-10 | Overall approach | The enterprise flow below was proposed: owner invites, SMS code, 6-digit PIN, trusted devices, Face ID, lockout, device control, audit log. | **Approved by the owner.** |
| 2026-10-10 | Fixes over the old app | Bugs found in the old code (see the old system notes). | Mask the PIN; give fresh tries after a lock ends; the server enforces the resend wait; count tries per mobile number, not per shop Wi-Fi; confirm before logout; record the device on every sign-in. |
| 2026-10-11 | Gaps found in review | The "server slow or down" and "signed out for safety" messages were in the plan but missing from the mock-up. | **Added to the mock-up** (screens "Server slow or down" and "Signed out for safety"). |
| 2026-10-11 | Design | Three palettes, three fonts and layout options were shown in the mock-up's Design options panel. | **Auto theme (follows the phone), Peacock palette, Plus Jakarta Sans, soft corners, woven header + card sign-in, PIN boxes with the phone's keyboard, floating tab bar.** See section 13. |
| 2026-10-11 | SMS provider | Message Central (VerifyNow) is live since 2026-10-04. It creates and checks the codes itself, and its codes last 60 seconds. The owner had already decided to keep the 60-second life. | **Use Message Central. Codes last 60 seconds** instead of the 5 minutes first planned. |
| 2026-10-11 | Open questions | JWT setup, Change PIN, lock steps, database toolkit. | **Short 15-minute access key renewed silently inside a 7-day sign-in; keep Change PIN; locks of 15 → 30 → 60 minutes; Prisma.** |
| 2026-10-11 | Testing | Emulator or real phones. | **Test on real phones** (Android and iPhone), with a separate test app so the shop's current app is not touched. |
| 2026-10-11 | Face ID / fingerprint | A simple yes/no check versus a key locked in the phone's security chip. Because there is no auto-lock, Face ID is used to sign back in after a logout or after 7 days unused, so it must work without a live session. | **Key in the phone's security chip, unlocked only by Face ID / fingerprint; the server checks a signature** (section 8.3). Done properly on both iOS and Android. |
| 2026-10-11 | Face ID library | `react-native-biometrics`, the usual library for biometric keys, has had no release since September 2022. | **Our own small native module** (`modules/nandam-biometrics`) using Apple's and Google's official APIs (Secure Enclave, Keystore, BiometricPrompt). |
| 2026-10-11 | Test app | Testing on real phones must not disturb the shop's current app. | **Separate test app**: "Nandam Admin (Test)", app id `com.nandamhandlooms.admin.test`. Whether the released app replaces the old one (same id and signing key) is decided at release. |
| 2026-10-11 | API address | The old backend serves `/api/v1` on the same domain. | **New API under `/api/v2`**, so both can run side by side during the switch-over. |
| 2026-10-11 | Owner recovery and security extras | What happens if the owner loses their number entirely; optional owner alerts and app-switcher privacy. | **Excluded from Module 1. Decide at the very end of the project** (section 12). |

## 4. How it works

### 4.1 First-time setup
1. The owner invites a mobile number (Module 2).
2. The person opens the app, taps **First time here? Set up your account**, and enters the mobile number.
3. The screen always says "If this number has been invited, we've sent a code". It never reveals whether a number is invited.
4. An SMS code arrives. iPhone offers it above the keyboard. On Android, the keyboard suggests it (SMS one-time-code autofill). Fully automatic reading on Android (SMS Retriever) would need our app's code inside the SMS, which Message Central's own SMS wording does not allow.
5. They set a **6-digit PIN** and type it again to confirm.
6. They are asked whether to turn on **Face ID or fingerprint** on this phone. They can choose "Not now".
7. This phone is now a **trusted device**, and they land on Home.

If the number was already set up, the SMS code still arrives. After it is verified, the app says "This number is already set up" and offers **Sign in** or **Reset PIN**. The account is revealed only to someone who proved they hold the phone.

### 4.2 Daily sign-in
1. The app remembers the last mobile number on this phone: "Welcome back, Name".
2. If Face ID or fingerprint is on, it is offered straight away. After 3 failed tries, it falls back to the PIN.
3. Otherwise they type the 6-digit PIN.
4. If this phone is not trusted yet, they also verify an SMS code (4.3).
5. Anyone still on an old 4-digit PIN is asked to set a 6-digit one before continuing (4.6).

### 4.3 New phone check
A correct PIN on a phone that isn't trusted sends an SMS code to the account's number. Once it is verified, the phone becomes trusted. Someone who has only the PIN still can't get in.

### 4.4 Staying signed in (no surprise logouts)
- Sign-in lasts **7 days** and every use starts a fresh 7 days, so a phone used in the shop each day effectively never signs out.
- There is **no idle lock**. A phone can sit on the counter for hours.
- A dropped network never signs anyone out; the app retries when the network comes back.
- Sign-in is needed again only after 7 days unused, after a logout, after a PIN reset from another phone, if the owner signs this phone out, or if access is removed.
- When that happens mid-task, unfinished work stays on the phone and comes back after signing in.

### 4.5 Forgot PIN
1. Enter the mobile number. The same generic "If this number…" message is shown.
2. Verify the SMS code.
3. Set a new 6-digit PIN.
4. Result: this phone is signed in and trusted, any lock is cleared, and **all other devices are signed out**, because a forgotten PIN may mean someone else knows it.

### 4.6 Upgrading an old 4-digit PIN
Existing team members keep their current PIN; the new app reads the same scrambled PIN values from the database. Anyone who signs in with a 4-digit PIN is asked once to set a 6-digit PIN before continuing.

### 4.7 Change PIN (while signed in)
Enter the current PIN, then the new PIN, then confirm it. The new PIN must differ from the current one. A tick box, **Also sign out my other devices**, is off by default.

### 4.8 My devices
A list of every phone and tablet signed in to this account, showing name, type, "This device" and last active time. Any device except this one can be signed out, or all others at once.

### 4.9 Log out
Ask "Log out on this phone?" first. Logging out ends the session on the server and wipes the sign-in keys from the phone. Unfinished drafts stay on the phone for the same person's next sign-in, and are cleared if a different person signs in.

## 5. Rules (the numbers)

| Rule | Value |
|---|---|
| PIN length | 6 digits. Old 4-digit PINs work once, then must be upgraded. |
| PINs refused | All the same digit (111111), straight runs up or down (123456, 987654), or the last 6 digits of the person's own mobile number |
| Wrong PIN tries before lock | 5, counted **per mobile number**, whether or not the number is registered |
| Lock length | 1st lock 15 min, 2nd lock 30 min, 3rd and later 60 min. The lock count resets after a successful sign-in. Forgot PIN unlocks at any time. |
| After a lock ends | 5 fresh tries |
| SMS code | 6 digits, created and checked by Message Central (VerifyNow). Valid **60 seconds**. We stop after 3 wrong tries, then a new code is needed. The SMS wording is Message Central's. |
| Resend wait | 60 seconds, enforced by the server |
| Codes per hour | At most 5 per mobile number per hour |
| A new code | Cancels the previous unused code |
| Setup or reset step after a verified code | Must be finished within 10 minutes |
| Sign-in length | 7 days, renewed on every use (see 8.1 for how the JWT is issued) |
| Face ID / fingerprint | Per device, optional. Turned off automatically if the phone's own face or fingerprint settings change. |
| Rate limits | Per mobile number and per device, plus a looser per-IP limit, so phones on the shop Wi-Fi don't block each other |

## 6. Edge cases and what the user sees

| Situation | What the user sees |
|---|---|
| Mobile number not 10 digits, or not starting 6–9 | "Enter a 10-digit mobile number" / "Mobile numbers start with 6, 7, 8 or 9" |
| Wrong mobile number or PIN | "That mobile number and PIN don't match. 4 tries left." The same text appears for unknown numbers. |
| Last try left | A warning: "1 try left. After that, sign-in is locked for 15 minutes." |
| Locked | A lock screen with a countdown and **Forgot PIN?** |
| Not set up yet, but trying to sign in | The generic message, plus the "First time here?" link |
| Access removed by the owner | The same generic message at sign-in. On a phone already signed in: "Your access has been removed. Please contact the owner." |
| Signed out from another device | "This phone was signed out from another device." Sign in again. |
| Wrong SMS code | "That code isn't right. 2 tries left." |
| Code expired, or 3 wrong tries | "This code has expired. Send a new code." |
| Too many codes | "Too many codes requested. Try again after 1 hour." |
| SMS not arriving | Resend after 60 s, then the help text "Check the number, or ask the owner to confirm it's invited". |
| Weak PIN | A live checklist shows which rule fails |
| Confirm PIN doesn't match | "PINs don't match. Enter the new PIN again." |
| New PIN same as current (change PIN) | "Choose a PIN different from your current one." |
| Face ID fails 3 times | Falls back to the PIN |
| Face settings on the phone changed | "Face ID was turned off because this phone's face settings changed. Sign in with your PIN to turn it on again." |
| No internet at sign-in | "You're offline. Signing in needs internet. Your work on this phone is safe." |
| No internet while signed in | The app keeps working with an offline banner, and nobody is signed out |
| Server slow or down | The app waits up to 30 seconds, then shows "The server is taking too long. Nothing was lost." Nobody is signed out or locked, and the PIN try isn't counted. Phones already signed in show a banner and keep working. |
| 7 days unused, with an unfinished bill | "Please sign in again. Your unsaved bill is safe on this phone." After sign-in, the bill comes back. |
| Same key used twice (a copied key) | Every session on the account ends and an audit entry is written. Every device shows "Signed out for safety" and asks for the PIN again. |

## 7. Data (same live database)
The new backend uses the **same PostgreSQL database** as the old system, which may still be running during the switch-over. Every change must be **additive**: new tables or nullable columns only, nothing renamed or removed.

**Existing tables used as they are:**
- `AuthAccount`: phone, `mpinHash` (argon2, same as the old system), status, `securityStamp`, `failedLoginAttempts`, `lockedUntil`
- `Session`: the 7-day sign-in, refresh token hash, platform, device name, expiry, revoked
- `OtpCode`: purpose, attempts, expiry, `resendAvailableAt`, and the Message Central verification id (no code is stored on our side)
- `Role`, `UserRole`: ADMIN = Owner, STAFF = Staff
- `AdminProfile`: name
- `AuthEvent`: the audit trail (source `staff_app`)

**Additive changes (built, migration `20261011120000_v2_admin_sign_in`):**
- `AuthAccount.lockCount`: integer, default 0, for the 15 → 30 → 60 minute lock steps.
- `Session.trustedDeviceId` (link to the trusted device), `Session.revokeReason` (why it ended, so the app can say so) and `Session.stampAtIssue` (detects a sign-out from elsewhere). All nullable.
- New table `TrustedDevice`: account, device id (a random id the app creates and keeps in secure storage), name, platform, `biometricPublicKey`, `biometricEnabledAt`, trusted at, last seen at, revoked at.
- New table `AuthChallenge`: one-time Face ID / fingerprint challenges (60 seconds, used once).
- New table `LoginThrottle`: wrong-PIN counting for numbers without an account, so their replies look exactly like a real account's.
- Checked: the old backend's database client still reads and writes the migrated database.

## 8. Security design

### 8.1 The JWT
- **Decided 2026-10-11:** a short access JWT (15 minutes) that the app renews silently in the background, plus a 7-day refresh token that is renewed on every use and replaced each time (rotation). The user never sees the 15 minutes: they stay signed in for 7 days, renewed on use, with no surprise logouts.
- Why: a lost phone or removed staff member is cut off within minutes even if a server check fails.
- Not chosen: a single 7-day JWT checked against the database on every request.

### 8.2 Everything else
- The PIN is stored only as an argon2 hash. SMS codes are created and checked by Message Central; our server keeps only the provider's verification id and the try count.
- Sign-in keys are kept in the iOS Keychain or Android Keystore, never in plain storage.
- HTTPS only.
- Error messages never reveal whether a mobile number is registered.
- Refresh-token reuse ends every session on the account and is logged.
- Changing `securityStamp` cuts off every key already issued. This happens on PIN reset, access removal and owner sign-out-all.
- Every sign-in, failed try, lock, code request, PIN change, device trust and sign-out is written to `AuthEvent` with the device and IP.

### 8.3 Face ID / fingerprint (iOS and Android)
**How it works:**
1. When someone turns it on, the phone creates a **private key inside its security chip**: the Secure Enclave on iPhone and iPad, the hardware Keystore on Android. The key can never leave the phone.
2. The phone is set so this key can be used **only after a successful Face ID / Touch ID / fingerprint check**.
3. The server saves the matching **public key** against this trusted device.
4. To sign in, the server sends a one-time challenge (valid 60 seconds). The phone asks for Face ID or fingerprint, signs the challenge with the key, and sends the signature back. The server checks it with the public key, then starts the 7-day sign-in.
5. The face or fingerprint itself never leaves the phone and is never seen by the app.

**Rules on both platforms:**
- Only on a trusted device. Signing that device out, "signed out for safety", a PIN reset and access removal all delete the public key on the server, so Face ID stops working there until the next PIN sign-in.
- It works after a logout and after 7 days unused. Those are the moments it's actually used, because there is no auto-lock.
- If the phone's face or fingerprint settings change, the phone **destroys the key by itself**. The app then says "Face ID was turned off because this phone's face settings changed", asks for the PIN, and offers to turn it on again.
- "Use PIN" is always available on the prompt.
- Turning it off in My account deletes the key on the phone and on the server.

**iPhone and iPad:**
- Uses Face ID, or Touch ID on models that have it; the app shows the right name automatically.
- The key is tied to the faces or fingers enrolled right now, so adding a new face or finger invalidates it.
- The app must include the Face ID permission text. After several failed tries, iOS itself asks for the phone's passcode; our app offers "Use PIN" instead.

**Android:**
- Uses Android's biometric prompt with **strong (Class 3) biometrics** only. On most phones that means fingerprint.
- Face unlock is offered only on phones where Android rates it strong (for example Pixel). Basic face unlock on many Android phones is not secure enough to unlock the key, so the app won't offer it there and says "Use fingerprint or PIN".
- The key is invalidated when fingerprints are added or removed.

**Library (decided):** our own native module, `Nadam-frontend/admin-app/modules/nandam-biometrics`. The iOS side is Swift with the Secure Enclave, LocalAuthentication and `biometryCurrentSet`. The Android side is Kotlin with the Keystore (StrongBox when available) and androidx BiometricPrompt with `BIOMETRIC_STRONG` and `setInvalidatedByBiometricEnrollment(true)`.

**API:** see 9.1 (`/api/v2/me/biometric`, `/api/v2/auth/biometric/challenge`, `/api/v2/auth/biometric/login`).

## 9. Backend (MVC)

```
Nadam-backend/
  server.js
  src/
    config/        env, database, jwt settings
    models/        AuthAccount, Session, OtpCode, TrustedDevice, AuthEvent, Role
    controllers/   auth.controller.js, me.controller.js
    services/      pin.service.js, otp.service.js, sms.service.js, token.service.js, device.service.js, audit.service.js
    routes/        auth.routes.js, me.routes.js
    middlewares/   authenticate.js, rateLimit.js, validate.js, errorHandler.js
    validators/    auth.validators.js
  tests/
```

The controller reads the request and calls a service. The service holds the business rules and talks to the models. The route wires the URL to the controller through the middlewares.

### 9.1 API (built, all under `/api/v2`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Database and SMS status |
| POST | `/auth/setup/request-code` | Request a setup code (always the generic reply) |
| POST | `/auth/setup/verify-code` | Verify it; returns `set_pin` or `already_set_up` with a step token |
| POST | `/auth/forgot/request-code` | Request a reset code (generic reply) |
| POST | `/auth/forgot/verify-code` | Verify it; returns a reset step token |
| POST | `/auth/pin/set` | Set the PIN (setup, reset or 4-digit upgrade) and sign in |
| POST | `/auth/login` | Mobile + PIN + device; returns `signed_in`, `verify_device` or `upgrade_pin` |
| POST | `/auth/device/request-code` | New-phone check: send the code |
| POST | `/auth/device/verify-code` | New-phone check: trust this phone and sign in |
| POST | `/auth/biometric/challenge` | Face ID / fingerprint: one-time challenge |
| POST | `/auth/biometric/login` | Face ID / fingerprint: signed challenge, sign in |
| POST | `/auth/refresh` | Renew the sign-in (rotation; reuse ends every session) |
| POST | `/auth/logout` | End this session |
| GET | `/me` | Who am I, this device, sign-in expiry |
| GET | `/me/devices` | My signed-in devices |
| DELETE | `/me/devices/:id` | Sign out one device |
| POST | `/me/devices/sign-out-others` | Sign out all my other devices (old-app sign-ins too) |
| POST | `/me/pin/verify` | Change PIN, step 1: check the current PIN |
| POST | `/me/pin/change` | Change PIN, step 2: save the new PIN |
| POST / DELETE | `/me/biometric` | Turn Face ID / fingerprint on or off for this device |

Every error is `{ error: { code, message, details } }`. The app switches on `code`, for example `INVALID_CREDENTIALS` (with `triesLeft`), `LOCKED`, `WRONG_CODE`, `CODE_EXPIRED`, `STEP_EXPIRED`, `SIGNED_OUT_FOR_SAFETY` or `ACCESS_REMOVED`.

## 10. Testing plan
- **Unit:** PIN rules, lock steps, code expiry and attempts, resend wait, token rotation and reuse detection.
- **API integration:** every endpoint and every edge case in section 6, against a **test copy** of the database, never the live one.
- **Real phones** (decided 2026-10-11): every flow in section 4, and every Face ID / fingerprint case in 8.3, on a real Android phone and a real iPhone. Add a tablet if one is available.
- Use a **separate test app** ("Nandam Admin (Test)", its own app id) so the shop's current app is never replaced during testing.
- Most tests use the backend's test mode, which shows the SMS code instead of sending it. Real Message Central SMS is used only for the final checks, because each code costs credit.
- **Compatibility:** an existing account signs in to the new app with its current PIN, including a 4-digit one, while the old app keeps working on the same database.

## 11. Open questions (all answered)
1. ~~JWT~~ **Answered 2026-10-11:** short access key + 7-day sign-in (8.1).
2. ~~Change PIN~~ **Answered 2026-10-11:** keep it.
3. ~~Lock steps~~ **Answered 2026-10-11:** 15 → 30 → 60 minutes.
4. **"Also sign out my other devices" off by default on Change PIN:** OK?
5. ~~SMS provider~~ **Answered 2026-10-11:** Message Central (VerifyNow), codes valid 60 seconds. Keep its credit topped up, or codes stop arriving.
6. ~~Database toolkit~~ **Answered 2026-10-11:** Prisma.
7. ~~Design choices~~ **Answered 2026-10-11:** see section 13.

## 12. Excluded from Module 1 (decide at the very end)
Agreed on 2026-10-11: these are noted here and decided at the very end of the project, not in Module 1.
1. **Owner loses their phone number completely.** Forgot PIN needs an SMS to that number, so nobody could get back in. Suggested answer: always keep a second owner account as a backup, plus a written reset process for the developer.
2. **Optional security extras:**
   - An in-app alert to the owner when an account gets locked or a new phone is added. It would be in-app, because push notifications are switched off at the client's request.
   - Hiding the app's screen in the phone's app switcher.

## 13. Design (chosen 2026-10-11)
Picked in the mock-up's Design options panel. This becomes the design system for every module.

| Option | Choice |
|---|---|
| Theme | Auto: follows the phone's light or dark setting |
| Colour palette | Peacock: deep teal `#0D5C61` with copper `#C46A35` (dark mode: `#5FC6BE` and `#E8996A`) |
| Font | Plus Jakarta Sans |
| Corners | Soft |
| Sign-in layout | Woven header with the logo, form on a card |
| PIN entry | Six boxes with the phone's own number keyboard |
| Main menu on phones | Floating tab bar (tablets use a side menu) |

The full colour tokens for light and dark are in `docs/design/ui-mockup/module-1-sign-in/assets/mock.css` (palette B).

## 14. Build steps
Each step ends with a check before the next one starts.

**Step 0: Setup (once, used by every module)**
1. Make a **copy of the database** on the developer's Mac in local PostgreSQL. Add test accounts that use the tester's own mobile number. Real staff numbers are never sent SMS during testing.
2. Create `Nadam-backend/`: `server.js` and `src/config`, `models`, `controllers`, `services`, `routes`, `middlewares`, `validators`, plus `tests/`. Prisma reads the copy so the models match the live tables exactly.
3. Apply the additive database changes (section 7) to the **copy only**.
4. Create the admin app in `Nadam-frontend/` (Expo, Android and iOS, phone and tablet layouts) with the chosen design (section 13).
5. Set up the tests: backend unit and API tests against the copy, and app component tests.
- *Check:* the backend starts, connects to the copy, and the empty app opens on a real phone.

**Step 1: Sign-in backend**
1. PIN rules: argon2, 6 digits, refused PINs, 4-digit upgrade.
2. Locks of 15 → 30 → 60 minutes, counted per mobile number; generic error messages.
3. SMS codes through Message Central: 60-second life, resend after 60 seconds, 5 an hour, 3 wrong tries. Plus a test mode that shows the code instead of sending it.
4. Sign-in keys: a 15-minute access JWT and a 7-day rotating refresh token. Reuse signs out every device ("signed out for safety"). The security stamp cuts off old keys.
5. Trusted devices and the new-phone check; My devices; signing out one device or all others.
6. Face ID / fingerprint API (8.3).
7. Forgot PIN, Change PIN, log out.
8. An audit entry for every event.
9. Automated tests for every rule in section 5 and every edge case in section 6.
- *Check:* all tests pass; the results are written in this document.

**Step 2: App screens**
1. All 24 screens from the mock-up, for phone and tablet.
2. Keys kept in the iOS Keychain or Android Keystore; silent renewal; never signed out by a network problem; unfinished work saved on the phone.
3. Face ID / Touch ID / fingerprint exactly as in 8.3.
- *Check:* every screen matches the mock-up, and the app's own tests pass.

**Step 3: Real-phone testing**
1. Install the separate test app: an APK on the Android phone, and TestFlight on the iPhone.
2. Run the backend where the phones can reach it: on the Mac on the same Wi-Fi, or a test server.
3. Go through the full checklist: every flow in section 4, every edge case in section 6, and every Face ID / fingerprint case in 8.3. The Face ID cases are turn on, succeed, fail, cancel to PIN, change face or fingerprint settings, and sign the device out.
4. Final checks with real Message Central SMS. Top up the credit first.
5. Fix, retest, and record the results here.
- *Check:* the owner reviews on their phone and signs off. Then commit to `develop` (only when the owner says) and start Module 2.

## 15. Build status (2026-10-11)

| Check | Result |
|---|---|
| Backend automated tests (Vitest + Supertest, against a fresh copy of the database) | **64 of 64 pass**. They cover setup, sign-in, locks 15/30/60, unknown numbers, the new-phone check, the 4-digit upgrade, sessions (rotation, races, theft, expiry, access removed, stamp change), Forgot PIN, My devices, Change PIN and Face ID signatures. |
| Old backend on the migrated database | Its Prisma client reads accounts and roles and writes sessions without problems |
| App logic tests (Jest) | **32 of 32 pass**. They cover PIN rules, phone numbers, silent renewal (one at a time, races), every sign-out code and its message, staying signed in offline, Face ID turn-on and sign-in errors, and drafts. |
| App bundles (Android and iOS) | Build without errors |
| `expo-doctor` | 21 of 21 checks pass |
| Android native build (including the Kotlin fingerprint module) | **Builds.** Test APK 54 MB (`android/app/build/outputs/apk/release/app-release.apk`). |
| Android emulator walk-through | **Passed.** Sign in on a new phone (PIN, SMS check, Home), My account, turn on fingerprint (Keystore key, prompt, server stores the public key), log out, **fingerprint sign-in** (challenge, signature, server check, Home), Forgot PIN screen. |
| iPhone native build (including the Swift Face ID module) | **Blocked on this Mac.** Expo SDK 57 needs Xcode 26 (Swift 6.3); the Mac has Xcode 16.4 (Swift 6.1). Needs an Xcode update or Expo's cloud build. The Swift code is written but not yet compiled. |
| Real-phone testing (Android) | **Done on a Samsung Galaxy Note10 Lite, Android 12, over the shop-style Wi-Fi.** See section 16. |
| Real-phone testing (iPhone) | Not done yet: waiting for the iPhone build (Xcode 26 or Expo cloud build). |

**Bugs found and fixed while testing:**
- After 3 wrong codes, typing the right code said "wrong code, 2 tries left" instead of "too many wrong tries".
- A request sent with the previous key during a silent renewal would have signed the person out.
- Status-bar text stayed white on light screens.
- The keyboard hid the main button on Android.
- My account didn't notice a fingerprint added in the phone's Settings until you changed screens.
- "Fingerprint" was capitalised mid-sentence.
- Android showed the model code instead of the phone's name.

**Before real-SMS testing:** switch the test accounts to the tester's own mobile number, and top up the Message Central credit.

## 16. Real-phone test results (Android, 2026-10-11)
Phone: Samsung Galaxy Note10 Lite (SM-N770F), Android 12, dark mode. Backend on the developer's Mac over the same Wi-Fi, SMS in test mode.

| # | Test | Result |
|---|---|---|
| 1 | New phone: correct PIN, then SMS check (wrong code gives "2 tries left", then the right code), then Home | ✅ |
| 2 | Close and reopen the app: straight to Home, sign-in renewed silently | ✅ |
| 3 | No connection to the server: stays signed in with the banner; banner clears when back | ✅ |
| 4 | My devices: real phone names ("Galaxy Note10 Lite"); sign out the other device, which then shows "This phone was signed out" | ✅ |
| 5 | Change PIN: wrong current PIN ("4 tries left"), weak PIN refused, new PIN saved | ✅ |
| 6 | Log out, then sign in with the new PIN on the trusted phone (no SMS) | ✅ |
| 7 | 4 wrong PINs give "1 try left"; the 5th gives the lock screen with a live 15-minute countdown | ✅ |
| 8 | Forgot PIN from the lock screen: code, new PIN, "PIN changed", lock cleared | ✅ |
| 9 | Old 4-digit PIN: SMS check, forced 6-digit PIN, "PINs don't match" check, Home as Staff | ✅ |
| 10 | Staff do not see the owner's Team section | ✅ |
| 11 | First-time setup: code, PIN rule "not the end of your mobile number", "You're all set" (fingerprint step skipped when none is enrolled) | ✅ |
| 12 | Server ends the sign-in: 7 days unused, signed out for safety, access removed. Each shows the right screen; access removed also forgets the remembered name. | ✅ |
| 13 | Fingerprint on the real phone | ⏳ Needs a fingerprint enrolled on the phone (none was). Already proven on the Android emulator end to end. |
| 14 | Tablet layout on a real tablet | ⏳ No tablet connected |

**Found on the real phone and fixed the same day:**
- The keyboard stayed open after a PIN or code screen, which also stalled the next screen's entry animation.
- The floating tab bar covered the Change PIN form while the keyboard was open.
- The 4-digit PIN Sign in button was under the keyboard. The keyboard's Done key now signs in.
- Wording: "Set up fingerprint".

## Change 16 Oct 2026: guesses at the same moment, lost renewal replies, Face ID with the PIN
From the check of 16 Oct (to-do section 4d). Server live 16 Oct 15:33 IST; the app part is in Android build 29 / iPhone build 11 (not given to testers yet).
- **PIN tries are taken before the PIN is checked**, in one database step (`authAccount.model.takePinTry`, `loginThrottle.model.takeTry`, `lock.service.takeTry/failedTry`). Twenty wrong PINs sent at once: 4 say "wrong PIN", the 5th starts the lock, the rest are refused as locked; the right PIN then waits for the lock too. Numbers with no account answer the same way. "Change PIN" (`/me/pin/verify`) uses the same tries.
- **SMS codes** (setup, Forgot PIN, new phone): the try is counted before the code is checked; the SMS service failing doesn't use a try; a code the service says was already checked (a lost reply) closes ("Send a new code"); two requests with the right code can't both win.
- **A renewal whose reply was lost** (weak shop Wi-Fi): every renewal now records the one it replaced (`Session.parentId`) and the first request made with it (`Session.usedAt`, database update `20261016130000_v2_session_used_at`, additive). When the phone sends the older key again and the newer one was never used, the newer one is replaced (`superseded`) and the phone carries on: nobody is signed out. When the newer one was used, the older key is a copy and every device is signed out for safety, as before.
- **Turning on Face ID / fingerprint needs the PIN** (`POST /me/biometric` with `pin`). My account → Face ID opens a "Turn on Face ID" page that asks for the PIN first; right after choosing a PIN (setup), the PIN just chosen is used (memory only, 10 minutes). Older app versions don't send it, so the server only requires it once `BIOMETRIC_NEEDS_PIN=true` is set in `.env` (after the new version is on every phone); until then a PIN that is sent is still checked.
- Tests: `tests/api/admin-edge-cases.test.js`, `tests/api/session.test.js` (lost reply, copied key), app `src/auth/biometrics.test.js`, `src/hooks/navigation.test.js` (the new page opens on top).
- Not changed: the **old server**'s PIN sign-in (`/api/v1`) has the same weakness; the owner decided not to change the old server (it is switched off after the new website is finished).

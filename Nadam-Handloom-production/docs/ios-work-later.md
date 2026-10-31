# iPhone work, kept for later

Saved on 17 Oct 2026 at the user's request ("note it down separate, we will work later"). **Nothing here starts without the user's go.** iPhone cloud builds are limited (15 a month on Expo's free plan), so all of this goes into **one** build.

## 1. What waits for the next iPhone build
| What | State |
|---|---|
| Face ID needs the PIN (admin app, to-do 4d) | Built in build 11 (kept on the Mac, never uploaded) |
| **Online payments** in the admin app (More → Online payments) | Built and tested; on Android since build 30 |
| **Payment notifications** to owners' iPhones | App and server built. iPhone needs the steps below |

Next iPhone build number: **12** (`IOS_BUILD` in `Nadam-frontend/admin-app/app.config.js`; build 11 was never uploaded, but its number is used).

## 2. iPhone notifications: the steps
1. **Apple push key (the owner, or whoever has the Apple Developer login, team Groviews):**
   - Go to developer.apple.com → Certificates, IDs & Profiles → **Keys** → **+**.
   - Name it "Nandam push" and tick **Apple Push Notifications service (APNs)**.
   - Download the `.p8` file. It can be downloaded only once: keep it safe.
   - Send the file, its **Key ID** and the **Team ID**.
   - Note: `ios-release/AuthKey_65F93N96X2.p8` is the App Store upload key, **not** a push key.
2. **Server `.env`** (the one file, live server):
   - `APNS_KEY_ID`, `APNS_TEAM_ID`;
   - `APNS_PRIVATE_KEY` (the `.p8` text on one line with `\n`);
   - `APNS_BUNDLE_ID=com.nandamhandlooms.staff`, `APNS_PRODUCTION=true` (TestFlight uses Apple's live service);
   - restart `nandam-v2`.
3. **Turn on Push** for the app id `com.nandamhandlooms.staff`. This can be done with the App Store Connect API key we already use. Then make a **new App Store signing profile** that includes Push, and put it in the app's private `credentials.json` / `ios-release/`.
4. **Build with `IOS_PUSH=true`.** Without it, iPhone builds deliberately leave the push permission out, so they keep building with today's profile. Also set `APP_VARIANT=production` and raise `IOS_BUILD` to 12. Upload to TestFlight.
5. Add the build to the "Current app" group **only when the owner says**.
6. **Test on an iPhone:**
   - iPhone asks "Allow notifications?" when the owner turns on More → Notifications → Payment notifications;
   - "Send a test notification";
   - a real (test-mode) website payment, then "New online order" on the iPhone;
   - a tap opens that payment, with the app in the background and closed.
   - The server's Apple sender is already tested against a stand-in server (`tests/api/onlinePayments.test.js`). Real delivery is not tested yet.

## 3. Other iPhone checks still open
- The admin app on a real iPhone, all modules, and an iPad's two-column layout (to-do section 4).
- The website on iPhone Safari: sign-in with a real SMS, the bag, checkout with Razorpay's real window; website notifications need "Add to Home Screen" first (to-do 4b, 4c).

## 4. Related
- Android, done on 17 Oct (real phone): `modules/web-04-checkout.md` section 20.
- How iPhone builds go out: memory note "iOS / TestFlight build" and `docs/deployment/live-v2-server.md`.

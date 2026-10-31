# Module 11: Settings

| | |
|---|---|
| **Status** | **Built, 2026-10-12** (section 16). Picks: **Layout A (one page with sections)**, **Saving A (each change saves on its own; switches ask first)**. Decisions per the ⭐ recommendations. **Tested on a real Android phone, 2026-10-12** (section 17: all 13 checks passed; 9 problems found and fixed). Open checks: section 19. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners (`settings.manage`). Staff only see the results: the maintenance screen and the update screen |
| **Builds on** | [Module 1](module-01-sign-in.md) (the two items parked for the end, section 12), [Module 2](module-02-roles-and-team.md) (owners, main owner), [Module 5](module-05-scan-to-sell.md) (the invoice letterhead), [Module 7](module-07-orders.md) (the website address in the WhatsApp message), [Module 10](module-10-activity.md) (who changed what) |
| **Mock-up** | [`docs/design/ui-mockup/module-11-settings/`](../design/ui-mockup/module-11-settings/index.html) |
| **Old system notes** | [`current-system/admin-app-1-login-team-settings.md`](../current-system/admin-app-1-login-team-settings.md) (App Settings, AppGate) |

## 1. Goal
One owner-only page to **run the app itself**: pause the staff app or the website for maintenance, make every phone move to a new version, keep the shop details printed on invoices right, and see the shop's fixed rules, without asking a developer.

## 2. What is in this module
- **Maintenance:** pause the **staff app** (staff see your message; owners keep working) and the **website** (customers see your message).
- **App updates:** "a new version is available" and "update required", for Android and iPhone; the simple way: **"Require this version for everyone"** from a phone that already has it.
- **Shop details:** name, address, mobile, GSTIN (printed on every invoice) and the website address (product links in WhatsApp messages).
- **Shop rules:** the fixed numbers the app uses (bargain warning, running low, sign-in days…), shown so everyone knows them.
- **About:** this phone's version, the server's version, owners who can sign in.
- **What staff see:** the maintenance screen, the update screen, the "new version" banner.
- The two items parked in Module 1: **an owner who loses their number**, and **hiding the app in the app switcher** (6.9, 6.10).

**Not in this module:**
- Team, roles, phones: Module 2. Prices and photos: Module 3.
- Phone notifications: with the website move.
- Backups of the database: run on the server (outside the app).

## 3. What is saved today (copy of the live data, 2026-10-11)
| What | Value |
|---|---|
| Staff app maintenance | Off, no message |
| Website maintenance | Off, no message |
| Android | Newest build saved: **23**, but the shop's app is at **25**; oldest allowed 0; no forced update |
| iPhone | Newest build saved: **3**, but the app is at **6**; oldest allowed 0 |
| Last saved | 4 Oct 2026, **by nobody recorded** |
| Shop details on invoices | Nandam Handlooms · Hussain Katta, Mangalagiri, Andhra Pradesh 522503 · +91 94941 70180 · GSTIN 37CCWPN2487C1Z2 (a server setting only a developer can change) |
| Website address | Not set (product links in WhatsApp messages need it, Module 7) |
| App ids | Old app **com.nandamhandlooms.staff**. iPhone: the new app keeps this id and is an update of the old app on TestFlight (6.8, decided 2026-10-13). Android: still to decide (planned com.nandamhandlooms.admin) |
| Owners | 5 owner accounts |

So the "new version available" banner has never shown, and nobody can tell who last changed these switches.

## 4. Problems in the old app
1. **Build numbers are typed by hand** and are already out of date (23 saved, 25 installed).
2. **Maintenance is only in the app:** the server still serves staff, so an old or changed app ignores it; staff can even sign in first.
3. **Who changed the settings is saved but never shown.**
4. **A save error appears at the top of a long page while Save is at the bottom.**
5. **Shop details and the website address need a developer** (server settings).
6. One long page mixes maintenance, Android, iPhone and links.

## 5. How it will work

### 5.1 The Settings page (pick A: one page, sections)
More → **Settings** (owners): Maintenance · App updates · Shop details · Shop rules · About. Each section shows "Last changed by Lakshmi, 12 Oct, 7:30 pm".

### 5.2 Maintenance (6.2, 6.3)
- **Staff app:** a switch and a message ("Updating prices, back at 6 pm"). Turning it on asks first: "Staff will see your message and can't sell or ship until you turn it off. Owners keep working." Staff phones show the maintenance screen within a minute (and at once when they try anything); **the server refuses staff too** (6.3).
- **Website:** the same for customers (the old website reads the same switch).

### 5.3 App updates (6.4)
- Shows, for Android and iPhone: **this phone's version**, the newest version, the oldest version still allowed.
- **"Require this version for everyone"** (on a phone that has the new version): every phone on an older version must update before it can be used. It warns first, e.g. "3 phones signed in this week use an older version".
- **"Tell phones a new version is available"**: a banner only, nobody is blocked.
- Advanced: the numbers and the store link, as today, for a developer.

### 5.4 Shop details (6.5)
Name, address, mobile, GSTIN (checked: 15 characters in the GST format), website address. A preview of the invoice letterhead. **New invoices use the new details; invoices already made keep theirs.**

### 5.5 Shop rules (6.6)
Read-only list: a warning when a saree is sold under half its store price; running low at 1–3 sarees; check delivery after 10 days; unpaid checkouts kept 30 days (Home shows 7); signed in for 7 days; up to 5,000 sarees in stock; sign-in records kept 1 year, everything else for years.

### 5.6 About
This phone's version and build, the server's version, "Owners who can sign in: 5", and a link to the Activity log filtered to settings changes.

## 6. Decisions
| # | Question | Options | Recommendation |
|---|---|---|---|
| 6.1 | **Who changes Settings** | A ⭐ Any owner (as today), every change in the Activity log with before → after · B The main owner only | **A.** Every owner can already do bigger things; the log shows who did it |
| 6.2 | **Turning maintenance on** | ⭐ Asks first, shows who turned it on and since when; staff phones switch within a minute | A switch that locks staff out should never be an accident |
| 6.3 | **Maintenance on the server** | A Only in the app (as today) · B ⭐ The server also refuses staff requests (owners still work) | **B.** Real maintenance, not just a screen |
| 6.4 | **App updates** | A Type build numbers (as today) · B ⭐ "Require this version for everyone" from an updated phone, with a warning about older phones still in use; numbers under Advanced | **B.** No typing; can't be out of date |
| 6.5 | **Shop details** | A Server setting, developer only (as today) · B ⭐ Owners edit them in Settings (GSTIN checked); new invoices only | **B.** The shop's own details shouldn't need a developer |
| 6.6 | **Shop rules** (half-price warning, running low, 10 days…) | A ⭐ Fixed, shown read-only · B Owners can change each number | **A.** Fewer ways to break things; ask and a rule can become a setting |
| 6.7 | **Website address** | ⭐ Set in Shop details (also used for the WhatsApp product links) | Needed for Module 7's message |
| 6.8 | **How phones move to the new app** | A ⭐ Same app id as the old app (com.nandamhandlooms.staff) with build 26 or later: phones simply update, nothing to reinstall · B A new app (com.nandamhandlooms.admin): the old app's update screen points staff to install it | **A** if the old signing key and store access are available (the old project has a release key); otherwise B. **iPhone: A, decided 2026-10-13** (version 2.0.0, build 7 onwards; old app stopped at build 6). Android: decide before release |
| 6.9 | **An owner who loses their phone number** (parked from Module 1) | ⭐ Keep at least 2 owners. Another owner removes the lost number and invites the new one (Module 2's rule: numbers are never edited). Settings warns when fewer than 2 owners can sign in. If the only owner loses it: the developer's written reset steps | No way back in otherwise; 5 owner accounts today |
| 6.10 | **Hide the app in the phone's app switcher** (parked from Module 1) | A ⭐ Not now: on Android it also blocks screenshots, which staff use to share; Home's eye button already hides amounts · B Hide it | **A.** Ask if you want it |
| 6.11 | **Maintenance at a set time** | A ⭐ No: switched on and off by hand · B Schedule a start and end | **A.** Maintenance is rare; a schedule can be added later |

## 7. Screens and mock-up picks
| Screen | What's on it |
|---|---|
| Settings | Maintenance, App updates, Shop details, Shop rules, About; "Last changed by" |
| Turn on maintenance | The confirm sheet with the message |
| App updates | This phone's version, newest, oldest allowed, Require / Tell, Advanced |
| Shop details | The form, GSTIN check, letterhead preview |
| What staff see | Maintenance screen, Update required screen, "new version" banner |
| Settings · Staff | "For owners" |

**Picks (mock-up "Design options"):**
- **Layout:** A · one page with sections / B · a list of rows, each opening its own page. **Picked: A.**
- **Saving:** A · each change saves on its own (switches ask first) / B · one Save button at the bottom of the page. **Picked: A.**

## 8. Rules
| Rule | Value |
|---|---|
| Maintenance | Staff see the screen and the server refuses their requests (except sign-in check and the settings the screen needs); owners unaffected |
| Maintenance reminder | While the staff app is paused, owners' Home shows "Staff app paused since 3:10 pm by Lakshmi" |
| Messages | Up to 300 characters each |
| Update required | A phone below the oldest allowed version (or below the newest with "update required" on) shows the update screen, owners too, signed in or not |
| New version banner | A phone below the newest version, not blocked; "Later" hides it for a day |
| GSTIN | 15 characters: 2 digits, 5 letters, 4 digits, a letter, a digit or letter, Z, a digit or letter |
| Website address | Starts with https:// |
| Store links | Start with https:// (empty: the built-in Play Store / App Store link) |
| Every change | Activity log (Settings kind), with before → after and who |

## 9. Data (same live database)
- Keeps the shared `AppConfig` row (the old app and the old website read it too).
- **Additive changes:** migration `v2_settings`: `AppConfig` gets shop name, address, mobile, GSTIN, website address and who changed maintenance when. Empty values fall back to today's server settings, so nothing changes until an owner saves.
- The Activity log gets a **Settings** kind (Module 10).

## 10. API (as built, under `/api/v2`)
| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/app-status` | `{ maintenance: { staff, website: {on, message} }, updates: { android, ios: {newest, oldest, required, link} } }` for the app's start-up check | Everyone (no sign-in) |
| GET | `/settings` | Everything on the page: maintenance (since, by), updates (this phone's version from the request, phones used this week with their version), shop details, owners who can sign in, the server's version, who changed each section last | settings.manage |
| PATCH | `/settings/maintenance` | `{ staff?: {on?, message?}, website?: {on?, message?} }` | settings.manage |
| PATCH | `/settings/updates` | `{ platform, newest?, oldest?, required?, link? }`, or `{ platform, requireThisPhone: true }` / `{ platform, tellThisPhone: true }` (uses the version the phone sends) | settings.manage |
| PATCH | `/settings/shop` | `{ name, address, mobile, gstin, website }` | settings.manage |

While the staff app is paused, every staff request except their own profile (`GET /me`) gets `503 MAINTENANCE` with the owner's message.

## 11. Building blocks
**Backend:** `models/settings.model.js`, `services/settings.service.js`, a maintenance check in the request pipeline (staff only), the invoice letterhead reading the saved shop details, the WhatsApp message reading the saved website address, routes, tests, the Activity sentence for settings changes.

**App:** More → Settings (owners), the sections, the start-up check (maintenance screen, update screen, banner), reading this phone's version from the app.

## 12. Steps
1. Plan (this document).
2. Mock-up, clickable, in Chrome. ✅ (80/80 browser checks)
3. Backend + tests. ✅ (section 16)
4. App + tests. ✅ (section 16)
5. Real-phone test ✅ (section 17): staff maintenance on → staff phone shows the screen and can't sell; owner still sells; off again; website switch saved; require this version (and a pretend older build sees Update required); shop details change → a new invoice shows them, an old one doesn't; staff can't open Settings; each change in Activity.
6. Results written here; open checks to the full-app test list. ✅

## 13. Testing plan
- **API:** owners only; maintenance blocks staff requests and not owners; the start-up check without sign-in; update rules (below oldest, required); GSTIN and link checks; shop details on new invoices only; every change in the Activity log with before → after.
- **App:** version comparison, GSTIN check, message length.
- **Real phone:** section 12, step 5.

## 14. Risks
| Risk | Handling |
|---|---|
| An owner locks everyone out with "update required" before the new version is in the store | The warning names the phones still on older versions; owners keep a way out (only from a phone that already has that version) |
| Maintenance left on by mistake | "On since 3:10 pm, by Lakshmi" on Settings and on owners' Home |
| The old app and the new app reading the same switches | Same table and meaning; build numbers keep increasing (6.8) |

## 16. Build status (2026-10-12)
| Part | What | Checks |
|---|---|---|
| Database | Migrations `20261012030000_v2_settings` and `20261012040000_v2_settings_updates_changed` (additive): `AppConfig` + shop name, address, mobile, GSTIN, website address, who paused the staff app / website and since when, who last changed each section; `TrustedDevice` + the app version each phone last ran; the second keeps the old "last saved" time as App updates' last change | Applied to the dev copy |
| Server | `models/settings.model.js`, `services/settings.service.js`, `GET /app-status`, `/settings` routes (owners), the maintenance check in sign-in checking (staff only, 10-second cache), the invoice letterhead, sales summary PDF, catalogue PDF and the shipping WhatsApp message read the saved shop details, Activity sentences (Settings kind), owners' Home line "Staff app paused" | **283/283** server tests (Module 11: 6 API + 3 unit) |
| App | The start-up check over the whole app (Update required for everyone; Under maintenance for signed-in staff, at once when the server refuses a request); the "new version" line under the offline bar ("Later" hides it for a day); More → Settings (owners, picks A and A); Shop details with the letterhead preview; Home's "Staff app paused" line; Activity's Settings filter; Home, Orders, Products and Invoices reload by themselves when a pause ends; Settings reloads when the start-up check sees a change | **99/99** app tests (Module 11: 9), lint clean |
| Mock-up | `docs/design/ui-mockup/module-11-settings/` | 80/80 browser checks |

Changes from the plan, found while building:
- **An old invoice keeps the shop details of its day**, also when its PDF is re-made later (a corrected customer name, or the CANCELLED stamp on an online order cancelled days later): the server undoes every shop-details change made after the invoice's date. New invoices use the new details.
- **The warning before "Require this version"** names the phones used this week on an older version; phones still on the old app aren't listed (they sign in through the old server). If the change would stop this phone too, it says so first. The same warning shows when Advanced numbers would make phones update.
- **"Require" and "Tell" only work from a phone of that kind** (an Android phone for Android): the server reads the version the phone sends and refuses from an iPhone for Android ("Do this from an Android phone that already has the new version").
- **Staff can still sign in during maintenance**, then see the maintenance screen; their requests are refused by the server, except their own profile. Sarees waiting to upload wait (not marked failed); the bill on the phone is kept.
- **Phone's back button on the maintenance or update screen** leaves the app instead of moving the screens underneath.
- About shows the server's version (2.0.0).
- The start-up check's answer is never cached on the way (`Cache-Control: no-store`), so a phone sees maintenance switched off at once.

## 17. Real-phone test (2026-10-12, Samsung Note10 Lite, test app)
Owner = Lakshmi (test), Staff = Anil (test), local copy through the USB cable; a second "phone" for the owner = the Mac (same server calls as the app).

| # | Check | Result |
|---|---|---|
| 1 | Owner: More → Settings: Maintenance, App updates (this phone 2.0.0 (1), newest 23, oldest any), Shop details (server settings, "not changed in the app yet"), Shop rules, About (owners who can sign in, server 2.0.0) | ✅ |
| 2 | Website: switch on asks first with the message; "On since 12 Oct 2026, 11:25 am, by Lakshmi (test)"; message edited and saved; switch off asks first ("Open the website again?") | ✅ |
| 3 | Staff app paused from the owner's phone (asks first, message "Updating prices, back at 6 pm"); owner keeps working; owner's Home: "Staff app paused · Since 12 Oct 2026, 11:28 am · by Lakshmi (test) · tap to resume" opens Settings; Back returns to Home | ✅ |
| 4 | Staff signs in during the pause: "Under maintenance" with the owner's message; the server refused every staff request (503) except their profile; "Try again" says "Still under maintenance." | ✅ |
| 5 | Resumed from the Mac: the staff phone opened again by itself within a minute and Home reloaded. Paused again: the staff tapped Orders and the maintenance screen came at once with the new message. Resumed: "Try again" says "You can work again." | ✅ |
| 6 | Staff: no Settings in More; opening it by link says it's for owners (the server refuses too) | ✅ |
| 7 | App updates: "Tell phones…" says phones already hear about version 23; "Require this version (1)" warns first ("No phone signed in this week uses an older version", old-app phones not listed) and saves oldest 1; Advanced oldest 2 warns "This phone will have to update too" and names 3 phones → after Save, "Update required" covers the whole app (owner too); "Check again" says it still needs the update; set back → "You can use the app again."; iPhone tab shows a note instead of the buttons; "Later" hides the new-version line | ✅ |
| 8 | Shop details: a short GSTIN gives "That doesn't look like a GSTIN…" and "Fix the GSTIN above."; the letterhead preview follows the typing; saving a new mobile and website updates the page and "Last changed". **A new invoice (INV-000029) prints +91 94941 70181; an older invoice (INV-000028), re-made after correcting its customer's name, keeps +91 94941 70180.** Details put back afterwards | ✅ |
| 9 | Activity → Settings lists every change (paused, resumed, required version 1 / 2, oldest set to any, shop mobile and website), marked important; the entry shows before → after (Mobile 9494170180 → 9494170181) | ✅ |
| 10 | Dark mode (phone switched to dark for the check, then back to light): Settings, the pause sheet, Shop details (the letterhead preview stays white, like the paper invoice), Update required, Under maintenance | ✅ (after fix 9) |
| 11 | Settings reloads after a change made on another phone: website paused from the Mac, app sent to the background and back → "Website · On since 12:43 pm" without refreshing by hand | ✅ |
| 12 | After a pause ends, the screen underneath reloads by itself: Orders, Products and Invoices (each refused with 503 during the pause) and Home reloaded as soon as "Try again" said "You can work again." | ✅ |
| 13 | Owner's phone back in light mode, owner signed in, every setting on the dev copy back as it was | ✅ |

**Problems found and fixed:**
1. The maintenance switches showed a green knob on a red track: the knob is white now.
2. While typing a maintenance message the keyboard covered "Save message": the page now shrinks above the keyboard (re-checked on the Advanced numbers).
3. After a pause ended, the screen underneath still said "Couldn't load…" until Retry: Home, Orders, Products and Invoices now reload by themselves (re-checked, check 12).
4. **"App updates · Last changed" moved with every other change** (it fell back to the settings row's own time): App updates now has its own time only; the old "last saved" time is kept by migration `v2_settings_updates_changed` (re-checked: a later maintenance change left it at 11:41; server test added).
5. Settings kept showing the old numbers after a change made on another phone: it now reloads when the start-up check sees a change (re-checked, check 11).
6. The tab bar covered "Save shop details": that page now hides the tab bar.
7. Samsung Pass offered to save a "username and password" after saving Shop details: the Settings fields tell the phone they aren't sign-in fields (re-checked: no prompt).
8. Found before the phone test: an older invoice's PDF re-made later printed the new shop details (fixed in section 16, confirmed in check 8).
9. In dark mode the chosen Android / iPhone tab was hard to see inside the dark card: it now has an outline (re-checked in dark and light).

**Seen during the dark-mode check, not part of Settings (whole app), fixed the same day and phone-tested:**
- **Android's own button strip** (back, home, recent) kept the old colour when the phone switched between light and dark while the app was open (React Native sets it only at start). The app now sets it whenever light/dark changes, through a small native module of our own, `modules/nandam-system-bars` (the `expo-navigation-bar` library was tried first: its call didn't change the strip after start on the test phone, so it was removed again). Checked: start in light → switch to dark → back to light, and start in dark → switch to light; the strip followed every time.
- **White text on the red buttons** (Log out, Pause the staff app, Require version…) and on the red count on the Orders tab was faint in dark mode (2.5:1). A new colour `onDanger`: white on the light theme's red (unchanged), dark on the dark theme's lighter red, like the teal buttons. Checked in dark and light.

Test data left on the dev copy: two counter sales (INV-000028, INV-000029, "Settings Test"); every setting is back as it was (the shop details are now saved in the app with the same values).

## 18. Switch-over notes
- Run migrations **`v2_settings`** and **`v2_settings_updates_changed`** on the live database (additive; empty shop details fall back to today's server settings, so nothing changes until an owner saves).
- After switch-over, the **old server's 30-day deletion of app activity must be off** (Module 10): the shop-details history that keeps old invoices right lives in the Activity log.
- **Set the website address** in Settings → Shop details (WhatsApp product links need it).
- **The newest versions saved today are out of date** (Android 23, the shop's app is 25; iPhone 3, the app is 6). After the new app is released, open Settings on an updated phone and tap "Tell phones…" or "Require this version…".
- **Decision 6.8:** iPhone done (2026-10-13): same app id as the old app, build 7 onwards, see [`../deployment/live-v2-server.md`](../deployment/live-v2-server.md). Android before release: same app id as the old app (com.nandamhandlooms.staff, build 26 or later) if the old signing key and store access are available.

## 19. Left for the full-app test
Added to [`docs/testing/full-app-test-list.md`](../testing/full-app-test-list.md): the phone's own Back button on the maintenance and update screens, tablet (two columns), iPhone (TestFlight link, the iPhone buttons), the old website showing its maintenance message, and an older build really updating from the Play Store.

## 20. Discussion log
| Date | Topic | Notes |
|---|---|---|
| 2026-10-12 | What Settings covers | Explained to the owner: maintenance (staff app, website), app updates, plus shop details, website address, "last changed by", and the two items parked in Module 1. Owner: "make the plan end to end completely and make the mockup end to end completely". |
| 2026-10-12 | Plan and mock-up | Data: both maintenance switches off; saved newest builds out of date (Android 23 vs app 25, iPhone 3 vs 6); last saved 4 Oct by nobody recorded; shop details only in server settings; website address not set; old app id com.nandamhandlooms.staff. Waiting for decisions 6.1–6.11 and picks (layout, saving). |
| 2026-10-12 | Picks and decisions | Owner: "build it end to end completely and precisely and accurately": picks A (one page with sections) and A (each change saves on its own); decisions per ⭐. |
| 2026-10-12 | Built | Server 283/283, app 99/99, lint clean. Added while building: a re-made invoice PDF keeps the shop details of its day; the "Require" warning names older phones and warns when this phone would be stopped too. Real-phone test waiting for the phone to be connected. |
| 2026-10-12 | Phone-tested | 9 of 10 phone checks passed (dark mode not done: the phone disconnected); 8 problems fixed, among them "App updates · last changed" following other changes and a re-made old invoice printing new shop details. Server 283/283, app 99/99. |
| 2026-10-12 | Last phone checks | Phone reconnected: dark mode, Settings reloading after a change on another phone, and lists reloading after a pause all passed; fix 9 (outlined platform tab). All 13 checks pass. Server 283/283, app 99/99. |
| 2026-10-12 | Whole-app fixes A.1, A.2 | Android's button strip now follows light/dark while the app is open (`modules/nandam-system-bars`); text on red buttons readable in dark mode (`onDanger`). Both phone-tested; app 99/99, lint clean. |

## Change 16 Oct 2026: update numbers that would lock everyone out
Settings → App updates refuses a "required" version that no phone of that kind has used in the last 60 days ("No Android phone has version 270 yet… Check the number", `NO_PHONE_HAS_IT`), and one that would ask the phone making the change to update (`WOULD_BLOCK_THIS_PHONE`). A typo could otherwise show "Update required" on every phone, owners' too, with only the database to undo it. "Require this version" from a phone that has it works as before. Live 16 Oct 15:33 IST. Test: `tests/api/settings.test.js`.

Also from the same check: every database statement now has a 28-second limit and a connection is waited for at most 10 seconds (`config/database.js`), so a stalled database gives a quick "try again" instead of requests that hang.

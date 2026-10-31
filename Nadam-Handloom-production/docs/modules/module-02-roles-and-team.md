# Module 2: Roles and team

| | |
|---|---|
| **Status** | Built and tested 2026-10-11 (backend, app, real Android phone). See sections 11–13. |
| **Apps** | Admin app on Android and iOS, phone and tablet |
| **Who uses it** | Owners manage the team. Staff only see what their role allows. |
| **Builds on** | [Module 1: Sign in](module-01-sign-in.md): accounts, sessions, trusted devices |
| **Mock-up** | [`docs/design/ui-mockup/module-2-team/`](../design/ui-mockup/module-2-team/index.html) |
| **Old system notes** | [`current-system/admin-app-1-login-team-settings.md`](../current-system/admin-app-1-login-team-settings.md), "Team" sections |

## 1. Goal
Owners decide who can use the admin app and what each person sees. Adding a person takes a minute and costs nothing. Removing a person cuts them off at once on every phone, and their history is kept.

## 2. What is in this module
- **Two roles:** Owner and Staff, with one permission table (section 4) that every later module uses.
- **Team list:** everyone's role, status (Invited / Active / Removed) and when they were last active.
- **Invite** by name, mobile number and role, then **share the invite on WhatsApp** from the owner's own phone.
- **Member page:** edit the name, change the role, see and sign out their phones, share the invite again, remove access, invite again after removal.
- **Main owner:** one owner who can't be removed or made Staff by anyone else, and who can hand the title to another owner.
- **Server-side enforcement:** every owner-only action is refused for Staff by the server, not just hidden in the app.
- **Audit:** every team change is written to the activity trail (shown in Module 10).

**Not in this module:**
- The screens behind each permission (Products, Orders and so on) come in their own modules.
- The Activity log screen is Module 10.

## 3. Discussion and decisions

| Date | Topic | What was discussed | Decision |
|---|---|---|---|
| 2026-10-11 | More than one owner | The old app could only invite Staff. Its error even said "make someone else an owner first", which nobody could do. A second owner is also a backup if the owner loses their phone. | **Owners can make other people Owners.** |
| 2026-10-11 | Main owner | With several owners, one owner could remove another. | **One "main owner"** who can't be removed or made Staff by other owners. Only the main owner can hand the title to another owner. |
| 2026-10-11 | How invites reach people | The old invite screen promised an SMS that was never sent. A custom SMS needs a paid, DLT-registered sender. | **Share the invite on WhatsApp** from the owner's phone, at no cost. A "Share another way" option covers people without WhatsApp. |
| 2026-10-11 | Staff permissions | A fixed set per role, or switches per person. | **Keep it simple: two fixed roles.** Staff never see money totals: today's sales, analytics, sales summaries. Staff can view, add, edit and delete products; see today's and past orders and ship them; sell and share invoices with customers; view categories and prices. Owners can do everything. |
| 2026-10-11 | Removed people | Delete them, or keep them. | **Keep their history.** Removal ends every sign-in, untrusts their phones, turns off Face ID and clears their PIN. "Invite again" brings them back; they then set up again with an SMS code. |
| 2026-10-11 | Changing someone's mobile number | Editing a number would let one account become a different person. | **Not allowed.** Remove the person and invite the new number. |
| 2026-10-11 (build) | Website customers in the team | Customers and team members share one account and **one PIN** (the website signs customers in with it). The old app cleared that PIN when it invited a customer, so their website sign-in silently broke. | **A customer who joins or leaves the team keeps their PIN.** Their invite says "sign in with the PIN you use on our website"; the new-phone SMS check still applies. Everyone else's PIN is cleared on removal, as before. |
| 2026-10-11 (build) | Who becomes main owner on the live data | The live data has 5 owner accounts and it isn't clear which is the shop owner. | **Not guessed.** Set once at switch-over with `scripts/set-main-owner.js <mobile>` after the shop owner confirms the number. Until then the Team screen says "No main owner yet". |
| 2026-10-11 (build) | Main owner's phones | Another owner could keep signing out the main owner's phones. | **Protected too.** Nobody else can remove the main owner, make them Staff, or sign out their phones. Editing their name is allowed. |
| 2026-10-11 (build) | "Last owner" rule | Only an owner can change roles, nobody can change themselves, and the acting owner is re-checked inside a lock. | **Always at least one owner, by design.** A separate "last owner" refusal could never trigger, so it was left out. Tested with two owners removing each other at the same moment: only one succeeds. |
| 2026-10-11 (build) | Status badges in the list | A badge on every row is noise. | Only **Invited** gets a badge; Active is the normal state. Removed people are in their own tab. |
| 2026-10-11 (review) | Team list style | A: rows in one card. B: separate cards with the number and phone count. | **A.** Shows more people at a glance and matches My devices and More. The extra details are one tap away. |

## 4. Who can do what (permission table)
The server uses the permission names below. The app reads the same list from `/api/v2/me` to decide what to show.

| Permission | Means | Owner | Staff |
|---|---|---|---|
| `team.manage` | Team list, invite, roles, remove, sign out someone's phones | ✅ | ❌ |
| `sales.view` | Today's sales, money totals, sales summary PDFs | ✅ | ❌ |
| `analytics.view` | Analytics | ✅ | ❌ |
| `activity.view` | Activity log | ✅ | ❌ |
| `settings.manage` | App settings (maintenance, updates) | ✅ | ❌ |
| `catalog.edit` | Add or edit categories and subcategories, and change **prices** | ✅ | ❌ |
| `catalog.view` | See categories, subcategories and prices | ✅ | ✅ |
| `products.manage` | Products: view, add, edit, delete | ✅ | ✅ |
| `orders.manage` | Orders, today and past; ship | ✅ | ✅ |
| `sell.use` | Scan to sell, and invoices for customers | ✅ | ✅ |
| `sell.override` | Sell an item that an online checkout is holding | ✅ | ❌ |
| `payments.view` | Online payments from the website (list, refunds) and a notification for each payment (added 17 Oct 2026, W6) | ✅ | ❌ |

Every person can also manage their own account: Change PIN, My devices, Face ID and log out (Module 1).

## 5. How it works

### 5.1 Team list (More → Team, owners only)
- Two tabs: **Team** (Active and Invited) and **Removed**. Search by name or number.
- Each row shows the name, Owner or Staff, Main owner, a status badge, and "Last active …" (Invited people show "Invited …").
- **+ Invite** button.

### 5.2 Invite
1. Enter the full name, the mobile number, and choose **Staff** or **Owner**. The screen explains what each can do.
2. Tap **Invite**. The person appears as **Invited**.
3. A success screen offers **Share invite on WhatsApp**. It opens WhatsApp to that number with the steps filled in. **Share another way** opens the phone's share menu.
4. The person installs the app, taps *First time here? Set up your account*, gets an SMS code, sets a PIN (Module 1), and becomes **Active**.

Edge cases:
- The number is already an active member: "Already in your team", with a link to their page.
- Already invited: "Already invited", with **Share invite again**.
- The number belongs to a website customer: they're added to the team and keep their customer account.
- The number belongs to a removed member: invited again.

### 5.3 Member page
- Name, mobile, role, status, main owner, "Added on …", "Last active …".
- **Edit name.**
- **Make Owner / Make Staff**, asking first. This isn't offered on your own page or for the main owner.
- **Phones:** each trusted phone with "Last active"; sign out one, or all. A phone that's signed out needs the PIN and an SMS code again. "Sign out all" also ends old-app sign-ins, but not a customer's website sign-in.
- **Share invite again** (Invited people).
- **Remove access**, asking first. Not offered on your own page or for the main owner.
- **Invite again** (Removed people).
- **Make main owner**: shown only to the main owner, on another active owner's page.

### 5.4 What the other person sees
- **Removed:** their phone shows "Your access has been removed" on its next action (Module 1).
- **Role changed:** they are **not** signed out. Their app shows the new role's screens the next time it checks in (a tab opens, the app comes back to the front, the 15-minute key renewal, or the server refuses something), with a one-time message: "Your role is now Owner. Owner screens are now on." / "Your role is now Staff. Some owner-only screens are hidden."
- **Staff reaching an owner-only screen** (an old link, or a role changed while it was open): a calm "Only owners can open this" screen with Go to Home.
- **A phone signed out by the owner:** "This phone was signed out from another device" (Module 1).

## 6. Rules
| Rule | Value |
|---|---|
| Roles | Owner (`ADMIN` in the database) and Staff (`STAFF`) |
| Who manages the team | Owners only (`team.manage`) |
| At least one owner | Always, by design (see the decisions table). |
| Main owner | At most one (also enforced by a database index). Nobody else can remove them, make them Staff or sign out their phones. Only they can hand the title to another **active** owner. |
| Team changes | Run one at a time (a database lock), and the acting owner is re-checked inside it |
| Yourself | You can't remove yourself or change your own role |
| Name | 2–80 characters |
| Mobile | 10 digits starting 6–9; it can't be edited later |
| Role change | Takes effect on the server at once, without signing the person out |
| Remove access | Ends all sessions, untrusts all phones, turns off Face ID, clears the PIN (kept for website customers), removes push devices, keeps all history |
| Invite again / invite a known number | Restores the chosen role; phones trusted before the invite need the SMS check again |
| Inviting | Sends no SMS. The person gets a code only when they set up on their own phone |

## 7. Data (same live database, additive only)
**Existing tables used:**
- `AuthAccount`
- `UserRole` and `Role` (ADMIN = Owner, STAFF = Staff, CUSTOMER kept for website customers)
- `AdminProfile` (the team member's name)
- `Session`, `TrustedDevice`, `DeviceToken`, `AuthEvent`

**Additive changes (migration `20261011150000_v2_team`), on `AdminProfile`:**
- `isMainOwner` (boolean, default false), plus a partial unique index so at most one row can be true.
- `invitedAt` and `invitedById` (nullable), for "Invited 2 days ago by Lakshmi".
- `removedAt` and `removedById` (nullable), for "Removed 10 Sep by Lakshmi". People removed by the old app show "Removed" with their profile's last-change date.

**Statuses** (worked out, not stored):
| Status | Meaning |
|---|---|
| Active | Has an Owner or Staff role, can sign in (PIN set, account active), and, if invited after the team screens went live, has signed in on a phone since that invite |
| Invited | Has the role but hasn't finished: no PIN yet, or (a website customer) hasn't signed in to the app since the invite |
| Removed | Has a team profile but no Owner or Staff role |

**At switch-over:** run `node scripts/set-main-owner.js <mobile>` (dry run), then add `--yes`, with the number the shop owner confirms. Every owner already in the live database stays an owner.

## 8. API (all under `/api/v2`, owners only unless marked)
| Method | Path | Purpose |
|---|---|---|
| GET | `/me` (everyone) | Now also returns `permissions` |
| GET | `/team?tab=team\|removed&q=` | Team list |
| POST | `/team` | Invite `{ name, mobile, role }`. Returns the member and the invite message. |
| GET | `/team/:id` | Member page, including phones and the invite message |
| PATCH | `/team/:id` | Edit name `{ name }` |
| PUT | `/team/:id/role` | Change role `{ role: owner \| staff }` |
| POST | `/team/:id/remove` | Remove access |
| POST | `/team/:id/reinvite` | Invite a removed person again |
| POST | `/team/:id/main-owner` | Hand the main-owner title to this owner (main owner only) |
| DELETE | `/team/:id/devices/:deviceId` | Sign out one of their phones |
| POST | `/team/:id/devices/sign-out-all` | Sign out all their phones |

Every member answer has the same shape: `member` (name, mobile, role, status, isMainOwner, isYou, dates, `phones`, and **`actions`**: exactly what the person looking may do on that page, so the app never re-implements the rules) and `invite` (`message` and `whatsappUrl`, for Invited people).

Errors use the Module 1 shape. New codes:
- `FORBIDDEN` (not allowed for your role; also "only the main owner can hand over the title")
- `ALREADY_IN_TEAM`, `ALREADY_INVITED` (with `details.member`)
- `ALREADY_REMOVED`
- `CANNOT_CHANGE_SELF`
- `MAIN_OWNER_PROTECTED`
- `NOT_ACTIVE_OWNER`
- `MEMBER_NOT_FOUND`, `DEVICE_NOT_FOUND`

## 9. Backend (MVC additions)
```
src/config/permissions.js          the permission table (section 4)
src/middlewares/requirePermission.js
src/models/team.model.js           team queries (list, member, roles, profile)
src/services/team.service.js       invite, roles, remove, re-invite, main owner, member phones
src/services/inviteMessage.js      the WhatsApp invite text
src/controllers/team.controller.js
src/routes/team.routes.js          /api/v2/team/*
src/validators/team.validators.js
scripts/set-main-owner.js          one-off, at switch-over
```
Also changed: `middlewares/authenticate.js` reads the role from the database on every request (so a role change applies immediately); `utils/present.js` adds `isMainOwner` and `permissions` to the person; `config/env.js` adds the optional `INVITE_APP_LINK` (where invited people download the app); `models/trustedDevice.model.js` adds "sign out every phone"; `prisma/dev-seed.js` adds Priya (owner) and Anil (staff) and makes Lakshmi the main owner.

## 9a. App (Expo)
```
src/auth/permissions.js            can(user, permission) from the server's list
src/auth/checkIn.js                re-reads /me (app to front, tab opened, refused request; at most every 15 s)
src/auth/session.js                updateUser(): notices a role change once (roleChange)
src/api/team.js                    the team endpoints
src/utils/team.js                  wording: role texts, list lines, facts, summary, name checks
src/hooks/useTabBarSpace.js        room for the floating tab bar, from the phone's real insets
src/components/team/               RolePicker, MemberRow, OwnersOnly, shareInvite (WhatsApp / share menu)
src/components/TextField.js
src/app/(app)/more/team/           index (list), invite, invited, [id] (member), edit-name, reinvite
```
Also changed: More shows the Team row (owners) and "What can I do?"; Home shows tiles by permission; the tab layout checks in and shows the role-change message; ESLint was set up (`npx expo lint`).

## 10. Testing plan
- **API tests:**
  - every rule in section 6;
  - every invite edge case in 5.2;
  - Staff refused on every `/team` route;
  - a role change shows in `/me` permissions straight away;
  - a removed person's sessions and phones stop working;
  - main-owner protection and hand-over.
- **App tests:** the permission helper, the status labels and the WhatsApp link.
- **Real phone:** the owner on the phone invites a staff member; the staff member sets up; the owner changes their role, signs out their phone and removes them. Each step is checked from both sides.

## 11. Build status (2026-10-11)
| Check | Result |
|---|---|
| Backend tests (`npm test`) | **109 / 109** (Module 1: 64; Module 2: 33 API + 12 unit) |
| App tests (`npm test`) | **40 / 40** |
| App lint (`npx expo lint`) | clean |
| `npx expo-doctor` | 21 / 21 |
| Mock-up browser test | 77 / 77 |

## 12. Real-phone test (2026-10-11, Samsung Galaxy Note10 Lite, Android 12)
One phone played both people: the owner, then the staff member after logging out (the user's choice). For the "what the other person sees" checks (5.4), the owner's actions were sent from the Mac to the server while the staff member stayed signed in on the phone.

| # | Check | Result |
|---|---|---|
| 1 | Owner signs in; Home shows owner tiles; More shows Team and "Main owner" | ✅ |
| 2 | Team list: main owner first with crown and You, Invited badges, summary | ✅ |
| 3 | Invite: empty fields refused; Ravi's number → "already in your team" with a link | ✅ |
| 4 | Invite Arjun → "Arjun is invited" with the full message | ✅ |
| 5 | "Share another way" opens the phone's share menu with the message | ✅ (closed without sending) |
| 6 | "Share on WhatsApp": wa.me links open WhatsApp directly on this phone (verified handler) | ✅ (not opened, to keep the owner's WhatsApp clean) |
| 7 | Arjun sets up: code, PIN twice, "You're all set" | ✅ |
| 8 | Staff Home: no sales, analytics or activity tiles; More: no Team row | ✅ |
| 9 | Owner makes Arjun Owner while he's signed in → his phone: "Your role is now Owner", owner tiles, still signed in; and back to Staff | ✅ |
| 10 | Owner signs out Arjun's phone → "This phone was signed out"; signing in again needs the SMS check | ✅ |
| 11 | Owner removes Arjun → his phone: "Your access has been removed", keys wiped | ✅ |
| 12 | Removed tab → Arjun → Invite again (Staff) → "Arjun is invited again" | ✅ |
| 13 | Edit name; Make Owner / Make Staff dialogs; Cancel invite → Removed | ✅ |
| 14 | Own page: "This is you", no role change or remove; another owner's page: "Make main owner" dialog (cancelled) | ✅ |
| 15 | Server unreachable on Team: "Couldn't load the team" + Retry; Retry works when it's back | ✅ |

**Bugs found on the phone and fixed (all rechecked on the phone with the final build):**
- The floating tab bar covered the bottom of screen buttons on phones with on-screen navigation keys (Invite, Share another way, and Module 1's Change PIN). The space is now worked out from the phone's real insets (`useTabBarSpace`) on every screen.
- Initials for names with numbers ("Admin 8565" showed "A8"): now letters only.
- Your own row said "Last active 6 min ago" while you were using the app: now "Active now".

**Test set-up notes:** the phone's Wi-Fi was off at first; the USB route (`adb reverse`) kept dropping because another emulator on the Mac restarts adb, so the final test build talks to the Mac over Wi-Fi (`EXPO_PUBLIC_API_URL=http://192.168.0.4:4100/api/v2`).

## 13. Still to do / notes
- **Switch-over:** set the main owner with the script (section 7). Optionally set `INVITE_APP_LINK` once the app is in the stores.
- iPhone and tablet checks are parked with Module 1's (Xcode 26 or EAS needed for iPhone).
- Nothing is committed yet: by the user's decision, commits wait until the whole app is done.
- The database driver prints a harmless warning from inside Prisma (parallel loading inside a transaction); nothing in our code causes it.

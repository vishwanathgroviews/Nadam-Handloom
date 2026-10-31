# Customer website review, 26 October 2026

Twelve reviewers each read one part of the customer website from start to end. Each read the server's APIs, the data tables and fields, and how the website uses them: what the customer sees while waiting, on success and on every error. Then each wrote a report in simple words. They only read code: nothing was changed, and nothing live was touched.

Afterwards I checked every "Must fix" in the code myself, and most "Should fix" items. One finding was checked in a real browser too: saree cards vanishing after Add to bag. Findings two reviewers both raised are listed once.

## Final result after three checks (26 Oct 2026)

A third reviewer per module re-proved, from the code, every finding the second check had disputed: 38 partly correct and 1 wrong. For each, the third reviewer decided who was right and why the first reviewer went wrong. Their notes are in [`checks/*-third-check.md`](checks/), and each disputed finding in the reports has a "Third check" line.

**Who was right on the 39 disputed findings:** the second checker on **38**. On the one marked wrong, both were partly right: saree page Small 12. Nginx does serve the plain page on most errors, but not on "too many requests" (429). So it is a real but rare problem: one wording fix in the nginx setting. The first reviewer was never fully right where the second disagreed, and nobody was wrong both times.

**Why the first reviewers went partly wrong (the usual reasons):**
- They rated a real problem too high: customers had another way through (Load more), a Try again button existed, or it only happens on rare timing.
- They read one line without following what happens next (for example, an email check that ends after the first free email).
- They didn't know a live fact: Razorpay's notices go to the old server, live nginx falls back to the plain page, and checkout went live today.
- They gave the wrong screen size, line number or example for a real problem.

**Problems the later checks found that the first reviews missed:**
- **The old server can mark website orders paid with no checks.** Its Razorpay notice handler marks any captured payment paid, even on a cancelled order, without checking stock or the hold. Today this happens only if Razorpay's TEST mode sends notices to the old address with the same secret (check the test-mode Webhooks page). It becomes certain once live keys go in before the notices are moved or the old server is switched off. Worst case: a late payment for a saree that already sold is charged, shows "Being packed" and is never refunded. **Must fix before live keys.**
- **"Recently viewed" cards on the bag page are invisible:** they stay see-through. **Seen in a real browser on 26 Oct.** It is live. The cause is the same family as the vanishing cards after Add to bag.
- **The Latest collections row can scroll up and down a little:** about 20 px of hidden scroll. The same happens on the saree page and bag rows. Small.
- **The WhatsApp button covers links on computers 900–1,450 px wide:** "Terms" in the one-line footer and "Dark" in the home theme switch. Small.
- **The server's fallback call number is still the old 94941 70180** (`env.js:82`). Not visible today. Small.
- **The Light/Dark switch used to be on every page;** now it is only at the bottom of the home page. Ask the owner.

### Final must-fix list (12)
1. Test payments act like real sales: anyone can take real sarees off sale with the test card. *(live)*
2. Saree cards vanish after Add to bag. Related: "Recently viewed" cards on the bag page are invisible. *(live)*
3. The old server's Razorpay handler can mark website orders paid without checks. *(Before live keys; maybe today, depending on Razorpay's test-mode settings.)*
4. A customer can pay twice: Pay is offered again before the first UPI payment is known. *(before live keys)*
5. An address edited during the 15-minute hold is ignored, so the parcel goes to the old address.
6. If the bag fails to join the account at sign-in, Pay stays grey until reload. Some customers never see the warning.
7. Checkout can spin for ever if the sign-in check fails as the page opens.
8. "Change mobile" can be used to send unlimited paid SMS.
9. A device signed out (by the customer, for safety, or for too many devices) keeps getting order notices.
10. All five policy pages say "Draft".
11. Privacy and Delete account promise untruly that contact details are removed from orders and invoices.
12. Contact us has no email address.

Moved down to Should fix after the checks: Load more stopping at 480; a saree lost during a slow sign-in check (several changes can be lost, not one); "Turn off notifications" not staying off. Moved down to Small: "The 15 minutes are over" wording (checkout S2), a false "Refund stuck" alarm (payments S4), the payment confirmation waiting for Firebase, and the open-site notice being easy to miss.

## Second check (26 Oct 2026): every finding re-checked by a second reviewer

Twelve more reviewers each took one report and checked **every** finding (must, should and small) against the code. Each marked a finding ✅ correct, ⚠️ partly correct (real, but the reason, place or seriousness is off) or ❌ wrong. The verdict sits under each finding in the reports. The evidence is in [`checks/`](checks/).

| # | Report | ✅ Correct | ⚠️ Partly correct | ❌ Wrong | Check file |
|---|---|---|---|---|---|
| 1 | Sign in | 22 | 2 | 0 | [checks/01-sign-in-check.md](checks/01-sign-in-check.md) |
| 2 | My account | 22 | 1 | 0 | [checks/02-my-account-check.md](checks/02-my-account-check.md) |
| 3 | Site frame | 29 | 6 | 0 | [checks/03-site-frame-check.md](checks/03-site-frame-check.md) |
| 4 | Home | 18 | 1 | 0 | [checks/04-home-check.md](checks/04-home-check.md) |
| 5 | Catalogue and search | 21 | 4 | 0 | [checks/05-catalogue-and-search-check.md](checks/05-catalogue-and-search-check.md) |
| 6 | Saree page | 24 | 3 | 1 | [checks/06-saree-page-check.md](checks/06-saree-page-check.md) |
| 7 | Bag | 22 | 1 | 0 | [checks/07-bag-check.md](checks/07-bag-check.md) |
| 8 | Checkout | 22 | 5 | 0 | [checks/08-checkout-check.md](checks/08-checkout-check.md) |
| 9 | Payments | 17 | 5 | 0 | [checks/09-payments-check.md](checks/09-payments-check.md) |
| 10 | Orders | 19 | 3 | 0 | [checks/10-orders-check.md](checks/10-orders-check.md) |
| 11 | Notifications | 23 | 4 | 0 | [checks/11-notifications-check.md](checks/11-notifications-check.md) |
| 12 | Info pages | 24 | 3 | 0 | [checks/12-info-pages-check.md](checks/12-info-pages-check.md) |
| | **All** | **263** | **38** | **1** | 302 findings |

**The only wrong finding:** saree page Small 12 claimed the link-preview page could show the server's raw error text to visitors. Live nginx serves the plain page whenever that route errors, so visitors never see it.

**What changed in the must-fix list:**
- Moved down to **Should fix**:
  - "Load more stops at 480": every saree is still reachable through categories, collections, filters and search.
  - "A saree added during the sign-in check is lost": it needs a slow or failed check, only one bag line goes, and it is seen before paying.
  - "Turn off notifications doesn't stay off": switching the topics off does stick; only the customer's own order updates come back.
- Stays **Must fix**, with corrected details: "A customer can pay twice." The server learns of the first payment within about 5 to 6 minutes, and no real money is taken twice while on test keys. Fix it before live keys.
- **Confirmed must fix (8 others):**
  - test payments acting as real sales;
  - the old address kept on a reused checkout;
  - saree cards vanishing after Add to bag (the checker traced it in React's own code; I also saw it in a real browser);
  - a failed bag join leaving Pay grey;
  - checkout spinning for ever;
  - unlimited paid SMS through Change mobile;
  - a signed-out device still getting order notices (also when the oldest device is signed out for too many devices);
  - the policy pages: Draft, the untrue privacy promise and no email.
- **So, after the second check: 11 must fix.**

**New points the checkers found:**
- **The old server shares the database (Orders, Payments).** If its Razorpay notice handler receives a payment notice it accepts, it can mark a new website order paid without the new server's stock and hold checks. The new server then skips "Order confirmed", the owners' alert and clearing the bag. Whether a test-mode notice reaches the old server today wasn't checked (Razorpay dashboard).
- **The old server owns the EventsOutbox table (Notifications S2).** It writes `order.paid` rows there and marks every row done, so that table can't be the new server's retry list.
- **A collision returns an error (Bag).** The bag row removed at payment can collide with a change at the same moment and give a 500 error.
- **Collection prices can round up (Checkout).** ₹1,499.50 becomes ₹1,500, so a customer can pay up to 50 paise more.
- **Email check with no limit (Sign in).** The email change in My account (`PATCH /me`) has no rate limit and tells whether an email is taken.

## The 12 reports

| # | Part of the website | Report | Must fix | Should fix | Small |
|---|---|---|---|---|---|
| 1 | Sign in | [01-sign-in.md](01-sign-in.md) | 1 | 5 | 15 |
| 2 | My account | [02-my-account.md](02-my-account.md) | 1 | 4 | 12 |
| 3 | Site frame (header, menus, footer, theme) | [03-site-frame.md](03-site-frame.md) | 0 | 11 | 16 |
| 4 | Home page | [04-home.md](04-home.md) | 0 | 8 | 10 |
| 5 | Categories, collections, lists, search | [05-catalogue-and-search.md](05-catalogue-and-search.md) | 1 | 6 | 13 |
| 6 | Saree page | [06-saree-page.md](06-saree-page.md) | 2* | 4 | 18 |
| 7 | Bag | [07-bag.md](07-bag.md) | 1 | 2 | 17 |
| 8 | Checkout | [08-checkout.md](08-checkout.md) | 2 | 6 | 17 |
| 9 | Payments | [09-payments.md](09-payments.md) | 2 | 7 | 13 |
| 10 | Orders | [10-orders.md](10-orders.md) | 0 | 5 | 17 |
| 11 | Notifications | [11-notifications.md](11-notifications.md) | 2 | 8 | 13 |
| 12 | Info and policy pages | [12-info-pages.md](12-info-pages.md) | 3 | 13 | 11 |

\* Includes "cards vanish after Add to bag", which the reviewer marked Should fix. I raised it to Must fix after seeing it happen in a real browser. It is live now.

## Must fix: all confirmed (14 problems, after removing repeats)

**Money and stock**
1. **Test payments act like real sales.** Anyone can use the test card printed on checkout. The saree is then marked "sold online", leaves the website and can't be sold at the counter. It goes into To ship, and owners get "New online order". The customer gets "Order confirmed". Only the invoice says TEST. Cause: the site is open to test payments for everyone, set live on 26 Oct. *(Payments M1, Checkout M2. `Nadam-backend/src/services/shop/checkout.service.js:473-503`)*
2. **A customer can pay twice.** If the phone closes the page during a UPI payment, the page offers Pay again before our server knows the first payment worked. The second payment is refunded automatically, but only after 5 to 7 days. *(Payments M2, Checkout S1. `checkout.service.js:289-297`)*
3. **A changed address can be ignored.** The customer edits their saved address and presses Pay again within the 15-minute hold. The old order is reused with the old address, so the parcel would go to the old address. *(Checkout M1. `checkout.service.js:294`)*

**Customers stuck or losing things**
4. **Saree cards vanish after Add to bag.** The card turns invisible once added. It is live now. *(Saree page S1. `customer-web/src/components/SareeCard.jsx:36`)*
5. **"Load more" stops at 480 sarees, but the button stays.** The live shop has 1,813 sarees, so most can't be reached from the home or All sarees list. *(Catalogue M1. `customer-web/src/pages/shop/filters.js:27`)*
6. **A saree added in the first second or two after opening the site can disappear.** For a returning signed-in customer, the saree is lost when their account's bag loads. *(Saree page M1, Bag S1. `customer-web/src/bag/store.js:241-248`, `:327-333`)*
7. **If joining the bags at sign-in fails once (weak signal), the customer is stuck.** What they add isn't saved, and Pay stays grey with no reason until they reload. *(Bag M1, Checkout S3. `customer-web/src/bag/store.js:327-345`, `:406-411`)*
8. **Checkout can show a spinning dot for ever.** This happens when the "are you signed in?" check fails as the page opens. My account pages show a "Try again" there; checkout doesn't. *(Sign in M1. `customer-web/src/auth/session.js:98-112`, `pages/checkout/CheckoutPage.jsx:199`)*

**Privacy and abuse**
9. **"Change mobile" can be used to send unlimited paid SMS.** It skips the daily SMS cap and has no limit per customer. *(My account M1. `Nadam-backend/src/services/shop/code.service.js:56-59`)*
10. **"Turn off notifications for this browser" doesn't stay off.** The next visit to the Notifications page turns them back on. *(Notifications M1. `customer-web/src/pages/account/NotificationsPage.jsx:99-105`)*
11. **A device signed out from "Signed-in devices" keeps getting order notifications**, with the order number, amount and tracking number. Only "Sign out of all devices" stops them. *(Notifications M2, My account S3. `Nadam-backend/src/services/shop/session.service.js:238-245`)*

**Promises and payment review**
12. **All five policy pages still say "Draft: to be reviewed by the shop".** *(Info M1)*
13. **Privacy and Delete account promise something untrue.** They say orders and invoices are kept "without your contact details". In fact, after deletion the name, mobile and address stay on orders and invoices. *(Info M2, My account S4. `customer-web/src/pages/info/PrivacyPage.jsx:30`, `pages/account/DeletePage.jsx:46`)*
14. **Contact us has no email address.** Razorpay's website check usually asks for one. *(Info M3. `customer-web/src/pages/info/ContactPage.jsx`)*

## Should fix: the most important (confirmed or very likely)

- **Hand refunds never show.** Razorpay's notices still go to the old server. So a refund done by hand in Razorpay never shows on the customer's order. A shop-cancelled order says "being refunded" for ever, and nobody hears if a refund fails. *(Orders S3, Payments S1, Info S12)*
- **Last month's paid orders can't be cancelled.** The admin app can't cancel a paid website order from an earlier month, so it shows "Being packed" for ever. This also blocks cleaning up October's test orders from 1 November. *(Orders S1, Info S1, Payments M1)*
- **Cancelled orders show the full total as refunded,** even when the refund was smaller. No notification is sent when the shop cancels. *(Orders S2, S4)*
- **New-arrival and offer alerts are promised but never sent.** Order notices that fail are never tried again. *(Notifications S1, S2)*
- **The website still describes the old way of ordering in places.** The saree page says ordering is only by WhatsApp. The footer says "Secure payment" even in test mode. The "Thank you" page and policies promise shipping for test orders. *(Saree page S2, Site frame S9, Info S8)*
- **"N new sarees" opens every saree, not only the new ones.** *(Home S5)*
- **Two Latest collections problems:** the arrows stay grey on computers, so only 6 of the 10 can be seen. Half the craft circles are cut off with a mouse. *(Home S1, S2)*
- **Lists keep the old scroll position.** Moving between lists from the header lands mid-page. Back after Load more can return to the top. *(Catalogue S2, S3; Site frame S6)*
- **A collection page can wrongly say "everything sold out"** when only the Sets only filter finds nothing. *(Catalogue S5)*
- **Undo brings back the wrong saree** after two removals. *(Bag S2)*
- **Changing the mobile only checks the new number.** The old number isn't told, and other devices stay signed in. *(My account S2)*
- **Sign-in rough edges:** one lost answer on a weak network can sign the customer out everywhere. A few networks can use up the daily SMS allowance for new customers. The code expires after 60 seconds, but the page says it may take a minute to arrive. *(Sign in S1–S3)*
- **IGST is off.** Invoices for other states show CGST + SGST until the accountant answers. *(Checkout S6)*

Every other Should fix and Small item is in the 12 reports, each with the file, the line and a one-line fix.

## What nobody could check (needs a real phone or the live system)
- A real signed-in test payment on a phone, and iPhone notifications.
- Razorpay dashboard settings: the notice address in test mode, and customer-paid fees.
- The live server's settings and how many test orders already exist.
- Real-device behaviour for the menus, the phone header on iPhone home-screen mode, and the help line covered by bottom bars.

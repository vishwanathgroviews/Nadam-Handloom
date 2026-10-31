# Review: Module 12, info and policy pages (customer website)

Date: 26 Oct 2026 · Read-only review of the code on this Mac. Nothing was run and nothing was changed.

---

## 1. What this module does

These are the website's help and rules pages: **Shipping**, **Cancellation and refunds**, **Contact us**, **Privacy** and **Terms**. It also covers the "page not found" page, the "back soon" page shown when the shop switches the website off, and the rules that send the old website's addresses on to the right new page (a "redirect").
Razorpay (the payment company) checks these pages before it lets a shop take real money.

---

## 2. Each page

The shop's number on every page now comes from the server: **73823 88565** for calls and WhatsApp. The call number is set in the admin app (Settings → Shop details). The WhatsApp number is written into the server's code. The deployment record says both were 7382388565 on the live site on 26 Oct. I could not open the live site to check this myself.

| Address | Tab title | What it promises (plain) | Numbers and address shown | Draft or final |
|---|---|---|---|---|
| `/shipping` | Shipping policy | Packed at the Old Mangalagiri store and sent by courier. Delivery is free anywhere in India. Handed to DTDC within 2 working days of payment. If you pay on a Sunday or a festival day, packing starts the next working day. Arrives 3 to 7 days after shipping. "We send the tracking number as soon as it ships", and it also shows on your order page. To change your address after paying, WhatsApp us before the order ships. If the courier can't deliver, the parcel comes back and we contact you. No shipping outside India. | None | **Draft** ("Draft: to be reviewed by the shop") |
| `/refunds` | Cancellation and refunds | To cancel before shipping, WhatsApp us and we cancel with a full refund. After shipping, no cancelling. A damaged or wrong saree: tell us within 48 hours of delivery, with photos and an unboxing video, and we replace it or refund in full. Small differences in weave or colour are not defects. Refunds go to the same account through Razorpay, usually in 5 to 7 working days. If your payment arrives after the 15-minute hold and a saree has sold meanwhile, we refund it all automatically. | None | **Draft** |
| `/contact` | Contact us | "We reply on WhatsApp the same day." Shows the store, its opening hours, phone, WhatsApp and business details. | Call +91 73823 88565 · WhatsApp +91 73823 88565 · Store: #10-23, Opp. Brahmam Gari Temple, Hussain Katta, Old Mangalagiri, Guntur Dist, Andhra Pradesh 522 503 · Monday to Sunday, 9:30 am to 8:30 pm · Business: Nandam Handlooms, GSTIN 37CCWPN2487C1Z2, Hussain Katta, Mangalagiri, Andhra Pradesh, 522503, India · **No email address** | **Draft** |
| `/privacy` | Privacy | What we collect: at sign-up, your mobile, name, email, pincode, city and state. Later, only if you add them: photo, birthday, anniversary, language and addresses. Collected automatically: your device and browser, sign-in times and how you found us. "We don't use advertising trackers." Why we collect it: sign-in, delivery, order updates and GST invoices, and offers only if you tick the box. Your choices: edit your profile, sign out devices, delete your account ("removed after 7 days; orders and invoices are kept … without your contact details"). Codes are stored scrambled, sign-in uses a secure cookie (a small sign-in file kept by the browser), and only staff can see your orders. | Call and WhatsApp 73823 88565 · business address | **Draft** |
| `/terms` | Terms (heading "Terms of use") | Who runs the site (name, GSTIN, address). One account per mobile number. Your details must be correct. "You can close your account at any time." Prices are in rupees and include GST. Delivery is free. You pay online through Razorpay (UPI, cards, net banking, wallets). Sarees are held for 15 minutes when you press Pay. The order is confirmed once the payment reaches us. Links to Shipping and Refunds. | WhatsApp 73823 88565 · business address | **Draft** |
| Any unknown address | Page not found | "We couldn't find that page. The link may be old, or the address has a typo." Two buttons: See all sarees, Go to the home page. Also used for a saree, collection or category that is no longer on the website. | None | Final (not a policy) |
| Any address while the shop has switched the website off | Back soon | "The website is being updated", the shop's own message, "Message us on WhatsApp", Try again. | WhatsApp 73823 88565 | Final |
| Any page with JavaScript turned off (`index.html`) | — | "The website needs JavaScript … or message us on WhatsApp." | 73823 88565 (written into the file by hand) | — |

---

## 3. Promises vs what the website really does

| Promise on the pages | What really happens | Matches? |
|---|---|---|
| Free delivery anywhere in India | An order's total is just the sarees. Checkout shows "Delivery: Free". No delivery charge exists anywhere. | **Yes** |
| Prices include GST | Checkout and the order page show "Includes GST 5% (₹…)". The home footer says "All prices include taxes". | **Yes** |
| Packed and handed to DTDC within 2 working days | Nothing in the system tracks this; it is the shop's own promise. The admin app lists orders to ship oldest first. The order page repeats "Within 2 working days" and "Usually 3 to 7 days". | Can't be checked by code (shop's promise) |
| Sunday or festival orders are packed the next working day | The store's hours on the same website say "Monday to Sunday". | Confusing (small) |
| "We send the tracking number as soon as it ships" | It shows on the order page once staff mark the order shipped. The customer only gets a message if they turned on notifications in that browser. Otherwise staff must send it by hand on WhatsApp. No SMS or email. | **Partly** |
| Change your address on WhatsApp before shipping | The admin app has no way to change a website order's address. The order page and the GST invoice keep showing the old address. The new one can only be written on the parcel by hand. | **Partly (by hand only)** |
| No shipping outside India | The address form takes Indian states and pincodes only. | **Yes** |
| Cancel before shipping: WhatsApp us, full refund | Customers can't cancel on the website. This is "parked", and each order says "Need to cancel or change something? WhatsApp us", which is consistent. The owner cancels in the admin app, **but only for orders from the same calendar month**. The money is refunded **by hand** in Razorpay's dashboard. | **Partly**: an order from last month can't be cancelled in the app |
| No cancelling after shipping | The admin app refuses to cancel a shipped order. | **Yes** |
| Damaged or wrong saree: replacement or full refund | No return or refund-after-delivery exists in the system. A delivered order can't be cancelled. A refund can only be done by hand in Razorpay, and the order keeps saying "Delivered" with an uncancelled invoice. | **By hand only, nothing recorded** |
| Refund to the same account through Razorpay, 5 to 7 working days | This is Razorpay's normal refund. Automatic refunds start at once and are retried if Razorpay refuses them. | **Yes** |
| Paid after the 15-minute hold and a saree sold: full refund, automatically | The code does this. It also refunds a double payment or a wrong amount automatically, which the page does not mention. | **Yes** |
| (Not said) The shop may cancel a paid order it can't send | The system does this ("Cancelled by the shop: ₹X is being refunded"). The policy pages never mention it. | **Missing from policy** |
| (Not said) Returns because you changed your mind | Not allowed in practice, but no page says so plainly. | **Missing from policy** |
| Pay online through Razorpay: UPI, cards, net banking, wallets | Yes, but the live site is in **TEST mode, open to everyone**: no real money moves. The bag and checkout say "Test payment … Test orders are not shipped". The Terms, Shipping and order "Thank you" pages don't say this; they promise packing and DTDC shipping. | **No, while test mode is on** |
| Sarees held for 15 minutes when you press Pay | The hold is 15 minutes, renewed if you press Pay again, up to 30 minutes in all. | **Yes** |
| Order confirmed once the payment reaches us | The server checks every payment with Razorpay before the order counts as paid. | **Yes** |
| Email is used "to send invoices" (Privacy), and "Order confirmations and invoices come here" (sign-up form) | **The server sends no email at all.** There is no email service. Invoices can only be downloaded from My orders. | **No** |
| Order updates | Sent only as browser notifications (if turned on), plus on screen and in My orders. No SMS, no email. | Partly ("send" is vague) |
| Offers only if you tick the box; change it any time in Notifications | The server checks the customer's consent before sending offers or new-arrival messages. | **Yes** |
| Collected automatically: device, browser, sign-in time, how you found us | True. **The internet (IP) address is also saved**, with each sign-in and in the activity log, and the page doesn't say so. | Partly |
| Only the shop's staff can see your orders | Razorpay is also given the customer's name, email and mobile at Pay. DTDC gets the name, address and phone. Google (Firebase) handles notifications. The page names none of them. | **Partly** |
| No advertising trackers | `index.html` loads no tracking scripts. Razorpay's own script loads only when Pay is pressed. | Yes |
| Codes stored scrambled; secure cookie | Codes are stored as a scrambled code (`codeHash`), and sign-in uses a protected cookie. | **Yes** |
| Delete account: details removed after 7 days | A clean-up job runs every 15 minutes and removes them once 7 days have passed. It waits longer if an order is still on its way. | Yes (small detail) |
| Orders and invoices are kept "without your contact details" | **False.** After deletion, each order still holds the customer's name, mobile and full delivery address. Each invoice record and PDF still holds the name and "Mobile: …". | **No** |
| "You can close your account at any time" (Terms) | Refused while an order is paid, packed or shipped ("You have orders on the way"). | Partly (small) |
| "We reply on WhatsApp the same day" (Contact) | The shop's own promise. | Can't be checked by code |

---

## 4. Old addresses

| Old website address | Where it goes now | OK? |
|---|---|---|
| `/login`, `/register`, `/signup`, `/otp-verify`, `/mpin-setup`, `/forgot-password`, `/reset-password` | `/sign-in` | OK. Small: the old `?redirect=/checkout` part is dropped, so after signing in the customer is not taken back to checkout |
| `/products`, `/wishlist` | `/shop` | OK (the wishlist no longer exists) |
| `/cart` | `/bag` | OK |
| `/checkout` | The new checkout (same address) | OK |
| `/account`, `/account/orders` | New My account and My orders (same addresses; sign-in first) | OK |
| `/account/orders/<id>` | My orders list | OK (old ids are not the new order numbers, so the list is the best place) |
| `/order-confirmation/<id>` | My orders list | OK |
| `/category/<slug>` | Same page | OK. A category with no sarees shows "coming soon" or "isn't on the website now" |
| `/category/<slug>/<subcategory id>` | The collection page. Collection ids are the old subcategory ids. | OK |
| `/product/<slug>` | Same page | OK. A saree that sold or was hidden shows "This saree isn't on the website now" |
| `/shop?q=…` (old search) | Same search | OK |
| Anything else | The old site sent you home. The new site shows "Page not found" with two buttons. | OK |
| `/privacy-policy`, `/terms-and-conditions`, `/refund-policy`, `/shipping-policy`, `/contact-us` (common names, not on the old site) | Page not found | **Not sure.** This matters only if these addresses are saved in the Razorpay dashboard or printed somewhere |

The old website had no policy pages at all, so no old policy link is lost.

---

## 5. On the website

**How customers reach these pages**
- **Home page:** the big footer has a Help column with WhatsApp, Call and all five pages.
- **Every other page:** one line at the bottom with Shipping · Cancellation and refunds · Contact us · Privacy · Terms.
- **Checkout:** "By paying you agree to our Terms, Shipping and Cancellation and refunds policies" (no Privacy or Contact there; the footer line has them).
- **Sign-in:** the mobile step says "By continuing you agree to our terms and privacy policy". The profile step links Privacy, and the page bottom links Privacy.
- **Terms page:** links to Shipping and Refunds.
- **Phone menu:** has WhatsApp and "Visit the store", but no policy pages.
- **When the shop switches the website off,** every address shows only the "Back soon" page, so **no policy page can be opened**.
- **On phones**, the Pay bar (checkout), the Bag bar and the saree page's buy bar sit fixed at the bottom of the screen, on top of the footer line. **On laptops 1280 to 1440 pixels wide**, the round WhatsApp button sits on top of the "Terms" link. I worked this out from the page styles; I did not see it on a screen (see S10).

**Titles and search engines:** each page has its own tab title. None of the five pages sets its own description, so search engines and link previews show the home page's text. `robots.txt` lets search engines read these pages (good). It has no sitemap line (a list of pages for search engines).

**Easy to read:** each policy page has one main heading, short sections and plain words. The "page not found" page has **no main heading** (its title is a small heading).

**What Razorpay's website review needs, and what is missing**
I could not open Razorpay's website (no internet use was allowed). This list is from what I know of Razorpay's rules for shops.

| Razorpay needs | On the website? |
|---|---|
| Contact us with phone, **email** and address | Phone yes, address yes, GSTIN yes. **Email missing.** |
| Shipping and delivery policy | Yes, but marked **Draft** |
| Cancellation and refund policy | Yes, but marked **Draft**. Missing: change-of-mind returns, the shop cancelling an order it can't send |
| Terms and conditions | Yes, but marked **Draft**. Thin: no governing law or courts |
| Privacy policy | Yes, but marked **Draft**. Doesn't name Razorpay, DTDC or Google |
| Prices in rupees | Yes |
| Pages reachable from every page | Yes through the footer line, **except while the website is switched off**, and possibly hidden by the bars and WhatsApp button (see above) |
| The site must not look unfinished | The **"Draft" badges** look unfinished. The "Test payment" note goes away by itself once live keys are used. |
| The business name matches the Razorpay account | **Not sure.** The GSTIN belongs to a person (a sole owner), so Razorpay may want the owner's legal name shown next to "Nandam Handlooms". |

---

## 6. Problems found

### Must fix

**M1. Every policy page says "Draft: to be reviewed by the shop".**
- Why it matters: payments (test mode) are already live, and the owner has not approved the texts. A Razorpay reviewer may reject a site whose rules say "Draft". A customer could also argue the rules aren't final.
- Where: `Nadam-frontend/customer-web/src/pages/info/Policy.jsx:13` (Shipping, Refunds, Contact), `PrivacyPage.jsx:13`, `TermsPage.jsx:13`.

> **Second check: ✅ Correct.**

**M2. The Privacy page and the Delete account page promise that, after deletion, orders and invoices are kept "without your contact details". This is not true.**
- Why it matters: it is a wrong legal promise about personal data. Example: a customer deletes their account. Seven days later their name, mobile number and full home address are still on every order. Their name and mobile are still printed on every invoice PDF.
- Where: `src/pages/info/PrivacyPage.jsx:30`, `src/pages/account/DeletePage.jsx:46`. The deletion code `Nadam-backend/src/services/shop/account.service.js:42-80` never touches the order's address copy or the invoice (`src/services/invoice.service.js:68-69`, `src/services/invoicePdf.service.js:141-142`).

> **Second check: ✅ Correct.**

**M3. The Contact us page has no email address.**
- Why it matters: Razorpay's checklist asks for phone, email and address on the Contact page. Without an email the review may fail. (This is from my knowledge of Razorpay's rules; I could not re-check their site.)
- Where: `src/pages/info/ContactPage.jsx:13-20`. The server sends no shop email either: `Nadam-backend/src/services/shop/config.service.js:12`.

> **Second check: ✅ Correct.**

### Should fix

**S1. "Cancel before it ships and we refund in full" can't be done in the admin app for an order from last month.**
- Example: a customer pays at 10 pm on 31 Oct and asks to cancel on 1 Nov. The admin app says "Only this month's orders can be cancelled". The owner can still refund by hand in Razorpay. But the order stays in "To ship" (it could even be shipped), the saree stays sold, and the customer's page still says "Order confirmed".
- Where: promise `src/pages/info/RefundsPage.jsx:9`; rule `Nadam-backend/src/services/order.service.js:141` and `:277`.

> **Second check: ✅ Correct.** (Line slip only: the month rule is at `order.service.js:142`, not `:141`.)
> **Third check: Second checker right. Final: an online order paid last month can't be cancelled in the admin app, so "cancel before it ships, full refund" can only be done by hand (rule at `order.service.js:142`, not `:141`). Final group: Should fix.**

**S2. "Damaged or wrong saree: replacement or full refund" has no path in the system.**
- Why it matters: a delivered order can't be cancelled, so a refund is done only in Razorpay's dashboard. The customer's order keeps saying "Delivered" with no refund shown, and the GST invoice is not cancelled. Not sure whether the accountant needs a credit note (a tax document that reverses an invoice).
- Where: `src/pages/info/RefundsPage.jsx:10`; `Nadam-backend/src/services/order.service.js:140`.

> **Second check: ✅ Correct.** (Line slip only: the "not processing → can't cancel" rule is at `order.service.js:141`, not `:140`.)
> **Third check: Second checker right. Final: a shipped or delivered order can't be cancelled or refunded in the system, so "damaged or wrong saree: refund" happens only by hand in Razorpay and nothing is recorded (rule at `order.service.js:141`, not `:140`). Final group: Should fix.**

**S3. The refunds page leaves out two real cases.**
- (a) The shop cancels a paid order it can't send. The system already does this and tells the customer "Cancelled by the shop: ₹X is being refunded".
- (b) Whether a customer can return a saree because they changed their mind.
- Why it matters: both are common sources of disputes and chargebacks (money taken back through the bank), and Razorpay reads this page.
- Where: `src/pages/info/RefundsPage.jsx:8-14`; the shop-cancel message is at `src/pages/orders/OrderPage.jsx:126-129`.

> **Second check: ✅ Correct.**

**S4. "Change your address after paying by WhatsApp" can only be done by hand.**
- Why it matters: the admin app can't edit a website order's address. The packer reads the old address in the app, and the order page and invoice keep the old one.
- Where: `src/pages/info/ShippingPage.jsx:12`; admin order actions `Nadam-backend/src/routes/order.routes.js:17-24` (no address change).

> **Second check: ✅ Correct.**

**S5. "We send the tracking number as soon as it ships" is automatic only for customers who turned on browser notifications.**
- Why it matters: everyone else waits for a message that comes only if staff remember to send it on WhatsApp.
- Where: `src/pages/info/ShippingPage.jsx:10`, also `src/pages/product/ProductPage.jsx:244`.

> **Second check: ✅ Correct.**

**S6. The sign-up form and the Privacy page say the email is for order confirmations and invoices, but the website never sends any email.**
- Why it matters: customers will look for an invoice email that never comes. The privacy reason for collecting the email is also untrue.
- Where: `src/pages/account/signin/ProfileStep.jsx:105`, `src/pages/info/PrivacyPage.jsx:20` and `:25`.

> **Second check: ✅ Correct.**

**S7. The Privacy page doesn't say:**
- who else gets the data: Razorpay gets the name, email and mobile; DTDC gets the address; Google Firebase handles notifications; the SMS company gets the mobile; Amazon stores photos and invoices;
- that internet (IP) addresses are kept;
- how long anything is kept.

Why it matters: it claims to follow the DPDP Act 2023 (India's data protection law), and it says "only the shop's own staff can see your orders". Not sure which DPDP rules already apply today.
- Where: `src/pages/info/PrivacyPage.jsx:22` and `:33`; data sent to Razorpay at `Nadam-backend/src/services/shop/checkout.service.js:252`; IP saved at `src/services/shop/session.service.js:55` and `src/services/audit.service.js:12-13`.

> **Second check: ⚠️ Partly correct: the three gaps (other parties, IP addresses, how long data is kept) are real, but the page does not claim to follow the DPDP Act. It is named only in a code comment (`PrivacyPage.jsx:6`) that customers never see. Should is right.**
> **Third check: Second checker right. Final: the Privacy page customers see doesn't name who else gets their data (Razorpay, DTDC, Google Firebase, the SMS company, Amazon storage), doesn't mention the saved IP addresses, and gives no keep-times except "7 days after deleting"; it never mentions the DPDP Act (only a code comment does). Final group: Should fix.**

**S8. While payments are in test mode, the order's "Thank you" page and the policy pages promise packing and DTDC shipping, but test orders are never shipped.**
- Example: a visitor pays with the test card (as the checkout note says). They then see "Your order is confirmed and paid … Packed: within 2 working days … Shipped by DTDC", with no test note. The test note appears only on the bag and checkout.
- Where: `src/pages/orders/OrderPage.jsx:47-49` and `:278-285`; `src/payments/TestPayNote.jsx:9` and `:16`; `src/pages/info/TermsPage.jsx:27`; `src/pages/info/ShippingPage.jsx:9`.

> **Second check: ✅ Correct.**

**S9. When the shop switches the website off, the five policy pages can't be opened either.**
- Why it matters: Razorpay asks for them to be reachable. A customer whose refund is in progress can't read the refund rules.
- Where: `src/App.jsx:53`.

> **Second check: ✅ Correct.**

**S10. The help links at the very bottom can be covered (Not sure: worked out from the page styles, not seen on a screen).**
- On phones, the fixed Pay bar, Bag bar and saree buy bar sit on top of the footer line. The page's extra space is above the footer line, not below it.
- On laptops 1280 to 1440 pixels wide, the round WhatsApp button sits over the "Terms" link. A click there opens WhatsApp instead.
- Where: `src/components/Layout.jsx:36-40`, `src/theme/base.css:288-290` and `:295`, `src/theme/checkout.css:59` and `:67-68`, `src/theme/bag.css:85` and `:97`, `src/theme/shop.css:230`.

> **Second check: ⚠️ Partly correct: the phone part is right, but the laptop range is understated. From the same styles, the WhatsApp button covers "Terms" at every width from about 901 px up to about 1470 px, tablets in landscape included, not only 1280 to 1440. Should is right.**
> **Third check: Second checker right. Final: at 900 px wide and below, the fixed Pay, Bag and saree buy bars hide all five footer links at the very bottom of checkout, the bag and saree pages; from 901 px to about 1465 px wide (landscape tablets and most laptops), the round WhatsApp button sits on "Terms" once you scroll to the bottom of a long page. Final group: Should fix.**

**S11. The saree page's "Ordering and delivery" box still describes ordering only through WhatsApp.**
- Why it matters: Checkout and online payment are now live, so the box is outdated and confusing.
- Where: `src/pages/product/ProductPage.jsx:238-245` (and the note at `:223`).

> **Second check: ✅ Correct.**

**S12. After the shop cancels a paid order and the owner refunds it by hand, the customer's page may say "is being refunded" forever.**
- Why it matters: the website only learns of a hand refund from Razorpay's automatic message (a "webhook"). The deployment record says that message still goes to the **old** server. Not sure whether test mode sends these messages at all.
- Where: `Nadam-backend/src/models/checkout.model.js:44-51`; `docs/deployment/live-v2-server.md:102`.

> **Second check: ✅ Correct.**

**S13. Common policy addresses like `/privacy-policy` or `/refund-policy` show "Page not found". Not sure this matters.**
- Why it matters: if the Razorpay dashboard has policy links saved under other names, Razorpay's check would land on "Page not found". Please look at the dashboard.
- Where: `src/App.jsx:76-80`.

> **Second check: ✅ Correct.**

### Small

- **P1.** Shipping says Sunday is not a packing day, while the store is open Monday to Sunday. It's not clear whether Sunday orders wait. Where: `src/pages/info/ShippingPage.jsx:9`, `Nadam-backend/src/config/constants.js:188`.

> **Second check: ✅ Correct.**

- **P2.** Terms says "You can close your account at any time", but closing is refused while an order is on its way. Privacy's "removed after 7 days" also waits for delivery. Where: `src/pages/info/TermsPage.jsx:22`; `Nadam-backend/src/services/shop/account.service.js:24-27` and `:54`.

> **Second check: ✅ Correct.**

- **P3.** Terms has no governing law or courts, and nothing about wrong prices or the shop's right to cancel. Where: `src/pages/info/TermsPage.jsx:16-32`.

> **Second check: ✅ Correct.**

- **P4.** The refunds page doesn't say that a double payment is refunded automatically, or that Razorpay returns a payment the bank confirms too late. Where: `src/pages/info/RefundsPage.jsx:13`; `Nadam-backend/src/services/shop/checkout.service.js:470-472`.

> **Second check: ✅ Correct.**

- **P5.** "Anywhere in India, 3 to 7 days": nothing checks that DTDC serves the pincode (for example, islands and remote hill areas). Not sure how DTDC covers these. Where: `src/pages/info/ShippingPage.jsx:7` and `:10`.

> **Second check: ✅ Correct.**

- **P6.** The "page not found" page has no main heading, so screen-reader users can't jump to it. Where: `src/pages/info/NotFoundPage.jsx:10`, `src/components/bits.jsx:28`.

> **Second check: ✅ Correct.**

- **P7.** The five pages set no description of their own. After browsing a saree, the page's hidden description (and preview photo) stays the saree's. Where: `src/pages/info/Policy.jsx:8`, `PrivacyPage.jsx:8`, `TermsPage.jsx:8` (none calls `useMeta`).

> **Second check: ✅ Correct.**

- **P8.** Unknown addresses answer "OK" to search engines instead of "not found", and `robots.txt` lists no sitemap. Where: `docs/deployment/live-v2-server.md:138`, `src/App.jsx:93`, `public/robots.txt:1-7`.

> **Second check: ✅ Correct.**

- **P9.** Old sign-in links lose `?redirect=…`. Where: `src/App.jsx:71`.

> **Second check: ✅ Correct.**

- **P10.** The shop number lives in three places: the call number in admin Settings, the WhatsApp number in server code, and a hand-typed copy in `index.html`. A future change could miss one. Where: `Nadam-backend/src/config/constants.js:190`, `src/services/settings.service.js:61`, `Nadam-frontend/customer-web/index.html:29`.

> **Second check: ⚠️ Partly correct: the risk is real, but there are more than three places. The website's built-in fallback `src/config/config.js:9` and `:13` also holds both numbers, and the server falls back to the `.env` company mobile (`settings.service.js:61`). Small is right.**
> **Third check: Second checker right. Final: the shop's numbers are typed in at least five places (admin Shop details, `constants.js:190`, `index.html:29`, `config.js:9` and `:13`, and the server default `env.js:82`, which still holds the old number 9494170180), so a change can miss one; visitors normally see only the first two. Final group: Small.**

- **P11.** The test called "contact" never opens the Contact page itself. Where: `src/pages/info/contact.test.jsx:25-36`.

> **Second check: ✅ Correct.**

---

## 7. What I could not check

- **The live website.** No network use was allowed, so I trusted the deployment record that the live call number is 7382388565 and payments are in test mode for everyone.
- **Razorpay's current website rules and the Razorpay dashboard:** which policy links are saved there, and whether the live account is approved for nandamhandlooms.com. Section 5 is from my own knowledge.
- **The real nginx settings on the server** (nginx is the program that serves the website). I only read the copy in the deployment notes.
- **How the pages look on a real screen.** S10 is worked out from the styles. Please open `/terms` on a 1280-pixel-wide laptop and `/checkout` on a phone, and scroll to the bottom.
- **Legal and tax questions.** Which DPDP rules already apply, and whether a refund after delivery needs a GST credit note. These need the lawyer or the accountant.
- **DTDC's coverage and real delivery times.**
- **No tests were run** (not allowed).

---

## 8. For the developer

All website paths are under `Nadam-frontend/customer-web/`. All server paths are under `Nadam-backend/`.

| # | Where | What | Suggested fix (one line) |
|---|---|---|---|
| M1 | `src/pages/info/Policy.jsx:13`, `PrivacyPage.jsx:13`, `TermsPage.jsx:13` | `draft-note` span is hard-coded on all five pages | Put in the owner's approved texts and remove the span, or show it only when `config.payments.mode !== 'live'` until approval. |
| M2 | `src/pages/info/PrivacyPage.jsx:30`, `src/pages/account/DeletePage.jsx:46`; `src/services/shop/account.service.js:42-80` | `deleteCustomer` leaves `Order.shippingAddress` (fullName, phone, lines) and `Invoice.customerName/customerMobile` and the PDF untouched | Change both texts to "orders and invoices keep the name, mobile and address they were made with, as tax law requires" (owner/lawyer to word it). Do not blank invoice data. |
| M3 | `src/pages/info/ContactPage.jsx:13-20`; `src/services/shop/config.service.js:12`; `src/services/settings.service.js:56-66` | No shop email anywhere in `/config` | Add `shop.email` (Settings column, or `STORE.email` in `constants.js`) and a `mailto:` row on Contact. Also show it on Privacy and Terms. |
| S1 | `src/services/order.service.js:141`, `:277`; `src/pages/info/RefundsPage.jsx:9` | `NOT_THIS_MONTH` blocks cancelling an online order paid late last month | Allow online orders (status `processing`) to be cancelled regardless of month, or extend the window to N days for `channel === 'online'`. |
| S2 | `src/services/order.service.js:140`; `RefundsPage.jsx:10` | No refund or return record after delivery | Short term: say "we refund by hand within X days". Later: a "Refunded after delivery" action (audit + order note + credit note per the accountant). |
| S3 | `src/pages/info/RefundsPage.jsx:8-14` | Missing sections | Add "If we can't send your order, we cancel it and refund in full" and a plain "Returns" line (owner's decision). |
| S4 | `src/pages/info/ShippingPage.jsx:12`; `src/routes/order.routes.js:17-24` | No admin endpoint to edit an online order's `shippingAddress` | Either reword ("we'll note the new address on the parcel") or add `PATCH /orders/:id/address` for `processing` orders (audit, then re-make the invoice). |
| S5 | `src/pages/info/ShippingPage.jsx:10`, `src/pages/product/ProductPage.jsx:244` | Tracking is sent only by push (`src/services/shop/orderNotices.service.js`) to opted-in browsers | Reword: "it shows in My orders; turn on notifications to get it on your phone". |
| S6 | `src/pages/account/signin/ProfileStep.jsx:105`; `src/pages/info/PrivacyPage.jsx:20`, `:25` | No email sender exists in the server | Change the hint to something true (for example "So we can reach you about an order") and drop "send invoices" from Privacy until email exists. |
| S7 | `src/pages/info/PrivacyPage.jsx:22`, `:33`; `src/services/shop/checkout.service.js:252`; `src/services/shop/session.service.js:55`; `src/services/audit.service.js:12-13` | Third parties, IP and retention are not stated | Add a "Who else sees it" list (Razorpay, DTDC, Google Firebase, SMS provider, Amazon Web Services), mention IP addresses, and add a "How long we keep it" section (bag 60 days, codes 2 days, sign-in records 1 year, orders and invoices as tax law requires). |
| S8 | `src/pages/orders/OrderPage.jsx:47-49`, `:278-285`; `src/payments/TestPayNote.jsx:9` | No test note after paying | Render `<TestPayNote />` on the order page, and hide the "Packed / Shipped by DTDC" steps when `config.payments.mode === 'test'`. |
| S9 | `src/App.jsx:53` | Maintenance replaces every route | Let `/shipping`, `/refunds`, `/contact`, `/privacy` and `/terms` render (without Layout, or with a minimal one) even when `config.maintenance.on`. |
| S10 | `src/components/Layout.jsx:36-40`; `src/theme/base.css:288-290`, `:295`; `src/theme/checkout.css:59`, `:67-68`; `src/theme/bag.css:85`, `:97`; `src/theme/shop.css:230` | Fixed bars and the FAB overlap `.ftr-line` at the page bottom | Add bottom padding to `.ftr-line` when a bar or the FAB is shown (for example a class on the Layout root) and check at 390 and 1280 px. |
| S11 | `src/pages/product/ProductPage.jsx:223`, `:238-245` | WhatsApp-only ordering text | Show Checkout steps when `config.payments.enabled`, and keep the WhatsApp text as the fallback. |
| S12 | `src/models/checkout.model.js:44-51`; `docs/deployment/live-v2-server.md:102` | Hand refunds are known only from `refund.processed` webhook events | Move the webhook (web-04 section 18 step 5), or have `payments.job.js` poll Razorpay's refunds for `cancelled_paid` orders. |
| S13 | `src/App.jsx:76-80` | No aliases | After checking the Razorpay dashboard, add `<Navigate replace>` routes for `privacy-policy`, `terms-and-conditions`, `refund-policy`, `cancellation-policy`, `shipping-policy` and `contact-us`. |
| P1 | `src/pages/info/ShippingPage.jsx:9` | Sunday wording vs 7-day store | Owner to confirm the packing days, then word it to match. |
| P2 | `src/pages/info/TermsPage.jsx:22` | "at any time" | Add "once no order is on its way". |
| P3 | `src/pages/info/TermsPage.jsx:16-32` | Thin terms | Add governing law (courts in Guntur, Andhra Pradesh, or as the lawyer says), wrong-price and stock cancellation, and a liability line. |
| P4 | `src/pages/info/RefundsPage.jsx:13` | Missing automatic cases | Add "paid twice" and "bank confirmed too late: Razorpay returns it by itself". |
| P5 | `src/pages/info/ShippingPage.jsx:7`, `:10` | No serviceability check | Add "remote areas may take longer" (owner to decide). |
| P6 | `src/pages/info/NotFoundPage.jsx:10`, `src/components/bits.jsx:28` | No `h1` | Give `EmptyState` an `as`/`level` prop and use `h1` on NotFoundPage. |
| P7 | `src/pages/info/Policy.jsx:8`, `PrivacyPage.jsx:8`, `TermsPage.jsx:8`; `src/utils/useMeta.js:16` | Stale description and `og:image` after in-app navigation | Call `useMeta('<one-line summary>')` on each page. Also note that `useMeta` never clears `og:image`. |
| P8 | `docs/deployment/live-v2-server.md:138`; `public/robots.txt` | Soft 404 (an unknown address answers "OK"); no sitemap | Add `<meta name="robots" content="noindex">` on NotFoundPage. Optionally add a `Sitemap:` line. |
| P9 | `src/App.jsx:71` | `?redirect=` dropped | Map `redirect` to `/sign-in?next=` (it goes through `safeNext`, so it stays safe). |
| P10 | `src/config/constants.js:190`; `src/services/settings.service.js:61`; `index.html:29` | Three sources for the shop number | Long term, move the WhatsApp number into Settings next to the call number. Keep a test that greps `index.html`. |
| P11 | `src/pages/info/contact.test.jsx:25-36` | Contact page not rendered in its own test | Add `page('./ContactPage.jsx')` and assert the `tel:` and `wa.me` links, the store lines and the GSTIN. |

Other notes, checked and fine:
- **Policy page structure:** `Policy.jsx` keys are unique (the headings).
- **Contact numbers:** `ContactPage.jsx:8` strips the leading 91 correctly.
- **Built-in fallback:** `config.js:9-15` already has the new number.
- **No old numbers left:** 9494170180 and 7382968566 appear only in test fixtures (`CheckoutPage.test.jsx:22`, `OrderPage.test.jsx:16`, `MyOrdersPage.test.jsx:14`), not in pages.
- **The `/config` call:** it is public, cached for 60 seconds, and is the only call these pages make.

## Second check (26 Oct 2026)

Every finding in "Problems found" (M1–M3, S1–S13, P1–P11) and the extra notes in "For the developer" were checked against the code, read only.

- ✅ Correct: **24**
- ⚠️ Partly correct: **3** (S7, S10, P10)
- ❌ Wrong: **0**

Two line slips are counted as ✅ (S1: the rule is at `order.service.js:142`; S2: at `:141`). Details and evidence: [checks/12-info-pages-check.md](checks/12-info-pages-check.md).

## Third check (26 Oct 2026)

Tie-breaker for the three ⚠️ items (S7, S10, P10) and the second checker's line-number note (S1, S2). Read only.

- Second checker right: **5** (S7, S10, P10, S1 line, S2 line)
- First reviewer right: **0**
- Both partly right: **0**
- Neither right: **0**

No group changes: S7 Should, S10 Should, P10 Small, S1 Should, S2 Should.
Two extra points: the server's default call number in `Nadam-backend/src/config/env.js:82` is still the old 9494170180, so the "No old numbers left" note above is not quite true (no visitor sees it today). On the home page, the WhatsApp button also sits on the Theme switch's "Dark" choice at 901 to about 1465 px.
Details and evidence: [checks/12-info-pages-third-check.md](checks/12-info-pages-third-check.md).

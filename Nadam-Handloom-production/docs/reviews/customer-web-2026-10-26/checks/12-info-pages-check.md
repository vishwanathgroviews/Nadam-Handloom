# Second check: Module 12, info and policy pages

Date: 26 Oct 2026 · Checked against the code on this Mac, read only. Nothing was run and no code was changed.
Report checked: [`../12-info-pages.md`](../12-info-pages.md)

Website paths are under `Nadam-frontend/customer-web/`. Server paths are under `Nadam-backend/`.

## Summary

| Id | Finding (one line) | Report's group | Verdict | Right group |
|---|---|---|---|---|
| M1 | Every policy page shows "Draft: to be reviewed by the shop" | Must | ✅ | Must |
| M2 | "Orders and invoices kept without your contact details" is false | Must | ✅ | Must |
| M3 | Contact us has no email address | Must | ✅ | Must |
| S1 | Last month's paid order can't be cancelled in the admin app | Should | ✅ (line slip: rule is at :142) | Should |
| S2 | Damaged or wrong saree refund has no path in the system | Should | ✅ (line slip: rule is at :141) | Should |
| S3 | Refunds page leaves out shop-cancel and change-of-mind | Should | ✅ | Should |
| S4 | Address change after paying can only be done by hand | Should | ✅ | Should |
| S5 | Tracking number is "sent" only to browsers with notifications on | Should | ✅ | Should |
| S6 | Sign-up and Privacy say email gets confirmations/invoices; no email is sent | Should | ✅ | Should |
| S7 | Privacy page misses third parties, IP addresses, how long data is kept | Should | ⚠️ | Should |
| S8 | Test-mode orders: Thank-you page promises packing and DTDC, no test note | Should | ✅ | Should |
| S9 | Website switched off: policy pages can't be opened | Should | ✅ | Should |
| S10 | Bottom help links covered by fixed bars (phones) and the WhatsApp button (laptops) | Should | ⚠️ | Should |
| S11 | Saree page "Ordering and delivery" box still WhatsApp-only | Should | ✅ | Should |
| S12 | Hand refund never shows as done ("is being refunded" forever) | Should | ✅ | Should |
| S13 | `/privacy-policy`, `/refund-policy` etc. show "Page not found" | Should | ✅ | Should (only matters if the Razorpay dashboard uses them) |
| P1 | Sunday is not a packing day, store open Monday to Sunday | Small | ✅ | Small |
| P2 | "Close your account at any time" vs refused while an order is on its way | Small | ✅ | Small |
| P3 | Terms has no governing law, wrong-price or right-to-cancel lines | Small | ✅ | Small |
| P4 | Refunds page doesn't mention double-payment and late-bank refunds | Small | ✅ | Small |
| P5 | "Anywhere in India, 3 to 7 days" with no pincode coverage check | Small | ✅ | Small |
| P6 | "Page not found" has no main heading | Small | ✅ | Small |
| P7 | Policy pages set no description; old saree description and photo stay | Small | ✅ | Small |
| P8 | Unknown addresses answer "OK"; no sitemap line | Small | ✅ | Small |
| P9 | Old sign-in links lose `?redirect=` | Small | ✅ | Small |
| P10 | Shop number kept in three places | Small | ⚠️ | Small |
| P11 | The "contact" test never opens the Contact page | Small | ✅ | Small |

**Counts: ✅ 24 · ⚠️ 3 · ❌ 0** (27 findings).

Line slips that do not change the finding (counted as ✅): S1 cites `order.service.js:141` for the month rule; it is at `:142`. S2 cites `:140` for the "shipped/delivered can't be cancelled" rule; it is at `:141`. Both sit in the same small function `cancelBlock` (`order.service.js:138-144`).

---

## Must fix

### M1. "Draft" badge on every policy page: ✅ Correct
- **Why:** the badge is hard-coded, with no switch. Shipping, Refunds and Contact all use the shared `Policy` component, so all five pages show it. The deployment record lists "the owner's policy texts (pages say Draft)" as still to do before real selling, while checkout is open to everyone.
- **Evidence:** `src/pages/info/Policy.jsx:13` `<span className="draft-note">Draft: to be reviewed by the shop</span>` (used by `ShippingPage.jsx`, `RefundsPage.jsx`, `ContactPage.jsx`); `PrivacyPage.jsx:13` and `TermsPage.jsx:13` have the same span; `docs/deployment/live-v2-server.md:104` "Before real selling: … the owner's policy texts (pages say "Draft")".
- **Group:** Must is right. A Razorpay reviewer may treat "Draft" policies as unfinished. That part is outside the code, so it's a judgment call, but a reasonable one.

### M2. Privacy and Delete account promise data is removed from orders and invoices: ✅ Correct
- **Why:** the deletion code clears the login account, the profile, saved addresses, the bag, sessions, push tokens and codes. It never touches the order's own address copy, the invoice row or the invoice PDF.
  - Clears: `authAccount` phone, email, sign-in secrets (`account.service.js:56-62`); profile name → "Deleted customer", city, state, pincode, birthday etc. (`:63-71`); saved addresses (`:72`); bag (`:73`); sessions (`:74-75`); push (`:76`); codes (`:77-78`); avatar file (`:83`).
  - Keeps: `Order.shippingAddress` JSON = `fullName, phone, line1, line2, landmark, city, state, pincode` (`checkout.service.js:51-54` `snapshot`, stored at `:307`); `Invoice.customerName`, `Invoice.customerMobile` (`prisma/schema.prisma:692-693`, filled at `invoice.service.js:101-102`); the PDF prints the name and `Mobile: …` (`invoicePdf.service.js:141-142`, fed from `invoice.service.js:68-69`).
  - Nothing else in the code blanks these later: the only writes to `shippingAddress` are at order creation and the invoice name fix (`invoiceBook.service.js:152`), which refuses online orders (`:88` `if (inv.channel === 'online') return 'ONLINE'`).
- **Evidence (the promise):** `src/pages/info/PrivacyPage.jsx:30` "orders and invoices are kept as tax law requires, without your contact details"; `src/pages/account/DeletePage.jsx:46` "Orders and GST invoices stay with the shop for tax records, without your contact details."
- **Group:** Must is right (a wrong privacy promise). The suggested fix (change the words, don't blank invoice data) is sensible.

### M3. No email on Contact us: ✅ Correct
- **Why:** the Contact page shows store, hours, call, WhatsApp and business details only. The server's `/config` has no email field, and neither server has any email sender.
- **Evidence:** `src/pages/info/ContactPage.jsx:13-20` (three sections: Store, Phone and WhatsApp, Business details); `Nadam-backend/src/services/shop/config.service.js:12` `shop: { name, mobile, address, gstin, website }` (no email); `src/config/env.js` has no shop email setting (only `FIREBASE_CLIENT_EMAIL`); no mail library in the new or old server.
- **Razorpay part (outside the code):** to my knowledge Razorpay's website check asks for a Contact Us page with an email, phone and address. I'm fairly sure about this, but I could not re-check Razorpay's current page.
- **Group:** Must is right, because it can block the payment review.

---

## Should fix

### S1. Last month's paid order can't be cancelled: ✅ Correct (line slip)
- **Why:** the admin cancel refuses any order whose `placedAt` is not in the current IST month. `placedAt` is set when the checkout starts (Pay), so the 31 Oct 10 pm → 1 Nov example is right. Cancelling an online order also never calls Razorpay; it only reports `refundDue`, so the refund is by hand in any case.
- **Evidence:** `Nadam-backend/src/services/order.service.js:142` `if (!istSameMonth(order.placedAt)) return 'NOT_THIS_MONTH';` (report says `:141`); `:277` the message "Only this month's orders can be cancelled…"; `src/utils/day.js:21` `istSameMonth` compares IST year-month; `order.service.js:304` returns `refundDue` with no Razorpay call. Promise: `src/pages/info/RefundsPage.jsx:9`.
- **Group:** Should is right. The refund can still be made by hand, but the order record stays wrong.

### S2. Damaged or wrong saree has no path: ✅ Correct (line slip)
- **Why:** any order not in `processing` (so shipped and delivered too) can't be cancelled. There is no return or refund action in the admin order routes. A hand refund in Razorpay leaves the order "delivered" and the invoice not cancelled.
- **Evidence:** `order.service.js:141` `if (order.status !== 'processing') return 'SHIPPED';` (report says `:140`); `src/routes/order.routes.js:17-24` (list, counts, unpaid, get, ship, tracking, delivered, cancel; nothing for refund or return). Promise: `RefundsPage.jsx:10`.
- **Group:** Should is right. The promise can still be kept by hand; only the records are missing. The credit-note question is for the accountant.

### S3. Refunds page leaves out two real cases: ✅ Correct
- **Why:** the page's five sections cover cancel before or after shipping, damage, defects, how refunds are paid, and late payments. They say nothing about the shop cancelling a paid order or about change-of-mind returns. The order page does show the shop-cancel case.
- **Evidence:** `RefundsPage.jsx:8-14`; `src/pages/orders/OrderPage.jsx:126-129` "Cancelled by the shop: ₹X is being refunded … we couldn't send this order"; state made at `checkout.service.js:90` (`cancelled` + paid → `cancelled_paid`).

### S4. Address change after paying only by hand: ✅ Correct
- **Why:** the admin order routes have no address edit. The invoice "correct customer" action refuses online orders, and the customer API has no order-address change either. Both the order page and the invoice read the order's own address copy.
- **Evidence:** promise `ShippingPage.jsx:12`; `order.routes.js:17-24`; `invoiceBook.service.js:85-88` (`ONLINE` block); `routes/shop/index.js` orders router (list, get, invoice, buy-again, pay, verify, cancel checkout: no address); `checkout.service.js:117` "The address is always the copy kept on the order".

### S5. Tracking "sent" only by browser notification: ✅ Correct
- **Why:** marking an order shipped calls `tellCustomer`. That only sends a web push to the customer's browsers that have order updates turned on. With no device, the notice is stored as `no_device` and nothing is sent. There is no SMS or email. The admin app's "send tracking" is a WhatsApp share staff must press by hand.
- **Evidence:** `order.service.js:231` `tellCustomer(order, noticeFor.shipped(...))`; `src/services/shop/orderNotices.service.js:1-4, 25-31`; `src/services/shop/push.service.js:108-110` (`activeForAccount(accountId, topic)`, `no_device`); `order.service.js:180` `sendTracking` action. Promise: `ShippingPage.jsx:10`, `ProductPage.jsx:244`.

### S6. Email promised for confirmations and invoices, never sent: ✅ Correct
- **Why:** no email sender exists in the new server (or the old one). Invoices are only downloaded from the order page.
- **Evidence:** `src/pages/account/signin/ProfileStep.jsx:105` hint "Order confirmations and invoices come here."; `PrivacyPage.jsx:20` "(to deliver your orders and send invoices)", `:25` "send order updates and GST invoices"; no mail package or sender in `Nadam-backend/src` or `package.json`; invoice download route `routes/shop/index.js` `o.get('/:number/invoice', …)`.

### S7. Privacy page misses who else gets data, IP addresses and how long data is kept: ⚠️ Partly correct
- **What is right:** all three gaps are real.
  - Razorpay gets name, email and mobile: `checkout.service.js:252` `prefill: { name, email, contact }`.
  - IP addresses are saved with each session (`src/services/shop/session.service.js:55` `ipAddress: ctx.ip`) and in every audit row (`src/services/audit.service.js:12-13`).
  - The page has no retention section, though the code has real periods: `src/jobs/cleanup.job.js:4-6, 24-27` (codes 2 days, removed push tokens 90 days, bag 60 days, sign-in records 1 year).
  - The page says "only the shop's own staff can see your orders" (`PrivacyPage.jsx:33`).
  - Others: the SMS company (`services/sms/messagecentral.provider.js`), Firebase push, and S3 storage (`env.js:64-72`).
- **What is wrong:** "it claims to follow the DPDP Act 2023" is not true of the page customers see. The Act is named only in a code comment (`PrivacyPage.jsx:6` `// What we collect and why (Digital Personal Data Protection Act, 2023). DRAFT for the shop.`). Nothing on the rendered page mentions DPDP (no match in `src/` or `index.html` apart from that comment).
- **Group:** Should is right.

### S8. Test-mode orders get a normal "Thank you" with packing and DTDC steps: ✅ Correct
- **Why:** the test note component is used only in the bag panel, the bag page and checkout. The order page never shows it, and its "What happens next" steps are fixed text.
- **Evidence:** `src/payments/TestPayNote.jsx:9` (shows only in test mode) and `:16` "Test orders are not shipped."; used at `BagPanel.jsx:55`, `BagPage.jsx:177`, `CheckoutPage.jsx:377` only; `OrderPage.jsx:47-49` ("Packed: Within 2 working days", "Shipped by DTDC", "Usually 3 to 7 days"), `:278-285` ("Thank you … is confirmed and paid"). `TermsPage.jsx:27`, `ShippingPage.jsx:9` as cited.

### S9. Website switched off hides the policy pages too: ✅ Correct
- **Why:** when maintenance is on, `App` returns the "Back soon" page before any route is matched.
- **Evidence:** `src/App.jsx:53` `if (config.maintenance?.on) return <MaintenancePage … />;` (routes start at `:59`).

### S10. Bottom help links can be covered: ⚠️ Partly correct
- **Phones (right):** at ≤900 px the Pay bar, Bag bar and saree buy bar are `position: fixed; bottom: 0` (`checkout.css:59, 67`; `bag.css:85, 96`; `shop.css:230`, the buy bar shows whenever the main buy row has scrolled up, `ProductPage.jsx:92`). The extra space is inside the page (`checkout.css:68` `.co-page { padding-bottom: 96px }`, `bag.css:97`), which sits above the footer line (`Layout.jsx:27-35`). The footer line itself has only 18 px bottom padding (`base.css:288`), and the saree page has no extra space at all. So at the very bottom, the bar covers the footer links.
- **Laptops (scenario understated):** the round WhatsApp button (`base.css:295`: fixed, right 18 px, bottom 20 px, 54 px) shows on the policy and shop pages (`Layout.jsx:19, 36-40`). "Terms" is the last link, pushed to the right edge of `.wrap` (`base.css:29` max 1360 px, 16 px gutter; `:289` `space-between`). Working it out from these styles, the button overlaps "Terms" at every width from about **901 px up to about 1470 px**, not only 1280 to 1440. That range includes tablets in landscape (1024, 1180) and most laptops. At ≤900 px the button moves up to 66 px (`base.css:298`) and clears the links.
- **Not seen on a screen**, as the report says.
- **Group:** Should is right.

### S11. Saree page "Ordering and delivery" box is WhatsApp-only: ✅ Correct
- **Why:** the box and the hold note are fixed text. The saree page never reads `config.payments`, while the bag and bag panel switch to Checkout when payments are on.
- **Evidence:** `ProductPage.jsx:238-245` ("Tap Send bag on WhatsApp … We confirm they are available and share the payment details"), `:223` ("Send your bag on WhatsApp and we confirm it is still here"); the page uses only `config.store.whatsapp` and `config.shop.mobile` (`:113, :118`); `BagPage.jsx:86` and `BagPanel.jsx:22, 54` use `usePaymentsOn()`.

### S12. Hand refund never shows as done: ✅ Correct
- **Why:** "refunded" for a shop-cancelled order depends only on `PaymentEvent` rows of type `refund.processed`. Only the new server's webhook handler writes these rows. Razorpay's notices go to the old server, whose webhook only handles captured payments and has no `PaymentEvent` table code. No job asks Razorpay about hand refunds. So while the webhook points at the old server, the page keeps saying "is being refunded".
- **Evidence:** `src/models/checkout.model.js:44-51` (`paymentEvent.findMany({ where: { type: 'refund.processed' … } })`); only writer `src/services/shop/checkout.service.js:683`; `OrderPage.jsx:124-129` (`done = order.cancelled?.refundedAt`); `docs/deployment/live-v2-server.md:102` (webhook still goes to the old server); old server `Nadam-Handloom/backend/src/modules/orders/orders.service.ts:211` `if (payload?.event !== 'payment.captured') return;` (no `refund.processed`, no `PaymentEvent` anywhere in the old server).
- **Test mode:** Razorpay keeps separate webhook settings for test and live. Either way none reach the new server today, so the result is the same.

### S13. Common policy addresses show "Page not found": ✅ Correct
- **Why:** only `/privacy`, `/terms`, `/shipping`, `/refunds` and `/contact` exist. Every other path falls to the catch-all.
- **Evidence:** `src/App.jsx:76-80`, catch-all `:93`.
- **Group:** Should, but only if the Razorpay dashboard holds links under other names. That's outside the code, and the report says so.

---

## Small

- **P1 ✅.** `ShippingPage.jsx:9` "Orders paid on a Sunday or a festival holiday are packed the next working day" vs `Nadam-backend/src/config/constants.js:188` `hours: 'Monday to Sunday, 9:30 am to 8:30 pm'` (shown on Contact).
- **P2 ✅.** `TermsPage.jsx:22` "You can close your account at any time"; refused at `account.service.js:24-27` (`OPEN_ORDERS` "You have orders on the way…"; `openOrderCount` counts paid/processing/shipped, `customer.model.js:47-48`); deletion postponed at `:54`.
- **P3 ✅.** `TermsPage.jsx:16-32` has only Your account, Shopping and Contact; no governing law, wrong-price, stock-cancel or liability lines.
- **P4 ✅.** `RefundsPage.jsx:13` covers only "paid after the hold, a saree sold". The code also refunds a second payment (`checkout.service.js:470` `refund-extra`, `:472` "Paid twice"), and marks a payment Razorpay returned as failed, "Returned by Razorpay (not taken in time)" (`:450-451`).
- **P5 ✅.** `ShippingPage.jsx:7, :10`; the `Pincode` table (`schema.prisma:873-879`) holds only area, city and state, and nothing checks courier coverage.
- **P6 ✅.** `NotFoundPage.jsx:10` uses `EmptyState`, whose title is an `<h3>` (`src/components/bits.jsx:28`); the header has no `<h1>`.
- **P7 ✅.** No info page calls `useMeta` (only home, shop, category, collection(s) and saree pages do). `useMeta` (`src/utils/useMeta.js:16-24`) has no clean-up and sets `og:image` only when given one, so the previous page's description and photo stay. The developer-table note "useMeta never clears og:image" is also right (`:23`).
- **P8 ✅.** Catch-all `App.jsx:93`; nginx `try_files $uri /index.html` in `docs/deployment/live-v2-server.md:138` (that is the planned config in the notes; the live file was not read); `public/robots.txt:1-7` has no `Sitemap:` line.
- **P9 ✅.** `App.jsx:71` `<Navigate to="/sign-in" replace />` drops the query; the old site really used `?redirect=` (`Nadam-Handloom/frontend/customer-web/src/pages/CheckoutPage.jsx:80` `/login?redirect=/checkout`); the new page reads `?next=` (`SignInPage.jsx:24`).
- **P10 ⚠️ Partly correct.** The risk is real, but there are more than three places. The website's built-in fallback also holds both numbers: `src/config/config.js:9` `mobile: '7382388565'` and `:13` `whatsapp: '917382388565'`. These are used before `/shop/config` answers and if it fails. The server also falls back to the `.env` company mobile when Settings is empty (`settings.service.js:61`). The suggested test should check `config.js` as well as `index.html`.
- **P11 ✅.** `src/pages/info/contact.test.jsx:25-36` renders Terms, Privacy and Maintenance only; `ContactPage.jsx` is never rendered in any test there.

## "For the developer" and "checked and fine" notes
- The developer table repeats M1–P11 with the same paths. Its extra details were checked above (M2 fields, S5 push-only, S12 `refund.processed` only, P7 `og:image`).
- "Checked and fine" notes are right:
  - the `Policy.jsx` keys are the section headings (`:19`);
  - `ContactPage.jsx:8` strips a leading 91;
  - `config.js:9-15` has the new number;
  - the old numbers 9494170180 and 7382968566 appear only in `CheckoutPage.test.jsx:22`, `OrderPage.test.jsx:16` and `MyOrdersPage.test.jsx:14`;
  - `/config` is public and cached for 60 seconds (`src/controllers/shop/public.controller.js:22` `'public, max-age=60'`).

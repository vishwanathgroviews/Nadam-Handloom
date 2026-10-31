# Third check: Module 12, info and policy pages

Date: 26 Oct 2026 · Tie-breaker for the items the second checker marked ⚠️, and its line-number note. Read only: nothing was run and no code was changed.
Report: [`../12-info-pages.md`](../12-info-pages.md) · Second check: [`12-info-pages-check.md`](12-info-pages-check.md)

Website paths are under `Nadam-frontend/customer-web/`. Server paths are under `Nadam-backend/`.

## Summary

| Id | Title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| S7 | Privacy page leaves things out | 3 gaps (other parties, IP addresses, keep-times); page "claims to follow the DPDP Act 2023" | Gaps are real; the page never names the DPDP Act (only a code comment does) | **Second checker right** | Should fix |
| S10 | Bottom help links covered | Phones: bars cover the footer line. Laptops **1280 to 1440 px**: WhatsApp button covers "Terms" | Phone part right; button covers "Terms" from about **901 to 1470 px** | **Second checker right** | Should fix |
| P10 | Shop number typed in many places | **Three** places | **More than three**: also `config.js:9`, `:13` and the server's `.env` fallback | **Second checker right** (and one more place both missed) | Small |
| S1 (line) | Month rule line number | `order.service.js:141` | It is at `:142` | **Second checker right** | Should fix (finding unchanged) |
| S2 (line) | "Shipped can't be cancelled" line number | `order.service.js:140` | It is at `:141` | **Second checker right** | Should fix (finding unchanged) |

**Counts:** Second checker right **5** · First reviewer right **0** · Both partly right **0** · Neither right **0**.

---

## S7. Privacy page leaves things out

**What really happens.** The page a customer sees (`src/pages/info/PrivacyPage.jsx:11-36`) has five parts: What we collect, Why, Your choices, Keeping it safe, Contact. It does **not** say:
- **Who else gets the data.** Razorpay gets name, email and mobile at Pay (`Nadam-backend/src/services/shop/checkout.service.js:252` `prefill: { name, email, contact }`). DTDC gets the name, address and phone on the parcel. Google Firebase sends the notifications. The SMS company gets the mobile (`Nadam-backend/src/services/sms/messagecentral.provider.js`). Amazon S3 keeps photos and PDFs (`Nadam-backend/src/config/env.js:62-64`). The page says instead "only the shop's own staff can see your orders" (`PrivacyPage.jsx:33`).
- **IP addresses.** The "Automatically" line lists device, browser, sign-in time and where you came from (`PrivacyPage.jsx:22`). No IP address. But the server saves it with each sign-in (`Nadam-backend/src/services/shop/session.service.js:55` `ipAddress: ctx.ip`) and in every activity-log row (`Nadam-backend/src/services/audit.service.js:12`).
- **How long things are kept.** There is no keep-time section. The page gives only "removed after 7 days" after deleting an account, and "orders and invoices are kept as tax law requires" (`PrivacyPage.jsx:30`). The real times in the code are not shown: codes 2 days, bag 60 days, sign-in records 1 year, the rest of the activity log kept for good (`Nadam-backend/src/jobs/cleanup.job.js:1-6`, `:25-27`).

**The DPDP part.** The page text never mentions the DPDP Act or any law apart from "tax law". The only mention is a code comment customers never see: `PrivacyPage.jsx:6` `// What we collect and why (Digital Personal Data Protection Act, 2023). DRAFT for the shop.` A search of `src/`, `index.html` and `public/` finds nothing else.

**Why the first reviewer went wrong.** It read the code comment as if it were page text. The three gaps it found are real.

**Is the second checker right?** Yes, on both counts: the gaps are real and there is no DPDP claim on the page. One small extra: "how long anything is kept" is a little too strong, since the page does give the 7-day deletion time. The rest has no keep-time.

**Group.** Should fix. "Only the shop's own staff can see your orders" is loose wording, not a clear false promise like M2. As far as I know, the DPDP Rules (published Nov 2025) start the privacy-notice duties about 18 months later, around May 2027. I could not check this online. So this is not yet a legal breach today, but it needs fixing before then.

---

## S10. Bottom help links covered

**The styles that decide it**
- **WhatsApp button:** fixed, 18 px from the right edge, 20 px from the bottom, 54 px round (`src/theme/base.css:295`). At 900 px wide and below it moves up to 66 px from the bottom (`base.css:298`). It shows on home, shop lists, collections, categories, the five policy pages and "Page not found". It does not show on the saree page, bag, checkout, order page, sign-in or account pages (`src/components/Layout.jsx:19`, `:36-40`).
- **One-line footer:** 18 px space under the links (`base.css:288`). Text is 0.8 rem (12.8 px) on a 1.55 line, so each link is about 20 px tall and sits **18 to 38 px above the page bottom**. "Terms" is the last link, pushed to the right edge of the content (`base.css:289` `justify-content: space-between`, `src/components/Footer.jsx:11`, `:84`). Above 900 px it all fits on one row.
- **Content width:** at most 1360 px, with 16 px side space (`base.css:29`, `src/theme/tokens.css:22`).
- **Bottom bars on phones:** Pay bar (`src/theme/checkout.css:59`, shown only at 900 px and below `:64-67`), Bag bar (`src/theme/bag.css:85`, `:90-96`), saree buy bar (`src/theme/shop.css:230`, hidden from 901 px `:235`, slides in once the main buy buttons scroll away, `src/pages/product/ProductPage.jsx:89-93`). All are fixed at the bottom, about 67 px tall (the saree bar about 81 px, because of its 58 px photo).

**Computers and landscape tablets (901 px and wider)**
- Up to 1360 px wide, "Terms" ends 16 px from the window's right edge. The button covers 18 to 72 px from the right edge, at 20 to 74 px up. The round button sits on the left and middle of the word.
- Above 1360 px the content is centred, so "Terms" moves left by half the extra width. At 1440 px the button still covers the "ms" end. It clears the word at about **1465 to 1470 px**.
- So "Terms" is covered at **every width from 901 to about 1465 px**. That includes 1024 and 1180 px tablets in landscape and 1280, 1366 and 1440 px laptops. It is not covered at 1536 or 1920 px.
- It only happens once you scroll to the bottom of a page that is taller than the window. Shipping, Refunds, Privacy, Terms and the shop lists are tall enough. On a short page (Contact, Page not found) in a tall window, the footer sits higher and nothing is covered.
- "Privacy", the link before Terms, ends about 70 px from the right edge. The round button only grazes it, so it is not really covered.
- Side note (not a policy link): on the home page's big footer, the button sits on the **"Dark" choice of the Theme switch** at the same widths (`base.css:275` 28 px bottom space, `:283` bottom row, `:292`; `src/components/Footer.jsx:70`).

**Phones and narrow windows (900 px and below)**
- The button moves up to 66 to 120 px from the bottom. On phones the links wrap onto two rows under the copyright, and the top link row ends about 62 px up. So the button clears every link.
- On checkout, the bag and the saree page, the fixed bar (67 to 81 px tall) covers the whole link area. **All five links are hidden** at the very bottom of those three pages. The page's extra space is inside the page, above the footer line (`checkout.css:68`, `bag.css:97`, `ProductPage.jsx:270`), so you can't scroll the links out from under the bar.
- On checkout, Terms, Shipping and Refunds are still reachable from the "By paying you agree to our …" line (`src/pages/checkout/CheckoutPage.jsx:423`). Privacy and Contact are not.

**Why the first reviewer went wrong.** It named only common laptop sizes (1280 to 1440). It did not follow the rule through to the 901 px switch point or out to where the centred content clears the button.

**Is the second checker right?** Yes. "About 901 to 1470 px" matches the styles. Its reason for why it stops at 900 px (the button moves up to 66 px) is also right. Its phone reasoning is right too.

**Group.** Should fix. The links are hidden or half-covered, which confuses people, but there are other ways to reach the pages. Nobody is stuck. Not seen on a real screen.

---

## P10. Shop number typed in many places

**Every place the shop's numbers are typed in (code and settings):**

| # | Place | What it holds | Does a visitor see it? |
|---|---|---|---|
| 1 | Admin app → Settings → Shop details (live database), read at `Nadam-backend/src/services/settings.service.js:61` | Call number 7382388565 | **Yes, always**: Contact, Privacy, home footer and more |
| 2 | `Nadam-backend/src/config/constants.js:190` `whatsapp: '917382388565'` | WhatsApp number | **Yes, always**: every WhatsApp link and number |
| 3 | `Nadam-frontend/customer-web/index.html:29` | "+91 73823 88565" in the no-JavaScript message | Only if JavaScript is off |
| 4 | `Nadam-frontend/customer-web/src/config/config.js:9` `mobile: '7382388565'` and `:13` `whatsapp: '917382388565'` | Built-in fallback for both numbers | Only for a moment while the page loads, or for the whole visit if the settings call fails (`config.js:24`, `:35-42`) |
| 5 | Server fallback when Shop details has no number: `.env` `COMPANY_MOBILE` (not opened), else the code default `Nadam-backend/src/config/env.js:82` `default('+919494170180')` | The **old** number 9494170180 in code | **No, not today.** Live has the number saved, and the admin form refuses an empty number (`src/validators/settings.validators.js:28`). It would show on a fresh database (for example a new server) if `.env` doesn't set it |

The same numbers are also copied into tests: `Nadam-backend/tests/support/web-index.html:37`, `Nadam-backend/tests/api/shop/catalog.test.js:197`, `Nadam-frontend/customer-web/e2e/w5.e2e.cjs:203`, `src/pages/info/contact.test.jsx:22`, `:39`, `src/pages/account/SignInPage.test.jsx:152`, `:163`. Visitors never see these, but they fail when the number changes, which helps catch a missed copy.

**Why the first reviewer went wrong.** It counted only places 1 to 3 and missed the website's built-in fallback (4) and the server default (5).

**Is the second checker right?** Yes. It added place 4 and the `.env` fallback. It did not see that `env.js:82` itself has the **old** number typed in as the default. That also means the report's "checked and fine" note "No old numbers left" is not quite true. The old number is still in `env.js:82` (and in the comment at `settings.service.js:78` and `.env.example:56`), though no visitor sees it today.

**Group.** Small. It's an upkeep risk, not something visitors see today. The fix should cover `config.js` and `env.js:82`, not only `index.html`.

---

## S1 and S2. Line numbers

**What really happens.** `Nadam-backend/src/services/order.service.js` (last changed 17 Oct, so no later edit moved the lines):
- `:140` `if (!viewerCanCancel) return 'OWNERS_ONLY';`
- `:141` `if (order.status !== 'processing') return 'SHIPPED';`
- `:142` `if (!istSameMonth(order.placedAt)) return 'NOT_THIS_MONTH';`
- `:277` the message "Only this month's orders can be cancelled …" (the report's `:277` is right)

**Why the first reviewer went wrong.** It was off by one line in both places. The same slips are repeated in its "For the developer" table (rows S1 and S2).

**Is the second checker right?** Yes: S1's rule is at `:142` and S2's rule is at `:141`. Both findings stand as written. The admin order routes have no refund or return action (`Nadam-backend/src/routes/order.routes.js:17-24`), and the promises are at `src/pages/info/RefundsPage.jsx:9-10`.

**Group.** Both stay Should fix.

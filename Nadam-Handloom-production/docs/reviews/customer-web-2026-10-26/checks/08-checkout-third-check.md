# Third check: Module 8, Checkout (disputed items only)

Date: 26 Oct 2026. Report: [`../08-checkout.md`](../08-checkout.md). Second check: [`08-checkout-check.md`](08-checkout-check.md).

I only read code. I did not run, test, build or change anything, did not open `.env`, and did not touch the live server, Razorpay or any database.
Short paths: `B/` = `Nadam-backend/src/`, `W/` = `Nadam-frontend/customer-web/src/`.

Time settings used below (`B/config/constants.js:122-130`): hold 15 minutes, at most 30 minutes from the first Pay, Razorpay takes a payment only if it is authorised within 15 minutes, expired holds are freed every 30 seconds, unconfirmed payments are checked every 60 seconds.

## Summary

| Id | One-line title | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| S1 | Paying again while a payment is "being confirmed" | No warning; double charge; a late payment can revive the old order "with another piece" | Double charge is real; the "another piece" part is wrong for tagged sarees | Second checker right | Should fix |
| S2 | "The 15 minutes are over" for every ending | Shown for Sell anyway, Change my bag or a newer Pay elsewhere, and when Razorpay can't be reached | True, except Razorpay can't be reached | Second checker right (one small gap) | Small |
| S4 | No real pincode check | No check that the pincode is real or that DTDC delivers | Server gap real, but the form does warn | Second checker right | Should fix |
| S5 | Endless holds | Pressing Pay every 14 minutes keeps sarees sold out all day | Endless holds real, but 14 minutes leaves 12 free minutes in every 42 | Second checker right (one small slip) | Should fix |
| s11 | Razorpay window open past the hold | Timer counted from before the server's work, and never under 60 s | Timer part right; the 60 s floor never applies | Second checker right | Small |
| n1 | Sell anyway + payment can deadlock (extra claim) | Not sure | Real; Postgres stops one; stock comes out right | **Real** | Small |
| s15 | Rounding the website price can go up (extra claim) | "Fine for the customer" | Can go up: up to 50 paise more | **Real** | Small |

Counts: Second checker right 5 (S1, S2, S4, S5, s11) · First reviewer right 0 · Both partly right 0 · Neither right 0 · extra claims Real 2 (n1, s15), Not real 0, Not sure 0.

---

## S1. Paying again while a payment is "being confirmed"

**What really happens**
- The bag lines are removed only when a payment completes (`B/services/shop/checkout.service.js:519`). The customer's own held sarees still count as theirs (`B/models/bag.model.js:26-33`). So Pay stays on.
- After paying, the page forgets the checkout and moves to the order page (`W/pages/checkout/usePayment.js:57-59`). If the customer opens `/checkout` again, the page knows nothing about the earlier order, so there is no warning. The "is being confirmed" note (`W/pages/checkout/CheckoutPage.jsx:55`, `:137-143`) only shows when the tab still remembers the order, and even then Pay stays on.
- On Pay, the server looks at open checkouts and never at their payment attempts (`checkout.service.js:289-297`):
  - **Same bag, same address, still held, under 29 minutes** → the same order is reused and a second Razorpay request is opened (`:293-301`, `:328`). If both payments go through, the second one to arrive is refunded automatically: "Paid twice" (`:472`). So yes, a double charge, then a refund.
  - **Otherwise** → the old order is cancelled and its pieces go back on sale, and a new order is made in the same step (`:295-296`, `:303-316`). The new order takes pieces oldest first (`:175`), so it normally takes **the same piece** back. When the late payment arrives, it can only take back **its own** piece (`:493-494`: `id: it.pieceId, status: 'in_stock'`). That piece is now held or sold, so the late payment is refunded (`:495`, `:526-528`).
  - Two sarees for two payments happen only with old untagged stock (any unit off the counter, `:496-498`), or when every piece of the old order is still free (for example, the new bag no longer has those sarees).
- How long "being confirmed" lasts: Razorpay is told to keep a payment only if it is authorised within 15 minutes (`B/services/payments/razorpay.provider.js:43`, `constants.js:125`); later ones it returns itself (`checkout.service.js:450-452`). The server checks every minute (`B/jobs/payments.job.js:17`). So it is usually minutes, not hours (hours only if Razorpay can't be reached).

**Why the first reviewer went wrong:** "if the shop has more than one piece of that saree … the old order comes back with another piece" is wrong. A late payment never takes a different piece. "Minutes or hours" is also on the long side.

**Is the second checker right?** Yes. Its reading of the code (`:493-494`, oldest-first at `:175`, refund at `:472`) is exactly what the code does.

**Final:** Pay is allowed, with no warning, while an earlier payment is still being confirmed. The customer can be charged twice. The extra payment is normally refunded on its own after some days; with old untagged stock, it becomes a second order. **Should fix.**

---

## S2. "The 15 minutes are over" for every ending

**What really happens**
- While Razorpay's window is closed, the page asks the server about the open order every 8 seconds (`W/pages/checkout/CheckoutPage.jsx:166-180`). Any ending that isn't paid-like becomes the "expired" notice (`:159`, text `:48-49`). The server only says `cancelled` or `hold_ended`, never why (`B/services/shop/checkout.service.js:84-92`; the reason is kept back on purpose, `:130`).
- Endings that get the wrong words: "Sell anyway" at the counter (`B/services/sale.service.js:129-132`), "Change my bag" in another tab (`checkout.service.js:378`), and a newer Pay with a different bag or address (`:295-296`).
- "Razorpay can't be reached" never ends the order the page is showing. The new order Razorpay failed on is never kept by the page (`usePayment.js:72-78`: the error is thrown before `rememberCheckout` at `:78`), and a reused order is not ended (`checkout.service.js:335`).
- One small gap the second checker missed: in the **same tab**, a customer can press **Change** on the address (`CheckoutPage.jsx:329`) and Pay again. That Pay ends the old order (`:295-296`). If Razorpay then fails, the page still holds the old order (`CheckoutPage.jsx:284-285` doesn't clear it), and about 8 seconds later "Payment didn't start" is replaced by "The 15 minutes are over". The real cause is the newer Pay, not Razorpay.

**Why the first reviewer went wrong:** Razorpay failing is not a cause of an ending on its own.

**Is the second checker right?** Yes on the facts. Only its line "does not lead to this notice" is a little too absolute (see the gap above).

**Final:** the page says "The 15 minutes are over" when the checkout really ended another way (Sell anyway, Change my bag elsewhere, or a newer Pay). It is wrong wording on rare paths, and the button offered is still right. **Small.**

---

## S4. No real pincode check

**What really happens**
- Server: a pincode that isn't in India Post's list is saved with the typed city and state (`B/services/shop/address.service.js:17-23`: `v.city || p?.city`). The website form always sends a city and state (`W/pages/account/AddressForm.jsx:47`, `:52-54`), so the server never refuses a pincode from the website.
- At Pay, the only check is the format (`B/services/shop/addressCheck.js:11`: `^[1-9]\d{5}$`).
- Website: the form looks up every pincode. For an unknown one it shows "We couldn't find this pincode. Check it, or type your city and state." (`W/components/PlaceFields.jsx:26`, `:32-38`). For a new address the city and state then stay empty, so the customer must type them. The warning doesn't block saving, and it is never shown again on the address card or at Pay.
- Old-website addresses were never looked up.
- `522599` is indeed not in `Nadam-backend/prisma/data/india-pincodes.csv`.
- There is no DTDC delivery-area check anywhere in the server or the website.

**Why the first reviewer went wrong:** "no check" ignores the form's warning.

**Is the second checker right?** Yes, and its group (Should) is reasonable because of the DTDC gap and the old addresses.

**Final:** an unknown pincode can be saved after a soft warning and paid for, and nothing checks DTDC's delivery areas, so the shop may learn only after payment that it can't ship. **Should fix.**

---

## S5. One account can keep sarees held for ever

**What really happens** (`B/services/shop/checkout.service.js:63`, `:293-301`, `:303-316`; sweep every 30 s, `B/jobs/payments.job.js:16`)
- Pay before minute 29 of a checkout renews the hold to "now + 15", never past minute 30. Pay at minute 29 or later (or after the hold ended) cancels the old checkout and makes a new one with a fresh 15 minutes, in the same step. Nothing limits unpaid checkouts per account. The only limit is 10 Pay presses a minute (`B/routes/shop/index.js:89`).
- At a 14-minute rhythm: Pay at 0 (held to 15), at 14 (to 29), at 28 (to 30, the cap). The next Pay is at 42. So the sarees are **free from about 30 to 42**: 12 minutes in every 42. The report's example is wrong.
- What really keeps the hold with no gap: Pays never more than 15 minutes apart, **and** one Pay between minute 29 and 30 of each checkout. Pressing every 1, 2, 3, 5, 6 or 10 minutes does this. A script pressing every minute is trivial.

**Why the first reviewer went wrong:** the example forgot the 30-minute cap.

**Is the second checker right?** Yes on the point that matters. One small slip: "every 10 minutes or less" is not exact. A 7-, 8- or 9-minute rhythm misses the 29–30 minute window and leaves a 2–6 minute gap each cycle.

**Final:** one account (or a script) can keep up to ₹5,00,000 of sarees held without end by pressing Pay at the right moments, because nothing limits unpaid checkouts per account. **Should fix.**

---

## s11. Razorpay's window can stay open past the hold

**What really happens**
- `now` is taken at the start of Pay (`B/services/shop/checkout.service.js:270`), before the database step and the Razorpay call. The window time is `until − now` (`:241`, `:255`), and Razorpay starts its own timer only when the window opens (`W/payments/razorpay.js:58`). So the window outlasts the hold by the server's work plus loading: usually a few seconds.
- The 60-second floor never adds time. A reused order (`:293`) or Pay again (`:356`) is allowed only before minute 29, and the hold runs to minute 30 at most (`:63`), so more than 60 seconds are always left. A new order always gets 900 seconds.
- A payment in those extra seconds is handled safely (`:473-503`).

**Why the first reviewer went wrong:** "never under 60 seconds" is true of the code but never matters.

**Is the second checker right?** Yes.

**Final:** Razorpay's window can stay open a few seconds past the hold, because its time is counted from when Pay reached the server; a late payment is still handled safely. **Small.**

---

## n1. "Sell anyway" and a payment at the same moment (extra claim): **Real**

**What really happens**
- The counter's `cancelCheckout` takes no order lock. For each held piece it updates the **piece** first, then the **reservation** (`B/services/sale.service.js:122`, `:124`), then the order (`:129`).
- The payment's `complete()` takes the order lock (`B/models/checkout.model.js:8`), then updates the **reservation** first, then the **piece** (`B/services/shop/checkout.service.js:479`, `:481`).
- These are the same two rows, locked in opposite order. If both run in the same instant, Postgres finds a deadlock and stops one of them with an error.
- Stock still comes out right:
  - If the sale is stopped, the counter gets an error (`sale.service.js:242` retries only number clashes). A new scan says "already sold (online)" (`:68`).
  - If the payment is stopped, the page retries `verify` (`W/pages/checkout/usePayment.js:47-55`), and the background check picks it up later (`B/models/checkout.model.js:73-77`). The order is then cancelled, the piece is `sold_offline`, and the payment is refunded (`checkout.service.js:493-495`, `:526-528`).
- Without a deadlock, the "only if still …" updates make the second one fail and its whole step roll back (`sale.service.js:196-197`, `checkout.service.js:479-482`). That includes the counter's plain reservation update at `:124`.

**Final:** a counter "Sell anyway" and an online payment for the same saree at the same instant can deadlock; Postgres stops one, a retry finds the right state, and no saree is sold twice. **Small.**

---

## s15. Rounding the website price can go up (extra claim): **Real**

**What really happens**
- The website price is `Math.round(Number(onlinePrice))` (`B/services/shop/catalog.service.js:65`). It is used for the bag line, the order line and the charge (`B/services/shop/bag.service.js:47`, `checkout.service.js:189`, `:213`).
- `onlinePrice` is `Decimal(10, 2)` (`Nadam-backend/prisma/schema.prisma:313`), and the admin app allows 2 decimals (`B/validators/catalog.validators.js:12-17`).
- So ₹1,499.50 is shown and charged as ₹1,500 (50 paise **more**), and ₹1,499.40 as ₹1,499 (40 paise less).
- The customer always pays exactly the price shown.
- The first reviewer's "fine for the customer" is not always true.

**Final:** a collection price with paise is shown and charged in whole rupees, up to 50 paise per piece more (or 49 paise less) than the admin price; the customer pays what the page shows. **Small.**

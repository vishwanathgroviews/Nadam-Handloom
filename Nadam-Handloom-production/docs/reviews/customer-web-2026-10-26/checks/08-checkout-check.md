# Second check: Module 8, Checkout

Date: 26 Oct 2026. Report checked: [`../08-checkout.md`](../08-checkout.md).
I only read code (server, website, schema). I did not run, test or change any code, and I did not open `.env`.
All `path:line` references start from the project folder (`Nadam-Handloom-production/`). `B/` = `Nadam-backend/src/`, `W/` = `Nadam-frontend/customer-web/src/`.

Live facts used: everything in this code is live since 26 Oct ~13:55 IST, online payment runs on Razorpay TEST keys open to every signed-in visitor (`PAYMENTS_TEST_FOR_EVERYONE=true`, no tester list), Razorpay's notices go to the old server and this server checks unconfirmed payments every minute.

## Summary

| Finding | One-line title | Original group | Verdict | Right group |
|---|---|---|---|---|
| M1 | Pay again reuses the order with the old address copy after the address was edited | Must | ✅ Correct | Must |
| M2 | Test payments open to everyone take real sarees off sale | Must | ✅ Correct | Must |
| S1 | Pay while a payment is "being confirmed": no warning, possible double charge | Should | ⚠️ Partly correct | Should |
| S2 | "The 15 minutes are over" shown for every way a checkout ends | Should | ⚠️ Partly correct | Should (borderline Small) |
| S3 | Failed bag join at sign-in: Pay greyed out with no reason, or "Your bag is empty" | Should | ✅ Correct | Should |
| S4 | No check that the pincode is real or that DTDC delivers there | Should | ⚠️ Partly correct | Should |
| S5 | One account can keep sarees held for ever | Should | ⚠️ Partly correct | Should |
| S6 | Out-of-state orders get CGST + SGST, not IGST | Should | ✅ Correct | Should |
| s1 | "Nothing was charged." twice | Small | ✅ Correct | Small |
| s2 | HOLD_ENDED at Pay: general box, old "held until" line stays | Small | ✅ Correct | Small |
| s3 | Per-customer Pay limit says "from this network" | Small | ✅ Correct | Small |
| s4 | Left-out sarees not named | Small | ✅ Correct | Small |
| s5 | No price of one piece when quantity is 2+ | Small | ✅ Correct | Small |
| s6 | "Copy the link" failure is silent | Small | ✅ Correct | Small |
| s7 | GST rate 0% would still show "5%" | Small | ✅ Correct | Small |
| s8 | Typed state beats the pincode's state | Small | ✅ Correct | Small |
| s9 | Fixing an old address with a bad state: no autofill | Small | ✅ Correct | Small |
| s10 | Old "+91…" mobile shows as "+91 +91…" on the card | Small | ✅ Correct | Small |
| s11 | Razorpay's window can outlast the hold by a few seconds | Small | ⚠️ Partly correct | Small |
| s12 | BAG_EMPTY / BAG_CHANGED leave the earlier checkout held | Small | ✅ Correct | Small |
| s13 | Pay again renews the hold before Razorpay answers | Small | ✅ Correct | Small |
| s14 | Settings fail to load: "Online payment isn't open yet" | Small | ✅ Correct | Small |
| s15 | Collection price with paise is rounded to whole rupees | Small | ✅ Correct | Small |
| s16 | Fallback bag read without the bag lock | Small | ✅ Correct | Small |
| s17 | "Checkout cancelled" logged even when nothing changed | Small | ✅ Correct | Small |
| n1 | "Sell anyway" doesn't take the order lock: possible deadlock with a payment | Dev note | ✅ Correct | Small |
| n2 | Website order number: check-then-insert, no retry on a clash | Dev note | ✅ Correct | Small |

**Counts: ✅ 22 · ⚠️ 5 · ❌ 0.**

---

## Must fix

### M1. Pay again keeps the old delivery address — ✅ Correct (Must)
- **Why:** Pay reuses an open checkout when the bag signature, the hold and the **address id** match. It never compares the address details. The address copy (`shippingAddress`) is written only when a new order is made. Editing an address in My account changes the same row in place (same id), so the reuse test still passes.
- **Evidence:**
  - `B/services/shop/checkout.service.js:293-294`: `sameAndHeld … && open.addressId === address.id` → `reuse = open`.
  - `B/services/shop/checkout.service.js:298-301`: on reuse only the hold is moved on; the order is returned as it is.
  - `B/services/shop/checkout.service.js:51-54` and `:307`: `shippingAddress: snapshot(address)` only inside `tx.order.create`.
  - `B/services/shop/address.service.js:48-60`: `update` → `Address.update(id, …)` (same id, `B/models/address.model.js:13`).
  - `W/pages/checkout/CheckoutPage.jsx:115-124`, `:186`, `:328`: the page shows the **saved** address list (the edited one); Pay sends `chosen.id` (`:253`).
  - The admin app reads the order's copy: `B/services/order.service.js:41-51` (`addressLines` from `order.shippingAddress`); the invoice too (`B/services/invoice.service.js:29-30`, `:44`).
- **Group:** a paid parcel goes to the wrong place: Must is right. (The order page after paying shows the order's copy, so a careful customer might notice, but only after paying.)

### M2. Test payments open to everyone take real sarees off sale — ✅ Correct (Must)
- **Why:** with no tester list, everyone signed in may pay; the server runs the full "paid" path for a test payment: holds become "converted", pieces `sold_online`, the order goes to `processing` with a shipment row (To ship), the bag lines are removed and the owners get "New online order · ₹X" with no "test" word. Only the invoice gets a `TEST-` number.
- **Evidence:**
  - `B/services/shop/paymentAccess.js:6-11`: `!testersOnly() || …` → true for everyone when `PAYMENTS_TESTERS` is empty.
  - `B/config/env.js:105` (`PAYMENTS_TEST_FOR_EVERYONE`), `:158-160` (the start-up check that is switched off by that flag; its own message says "otherwise any customer could 'pay' with test money").
  - `W/payments/TestPayNote.jsx:16`: prints `4111 1111 1111 1111` and `success@razorpay`.
  - `B/services/shop/checkout.service.js:473-488` (pieces → `sold_online`), `:504-515` (order `processing`, shipment created), `:531-533` + `:573` (owner alert).
  - `B/services/ownerAlerts.service.js:19-24`: title `New online order · ${money(order.total)}`, nothing about test.
  - `B/services/sale.service.js:68`: the counter then says "already sold (online …)".
  - `B/services/invoice.service.js:37-39`: only the invoice is marked test.
- **Group:** real stock blocked with no money, and possibly packed: Must is right.

---

## Should fix

### S1. Pay while a payment is "being confirmed" — ⚠️ Partly correct (Should)
- **What is right:** `checkout()` reuses or cancels an open checkout without looking at its payment attempts (`B/services/shop/checkout.service.js:289-297`). The bag lines stay until a payment completes (`:519`), and the customer's own held sarees count as available to them (`B/models/bag.model.js:26-33`), so Pay is enabled. Reused: a second Razorpay request on the same order (`:231-236`), so the customer can pay twice; the later capture is refunded automatically ("Paid twice", `:472`), i.e. money back only after days. In the normal flow the checkout page shows no warning: after paying, `confirm()` forgets the checkout (`W/pages/checkout/usePayment.js:57`) and goes to the order page, so a later visit to `/checkout` knows nothing about it.
- **What is wrong / overstated:**
  - "If the shop has more than one piece of that saree … the old order comes back to life with another piece" is wrong for tagged sarees. A late payment on an ended order only re-claims **the exact same piece** (`B/services/shop/checkout.service.js:493-494`: `piece.updateMany({ where: { id: it.pieceId, status: 'in_stock' } })`). The new order holds pieces oldest first (`:175`), so it normally takes back that same released piece; the late payment then finds it reserved or sold and is refunded (`:495`, `:526-528`). Two sarees for two payments happen only for **old untagged stock** (`:496-498`, any unit off the counter) or when the new bag left that saree out (its piece is back in stock).
  - "Nothing tells the customer" is not quite absolute: if the tab still remembers the checkout (for example the page reloaded while the customer paid in a UPI app), the page says "Your payment for order NH… is being confirmed … You don't need to pay for it again." (`W/pages/checkout/CheckoutPage.jsx:137-143`, `:55`). But Pay is still allowed, and the usual path has no warning.
- **Group:** Should is right (a temporary double charge, refunded automatically in most cases).

### S2. "The 15 minutes are over" for every ending — ⚠️ Partly correct (Should, borderline Small)
- **What is right:** `settleOpen` turns every non-paid status into the "expired" notice (`W/pages/checkout/CheckoutPage.jsx:159`, text at `:48-49`); the server only says `cancelled` or `hold_ended`, never why (`B/services/shop/checkout.service.js:84-92`). "Sell anyway" at the counter (`B/services/sale.service.js:129-132`), "Change my bag" in another tab (`checkout.service.js:378`) and a newer Pay with a different bag or address in another tab (`:295-296`) all end in this wording.
- **What is wrong:** "because Razorpay couldn't be reached" does not lead to this notice. When Razorpay can't be reached, the page never kept that order (`setOrder`/`rememberCheckout` run only after success: `W/pages/checkout/CheckoutPage.jsx:253-254`, `W/pages/checkout/usePayment.js:73-78`), and a **reused** order is not ended at all (`checkout.service.js:335`: `if (!result.reused) await abandon(…)`).
- **Group:** wrong wording only, on rare paths (owner override, two tabs); the button offered ("Check my bag again") is still right. Should is acceptable, Small would also be fair.

### S3. Failed bag join at sign-in leaves Pay greyed out — ✅ Correct (Should)
- **Why:** a failed `joinAccount` sets `status: 'error'` and leaves `owner: 'guest'` (`W/bag/store.js:345`). **Try again** calls `refresh()`, which for a guest bag does a visitor check (`shopApi.bagCheck`) or, with no visitor items, just marks the bag ready and empty (`W/bag/store.js:204-210`); it never calls `joinAccount`. The checkout needs `bag.owner === 'account'` (`W/pages/checkout/CheckoutPage.jsx:187`, used in `canPay` `:319`), so Pay stays disabled with no message, or the page shows "Your bag is empty" (`:233-238`). Only a reload (`startBag` → `joinAccount`, `W/bag/store.js:387-391`) or going offline and online again (`:406-410`) fixes it.
- **Group:** a ready-to-pay customer is stuck without a reason: Should is right.

### S4. No check that the pincode is real — ⚠️ Partly correct (Should)
- **What is right:** the server accepts any pincode once a city and state are given (`B/services/shop/address.service.js:17-23`: `city = v.city || p?.city`), and Pay only tests `^[1-9]\d{5}$` (`B/services/shop/addressCheck.js:11`). There is no DTDC area check anywhere. `522599` is indeed not in `Nadam-backend/prisma/data/india-pincodes.csv`.
- **What is overstated:** "no check" is too strong. The form looks up every pincode and warns under it: "We couldn't find this pincode. Check it, or type your city and state." (`W/components/PlaceFields.jsx:26-38`). For a new address the city and state then stay empty, so the customer has to notice. The real gap is that the warning does not block saving and is never shown again on the address card or at Pay (old-website addresses were never looked up at all).
- **Group:** Should is fine (paid orders that can't be booked cost calls and refunds).

### S5. One account can keep sarees held for ever — ⚠️ Partly correct (Should)
- **What is right:** nothing limits how many checkouts an account starts. Pay again before 29 minutes renews the hold (capped at 30 minutes from the first Pay: `B/services/shop/checkout.service.js:63`, `:293`, `:299-300`); a Pay after that cancels the old order and makes a new one with a fresh 15 minutes in the same step (`:295-296`, `:303-316`). The only limit is 10 Pay presses a minute (`B/routes/shop/index.js:89`).
- **What is wrong:** the example "presses Pay every 14 minutes … sold out all day" does not hold. With a 14-minute rhythm: Pay at 0, 14 and 28 minutes keeps the hold only until minute 30 (the cap); the next Pay comes at minute 42, so the sarees are free for about 12 minutes in every 42. To keep them held without a gap, Pay must be pressed every 10 minutes or less (for example at 0, 10, 20, then 30 → new order). The problem is real; the example interval is not.
- **Group:** Should is right, more so with test payments open to everyone.

### S6. IGST is off for out-of-state orders — ✅ Correct (Should)
- **Why:** `GST_IGST_OTHER_STATES` defaults to `'false'` (`B/config/env.js:87`); `taxPlace` gives IGST only when it is on (`B/services/invoice.service.js:29-33`); the page uses the same switch (`W/pages/checkout/format.js:15`, served from `B/services/shop/config.service.js:17`). It is a known, deliberate wait for the accountant. Today's invoices are TEST invoices (`invoice.service.js:37-39`), so it only bites once live keys are used.
- **Group:** Should is right.

---

## Small

### s1. "Nothing was charged." twice — ✅ Correct
The server message already ends with it (`B/services/shop/checkout.service.js:336`) and the page adds it again (`W/pages/checkout/CheckoutPage.jsx:63`: `{notice.message} Nothing was charged.`).

### s2. HOLD_ENDED at Pay — ✅ Correct
`HOLD_ENDED` from `/checkout` comes from `closedMeanwhile` (`checkout.service.js:42-46`, `:333`). `onPay` has no case for it, so it falls to the general error (`CheckoutPage.jsx:284-285`) and does not clear `order`; the hold line (`:412`) stays until the 8-second check (`:168-180`) replaces it. Only when the page already had that order (a reused checkout); rare.

### s3. "Too many requests from this network" for a per-customer limit — ✅ Correct
`B/middlewares/rateLimit.js:26` uses the same text even when `by` counts per account (`:14-15`); the Pay limit is per account (`B/routes/shop/index.js:89`). The page shows it as is (`CheckoutPage.jsx:285`).

### s4. Left-out sarees not named — ✅ Correct
Only the count shows (`CheckoutPage.jsx:401`); `SareeLines` gets only the buyable lines (`:400`).

### s5. No price of one piece — ✅ Correct
`W/pages/checkout/parts.jsx:40` shows the number of pieces and `:45` only the line total.

### s6. Copy-link failure silent — ✅ Correct
`CheckoutPage.jsx:84`: `catch { setCopied(false); }`, the button text stays "Copy the link".

### s7. GST 0% shows 5% — ✅ Correct
`W/pages/checkout/format.js:13`: `Number(gst?.ratePercent) || 5`; the server allows 0 (`B/config/env.js:84`, `min(0)`).

### s8. Typed state beats the pincode's — ✅ Correct
`B/services/shop/address.service.js:19-20`: `v.city || p?.city`, `v.state || p?.state`. Matters once IGST is on (`invoice.service.js:30-31` uses the order's state).

### s9. Fix mode keeps a bad saved state — ✅ Correct
`W/components/PlaceFields.jsx:22-30`: the saved pincode is not "typed", and autofill runs only when `!v.city || !v.state`; a non-empty wrong state blocks it. The form starts with the saved state (`W/pages/account/AddressForm.jsx:28`); the customer must pick one (the problem message is shown under the field, `:31`).

### s10. "+91 +91…" on the card — ✅ Correct
`B/services/shop/present.js:56` sends the raw `a.phone`; `addressProblem` accepts "+91…" because it normalizes (`B/services/shop/addressCheck.js:9`); `W/utils/format.js:2` returns a 13-character value unchanged; `parts.jsx:18` prefixes "+91 ". The order copy is clean (`checkout.service.js:52`, `normalizeMobile`).

### s11. Razorpay's window can outlast the hold — ⚠️ Partly correct (Small)
- **Right:** `timeoutSeconds` is counted from `now`, taken at the start of `checkout()` (`checkout.service.js:270`, `:255`), before the database step and the Razorpay call, and Razorpay starts its own timer only when the window opens on the phone. So the window can stay open a few seconds past the hold. A late payment is still handled (`:489-503`).
- **Wrong:** the 60-second floor never adds time. Pay again is refused or not reused from 29 minutes after the first Pay (`:293`, `:356`), and the hold is capped at 30 (`:63`), so the time left is always more than 60 seconds; `Math.max(60, …)` never applies.

### s12. BAG_EMPTY / BAG_CHANGED leave the earlier checkout held — ✅ Correct
`checkout.service.js:277-284` return before the loop over open checkouts (`:289`), so an earlier hold runs to its end.

### s13. Pay again renews before Razorpay answers — ✅ Correct
`checkout.service.js:357` moves `expiresAt` inside the first step; Razorpay is asked after (`:360`); a failure (`:363`) leaves the longer hold. (A reused Pay does the same at `:299-300`.)

### s14. Settings failure shows "isn't open yet" — ✅ Correct
On failure the config keeps `FALLBACK`, which has no `payments` (`W/config/config.js:7-22`, `:39-41`); `paymentsOpen` then answers false (`W/payments/usePaymentsOn.js:8`), so `CheckoutPage.jsx:113` → `:218-229`. The page only waits while `cfg === 'loading'` (`:199`).

### s15. Paise in the collection price — ✅ Correct
`B/services/shop/catalog.service.js:65`: `Math.round(Number(p.subcategory?.onlinePrice))`; the field is `Decimal(10, 2)` (`Nadam-backend/prisma/schema.prisma:313`). Note: rounding can go **up** (₹1,499.50 → ₹1,500), so the customer can pay up to 50 paise more, not only less.

### s16. Fallback bag read without the bag lock — ✅ Correct
`checkout.service.js:325`: `prisma.$transaction(async (tx) => bagNow(accountId, tx))` with no `Bag.lockFor`; `bagNow` can write (`:155`). Harmless in practice.

### s17. Cancel audit when nothing changed — ✅ Correct
`checkout.service.js:376` returns early for a non-pending order, but `shopAudit('shop_checkout_cancelled', …)` at `:381` always runs.

---

## Developer notes

### n1. "Sell anyway" without the order lock — ✅ Correct (I am fairly sure)
- The counter's `cancelCheckout` (`B/services/sale.service.js:119-133`) does not take `lockOrder`. It locks rows in this order: **piece** (`:122`), then **reservation** (`:124`), then the order (`:129`). A payment's `complete()` takes the advisory order lock (`B/models/checkout.model.js:8`) and then locks **reservation** (`checkout.service.js:479`) before **piece** (`:481`). Opposite order on the same two rows → a deadlock is possible; Postgres aborts one of the two.
- Stock stays right either way: an aborted `complete()` is retried (page retries `W/pages/checkout/usePayment.js:47-55`; background check every minute) and then finds the order cancelled → the piece is `sold_offline` → refund (`checkout.service.js:493-495`). An aborted sale just fails at the counter and a retry says "already sold online". Without a deadlock, the conditional updates (`sale.service.js:196-197`, `checkout.service.js:479-482`) make the second one fail and roll back. The window is tiny: Small.

### n2. Order number check-then-insert — ✅ Correct
`B/models/sale.model.js:32-38` checks `findUnique` then returns; `orderNumber` is `@unique` (`schema.prisma:526`). The counter sale retries a clash (`B/services/sale.service.js:234-243`), the website checkout does not (`checkout.service.js:303-304`), so two inserts drawing the same number at the same moment would give a server error. Extremely rare.

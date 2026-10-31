# Module 8: Checkout, review

| | |
|---|---|
| **Date** | 26 Oct 2026 |
| **How** | I only read the code. Nothing was run, changed, built or tested. No live server or database was touched. No `.env` file was opened. |
| **Server code** | `Nadam-backend/`: `src/routes/shop/index.js`, `controllers/shop/checkout.controller.js`, `controllers/shop/public.controller.js`, `controllers/shop/me.controller.js`, `services/shop/checkout.service.js`, `bag.service.js`, `address.service.js`, `addressCheck.js`, `place.service.js`, `paymentAccess.js`, `present.js`, `visibility.js`, `catalog.service.js`, `config.service.js`, `services/invoice.service.js`, `utils/gst.js`, `services/sale.service.js` (only "Sell anyway"), `services/ownerAlerts.service.js`, `models/checkout.model.js`, `bag.model.js`, `address.model.js`, `pincode.model.js`, `sale.model.js`, `validators/shop/checkout.validators.js`, `me.validators.js`, `common.js`, `bag.validators.js`, `middlewares/rateLimit.js`, `validate.js`, `authenticateCustomer.js`, `config/env.js`, `config/constants.js`, `jobs/payments.job.js`, `prisma/schema.prisma`, `prisma/data/india-pincodes.csv` |
| **Website code** | `Nadam-frontend/customer-web/`: `pages/checkout/` (all), `pages/account/AddressForm.jsx`, `components/PlaceFields.jsx`, `components/BagPanel.jsx`, `pages/bag/BagPage.jsx`, `bag/store.js`, `bag/useBag.js`, `payments/` (all), `api/` (all), `utils/places.js`, `validate.js`, `money.js`, `format.js`, `config/config.js` |
| **Design notes used** | `docs/modules/web-04-checkout.md` (sections 5 to 17) |

**Short answer:** the checkout is careful in most places. A customer can't use another customer's address or order. A changed page (fake total, fake prices) can't make the shop charge less: the server works out every price itself and stops Pay if anything differs. One saree can't be held for two customers at once. Rupees and paise match from the page to Razorpay to the invoice. The GST note on the page follows the same rule as the invoice.

I found **2 "Must fix" problems**:
1. A checkout that is reused keeps the **old delivery address** if the customer edited that address in the meantime.
2. With test payments open to everyone, **anyone can take real sarees off sale** by "paying" with Razorpay's test card.

I found **6 "Should fix" problems** and a list of small polish items.

---

## 1. What this module does

When a customer presses **Checkout** in the bag, this module takes them through sign-in, choosing a delivery address and checking the order. When they press **Pay**, it makes the order on the server ("waiting for payment"). It keeps (holds) each saree for them for 15 minutes so nobody else can buy it. Then it asks Razorpay (the payment company) for a payment request for the exact total. What happens inside Razorpay's window is covered by the payments review.

---

## 2. The steps a customer goes through

1. **In the bag** (side panel or bag page) the customer presses **Checkout**. It shows only when online payment is on and at least one piece can be bought.
2. **Not signed in?** The page says "Sign in to check out. Your bag stays as it is." **Sign in** opens the sign-in page. After the SMS code, the customer comes straight back to `/checkout`. The visitor's bag joins the account's bag.
3. **Step 1, Delivery address.**
   - No saved address: the "New address" form opens by itself, with their name and mobile already filled in.
   - Saved addresses: shown as cards. The one used last in this tab is chosen, otherwise the default one, otherwise the first.
   - An old address (from the old website) with a missing or wrong part is marked "Needs checking before use". Pressing **Deliver here** on it opens the form with the problem explained.
   - **Add a new address** opens the form (greyed out at 10 saved addresses).
   - In the form, typing the 6-digit pincode fills in the city and state from India Post's list. The customer can still change them. If the pincode isn't in the list, they type the city and state.
   - **Deliver here** (or **Save and deliver here** in the form) closes step 1 and moves to step 2.
4. **Step 2, Review and pay.** Each saree is shown with its photo, name, code, number of pieces and price. Notes show "price changed from ₹X" or "only 2 left: changed from 3". A line says how many sarees in the bag can't be bought now and are left out.
5. **The summary** (right side on a computer, a bar at the bottom on a phone) shows the subtotal, "Delivery: Free", the total, the GST note (for example "Includes GST 5% (₹238): CGST 2.5% + SGST 2.5%") and the **Pay ₹X** button.
6. **Pay.** The server checks everything again, makes the order, holds the sarees for 15 minutes and opens Razorpay's window. The page says "Your sarees are held for you until 4:35 pm".
7. **If anything changed** since the page was opened (a saree sold, fewer pieces left, a new price, taken off the website), Pay stops. The page shows the bag as it is now and the note "Something changed before you paid … Nothing was charged." The customer looks and presses Pay again.
8. **Window closed without paying:** "Payment not completed. Your sarees are held for you until 4:35 pm." with **Pay now** and **Change my bag**. Pressing Pay again within the time uses the same order and gives a fresh 15 minutes (never more than 30 minutes from the first Pay).
9. **Change my bag** ends the checkout, puts the sarees back on sale and opens the bag.
10. **Time runs out:** "The 15 minutes are over. Your sarees were released…" with **Check my bag again**.
11. **Paid:** the payments module takes over (checking the payment, the "Thank you" page).

---

## 3. Each API

(An API is a "door" the website uses to ask the server for something.)

**Rules that apply to all of them:**
- If the shop has switched the website off, every call answers `MAINTENANCE` and the website shows the maintenance page.
- A server fault answers "Something went wrong on our side. Please try again."
- The calls that need sign-in refuse without it (401). The website then shows "Sign in to check out".
- Every address and order is looked up **together with the signed-in customer**. Someone else's address or order gets the same answer as one that doesn't exist.

### 3.1 `POST /api/v2/shop/checkout` (Pay)

| | |
|---|---|
| **What it is for** | Makes the order from the customer's saved bag, holds the sarees for 15 minutes, and asks Razorpay for a payment request. |
| **What goes in** | `addressId`: the chosen saved address (must be a valid id, otherwise "Choose a delivery address."). `expect`: what the page showed. `expect.amount` is the total in whole rupees. `expect.lines` is 1 to 20 lines, each with `slug` (the saree's link name: letters, digits, dashes), `quantity` (1 to 50) and `price` (whole rupees, 0 to 1 crore). Bad shape: "Check your order again." |
| **What the server checks, in this order** | 1. The website is on. 2. Signed in. 3. Not more than 10 Pay presses a minute for this customer (shared with "Pay again"). 4. The request has the right shape. 5. Online payment is switched on. 6. This customer may pay (everyone, unless only a tester list may). 7. The address is the customer's own. 8. The address is complete: name of 2+ letters, a 10-digit mobile starting 6 to 9, house line of 3+ letters, a 6-digit pincode not starting with 0, a city, and a state from the list of 36. 9. Then, in one all-or-nothing step, with this customer's checkout and bag locked (no second Pay or bag change can run at the same moment): the bag is read as it is now. A saree with fewer pieces left lowers the saved number. 10. At least one saree can be bought. 11. Not more than 20 sarees. 12. The total and every line (link name, pieces, price) are **exactly** what the page sent. 13. The total is not above the online limit (₹5,00,000 unless changed in the settings). 14. Earlier unpaid checkouts of this customer: the same bag, same address, still held and less than 29 minutes old is **reused**. Any other is cancelled and its sarees go back on sale. 15. A new order is made and each piece is held. If a piece was sold a moment ago, nothing is kept. 16. Razorpay is asked for the payment request. |
| **GST** | Nothing is worked out here. Every website price already includes GST. The order keeps only the total. The invoice splits the GST after payment (see 4.3). |
| **What comes back** | `order`: number (`NH` + 8 digits), status `awaiting_payment`, when placed, total (whole rupees), pieces, the lines (link name, code, name, photo, price, pieces, line total), the address copied onto the order, `holdUntil` (when the hold ends), `canPay` true, and empty payment, refund, invoice and shipping parts. `razorpay`: the public key id, test or live, Razorpay's request id, the amount **in paise** (rupees × 100), INR, the shop's name, "Order NH…", the customer's name, email and `+91` mobile, and how long the window may stay open (the time left on the hold, at least 60 seconds). No secret key is ever sent. |
| **What is saved** | A new **Order** ("waiting for payment", address copied in). One **OrderItem** per tagged piece (and one for any old untagged stock). One **Reservation** (hold) per piece. A **StockLedger** line "reserve" per piece. The **Piece** becomes "reserved" (or the old stock counter on **Product** goes down). Earlier unpaid checkouts: cancelled, their holds released, pieces back "in stock", ledger "release". The **BagItem** number is lowered when fewer are left, and its "price seen" is updated when Pay is stopped. A **PaymentAttempt** (one per Pay press) and the order's **Payment** row ("created"). One rate-limit row. One activity-log line "checkout started" (not when reused). |
| **What can go wrong** (code · what the customer sees) | `PAYMENTS_OFF` (503): "Payment didn't start. Online payment isn't open yet. Please order on WhatsApp, or try again soon. Nothing was charged." · `ADDRESS_NOT_FOUND` (404): the list reloads and "Payment didn't start. This address was removed. Choose another one. Nothing was charged." · `ADDRESS_INVALID` (400): the address form opens with "Please check this address: …" and the field marked · `BAG_EMPTY` (409): "Your bag has nothing that can be bought now" · `BAG_CHANGED` (409): the bag as it is now, and "Something changed before you paid … Nothing was charged." (or "Your payment for order NH… went through" if the earlier checkout was paid meanwhile) · `ORDER_TOO_LARGE` (409): "This order is too large to pay online in one go. Orders above ₹5,00,000 can't be paid online in one go. Please order on WhatsApp…" with an **Order on WhatsApp** button · `ORDER_PAID` (409): "Your payment for order NH… went through" · `HOLD_ENDED` (409, rare: the order ended while Razorpay was being asked): "Payment didn't start. The 15 minutes are over…" · `PAYMENTS_UNAVAILABLE` (503, Razorpay can't be reached; a new order is cancelled and its sarees released): "Payment didn't start. We couldn't open the payment just now. Nothing was charged. Please try again in a minute. Nothing was charged." · `RATE_LIMITED` (429): "Too many requests from this network…" · `VALIDATION_FAILED` (400): the website never sends a bad shape · offline: "You're offline. Nothing was charged." · slow (20 seconds): "This is taking too long. Please try again." |

### 3.2 `GET /api/v2/shop/pincodes/:pincode` (pincode → city and state)

| | |
|---|---|
| **What it is for** | Fills in the city and state when the customer types a pincode. Anyone may use it. |
| **What goes in** | A 6-digit pincode not starting with 0. Otherwise: "Enter a valid 6-digit pincode." (the website only asks for 6 digits). |
| **What comes back** | `pincode`, `area` (main post office, e.g. "Mangalagiri"), `city` (the district, e.g. "Guntur"), `state`. Browsers may keep the answer for a day. |
| **What is saved** | Nothing, except one rate-limit row (60 a minute per network). |
| **What can go wrong** | `PINCODE_NOT_FOUND` (404): under the pincode, "We couldn't find this pincode. Check it, or type your city and state." Any other failure: "Couldn't check the pincode right now. Type your city and state." The form still works. |

The list has 19,297 pincodes. I checked that all 36 state names in it are spelled exactly like the website's list of states, so a filled-in state is always accepted.

### 3.3 `GET /api/v2/shop/me/addresses` (the saved addresses)

| | |
|---|---|
| **What it is for** | The address cards in step 1. |
| **What goes in** | Nothing (signed in). |
| **What comes back** | `addresses` (default first, then the most recently changed) and `max` (10). Each has: id, label (home, office, other), full name, mobile, house line, area line, landmark, city, state, pincode, country, default or not, last changed, and `problem`: what must be corrected before an order can go there (or empty). |
| **What is saved** | Nothing. |
| **What can go wrong** | Any failure: "Your addresses didn't load" with **Try again**. |

### 3.4 `POST /api/v2/shop/me/addresses` (add an address)

| | |
|---|---|
| **What it is for** | The "New address" form (first address, or "Add a new address"). |
| **What goes in** | `fullName` (2 to 60, letters, spaces, dots, hyphens), `mobile` (10 digits from 6 to 9; "+91" or a leading 0 is removed), `line1` (house, flat, building: 3 to 120), `line2` (area, street, up to 120, may be empty), `landmark` (up to 80, may be empty), `pincode` (6 digits), `city` (2 to 60), `state` (one of the 36), `label` (home, office, other; home if left out), `isDefault` (yes or no). |
| **What the server checks** | The fields above. Then the pincode: if the city or state is missing, it is taken from India Post's list. If the pincode isn't in the list and the city or state is missing: refused. Not more than 10 addresses. |
| **What comes back** | The new `address`, and the whole list again (`addresses`, `max`). |
| **What is saved** | A new **Address**. The first one, or one marked default, becomes the default (the old default is unmarked). Activity log "address added". |
| **What can go wrong** | Each field's own message under the field (for example "Enter a 10-digit mobile number starting with 6, 7, 8 or 9."). `PINCODE_NOT_FOUND` (400): "We couldn't find this pincode. Check it, or type the city and state." under the pincode. `ADDRESS_LIMIT` (409): "You can save up to 10 addresses. Delete one to add another." |

### 3.5 `PATCH /api/v2/shop/me/addresses/:id` (correct an old address)

| | |
|---|---|
| **What it is for** | At checkout: fixing an old address marked "Needs checking". (Editing a good address is done in My account.) |
| **What goes in** | Any of the fields in 3.4. The checkout form always sends all of them. |
| **What the server checks** | The address is the customer's. The fields. If the pincode, city or state changes, the same pincode rule as 3.4. |
| **What comes back** | The changed `address` and the whole list. |
| **What is saved** | The **Address** row. Activity log "address updated". An order already made keeps its own copy and does not change. |
| **What can go wrong** | `ADDRESS_NOT_FOUND` (404): "This address was removed. Refresh the page." Field messages as in 3.4. |

### 3.6 How the bag feeds checkout (`GET /api/v2/shop/me/bag`)

The checkout page asks for the bag again when it opens. Each saree comes back with today's website price (whole rupees), how many are available, and a state: ok, fewer, sold out, or not on the website. Sarees that **this customer's own** unpaid checkout is holding still count as available to them (so their own hold never shows as "sold out" to them). Pay sends exactly the lines that can be bought, and the server compares them with its own reading of the same bag (3.1, check 12).

### 3.7 The order calls the checkout page also uses

| Call | Used for | Notes |
|---|---|---|
| `GET /orders/:number` | When the page opens, and every 8 seconds while a checkout is open and Razorpay's window is closed: is it still held, or was it paid, refunded or ended? | Only the customer's own order. Another number: "We couldn't find this order." |
| `POST /orders/:number/cancel` | **Change my bag** | Ends the checkout, releases its sarees (pieces back "in stock", ledger "release"), order "cancelled" with "The customer went back to change the bag". If it was already paid or ended, nothing changes. Errors are ignored by the page: it always opens the bag. |
| `POST /orders/:number/pay` | "Pay" on the order page (not on the checkout page, which always calls 3.1) | A new payment request and a fresh 15 minutes, never past 30 minutes from the first Pay. `HOLD_ENDED` if the sarees were released, `ORDER_PAID` if already paid. |

---

## 4. The data kept

### 4.1 Tables and fields (only what this module uses)

**Order** (one row per order: website, counter and WhatsApp)

| Field | What it means | Must have it? |
|---|---|---|
| id | The order's inside number | Yes (made by itself) |
| orderNumber | "NH" + 8 random digits, shown to the customer. Never repeated | Yes, unique |
| authAccountId | Which customer | Website: always. Counter sales: empty |
| addressId | Which saved address it was made for. Becomes empty if that address is deleted later | No |
| channel | "online" for the website | Yes (default "online") |
| status | "pending_payment" (waiting for payment) at Pay; "processing" when paid; later "shipped", "delivered"; or "cancelled" | Yes (default "pending_payment") |
| subtotal | The sarees added up (rupees) | Yes |
| total | Same as subtotal: delivery is free | Yes |
| shippingAddress | A copy of the address at Pay: name, mobile, house, area, landmark, city, state, pincode, India | Yes |
| invoiceRequired | Always yes for website orders | Yes (default yes) |
| clientRef | Only for counter sales | No |
| paymentMethod | UPI, card…, filled when paid | No |
| cancelledAt / cancelledById / cancelReason | When, who and why it ended, e.g. "Replaced by a newer checkout", "The customer went back to change the bag", "Sold at the counter (order NH…)" | No |
| placedAt | When Pay was pressed. The 30-minute limit counts from here | Yes (default now) |
| updatedAt | Last change | Yes |

**OrderItem** (the sarees on an order)

| Field | What it means | Must have it? |
|---|---|---|
| id, orderId | The line, and its order (deleted with the order) | Yes |
| productId | Which saree | Yes |
| pieceId | The exact tagged piece. Empty for old untagged stock | No |
| nameSnapshot | The saree's name at Pay | Yes |
| priceSnapshot | The website price at Pay, in whole rupees | Yes |
| imageSnapshot | Its photo address at Pay | No |
| quantity | Pieces. Always 1 for a tagged piece | Yes |
| lineNo | 1, 2, 3… the order on the invoice | No |
| storePrice | Counter sales only. Empty for website orders | No |

**Reservation** (the hold: one row per held piece)

| Field | What it means | Must have it? |
|---|---|---|
| id | The hold | Yes |
| productId | Which saree | Yes |
| pieceId | Which tagged piece. Empty for old untagged stock | No |
| quantity | Pieces held. 1 for a tagged piece | Yes (default 1) |
| orderId | The checkout holding it | Yes |
| expiresAt | When the hold ends: 15 minutes after Pay, moved on by "Pay again" | Yes |
| status | "active" (held), "converted" (paid), "released" (ended early), "expired" (time ran out) | Yes (default "active") |
| createdAt / updatedAt | When made, last change | Yes |

**StockLedger** (a diary of every stock movement; lines are only added, never changed)

| Field | What it means | Must have it? |
|---|---|---|
| id | The line | Yes |
| productId / pieceId | Which saree and piece | Saree yes, piece no |
| delta | −1 when held, +1 when released, 0 when a hold turns into a sale | Yes |
| reason | "reserve", "release", "online_sale" (and others for the counter) | Yes |
| channel | "online" here | Yes |
| actorId | Who did it. Empty means the server itself | No |
| ref | The order number | No |
| createdAt | When | Yes |

**Piece** (one tagged physical saree; only what checkout uses)

| Field | What it means | Must have it? |
|---|---|---|
| id, productId | The piece and its saree | Yes |
| barcode | The tag number | Yes, unique |
| status | "in_stock" → "reserved" (held at Pay) → "sold_online" (paid). Back to "in_stock" when a hold ends | Yes (default "in_stock") |
| soldAt | When sold | No |

**Product** (a saree listing; only what checkout uses)

| Field | What it means | Must have it? |
|---|---|---|
| slug | The saree's link name. The page sends it at Pay | Yes, unique |
| sku | The "Code" shown on the review | Yes, unique |
| name | Its name | Yes |
| stock | Old untagged pieces. Goes down when held, up when released | Yes (default 0) |
| isActive, deletedAt, channelVisibility | Whether it may show on the website ("online only" or "both") | Yes / No / Yes |
| subcategoryId | Its collection, which holds the **website price** (`onlinePrice`, rupees with paise; the website shows and charges it rounded to whole rupees) | Yes |

A saree can be bought on the website only if it is switched on, not deleted, set to online or both, its category and collection are active, its collection's website price is at least ₹500, and it has a photo.

**Address** (saved delivery addresses)

| Field | What it means | Must have it? |
|---|---|---|
| id, authAccountId | The address and its customer (deleted with the account) | Yes |
| fullName | Name for delivery | Yes |
| phone | Mobile for delivery | Yes |
| line1 | House, flat, building | Yes |
| line2 | Area, street | No |
| landmark | "Near the temple" | No |
| city, state, pincode | Place | Yes |
| country | "India" | Yes (default) |
| isDefault | The default one | Yes (default no) |
| label | home, office, other | No |
| createdAt / updatedAt | When made, last change | Yes |

**Pincode** (India Post's list, loaded from a file)

| Field | What it means | Must have it? |
|---|---|---|
| pincode | 6 digits | Yes (the key) |
| area | Main post office | Yes |
| city | District | Yes |
| state | State, spelled as in the website's list | Yes |
| updatedAt | Last loaded | Yes |

**BagItem** (a signed-in customer's bag: one row per saree)

| Field | What it means | Must have it? |
|---|---|---|
| id, authAccountId, productId | The line, its customer, its saree. One row per customer and saree | Yes, unique pair |
| quantity | Pieces wanted | Yes |
| priceSeen | The website price the customer last saw (for "price changed from") | Yes |
| createdAt / updatedAt | When added, last change | Yes |

**PaymentAttempt** (made at every Pay press; filled in later by the payments module)

| Field | What it means | Must have it? |
|---|---|---|
| id, orderId | The attempt and its order | Yes |
| razorpayOrderId | Razorpay's request id | Yes, unique |
| amount | The total in rupees | Yes |
| status | "created" at Pay (later confirming, paid, failed, refund_due, refunded) | Yes (default "created") |
| razorpayPaymentId, method, failureReason, capturedAt, refundId, refundStatus, refundReason, refundedAt, refundTries (default 0), refundError, nextRefundAt, alertedAt, lastCheckedAt | Filled in by the payments module | No |
| createdAt / updatedAt | When made, last change | Yes |

**Payment** (one per order; the latest request at Pay)

| Field | What it means | Must have it? |
|---|---|---|
| orderId | Its order | Yes, unique |
| provider | "razorpay" | Yes |
| razorpayOrderId | The latest request id. Replaced at each Pay press | Yes, unique |
| status | "created" at Pay, "paid" later | Yes |
| amount | The total | Yes |
| razorpayPaymentId, razorpaySignature, method, capturedAt | Filled when paid | No |

**AuthAccount** (the customer's account; only what checkout uses): `phone` (unique; used for the tester list and Razorpay's form), `email` (Razorpay's form), the name from the profile (Razorpay's form), and whether the account is closed (refused at sign-in check).

### 4.2 How the 15-minute hold works

- **At Pay**, for each saree: tagged pieces first, oldest first. Each piece goes from "in stock" to "reserved", with its own hold row ending 15 minutes later and a "reserve" diary line. If there aren't enough tagged pieces, the rest comes off the old stock counter. If even that isn't enough, **nothing** is kept and the customer sees "Something changed". Two customers can never hold the same piece: each piece is taken only if it is still "in stock" at that exact moment.
- **Pay again** (same bag, same address, still held, less than 29 minutes since the first Pay): the same order, the hold moved to "now + 15 minutes", but never later than 30 minutes after the first Pay.
- **The hold ends early** when: the customer presses **Change my bag**; a newer checkout with a different bag or address replaces it; Razorpay can't be reached or refuses the amount (a new order only); an owner chooses "Sell anyway" at the counter for one of its sarees; or another of the customer's checkouts gets paid. The sarees go back "in stock", the order becomes "cancelled".
- **Time runs out:** every 30 seconds the server ends holds whose time is up. The sarees go back "in stock" and back on the website. The order stays "waiting for payment" (it shows in the admin app's Unpaid checkouts).
- **Paid:** the holds become "converted" and the pieces "sold online" (payments module).
- While a saree is held, other customers see it as sold out, and counter staff see "A customer is paying for this online right now. Ask an owner, or wait until 4:35 pm." Only an owner can "Sell anyway".

### 4.3 Money: rupees, paise and GST

- The website price is the collection's price **rounded to whole rupees**. The page, the order lines, the total and the invoice all use that same whole-rupee number.
- Razorpay is asked for the total × 100 in paise. Nothing else is added: delivery is free, no fees.
- Every price **includes** GST (5% unless changed in the settings). The page's note works out the GST on the total. The invoice works it out line by line to the paisa. They can differ by under a rupee only because the page rounds to whole rupees.
- Both use the same rule: CGST + SGST, unless the "IGST for other states" switch is on and the delivery state is not Andhra Pradesh. The switch is **off** today, waiting for the accountant.

---

## 5. On the website

### The bag page and the bag side panel
- **Checkout** is the main button when online payment is on and at least one piece can be bought. It is greyed out on the bag page when nothing can be bought. Below it: "Secure payment by Razorpay · UPI, cards, net banking, wallets", the short test note "**Test payment:** no real money is taken", and a small "Order on WhatsApp instead" link.
- The bag page note: "Sarees are held for you for 15 minutes once you press Pay. Until then our store sells them too."
- With online payment off (or the customer not on the tester list): "Send bag on WhatsApp" as before.

### `/checkout`: what can show instead of the page
| Situation | What the customer sees |
|---|---|
| Sign-in or settings still loading | A small loading dot |
| Not signed in | "Sign in to check out. Your bag stays as it is…" with **Sign in** and **Back to the bag** |
| Online payment not open for this customer | "Online payment isn't open yet. Send us your bag on WhatsApp…" with **Send bag on WhatsApp** and **Open the bag** |
| Nothing in the bag can be bought | "Your bag is empty" or "Your bag has nothing that can be bought now", with **Open the bag** and **New in** |

### `/checkout`: the page
- **Notes at the top:** the test-payment note ("Test payment: no real money is taken. … Pay with Razorpay's test card 4111 1111 1111 1111 … or the UPI ID success@razorpay. Test orders are not shipped."); inside Instagram, Facebook and similar apps: "Payments may not open inside Instagram … open the website in Chrome or Safari" with **Copy the link**; offline: "You're offline. You can look over your order. Pay works when you're back online."; bag check failed: "We couldn't check your bag just now" with **Try again**.
- **Step 1, Delivery address:** described in section 2. While loading: grey boxes. Load failed: "Your addresses didn't load" with **Try again**. After choosing: the chosen address with a **Change** link.
- **Step 2, Review and pay:** before an address is chosen: "After you choose the address." Then the lines, the "left out" note, and **Change my bag**.
- **Summary:** subtotal and pieces, "Delivery: Free", total, the GST note (CGST + SGST, or IGST with the state once the switch is on), the hold line "Your sarees are held for you until 4:35 pm" once Pay was pressed, the "too large" box with **Order on WhatsApp** when over the limit, the **Pay ₹X** button, the Razorpay line, the policy links, and three notes (free DTDC delivery, the 15-minute hold, handwoven in Mangalagiri).
- **Phone:** a bar at the bottom with the total, pieces, "free delivery" and **Pay**.

### The Pay button
- **Greyed out** until: an address is chosen and has no problem, the bag has been checked with the account, at least one piece can be bought, the phone is online, the total is within the limit, and no payment is starting, open or being confirmed.
- **Spinning** while the server makes the order (up to 20 seconds).
- Then Razorpay's window opens. While the server checks a payment: "Confirming your payment. Checking with Razorpay that the money arrived. Please don't close this page." (can't be closed).

### Messages after pressing Pay (the box at the top)
| When | Message | Buttons |
|---|---|---|
| Something changed | "Something changed before you paid. A saree sold or a price changed since this page was opened. Nothing was charged. Check the order below, then pay." | none |
| Too large | "This order is too large to pay online in one go. Orders above ₹… Nothing was charged." | Order on WhatsApp |
| Offline | "You're offline. Nothing was charged. Pay works again when you're back online." | none |
| Any other refusal | "Payment didn't start. [the server's message] Nothing was charged." | none |
| Window closed | "Payment not completed. Your sarees are held for you until 4:35 pm." | Pay now · Change my bag |
| Payment failed | "Payment didn't go through. Nothing was taken. [the bank's reason] Your sarees are held…" | Try again · Change my bag |
| Window didn't load | "The payment window didn't open. Check your connection and press Pay again. Nothing was charged." (plus a Chrome or Safari tip inside apps) | Try again |
| Time over (or the checkout ended any other way) | "The 15 minutes are over. Your sarees were released, so others could buy them. Check your bag again: most are usually still there." | Check my bag again |
| An earlier checkout was paid meanwhile | "Your payment for order NH… went through. It's confirmed, so you don't need to pay for it again." (or "is being confirmed", or "couldn't be kept … is being refunded") | See the order |

---

## 6. Problems found

### Must fix

1. **Pressing Pay again can send the parcel to the old address after the customer corrected it.**
   - When the customer presses Pay a second time with the same bag and the same saved address, the server reuses the first order. It checks only that it is the **same saved address**, not whether its details changed. The order keeps the copy made at the first Pay.
   - Example: Priya presses Pay, then notices her flat number is wrong. She closes Razorpay's window, goes to My account → Addresses, fixes it, comes back to Checkout within 15 minutes and pays. The checkout page shows the corrected address. The order, the admin app's To ship list and the parcel label all have the **old** one.
   - Why it matters: a paid parcel goes to the wrong place.
   - Where: `Nadam-backend/src/services/shop/checkout.service.js:293-294` (reuse test), `:51-54` (the copy is made only for a new order, `:307`).
   > **Second check: ✅ Correct.**

2. **With test payments open to everyone, anyone can take real sarees off sale.**
   - Since 26 Oct, every signed-in visitor may "pay" with Razorpay's test card, and the checkout page prints that card number. The server treats a test payment like a real one: the pieces become "sold online" (gone from the website, and the counter scan says "already sold online"), the order goes to the admin app's To ship list, and the owners' phones get "New online order · ₹X" with no word "test". Only the invoice says TEST.
   - Example: a curious visitor fills a bag with ₹4,00,000 of sarees and pays with the test card. All of them disappear from the website and can't be sold at the counter until an owner finds and cancels that order by hand. Staff who miss the TEST invoice might even pack it.
   - The owner chose to open test payments on purpose. But I don't think this side effect was part of that choice.
   - Why it matters: real stock is blocked (and possibly shipped) with no money paid.
   - Where: `Nadam-backend/src/services/shop/paymentAccess.js:8-11` (everyone may pay when the tester list is empty), `Nadam-backend/src/config/env.js:105`, `:158`, `Nadam-frontend/customer-web/src/payments/TestPayNote.jsx:16` (the card printed), `Nadam-backend/src/services/shop/checkout.service.js:473-488` (stock taken on payment), `Nadam-backend/src/services/ownerAlerts.service.js:20` (alert without "test").
   > **Second check: ✅ Correct.**

### Should fix

1. **While a payment is still "being confirmed", Pay again gives no warning and can charge the customer twice.**
   - A bank can be slow, so a payment can stay "being confirmed" for minutes or hours. The sarees stay in the bag until it is confirmed. If the customer goes back to Checkout and presses Pay, the server either opens a second payment on the same order, or (if the 15 minutes are over, or the bag or address differ) cancels that order and makes a new one. Nothing tells the customer "your payment for NH… is still being confirmed".
   - Example: the first payment is confirmed an hour later. If the shop has more than one piece of that saree, or it is old untagged stock, the old order comes back to life with another piece. The customer has then paid twice and gets two sarees. Otherwise the first payment is refunded, but only after days.
   - Why it matters: a double charge and a confused customer.
   - Where: `Nadam-backend/src/services/shop/checkout.service.js:289-297` (open checkouts are reused or cancelled without looking at their payment attempts), `:489-502` (a late payment takes stock again).
   > **Second check: ⚠️ Partly correct: the second payment is real (Pay reuses or replaces a checkout without looking at a confirming attempt), but a late payment never revives the old order "with another piece": it re-claims only its own piece (checkout.service.js:493-494), which the new order normally holds again, so it is refunded; two sarees for two payments only happen with old untagged stock or when the new bag dropped that saree. Should is right.**
   > **Third check: Second checker right. Final: Pay is allowed with no warning while an earlier payment is still being confirmed, so the customer can be charged twice; the extra payment is normally refunded automatically (a second order only with old untagged stock), and "being confirmed" usually lasts minutes, not hours. Final group: Should fix.**

2. **"The 15 minutes are over" is shown when the checkout ended for another reason.**
   - The page says the same thing for every way a checkout can end. It may have ended because an owner sold one of its sarees at the counter ("Sell anyway"), because **Change my bag** or a newer Pay was pressed in another tab or on another phone, or because Razorpay couldn't be reached.
   - Example: a customer is on the page 3 minutes after pressing Pay. The shop sells the saree at the counter. The page says "The 15 minutes are over … most are usually still there."
   - Why it matters: a wrong reason, and it suggests the customer was too slow.
   - Where: `Nadam-frontend/customer-web/src/pages/checkout/CheckoutPage.jsx:159` (every ending becomes "expired"), `:49`. The server says only "cancelled", not why: `Nadam-backend/src/services/shop/checkout.service.js:91-92`.
   > **Second check: ⚠️ Partly correct: true for Sell anyway, Change my bag or a newer Pay in another tab, but not for "Razorpay couldn't be reached": the page never keeps that order, and a reused order is not ended (checkout.service.js:335). Wording only, on rare paths: Should is acceptable, Small would also be fair.**
   > **Third check: Second checker right. Final: the page says "The 15 minutes are over" when the checkout really ended another way (Sell anyway, Change my bag elsewhere, or a newer Pay, including one in the same tab after changing the address that then failed at Razorpay); wording only, on rare paths. Final group: Small.**

3. **If the bag couldn't join the account at sign-in, Pay stays greyed out with no reason (or the page says "Your bag is empty").**
   - At sign-in, the visitor's bag is joined with the account's bag. If that call fails (a mobile network blip), the checkout shows "We couldn't check your bag just now" with **Try again**. But **Try again** checks the bag as a visitor's bag and never joins it to the account. The error box goes away, yet Pay needs an account bag, so it stays greyed out with no message. If the visitor's bag was empty, the page says "Your bag is empty" although the account has sarees. Only reloading the page fixes it.
   - Why it matters: a customer ready to pay is stuck and isn't told why.
   - Where: `Nadam-frontend/customer-web/src/bag/store.js:198-210` (`refresh` never calls `joinAccount`), `:345` (a failed join leaves the bag as a visitor's), `Nadam-frontend/customer-web/src/pages/checkout/CheckoutPage.jsx:187` (`bagReady` needs an account bag), `:380`.
   > **Second check: ✅ Correct.**

4. **There is no check that the pincode is real or that DTDC delivers there.**
   - A pincode not in India Post's list is accepted once the customer types a city and state. At Pay, the only check is "6 digits, not starting with 0". So a typo pincode (for example 522599) goes through, and the shop finds out only when booking the parcel, after the money is taken. Nothing checks DTDC's delivery areas either.
   - Why it matters: paid orders that can't be sent, and phone calls to sort them out.
   - Where: `Nadam-backend/src/services/shop/address.service.js:17-23`, `Nadam-backend/src/services/shop/addressCheck.js:11`.
   > **Second check: ⚠️ Partly correct: the server gap is real (unknown pincodes are saved with the typed city and state; Pay checks only the format), but "no check" is too strong: the form looks up every pincode and warns "We couldn't find this pincode…" (PlaceFields.jsx:32-38); it just does not block or repeat the warning at Pay. Should is fine.**
   > **Third check: Second checker right. Final: an unknown pincode can be saved after a soft warning in the form and then paid for (Pay checks only the 6-digit format, old addresses were never looked up), and nothing checks DTDC's delivery areas. Final group: Should fix.**

5. **One account can keep sarees held for ever.**
   - Each Pay holds up to ₹5,00,000 of sarees. Pressing Pay again before 29 minutes renews the hold. After that, the next Pay makes a new checkout with a fresh 15 minutes. Nothing limits how many checkouts one customer starts and leaves unpaid.
   - Example: someone (or a small script) presses Pay every 14 minutes. Those sarees are "sold out" on the website all day, and counter staff must call an owner to sell any of them. With test payments open to everyone, anyone can do this.
   - Why it matters: lost sales, online and at the counter.
   - Where: `Nadam-backend/src/services/shop/checkout.service.js:285-316`, `:63`; the only limit is 10 Pay presses a minute, `Nadam-backend/src/routes/shop/index.js:89`.
   > **Second check: ⚠️ Partly correct: endless holds are possible, but not with "every 14 minutes": the hold is capped at 30 minutes from the first Pay (checkout.service.js:63), so that rhythm leaves the sarees free about 12 minutes in every 42; pressing Pay every 10 minutes or less keeps them held. Should is right.**
   > **Third check: Second checker right (one slip: a 7 to 9 minute rhythm still leaves short gaps; what is needed is Pays at most 15 minutes apart with one between minute 29 and 30 of each checkout, e.g. every 1, 5 or 10 minutes). Final: nothing limits unpaid checkouts per account, so one account or a script can keep up to ₹5,00,000 of sarees held without end. Final group: Should fix.**

6. **Orders delivered outside Andhra Pradesh get CGST + SGST on the invoice, not IGST.**
   - This is on purpose, until the accountant confirms. The page and the invoice agree with each other. Under GST rules, a sale to another state normally needs IGST.
   - Why it matters: every out-of-state invoice may be wrong once real payments start. Not sure: it needs the accountant.
   - Where: `Nadam-backend/src/config/env.js:87` (switch off by default), `Nadam-backend/src/services/invoice.service.js:29-33`, `Nadam-frontend/customer-web/src/pages/checkout/format.js:15`.
   > **Second check: ✅ Correct.**

### Small

1. "Nothing was charged." appears twice when Razorpay can't be reached ("…Nothing was charged. Please try again in a minute. Nothing was charged."). `Nadam-frontend/customer-web/src/pages/checkout/CheckoutPage.jsx:63`, `Nadam-backend/src/services/shop/checkout.service.js:336`.
   > **Second check: ✅ Correct.**
2. A rare `HOLD_ENDED` at Pay shows the general "Payment didn't start" box while the old "held until" line still shows, until the next 8-second check. `CheckoutPage.jsx:284-285`.
   > **Second check: ✅ Correct.**
3. Too many Pay presses says "Too many requests from this network", but the limit counts per customer, not per network. `Nadam-backend/src/middlewares/rateLimit.js:26`.
   > **Second check: ✅ Correct.**
4. The review says "1 saree in your bag can't be bought now and is left out" but not **which** one. `CheckoutPage.jsx:401`.
   > **Second check: ✅ Correct.**
5. With 2 or more pieces, only the line total shows, not the price of one piece. `Nadam-frontend/customer-web/src/pages/checkout/parts.jsx:45`.
   > **Second check: ✅ Correct.**
6. **Copy the link** gives no sign when copying fails (common inside Instagram and similar apps). `CheckoutPage.jsx:84`.
   > **Second check: ✅ Correct.**
7. If the GST rate were set to 0%, the page would still say "Includes GST 5%". `format.js:13`.
   > **Second check: ✅ Correct.**
8. The pincode and the state can disagree (pincode 500001, state "Delhi"): the customer's choice wins. This doesn't matter today, but it will once IGST is on. `address.service.js:19-20`.
   > **Second check: ✅ Correct.**
9. When fixing an old address whose state is wrong, the state isn't filled in from the pincode: the customer must pick it. `Nadam-frontend/customer-web/src/components/PlaceFields.jsx:30`.
   > **Second check: ✅ Correct.**
10. An old address saved with "+91…" in the mobile shows "+91 +919876543210" on its card. (The order itself keeps a clean number.) `parts.jsx:18`, `Nadam-backend/src/services/shop/present.js:56`.
    > **Second check: ✅ Correct.**
11. Razorpay's window can stay open a few seconds past the hold: its time is counted from before the server's work and is never under 60 seconds. A late payment is still handled safely. `checkout.service.js:255`.
    > **Second check: ⚠️ Partly correct: the overrun comes from the time being taken before the server's work (checkout.service.js:270, :255); the 60-second floor never applies, because Pay again stops at 29 minutes and the hold is capped at 30, so more than 60 seconds are always left. Small.**
    > **Third check: Second checker right. Final: Razorpay's window can stay open a few seconds past the hold because its time is counted from when Pay reached the server (the 60-second floor never applies); a late payment is still handled safely. Final group: Small.**
12. When Pay is stopped ("changed" or "empty"), the earlier checkout keeps holding its sarees until its 15 minutes end, even if the customer emptied the bag. `checkout.service.js:277-284`.
    > **Second check: ✅ Correct.**
13. "Pay again" (order page) moves the hold on before Razorpay answers, so a failed request still extends the hold. `checkout.service.js:357-363`.
    > **Second check: ✅ Correct.**
14. If the website settings fail to load, a signed-in customer sees "Online payment isn't open yet" though it is open. `CheckoutPage.jsx:113`, `:218`.
    > **Second check: ✅ Correct.**
15. A collection price with paise (₹1,499.50) is shown and charged as ₹1,500. Fine for the customer, but different from the admin app by up to 50 paise. `Nadam-backend/src/services/shop/catalog.service.js:65`.
    > **Second check: ✅ Correct.**
    > **Third check: Real (the second checker's note that rounding can go up). Final: a collection price with paise is shown and charged in whole rupees, up to 50 paise per piece more (or 49 less) than the admin price; the customer always pays what the page shows. Final group: Small.**
16. After "a saree sold a moment ago", the bag sent back is read without the bag lock. Harmless today. `checkout.service.js:325`.
    > **Second check: ✅ Correct.**
17. **Change my bag** writes "checkout cancelled" in the activity log even when the order was already paid or ended. `checkout.service.js:376-381`.
    > **Second check: ✅ Correct.**

---

## 7. What I could not check (and why)

- **Nothing was run.** I read the code only. No tests, server, browser or database (by the rules of this review).
- **The live settings** (`.env` was not opened): the real online limit, the GST rate, the IGST switch, the tester list, and whether test payments are really open to everyone. I took the last one from the brief.
- **Razorpay itself:** the account's own per-payment limit, and whether its window always reports "closed" when its timer runs out. This belongs to the payments review.
- **A very large bag** (20 sarees × many pieces): each piece takes four database writes inside one step that must finish in 20 seconds. I think the ₹5,00,000 limit keeps this small enough, but I could not measure it. Not sure.
- **"Sell anyway" at the counter at the very moment a payment arrives:** the counter code does not take the order's lock (`Nadam-backend/src/services/sale.service.js:119-133`). I believe the database then stops one of the two with an error and stock stays right, but I could not prove it. Not sure.
- **The admin app:** whether its To ship and Unpaid checkouts lists mark test orders. Not in this module's code.
- **DTDC delivery areas, and GST law** (the 5% rate for every saree, IGST): need the courier and the accountant.
- **The old server** (v1): if it still runs on the same database, its own sweep could also touch holds. I did not check whether it is fully off.

---

## 8. For the developer

| # | Finding | Where | Suggested fix (one line) |
|---|---|---|---|
| M1 | Reuse compares only `open.addressId === address.id`; an edited address keeps the old `shippingAddress` snapshot | `src/services/shop/checkout.service.js:293-294`, `:51-54`, `:307` | Also require `sameAddress(open.shippingAddress, snapshot(address))` (all fields) to reuse; otherwise release and make a new order (or update `shippingAddress` on reuse). |
| M2 | `PAYMENTS_TEST_FOR_EVERYONE` + test keys: test payments run `complete()` in full (pieces `sold_online`, To ship, owner alert without "TEST"); the card is printed on the page | `src/services/shop/paymentAccess.js:8-11`; `src/config/env.js:105`, `:158`; `customer-web/src/payments/TestPayNote.jsx:16`; `src/services/shop/checkout.service.js:473-488`; `src/services/ownerAlerts.service.js:20` | Prefer `PAYMENTS_TESTERS` (owner and staff mobiles); if everyone must stay open, auto-cancel and restock test-mode orders after the test (or release on paid), and prefix owner alerts and To ship with "TEST". |
| S1 | `checkout()` reuses or cancels an open checkout whose attempt is `confirming`; a late capture then revives the old order (`complete()` non-held branch) when another piece or counter stock is free | `src/services/shop/checkout.service.js:289-297`, `:489-502` | If any open checkout has an attempt in `confirming` (or a `created` attempt with a payment seen), throw 409 `PAYMENT_CONFIRMING` with the order; the page shows the existing "being confirmed" notice. Consider refunding instead of reviving when the customer has a newer paid or open order. |
| S2 | `settleOpen` maps every non-paid ending (`cancelled` by Sell anyway, by a newer checkout, by Change my bag elsewhere, by `abandon`) to the "15 minutes are over" notice | `customer-web/src/pages/checkout/CheckoutPage.jsx:159`, `:49`; `src/services/shop/checkout.service.js:84-92` | Return an `endedReason` (`expired`, `sold_at_store`, `replaced`, `changed_bag`, `payment_unavailable`) from `presentOrder` (from `cancelReason`) and word the notice per reason. |
| S3 | After a failed `joinAccount`, `refresh()` does a guest check (owner stays `guest`), so `bagReady` stays false with no message, or the page shows "Your bag is empty" | `customer-web/src/bag/store.js:198-210`, `:327-347`; `customer-web/src/pages/checkout/CheckoutPage.jsx:187`, `:380` | In `refresh()`, when `signedIn() && state.owner !== 'account'`, call `joinAccount()` instead; also show a "Checking your bag…" hint when `owner !== 'account'`. |
| S4 | Any `^[1-9]\d{5}$` pincode passes at Pay; unknown pincodes are saved with typed city/state | `src/services/shop/address.service.js:17-23`; `src/services/shop/addressCheck.js:11` | Add `known` (in the Pincode table) to `presentAddress` and warn on the card and at Pay ("We couldn't find this pincode. Check it before paying"); optionally a DTDC serviceable list. |
| S5 | No limit on checkouts started and abandoned; holds can be chained for ever (renew to 30 min, then a new order) | `src/services/shop/checkout.service.js:285-316`, `:63`; `src/routes/shop/index.js:89` | Count unpaid checkouts per account (for example 5 in an hour, or a cap on pieces held per account per day) and refuse with a clear message beyond it. |
| S6 | IGST off: inter-state invoices show CGST + SGST | `src/config/env.js:87`; `src/services/invoice.service.js:29-33`; `customer-web/src/pages/checkout/format.js:15` | Get the accountant's answer and set `GST_IGST_OTHER_STATES=true` before live keys. |
| s1 | Duplicate "Nothing was charged." | `customer-web/src/pages/checkout/CheckoutPage.jsx:63`; `src/services/shop/checkout.service.js:336` | Drop it from the server message, or don't append it when the message already contains it. |
| s2 | `HOLD_ENDED` not handled in `onPay` | `customer-web/src/pages/checkout/CheckoutPage.jsx:284-285` | Treat `HOLD_ENDED` like `settleOpen` 'done': `setOrder(null)`, `rememberCheckout(null)`, show the ended notice. |
| s3 | Per-account limit says "from this network" | `src/middlewares/rateLimit.js:26` | Different message when `by` is set ("Too many tries. Please wait a minute."). |
| s4 | Left-out sarees not named | `customer-web/src/pages/checkout/CheckoutPage.jsx:401` | List the names (or link to the bag) of lines with `state` `sold_out` or `unavailable`. |
| s5 | No unit price for quantity > 1 | `customer-web/src/pages/checkout/parts.jsx:45` | Show "2 × ₹4,500" when `quantity > 1`. |
| s6 | Copy-link failure silent | `customer-web/src/pages/checkout/CheckoutPage.jsx:84` | On catch, show "Copy didn't work: press and hold the address bar". |
| s7 | `Number(rate) \|\| 5` turns 0 into 5 | `customer-web/src/pages/checkout/format.js:13` | Use `Number.isFinite(Number(gst?.ratePercent)) ? Number(gst.ratePercent) : 5`. |
| s8 | Typed state overrides the pincode's state | `src/services/shop/address.service.js:19-20` | When the pincode is known and the state differs, refuse or warn ("This pincode is in Telangana"). |
| s9 | Fix mode keeps a bad saved state, no autofill | `customer-web/src/components/PlaceFields.jsx:30` | Also autofill when `!config.states.includes(v.state)`. |
| s10 | Raw old `phone` shown on cards | `customer-web/src/pages/checkout/parts.jsx:18`; `src/services/shop/present.js:56` | Send `normalizeMobile(a.phone) ?? a.phone` in `presentAddress`. |
| s11 | Window timeout from `now` taken before the work, minimum 60 s | `src/services/shop/checkout.service.js:255` | Use `Date.now()` at reply time and `Math.max(30, …)`, or close the window from the page at `holdUntil`. |
| s12 | `BAG_EMPTY` and `BAG_CHANGED` leave the earlier open checkout held | `src/services/shop/checkout.service.js:277-284` | On `BAG_EMPTY`, release the customer's open checkouts in the same step. |
| s13 | `payAgain` renews before Razorpay answers | `src/services/shop/checkout.service.js:357-363` | Renew inside `openPayment`'s locked step, after Razorpay answers. |
| s14 | Config failure shows "isn't open yet" | `customer-web/src/pages/checkout/CheckoutPage.jsx:113`, `:218` | When `cfg === 'error'`, show "We couldn't load the checkout. Try again." with a retry. |
| s15 | Website price rounded from `Decimal(10,2)` | `src/services/shop/catalog.service.js:65` | Refuse paise in the admin app's website price, or show paise on the website. |
| s16 | Fallback bag read without `Bag.lockFor` | `src/services/shop/checkout.service.js:325` | Take `Bag.lockFor(accountId, tx)` first. |
| s17 | Cancel audit even when nothing changed | `src/services/shop/checkout.service.js:376-381` | Log only when the `updateMany` count is 1. |
| n1 | Not sure: "Sell anyway" (`cancelCheckout` in the sale service) doesn't take `lockOrder`; with `complete()` at the same moment it can deadlock (Postgres aborts one) | `src/services/sale.service.js:119-133` | Call `lockOrder(orderId, tx)` first and use `updateMany … status: 'active'` for the reservation. |
| n2 | `newOrderNumber` checks then inserts; a clash with another insert at the same moment would be a 500 (about 1 in 100 million) | `src/models/sale.model.js:33-39` | Retry on a unique clash on `orderNumber`. |

> **Second check (n1): ✅ Correct.** Confirmed: the counter sale locks the piece and then the reservation, `complete()` locks the reservation and then the piece, so a deadlock is possible; Postgres aborts one and stock stays right (Small).

> **Third check (n1): Real. Final: a counter "Sell anyway" (piece, then hold) and an online payment (hold, then piece) for the same saree at the same instant can deadlock; Postgres stops one, a retry finds the right state, and no saree is sold twice. Final group: Small.**

> **Second check (n2): ✅ Correct.**

Good points worth keeping:
- `expect` is compared on the server, by link name, pieces and price (`checkout.service.js:279-284`). A changed page can't lower the charge, and the amount is fixed in paise from the order total (`:213`).
- Pieces are held with "only if still in stock" updates, inside one all-or-nothing step with per-customer locks (`checkout.service.js:173-204`, `:272-275`).
- Addresses and orders are always looked up with the customer's id (`models/address.model.js:10`, `models/checkout.model.js:19-20`).
- The pincode list and the website's states list match exactly (all 36 names).

---

## Second check (26 Oct 2026)

Every finding was checked again against the code (read only).

- ✅ Correct: **22** (M1, M2, S3, S6, s1 to s10, s12 to s17, n1, n2)
- ⚠️ Partly correct: **5** (S1, S2, S4, S5, s11)
- ❌ Wrong: **0**

Details, evidence and the right groups: [checks/08-checkout-check.md](checks/08-checkout-check.md).

---

## Third check (26 Oct 2026)

Only the 5 items marked ⚠️ and the second checker's 2 extra claims were checked again, from the code (read only).

- Second checker right: **5** (S1, S2, S4, S5, s11). S2 and S5 each have one small slip in the second checker's reasoning, but its verdict holds.
- First reviewer right: **0**
- Both partly right: **0**
- Neither right: **0**
- Extra claims: Real **2** (n1 deadlock, s15 rounding can go up) · Not real **0** · Not sure **0**

Final groups: S1 Should fix · S2 **Small** (was Should) · S4 Should fix · S5 Should fix · s11 Small · n1 Small · s15 Small.

Details and evidence: [checks/08-checkout-third-check.md](checks/08-checkout-third-check.md).

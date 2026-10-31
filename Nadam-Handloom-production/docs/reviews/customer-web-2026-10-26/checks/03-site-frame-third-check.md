# Third check: Module 3, Site frame (disputed findings only)

| | |
|---|---|
| **Report** | [`../03-site-frame.md`](../03-site-frame.md) |
| **Second check** | [`03-site-frame-check.md`](03-site-frame-check.md) |
| **Date** | 26 Oct 2026 |
| **How** | I only read the code: website, server, CSS, design notes, and the code backup from before the 26 Oct design change. Nothing was run, built, tested or changed. No `.env` was opened. I did not touch the live server or database. I worked out the button and footer positions from the exact CSS rules (1 rem = 16 px, because no root font size is set). |
| **Disputed** | 6 findings marked ⚠️ (none marked ❌): S8, S9, S10, S11, Small 6, Small 16. |

Short paths: `web/` = `Nadam-frontend/customer-web/`, `backend/` = `Nadam-backend/`.

## Summary

| Id | Finding (one line) | First reviewer said | Second checker said | Who is right | Final group |
|---|---|---|---|---|---|
| S8 | Offline strip says "we'll try again when you're back", but most pages don't | Should: pages stay on "couldn't load" until the customer presses Try again | Real, but every page has its own Try again and reopening retries: Small | Second | Small |
| S9 | Home footer always says "Secure payment: UPI, cards and net banking" | Should: wrong in test mode and if payment is off | Real, but the test note shows wherever one can pay, and checkout says when payment is off: Small | Second | Small |
| S10 | WhatsApp number typed into code; call number set in the admin app | Should: 3 files to change (incl. `config.js:9`), website and server release, two numbers shown meanwhile | `config.js:9` is the call number; only the server copy counts on a normal visit; numbers match today: Small | Second | Small |
| S11 | Theme switch only at the bottom of the home page | Should: breaks the owner's "visible switch" choice | Real, but a result of the 26 Oct footer decision; Auto follows the device; owner's call: Small | Second (one nuance) | Small |
| Small 6 | Saree page doesn't underline its category in the menu bar | Only for a saree link opened directly | Also any first opening from inside the site; shows only for a saree already loaded, or by chance | Second | Small |
| Small 16 | WhatsApp button covers the last footer links | Not sure; on phones | Real, but on computers (covers "Terms"); phones are fine | Second (plus one extra) | Small |

**Counts: Second checker right 6 · First reviewer right 0 · Both partly right 0 · Neither right 0.**

In all six, the first reviewer's facts about the code were right (except one wrong line number in S10). What they got wrong was mostly the weight: they put four polish items in "Should fix", gave too narrow a case in Small 6, and guessed the wrong screen size in Small 16.

---

## S8. Offline strip promises a retry that most pages don't do

**What really happens.** The strip text is `web/src/components/Layout.jsx:24`: "You are offline. What you type is kept; we'll try again when you're back." Only two places listen for the connection coming back: the bag (`web/src/bag/store.js:406`) and page-code downloads (`web/src/utils/lazyPage.js:25`). The shared cache for home, lists and saree pages never retries by itself (`web/src/data/resource.js:18-28`). So when the connection returns, the strip goes away, but a page that failed keeps its error box.

But every one of those error boxes has its own clear "Try again" button and says "check your connection and try again":
- Home: `web/src/pages/home/HomePage.jsx:96-101`
- Lists: `web/src/pages/shop/ShopList.jsx:107-113` (and "Couldn't load more. Try again" at `:139`)
- Category / collection / all collections: `CategoryPage.jsx:50`, `CollectionPage.jsx:26`, `CollectionsPage.jsx:39`
- Saree: `web/src/pages/product/ProductPage.jsx:99-105`
- My orders, order, addresses, devices, bag and checkout also have their own Try again (`MyOrdersPage.jsx:25`, `OrderPage.jsx:242`, `AddressesPage.jsx:55`, `DevicesPage.jsx:69`, `BagPage.jsx:112`, `CheckoutPage.jsx:348,380`).

Opening the page again also retries: `ensure` skips the server only when the saved copy is "ready" and under a minute old (`resource.js:21`), so a failed one is fetched again.

**Why the first reviewer went too far.** Their facts are right, but they rated a wording mismatch as "likely and harmful". Nobody is stuck: the page itself tells them what to do and gives the button. The two places where "no retry" really hurts (the shop settings and the header's categories) are already separate findings (S1 and Small 4).

**Is the second checker right?** Yes, on every point.

**Final:** after the connection returns, pages that failed don't reload by themselves, so the strip's "we'll try again" is not quite true; each page shows its own Try again button. **Small.**

---

## S9. "Secure payment: UPI, cards and net banking" always in the home footer

**What really happens.** The text is fixed: `web/src/components/Footer.jsx:25`. It does not look at the payment settings.

But wherever a customer can actually pay, the test status is shown:
- `web/src/payments/TestPayNote.jsx:9-17` shows "Test payment: no real money is taken" whenever payment is on and in test mode;
- it appears in the bag panel (`web/src/components/BagPanel.jsx:55`), on the bag page (`web/src/pages/bag/BagPage.jsx:177`) and at the top of checkout (`web/src/pages/checkout/CheckoutPage.jsx:377`, with "Test orders are not shipped").

Online payment really is offered to everyone today (test keys), so "secure payment" by Razorpay is not false. With test keys Razorpay accepts only test cards and test UPI, so no real money can be taken by mistake. If payment is switched off, checkout says "Online payment isn't open yet" and offers WhatsApp (`CheckoutPage.jsx:218-229`), and the bag says "Online payment is coming soon" (`BagPage.jsx` other branch of `:171`).

**Why the first reviewer went too far.** The text is generic marketing on the home page. The customer gets the true story before paying, every time. No money, order or stock can go wrong because of it.

**Is the second checker right?** Yes.

**Final:** the home footer always promises "Secure payment: UPI, cards and net banking", even when payment is in test mode or switched off; the bag and checkout always tell the truth before paying. **Small.**

---

## S10. WhatsApp number typed into code; call number in the admin app

**What really happens.**
- WhatsApp number: server `backend/src/config/constants.js:190` (`STORE.whatsapp`), sent to the website in `/config` (`backend/src/services/shop/config.service.js:13`). The website's built-in copy is `web/src/config/config.js:13`, and the no-JavaScript text is `web/index.html:29`. That is three places, as the first reviewer said.
- `web/src/config/config.js:9` is **not** WhatsApp. It is `shop.mobile`, the built-in copy of the **call** number.
- On a normal visit the server's copy wins: `config.js:38` does `{ ...FALLBACK, ...config }`, which replaces the whole `store` with the server's. The website's copy is used only if `/config` fails; the `index.html` text only when JavaScript is off.
- The call number comes from Shop details in the admin app (`backend/src/services/settings.service.js:61`).
- Today both are 7382388565 (server `constants.js:190`; the 26 Oct deployment record says Shop details hold the same; I could not read the live database).

**Why the first reviewer went wrong.** They read `config.js:9` (call number) as a WhatsApp copy. And "a developer must change three files and release the website and server" is more than needed for what customers normally see: a server change and restart is enough; the website copies matter only in failure cases (still worth updating). The "two different numbers" only happens after a future number change, so it is a maintenance risk, not a customer problem today.

**Is the second checker right?** Yes, on the line number, on which copy counts, and on the group.

**Final:** the WhatsApp number can only be changed by a developer (mainly the server's `STORE`; two backup copies in the website), while the call number is changed in the admin app; both match today, so this only matters at the next number change. **Small.**

---

## S11. Theme switch only at the bottom of the home page

**What really happens.** `ThemeSwitch` is used only in the home footer (`web/src/components/Footer.jsx:70`). The one-line footer (`Footer.jsx:79-88`) and the phone menu (`web/src/components/SideMenu.jsx`) don't have it. `Layout.jsx:35` shows the full footer only on `/`. Auto (the default) follows the phone or computer (`web/src/theme/theme.js`).

History: before the 26 Oct change the switch was also only in the footer, but that footer was on every page (backup `code-2026-10-26-before-shop-design/customer-web.tgz`: `Footer.jsx:61`, `Layout.jsx:34`). The user's 26 Oct decision was "the lower footer with the shop's details only on the home page" (`docs/modules/web-02-home-and-shop.md:159`). The note says nothing about the switch, so losing it on other pages is a side effect of that decision, not something the user chose on purpose. The earlier choice "a visible switch on the site" is in `docs/modules/web-00-website-plan.md:6`.

Extra found while checking Small 16: on computers the green WhatsApp button covers most of the "Dark" button of this switch at the bottom of the home page (worked out in Small 16 below).

**Why the first reviewer went too far.** The facts are right, and they even named the 26 Oct footer change. But nobody is harmed: Auto already gives most people the right colours, and where the switch should live is a design question for the owner. That is not "likely and harmful".

**Is the second checker right?** Yes on the group. One nuance: it is fairer to call it a side effect of the 26 Oct footer decision than "the owner's choice"; it is worth one question to the owner ("add the switch to the phone menu or the one-line footer?").

**Final:** since 26 Oct the Auto / Light / Dark switch is only at the very bottom of the home page (and on computers partly under the WhatsApp button); Auto still follows the device; where else to put it is the owner's call. **Small.**

---

## Small 6. Saree page doesn't underline its category in the menu bar

**What really happens.** The header works out the current category for a saree page with `peek('saree:<slug>')` (`web/src/components/Header.jsx:31`). `peek` just reads the cache; it does not ask to be told about changes (`web/src/data/resource.js:30`). The header only listens to the catalogue entry (`Header.jsx:74` → `resource.js:36`), the sign-in state (`Header.jsx:72`), the settings (`:73`) and the address (`:75`).

The saree is fetched only after the saree page opens: `useSaree` (`web/src/data/shop.js:6`) starts the call in an effect (`resource.js:37-41`), and the saree page's code itself is loaded on demand (`web/src/App.jsx:23`). Nothing else puts a saree in the cache: the lists are kept under `list:` keys, and `saree:` appears nowhere else in the website. So when the header draws for the new address, the saree isn't there yet, and when it arrives the header is not redrawn.

Result:
- **First opening of any saree, from a list, a card, search or a link:** no underline. From inside the site this is almost always the case, because nothing else redraws the header after the saree arrives (only by chance: a sign-in key renewal, an online/offline change).
- **Opened directly from a link:** usually no underline too, but it can appear by chance if the catalogue, the settings or the sign-in check arrives after the saree (the saree call starts last, after the page code downloads).
- **Saree already in the cache** (Back to a saree seen before): the underline shows.

**Why the first reviewer went wrong.** They named the right cause but pictured only the direct-link case. They seem to have assumed a saree opened from a list is already loaded. It isn't: lists and saree pages are stored separately.

**Is the second checker right?** Yes, exactly.

**Final:** the first time any saree is opened (from inside the site or from a link) its category is not underlined in the menu bar; it shows only when the saree was already loaded. **Small.**

---

## Small 16. WhatsApp button over the footer links

**The rules** (`web/src/theme/base.css`; 1 rem = 16 px, no root size is set):
- Button `.wa-fab` (`:295`): fixed, 54 × 54 px circle, 18 px from the right, **20 px from the bottom**. On screens up to 900 px (`:298`): **66 px from the bottom**. Both add the same safe-area inset as the footer does.
- One-line footer `.ftr-line` (`:288-290`): 18 px padding at the bottom, text .8rem = 12.8 px, line height 1.55 (`:14`) = about 19.8 px a row. Links are pushed to the right (`justify-content: space-between`); the link rows wrap with a .3rem = 4.8 px gap. The `.wrap` is at most 1,360 px wide with 16 px side padding (`:29`, `tokens.css:22`).

**Computers (over 900 px).** The © text and the five links fit on one row from about 720 px up. At the very bottom of a long page the link row sits **18–38 px above the bottom**, and "Terms" (about 35 px wide) ends **16 px from the right**, so it spans about 16–51 px from the right. The button covers **20–74 px from the bottom** and **18–72 px from the right**. They overlap: at the middle of the text the circle covers about 26–64 px from the right, which hides most of "Terms" and catches most clicks on it. "Privacy" ends about 70 px from the right and is only grazed. This holds for windows 901–1,360 px wide. Above 1,360 px the page is centred, so "Terms" moves left of the edge; the overlap fades out at about 1,450 px. The customer cannot scroll further to uncover it (no extra space under the footer); the keyboard still reaches it.

**Phones and small tablets (900 px and less).** The button covers 66–120 px from the bottom. The links take at most two rows: from 18 px to about 62.5 px above the bottom (18 + 19.8 + 4.8 + 19.8). So the button sits about 3.5 px above the top link row and covers nothing at normal text size. On 722–900 px everything is one row (18–38 px) and is clear too. Only a larger text setting (about +15% or more) could make the bottom tip of the circle touch the upper row.

**Extra the others didn't mention: the home page's theme switch.** The home footer's last row (`.ftr .bottom`, `base.css:283-284`) has the Auto / Light / Dark switch at the right end. The footer has 28 px padding at the bottom (`:275`) and the switch is 40 px tall (32 px buttons + padding + border, `:292-293`), so it sits **28–68 px from the bottom, ending 16 px from the right**. On computers (one row from about 886 px wide) the button's circle covers most of the right-hand "Dark" button, including its label; only its left edge with the moon icon stays clickable. The WhatsApp button shows on the home page (`Layout.jsx:19`). On phones the switch drops to its own row at the left, so it is clear.

**Why the first reviewer went wrong.** They marked it "not sure" and looked only at the phone rule (`:298`). They didn't do the arithmetic: the 66 px lift on phones is exactly what keeps the button clear, while the desktop rule (20 px) puts it right on the footer row.

**Is the second checker right?** Yes: the screen size, the numbers (link rows end about 62 px up on phones; "Terms" 18–38 px up, 16 px from the right, fading out at about 1,450 px) and the group all match my working. They missed the theme switch on the home page, which has the same cause and the same fix.

**Final:** on computers (about 900–1,450 px wide), at the very bottom of a page, the green WhatsApp button covers most of the "Terms" link in the one-line footer, and on the home page most of the theme switch's "Dark" button; on phones it sits just above the links. Fix: extra bottom space under both footers when the button shows. **Small.**

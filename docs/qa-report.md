# nile QA report

Final QA pass, 2026-09-14. Six areas were tested on the live site (https://amazon-rebuild-teal.vercel.app) at 1280px and 390px. For each area a skeptic re-checked every finding, a fixer fixed the confirmed ones, and a last pass fixed the leftovers and re-verified everything against a local build.

## Summary

| | Count |
|---|---|
| Scenarios run | **262** |
| Passed on first run | 243 |
| Failed on first run | 17 (16 now **fixed**, 1 still open) |
| Blocked | 2 (the test state can't be created through the UI) |
| Defects confirmed | **21** (1 blocker, 4 major, 11 minor, 5 polish) |
| Defects fixed | **20** |
| Still open | **1**: shell F1 (major), which needs a check on production after the redeploy |
| Findings rejected | 0 (two severities changed, see below) |

| Area | Scenarios | Pass | Fail → fixed | Open | Blocked | Defects |
|---|---|---|---|---|---|---|
| Shell, browse and search | 53 | 48 | 4 | 1 | 0 | 6 |
| Product, reviews and lists | 43 | 39 | 4 | 0 | 0 | 4 |
| Cart and checkout | 44 | 43 | 0 | 0 | 1 | 1 |
| Orders and post-purchase | 45 | 41 | 3 | 0 | 1 | 3 |
| Auth and account | 63 | 60 | 3 | 0 | 0 | 4 |
| Cross-cutting | 14 | 12 | 2 | 0 | 0 | 3 |

**Final checks** (local, after every fix): see [Verification](#verification).

## Confirmed defects

Severity is the skeptic's verdict. "Finish" means the final QA pass, committed with this report.

| ID | Severity | What was wrong | Fix | Regression check | Status |
|---|---|---|---|---|---|
| CC-1 | **blocker** (raised from major) | A tab, newline or CR in `return_to` (`/%09/example.com`) got past `safeReturnTo`. Browsers drop the tab, so after sign-in the shopper was sent to another site (open redirect). The newline version made sign-in fail with a 500. | `safeReturnTo` in `lib/auth.ts` parses the value the way a browser does against a fixed origin, and keeps only same-origin paths. Every caller goes through it. (516c4d7) | `e2e/account.mjs`: signed-in `return_to` with a tab, two tabs, CR, `/\` or `//` redirects to `/`; signed out, a newline gives a hidden `return_to` of `/` and sign-in lands on `/` | fixed |
| AUTH-01 | major | Same root cause as CC-1, found by the auth tester. | Same fix. (516c4d7) | Same checks | fixed |
| AUTH-03 | minor | Same root cause: a newline or CR in `return_to` gave a 500 on sign-in. | Same fix. (516c4d7) | Same checks | fixed |
| AUTH-02 | major | On the create-account step, "Your name" was pre-filled with the email just typed. Submitting without touching it saved the email as the shopper's name. | `components/auth-form.tsx`: the email and name fields have their own `key`s, so React no longer reuses the email input as the name input. (516c4d7) | `e2e/account.mjs`: "Your name" starts empty | fixed |
| AUTH-04 | polish | The demo button kept showing the old "Please wait a minute" error while a retry was already running. | `components/demo-button.tsx` hides the error while a retry is pending. (516c4d7) | `e2e/demo.mjs` | fixed |
| Shell F1 | major | Signed out, clicking "Returns & Orders" in the header sometimes showed "Sorry! Something went wrong loading your orders." instead of going to sign-in (React error #482, an endless suspend). It only happened on production, 4/4 for the skeptic, and never locally. | Likely fixed by c25c3da, not yet confirmed. The sign-in check used to live in the `orders/(list)` layout, above a `loading.tsx`, so the header link's prefetch rendered that redirect and raced the real navigation. Both files are gone: the check now runs in the page, so the prefetch no longer carries a redirect. In this pass the old production build didn't reproduce it either (0/2), so it is intermittent. | `.qa/final/shell-browse-search/verify/f1-orders-signed-out-crash.mjs` (local only) | **open**: run the repro on production after the redeploy |
| Shell F2 | minor | Choosing Sign Out in the All drawer signed the shopper out but left the drawer open over the home page. | `components/nav-drawer.tsx` closes the drawer when the Sign Out form submits. (2efd04e) | `e2e/home.mjs` | fixed |
| Shell F3 | minor | An Account & Lists menu opened from the keyboard stayed open, with the page dimmed, after Sign Out. | The menu closes when a link or Sign Out is chosen. (2efd04e) | `e2e/home.mjs` | fixed |
| Shell F4 | minor | Cars and motorcycles ($3k–$37k) and the Automotive department were still live, against the product map's P0 removal. | `lib/catalog.ts` keeps only named categories: 184 products, 7 departments. /bestsellers/automotive returns 404. (2efd04e) Finish: `lib/catalog.check.ts` expects 184; README and build guide say 184. | `e2e/home.mjs`, `e2e/search.mjs`, `lib/catalog.check.ts` | fixed |
| Shell F5 | polish | The tag said "Limited time deal" and the hero said "108 limited time deals", although nothing expires. | The label is "Deal" and the hero says "104 deals across every department". (2efd04e) | `e2e/home.mjs` | fixed |
| Shell F6 | minor | Out-of-stock items carried the deal tag and showed up under the Today's Deals filter. | A new `isDeal` rule (at least 10% off and in stock) drives the card tag, the search filter and Today's Deals (2efd04e). Finish: the product page tag uses it too. | `e2e/search.mjs` | fixed |
| PDP F1 | major | At 1280x800 the Add to List menu slid under the sticky "On this page" bar. A mouse click on a second list closed the menu without saving. | The sticky buy box gets `lg:z-30`, above the bar. (da8324e) | `e2e/pdp.mjs`: no list row is covered, and a mouse click saves | fixed |
| PDP F2 | minor | When a stale second tab added more than fit under the 30 cap, the sheet said "Qty: 8" although only 3 went in. | da8324e measured the cart just before the add. Finish: `addToCart` returns `added` from the same SQL statement that clamps the quantity, so two adds at once can't miscount it either. The extra `addFromBuyBox` action is deleted. | `e2e/pdp.mjs`: a stale tab shows "Qty: 3" and "Only 3 added" | fixed |
| PDP F3 | minor | On phones, Add to Cart, Buy Now and the sheet buttons were 36px tall, below the 44px touch target. | Finish: `.btn-lg` is 44px under `md` in `app/globals.css` (product-map §6.5), for every large button on the site. The per-button classes are removed. | `e2e/pdp.mjs`: buy box and sheet buttons are at least 44px at 390px | fixed |
| PDP F4 | minor | The product page tag said "Limited time deal". | "Deal" (da8324e), and the same label everywhere else (2efd04e). | `e2e/pdp.mjs`, `e2e/home.mjs` | fixed |
| Checkout F1 | minor | README promised "a delivery-speed choice for each shipment". Checkout has one choice for the whole order, which is what the product map specifies. | Finish: README says "a delivery-speed choice for the order". | `e2e/checkout.mjs` pins one choice for a two-shipment order (5eac8a9); the verify script compares README and page | fixed |
| Orders F1 | minor | Signed out, `/orders?tab=…`, `?range=`, `?q=` and return-code links lost their query in `return_to`, so sign-in landed on the plain orders list. | The gate moved from the `(list)` layout (which can't read the query) into the page. The new `pathWithQuery` keeps the query, and the return page uses it too. (c25c3da) | `e2e/orders.mjs`: exact `return_to` values, and sign-up lands on `/orders?tab=cancelled` | fixed |
| Orders F2 | polish (lowered from minor) | The return page of an undelivered, partly cancelled order said "This item was cancelled." instead of "Returns open once your order is delivered." | The refusal reason comes from an item still on the order. (c25c3da) | `e2e/orders.mjs` | fixed |
| Orders F3 | polish | The return-window chip stayed green at exactly 7 days left; the spec says amber at 7 or fewer. | `daysLeft <= 7`. (c25c3da) | `e2e/orders.mjs`: the chip is rgb(196, 85, 0) | fixed |
| CC-2 | minor | The "Best Seller" badge was white on #e67a00, a 2.93:1 contrast ratio, which fails WCAG AA. | Finish: #c45500, as product-map §4.2 specifies (passes AA). | `e2e/search.mjs`: badge background is rgb(196, 85, 0) | fixed |
| CC-3 | polish | Two inline links, "cart" in the green "N in your cart" line and "Edit" on your own review, could only be told apart from the text around them by colour (1.03:1 and 1.25:1). | Finish: both links are underlined. | `e2e/pdp.mjs`: both have `text-decoration: underline` | fixed |

**Rejected or changed findings**
- None rejected.
- CC-1 was raised from major to blocker: an open redirect right after password entry on an Amazon look-alike.
- Orders F2 was lowered from minor to polish: nothing in the UI links to that page in that state.
- The CC-1 skeptic didn't see the 500 on `/ap/signin` GET that AUTH-03 describes; the 500 was on the sign-in POST. Both are covered by the same fix.

## Scenarios by area

Result is the status after fixes. "fixed" means it failed on the first run and passes now.

### Shell, browse and search

| Scenario | Viewport | Result |
|---|---|---|
| Logo goes home | both | pass |
| Skip link is the first Tab stop and moves focus to main | both | pass |
| Deliver to (signed out): ZIP dialog, invalid ZIPs, valid ZIP in place and after reload | both | pass |
| Deliver to (signed in with a default address) shows name and city | both | pass |
| Search suggestions match typing; arrows, Enter, Escape | both | pass |
| Clicking a suggestion term or product row navigates | both | pass |
| Department scope select narrows results | desktop | pass |
| Empty search with All does nothing | both | pass |
| 300-char query, %, `<script>`, emoji handled safely | both | pass |
| Account & Lists flyout: hover, keyboard, links, Escape | desktop | pass |
| Returns & Orders signed out goes to sign-in and back to /orders | desktop | **open** (F1) |
| Cart count updates after add, remove and quantity change | desktop | pass |
| All drawer: opens, focus inside, Escape/backdrop close and return focus | both | pass |
| All drawer: departments expand and every link resolves | both | pass |
| All drawer: Sign in and Sign Out entries | desktop | fixed (F2) |
| Every sub-nav and footer link returns 200; Back to top | both | pass |
| Home hero: auto-advance, pause/play, arrows, dots, keyboard | desktop | pass |
| Home hero respects prefers-reduced-motion | desktop | pass |
| Home: every card and tile link works | desktop | pass |
| Home: carousel arrows scroll | desktop | pass |
| Home: images load, including below the fold | both | pass |
| Home signed in: "Pick up where you left off" and "Inspired by your browsing history" | both | pass |
| Home signed-out bottom block links | desktop | pass |
| Search: keywords, department scope, category scope | desktop | pass |
| Search: multiple brand filters (OR) | desktop | pass |
| Search: min/max price incl. min>max, negative and text | desktop | pass |
| Search: each rating "& Up" | desktop | pass |
| Search: deals filter and Include Out of Stock | desktop | pass |
| Search: every sort orders results numerically | desktop | pass |
| Search: pagination (next, previous, direct, last, out of range) | desktop | pass |
| Search: result and facet counts agree with the grid | desktop | pass |
| Search: removing each chip and Clear all | desktop | pass |
| Search: spelling correction with "Search instead for" | desktop | pass |
| Search: zero results with filters, removal suggestions and counts | desktop | pass |
| Search: related searches | desktop | pass |
| Search: add to cart from results | desktop | pass |
| Search: browser Back/Forward restore results | desktop | pass |
| Search: mobile filter drawer | mobile | pass |
| Deals: department chips | desktop | pass |
| Deals: discount filters | desktop | pass |
| Deals: sort | desktop | pass |
| Deals: Show more deals | desktop | pass |
| Deals: empty-filter state and its reset | desktop | pass |
| Deals: add to cart | desktop | pass |
| Best Sellers: overview, department, category, rank order | desktop | pass |
| Best Sellers: invalid slug returns a real 404 | desktop | pass |
| 404s: /nope, /s/extra, /dp/abc render the store 404 | desktop | pass |
| robots.txt disallows all; pages carry noindex | desktop | pass |
| 390px: no horizontal overflow on every page in the area | mobile | pass |
| 390px: header, search and drawer usable | mobile | pass |
| Account & Lists flyout after Sign Out from the keyboard | desktop | fixed (F3) |
| Automotive department still live | both | fixed (F4) |
| Deal label copy and out-of-stock deal tag | both | fixed (F5, F6) |

### Product, reviews and lists

| Scenario | Viewport | Result |
|---|---|---|
| In stock, not low: In Stock, Add to Cart, Buy Now, price | both | pass |
| Low stock "Only N left in stock - order soon." | both | pass |
| Out of stock: "Currently unavailable.", no buy controls, Add to List kept | both | pass |
| Discounted: -% with List Price | desktop | pass |
| Not discounted: no -% and no List Price | desktop | pass |
| Under $35: delivery fee plus free-delivery note | desktop | pass |
| Over $35: FREE delivery | desktop | pass |
| Long titles wrap cleanly | both | pass |
| Gallery: thumbnail click/hover switches the image | desktop | pass |
| Gallery: hover zoom lens and pane | desktop | pass |
| Full-screen viewer: arrows, buttons, thumbnails, zoom, Escape | desktop | pass |
| Mobile gallery: swipe, dots, tap opens viewer | mobile | pass |
| Breadcrumbs go to the category and department | desktop | pass |
| "Visit the Brand Store" filters search by brand | desktop | pass |
| Ratings link scrolls to #reviews | desktop | pass |
| Quantity select tops out at min(stock, 30) | desktop | pass |
| Add to Cart sheet: item, qty, count, subtotal, free-shipping line, focus return | desktop | pass |
| Cap message in a single tab, and a fresh page after Back | desktop | pass |
| Cap message when a stale second tab adds more than fits | desktop | fixed (F2) |
| Sheet "Proceed to checkout" and "Go to Cart" | both | pass |
| Buy Now signed out: sign-in, then checkout for only that item | desktop | pass |
| Buy Now signed in: only that item; cart untouched after ordering | desktop | pass |
| Delivery date, fastest delivery and countdown match cards | desktop | pass |
| Frequently bought together: totals, labels, adds only checked | desktop | pass |
| Related carousels, product information tables, description | desktop | pass |
| Histogram rows sum to 100% and filter reviews | both | pass |
| /product-reviews: Top reviews and Most recent order | desktop | pass |
| /product-reviews: star, positive/critical, verified, keyword filters | both | pass |
| Write review signed out goes to sign-in and back | desktop | pass |
| /review/create validation | both | pass |
| Submit review, escaped body, edit keeps one review | desktop | pass |
| Verified Purchase appears after an order, gone after cancelling | desktop | pass |
| Helpful counts once per user; own review has no buttons | desktop | pass |
| Report persists | desktop | pass |
| Invalid ids return 404 | both | pass |
| Add to List signed out: sign-in and back | desktop | pass |
| Add to List signed in: default list, duplicate, OOS item | desktop | pass |
| Add to List: pick another list, create, name errors | desktop | fixed (F1) |
| Add to List menu at 390px | mobile | pass |
| Browsing history order, home card, PDP strip, signed-out redirect | desktop | pass |
| 390px layout on product, reviews, lists and history pages | mobile | pass |
| Mobile touch target size for buy box and sheet buttons | mobile | fixed (F3) |
| Deal tag copy on the product page | both | fixed (F4) |

### Cart and checkout

| Scenario | Viewport | Result |
|---|---|---|
| Guest adds several products (including PDP quantity) | desktop | pass |
| Stepper + increases quantity, subtotal and header count | desktop | pass |
| Stepper − decreases quantity | desktop | pass |
| Trash icon at quantity 1 removes; toast Undo restores | desktop | pass |
| + disabled at the stock maximum with its hint | desktop | pass |
| Quantity select top values (PDP, 30 in cart, checkout) | desktop | pass |
| Delete link removes the line | desktop | pass |
| Save for later, then Move to cart | desktop | pass |
| Delete from Saved for later | desktop | pass |
| Subtotal and item count match the lines | both | pass |
| Free-shipping text just under and exactly at $35 | desktop | pass |
| Free-shipping text at $34.99 and $35.78 | desktop | pass |
| Cart survives a reload and a new tab | desktop | pass |
| Empty cart, guest | both | pass |
| Empty cart, signed in (new, and only saved items) | desktop | pass |
| Guest cart merge on sign-in: quantities add, capped; saved stays saved | desktop | pass |
| Guest cookie deleted after merge | desktop | pass |
| Proceed to checkout signed out → sign-in → back on /checkout | desktop | pass |
| Signed-out /checkout and /checkout?buy= go to sign-in with return_to | desktop | pass |
| Tampered add-to-cart with an out-of-stock id is refused | desktop | pass |
| Checkout excludes an out-of-stock cart line with a notice | desktop | blocked |
| Cart at 390px: subtotal first, no overflow | mobile | pass |
| First-time checkout with no address and no card | both | pass |
| Address validation, each rule | desktop | pass |
| Several addresses, default checkbox, Change | desktop | pass |
| Card rejections (Luhn, non-test, expired, CVV) | desktop | pass |
| "Use test card" fills the form | both | pass |
| 4000 0000 0000 0002 is declined with the right message | desktop | pass |
| Saved cards listed as "ending in" | desktop | pass |
| Order summary math, Standard under $35 | desktop | pass |
| Delivery speed changes shipping, total and dates (README wording, F1: fixed) | desktop | pass |
| Place your order (double click) → thank-you matches checkout | desktop | pass |
| Double click created exactly one order | desktop | pass |
| Only purchased lines removed; saved for later stays | desktop | pass |
| Back after placing doesn't place another order | desktop | pass |
| Reloading the thank-you page works | desktop | pass |
| Another user opening the thank-you URL gets a 404 | desktop | pass |
| Buy now: only that item; cart unchanged | desktop | pass |
| Buy now: quantity above stock or 30 is clamped with a notice | desktop | pass |
| Buy now: invalid or unavailable id shows the message | desktop | pass |
| Cart changed in another tab → "Some items in your order have changed" | desktop | pass |
| Mobile 390: buy-now checkout, sticky Place your order, order placed | mobile | pass |
| Mobile 390: first-time guided checkout then place | mobile | pass |
| Console errors and failed responses | both | pass |

### Orders and post-purchase

| Scenario | Viewport | Result |
|---|---|---|
| Setup: demo account creates an order in every state | desktop | pass |
| Setup: second account places 4 orders through checkout | desktop | pass |
| Orders tab: all orders, newest first | desktop | pass |
| Buy Again tab excludes cancelled-only items | desktop | pass |
| Not Yet Shipped tab | desktop | pass |
| Cancelled Orders tab | desktop | pass |
| Time filter changes the set and the count line | desktop | pass |
| Search all orders: title, order number, no match | desktop | pass |
| Order cards: headline and allowed actions per state | desktop | pass |
| "Return or replace items" hidden after the window closes | desktop | blocked |
| Card totals and quantities match order details | desktop | pass |
| Order details equal the thank-you page | desktop | pass |
| Invoice view | desktop | pass |
| Demo: mark as delivered unlocks return and review | both | pass |
| Tracking steps and timestamps match status | both | pass |
| Unknown order id gives a 404 | desktop | pass |
| Cancel: partial then full, totals update | both | pass |
| Shipped orders can't be cancelled by URL | desktop | pass |
| A cancel form opened before shipping is refused server side | desktop | pass |
| Rewritten cancel request is refused | desktop | pass |
| Free replacement order can't be cancelled | desktop | pass |
| Return URL refused for shipped, out-for-delivery, cancelled | desktop | pass |
| Return URL for an undelivered, partly cancelled order gives the right reason | desktop | fixed (F2) |
| Return: reason required and comment validation | both | pass |
| Return method options with their fees | both | pass |
| Refund summary math | both | pass |
| Return confirmation with return-by date and code | both | pass |
| Return started shows on the order; a second return is blocked | desktop | pass |
| Replacement flow | desktop | pass |
| Demo: receive returned item issues the refund | desktop | pass |
| Double-clicked Confirm your return creates one return | desktop | pass |
| Rewritten return request is refused | desktop | pass |
| Return-window chip turns amber at 7 days left | desktop | fixed (F3) |
| Buy it again adds to the cart | both | pass |
| Review link opens /review/create/<productId> | desktop | pass |
| Access control: another account gets 404 on every order URL | desktop | pass |
| Access control: server actions with another account's order change nothing | desktop | pass |
| Signed out: order routes redirect to sign-in and come back | desktop | pass |
| Signed out: tab, filter, search and return-code queries kept in return_to | desktop | fixed (F1) |
| Mobile 390: orders list, tabs, filters, search | mobile | pass |
| Mobile 390: details, track, invoice, return code page | mobile | pass |
| Mobile 390: cancel usable | mobile | pass |
| Mobile 390: return with sticky refund bar | mobile | pass |
| Order thumbnails load | both | pass |
| Console errors and failed responses | both | pass |

### Auth and account

| Scenario | Viewport | Result |
|---|---|---|
| Empty email shows "Enter your email address." | both | pass |
| Invalid email formats show "Invalid email address." | desktop | pass |
| Uppercase, padded existing email signs in | desktop | pass |
| Unknown email goes to Create account, return_to kept | desktop | pass |
| Create step: "Your name" starts empty | both | fixed (AUTH-02) |
| Create: missing name shows "Enter your name." | desktop | pass |
| Create: password under 6 characters | desktop | pass |
| Create: mismatched passwords | desktop | pass |
| Create: success greets the shopper and lands on return_to | desktop | pass |
| "Already a customer? Sign in" keeps email and return_to | desktop | pass |
| Password step: empty, wrong, then success | both | pass |
| "Change" returns to the email step | desktop | pass |
| Show/Hide password toggle | desktop | pass |
| return_to=/checkout with guest cart merged | desktop | pass |
| return_to=product page (Add to List, header, mobile) | both | pass |
| /ap/register with return_to | desktop | pass |
| /ap/register with an existing email | desktop | pass |
| Open redirect: //evil.com | desktop | pass |
| Open redirect: /\evil.com | desktop | pass |
| Open redirect: https://evil.com | desktop | pass |
| Open redirect: javascript:alert(1) | desktop | pass |
| Open redirect: tab in return_to | desktop | fixed (AUTH-01) |
| Open redirect: newline or CR in return_to | desktop | fixed (AUTH-03) |
| Open redirect: ///evil.com and other variants | desktop | pass |
| Signed-in visits to /ap/signin redirect away | desktop | pass |
| Signed-in visit to /ap/register redirects away | desktop | pass |
| Sign out from the Account & Lists flyout | desktop | pass |
| Sign out from the mobile drawer | mobile | pass |
| Session persists across reload and a new tab | desktop | pass |
| Forgot password pages, no dead end | desktop | pass |
| Session cookie flags; copied cookie rejected after sign-out | desktop | pass |
| Demo: creates the shopper with every order state | desktop | pass |
| Demo shopper has address, card, list and history | desktop | pass |
| Demo: second press within a minute shows the wait message | mobile | pass |
| Demo: works again after 65 seconds (stale error, AUTH-04: fixed) | mobile | pass |
| /account: every card link works | desktop | pass |
| /account Sign Out | desktop | pass |
| Login & security: edit name | desktop | pass |
| Change email: validation | desktop | pass |
| Change email: success signs other sessions out | desktop | pass |
| Change password: validation | desktop | pass |
| Change password: success signs other sessions out | desktop | pass |
| Sign out everywhere | desktop | pass |
| Addresses: add with each validation | both | pass |
| Addresses: edit | both | pass |
| Addresses: set default updates header "Deliver to" | desktop | pass |
| Addresses: remove with confirmation | desktop | pass |
| Addresses: removing the default promotes the newest | desktop | pass |
| Addresses: bogus id returns 404 | desktop | pass |
| Addresses: another user's address id returns 404 | desktop | pass |
| Payments: add card with validation, duplicate refused | both | pass |
| Payments: set default | desktop | pass |
| Payments: remove the default promotes the newest | desktop | pass |
| Payments: empty state | desktop | pass |
| Lists: create dialog, name errors | both | pass |
| Lists: rename, delete, default list protected | desktop | pass |
| Lists: move item, Add to Cart from list | both | pass |
| Lists: delete item with Undo | desktop | pass |
| Lists: another user's or malformed id returns 404 | desktop | pass |
| History: newest first, remove one, Remove all | desktop | pass |
| History: pause and resume | desktop | pass |
| History: signed out goes to sign-in and back | desktop | pass |
| Mobile 390: every auth and account page and dialog | mobile | pass |

### Cross-cutting

| Scenario | Viewport | Result |
|---|---|---|
| IDOR by URL: 20 id-bearing routes as another user | desktop | pass |
| IDOR by tampered Server Action forms | desktop | pass |
| Price and quantity tampering; totals recomputed on the server | desktop | pass |
| Stored and reflected XSS in every text input and search | desktop | pass |
| Session cookie flags, sign-out invalidation, cookie replay | desktop | pass |
| robots.txt disallows all; noindex on every page type | desktop | pass |
| return_to open redirect via a tab character | both | fixed (CC-1) |
| No horizontal overflow on 38 routes at 390 and 1280 | both | pass |
| No console errors or unexpected failed requests | both | pass |
| No broken images | both | pass |
| axe-core serious/critical audit on 11 pages | desktop | fixed (CC-2, CC-3) |
| Keyboard-only: search → product → cart → checkout → order | desktop | pass |
| Performance: server response and first image | desktop | pass |
| Test-account setup through the UI | desktop | pass |

## Known limitations still open

- **Shell F1 (major), not yet confirmed fixed.** It never reproduced locally, and in this pass it didn't reproduce on the old production build (0/2), so it is intermittent. After the redeploy, run `f1-orders-signed-out-crash.mjs` against production. If it still fails: add `prefetch={false}` to the sign-in-only links in the header, footer and drawer, so no prefetch races the redirect.
- **Blocked scenarios:** an out-of-stock line at checkout, and a return window that has closed. The UI can't create either state; code review covers both paths.
- **Not filed, for the owner to decide:**
  - Product-map §0 lists raising the minimum password length from 6 to 8 as a P0 change. The site still enforces 6.
  - §2.13 calls the review body optional, but the form requires it.
  - Visiting /lists creates the default list, so the "no lists" state can't be reached.
  - On phones the added-to-cart sheet opens from the side, not the bottom (§2.11).
  - An unknown department (`/s?i=automotive`, `?i=constructor`) is ignored and every department shows.
- **QA data on production:** accounts named `qa-*@example.com`, plus their orders, lists and carts. There is also a reported review on product 79.

## Verification

Final local run, 2026-09-14, against http://localhost:3000 with every fix in place:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean |
| `npx tsx` on `lib/catalog.check.ts`, `lib/payments.check.ts`, `lib/delivery.check.ts`, `components/search/search.check.ts` | all pass |
| e2e: smoke, search, home, links, carousel, suggest, pdp, checkout, orders, account, demo | **all 11 pass** |
| `DATABASE_URL=postgres://dummy npx next build` | succeeds |
| `db/schema.sql` | Every table the code queries exists. Every statement is `if not exists`, with no duplicates. Nothing new was needed in this pass. |
| All 21 verify repro scripts, run locally in this pass | 20 pass: CC-1 to CC-3, AUTH-01 to AUTH-04, PDP F1 to F4, Shell F2 to F6, Checkout F1, Orders F1 to F3. Shell F1 also passes locally, but it never reproduced locally in the first place. |

While the Orders F2 repro ran, the dev server logged a React hydration-mismatch warning, as it did for the orders fixer. That fixer's dedicated rerun found no console errors on those pages, and no e2e run shows it, so it looks like a dev-only one-off.

The Shell F4 repro used to count any card on `/s?i=automotive`. An unknown department is ignored and shows every department, so it now fails only if an "Automotive" scope still exists. Its vehicle searches ("motorcycle", "durango") are unchanged.

## How to re-run

With the app running (`npm run dev`, http://localhost:3000):

```sh
npx tsc --noEmit && npx eslint .
for f in lib/catalog.check.ts lib/payments.check.ts lib/delivery.check.ts components/search/search.check.ts; do npx tsx $f; done
for e in smoke search home links carousel suggest pdp checkout orders account demo; do node e2e/$e.mjs http://localhost:3000 || break; done
DATABASE_URL=postgres://dummy npx next build
```

Every e2e script also takes a production URL: `node e2e/<name>.mjs https://amazon-rebuild-teal.vercel.app`. `demo.mjs` waits a minute if another demo account was created from your network in the last minute.

The testers' and skeptics' scripts, logs and screenshots are in `.qa/final/<area>/`, with the per-finding repro scripts in `.qa/final/<area>/verify/`. That folder is gitignored, so it exists only on the machine that ran QA. Each repro takes a base URL and exits 0 once its defect is gone: `node .qa/final/cross-cutting/verify/cc1-open-redirect.mjs https://amazon-rebuild-teal.vercel.app`.

---

## Live QA, 25 September 2026 — after the ten new features

Scope: the deployed site (https://amazon-rebuild-teal.vercel.app), not a local build. Four passes ran against it: the 20 end-to-end scripts, two exploratory testers (browse-and-decide, money-and-orders), and a hand pass in a real Chrome with the Claude in Chrome extension. Production data was checked directly: of 170 orders, **none** had a stored total that disagreed with items + shipping + tax + duty − credit, and the server logs had no 5xx.

| ID | Severity | Found | Fix |
|---|---|---|---|
| L-1 | **major** | Price protection refunded the fall in price only, keeping the tax (US) or import duty (PK) that had been charged on it — while cancels and returns hand those back. On a PKR order, ≈PKR 97 of duty stayed with us. | `sharesOn()` in `lib/orders.ts` is now the one rule for what rides on top of goods; cancels, returns and price protection all use it. Asserts in `lib/region.check.ts`, and `e2e/price-lock.mjs` checks the refund equals the fall plus its tax. |
| L-2 | **major** | The cash-on-delivery advance was only ever a percentage before you committed ("we ask for 30% up front"); the amount appeared after the order was placed. | Checkout states the money: "$7.14 (30%) now … $16.67 in cash on delivery", in the cash option, the payment summary and the blocker. `e2e/cod.mjs` asserts advance + cash equals the order total. |
| L-3 | **major** | A price lock, a demo drop or a filled group buy only changed the price on the product page, cart and checkout. Search results, home rows, Today's Deals, Best Sellers, Compare, Quick look and the recently-viewed rail all showed the shelf price. | `myPrice`/`myPrices` (`lib/price-lock.ts`, request-cached) applied in `ProductCard`, `ProductCarousel`, `DealCard`, `RankTile`, the compare table and the Quick look action, so one price follows the shopper everywhere. |
| L-4 | minor | "See more reviews" dropped the digest's aspect and verified filters, so a capped aspect ("9 reviews", 8 shown) landed on the unfiltered list — breaking the digest's promise that every number clicks through to its reviews. | The link carries `mentions` and `reviewerType` through to the full reviews page. |
| L-5 | minor | After a client-side search the browser tab kept the previous page's title ("nile.com : Electronics"), because a prefetched `/s` entry's metadata stayed in place. The page body was always correct. | `components/search/title.tsx` sets `document.title` from the resolved query. |
| L-6 | polish | Data saver missed nine pictures: two product-page thumbnails, Frequently bought together, the added-to-cart sheet and every Best Sellers tile. | All now go through the image optimiser when the cookie is set. |
| L-7 | polish | Compare listed the catalog's unitless demo weight and dimensions ("4" for a mascara), implying they meant something. | Both rows removed; the product page leaves them out for the same reason. |

**Still open:** one "Add to Cart" click was lost immediately after a demo price drop (the cart stayed empty) in a single live run. Fifteen targeted attempts and five scripted loops could not reproduce it, so the cause is unknown and it is being watched rather than explained away. Everything else in that run was correct.

**Checked and correct** (a selection): landed cost agrees across product page, cart, checkout, invoice and email; an unfilled group buy still charges the shelf price while a filled one charges the team price; the nile-day credit comes off before tax and the column still balances; cash on delivery is placeable with no card and the invoice never claims a card was charged; double-clicking "Place your order" creates one order; the review digest's bars matched their filtered lists on 62 bars across 8 products; no sideways scroll at 390px on home, search, product, compare or department pages.

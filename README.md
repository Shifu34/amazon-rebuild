# nile: Amazon.com, rebuilt

A working rebuild of Amazon's shopping loop: search, product pages, cart, checkout, orders, returns, lists, reviews and accounts. It runs on a real database and has no ads.

- **Live:** https://amazon-rebuild-teal.vercel.app
- **Repo:** https://github.com/Shifu34/amazon-rebuild
- **Walkthrough:** _Loom link_

> nile is a portfolio rebuild of Amazon.com for the 8x assignment. It is not affiliated with Amazon. Orders, payments and deliveries are simulated, and only test card numbers are accepted.

## Try it

1. **Browse without an account.** Search, filter, open products and fill a cart as a guest. The cart follows you when you sign in.
2. **Take the fastest tour.** Go to **Sign in** and choose **Explore with a demo account**. You become a fresh sample shopper with an address, a card, a list, browsing history and orders in every state: arriving, shipped, out for delivery, delivered, return started, and cancelled.
3. **Or do it for real.** Create an account, check out with test card `4242 4242 4242 4242` (any future expiry, any CVC), then track, cancel or return from **Returns & Orders**. On an order, **Demo: mark as delivered** skips the wait so you can try returns and reviews.

## What works

| Flow | What's in it |
|---|---|
| **Home & browse** | Hero carousel, department cards, Today's Deals and Best Sellers rows, a "Pick up where you left off" card and an "Inspired by your browsing history" row once you've viewed products. A guest can set a delivery ZIP. Today's Deals has department and discount filters; Best Sellers is ranked by department and category. |
| **Search** | Header search with instant suggestions and a department scope. The results page filters by department, rating, brand, price, deals and stock. Filters show as chips with "Clear all", with sorting, pagination, spelling correction ("Showing results for…") and a filter drawer on phones. |
| **Product page** | Image gallery with zoom and full-screen view. The buy box shows the delivery date with an order-by countdown, stock messages and quantity, plus Add to Cart (with an "Added to cart" sheet), Buy Now and Add to List. Below: frequently bought together, related products, reviews with a rating histogram and filters, a full reviews page, and writing a review with "Verified Purchase". |
| **Cart** | Guest cart that merges on sign-in, quantity stepper, save for later, free-shipping progress, and an empty state for guests and for signed-in shoppers. |
| **Checkout** | Sign-in gate that returns you to checkout, address book with validation, saved cards (test cards only), a delivery-speed choice for each shipment, and an order summary with tax. "Place your order" is safe to double-click. Ends on a thank-you page. |
| **Orders** | Tabs (Orders, Buy Again, Not Yet Shipped, Cancelled), a date filter, order search, order details with an invoice, a tracking timeline, cancel before shipping, returns and replacements with a refund summary, and Buy it again. |
| **Account** | Amazon's email-first "Sign in or create account" flow. Your Account hub; Login & Security (name, email, password); addresses; payments wallet; lists (create, rename, move, add to cart); browsing history (remove, clear, pause). |

## Product judgement

### Built first, and why

1. **The core loop, end to end, before breadth.** Find → decide → buy → track or return is what Amazon *is*, so every step of it had to work before anything else got attention.
2. **Guest shopping and email-first sign-in.** Amazon lets you fill a cart before you have an account. Making you sign up first would change the product.
3. **Post-purchase: tracking, cancel, returns.** Clones usually stop at checkout, but this is where Amazon earns trust. The demo account and the "mark as delivered" control exist so a reviewer can see these flows in a minute.
4. **Fidelity to the real site.** Every surface was reviewed at desktop and phone widths against screenshots from a live amazon.com session, then fixed.

### Left out on purpose

- **Prime, Video, Music, Kindle, Alexa, Amazon Business, the seller marketplace:** each is a separate product from shopping.
- **Ads and sponsored placements:** noise for the shopper. Leaving them out is a better-than-Amazon choice.
- **Real payments, email and SMS, OTP, 2FA, passkeys:** these need outside services. Payments are simulated and accept test cards only, so nobody types a real card into a demo.
- **Product variants, coupons, lightning-deal countdowns:** the catalog has no such data, and fake urgency is worse than none.
- **Also out:** customer service chat, registries, gift cards, Subscribe & Save, the AI shopping assistant and review summaries, per-state tax and ZIP-based delivery.

### Better than Amazon

- No ads or sponsored rows.
- Filter chips with "Clear all" and exact result counts.
- One delivery promise used by product cards, the product page, cart and checkout, so an item never shows two different dates.
- Double-click-safe orders.
- Undo on deletes.
- A hero that respects reduced motion.
- Keyboard-operable menus and a skip link.
- Test-card-only payments.
- Demo controls that fast-forward an order.

## How it's built

- **App:** Next.js 16 App Router (Server Components and Server Actions), React 19, Tailwind 4, TypeScript. No ORM, no UI kit, no auth library.
- **Catalog:** 194 products from [DummyJSON](https://dummyjson.com), held in memory. Search, facets and sorting run in-process, which at this size beats a database round trip. Amazon-style signals ("bought in past month", Best Seller badges) are derived deterministically.
- **Data:** Postgres. Production uses Neon through the Vercel Marketplace. Locally the app uses an embedded PGlite database, so `npm run dev` needs no setup. Money is stored in integer cents. Writes that must be atomic, like placing an order or merging a guest cart, are single SQL statements with CTEs, because Neon's HTTP driver has no interactive transactions.
- **Auth:** scrypt password hashes, random session tokens stored hashed, httpOnly cookies, and same-site-only `return_to` redirects.
- **Tests:** a headless Chrome end-to-end script per flow in `e2e/` (smoke, search, home, pdp, checkout, orders, account, links, demo), plus assert-based checks for the catalog, delivery dates and payments.

## How it was built

This was built with Claude Code (Opus 5). Every prompt and final response is captured into [`.agent-logs/`](.agent-logs) by hooks; setup and proof are in [`CAPTURE-TEST.md`](CAPTURE-TEST.md).

1. **Research.** Seven parallel research agents and a completeness critic mapped amazon.com surface by surface: [`docs/recon/research-*.json`](docs/recon), synthesized into [`docs/product-map.md`](docs/product-map.md).
2. **Browser pass.** I walked the real amazon.com in Chrome, signed out and signed in, taking screenshots: [`docs/recon/browser-pass.md`](docs/recon/browser-pass.md) and [`docs/recon/screenshots/`](docs/recon/screenshots). Signed-in screenshots stay out of the public repo because they show account details.
3. **Foundation.** Shell, catalog, database layer, auth and cart were written first, with conventions in [`docs/build-guide.md`](docs/build-guide.md).
4. **Parallel slices.** Home, search, product page and cart/checkout were built at the same time, each agent owning its own files. Orders and account followed, then an integration pass ran the production build and every end-to-end test.
5. **Polish.** A review-then-fix pass per surface compared nile with the Amazon screenshots at 1280px and 390px. It added the demo shopper and unified the delivery dates.

## Run it locally

```bash
npm install
npm run dev                  # http://localhost:3000 with an embedded Postgres in .data/
node e2e/smoke.mjs           # headless run in your installed Google Chrome
npx tsx lib/catalog.check.ts # assert-based checks
```

To use a real Postgres, set `DATABASE_URL` and run `npm run db:migrate` once.

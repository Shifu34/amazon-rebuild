# Build guide for nile (the Amazon rebuild)

Read this, `docs/product-map.md` (the spec) and `docs/next16-notes.md` (Next.js 16 APIs; trust it over memory) before writing code.

## Ground rules

- **Brand is "nile".** Copy Amazon's layout, flows and microcopy, but substitute "nile" wherever Amazon names itself. Never use Amazon's logo or name as our brand. Footer disclaimer already exists.
- **Payments are simulated.** Never store a full card number or CVV. Store brand, last 4 digits, expiry and name only. Say "demo, nothing is charged" near card entry.
- **Server Components by default.** Use `'use client'` only for interactivity (dropdowns, steppers, galleries, forms with pending/error state).
- **Every Server Action is a public endpoint.** Validate input, re-check auth with `getUser()`/`requireUser()`, check ownership in SQL (`where user_id = $1`), and never trust prices or totals from the client (always recompute from `lib/catalog`).
- After a mutation that changes visible UI, call `refresh()` (from `next/cache`), or `redirect()` to the next page. `refresh()` must come before `redirect()`.
- **Accessible and responsive:** labels on inputs, `role="alert"` or `aria-live` on errors, visible focus, keyboard-operable menus. Check at 390px wide as well as desktop.
- **Keep it lean.** No new dependencies without a strong reason. Reuse what's below before writing new helpers.

## Commands (the dev server is already running at http://localhost:3000 — do not start, stop or restart it)

| What | Command |
|---|---|
| Typecheck | `npx tsc --noEmit` (other agents edit in parallel; only fix errors in files you own, re-run if others' files are mid-edit) |
| Lint your files | `npx eslint <your files>` |
| Catalog check | `npx tsx lib/catalog.check.ts` |
| E2E | `node e2e/smoke.mjs` and your own `node e2e/<area>.mjs` (headless system Chrome via playwright-core) |
| Page check | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/<route>` |

**Never** open the local database from another process (no `tsx` scripts importing `lib/db`) while the dev server runs: PGlite is single-process. Exercise data through the app (e2e) instead.

## What already exists (reuse it)

| Path | What |
|---|---|
| `app/layout.tsx` | html/body only |
| `app/(shop)/layout.tsx` | Header + main + Footer for all store pages. Put store routes under `app/(shop)/` |
| `app/(auth)/layout.tsx`, `app/(auth)/ap/signin`, `app/(auth)/ap/register` | Minimal sign-in pages; unified email → password / create-account flow. Protected pages redirect to `/ap/signin?return_to=<path>` via `requireUser(path)` |
| `app/actions/auth.ts` | `authenticate`, `signOut` |
| `app/actions/cart.ts` | `addToCart(prev, form)` (useActionState; fields `productId`, `quantity`) → `{ ok, inCart }`; `updateQuantity(form)` (0 deletes), `removeFromCart(form)`, `setSavedForLater(form)` (`saved=true|false`). All call `refresh()` |
| `app/api/suggest/route.ts` | Search autocomplete JSON |
| `components/header.tsx` | Nav bar, deliver-to, search with suggestions (`search-bar.tsx`), account flyout, orders, cart count; sub-nav with All drawer (`nav-drawer.tsx`) |
| `components/footer.tsx`, `components/icons.tsx` | Footer; Logo (`tone="dark"` on white), Cart/Pin/Search/Menu/Close/User/Caret/Chevron icons |
| `components/price.tsx` | `<Price value={dollars} currency={currency} rate={rate} />`, the Amazon-style superscript price; size from parent font-size |
| `components/stars.tsx` | `<Stars rating={4.3} className="h-4" />` partial stars with aria-label |
| `components/product-card.tsx` | `ProductCard` (search/grid card with an action slot as children), `Badge`, `DeliveryLine` |
| `components/add-to-cart-button.tsx` | Compact add-to-cart for cards/carousels |
| `components/auth-form.tsx` | Sign-in/create-account client form (pattern for useActionState forms with field errors) |
| `lib/catalog.ts` | 184 products in memory. `products`, `getProduct(id)`, `search({q, category, brands, min, max, rating, deals, inStock, sort, page, perPage})` → `{items,total,page,pages,facets}`, `suggest`, `bestSellers(cat?, n)`, `deals(n)`, `related(p)`, `boughtTogether(p)`, `inCategory`, `DEPARTMENTS` (slug/name/categories), `CATEGORY_NAMES`, `categoryName`, `scopeName`, `SORTS`, `popularity`. Product fields: id, title, description, category, brand, price, listPrice, discount (%), rating, ratingCount, stock, tags, images[], thumbnail, warranty, shipping, returnPolicy, weight, dimensions, sku, reviews[] (rating, comment, date, reviewerName), boughtPastMonth, badge, createdAt |
| `lib/db.ts` | `query<T>(sql, params)`, `one<T>(sql, params)`. Neon (prod) or PGlite (local). No interactive transactions, so make atomic multi-row writes one statement with CTEs |
| `db/schema.sql` | Idempotent schema: users, sessions, addresses, payment_methods, cart_items (owner `u:<id>`/`g:<guest>`), orders (id text like `113-1234567-1234567`, ship_to jsonb, payment jsonb, delivery_speed, *_cents, placed_at, deliver_by, cancelled_at), order_items (price_cents, return_reason, returned_at), lists, list_items, reviews (unique user+product), browsing_history. Change it only with `create table if not exists` / `alter table ... add column if not exists` appended at the end |
| `lib/auth.ts` | `getUser()` (cached per request), `requireUser(returnTo)`, `cartOwner(create?)`, `safeReturnTo`, `startSession`, `endSession` |
| `lib/cart.ts` | `getCart()` lines `{product, quantity, savedForLater, addedAt}`, `cartCount()`, `cartSummary()` → `{lines, count, subtotalCents}`, `MAX_QTY` |
| `lib/delivery.ts` | `FREE_SHIPPING_MIN` ($35), `STANDARD_SHIPPING`, `EXPEDITED_SHIPPING`, `shipDays(p)`, `addBusinessDays`, `standardDelivery(p)`, `fastestDelivery(p)`, `relativeDay(date)` |
| `lib/format.ts` | `toCents`, `compactCount`, `plural`, `longDate`, `shortDate`, `fullDate` (UTC). Money formatting lives in `lib/region.ts` |
| `lib/region.ts`, `lib/region-server.ts` | USD/PKR and US/Pakistan: `formatMoney`, `formatDollars`, `summarize`, `COUNTRIES`, `getRegion()`. Read `docs/region.md` |
| `app/globals.css` | Tailwind 4 tokens: `bg-nav`, `bg-nav-light`, `bg-nav-lighter`, `bg-page`, `text-ink`, `text-muted`, `border-line`, `text-link`/`hover:text-link-hover`, `bg-cart`, `bg-buy`, `text-deal`/`bg-deal`, `text-star`, `text-success`, `text-danger`, `ring-focus`, `bg-brand`. Classes: `.link`, `.btn` + `.btn-cart` (yellow) / `.btn-buy` (orange) / `.btn-plain`, `.btn-lg`, `.input` (+ `aria-invalid`), `.select-pill`, `.label`, `.field-error`, `.nav-item` |

Images: plain `<img>` with `{/* eslint-disable-next-line @next/next/no-img-element */}`, `loading="lazy"` below the fold, `object-contain` + `mix-blend-multiply` on the light grey `#f7f7f7` tile.

## Definition of done for your slice

1. The routes in your spec render (200) signed out and signed in, including empty and error states.
2. `npx tsc --noEmit` shows no errors in your files and `npx eslint <your files>` is clean.
3. Your `e2e/<area>.mjs` script drives the main flow of your slice in headless Chrome and passes against http://localhost:3000.
4. Your final report lists: routes built, files touched, spec items deliberately skipped, and anything a shared file still needs.

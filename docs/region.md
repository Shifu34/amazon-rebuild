# Region: delivery country and display currency

nile delivers to the **United States (US)** and **Pakistan (PK)** and shows prices in **US dollars (USD)** or **Pakistani Rupees (PKR)**.

- **Stored money is always integer US cents.** Only convert when you display it.
- One fixed rate: `USD_TO_PKR = 277.07` (September 2026).
- The display looks like Amazon's: `$1,234.56` and `PKR 342,059.54` (code, a space, thousands separators, 2 decimals).
- Every caller that passes no region gets USD and US, so old code keeps working until it's migrated.

## Rules

**Delivery country**, first match wins:

1. The signed-in shopper's default address (or their newest address if none is marked default)
2. The `ship_country` cookie, set by the guest location dialog through `setShipCountry`
3. The guest US ZIP cookie `zip` means US
4. `x-vercel-ip-country` when it is `PK`
5. Otherwise US

**Display currency:** the `currency` cookie (set from the EN menu through `setCurrency`). With no cookie, it's the country's `defaultCurrency` (PK → PKR, US → USD).

**Shipping and tax** follow the *delivery address's* country. The display currency never affects them.

| | US | PK (international) |
|---|---|---|
| Standard | ship days + 1 business day; FREE from $35 of items, else $6.99 | ship days + 8 business days; flat $14.99, never free |
| Expedited | ceil(ship days / 2) business days; $9.99 | ceil(ship days / 2) + 4 business days; flat $29.99 |
| Tax | 8.25% of items + shipping, line "Estimated tax to be collected:" | none. Show `IMPORT_FEES_NOTE` instead of a tax line |

**Orders** save `currency` and `fxRate` at placement: the display currency at that moment, and its rate (1 for USD). **Every view of an order uses the order's own values**, whatever the current display currency is. That covers Your Orders, details, invoice, tracking, cancel, return and refund amounts, the thank-you page, and emails.

**Summaries add up in the shown currency.** Convert each component (items, shipping, the free-shipping discount, tax, refunds) and show the sum of the converted rows as the total. Use `summarize`.

## `lib/region.ts` (pure, fine in client components)

```ts
type CurrencyCode = 'USD' | 'PKR'
type CountryCode = 'US' | 'PK'
const USD_TO_PKR = 277.07
const CURRENCIES: Record<CurrencyCode, { code; label: 'US Dollar' | 'Pakistani Rupee'; prefix: '$' | 'PKR'; perUsd: number }>
const COUNTRIES: Record<CountryCode, {
  code; name: 'United States' | 'Pakistan'; defaultCurrency; regionLabel: 'State' | 'Province/Territory'
  regions: { code: string; name: string; zip?: string }[]   // US: 50 states + DC, `zip` = allowed first ZIP digits
  postalLabel: 'ZIP Code' | 'Postal Code'; flag: '🇺🇸' | '🇵🇰'
}>
const IMPORT_FEES_NOTE = 'Import fees and duties, if any, are collected by the carrier on delivery.'
isCurrencyCode(v: unknown): v is CurrencyCode
isCountryCode(v: unknown): v is CountryCode
countryCodeFromName(name: string | null | undefined): CountryCode   // 'Pakistan' | 'PK' → 'PK', anything else → 'US'
rateFor(currency): number
convertCents(usdCents, currency, rate?): number        // minor units (cents/paisa), rounded half away from zero
formatMoney(usdCents, currency = 'USD', rate?): string // "$1,234.56" | "-$6.99" | "PKR 342,059.54"
formatDollars(usd, currency = 'USD', rate?): string
moneyParts(usdCents, currency = 'USD', rate?): { prefix, whole, fraction }
summarize(parts: { label; usdCents; ...extra }[], currency = 'USD', rate?)
  → { rows: { label, usdCents, ...extra, minor, text }[], total: { usdCents, minor, text } }
fromDisplayAmount(amount, currency = 'USD'): number   // US dollars, unrounded
```

`rate` defaults to the current rate for `currency`. Pass `order.fxRate` for an order's amounts, or the request's `rate` for anything else. USD always converts 1:1, whatever `rate` you pass.

```ts
formatMoney(order.totalCents, order.currency, order.fxRate)   // an order: always its own currency and rate
formatDollars(product.price, currency, rate)                  // a catalog price in the shopper's currency

// order summary: components only, never subtotals
const { rows, total } = summarize([
  { label: `Items (${n}):`, usdCents: o.itemsCents },
  { label: 'Shipping & handling:', usdCents: o.shippingCents + freeCents },
  ...(freeCents ? [{ label: 'Free Shipping:', usdCents: -freeCents }] : []),
  ...(country === 'PK' ? [] : [{ label: 'Estimated tax to be collected:', usdCents: o.taxCents }]),
], o.currency, o.fxRate)
rows.map((r) => <Row label={r.label} value={r.text} />); <Row label="Order total:" value={total.text} />
// "Total before tax" is summarize() of just the rows before tax: its total.text

// price filter typed in PKR → dollars for search({ min, max })
search({ max: fromDisplayAmount(Number(sp.max), currency) })

// address form
const c = COUNTRIES[code]; c.regionLabel; c.postalLabel; c.regions.map((r) => <option value={r.code}>{r.name}</option>)
```

## Server: `lib/region-server.ts` and `app/actions/region.ts`

```ts
getRegion(): Promise<{ currency; country; countryName; rate; guestCountryChoice: CountryCode | null }>
```

`getRegion` is wrapped in React `cache`, so it runs once per request. It reads cookies, headers and the default address. `guestCountryChoice` is what the location dialog has picked: the `ship_country` cookie, or `'US'` when a ZIP cookie is set, otherwise `null`.

```tsx
const { currency, rate, country } = await getRegion()
<Price value={p.price} currency={currency} rate={rate} />
```

Server Actions. Both validate their input, set a 1-year cookie and call `refresh()`:

- `setCurrency(form)`: field `currency` = `USD` | `PKR`.
- `setShipCountry(form)`: field `country` = `US` | `PK`. `US` clears `ship_country`, and saves an optional 5-digit `zip` field as the `zip` cookie. When a guest enters a ZIP, send it through this action: if you only write `document.cookie`, a stale `ship_country=PK` still wins.

```tsx
<form action={setCurrency}><button name="currency" value="PKR">PKR - Pakistani Rupee</button></form>
```

## Client: `components/region-provider.tsx`

`app/(shop)/layout.tsx` and `app/(checkout)/layout.tsx` render `RegionProvider({ currency, rate, country })` from `getRegion()`.

```tsx
'use client'
const { currency, rate, country } = useRegion()   // { 'USD', 1, 'US' } outside a provider
```

## `<Price>` (`components/price.tsx`)

```tsx
<Price value={usdDollars} currency?: CurrencyCode rate?: number className? />
```

It renders a small "$" or "PKR" prefix, the whole amount and superscript decimals, plus an sr-only `formatDollars` text. It defaults to USD, and it is not a client component, so it can't read the context itself. Pass the currency and rate from `getRegion()` or `useRegion()`.

## Delivery: `lib/delivery.ts`

```ts
deliveryPromise(p, now = new Date(), country: CountryCode = 'US') → {
  country, standard, expedited, fastest, within,
  free, feeUsd /* 0 when free */, expeditedFeeUsd, freeMinUsd /* null: never free */,
  label, note  // deprecated, USD only
}
deliveryText(promise, currency = 'USD', rate?) → { label: 'FREE delivery' | 'PKR 4,153.28 delivery', note: string | null }
shippingRates(country = 'US') → { standard, expedited, freeMin: number | null }   // US dollars
PK_STANDARD_SHIPPING = 14.99, PK_EXPEDITED_SHIPPING = 29.99
```

For US the note is "FREE delivery on orders of $35 or more", or "... of PKR 9,697.45 or more" when shown in PKR. For PK it is null.

## Orders: `lib/orders.ts`

```ts
quote(lines, speed, now = new Date(), country: CountryCode = 'US') → Quote & {
  country, taxRate, taxLabel: string | null /* US */, importNote: string | null /* PK: IMPORT_FEES_NOTE */
}
taxRateFor(country = 'US'): number   // 0.0825 | 0
itemRefundCents(item, country = 'US') // PK refunds carry no tax: pass countryCodeFromName(order.shipTo.country)
createOrder({ ..., currency?: CurrencyCode, fxRate?: number })   // shipping and tax come from address.country
Order.currency: CurrencyCode; Order.fxRate: number; Order.shipTo.country: 'United States' | 'Pakistan'
```

- The database columns are `orders.currency` (text, default `'USD'`) and `orders.fx_rate` (double precision, default 1). A free replacement order copies them from the order it replaces.
- `placeOrder` passes the request's `currency` and `rate`.
- An order's country is `countryCodeFromName(order.shipTo.country)`.

## Addresses: `lib/addresses.ts`

- `validateAddress(form)` reads `country`, which is `US` or `PK` (the country name also works; anything else is treated as US). It returns `input.country` as the country name, and `saveAddress` stores that name.
- PK rules:
  - `state` must be one of `COUNTRIES.PK.regions` (PB SD KP BA IS GB JK).
  - `zip` is 5 digits ("Please enter a valid postal code.").
  - The phone is a mobile (`03XXXXXXXXX`, `3XXXXXXXXX`, `+92 3XXXXXXXXX`) or a landline (`042-XXXXXXX`: 0 or +92, then 9-10 digits). Spaces and dashes are allowed.
- US rules are unchanged.
- `formatAddress(a)` gives "12 Mall Road, Lahore, Punjab 54000" for Pakistan (the province written out) and "410 Terry Ave N, Seattle, WA 98109" for the US.

## Migration notes for adopters

- `usd`, `usdCents` and `priceParts` in `lib/format.ts` are deprecated. Replace them with `formatDollars`, `formatMoney` and `moneyParts`, passing the currency and rate.
- The checkout page still calls `quote(lines, speed, now)`, which means US rules. Pass the selected address's country, or the placed order's shipping and tax won't match what the page showed.
- Callers of `itemRefundCents(i)` still get the US tax share: `app/actions/orders.ts`, `app/actions/demo.ts`, `app/(shop)/orders/[id]/return/page.tsx` and `lib/email-templates.ts`. Pass the order's country.
- `trackingEvents` shows `City, ST` using the stored region code (`Lahore, PB`).
- The address form still offers only the United States (it sends `country=United States`). Add Pakistan with `COUNTRIES` there.

Checks: `npx tsx lib/region.check.ts`

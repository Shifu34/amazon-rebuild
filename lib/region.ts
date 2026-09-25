// Where nile sells: display currencies, delivery countries (regions, postal rules) and money formatting.
// Pure, so client components can import it. Stored money is always integer US cents; convert only when displaying.
// Server-side region of the current request: lib/region-server.ts. Guide: docs/region.md
import { toCents } from './format'

export type CurrencyCode = 'USD' | 'PKR'
export type CountryCode = 'US' | 'PK'

// ponytail: one fixed, documented rate (September 2026); a dated rates table if prices ever need live FX
export const USD_TO_PKR = 277.07

export type Currency = { code: CurrencyCode; label: string; prefix: string; perUsd: number }
export const CURRENCIES: Record<CurrencyCode, Currency> = {
  USD: { code: 'USD', label: 'US Dollar', prefix: '$', perUsd: 1 },
  PKR: { code: 'PKR', label: 'Pakistani Rupee', prefix: 'PKR', perUsd: USD_TO_PKR },
}

// `zip`: the first digit(s) a US ZIP code can start with in that state (USPS national areas), to catch a ZIP typed for
// the wrong state. ponytail: first-digit check only, a 3-digit prefix table if false accepts matter
export type Region = { code: string; name: string; zip?: string }
export type Country = {
  code: CountryCode
  name: string // what addresses.country stores
  defaultCurrency: CurrencyCode
  regionLabel: string
  regions: Region[]
  postalLabel: string
  flag: string // emoji; components/icons.tsx has SVG FlagUS and FlagPK for places where emoji flags don't render
}

export const COUNTRIES: Record<CountryCode, Country> = {
  US: {
    code: 'US',
    name: 'United States',
    defaultCurrency: 'USD',
    regionLabel: 'State',
    postalLabel: 'ZIP Code',
    flag: '🇺🇸',
    regions: [
      ['AL', 'Alabama', '3'], ['AK', 'Alaska', '9'], ['AZ', 'Arizona', '8'], ['AR', 'Arkansas', '7'], ['CA', 'California', '9'],
      ['CO', 'Colorado', '8'], ['CT', 'Connecticut', '0'], ['DE', 'Delaware', '1'], ['DC', 'District of Columbia', '2'],
      ['FL', 'Florida', '3'], ['GA', 'Georgia', '3'], ['HI', 'Hawaii', '9'], ['ID', 'Idaho', '8'], ['IL', 'Illinois', '6'],
      ['IN', 'Indiana', '4'], ['IA', 'Iowa', '5'], ['KS', 'Kansas', '6'], ['KY', 'Kentucky', '4'], ['LA', 'Louisiana', '7'],
      ['ME', 'Maine', '0'], ['MD', 'Maryland', '2'], ['MA', 'Massachusetts', '0'], ['MI', 'Michigan', '4'], ['MN', 'Minnesota', '5'],
      ['MS', 'Mississippi', '3'], ['MO', 'Missouri', '6'], ['MT', 'Montana', '5'], ['NE', 'Nebraska', '6'], ['NV', 'Nevada', '8'],
      ['NH', 'New Hampshire', '0'], ['NJ', 'New Jersey', '0'], ['NM', 'New Mexico', '8'], ['NY', 'New York', '01'],
      ['NC', 'North Carolina', '2'], ['ND', 'North Dakota', '5'], ['OH', 'Ohio', '4'], ['OK', 'Oklahoma', '7'], ['OR', 'Oregon', '9'],
      ['PA', 'Pennsylvania', '1'], ['RI', 'Rhode Island', '0'], ['SC', 'South Carolina', '2'], ['SD', 'South Dakota', '5'],
      ['TN', 'Tennessee', '3'], ['TX', 'Texas', '78'], ['UT', 'Utah', '8'], ['VT', 'Vermont', '0'], ['VA', 'Virginia', '2'],
      ['WA', 'Washington', '9'], ['WV', 'West Virginia', '2'], ['WI', 'Wisconsin', '5'], ['WY', 'Wyoming', '8'],
    ].map(([code, name, zip]) => ({ code, name, zip })),
  },
  PK: {
    code: 'PK',
    name: 'Pakistan',
    defaultCurrency: 'PKR',
    regionLabel: 'Province/Territory',
    postalLabel: 'Postal Code',
    flag: '🇵🇰',
    // ISO 3166-2:PK codes, stored in the 2-character state column
    regions: [
      { code: 'PB', name: 'Punjab' },
      { code: 'SD', name: 'Sindh' },
      { code: 'KP', name: 'Khyber Pakhtunkhwa' },
      { code: 'BA', name: 'Balochistan' },
      { code: 'IS', name: 'Islamabad Capital Territory' },
      { code: 'GB', name: 'Gilgit-Baltistan' },
      { code: 'JK', name: 'Azad Jammu and Kashmir' },
    ],
  },
}

// International orders are landed-cost priced: the duty estimate is charged with the order, so nothing is collected at the
// door. Amazon quotes an Import Fees Deposit deep in checkout; we show the whole "to your door" price from the buy box on.
export const IMPORT_FEES_NOTE = 'Import duty is estimated and included, so the courier collects nothing on delivery.'

// Pakistan customs, by catalog category: indicative duty + import-stage tax bands, not an HS-code tariff.
// ponytail: flat per-category rates, a real HS table if we ever clear our own shipments
export const DUTY_RATES: Record<string, number> = {
  smartphones: 0.3, tablets: 0.2, laptops: 0.2, 'mobile-accessories': 0.2,
  beauty: 0.35, 'skin-care': 0.35, fragrances: 0.35,
  tops: 0.3, 'womens-dresses': 0.3, 'womens-shoes': 0.3, 'womens-bags': 0.3, 'womens-jewellery': 0.3, 'womens-watches': 0.3,
  'mens-shirts': 0.3, 'mens-shoes': 0.3, 'mens-watches': 0.3, sunglasses: 0.3,
  'kitchen-accessories': 0.25, furniture: 0.25, 'home-decoration': 0.25,
  'sports-accessories': 0.2, groceries: 0.15,
}
export const DUTY_DEFAULT = 0.2
export const dutyRateFor = (category: string) => (Object.hasOwn(DUTY_RATES, category) ? DUTY_RATES[category] : DUTY_DEFAULT)
// the country's duty rate on a line; US buyers pay none
export const dutyCentsFor = (country: CountryCode, category: string, usdCents: number) => (country === 'PK' ? Math.round(usdCents * dutyRateFor(category)) : 0)

export const isCurrencyCode = (v: unknown): v is CurrencyCode => typeof v === 'string' && Object.hasOwn(CURRENCIES, v)
export const isCountryCode = (v: unknown): v is CountryCode => typeof v === 'string' && Object.hasOwn(COUNTRIES, v)

// 'Pakistan' | 'PK' (any case) → 'PK'; anything unknown, including existing 'United States' rows → 'US'
export function countryCodeFromName(name: string | null | undefined): CountryCode {
  const v = String(name ?? '').trim().toLowerCase()
  return Object.values(COUNTRIES).find((c) => c.code.toLowerCase() === v || c.name.toLowerCase() === v)?.code ?? 'US'
}

export const rateFor = (currency: CurrencyCode) => CURRENCIES[currency].perUsd

// US cents → minor units (cents, paisa) of `currency`, half away from zero. USD is always 1:1 whatever `rate` says.
export function convertCents(usdCents: number, currency: CurrencyCode, rate = rateFor(currency)) {
  // toFixed strips float noise first (50 * 277.07 = 13853.499999…), so .5 really rounds up
  const minor = Math.round(Number((Math.abs(usdCents) * (currency === 'USD' ? 1 : rate)).toFixed(4)))
  return usdCents < 0 ? -minor : minor
}

// minor units already in `currency` (a converted amount, such as a summarize() row or total) → { prefix, whole, fraction }
export const minorParts = (minor: number, currency: CurrencyCode) => ({
  prefix: CURRENCIES[currency].prefix,
  whole: `${minor < 0 ? '-' : ''}${Math.floor(Math.abs(minor) / 100).toLocaleString('en-US')}`,
  fraction: String(Math.abs(minor) % 100).padStart(2, '0'),
})

// minor units already in `currency` → "$1,234.56" | "-$6.99" | "PKR 342,011.25"
export function formatMinor(minor: number, currency: CurrencyCode) {
  const { prefix, whole, fraction } = minorParts(Math.abs(minor), currency)
  return `${minor < 0 ? '-' : ''}${prefix}${prefix.length > 1 ? ' ' : ''}${whole}.${fraction}`
}

export const formatMoney = (usdCents: number, currency: CurrencyCode = 'USD', rate?: number) => formatMinor(convertCents(usdCents, currency, rate), currency)

export const formatDollars = (usd: number, currency: CurrencyCode = 'USD', rate?: number) => formatMoney(toCents(usd), currency, rate)

// for <Price>: { prefix: 'PKR', whole: '27,889', fraction: '64' }
export const moneyParts = (usdCents: number, currency: CurrencyCode = 'USD', rate?: number) => minorParts(convertCents(usdCents, currency, rate), currency)

// Line items (unit price in US cents × quantity) → { usdCents, minor }. Each unit price is converted, then multiplied, so
// the prices shown × quantities add up to the row (converting the whole sum can be a paisa off). Spread into a summarize() part.
export type Units = { priceCents: number; quantity: number }
export const itemsTotal = (items: Units[], currency: CurrencyCode = 'USD', rate?: number) => ({
  usdCents: items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
  minor: items.reduce((sum, i) => sum + convertCents(i.priceCents, currency, rate) * i.quantity, 0),
})

// `usdCents` of one line out of `fullCents` (its price × quantity plus tax: itemRefundCents) in minor units that add up with
// the prices shown: the converted unit price × quantity, plus the converted tax, less the converted part held back (a return
// fee). A cancelled line passes fullCents twice. Nothing refunded stays 0; USD gives usdCents back.
export function lineMinor(i: Units, fullCents: number, usdCents: number, currency: CurrencyCode = 'USD', rate?: number) {
  if (!usdCents) return 0
  return itemsTotal([i], currency, rate).minor + convertCents(fullCents - i.priceCents * i.quantity, currency, rate) - convertCents(fullCents - usdCents, currency, rate)
}

// Order summaries: each component converted on its own, the total is the sum of the converted rows (so the column adds
// up in the shown currency). Pass components only (items, shipping, -free shipping, tax, -refund), never subtotals:
// a subtotal is summarize() of its subset. A part's `minor` (from itemsTotal) is used as is. Extra fields are kept on the rows.
export function summarize<T extends { label: string; usdCents: number; minor?: number }>(parts: T[], currency: CurrencyCode = 'USD', rate?: number) {
  const rows = parts.map((p) => {
    const minor = p.minor ?? convertCents(p.usdCents, currency, rate)
    return { ...p, minor, text: formatMinor(minor, currency) }
  })
  const minor = rows.reduce((sum, r) => sum + r.minor, 0)
  return { rows, total: { usdCents: parts.reduce((sum, p) => sum + p.usdCents, 0), minor, text: formatMinor(minor, currency) } }
}

// an amount typed in the display currency (price filters) → US dollars, unrounded so comparisons stay exact
export const fromDisplayAmount = (amount: number, currency: CurrencyCode = 'USD') => amount / rateFor(currency)

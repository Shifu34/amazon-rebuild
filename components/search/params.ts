// URL state for /s: parse untrusted params into a clean query, and build links that change one thing at a time.
import { CATEGORY_NAMES, DEPARTMENTS, SORTS, scopeName, type SearchParams, type SortKey } from '@/lib/catalog'
import { CURRENCIES, fromDisplayAmount, isCurrencyCode, rateFor, type CurrencyCode } from '@/lib/region'

export const PER_PAGE = 24

export type Query = {
  k: string
  i: string
  brand: string[]
  min?: number
  max?: number
  rating?: number
  deals: boolean
  oos: boolean
  sort: SortKey
  page: number
  nfpr: boolean
}

type RawParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? ''

// An amount in `currency` -> US dollars as the URL keeps them. 4 decimals, so a whole-rupee amount reads back as the same rupees.
export const toUrlDollars = (amount: number, currency: CurrencyCode = 'USD') => Math.round(fromDisplayAmount(amount, currency) * 1e4) / 1e4

// `cur` is set only by the no-JS price form, which submits the amounts as typed in the shopper's currency
function dollars(v: string | string[] | undefined, currency: CurrencyCode) {
  const s = first(v).replace(/[$,\s]/g, '')
  const n = Number(s)
  return s && Number.isFinite(n) && n >= 0 ? toUrlDollars(n, currency) : undefined
}

// Object.hasOwn so ?i=constructor can't reach Object.prototype
export const isScope = (slug: string) => DEPARTMENTS.some((d) => d.slug === slug) || Object.hasOwn(CATEGORY_NAMES, slug)
export const departmentOf = (slug: string) => DEPARTMENTS.find((d) => d.slug === slug) ?? DEPARTMENTS.find((d) => d.categories.includes(slug))

// Anything invalid is dropped rather than erroring; min > max is swapped
export function parseQuery(sp: RawParams): Query {
  const cur = first(sp.cur)
  let min = dollars(sp.min, isCurrencyCode(cur) ? cur : 'USD')
  let max = dollars(sp.max, isCurrencyCode(cur) ? cur : 'USD')
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min]
  const i = first(sp.i)
  const rating = Number(first(sp.rating))
  const sort = first(sp.sort)
  const page = Number(first(sp.page))
  return {
    k: first(sp.k).slice(0, 200).trim(),
    i: isScope(i) ? i : '',
    brand: [...new Set([sp.brand ?? []].flat().map((b) => b.trim().slice(0, 80)).filter(Boolean))].slice(0, 30),
    min,
    max,
    rating: [1, 2, 3, 4].includes(rating) ? rating : undefined,
    deals: first(sp.deals) === '1',
    oos: first(sp.oos) === '1',
    sort: SORTS.some((s) => s.key === sort) ? (sort as SortKey) : 'featured',
    page: Number.isInteger(page) && page > 1 ? page : 1,
    nfpr: first(sp.nfpr) === '1',
  }
}

// Keeps every other param; any change other than paging goes back to page 1
export function toHref(q: Query, patch: Partial<Query> = {}) {
  const n: Query = { ...q, page: 1, ...patch }
  const sp = new URLSearchParams()
  if (n.k) sp.set('k', n.k)
  if (n.i) sp.set('i', n.i)
  for (const b of n.brand) sp.append('brand', b)
  if (n.min !== undefined) sp.set('min', String(n.min))
  if (n.max !== undefined) sp.set('max', String(n.max))
  if (n.rating) sp.set('rating', String(n.rating))
  if (n.deals) sp.set('deals', '1')
  if (n.oos) sp.set('oos', '1')
  if (n.sort !== 'featured') sp.set('sort', n.sort)
  if (n.nfpr) sp.set('nfpr', '1')
  if (n.page > 1) sp.set('page', String(n.page))
  const s = sp.toString()
  return s ? `/s?${s}` : '/s'
}

export const toSearch = (q: Query, k = q.k): SearchParams => ({
  q: k,
  category: q.i || undefined,
  brands: q.brand,
  min: q.min,
  max: q.max,
  rating: q.rating,
  deals: q.deals,
  inStock: !q.oos, // like Amazon, out-of-stock items are hidden unless "Include Out of Stock" is on
  sort: q.sort,
  page: q.page,
  perPage: PER_PAGE,
})

type Band = [min: number | undefined, max: number | undefined]
// Price filter bands in each currency's own round amounts (search and Today's Deals)
export const PRICE_BANDS: Record<CurrencyCode, Band[]> = {
  USD: [[undefined, 25], [25, 50], [50, 100], [100, 200], [200, undefined]],
  PKR: [[undefined, 5000], [5000, 15000], [15000, 30000], [30000, 60000], [60000, undefined]],
}
// the shopper's bands as US-dollar bounds
export const priceRanges = (currency: CurrencyCode = 'USD') =>
  PRICE_BANDS[currency].map((band) => band.map((n) => (n === undefined ? undefined : toUrlDollars(n, currency))) as Band)

// US dollars -> the amount a filter shows: dollars to the cent, whole rupees
export const displayNumber = (usd: number, currency: CurrencyCode = 'USD') =>
  currency === 'USD' ? Math.round(usd * 100) / 100 : Math.round(usd * rateFor(currency))

// "$25", "$19.99", "PKR 5,000"; `prefix` false leaves the currency off
export function displayAmount(usd: number, currency: CurrencyCode = 'USD', prefix = true) {
  const n = displayNumber(usd, currency)
  const text = n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
  const p = CURRENCIES[currency].prefix
  return !prefix ? text : p.length > 1 ? `${p} ${text}` : `${p}${text}`
}

// "$25 to $50", "PKR 5,000 to 15,000", "Up to PKR 5,000", "PKR 60,000 & above"
export function priceLabel(min?: number, max?: number, currency: CurrencyCode = 'USD') {
  if (min === undefined) return `Up to ${displayAmount(max ?? 0, currency)}`
  return max === undefined ? `${displayAmount(min, currency)} & above` : `${displayAmount(min, currency)} to ${displayAmount(max, currency, currency === 'USD')}`
}

// `without` is the query with this one filter removed
export type Chip = { label: string; href: string; without: Query }

export function appliedFilters(q: Query, currency: CurrencyCode = 'USD'): Chip[] {
  const chip = (label: string, patch: Partial<Query>): Chip => ({ label, href: toHref(q, patch), without: { ...q, page: 1, ...patch } })
  const chips: Chip[] = []
  if (q.i) chips.push(chip(scopeName(q.i) ?? q.i, { i: '' }))
  for (const b of q.brand) chips.push(chip(b, { brand: q.brand.filter((x) => x !== b) }))
  if (q.rating) chips.push(chip(`${q.rating} Stars & Up`, { rating: undefined }))
  if (q.min !== undefined || q.max !== undefined) chips.push(chip(priceLabel(q.min, q.max, currency), { min: undefined, max: undefined }))
  if (q.deals) chips.push(chip("Today's Deals", { deals: false }))
  if (q.oos) chips.push(chip('Include Out of Stock', { oos: false }))
  return chips
}

const CLEARED: Partial<Query> = { i: '', brand: [], min: undefined, max: undefined, rating: undefined, deals: false, oos: false, page: 1 }
export const withoutFilters = (q: Query): Query => ({ ...q, ...CLEARED })
// keeps the query and sort
export const clearFilters = (q: Query) => toHref(q, CLEARED)

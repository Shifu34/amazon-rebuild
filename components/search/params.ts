// URL state for /s: parse untrusted params into a clean query, and build links that change one thing at a time.
import { CATEGORY_NAMES, DEPARTMENTS, SORTS, scopeName, type SearchParams, type SortKey } from '@/lib/catalog'

export const PER_PAGE = 24

export type Query = {
  k: string
  i: string
  brand: string[]
  min?: number
  max?: number
  rating?: number
  deals: boolean
  instock: boolean
  sort: SortKey
  page: number
  nfpr: boolean
}

type RawParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? ''

function dollars(v: string | string[] | undefined) {
  const s = first(v).replace(/[$,\s]/g, '')
  const n = Number(s)
  return s && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined
}

// Object.hasOwn so ?i=constructor can't reach Object.prototype
export const isScope = (slug: string) => DEPARTMENTS.some((d) => d.slug === slug) || Object.hasOwn(CATEGORY_NAMES, slug)
export const departmentOf = (slug: string) => DEPARTMENTS.find((d) => d.slug === slug) ?? DEPARTMENTS.find((d) => d.categories.includes(slug))

// Anything invalid is dropped rather than erroring; min > max is swapped
export function parseQuery(sp: RawParams): Query {
  let min = dollars(sp.min)
  let max = dollars(sp.max)
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min]
  const i = first(sp.i)
  const rating = Number(first(sp.rating))
  const sort = first(sp.sort)
  const page = Number(first(sp.page))
  return {
    k: first(sp.k).slice(0, 200),
    i: isScope(i) ? i : '',
    brand: [...new Set([sp.brand ?? []].flat().map((b) => b.trim().slice(0, 80)).filter(Boolean))].slice(0, 30),
    min,
    max,
    rating: [1, 2, 3, 4].includes(rating) ? rating : undefined,
    deals: first(sp.deals) === '1',
    instock: first(sp.instock) === '1',
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
  if (n.instock) sp.set('instock', '1')
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
  inStock: q.instock,
  sort: q.sort,
  page: q.page,
  perPage: PER_PAGE,
})

export const PRICE_RANGES: [number | undefined, number | undefined][] = [[undefined, 25], [25, 50], [50, 100], [100, 200], [200, undefined]]

const dollarLabel = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

export function priceLabel(min?: number, max?: number) {
  if (min === undefined) return `Up to ${dollarLabel(max ?? 0)}`
  return max === undefined ? `${dollarLabel(min)} & above` : `${dollarLabel(min)} to ${dollarLabel(max)}`
}

export type Chip = { label: string; href: string }

export function appliedFilters(q: Query): Chip[] {
  const chips: Chip[] = []
  if (q.i) chips.push({ label: scopeName(q.i), href: toHref(q, { i: '' }) })
  for (const b of q.brand) chips.push({ label: b, href: toHref(q, { brand: q.brand.filter((x) => x !== b) }) })
  if (q.rating) chips.push({ label: `${q.rating} Stars & Up`, href: toHref(q, { rating: undefined }) })
  if (q.min !== undefined || q.max !== undefined) chips.push({ label: priceLabel(q.min, q.max), href: toHref(q, { min: undefined, max: undefined }) })
  if (q.deals) chips.push({ label: "Today's Deals", href: toHref(q, { deals: false }) })
  if (q.instock) chips.push({ label: 'In stock only', href: toHref(q, { instock: false }) })
  return chips
}

// keeps the query and sort
export const clearFilters = (q: Query) =>
  toHref(q, { i: '', brand: [], min: undefined, max: undefined, rating: undefined, deals: false, instock: false })

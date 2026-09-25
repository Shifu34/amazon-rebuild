import type { Product } from './catalog'
import { shortDate } from './format'
import { formatDollars, type CountryCode, type CurrencyCode } from './region'

export const FREE_SHIPPING_MIN = 35
export const STANDARD_SHIPPING = 6.99
export const EXPEDITED_SHIPPING = 9.99
// international shipping to Pakistan: flat, never free
export const PK_STANDARD_SHIPPING = 14.99
export const PK_EXPEDITED_SHIPPING = 29.99

// What each speed costs shipping to `country` (US dollars), and the items total from which standard is FREE (null: never)
export const shippingRates = (country: CountryCode = 'US') =>
  country === 'PK'
    ? { standard: PK_STANDARD_SHIPPING, expedited: PK_EXPEDITED_SHIPPING, freeMin: null }
    : { standard: STANDARD_SHIPPING, expedited: EXPEDITED_SHIPPING, freeMin: FREE_SHIPPING_MIN as number | null }

const DAY = 86_400_000
// ponytail: one national order cutoff (22:00 UTC, 6 PM Eastern); per-warehouse cutoffs if delivery ever becomes regional
const CUTOFF_HOUR_UTC = 22

// business days to ship, parsed from DummyJSON's shippingInformation ("Ships in 3-5 business days", "Ships overnight", "Ships in 2 weeks")
export function shipDays(p: Pick<Product, 'shipping'>) {
  const s = p.shipping.toLowerCase()
  if (s.includes('overnight')) return 1
  const n = Math.max(...(s.match(/\d+/g) ?? ['3']).map(Number))
  return s.includes('month') ? n * 20 : s.includes('week') ? n * 5 : n
}

export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from)
  while (days > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days--
  }
  return d
}

const weekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6

// The one delivery promise (§4.4, §4.5). Cards, carousels, the buy box, cart, checkout's quote and orders all take their
// dates from here, so a product never shows two different dates. Before the cutoff counting starts today, after it tomorrow.
// US: standard ship days + 1, expedited ceil(days / 2). Pakistan (international): standard ship days + 8, expedited
// ceil(days / 2) + 4, all business days.
export function deliveryPromise(p: Pick<Product, 'shipping' | 'price'>, now = new Date(), country: CountryCode = 'US') {
  const cutoff = new Date(now)
  cutoff.setUTCHours(CUTOFF_HOUR_UTC, 0, 0, 0)
  const missedToday = cutoff.getTime() <= now.getTime()
  if (missedToday) cutoff.setTime(cutoff.getTime() + DAY)
  const start = missedToday ? new Date(now.getTime() + DAY) : now
  const days = shipDays(p)
  const intl = country === 'PK'
  const standard = addBusinessDays(start, days + (intl ? 8 : 1))
  const expedited = addBusinessDays(start, Math.max(1, Math.ceil(days / 2)) + (intl ? 4 : 0))
  const fastest = expedited.getTime() < standard.getTime() ? expedited : null
  const mins = Math.ceil((cutoff.getTime() - now.getTime()) / 60_000)
  const rates = shippingRates(country)
  const free = rates.freeMin !== null && p.price >= rates.freeMin
  const fees = {
    free, // standard delivery of this one item is FREE
    feeUsd: free ? 0 : rates.standard, // what standard delivery of this one item costs
    expeditedFeeUsd: rates.expedited,
    freeMinUsd: rates.freeMin, // FREE standard delivery from this items total; null when it never is
  }
  return {
    country,
    standard,
    expedited,
    fastest, // "Or fastest delivery" only when it beats standard
    // Countdown only next to a near date, and only when missing the cutoff moves it: a Friday or Saturday start
    // counts from Monday either way.
    within:
      (fastest ?? standard).getTime() - now.getTime() > 3 * DAY || weekend(new Date(start.getTime() + DAY))
        ? null
        : mins >= 60 ? `${Math.floor(mins / 60)} hrs ${mins % 60} mins` : `${mins} mins`,
    ...fees,
    // deprecated: label and note in US dollars; use deliveryText(promise, currency, rate)
    ...deliveryText(fees, 'USD'),
  }
}
export type DeliveryPromise = ReturnType<typeof deliveryPromise>

// "FREE delivery" | "$6.99 delivery" | "PKR 4,153.28 delivery", and the free-threshold note when there is one
export function deliveryText(p: { free: boolean; feeUsd: number; freeMinUsd: number | null }, currency: CurrencyCode = 'USD', rate?: number) {
  return {
    label: p.free ? 'FREE delivery' : `${formatDollars(p.feeUsd, currency, rate)} delivery`,
    note: p.free || p.freeMinUsd === null ? null : `FREE delivery on orders of ${formatDollars(p.freeMinUsd, currency, rate).replace(/\.00$/, '')} or more`,
  }
}

// Your nile day (lib/nile-day.ts reads and writes the shopper's): the weekday their week's orders are pooled onto.
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const isNileDay = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 6
// ponytail: Friday is what we propose to a shopper who hasn't picked a day; the select changes it in one click
export const DEFAULT_DAY = 5

// The first `weekday` on or after `from`, in UTC like the rest of the promise. Pooling only ever waits, never jumps ahead.
export function nextNileDay(weekday: number, from: Date) {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + ((weekday - d.getUTCDay() + 7) % 7))
  return d
}

export function relativeDay(d: Date, now = new Date()) {
  const days = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / DAY)
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : shortDate(d)
}

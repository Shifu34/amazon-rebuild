import type { Product } from './catalog'
import { shortDate, usd } from './format'

export const FREE_SHIPPING_MIN = 35
export const STANDARD_SHIPPING = 6.99
export const EXPEDITED_SHIPPING = 9.99

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
export function deliveryPromise(p: Pick<Product, 'shipping' | 'price'>, now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setUTCHours(CUTOFF_HOUR_UTC, 0, 0, 0)
  const missedToday = cutoff.getTime() <= now.getTime()
  if (missedToday) cutoff.setTime(cutoff.getTime() + DAY)
  const start = missedToday ? new Date(now.getTime() + DAY) : now
  const days = shipDays(p)
  const standard = addBusinessDays(start, days + 1)
  const expedited = addBusinessDays(start, Math.max(1, Math.ceil(days / 2)))
  const fastest = expedited.getTime() < standard.getTime() ? expedited : null
  const mins = Math.ceil((cutoff.getTime() - now.getTime()) / 60_000)
  const free = p.price >= FREE_SHIPPING_MIN
  return {
    standard,
    expedited,
    fastest, // "Or fastest delivery" only when it beats standard
    // Countdown only next to a near date, and only when missing the cutoff moves it: a Friday or Saturday start
    // counts from Monday either way.
    within:
      (fastest ?? standard).getTime() - now.getTime() > 3 * DAY || weekend(new Date(start.getTime() + DAY))
        ? null
        : mins >= 60 ? `${Math.floor(mins / 60)} hrs ${mins % 60} mins` : `${mins} mins`,
    // what standard delivery of this one item costs, and the threshold note when it isn't free
    label: free ? 'FREE delivery' : `${usd(STANDARD_SHIPPING)} delivery`,
    note: free ? null : `FREE delivery on orders of $${FREE_SHIPPING_MIN} or more`,
  }
}

export function relativeDay(d: Date, now = new Date()) {
  const days = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / DAY)
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : shortDate(d)
}

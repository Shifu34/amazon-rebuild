import type { Product } from './catalog'
import { shortDate } from './format'

export const FREE_SHIPPING_MIN = 35
export const STANDARD_SHIPPING = 6.99
export const EXPEDITED_SHIPPING = 9.99

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

export const standardDelivery = (p: Pick<Product, 'shipping'>, now = new Date()) => addBusinessDays(now, shipDays(p) + 1)
export const fastestDelivery = (p: Pick<Product, 'shipping'>, now = new Date()) => addBusinessDays(now, Math.max(1, Math.ceil(shipDays(p) / 2)))

export function relativeDay(d: Date, now = new Date()) {
  const days = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86_400_000)
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : shortDate(d)
}

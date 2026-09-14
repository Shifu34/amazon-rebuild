// Order summary rows for checkout, the thank-you page and order emails. Pure, so the client checkout can use it.
// Each component is converted on its own and the total is their sum, so the column adds up in the shown currency.
import { shippingRates } from '@/lib/delivery'
import { toCents } from '@/lib/format'
import type { Order, Speed } from '@/lib/orders'
import { countryCodeFromName, IMPORT_FEES_NOTE, summarize, type CountryCode, type CurrencyCode } from '@/lib/region'

export type SummaryRow = { label: string; text: string }

// "Standard Delivery" | "Expedited International Delivery"
export const deliveryName = (speed: Speed, country: CountryCode) => `${speed === 'expedited' ? 'Expedited' : 'Standard'}${country === 'PK' ? ' International' : ''} Delivery`

// `shippingCents` before the free-shipping discount; `taxCents` null means no tax line (international: the import-fees note)
export function summaryRows(
  o: { itemCount: number; itemsCents: number; shippingCents: number; freeShippingCents: number; taxCents: number | null },
  currency: CurrencyCode,
  rate?: number,
) {
  const pre = [
    { label: `Items (${o.itemCount}):`, usdCents: o.itemsCents },
    { label: 'Shipping & handling:', usdCents: o.shippingCents },
    ...(o.freeShippingCents ? [{ label: 'Free Shipping:', usdCents: -o.freeShippingCents }] : []),
  ]
  const beforeTax = summarize(pre, currency, rate)
  if (o.taxCents === null) return { rows: beforeTax.rows as SummaryRow[], total: beforeTax.total.text, note: IMPORT_FEES_NOTE }
  const all = summarize([...pre, { label: 'Estimated tax to be collected:', usdCents: o.taxCents }], currency, rate)
  const rows: SummaryRow[] = [...beforeTax.rows, { label: 'Total before tax:', text: beforeTax.total.text }, all.rows[pre.length]]
  return { rows, total: all.total.text, note: null }
}

// A placed order in its own currency and rate. Shipping is stored net of the free-shipping discount, so the FREE rows
// checkout showed are rebuilt from the order's country rates.
export function orderSummary(o: Pick<Order, 'shipTo' | 'deliverySpeed' | 'itemsCents' | 'shippingCents' | 'taxCents' | 'currency' | 'fxRate' | 'items'>) {
  const country = countryCodeFromName(o.shipTo.country)
  const rates = shippingRates(country)
  const free = o.deliverySpeed === 'standard' && rates.freeMin !== null && !o.shippingCents && o.itemsCents > 0 ? toCents(rates.standard) : 0
  const itemCount = o.items.reduce((n, i) => n + i.quantity, 0)
  return {
    ...summaryRows({ itemCount, itemsCents: o.itemsCents, shippingCents: o.shippingCents + free, freeShippingCents: free, taxCents: country === 'PK' ? null : o.taxCents }, o.currency, o.fxRate),
    country,
    speed: free ? 'FREE Standard Delivery' : deliveryName(o.deliverySpeed, country),
  }
}

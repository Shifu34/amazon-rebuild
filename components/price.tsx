import { toCents } from '@/lib/format'
import { formatDollars, moneyParts, type CurrencyCode } from '@/lib/region'

// Amazon-style price: small $ (or PKR) and cents raised beside the whole amount. Size follows the parent's font-size.
// `value` is always US dollars; pass the display currency and rate (getRegion() on the server, useRegion() on the client).
export function Price({ value, currency = 'USD', rate, className = '' }: { value: number; currency?: CurrencyCode; rate?: number; className?: string }) {
  const { prefix, whole, fraction } = moneyParts(toCents(value), currency, rate)
  return (
    <span className={`inline-flex items-start leading-none ${className}`}>
      <span className="sr-only">{formatDollars(value, currency, rate)}</span>
      <span aria-hidden className={`mt-[0.18em] text-[0.45em] ${prefix.length > 1 ? 'mr-[0.3em]' : ''}`}>{prefix}</span>
      <span aria-hidden>{whole}</span>
      <span aria-hidden className="mt-[0.18em] text-[0.45em]">{fraction}</span>
    </span>
  )
}

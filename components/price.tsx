import { toCents } from '@/lib/format'
import { convertCents, formatMinor, minorParts, type CurrencyCode } from '@/lib/region'

// Amazon-style price: small $ (or PKR) and cents raised beside the whole amount. Size follows the parent's font-size.
// `value` is US dollars; pass the display currency and rate (getRegion() on the server, useRegion() on the client).
// `minor` instead shows an amount already converted to that currency's minor units, such as a summarize() total.
type Props = { currency?: CurrencyCode; rate?: number; className?: string } & ({ value: number; minor?: never } | { minor: number; value?: never })

export function Price({ value, minor, currency = 'USD', rate, className = '' }: Props) {
  const amount = minor ?? convertCents(toCents(value!), currency, rate)
  const { prefix, whole, fraction } = minorParts(amount, currency)
  return (
    <span className={`inline-flex items-start leading-none ${className}`}>
      <span className="sr-only">{formatMinor(amount, currency)}</span>
      <span aria-hidden className={`mt-[0.18em] text-[0.45em] ${prefix.length > 1 ? 'mr-[0.3em]' : ''}`}>{prefix}</span>
      <span aria-hidden>{whole}</span>
      <span aria-hidden className="mt-[0.18em] text-[0.45em]">{fraction}</span>
    </span>
  )
}

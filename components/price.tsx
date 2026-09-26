import { toCents } from '@/lib/format'
import { convertCents, formatMinor, type CurrencyCode } from '@/lib/region'

// One plain amount in tabular figures (docs/design.md): "$89.99", "PKR 24,933.53". Size follows the parent's font-size.
// `value` is US dollars; pass the display currency and rate (getRegion() on the server, useRegion() on the client).
// `minor` instead shows an amount already converted to that currency's minor units, such as a summarize() total.
type Props = { currency?: CurrencyCode; rate?: number; className?: string } & ({ value: number; minor?: never } | { minor: number; value?: never })

export function Price({ value, minor, currency = 'USD', rate, className = '' }: Props) {
  const amount = minor ?? convertCents(toCents(value!), currency, rate)
  return <span className={`price ${className}`}>{formatMinor(amount, currency)}</span>
}

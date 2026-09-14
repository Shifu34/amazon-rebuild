import { priceParts, usd } from '@/lib/format'

// Amazon-style price: small $ and cents raised beside the whole dollars. Size follows the parent's font-size.
export function Price({ value, className = '' }: { value: number; className?: string }) {
  const { whole, fraction } = priceParts(value)
  return (
    <span className={`inline-flex items-start leading-none ${className}`}>
      <span className="sr-only">{usd(value)}</span>
      <span aria-hidden className="mt-[0.18em] text-[0.45em]">$</span>
      <span aria-hidden>{whole}</span>
      <span aria-hidden className="mt-[0.18em] text-[0.45em]">{fraction}</span>
    </span>
  )
}

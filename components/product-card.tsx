import Link from 'next/link'
import type { Product } from '@/lib/catalog'
import { FREE_SHIPPING_MIN, standardDelivery } from '@/lib/delivery'
import { compactCount, shortDate, usd } from '@/lib/format'
import { Price } from './price'
import { Stars } from './stars'

export function Badge({ badge }: { badge: Product['badge'] }) {
  if (badge === 'best-seller') {
    return <span className="inline-block rounded-sm bg-[#e67a00] px-1.5 py-0.5 text-xs leading-4 font-bold text-white">Best Seller</span>
  }
  if (badge === 'amazons-choice') {
    return (
      <span className="inline-block rounded-sm bg-nav-light px-1.5 py-0.5 text-xs leading-4 text-white">
        nile&apos;s <span className="font-bold text-brand">Choice</span>
      </span>
    )
  }
  return null
}

export function DeliveryLine({ product: p }: { product: Product }) {
  if (p.stock === 0) return <p className="text-sm text-danger">Currently unavailable.</p>
  const date = shortDate(standardDelivery(p))
  return p.price >= FREE_SHIPPING_MIN ? (
    <p className="text-sm">FREE delivery <b>{date}</b></p>
  ) : (
    <p className="text-sm">
      Delivery <b>{date}</b>
      <span className="block text-xs text-muted">FREE delivery on ${FREE_SHIPPING_MIN} of items</span>
    </p>
  )
}

// Search-result style card. `children` is the action slot (e.g. an Add to cart form).
export function ProductCard({ product: p, children }: { product: Product; children?: React.ReactNode }) {
  const href = `/dp/${p.id}`
  return (
    <article className="flex h-full flex-col">
      <Link href={href} className="flex aspect-square items-center justify-center rounded-sm bg-[#f7f7f7] p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.thumbnail} alt={p.title} loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
      </Link>
      <div className="flex flex-1 flex-col gap-1 pt-2">
        {p.badge && <div><Badge badge={p.badge} /></div>}
        <h2 className="text-base leading-6 font-normal">
          <Link href={href} className="line-clamp-2 hover:text-link-hover">{p.title}</Link>
        </h2>
        <div className="flex items-center gap-1 text-sm">
          <span>{p.rating.toFixed(1)}</span>
          <Stars rating={p.rating} />
          <Link href={`${href}#reviews`} className="link">({p.ratingCount.toLocaleString('en-US')})</Link>
        </div>
        {p.boughtPastMonth > 0 && <p className="text-sm text-muted">{compactCount(p.boughtPastMonth)} bought in past month</p>}
        {p.discount >= 10 && (
          <p><span className="rounded-sm bg-deal px-1.5 py-0.5 text-xs font-bold text-white">Limited time deal</span></p>
        )}
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <Link href={href} className="text-[28px] leading-8"><Price value={p.price} /></Link>
          {p.listPrice && <span className="text-xs text-muted">List: <s>{usd(p.listPrice)}</s></span>}
        </div>
        <DeliveryLine product={p} />
        {p.stock > 0 && p.stock < 10 && <p className="text-sm text-danger">Only {p.stock} left in stock - order soon.</p>}
        {children && <div className="mt-auto pt-2">{children}</div>}
      </div>
    </article>
  )
}

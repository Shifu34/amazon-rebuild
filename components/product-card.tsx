import Image from 'next/image'
import Link from 'next/link'
import { dataSaver } from '@/app/actions/data-saver'
import { CompareCheckbox } from '@/components/compare/compare'
import { isDeal, type Product } from '@/lib/catalog'
import { deliveryPromise, deliveryText, relativeDay } from '@/lib/delivery'
import { compactCount } from '@/lib/format'
import { formatDollars } from '@/lib/region'
import { myPrice } from '@/lib/price-lock'
import { getRegion } from '@/lib/region-server'
import { Price } from './price'
import { QuickLook } from './quick-look'
import { Stars } from './stars'

// every product shot: white product photos multiply into the grey box behind them
export const shot = 'max-h-full max-w-full object-contain mix-blend-multiply'

export function Badge({ badge }: { badge: Product['badge'] }) {
  if (badge === 'best-seller') {
    return <span className="inline-block rounded-sm bg-[#c45500] px-1.5 py-0.5 text-xs leading-4 font-bold text-white">Best Seller</span>
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

// the same date the product page, cart and checkout show (lib/delivery), for the shopper's delivery country and in their
// currency; `compact` for carousels drops the threshold note
export async function DeliveryLine({ product: p, compact = false }: { product: Product; compact?: boolean }) {
  const size = compact ? 'text-xs' : 'text-sm'
  if (p.stock === 0) return <p className={`${size} text-danger`}>Currently unavailable.</p>
  const { country, currency, rate } = await getRegion()
  const promise = deliveryPromise(p, new Date(), country)
  const { label, note } = deliveryText(promise, currency, rate)
  return (
    <p className={size}>
      {label} <b>{relativeDay(promise.standard)}</b>
      {note && !compact && <span className="block text-xs text-muted">{note}</span>}
    </p>
  )
}

// Search-result style card, priced in the shopper's display currency. `children` is the action slot (e.g. an Add to cart form).
// Pass `priority` for the first row of a grid so those above-the-fold images load first.
export async function ProductCard({ product, priority = false, children }: { product: Product; priority?: boolean; children?: React.ReactNode }) {
  const [p, { currency, rate }, saver] = await Promise.all([myPrice(product), getRegion(), dataSaver()])
  const href = `/dp/${p.id}`
  return (
    <article className="group/card flex h-full flex-col">
      <div className="relative">
        {/* Data saver swaps the CDN original for an optimised, smaller one and stops prefetching; the default path is untouched */}
        <Link href={href} prefetch={saver ? false : undefined} className="flex aspect-square items-center justify-center rounded-sm bg-[#f7f7f7] p-3">
          {saver ? (
            <Image src={p.thumbnail} alt={p.title} width={240} height={240} quality={40} loading={priority ? 'eager' : 'lazy'} className={shot} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnail} alt={p.title} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} className={shot} />
          )}
        </Link>
        <QuickLook id={p.id} title={p.title} thumbnail={p.thumbnail} />
        <CompareCheckbox id={p.id} title={p.title} thumbnail={p.thumbnail} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
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
        {isDeal(p) && (
          <p><span className="rounded-sm bg-deal px-1.5 py-0.5 text-xs font-bold text-white">Deal</span></p>
        )}
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <Link href={href} className="text-[28px] leading-8"><Price value={p.price} currency={currency} rate={rate} /></Link>
          {p.listPrice && <span className="text-xs text-muted">List: <s>{formatDollars(p.listPrice, currency, rate)}</s></span>}
        </div>
        <DeliveryLine product={p} />
        {p.stock > 0 && p.stock < 10 && <p className="text-sm text-danger">Only {p.stock} left in stock - order soon.</p>}
        {children && <div className="mt-auto pt-2">{children}</div>}
      </div>
    </article>
  )
}

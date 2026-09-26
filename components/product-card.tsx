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

// every product shot: white product photos multiply into the paper box behind them
export const shot = 'max-h-full max-w-full object-contain mix-blend-multiply'
// docs/design.md: pictures sit on quiet paper, never on a grey Amazon tile
export const shotBox = 'flex items-center justify-center rounded-[10px] bg-page'

// docs/design.md: one accent. A chip is a hairline and a word, not a shouting fill.
export function Badge({ badge }: { badge: Product['badge'] }) {
  if (badge === 'best-seller') {
    return <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-xs leading-5 font-medium text-white">Best Seller</span>
  }
  if (badge === 'amazons-choice') {
    return (
      <span className="inline-block rounded-full border border-line px-2 py-0.5 text-xs leading-5 text-muted">
        nile&apos;s <span className="font-medium text-accent">Choice</span>
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
    <p className={`${size} text-muted`}>
      {label} <span className="font-medium text-ink">{relativeDay(promise.standard)}</span>
      {note && !compact && <span className="block text-xs text-muted">{note}</span>}
    </p>
  )
}

// Result card: picture on paper, then a quiet stack of title, rating, price and the delivery promise. `children` is the
// action slot (e.g. an Add to cart form). Pass `priority` for the first row of a grid so those images load first.
export async function ProductCard({ product, priority = false, children }: { product: Product; priority?: boolean; children?: React.ReactNode }) {
  const [p, { currency, rate }, saver] = await Promise.all([myPrice(product), getRegion(), dataSaver()])
  const href = `/dp/${p.id}`
  return (
    <article className="group/card flex h-full flex-col">
      <div className="relative">
        {/* Data saver swaps the CDN original for an optimised, smaller one and stops prefetching; the default path is untouched */}
        <Link href={href} prefetch={saver ? false : undefined} className={`${shotBox} aspect-square p-5`}>
          {saver ? (
            <Image src={p.thumbnail} alt={p.title} width={240} height={240} quality={40} loading={priority ? 'eager' : 'lazy'} className={shot} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnail} alt={p.title} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} className={shot} />
          )}
        </Link>
        {/* on the picture, not above the title, so every card in a row starts its title on the same line */}
        {p.badge && <div className="absolute top-2.5 right-2.5 z-10"><Badge badge={p.badge} /></div>}
        <QuickLook id={p.id} title={p.title} thumbnail={p.thumbnail} />
        <CompareCheckbox id={p.id} title={p.title} thumbnail={p.thumbnail} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-3">
        <h2 className="text-[15px] leading-[21px] font-normal">
          <Link href={href} className="line-clamp-2 hover:underline">{p.title}</Link>
        </h2>
        <div className="flex items-center gap-1.5 text-sm text-muted">
          <Stars rating={p.rating} className="h-3.5" />
          <span className="price">{p.rating.toFixed(1)}</span>
          <Link href={`${href}#reviews`} className="price hover:text-ink hover:underline">({p.ratingCount.toLocaleString('en-US')})</Link>
        </div>
        {p.boughtPastMonth > 0 && <p className="text-xs text-muted">{compactCount(p.boughtPastMonth)} bought in past month</p>}
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          {/* data-card-price: the card's own price, so tests read what the shopper sees (.price is the tabular-figures utility, used by the rating too) */}
          <Link href={href} data-card-price className="font-display text-[22px] leading-7"><Price value={p.price} currency={currency} rate={rate} /></Link>
          {p.listPrice && <span className="price text-xs text-muted">was <s>{formatDollars(p.listPrice, currency, rate)}</s></span>}
          {isDeal(p) && <span className="text-xs font-medium text-deal">Deal</span>}
        </div>
        <DeliveryLine product={p} />
        {p.stock > 0 && p.stock < 10 && <p className="text-sm text-deal">Only {p.stock} left in stock - order soon.</p>}
        {children && <div className="mt-auto pt-3">{children}</div>}
      </div>
    </article>
  )
}

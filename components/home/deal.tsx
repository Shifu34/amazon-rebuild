import Image from 'next/image'
import Link from 'next/link'
import { dataSaver } from '@/app/actions/data-saver'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { Price } from '@/components/price'
import { shot } from '@/components/product-card'
import { QuickLook } from '@/components/quick-look'
import { Scroller } from '@/components/scroller'
import { Stars } from '@/components/stars'
import type { Product } from '@/lib/catalog'
import { myPrice } from '@/lib/price-lock'
import { formatDollars } from '@/lib/region'
import { getRegion } from '@/lib/region-server'

export function DealBadge({ discount }: { discount: number }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="rounded-sm bg-deal px-1.5 py-0.5 text-xs leading-4 font-bold text-white">
        <span aria-hidden>-{discount}%</span>
        <span className="sr-only">{discount}% off</span>
      </span>
      <span className="text-xs leading-4 font-bold text-deal">Deal</span>
    </span>
  )
}

// Today's Deals tile. `compact` (home rail) drops the rating row and the cart button.
// `inCart` is the server cart quantity; `priority` loads the image first (first grid row). `data-price` stays US dollars.
export async function DealCard({ product, compact = false, inCart, priority = false }: { product: Product; compact?: boolean; inCart?: number; priority?: boolean }) {
  const [p, { currency, rate }, saver] = await Promise.all([myPrice(product), getRegion(), dataSaver()])
  const href = `/dp/${p.id}`
  return (
    <article data-price={p.price} className="group/card relative flex h-full flex-col">
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden prefetch={saver ? false : undefined} className="flex aspect-square items-center justify-center rounded-lg bg-[#f7f7f7] p-3">
          {saver ? (
            <Image src={p.thumbnail} alt="" width={200} height={200} quality={40} loading={priority ? 'eager' : 'lazy'} className={shot} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnail} alt="" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} className={shot} />
          )}
        </Link>
        <QuickLook id={p.id} title={p.title} thumbnail={p.thumbnail} />
      </div>
      <div className="mt-2 flex flex-1 flex-col gap-1">
        <DealBadge discount={p.discount} />
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[21px] leading-7"><Price value={p.price} currency={currency} rate={rate} /></span>
          {p.listPrice && <span className="text-xs text-muted">List: <s>{formatDollars(p.listPrice, currency, rate)}</s></span>}
        </div>
        <h3 className="text-sm font-normal">
          <Link href={href} className="line-clamp-2 hover:text-link-hover hover:underline">{p.title}</Link>
        </h3>
        {!compact && (
          <>
            <div className="flex items-center gap-1">
              <Stars rating={p.rating} className="h-3.5" />
              <span className="text-xs text-link">{p.ratingCount.toLocaleString('en-US')}</span>
            </div>
            <div className="mt-auto pt-2">
              <AddToCartButton productId={p.id} inCart={inCart} />
            </div>
          </>
        )}
      </div>
    </article>
  )
}

export function DealRail({ products }: { products: Product[] }) {
  if (!products.length) return null
  return (
    <section aria-label="Today's Deals" className="bg-white px-4 pt-4 pb-1">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xl leading-7">Today&apos;s Deals</h2>
        <Link href="/deals" className="link text-sm">See all deals</Link>
      </div>
      <Scroller label="Today's Deals">
        {products.map((p) => (
          <li key={p.id} className="w-[170px] shrink-0 snap-start">
            <DealCard product={p} compact />
          </li>
        ))}
      </Scroller>
    </section>
  )
}

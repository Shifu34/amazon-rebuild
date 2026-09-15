import Link from 'next/link'
import type { Product } from '@/lib/catalog'
import { getRegion } from '@/lib/region-server'
import { Price } from './price'
import { DeliveryLine } from './product-card'
import { QuickLook } from './quick-look'
import { Scroller } from './scroller'
import { Stars } from './stars'

// "Best Sellers in Kitchen", "Customers also viewed"... `details` adds title, stars, price and delivery date under each image.
// `loading="eager"` when the row is visible as the page opens. Prices are in the shopper's display currency.
export async function ProductCarousel({ title, products, href, details = true, loading = 'lazy' }: { title: string; products: Product[]; href?: string; details?: boolean; loading?: 'lazy' | 'eager' }) {
  if (!products.length) return null
  const { currency, rate } = await getRegion()
  return (
    <section aria-label={title} className="bg-white px-4 pt-4 pb-1">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xl leading-7">{title}</h2>
        {href && <Link href={href} className="link text-sm">See more</Link>}
      </div>
      <Scroller label={title}>
        {products.map((p) => (
          <li key={p.id} className={`${details ? 'w-[170px]' : 'w-[150px]'} group/card shrink-0 snap-start`}>
            <div className="relative">
              {/* with details the title link below is the one link tab stop per product (plus Quick look) */}
              <Link
                href={`/dp/${p.id}`}
                className="flex h-[170px] items-center justify-center rounded-sm bg-[#f7f7f7] p-2"
                aria-label={details ? undefined : p.title}
                aria-hidden={details || undefined}
                tabIndex={details ? -1 : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail} alt={details ? '' : p.title} loading={loading} className="max-h-full max-w-full object-contain mix-blend-multiply" />
              </Link>
              {details && <QuickLook id={p.id} title={p.title} thumbnail={p.thumbnail} />}
            </div>
            {details && (
              <div className="mt-1.5 space-y-0.5">
                <Link href={`/dp/${p.id}`} className="line-clamp-2 text-sm hover:text-link-hover">{p.title}</Link>
                <div className="flex items-center gap-1">
                  <Stars rating={p.rating} className="h-3.5" />
                  <span className="text-xs text-link">{p.ratingCount.toLocaleString('en-US')}</span>
                </div>
                <div className="text-lg leading-6"><Price value={p.price} currency={currency} rate={rate} /></div>
                <DeliveryLine product={p} compact />
              </div>
            )}
          </li>
        ))}
      </Scroller>
    </section>
  )
}

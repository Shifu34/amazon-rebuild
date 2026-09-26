import Image from 'next/image'
import Link from 'next/link'
import { dataSaver } from '@/app/actions/data-saver'
import type { Product } from '@/lib/catalog'
import { myPrices } from '@/lib/price-lock'
import { getRegion } from '@/lib/region-server'
import { Price } from './price'
import { DeliveryLine, shot, shotBox } from './product-card'
import { QuickLook } from './quick-look'
import { Scroller } from './scroller'
import { Stars } from './stars'

// "Best Sellers in Kitchen", "Customers also viewed"... `details` adds title, stars, price and delivery date under each image.
// `loading="eager"` when the row is visible as the page opens. Prices are in the shopper's display currency.
// docs/design.md: a hairline and space set the row apart, not a white band on grey.
export async function ProductCarousel({ title, products, href, details = true, loading = 'lazy' }: { title: string; products: Product[]; href?: string; details?: boolean; loading?: 'lazy' | 'eager' }) {
  if (!products.length) return null
  const [items, { currency, rate }, saver] = await Promise.all([myPrices(products), getRegion(), dataSaver()])
  return (
    <section aria-label={title} className="border-t border-line px-4 py-8 lg:py-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-[22px] leading-7">{title}</h2>
          {href && <Link href={href} className="link shrink-0 text-sm">See more ›</Link>}
        </div>
        <Scroller label={title}>
          {items.map((p) => (
            <li key={p.id} className={`${details ? 'w-[180px]' : 'w-[150px]'} group/card shrink-0 snap-start`}>
              <div className="relative">
                {/* with details the title link below is the one link tab stop per product (plus Quick look) */}
                <Link
                  href={`/dp/${p.id}`}
                  prefetch={saver ? false : undefined}
                  className={`${shotBox} h-[180px] p-4`}
                  aria-label={details ? undefined : p.title}
                  aria-hidden={details || undefined}
                  tabIndex={details ? -1 : undefined}
                >
                  {saver ? (
                    <Image src={p.thumbnail} alt={details ? '' : p.title} width={180} height={180} quality={40} loading={loading} className={shot} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail} alt={details ? '' : p.title} loading={loading} className={shot} />
                  )}
                </Link>
                {details && <QuickLook id={p.id} title={p.title} thumbnail={p.thumbnail} />}
              </div>
              {details && (
                <div className="mt-3 space-y-1.5">
                  <Link href={`/dp/${p.id}`} className="line-clamp-2 text-sm leading-5 hover:underline">{p.title}</Link>
                  <div className="flex items-center gap-1.5">
                    <Stars rating={p.rating} className="h-3.5" />
                    <span className="price text-xs text-muted">{p.ratingCount.toLocaleString('en-US')}</span>
                  </div>
                  <div className="font-display text-[18px] leading-6"><Price value={p.price} currency={currency} rate={rate} /></div>
                  <DeliveryLine product={p} compact />
                </div>
              )}
            </li>
          ))}
        </Scroller>
      </div>
    </section>
  )
}

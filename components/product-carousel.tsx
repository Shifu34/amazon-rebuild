import Link from 'next/link'
import type { Product } from '@/lib/catalog'
import { Price } from './price'
import { Scroller } from './scroller'
import { Stars } from './stars'

// "Best Sellers in Kitchen", "Customers also viewed"... `details` adds title, stars and price under each image.
export function ProductCarousel({ title, products, href, details = true }: { title: string; products: Product[]; href?: string; details?: boolean }) {
  if (!products.length) return null
  return (
    <section aria-label={title} className="bg-white px-4 pt-4 pb-1">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xl leading-7">{title}</h2>
        {href && <Link href={href} className="link text-sm">See more</Link>}
      </div>
      <Scroller label={title}>
        {products.map((p) => (
          <li key={p.id} className={`${details ? 'w-[170px]' : 'w-[150px]'} shrink-0 snap-start`}>
            <Link href={`/dp/${p.id}`} className="flex h-[170px] items-center justify-center rounded-sm bg-[#f7f7f7] p-2" aria-label={details ? undefined : p.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail} alt={details ? '' : p.title} loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
            </Link>
            {details && (
              <div className="mt-1.5 space-y-0.5">
                <Link href={`/dp/${p.id}`} className="line-clamp-2 text-sm hover:text-link-hover">{p.title}</Link>
                <div className="flex items-center gap-1">
                  <Stars rating={p.rating} className="h-3.5" />
                  <span className="text-xs text-link">{p.ratingCount.toLocaleString('en-US')}</span>
                </div>
                <div className="text-lg leading-6"><Price value={p.price} /></div>
              </div>
            )}
          </li>
        ))}
      </Scroller>
    </section>
  )
}

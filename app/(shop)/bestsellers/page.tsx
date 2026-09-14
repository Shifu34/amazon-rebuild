import type { Metadata } from 'next'
import Link from 'next/link'
import { ranked } from '@/components/home/scope'
import { Scroller } from '@/components/scroller'
import { DEPARTMENTS } from '@/lib/catalog'
import { BestSellersLayout, RankTile } from './shared'

export const metadata: Metadata = { title: 'Best Sellers' }

export default function BestSellers() {
  return (
    <BestSellersLayout>
      {DEPARTMENTS.map((d) => {
        const title = `Best Sellers in ${d.name}`
        return (
          <section key={d.slug} aria-label={title} className="border-b border-line pt-1 pb-4 not-first:pt-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xl leading-7">{title}</h2>
              <Link href={`/bestsellers/${d.slug}`} className="link shrink-0 text-sm">
                See More<span className="sr-only"> {title}</span>
              </Link>
            </div>
            <Scroller label={title}>
              {ranked(d.slug, 10).map((p, i) => (
                <li key={p.id} className="w-[160px] shrink-0 snap-start sm:w-[180px]">
                  <RankTile product={p} rank={i + 1} />
                </li>
              ))}
            </Scroller>
          </section>
        )
      })}
    </BestSellersLayout>
  )
}

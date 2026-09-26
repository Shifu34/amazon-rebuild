import Link from 'next/link'
import { bestSellers, categoryName, search } from '@/lib/catalog'
import { parseQuery, toHref } from './params'

const BLANK = parseQuery({})
const move = 'transition duration-200 ease-out motion-reduce:transition-none'

// A department opens on its categories: a circle per category, pictured with its best seller. Hovering or tabbing into one
// shrinks it up and slides in that category's top brands; on touch screens the circle is just a link.
export function FeaturedCategories({ categories }: { categories: string[] }) {
  const orbs = categories.flatMap((slug) => {
    const [top] = bestSellers(slug, 1)
    // the same in-stock results the brand link opens, so every brand shown has something to show
    const brands = search({ category: slug, inStock: true, perPage: 1 }).facets.brands.slice(0, 3)
    return top ? [{ slug, name: categoryName(slug), image: top.thumbnail, brands }] : []
  })
  if (orbs.length < 2) return null

  return (
    <section aria-labelledby="featured-categories" className="mb-10 border-b border-line pb-10">
      <h2 id="featured-categories" className="mb-6 text-[22px] leading-7">Featured categories</h2>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {orbs.map((o) => (
          // only an orb with brands to show opens: the open state is a pointer over it or keyboard focus inside it
          <li key={o.slug} className={`${o.brands.length ? 'group/orb' : ''} flex flex-col items-center`}>
            <Link href={toHref(BLANK, { i: o.slug })} className="flex w-full flex-col items-center rounded-sm">
              {/* the thumbnails carry their own transparent margin, so a 144px box makes most products fill ~70% of the orb; any
                  larger and the full-height phone shots poke past the circle. The hover scale shrinks photo and orb together. */}
              <span
                className={`${move} flex aspect-square w-full max-w-40 origin-top items-center justify-center rounded-full bg-page p-6 group-hover/orb:scale-50 group-has-[:focus-visible]/orb:scale-50`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.image} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
              </span>
              {/* moves up by half the 160px orb, so it sits right under the shrunk one */}
              <span className={`${move} font-display mt-3 text-center text-[17px] leading-6 group-hover/orb:-translate-y-20 group-has-[:focus-visible]/orb:-translate-y-20`}>{o.name}</span>
            </Link>
            {o.brands.length > 0 && (
              <ul
                aria-label={`Top brands in ${o.name}`}
                // transparent rather than visibility:hidden, so Tab can reach a brand (which opens the orb) and focus isn't dropped
                // mid-Tab; no pointer events while closed, and not rendered on screens that can't hover, so a tap can't hit it
                // h-0: the closed list reserves no space under the row, it only fills the gap the shrinking orb opens
                className={`${move} pointer-events-none mt-2 h-0 w-full max-w-40 -translate-y-16 border-t border-line pt-2 opacity-0 group-hover/orb:pointer-events-auto group-hover/orb:-translate-y-20 group-hover/orb:opacity-100 group-has-[:focus-visible]/orb:pointer-events-auto group-has-[:focus-visible]/orb:-translate-y-20 group-has-[:focus-visible]/orb:opacity-100 [@media(hover:none)]:hidden`}
              >
                {o.brands.map((b) => (
                  <li key={b.name}>
                    <Link href={toHref(BLANK, { i: o.slug, brand: [b.name] })} className="block truncate py-0.5 text-sm text-muted hover:text-ink hover:underline">
                      {b.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

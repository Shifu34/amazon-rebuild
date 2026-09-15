import Link from 'next/link'
import { bestSellers, categoryName, search } from '@/lib/catalog'
import { parseQuery, toHref } from './params'

const BLANK = parseQuery({})
const move = 'transition duration-200 ease-out motion-reduce:transition-none'

// Amazon's "Featured categories" on a department page: an orb per category, pictured with its best seller. Hovering or
// tabbing into an orb shrinks it up and slides in the category's top brands; on touch screens the orb is just a link.
export function FeaturedCategories({ categories }: { categories: string[] }) {
  const orbs = categories.flatMap((slug) => {
    const [top] = bestSellers(slug, 1)
    // the same in-stock results the brand link opens, so every brand shown has something to show
    const brands = search({ category: slug, inStock: true, perPage: 1 }).facets.brands.slice(0, 3)
    return top ? [{ slug, name: categoryName(slug), image: top.thumbnail, brands }] : []
  })
  if (orbs.length < 2) return null

  return (
    <section aria-labelledby="featured-categories" className="mb-6">
      <h2 id="featured-categories" className="mb-4 text-xl font-bold">Featured categories</h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {orbs.map((o) => (
          // only an orb with brands to show opens: the open state is a pointer over it or keyboard focus inside it
          <li key={o.slug} className={`${o.brands.length ? 'group/orb' : ''} flex flex-col items-center`}>
            <Link href={toHref(BLANK, { i: o.slug })} className="flex w-full flex-col items-center rounded-sm">
              {/* the thumbnails carry their own transparent margin, so a 144px box makes most products fill ~70% of the orb; any
                  larger and the full-height phone shots poke past the circle. The hover scale shrinks photo and orb together. */}
              <span
                className={`${move} flex aspect-square w-full max-w-40 origin-top items-center justify-center rounded-full bg-[#f7f7f7] p-2 group-hover/orb:scale-50 group-has-[:focus-visible]/orb:scale-50`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.image} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
              </span>
              {/* moves up by half the 160px orb, so it sits right under the shrunk one */}
              <span className={`${move} mt-3 text-center leading-5 font-bold group-hover/orb:-translate-y-20 group-has-[:focus-visible]/orb:-translate-y-20`}>{o.name}</span>
            </Link>
            {o.brands.length > 0 && (
              <ul
                aria-label={`Top brands in ${o.name}`}
                // transparent rather than visibility:hidden, so Tab can reach a brand (which opens the orb) and focus isn't dropped
                // mid-Tab; no pointer events while closed, and not rendered on screens that can't hover, so a tap can't hit it
                className={`${move} pointer-events-none mt-2 w-full max-w-40 -translate-y-16 border-t border-line pt-2 opacity-0 group-hover/orb:pointer-events-auto group-hover/orb:-translate-y-20 group-hover/orb:opacity-100 group-has-[:focus-visible]/orb:pointer-events-auto group-has-[:focus-visible]/orb:-translate-y-20 group-has-[:focus-visible]/orb:opacity-100 [@media(hover:none)]:hidden`}
              >
                {o.brands.map((b) => (
                  <li key={b.name}>
                    <Link href={toHref(BLANK, { i: o.slug, brand: [b.name] })} className="block truncate py-0.5 text-sm hover:text-link-hover hover:underline">
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

import type { Metadata } from 'next'
import Link from 'next/link'
import { DealCard } from '@/components/home/deal'
import { FilterToggle } from '@/components/home/filter-toggle'
import { inScope, scopeLabel } from '@/components/home/scope'
import { PRICE_BANDS, priceLabel, toUrlDollars } from '@/components/search/params'
import { Stars } from '@/components/stars'
import { cartQuantities } from '@/lib/cart'
import { CATEGORY_NAMES, deals, DEPARTMENTS, popularity, type Product } from '@/lib/catalog'
import { plural } from '@/lib/format'
import type { CurrencyCode } from '@/lib/region'
import { getRegion } from '@/lib/region-server'
import { SortSelect } from './sort-select'

export const metadata: Metadata = { title: "Today's Deals" }

const BATCH = 40
const DISCOUNTS = [10, 15, 20, 25, 50]
// Price facet keys in dollars ('under-25', '25-50', '200-up') and rupees ('pkr-under-5000', 'pkr-60000-up'). Every key
// filters in any currency so shared links keep working; the rail offers the shopper's own bands. Bounds are US dollars.
const PRICES: Record<string, { currency: CurrencyCode; min: number; max: number }> = Object.fromEntries(
  (Object.keys(PRICE_BANDS) as CurrencyCode[]).flatMap((c) =>
    PRICE_BANDS[c].map(([lo, hi]) => [
      `${c === 'USD' ? '' : `${c.toLowerCase()}-`}${lo ?? 'under'}-${hi ?? 'up'}`,
      { currency: c, min: lo === undefined ? 0 : toUrlDollars(lo, c), max: hi === undefined ? Infinity : toUrlDollars(hi, c) },
    ]),
  ),
)
const SORTS: Record<string, [label: string, compare: (a: Product, b: Product) => number]> = {
  featured: ['Featured', (a, b) => b.discount - a.discount || popularity(b) - popularity(a)],
  'price-asc': ['Price: Low to High', (a, b) => a.price - b.price],
  'price-desc': ['Price: High to Low', (a, b) => b.price - a.price],
  rating: ['Avg. Customer Review', (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount],
  bestsellers: ['Best Sellers', (a, b) => popularity(b) - popularity(a)],
}

type Filter = 'i' | 'discount' | 'price' | 'rating'
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const own = (rec: object, key: string | undefined) => (key && Object.hasOwn(rec, key) ? key : undefined)

function Facet({ title, clear, children }: { title: string; clear?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="text-sm font-bold">{title}</h3>
      {clear && <Link href={clear} className="link text-xs">Clear</Link>}
      <ul className="mt-1 text-sm">{children}</ul>
    </section>
  )
}

function Option({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} aria-current={active ? 'true' : undefined} className={`flex items-center gap-1 py-1.5 hover:text-link-hover lg:py-1 ${active ? 'font-bold' : ''}`}>
        {children}
      </Link>
    </li>
  )
}

export default async function DealsPage({ searchParams }: PageProps<'/deals'>) {
  const sp = await searchParams
  // unknown values are ignored rather than erroring, so an old or hand-edited URL still shows deals
  const i = scopeLabel(first(sp.i)) ? first(sp.i) : undefined
  const discount = DISCOUNTS.find((d) => String(d) === first(sp.discount))
  const price = own(PRICES, first(sp.price))
  const rating = first(sp.rating) === '4' ? 4 : undefined
  const sort = own(SORTS, first(sp.sort)) ?? 'featured'
  // "Show more deals" grows this in batches; any filter or sort change starts again from one batch
  const show = Math.max(BATCH, Math.floor(Number(first(sp.show))) || 0)

  const state: Record<Filter | 'sort' | 'show', string | undefined> = { i, discount: discount ? String(discount) : undefined, price, rating: rating ? '4' : undefined, sort: sort === 'featured' ? undefined : sort, show: undefined }
  const href = (patch: Partial<typeof state>) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) q.set(k, v)
    return q.size ? `/deals?${q}` : '/deals'
  }

  const { currency } = await getRegion()
  const priceText = (key: string) => priceLabel(PRICES[key].min || undefined, Number.isFinite(PRICES[key].max) ? PRICES[key].max : undefined, currency)
  const all = deals(Infinity)
  // counts ignore the facet's own filter so its other options stay visible
  const pass = (p: Product, skip?: Filter) =>
    (skip === 'i' || !i || inScope(p, i)) &&
    (skip === 'discount' || !discount || p.discount >= discount) &&
    (skip === 'price' || !price || (p.price >= PRICES[price].min && p.price < PRICES[price].max)) &&
    (skip === 'rating' || !rating || p.rating >= rating)
  const count = (skip: Filter, test: (p: Product) => boolean) => all.filter((p) => pass(p, skip) && test(p)).length
  const results = all.filter((p) => pass(p)).sort(SORTS[sort][1])
  const inCart = await cartQuantities()

  const applied = (
    [
      [i && scopeLabel(i), { i: undefined }],
      [discount && `${discount}% off or more`, { discount: undefined }],
      [price && priceText(price), { price: undefined }],
      [rating && '4 Stars & Up', { rating: undefined }],
    ] as const
  ).filter(([label]) => label)
  const active = applied.length

  // the chips pick a department; the rail refines within it (categories), so there is one department control
  const dept = i ? DEPARTMENTS.find((d) => d.slug === i || d.categories.includes(i)) : undefined
  const departments = DEPARTMENTS.filter((d) => d === dept || count('i', (p) => inScope(p, d.slug)) > 0)
  const categories = dept ? dept.categories.filter((c) => c === i || count('i', (p) => p.category === c) > 0) : []
  const prices = Object.entries(PRICES).filter(([key, { currency: c, min, max }]) => key === price || (c === currency && count('price', (p) => p.price >= min && p.price < max) > 0))
  const discounts = DISCOUNTS.filter((d) => d === discount || count('discount', (p) => p.discount >= d) > 0)
  const chip = (selected: boolean) =>
    `block rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap ${selected ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:bg-[#f7fafa]'}`

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6">
      <h1 className="text-[28px] leading-9 font-bold">Today&apos;s Deals</h1>

      <nav aria-label="Deal departments" className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex gap-2 pb-1">
          <li><Link href={href({ i: undefined })} aria-current={!i ? 'true' : undefined} className={chip(!i)}>All</Link></li>
          {departments.map((d) => (
            <li key={d.slug}>
              <Link href={href({ i: i === d.slug ? undefined : d.slug })} aria-current={dept === d ? 'true' : undefined} className={chip(dept === d)}>{d.name}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 lg:flex lg:gap-8">
        <aside aria-label="Filters" className="mb-4 lg:sticky lg:top-4 lg:mb-0 lg:max-h-[calc(100vh-2rem)] lg:w-[210px] lg:shrink-0 lg:self-start lg:overflow-y-auto">
          <FilterToggle label={active ? `Filters (${active})` : 'Filters'}>
            {dept && (categories.length > 1 || i !== dept.slug) && (
              <Facet title="Category" clear={i !== dept.slug ? href({ i: dept.slug }) : undefined}>
                {categories.map((c) => (
                  <Option key={c} href={href({ i: c === i ? dept.slug : c })} active={i === c}>{CATEGORY_NAMES[c]}</Option>
                ))}
              </Facet>
            )}

            {(rating || count('rating', (p) => p.rating >= 4) > 0) && (
              <Facet title="Customer Reviews" clear={rating ? href({ rating: undefined }) : undefined}>
                <Option href={href({ rating: rating ? undefined : '4' })} active={!!rating}>
                  <span aria-hidden className="flex items-center gap-1"><Stars rating={4} className="h-4" /> &amp; Up</span>
                  <span className="sr-only">4 Stars &amp; Up</span>
                </Option>
              </Facet>
            )}

            {prices.length > 0 && (
              <Facet title="Price" clear={price && href({ price: undefined })}>
                {prices.map(([key]) => (
                  <Option key={key} href={href({ price: key === price ? undefined : key })} active={key === price}>{priceText(key)}</Option>
                ))}
              </Facet>
            )}

            {discounts.length > 0 && (
              <Facet title="Discount" clear={discount ? href({ discount: undefined }) : undefined}>
                {discounts.map((d) => (
                  <Option key={d} href={href({ discount: d === discount ? undefined : String(d) })} active={d === discount}>{d}% off or more</Option>
                ))}
              </Facet>
            )}
          </FilterToggle>
        </aside>

        <section aria-labelledby="deal-count" className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <h2 id="deal-count" className="text-sm font-normal">
              {plural(results.length, 'deal')}
              {i && <> in <b>{scopeLabel(i)}</b></>}
            </h2>
            {results.length > 1 && (
              <SortSelect
                value={sort}
                options={Object.entries(SORTS).map(([key, [label]]) => [key, label])}
                keep={Object.fromEntries(Object.entries(state).filter((e): e is [string, string] => e[0] !== 'sort' && !!e[1]))}
              />
            )}
          </div>

          {results.length ? (
            <>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {results.slice(0, show).map((p, n) => (
                  <li key={p.id}><DealCard product={p} inCart={inCart.get(p.id)} priority={n < 5} /></li>
                ))}
              </ul>
              {results.length > show && (
                <div className="mt-8 flex flex-col items-center gap-2 text-sm text-muted">
                  <p>Showing {show} of {results.length} deals</p>
                  <Link href={href({ show: String(show + BATCH) })} scroll={false} className="btn btn-plain btn-lg">Show more deals</Link>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-line px-6 py-10 text-center">
              <p className="text-lg font-bold">{active ? 'No deals match your filters' : 'There are no deals right now'}</p>
              <p className="mt-1 text-sm text-muted">{active ? 'Remove a filter to see more deals.' : 'New deals are added every day. Check back soon.'}</p>
              {active > 0 && (
                <>
                  <ul className="mt-4 flex flex-wrap justify-center gap-2">
                    {applied.map(([label, patch]) => (
                      <li key={String(label)}>
                        <Link href={href(patch)} aria-label={`Remove filter: ${label}`} className={chip(false)}>{label} <span aria-hidden>✕</span></Link>
                      </li>
                    ))}
                  </ul>
                  <Link href="/deals" className="btn btn-cart mt-4">Clear all filters</Link>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

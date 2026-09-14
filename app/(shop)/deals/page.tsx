import type { Metadata } from 'next'
import Link from 'next/link'
import { Fragment } from 'react'
import { DealCard } from '@/components/home/deal'
import { FilterToggle } from '@/components/home/filter-toggle'
import { inScope, scopeLabel } from '@/components/home/scope'
import { Stars } from '@/components/stars'
import { CATEGORY_NAMES, deals, DEPARTMENTS, popularity, type Product } from '@/lib/catalog'
import { plural } from '@/lib/format'
import { SortSelect } from './sort-select'

export const metadata: Metadata = { title: "Today's Deals" }

const DISCOUNTS = [10, 15, 20, 25, 50]
const PRICES: Record<string, [label: string, min: number, max: number]> = {
  'under-25': ['Up to $25', 0, 25],
  '25-50': ['$25 to $50', 25, 50],
  '50-100': ['$50 to $100', 50, 100],
  '100-200': ['$100 to $200', 100, 200],
  '200-up': ['$200 & Above', 200, Infinity],
}
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

function Option({ href, active, indent = false, children }: { href: string; active: boolean; indent?: boolean; children: React.ReactNode }) {
  return (
    <li className={indent ? 'pl-3' : ''}>
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

  const state: Record<Filter | 'sort', string | undefined> = { i, discount: discount ? String(discount) : undefined, price, rating: rating ? '4' : undefined, sort: sort === 'featured' ? undefined : sort }
  const href = (patch: Partial<typeof state>) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...state, ...patch })) if (v) q.set(k, v)
    return q.size ? `/deals?${q}` : '/deals'
  }

  const all = deals(Infinity)
  // counts ignore the facet's own filter so its other options stay visible
  const pass = (p: Product, skip?: Filter) =>
    (skip === 'i' || !i || inScope(p, i)) &&
    (skip === 'discount' || !discount || p.discount >= discount) &&
    (skip === 'price' || !price || (p.price >= PRICES[price][1] && p.price < PRICES[price][2])) &&
    (skip === 'rating' || !rating || p.rating >= rating)
  const count = (skip: Filter, test: (p: Product) => boolean) => all.filter((p) => pass(p, skip) && test(p)).length
  const results = all.filter((p) => pass(p)).sort(SORTS[sort][1])
  const active = [i, discount, price, rating].filter(Boolean).length

  const dept = i ? DEPARTMENTS.find((d) => d.slug === i || d.categories.includes(i)) : undefined
  const departments = DEPARTMENTS.filter((d) => d === dept || count('i', (p) => inScope(p, d.slug)) > 0)
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
        <aside aria-label="Filters" className="mb-4 lg:mb-0 lg:w-[210px] lg:shrink-0">
          <FilterToggle label={active ? `Filters (${active})` : 'Filters'}>
            <Facet title="Department" clear={i && href({ i: undefined })}>
              <Option href={href({ i: undefined })} active={!i}>Any Department</Option>
              {departments.map((d) => (
                <Fragment key={d.slug}>
                  <Option href={href({ i: d.slug })} active={i === d.slug}>{d.name}</Option>
                  {dept === d &&
                    d.categories
                      .filter((c) => c === i || count('i', (p) => p.category === c) > 0)
                      .map((c) => (
                        <Option key={c} href={href({ i: c })} active={i === c} indent>{CATEGORY_NAMES[c]}</Option>
                      ))}
                </Fragment>
              ))}
            </Facet>

            {(rating || count('rating', (p) => p.rating >= 4) > 0) && (
              <Facet title="Customer Reviews" clear={rating ? href({ rating: undefined }) : undefined}>
                <Option href={href({ rating: rating ? undefined : '4' })} active={!!rating}>
                  <span aria-hidden className="flex items-center gap-1"><Stars rating={4} className="h-4" /> &amp; Up</span>
                  <span className="sr-only">4 Stars &amp; Up</span>
                </Option>
              </Facet>
            )}

            <Facet title="Price" clear={price && href({ price: undefined })}>
              {Object.entries(PRICES)
                .filter(([key, [, min, max]]) => key === price || count('price', (p) => p.price >= min && p.price < max) > 0)
                .map(([key, [label]]) => (
                  <Option key={key} href={href({ price: key === price ? undefined : key })} active={key === price}>{label}</Option>
                ))}
            </Facet>

            <Facet title="Discount" clear={discount ? href({ discount: undefined }) : undefined}>
              {DISCOUNTS.filter((d) => d === discount || count('discount', (p) => p.discount >= d) > 0).map((d) => (
                <Option key={d} href={href({ discount: d === discount ? undefined : String(d) })} active={d === discount}>{d}% off or more</Option>
              ))}
            </Facet>
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
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {results.map((p) => (
                <li key={p.id}><DealCard product={p} /></li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-line px-6 py-10 text-center">
              <p className="text-lg font-bold">{active ? 'No deals match your filters' : 'There are no deals right now'}</p>
              <p className="mt-1 text-sm text-muted">{active ? 'Try another department or a smaller discount.' : 'New deals are added every day. Check back soon.'}</p>
              {active > 0 && <Link href="/deals" className="btn btn-cart mt-4">Clear all filters</Link>}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

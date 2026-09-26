import type { Metadata } from 'next'
import Link from 'next/link'
import { Fragment } from 'react'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { CloseIcon, SearchIcon } from '@/components/icons'
import { ProductCard, shotBox } from '@/components/product-card'
import { ProductCarousel } from '@/components/product-carousel'
import { LinkPending, ShowResults } from '@/components/search/controls'
import { FeaturedCategories } from '@/components/search/featured-categories'
import { Filters } from '@/components/search/filters'
import { PER_PAGE, appliedFilters, clearFilters, departmentOf, parseQuery, toHref, toSearch, withoutFilters, type Chip, type Query } from '@/components/search/params'
import { SortSelect } from '@/components/search/sort-select'
import { SearchTitle } from '@/components/search/title'
import { correctSpelling } from '@/components/search/spelling'
import { cartQuantities } from '@/lib/cart'
import { DEPARTMENTS, SORTS, bestSellers, scopeName, search } from '@/lib/catalog'
import type { CurrencyCode } from '@/lib/region'
import { getRegion } from '@/lib/region-server'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
type Facets = ReturnType<typeof search>['facets']

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseQuery(await searchParams)
  return { title: { absolute: `nile.com : ${q.k || (q.i && scopeName(q.i)) || 'All Departments'}` } }
}

const FILTERS_ID = 'search-filters'
// docs/design.md: chips are hairline pills on paper, never coloured fills
const pill = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm whitespace-nowrap hover:bg-page'
const shell = 'mx-auto max-w-[1120px] px-4'
const plural = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'result' : 'results'}`

export default async function SearchPage({ searchParams }: Props) {
  const q = parseQuery(await searchParams)
  const { currency } = await getRegion()
  let k = q.k
  let r = search(toSearch(q, k, currency))
  const fix = !r.total && q.k && !q.nfpr ? correctSpelling(q.k) : null
  const fixed = fix ? search(toSearch(q, fix, currency)) : null
  if (fix && fixed?.total) [k, r] = [fix, fixed]

  const base = toSearch(q, k, currency)
  const chips = appliedFilters(q, currency)
  const showFilters = r.total > 0 || chips.length > 0
  const dept = q.i ? departmentOf(q.i) : undefined
  const scope = !q.i ? '' : dept && dept.slug !== q.i ? `${dept.name} : ${scopeName(q.i)}` : scopeName(q.i)
  const start = (r.page - 1) * PER_PAGE + 1
  const inCart = await cartQuantities()

  // one tap, only when they narrow without emptying the page
  const quick = [
    ...(q.rating ? [] : [{ label: '4 Stars & Up', href: toHref(q, { rating: 4 }), n: search({ ...base, rating: 4, perPage: 1 }).total }]),
    ...(q.brand.length ? [] : r.facets.brands.slice(0, 3).map((b) => ({ label: b.name, href: toHref(q, { brand: [b.name] }), n: b.count }))),
  ].filter((c) => c.n > 0 && c.n < r.total)

  const tabTitle = `nile.com : ${k || (q.i && scopeName(q.i)) || 'All Departments'}`

  return (
    <div className="group/search pb-16">
      <SearchTitle title={tabTitle} />
      {r.total > 0 && (
        // the count is the page's title, set in the serif, with the sort control opposite it
        <div className={`${shell} flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 pt-8 pb-5`}>
          <h1 className="min-w-0 text-[26px] leading-9 break-words">
            {r.pages > 1 ? `${start}-${start + r.items.length - 1} of ${plural(r.total)}` : plural(r.total)}
            {k && <> for <span className="text-accent">&quot;{k}&quot;</span></>}
            {scope && <> {k ? 'in' : 'for'} <span className="text-accent">{scope}</span></>}
          </h1>
          <SortSelect key={q.sort} value={q.sort} options={SORTS.map((s) => ({ ...s, href: toHref(q, { sort: s.key }) }))} />
        </div>
      )}

      <div className={`${shell} flex gap-10 ${r.total > 0 ? 'border-t border-line pt-8' : 'pt-8'}`}>
        {showFilters && (
          // One filter panel: a rail on desktop, a native popover drawer on mobile (Esc and backdrop close it, no JS needed)
          <aside
            id={FILTERS_ID}
            popover="auto"
            aria-label="Filters"
            className="m-0 h-dvh max-h-none w-[min(100vw,400px)] max-w-none border-0 bg-surface p-0 text-ink backdrop:bg-black/50 lg:static lg:block lg:h-auto lg:w-[220px] lg:shrink-0 lg:overflow-visible lg:bg-transparent"
          >
            <div className="flex h-full flex-col lg:block lg:h-auto">
              <div className="flex items-center justify-between border-b border-line py-3 pr-3 pl-4 lg:hidden">
                <h2 className="text-lg">Filters</h2>
                <button type="button" popoverTarget={FILTERS_ID} popoverTargetAction="hide" aria-label="Close filters" className="cursor-pointer p-2.5">
                  <CloseIcon className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 lg:overflow-visible lg:px-0">
                <Filters q={q} base={base} facets={r.facets} currency={currency} />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 lg:hidden">
                {chips.length > 0 ? <Link href={clearFilters(q)} className="link text-sm">Clear Filters</Link> : <span />}
                <ShowResults key={toHref(q)} popover={FILTERS_ID} total={r.total} />
              </div>
            </div>
          </aside>
        )}

        {/* dims while any filter, sort or page navigation is pending */}
        <div className="min-w-0 flex-1 transition-opacity group-has-[[data-pending]]/search:opacity-50">
          {showFilters && (
            // mobile: one horizontally scrolling row; desktop: applied chips only
            <div className={`-mx-4 mb-5 flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0 ${chips.length ? 'lg:flex-wrap' : 'lg:hidden'}`}>
              <button type="button" popoverTarget={FILTERS_ID} className={`${pill} lg:hidden`}>
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                  <path d="M1 4h9M13 4h2M1 12h3M7 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="11.5" cy="4" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="5.5" cy="12" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Filters{chips.length > 0 && ` (${chips.length})`}
              </button>
              <Chips chips={chips} />
              {quick.map((c) => (
                <Link key={c.href} href={c.href} className={`${pill} lg:hidden`}>{c.label}<LinkPending /></Link>
              ))}
              {chips.length > 0 && <Link href={clearFilters(q)} className="link shrink-0 px-1 text-sm whitespace-nowrap">Clear all<LinkPending /></Link>}
            </div>
          )}

          {k !== q.k && (
            <div className="mb-6">
              <p className="text-lg">Showing results for <span className="text-accent italic">{k}</span></p>
              <p className="text-sm text-muted">
                Search instead for <Link href={toHref(q, { nfpr: true })} className="link">{q.k}</Link>
              </p>
            </div>
          )}

          {r.total > 0 ? (
            <>
              {/* a department's own page (not a search inside it) opens on its categories */}
              {dept?.slug === q.i && !q.k && r.page === 1 && <FeaturedCategories categories={dept.categories} />}
              <h2 className="sr-only">Results</h2>
              {/* phones get a one-column list card (image left); the card's own markup stays a grid tile elsewhere */}
              <ul className="grid gap-x-8 gap-y-10 max-sm:[&>li>article]:flex-row max-sm:[&>li>article]:gap-4 max-sm:[&>li>article>div:first-child]:w-[38%] max-sm:[&>li>article>div:first-child]:shrink-0 max-sm:[&>li>article>div:first-child]:self-start max-sm:[&>li>article>div:last-child]:pt-0 sm:grid-cols-2 lg:grid-cols-3">
                {r.items.map((p, i) => (
                  <li key={p.id}>
                    <ProductCard product={p} priority={i < 4}>{p.stock > 0 && <AddToCartButton productId={p.id} inCart={inCart.get(p.id)} />}</ProductCard>
                  </li>
                ))}
              </ul>
              {k && <RelatedSearches k={k} facets={r.facets} />}
              <Pagination q={q} page={r.page} pages={r.pages} />
            </>
          ) : (
            <NoResults q={q} k={fix ?? q.k} chips={chips} currency={currency} />
          )}
        </div>
      </div>
    </div>
  )
}

function Chips({ chips }: { chips: Chip[] }) {
  if (!chips.length) return null
  return (
    <ul aria-label="Applied filters" className="contents">
      {chips.map((c) => (
        <li key={c.href} className="shrink-0">
          <Link href={c.href} aria-label={`Remove filter: ${c.label}`} className={`${pill} border-ink pr-3`}>
            {c.label}
            <CloseIcon className="size-3.5" />
            <LinkPending />
          </Link>
        </li>
      ))}
    </ul>
  )
}

// Refinements built from the results' own categories and brands, so every tile leads to results
function RelatedSearches({ k, facets }: { k: string; facets: Facets }) {
  const lk = k.toLowerCase().replace(/\s+/g, ' ')
  const cats = facets.categories.filter((c) => c.count > 1).map((c) => {
    const name = c.name.toLowerCase()
    return name.includes(lk.replace(/s$/, '')) ? name : `${lk} ${name}`
  })
  const brands = facets.brands.map((b) => b.name.toLowerCase()).filter((b) => !lk.includes(b) && !b.includes(lk)).map((b) => `${b} ${lk}`)
  const terms = [...new Set([...cats.slice(0, 2), ...brands, ...cats.slice(2)])].filter((t) => t !== lk).slice(0, 6)
  if (!terms.length) return null
  return (
    <section aria-labelledby="related-searches" className="mt-14 border-t border-line pt-8">
      <h2 id="related-searches" className="mb-4 text-lg">Related searches</h2>
      <ul className="flex flex-wrap gap-2">
        {terms.map((t) => (
          <li key={t}>
            <Link href={`/s?${new URLSearchParams({ k: t })}`} className={pill}>
              <SearchIcon className="size-4 shrink-0 text-muted" />
              <span className="truncate">{t}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Pagination({ q, page, pages }: { q: Query; page: number; pages: number }) {
  if (pages < 2) return null
  const nums = [...new Set([1, page - 1, page, page + 1, page <= 2 ? 3 : 0, page >= pages - 1 ? pages - 2 : 0, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b)
  // quiet numbers on paper: the current page is the only marked one
  const cell = 'price flex h-10 min-w-10 items-center justify-center rounded-md px-3 text-sm'
  return (
    <nav aria-label="Pagination" className="mt-14 flex justify-center border-t border-line pt-8">
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={toHref(q, { page: page - 1 })} rel="prev" className={`${cell} hover:bg-page`}>‹ Previous<LinkPending /></Link>
        ) : (
          <span aria-disabled="true" className={`${cell} text-muted/60`}>‹ Previous</span>
        )}
        {nums.map((n, idx) => (
          <Fragment key={n}>
            {idx > 0 && n - nums[idx - 1] > 1 && <span aria-hidden className={`${cell} px-1 text-muted`}>…</span>}
            {n === page ? (
              <span aria-current="page" className={`${cell} bg-accent font-medium text-white`}>{n}</span>
            ) : (
              <Link href={toHref(q, { page: n })} aria-label={`Page ${n}`} className={`${cell} hover:bg-page`}>{n}<LinkPending /></Link>
            )}
          </Fragment>
        ))}
        {page < pages ? (
          <Link href={toHref(q, { page: page + 1 })} rel="next" className={`${cell} hover:bg-page`}>Next ›<LinkPending /></Link>
        ) : (
          <span aria-disabled="true" className={`${cell} text-muted/60`}>Next ›</span>
        )}
      </div>
    </nav>
  )
}

// `k` is the query after any spelling fix
function NoResults({ q, k, chips, currency }: { q: Query; k: string; chips: Chip[]; currency: CurrencyCode }) {
  const count = (x: Query) => search({ ...toSearch(x, k, currency), perPage: 1 }).total
  // when the query has results and only the filters emptied the page, blame the filters and offer one-click ways back
  const all = chips.length ? count(withoutFilters(q)) : 0
  const ways = all ? chips.map((c) => ({ ...c, n: count(c.without) })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n) : []

  return (
    <div>
      <section className="pb-10">
        {all > 0 ? (
          <>
            <h1 className="text-[26px] leading-9 break-words">
              No results for {k || 'these filters'}
              {k && <> with {new Intl.ListFormat('en-US').format(chips.map((c) => c.label))}</>}.
            </h1>
            <p className="mt-2 text-muted">Remove a filter to see results.</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {ways.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="btn btn-plain">Remove {c.label} ({plural(c.n)})</Link>
                </li>
              ))}
              {chips.length > 1 && (
                <li><Link href={clearFilters(q)} className="btn btn-plain">Clear all filters ({plural(all)})</Link></li>
              )}
            </ul>
          </>
        ) : (
          <>
            <h1 className="text-[26px] leading-9 break-words">
              No results for {q.k || 'these filters'}
              {q.i && <> in {scopeName(q.i)}</>}.
            </h1>
            <p className="mt-2 text-muted">Try checking your spelling or use more general terms</p>
            {chips.length > 0 && <p className="mt-4 text-sm"><Link href={clearFilters(q)} className="link">Clear all filters</Link></p>}
          </>
        )}
      </section>

      <section aria-labelledby="popular-departments" className="border-t border-line pt-8 pb-10">
        <h2 id="popular-departments" className="mb-5 text-lg">Popular departments</h2>
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {DEPARTMENTS.map((d) => {
            const p = bestSellers(d.categories[0], 1)[0]
            return (
              <li key={d.slug}>
                <Link href={`/s?i=${d.slug}`} className="group block text-center text-sm">
                  <span className={`${shotBox} aspect-square p-5`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p && <img src={p.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />}
                  </span>
                  <span className="mt-2.5 block group-hover:underline">{d.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="-mx-4">
        <ProductCarousel title="Best Sellers" products={bestSellers(undefined, 12)} href="/bestsellers" />
      </div>
    </div>
  )
}

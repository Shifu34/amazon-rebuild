import type { Metadata } from 'next'
import Link from 'next/link'
import { Fragment } from 'react'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { CloseIcon } from '@/components/icons'
import { ProductCard } from '@/components/product-card'
import { ProductCarousel } from '@/components/product-carousel'
import { Filters } from '@/components/search/filters'
import { PER_PAGE, appliedFilters, clearFilters, departmentOf, parseQuery, toHref, toSearch, type Chip, type Query } from '@/components/search/params'
import { SortSelect } from '@/components/search/sort-select'
import { correctSpelling } from '@/components/search/spelling'
import { DEPARTMENTS, SORTS, bestSellers, scopeName, search } from '@/lib/catalog'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseQuery(await searchParams)
  return { title: { absolute: `nile.com : ${q.k || (q.i && scopeName(q.i)) || 'All Departments'}` } }
}

const FILTERS_ID = 'search-filters'

export default async function SearchPage({ searchParams }: Props) {
  const q = parseQuery(await searchParams)
  let k = q.k
  let r = search(toSearch(q))
  const fix = !r.total && q.k && !q.nfpr ? correctSpelling(q.k) : null
  const fixed = fix ? search(toSearch(q, fix)) : null
  if (fix && fixed?.total) [k, r] = [fix, fixed]

  const chips = appliedFilters(q)
  const showFilters = r.total > 0 || chips.length > 0
  const dept = q.i ? departmentOf(q.i) : undefined
  const scope = !q.i ? '' : dept && dept.slug !== q.i ? `${dept.name} : ${scopeName(q.i)}` : scopeName(q.i)
  const start = (r.page - 1) * PER_PAGE + 1

  return (
    <div className="pb-10">
      {r.total > 0 && (
        <div className="border-b border-line shadow-[0_2px_4px_-2px_rgba(15,17,17,0.15)]">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
            <h1 className="text-sm font-normal break-words">
              {r.pages > 1 ? `${start}-${start + r.items.length - 1} of ${r.total.toLocaleString('en-US')} results` : `${r.total} ${r.total === 1 ? 'result' : 'results'}`}
              {k && <> for <span className="font-bold text-[#c45500]">&quot;{k}&quot;</span></>}
              {scope && <> {k ? 'in' : 'for'} <span className="font-bold">{scope}</span></>}
            </h1>
            <SortSelect key={q.sort} value={q.sort} options={SORTS.map((s) => ({ ...s, href: toHref(q, { sort: s.key }) }))} />
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 pt-4">
        {showFilters && (
          // One filter panel: a sidebar on desktop, a native popover drawer on mobile (Esc and backdrop close it, no JS needed)
          <aside
            id={FILTERS_ID}
            popover="auto"
            aria-label="Filters"
            className="m-0 h-dvh max-h-none w-[min(100vw,400px)] max-w-none border-0 bg-white p-0 text-ink backdrop:bg-black/60 lg:static lg:block lg:h-auto lg:w-60 lg:shrink-0 lg:overflow-visible lg:bg-transparent"
          >
            <div className="flex h-full flex-col lg:block lg:h-auto">
              <div className="flex items-center justify-between border-b border-line py-2 pr-2 pl-4 lg:hidden">
                <h2 className="text-lg">Filters</h2>
                <button type="button" popoverTarget={FILTERS_ID} popoverTargetAction="hide" aria-label="Close filters" className="cursor-pointer p-2.5">
                  <CloseIcon className="size-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 lg:overflow-visible lg:px-0">
                <Filters q={q} base={toSearch(q, k)} facets={r.facets} />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 lg:hidden">
                {chips.length > 0 ? <Link href={clearFilters(q)} className="link text-sm">Clear Filters</Link> : <span />}
                <button type="button" popoverTarget={FILTERS_ID} popoverTargetAction="hide" className="btn btn-cart btn-lg">
                  Show {r.total.toLocaleString('en-US')} {r.total === 1 ? 'result' : 'results'}
                </button>
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">
          {showFilters && (
            <div className="mb-4 flex flex-wrap items-center gap-2 empty:hidden">
              <button type="button" popoverTarget={FILTERS_ID} className="select-pill inline-flex h-8 items-center gap-1.5 lg:hidden">
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                  <path d="M1 4h9M13 4h2M1 12h3M7 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="11.5" cy="4" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="5.5" cy="12" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Filters{chips.length > 0 && ` (${chips.length})`}
              </button>
              <Chips chips={chips} clearHref={clearFilters(q)} />
            </div>
          )}

          {k !== q.k && (
            <div className="mb-4">
              <p className="text-lg">Showing results for <b className="text-[#c45500] italic">{k}</b></p>
              <p className="text-sm">
                Search instead for <Link href={toHref(q, { nfpr: true })} className="link">{q.k}</Link>
              </p>
            </div>
          )}

          {r.total > 0 ? (
            <>
              <h2 className="mb-3 text-xl">Results</h2>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
                {r.items.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p}>{p.stock > 0 && <AddToCartButton productId={p.id} />}</ProductCard>
                  </li>
                ))}
              </ul>
              <Pagination q={q} page={r.page} pages={r.pages} />
            </>
          ) : (
            <NoResults q={q} filtered={chips.length > 0} />
          )}
        </div>
      </div>
    </div>
  )
}

function Chips({ chips, clearHref }: { chips: Chip[]; clearHref: string }) {
  if (!chips.length) return null
  return (
    <>
      <ul aria-label="Applied filters" className="contents">
        {chips.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              aria-label={`Remove filter: ${c.label}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink bg-white pr-2.5 pl-3 text-[13px] hover:bg-[#f7fafa]"
            >
              {c.label}
              <CloseIcon className="size-3.5" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href={clearHref} className="link px-1 text-[13px]">Clear all</Link>
    </>
  )
}

function Pagination({ q, page, pages }: { q: Query; page: number; pages: number }) {
  if (pages < 2) return null
  const nums = [...new Set([1, page - 1, page, page + 1, page <= 2 ? 3 : 0, page >= pages - 1 ? pages - 2 : 0, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b)
  const cell = 'flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm'
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={toHref(q, { page: page - 1 })} rel="prev" className={`${cell} hover:bg-[#f7fafa]`}>‹ Previous</Link>
      ) : (
        <span aria-disabled="true" className={`${cell} text-[#6f7373]`}>‹ Previous</span>
      )}
      {nums.map((n, idx) => (
        <Fragment key={n}>
          {idx > 0 && n - nums[idx - 1] > 1 && <span aria-hidden className={cell}>…</span>}
          {n === page ? (
            <span aria-current="page" className={`${cell} border border-ink font-bold`}>{n}</span>
          ) : (
            <Link href={toHref(q, { page: n })} aria-label={`Page ${n}`} className={`${cell} hover:bg-[#f7fafa]`}>{n}</Link>
          )}
        </Fragment>
      ))}
      {page < pages ? (
        <Link href={toHref(q, { page: page + 1 })} rel="next" className={`${cell} hover:bg-[#f7fafa]`}>Next ›</Link>
      ) : (
        <span aria-disabled="true" className={`${cell} text-[#6f7373]`}>Next ›</span>
      )}
    </nav>
  )
}

function NoResults({ q, filtered }: { q: Query; filtered: boolean }) {
  return (
    <div>
      <section className="pb-8">
        <h1 className="text-xl leading-7 font-normal break-words">
          <b>No results for</b> {q.k || 'these filters'}
          {q.i && <> in {scopeName(q.i)}</>}.
        </h1>
        <p className="mt-1 text-sm">Try checking your spelling or use more general terms</p>
        {(filtered || (q.i && q.k)) && (
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
            {filtered && <li><Link href={clearFilters(q)} className="link">Clear all filters</Link></li>}
            {q.i && q.k && <li><Link href={toHref(q, { i: '' })} className="link">Search &quot;{q.k}&quot; in all departments</Link></li>}
          </ul>
        )}
      </section>

      <section aria-labelledby="popular-departments" className="border-t border-line pt-6 pb-8">
        <h2 id="popular-departments" className="mb-3 text-xl">Popular departments</h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
          {DEPARTMENTS.map((d) => {
            const p = bestSellers(d.categories[0], 1)[0]
            return (
              <li key={d.slug}>
                <Link href={`/s?i=${d.slug}`} className="group block text-center text-sm">
                  <span className="flex aspect-square items-center justify-center rounded-lg bg-[#f7f7f7] p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p && <img src={p.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />}
                  </span>
                  <span className="mt-1.5 block group-hover:text-link-hover group-hover:underline">{d.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="-mx-4 border-t border-line">
        <ProductCarousel title="Best Sellers" products={bestSellers(undefined, 12)} href="/bestsellers" />
      </div>
    </div>
  )
}

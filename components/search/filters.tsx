import Link from 'next/link'
import { Fragment } from 'react'
import { Stars } from '@/components/stars'
import { DEPARTMENTS, categoryName, search, type SearchParams } from '@/lib/catalog'
import { LinkPending, PriceForm } from './controls'
import { PRICE_RANGES, departmentOf, priceLabel, toHref, type Query } from './params'

type Facets = ReturnType<typeof search>['facets']
type Department = (typeof DEPARTMENTS)[number]

// dense on desktop like Amazon's rail (about 22px rows), roomy touch targets in the mobile drawer
const row = 'flex items-center gap-2 py-2 text-sm hover:text-link-hover lg:py-px'

function Section({ title, clear, children }: { title: string; clear?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="border-b border-line py-4 last:border-0 lg:border-0 lg:py-2.5">
      <h3 className="text-sm">{title}</h3>
      {clear && <Link href={clear} className="link text-xs">Clear<LinkPending /></Link>}
      <ul className="mt-1">{children}</ul>
    </section>
  )
}

const Count = ({ n }: { n: number }) => <span className="font-normal text-muted">({n.toLocaleString('en-US')})</span>

// Filters are links (work without JS, shareable). Checkbox options expose role=checkbox; single choices use aria-current.
function Item({ href, on = false, checkbox = false, className = '', children }: { href: string; on?: boolean; checkbox?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        role={checkbox ? 'checkbox' : undefined}
        aria-checked={checkbox ? on : undefined}
        aria-current={!checkbox && on ? 'true' : undefined}
        className={`${row} ${on ? 'font-bold' : ''} ${className}`}
      >
        {checkbox && (
          <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-[3px] border text-[11px] leading-none text-white ${on ? 'border-link bg-link' : 'border-[#888c8c] bg-white'}`}>
            {on && '✓'}
          </span>
        )}
        {children}
        <LinkPending />
      </Link>
    </li>
  )
}

function SeeMore({ label, open, children }: { label: string; open: boolean; children: React.ReactNode }) {
  return (
    <li>
      <details open={open} className="group">
        <summary className="link cursor-pointer list-none py-2 text-sm lg:py-px [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">▾ {label}</span>
          <span className="hidden group-open:inline">▴ See less</span>
        </summary>
        <ul>{children}</ul>
      </details>
    </li>
  )
}

function Departments({ q, facets }: { q: Query; facets: Facets }) {
  const counts = new Map(facets.categories.map((c) => [c.slug, c.count]))
  const children = (d: Department) => d.categories.filter((c) => counts.has(c) || c === q.i)
  const total = (d: Department) => d.categories.reduce((n, c) => n + (counts.get(c) ?? 0), 0)
  const child = (c: string) =>
    c === q.i ? (
      <li key={c} className="py-2 pl-4 text-sm font-bold lg:py-px">{categoryName(c)}</li>
    ) : (
      <Item key={c} href={toHref(q, { i: c })} className="pl-4">{categoryName(c)} <Count n={counts.get(c) ?? 0} /></Item>
    )

  const current = q.i ? departmentOf(q.i) : undefined
  if (current) {
    return (
      <Section title="Department">
        <Item href={toHref(q, { i: '' })}>‹ Any Department</Item>
        {q.i === current.slug ? (
          <li className="py-2 text-sm font-bold lg:py-px">{current.name}</li>
        ) : (
          <Item href={toHref(q, { i: current.slug })}>‹ {current.name}</Item>
        )}
        {children(current).map(child)}
      </Section>
    )
  }

  const depts = DEPARTMENTS.filter((d) => total(d) > 0)
  if (!depts.length) return null
  const tree = (d: Department) => (
    <Fragment key={d.slug}>
      <Item href={toHref(q, { i: d.slug })}>{d.name} <Count n={total(d)} /></Item>
      {children(d).map(child)}
    </Fragment>
  )
  return (
    <Section title="Department">
      {depts.slice(0, 3).map(tree)}
      {depts.length > 3 && <SeeMore label={`See all ${depts.length} Departments`} open={false}>{depts.slice(3).map(tree)}</SeeMore>}
    </Section>
  )
}

// `base` is the effective search (after any spelling fix); counts are what each option would return
export function Filters({ q, base, facets }: { q: Query; base: SearchParams; facets: Facets }) {
  const count = (patch: Partial<SearchParams>) => search({ ...base, ...patch, page: 1, perPage: 1 }).total
  const ratingCounts = [4, 3, 2, 1].map((rating) => count({ rating }))
  const priceCounts = PRICE_RANGES.map(([min, max]) => count({ min, max }))
  const dealCount = count({ deals: true })
  const outOfStock = count({ inStock: false }) - count({ inStock: true })
  const hasPrice = q.min !== undefined || q.max !== undefined

  const brands = [...facets.brands, ...q.brand.filter((b) => !facets.brands.some((f) => f.name === b)).map((name) => ({ name, count: 0 }))]
  const brandItem = (b: { name: string; count: number }) => {
    const on = q.brand.includes(b.name)
    return (
      <Item key={b.name} checkbox on={on} href={toHref(q, { brand: on ? q.brand.filter((x) => x !== b.name) : [...q.brand, b.name] })}>
        {b.name} {b.count > 0 && <Count n={b.count} />}
      </Item>
    )
  }

  return (
    <div>
      <Departments q={q} facets={facets} />

      {(q.rating || ratingCounts.some(Boolean)) && (
        <Section title="Customer Reviews" clear={q.rating ? toHref(q, { rating: undefined }) : undefined}>
          {[4, 3, 2, 1].map((r, idx) => {
            const on = q.rating === r
            if (!on && !ratingCounts[idx]) return null
            return (
              <li key={r}>
                <Link
                  href={toHref(q, { rating: on ? undefined : r })}
                  aria-label={`${r} Stars & Up, ${ratingCounts[idx]} results`}
                  aria-current={on ? 'true' : undefined}
                  className={`${row} ${on ? 'font-bold' : ''}`}
                >
                  <Stars rating={r} className="h-[18px]" /> <span>&amp; Up</span> <Count n={ratingCounts[idx]} />
                  <LinkPending />
                </Link>
              </li>
            )
          })}
        </Section>
      )}

      {brands.length > 0 && (
        <Section title="Brands" clear={q.brand.length ? toHref(q, { brand: [] }) : undefined}>
          {brands.slice(0, 7).map(brandItem)}
          {brands.length > 7 && (
            <SeeMore label="See more" open={brands.slice(7).some((b) => q.brand.includes(b.name))}>{brands.slice(7).map(brandItem)}</SeeMore>
          )}
        </Section>
      )}

      <Section title="Price" clear={hasPrice ? toHref(q, { min: undefined, max: undefined }) : undefined}>
        {PRICE_RANGES.map(([min, max], idx) => {
          const on = q.min === min && q.max === max
          if (!on && !priceCounts[idx]) return null
          return (
            <Item key={idx} on={on} href={toHref(q, on ? { min: undefined, max: undefined } : { min, max })}>
              {priceLabel(min, max)} <Count n={priceCounts[idx]} />
            </Item>
          )
        })}
        <li>
          <PriceForm key={`${q.min}-${q.max}`} keep={toHref(q, { min: undefined, max: undefined }).split('?')[1] ?? ''} min={q.min} max={q.max} />
        </li>
      </Section>

      {(dealCount > 0 || q.deals) && (
        <Section title="Deals & Discounts">
          <Item checkbox on={q.deals} href={toHref(q, { deals: !q.deals })}>Today&apos;s Deals <Count n={dealCount} /></Item>
        </Section>
      )}

      {(outOfStock > 0 || q.oos) && (
        <Section title="Availability">
          <Item checkbox on={q.oos} href={toHref(q, { oos: !q.oos })}>Include Out of Stock</Item>
        </Section>
      )}
    </div>
  )
}

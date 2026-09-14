import Link from 'next/link'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { FilterToggle } from '@/components/home/filter-toggle'
import { Price } from '@/components/price'
import { Stars } from '@/components/stars'
import { CATEGORY_NAMES, DEPARTMENTS, type Product } from '@/lib/catalog'

const item = 'block rounded-sm py-1.5 hover:text-link-hover hover:underline lg:py-1'

// Header + department rail shared by the overview and each department/category list. `slug` must already be valid.
export function BestSellersLayout({ slug, children }: { slug?: string; children: React.ReactNode }) {
  const Title = slug ? 'p' : 'h1'
  const dept = slug ? DEPARTMENTS.find((d) => d.slug === slug || d.categories.includes(slug)) : undefined
  const current = slug && (dept?.slug === slug ? dept.name : CATEGORY_NAMES[slug])
  const subcategories = dept ? dept.categories.filter((c) => c !== dept.slug) : []

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
      <div className="border-b border-line pb-3">
        <Title className="text-[28px] leading-9 font-bold">nile Best Sellers</Title>
        <p className="text-sm text-muted">Our most popular products based on sales. Updated frequently.</p>
      </div>
      <div className="mt-4 lg:flex lg:gap-8">
        <nav aria-label="Best Sellers departments" className="mb-5 lg:mb-0 lg:w-[210px] lg:shrink-0">
          <FilterToggle label={`Department: ${current ?? 'Any'}`}>
            <ul className="text-sm">
              <li>
                {dept ? <Link href="/bestsellers" className={item}>‹ Any Department</Link> : <span aria-current="page" className={`${item} font-bold`}>Any Department</span>}
              </li>
              {!dept &&
                DEPARTMENTS.map((d) => (
                  <li key={d.slug} className="pl-3"><Link href={`/bestsellers/${d.slug}`} className={item}>{d.name}</Link></li>
                ))}
              {dept && (
                <li className="pl-3">
                  {dept.slug === slug ? <span aria-current="page" className={`${item} font-bold`}>{dept.name}</span> : <Link href={`/bestsellers/${dept.slug}`} className={item}>‹ {dept.name}</Link>}
                </li>
              )}
              {(subcategories.length > 1 || (dept && slug !== dept.slug)) &&
                subcategories.map((c) => (
                  <li key={c} className="pl-6">
                    {c === slug ? <span aria-current="page" className={`${item} font-bold`}>{CATEGORY_NAMES[c]}</span> : <Link href={`/bestsellers/${c}`} className={item}>{CATEGORY_NAMES[c]}</Link>}
                  </li>
                ))}
            </ul>
          </FilterToggle>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

export function RankTile({ product: p, rank, action = false }: { product: Product; rank: number; action?: boolean }) {
  const href = `/dp/${p.id}`
  return (
    <article className="relative flex h-full flex-col">
      <span className="absolute top-0 left-0 z-10 rounded-tl-lg rounded-br-lg bg-[#c45500] px-2 py-0.5 text-sm font-bold text-white">#{rank}</span>
      <Link href={href} tabIndex={-1} aria-hidden className="flex aspect-square items-center justify-center rounded-lg bg-[#f7f7f7] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
      </Link>
      <h3 className="mt-2 text-sm font-normal">
        <Link href={href} className="line-clamp-3 hover:text-link-hover hover:underline">{p.title}</Link>
      </h3>
      <div className="mt-1 flex items-center gap-1">
        <Stars rating={p.rating} className="h-3.5" />
        <span className="text-xs text-link">{p.ratingCount.toLocaleString('en-US')}</span>
      </div>
      {p.stock > 0 ? <div className="mt-1 text-lg leading-6"><Price value={p.price} /></div> : <p className="mt-1 text-sm text-danger">Currently unavailable.</p>}
      {action && p.stock > 0 && (
        <div className="mt-auto pt-2">
          <AddToCartButton productId={p.id} />
        </div>
      )}
    </article>
  )
}

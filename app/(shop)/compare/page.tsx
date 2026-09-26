import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { CompareRemove, DiffOnly } from '@/components/compare/compare'
import { COMPARE_COOKIE, COMPARE_MAX, parseCompare } from '@/components/compare/ids'
import { Price } from '@/components/price'
import { Badge } from '@/components/product-card'
import { Stars } from '@/components/stars'
import { cartQuantities } from '@/lib/cart'
import { categoryName, getProduct, type Product } from '@/lib/catalog'
import { deliveryPromise, deliveryText, relativeDay } from '@/lib/delivery'
import { myPrices } from '@/lib/price-lock'
import { getRegion } from '@/lib/region-server'

export const metadata: Metadata = { title: 'Compare products' }

// A row's `text` is what decides whether every column matches, so "Show differences only" can hide it.
type Row = { label: string; text: (p: Product) => string; cell: (p: Product) => React.ReactNode }

export default async function ComparePage() {
  const ids = parseCompare((await cookies()).get(COMPARE_COOKIE)?.value)
  const products = await myPrices(ids.map(getProduct).filter((p): p is Product => !!p))
  if (!products.length) return <Empty />

  const { currency, rate, country } = await getRegion()
  const inCart = await cartQuantities()
  const now = new Date()
  const promises = new Map(products.map((p) => [p.id, deliveryPromise(p, now, country)]))
  const delivery = (p: Product) => {
    const d = promises.get(p.id)!
    return p.stock === 0 ? 'Currently unavailable' : `${deliveryText(d, currency, rate).label} ${relativeDay(d.standard, now)}`
  }
  const stock = (p: Product) => (p.stock === 0 ? 'Currently unavailable' : p.stock < 10 ? `Only ${p.stock} left in stock` : 'In stock')

  const rows: Row[] = [
    {
      label: 'Price',
      text: (p) => String(p.price),
      cell: (p) => <span className="font-display text-[20px] leading-7"><Price value={p.price} currency={currency} rate={rate} /></span>,
    },
    { label: 'Delivery', text: delivery, cell: (p) => <span className={p.stock === 0 ? 'text-danger' : ''}>{delivery(p)}</span> },
    {
      label: 'Rating',
      text: (p) => `${p.rating} ${p.ratingCount}`,
      cell: (p) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Stars rating={p.rating} className="h-4" />
          {p.rating.toFixed(1)}
          <Link href={`/dp/${p.id}#reviews`} className="link">({p.ratingCount.toLocaleString('en-US')})</Link>
        </span>
      ),
    },
    { label: 'Customer reviews', text: (p) => String(p.reviews.length), cell: (p) => `${p.reviews.length} written` },
    { label: 'Availability', text: stock, cell: (p) => <span className={p.stock === 0 ? 'text-danger' : ''}>{stock(p)}</span> },
    { label: 'Brand', text: (p) => p.brand ?? '—', cell: (p) => p.brand ?? '—' },
    { label: 'Category', text: (p) => categoryName(p.category), cell: (p) => categoryName(p.category) },
    { label: 'Warranty', text: (p) => p.warranty, cell: (p) => p.warranty },
    { label: 'Returns', text: (p) => p.returnPolicy, cell: (p) => p.returnPolicy },
    { label: 'Ships', text: (p) => p.shipping, cell: (p) => p.shipping },
    // the catalog's weight and dimensions are unitless demo numbers ("4" for a mascara), so they stay off the table:
    // a row nobody can act on is worse than a missing one, and the product page leaves them out for the same reason
  ]

  // the first column stays put while the products scroll sideways, so it needs the page's own background behind it
  const head = 'sticky left-0 z-10 bg-paper text-left align-top text-sm font-medium text-muted'

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10">
      <h1 className="text-[28px] leading-10">Compare products</h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        {products.length} of {COMPARE_MAX} · <Link href="/s" className="link">Keep shopping</Link>
      </p>

      <DiffOnly>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Side-by-side comparison of the products you selected</caption>
            <thead>
              <tr>
                <th scope="col" className={`${head} w-[150px] min-w-[150px] border-b border-line p-4`}>
                  <span className="sr-only">Product</span>
                </th>
                {products.map((p) => (
                  <th key={p.id} scope="col" className="min-w-[210px] border-b border-line p-4 text-left align-top font-normal">
                    {/* the X rides the picture's corner, so it stays next to its product however wide the column gets */}
                    <div className="relative w-[120px]">
                      <Link href={`/dp/${p.id}`} className="flex size-[120px] items-center justify-center rounded-[10px] bg-page p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumbnail} alt={p.title} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                      </Link>
                      <span className="absolute -top-2.5 -right-2.5 rounded-full border border-line bg-surface">
                        <CompareRemove id={p.id} title={p.title} />
                      </span>
                    </div>
                    <Link href={`/dp/${p.id}`} className="mt-3 block line-clamp-3 text-[15px] leading-5 hover:underline">{p.title}</Link>
                    {p.badge && <div className="mt-2"><Badge badge={p.badge} /></div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* hairlines do the separating, so no zebra stripes (docs/design.md) */}
              {rows.map((r) => {
                const same = new Set(products.map(r.text)).size === 1
                return (
                  <tr key={r.label} data-same={same} className="border-b border-line">
                    <th scope="row" className={`${head} p-4`}>{r.label}</th>
                    {products.map((p) => (
                      <td key={p.id} className="p-4 align-top">{r.cell(p)}</td>
                    ))}
                  </tr>
                )
              })}
              <tr>
                <th scope="row" className={`${head} p-4`}>Add to cart</th>
                {products.map((p) => (
                  <td key={p.id} className="p-4 align-top">
                    {p.stock > 0 ? <AddToCartButton productId={p.id} inCart={inCart.get(p.id)} /> : <span className="text-danger">Unavailable</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DiffOnly>
    </div>
  )
}

function Empty() {
  return (
    <div className="mx-auto max-w-[620px] px-4 py-24 text-center">
      <h1 className="text-[28px] leading-10">Nothing to compare yet</h1>
      <p className="mt-3 text-muted">Tick <b className="font-medium text-ink">Compare</b> on up to {COMPARE_MAX} products in search results, then come back here.</p>
      <Link href="/s" className="btn btn-cart mt-7 inline-flex">Browse products</Link>
    </div>
  )
}

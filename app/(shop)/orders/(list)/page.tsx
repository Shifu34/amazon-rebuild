import type { Metadata } from 'next'
import Form from 'next/form'
import Link from 'next/link'
import { Suspense } from 'react'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { Crumbs, OrderCard } from '@/components/orders/order-card'
import { OrdersSkeleton } from '@/components/orders/orders-skeleton'
import { RangeSelect } from '@/components/orders/range-select'
import { Price } from '@/components/price'
import { Stars } from '@/components/stars'
import { requireUser, type User } from '@/lib/auth'
import { cartQuantities } from '@/lib/cart'
import { fullDate, plural } from '@/lib/format'
import { getOrders, type Order, orderView, pathWithQuery, purchasedProducts, reviewedProductIds } from '@/lib/orders'
import { getRegion, type RequestRegion } from '@/lib/region-server'

export const metadata: Metadata = { title: 'Your Orders' }

type SearchParams = Record<string, string | string[] | undefined>
type Props = { searchParams: Promise<SearchParams> }

const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'buy-again', label: 'Buy Again' },
  { key: 'not-shipped', label: 'Not Yet Shipped', short: 'Not Shipped' },
  { key: 'cancelled', label: 'Cancelled Orders', short: 'Cancelled' },
]
const PER_PAGE = 10
const DAY = 86_400_000

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-lg border border-line px-4 py-8 text-center text-sm">{children}</div>
}

// product prices in the shopper's current display currency (not the old orders' currencies)
function BuyAgain({ orders, inCart, region }: { orders: Order[]; inCart: Map<number, number>; region: RequestRegion }) {
  const bought = purchasedProducts(orders)
  if (!bought.length) {
    return (
      <Empty>
        <p className="text-base font-bold">There are no items to buy again.</p>
        <p className="mt-1 text-muted">Things you buy show up here, so you can reorder them in one click.</p>
        <Link href="/" className="btn btn-cart btn-lg mt-4">Continue shopping</Link>
      </Empty>
    )
  }
  return (
    <>
      <p className="mt-4 text-sm"><b>{plural(bought.length, 'item')}</b> you&apos;ve bought before</p>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {bought.map(({ product: p, times, lastPurchased }) => (
          <li key={p.id} className="flex flex-col">
            <Link href={`/dp/${p.id}`} tabIndex={-1} aria-hidden className="flex aspect-square items-center justify-center rounded-sm bg-[#f7f7f7] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
            </Link>
            <Link href={`/dp/${p.id}`} className="mt-2 line-clamp-2 text-sm hover:text-link-hover hover:underline">{p.title}</Link>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Stars rating={p.rating} className="h-3.5" />
              <span className="text-muted">({p.ratingCount.toLocaleString('en-US')})</span>
            </div>
            {p.stock > 0 && <p className="mt-1 text-xl"><Price value={p.price} currency={region.currency} rate={region.rate} /></p>}
            <p className="mt-1 text-xs text-muted">
              {times > 1 && `Purchased ${times} times · `}Last purchased {fullDate(lastPurchased)}
            </p>
            <div className="mt-auto pt-2">
              {p.stock > 0 ? <AddToCartButton productId={p.id} inCart={inCart.get(p.id)} className="w-full" /> : <p className="text-sm text-danger">Currently unavailable</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

// Sign-in gate before anything suspends: signed-out visitors get a real redirect, and return_to keeps the tab, range and search.
export default async function OrdersPage({ searchParams }: Props) {
  const sp = await searchParams
  const returnTo = pathWithQuery('/orders', sp)
  const user = await requireUser(returnTo)
  return (
    <Suspense key={returnTo} fallback={<OrdersSkeleton />}>
      <YourOrders user={user} sp={sp} />
    </Suspense>
  )
}

async function YourOrders({ user, sp }: { user: User; sp: SearchParams }) {
  const param = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v) ?? ''
  }
  const tab = TABS.find((t) => t.key === param('tab'))?.key ?? 'orders'
  const q = param('q').trim().slice(0, 100)
  const [orders, reviewed, inCart, region] = await Promise.all([getOrders(user.id), reviewedProductIds(user.id), cartQuantities(), getRegion()])
  const now = new Date()

  // "placed in": last 30 days, past 3 months (default), then each year back to the oldest order (at least last year)
  const year = now.getUTCFullYear()
  const oldest = Math.min(year - 1, ...orders.map((o) => o.placedAt.getUTCFullYear()))
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setUTCMonth(now.getUTCMonth() - 3)
  const ranges = [
    { key: 'last30', label: 'last 30 days', inRange: (d: Date) => now.getTime() - d.getTime() <= 30 * DAY },
    { key: 'months-3', label: 'past 3 months', inRange: (d: Date) => d >= threeMonthsAgo },
    ...Array.from({ length: year - oldest + 1 }, (_, i) => year - i).map((y) => ({
      key: `year-${y}`,
      label: String(y),
      inRange: (d: Date) => d.getUTCFullYear() === y,
    })),
  ]
  const range = ranges.find((r) => r.key === param('range')) ?? ranges[1]

  // ponytail: filters and pages in memory over all of a shopper's orders; move to SQL when accounts have thousands
  const all = orders.map((order) => ({ order, view: orderView(order, now) }))
  const needle = q.toLowerCase()
  // partly cancelled orders are still active, so they stay out of Cancelled Orders
  const inTab = (x: (typeof all)[number]) => tab !== 'cancelled' || x.view.status === 'cancelled'
  const matches = q
    ? all.filter(({ order }) => order.id.includes(q) || order.items.some((i) => i.title.toLowerCase().includes(needle)))
    : tab === 'not-shipped'
      ? all.filter(({ view }) => view.status === 'ordered')
      : all.filter((x) => inTab(x) && range.inRange(x.order.placedAt))
  const olderYear = !q && tab !== 'not-shipped' ? all.find((x) => inTab(x) && !range.inRange(x.order.placedAt))?.order.placedAt.getUTCFullYear() : undefined

  const pages = Math.max(1, Math.ceil(matches.length / PER_PAGE))
  const page = Math.min(pages, Math.max(1, Math.floor(Number(param('page'))) || 1))
  const shown = matches.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const pageHref = (p: number) => {
    const u = new URLSearchParams()
    if (tab !== 'orders') u.set('tab', tab)
    if (q) u.set('q', q)
    if (param('range')) u.set('range', range.key)
    u.set('page', String(p))
    return `/orders?${u}`
  }
  const tabHref = (key: string) => (key === 'orders' ? '/orders' : `/orders?tab=${key}`)
  const rangeText = range.key.startsWith('year-') ? range.label : `the ${range.label}`

  return (
    <div className="mx-auto max-w-[980px] px-4 py-4">
      <Crumbs current="Your Orders" />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] leading-9 font-normal">Your Orders</h1>
        <Form action="/orders" role="search" className="flex w-full gap-2 sm:w-auto">
          <label htmlFor="order-search" className="sr-only">Search all orders</label>
          <input id="order-search" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Search all orders" className="input h-[33px] min-w-0 flex-1 sm:w-64" />
          <button type="submit" className="btn bg-ink text-white hover:bg-[#303333]">Search Orders</button>
        </Form>
      </div>

      <nav aria-label="Order views" className="mt-3 flex gap-4 overflow-x-auto border-b border-line text-sm sm:gap-5">
        {TABS.map((t) => {
          const active = t.key === tab && !q
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 px-1 pb-2 ${active ? 'border-[#e77600] font-bold' : 'link border-transparent'}`}
            >
              {t.short ? (
                <>
                  <span className="sm:hidden">{t.short}</span>
                  <span className="max-sm:hidden">{t.label}</span>
                </>
              ) : (
                t.label
              )}
            </Link>
          )
        })}
      </nav>

      {tab === 'buy-again' && !q ? (
        <BuyAgain orders={orders} inCart={inCart} region={region} />
      ) : (
        <>
          <div className="mt-4 text-sm">
            {q ? (
              <p>
                <b>{plural(matches.length, 'order')}</b> matching &ldquo;{q}&rdquo;
                <Link href="/orders" className="link ml-3">Clear search</Link>
              </p>
            ) : tab === 'not-shipped' ? (
              <p><b>{plural(matches.length, 'order')}</b> not yet shipped</p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <b>{plural(matches.length, tab === 'cancelled' ? 'cancelled order' : 'order')}</b> placed in
                <RangeSelect value={range.key} options={ranges.map(({ key, label }) => ({ key, label }))} tab={tab} />
              </div>
            )}
          </div>

          {shown.length ? (
            <ul className="mt-4 space-y-4">
              {shown.map(({ order, view }) => (
                <li key={order.id}>
                  <OrderCard order={order} view={view} reviewed={reviewed} />
                </li>
              ))}
            </ul>
          ) : !orders.length ? (
            <Empty>
              <p className="text-base font-bold">You have not placed any orders yet.</p>
              <p className="mt-1 text-muted">When you do, you can track, cancel or return them here.</p>
              <Link href="/" className="btn btn-cart btn-lg mt-4">Continue shopping</Link>
            </Empty>
          ) : q ? (
            <Empty>
              <p>No orders matched &ldquo;{q}&rdquo;.</p>
              <Link href="/orders" className="link mt-2 inline-block">View all orders</Link>
            </Empty>
          ) : tab === 'not-shipped' ? (
            <Empty>
              <p>No orders here. Everything you ordered has shipped.</p>
              <Link href="/orders" className="link mt-2 inline-block">View all orders</Link>
            </Empty>
          ) : (
            <Empty>
              <p>You have not placed any {tab === 'cancelled' ? 'cancelled orders' : 'orders'} in {rangeText}.</p>
              {olderYear && (
                <Link href={`/orders?${tab === 'cancelled' ? 'tab=cancelled&' : ''}range=year-${olderYear}`} className="link mt-2 inline-block">
                  View orders in {olderYear}
                </Link>
              )}
            </Empty>
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-4 text-sm">
              {page > 1 && <Link href={pageHref(page - 1)} className="btn btn-plain">← Previous</Link>}
              <span>Page {page} of {pages}</span>
              {page < pages && <Link href={pageHref(page + 1)} className="btn btn-plain">Next →</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  )
}

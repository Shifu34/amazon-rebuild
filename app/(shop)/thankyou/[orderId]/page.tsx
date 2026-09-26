import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { CheckCircleIcon } from '@/components/checkout/icons'
import { shipments } from '@/components/checkout/shipments'
import { orderSummary } from '@/components/checkout/summary'
import { ProductCarousel } from '@/components/product-carousel'
import { formatAddress } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'
import { bestSellers, getProduct, related } from '@/lib/catalog'
import { canReceiveEmail, emailConfigured } from '@/lib/email'
import { deliveryPromise } from '@/lib/delivery'
import { longDate } from '@/lib/format'
import { getOrder } from '@/lib/orders'

// Only the order's owner sees it; anyone else (or a bad id) gets the not-found page.
const findOrder = cache(async (orderId: string) => {
  const user = await requireUser(`/thankyou/${encodeURIComponent(orderId)}`)
  return getOrder(user.id, orderId)
})

export async function generateMetadata({ params }: PageProps<'/thankyou/[orderId]'>): Promise<Metadata> {
  return { title: (await findOrder((await params).orderId)) ? 'Thank you' : 'Order not found' }
}

export default async function ThankYouPage({ params }: PageProps<'/thankyou/[orderId]'>) {
  const order = await findOrder((await params).orderId)
  if (!order) notFound()

  const { shipTo } = order
  const user = await requireUser(`/thankyou/${encodeURIComponent(order.id)}`) // cached; the owner check already ran
  const first = getProduct(order.items[0]?.productId)
  const ordered = new Set(order.items.map((i) => i.productId))
  const recs = (first ? related(first, 20) : bestSellers(undefined, 20)).filter((p) => !ordered.has(p.id)).slice(0, 12)
  // the same rows checkout showed, in the order's own currency and rate
  const { rows, total, note, speed, country } = orderSummary(order)
  // the per-item dates checkout showed, never later than the order's own delivery date
  const groups = shipments(order.items, (i) => {
    const p = getProduct(i.productId)
    return p ? new Date(Math.min(deliveryPromise(p, order.placedAt, country)[order.deliverySpeed].getTime(), order.deliverBy.getTime())) : order.deliverBy
  })

  return (
    <div>
      <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <section className="min-w-0">
          <div className="flex gap-3">
            <CheckCircleIcon className="mt-1 size-6 shrink-0 text-accent" />
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl leading-8">Order placed, thanks!</h1>
              {order.cancelledAt && <p className="text-sm text-danger">This order was cancelled.</p>}
              <p className="text-sm">
                {!canReceiveEmail(user.email) ? (
                  <>Demo accounts don&apos;t get email. <span className="text-muted">Create an account with your own address to receive order confirmations.</span></>
                ) : emailConfigured() ? (
                  <>Confirmation will be sent to <b className="break-all font-medium">{user.email}</b>.</>
                ) : (
                  <>Confirmation will be sent to your email. <span className="text-muted">(Email isn&apos;t configured on this copy of nile.)</span></>
                )}
              </p>
              <p className="text-sm text-muted">
                <span className="text-ink">Shipping to {shipTo.fullName},</span> {formatAddress(shipTo)}, {shipTo.country}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6 border-t border-line pt-8">
            {groups.map((g, n) => (
              <div key={g.date.getTime()}>
                <h2 className="text-lg leading-6">Arriving {longDate(g.date)}</h2>
                {n === 0 && <p className="text-sm text-muted">{speed}</p>}
                <ul className="mt-4 flex flex-wrap gap-4" aria-label={groups.length > 1 ? `Arriving ${longDate(g.date)}` : 'Items in this order'}>
                  {g.items.map((i) => (
                    <li key={i.productId} className="w-24">
                      <Link href={`/dp/${i.productId}`} className="group block text-xs">
                        <span className="relative flex size-24 items-center justify-center rounded-md bg-page p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={i.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                          {i.quantity > 1 && (
                            <span className="price absolute right-1 bottom-1 rounded-full border border-line bg-surface px-1.5">×{i.quantity}</span>
                          )}
                        </span>
                        <span className="mt-1.5 line-clamp-2 group-hover:underline">{i.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Link href="/orders" className="link mt-8 inline-block text-sm">Review or edit your recent orders ›</Link>
        </section>

        <aside aria-label="Order details" className="card self-start p-5 text-sm">
          <p className="text-xs text-muted">Order number</p>
          <p className="font-mono text-base">{order.id}</p>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-4">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-3">
                <dt className="min-w-0 text-muted">{r.label}</dt>
                <dd className="price whitespace-nowrap">{r.text}</dd>
              </div>
            ))}
            <div className="mt-3 flex justify-between gap-3 border-t border-line pt-3 font-display text-xl leading-7 font-semibold">
              <dt className="min-w-0">Order total:</dt>
              <dd className="price whitespace-nowrap">{total}</dd>
            </div>
          </dl>
          {note && <p className="mt-4 text-xs text-muted">{note}</p>}
          <p className="mt-3 text-xs text-muted">
            Paid with {order.payment.brand} ending in {order.payment.last4}
          </p>
          <Link href="/" className="btn btn-plain btn-lg mt-5 w-full">Continue shopping</Link>
        </aside>
      </div>
      {/* overflow-hidden: the carousel's sr-only price text is absolutely positioned outside its scroll container */}
      <div className="mx-auto max-w-[1120px] overflow-hidden px-4 pb-12">
        <ProductCarousel title={first ? 'Customers who bought items in your order also bought' : 'Best Sellers'} products={recs} />
      </div>
    </div>
  )
}

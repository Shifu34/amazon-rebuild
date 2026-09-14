import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircleIcon } from '@/components/checkout/icons'
import { ProductCarousel } from '@/components/product-carousel'
import { formatAddress } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'
import { bestSellers, getProduct, related } from '@/lib/catalog'
import { longDate, plural, usdCents } from '@/lib/format'
import { getOrder } from '@/lib/orders'

export const metadata: Metadata = { title: 'Thank you' }

// Only the order's owner sees it; anyone else (or a bad id) gets the not-found page.
export default async function ThankYouPage({ params }: PageProps<'/thankyou/[orderId]'>) {
  const { orderId } = await params
  const user = await requireUser(`/thankyou/${encodeURIComponent(orderId)}`)
  const order = await getOrder(user.id, orderId)
  if (!order) notFound()

  const { shipTo } = order
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0)
  const first = getProduct(order.items[0]?.productId)
  const ordered = new Set(order.items.map((i) => i.productId))
  const recs = (first ? related(first, 20) : bestSellers(undefined, 20)).filter((p) => !ordered.has(p.id)).slice(0, 12)
  const speed = order.deliverySpeed === 'expedited' ? 'Expedited Delivery' : order.shippingCents ? 'Standard Delivery' : 'FREE Standard Delivery'
  const rows: [string, number][] = [
    [`Items (${itemCount}):`, order.itemsCents],
    ['Shipping & handling:', order.shippingCents],
    ['Total before tax:', order.itemsCents + order.shippingCents],
    ['Estimated tax to be collected:', order.taxCents],
  ]

  return (
    <div className="bg-page">
      <div className="mx-auto grid max-w-[1150px] gap-4 px-3 py-5 sm:px-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-lg bg-white p-5">
          <div className="flex gap-3">
            <CheckCircleIcon className="mt-0.5 size-6 shrink-0 text-success" />
            <div className="min-w-0 space-y-2">
              <h1 className="text-lg leading-7 text-success">Order placed, thanks!</h1>
              {order.cancelledAt && <p className="text-sm font-bold text-danger">This order was cancelled.</p>}
              <p className="text-sm">
                Confirmation will be sent to your email. <span className="text-muted">(Simulated: this demo store doesn&apos;t send email.)</span>
              </p>
              <p className="text-sm">
                <b>Shipping to {shipTo.fullName},</b> {formatAddress(shipTo)}, {shipTo.country}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-base font-bold">Arriving {longDate(order.deliverBy)}</p>
            <p className="text-sm text-muted">{speed}</p>
            <ul className="mt-3 flex flex-wrap gap-3" aria-label="Items in this order">
              {order.items.map((i) => (
                <li key={i.productId} className="w-24">
                  <Link href={`/dp/${i.productId}`} className="group block text-xs">
                    <span className="relative flex size-24 items-center justify-center rounded-sm bg-[#f7f7f7] p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                      {i.quantity > 1 && (
                        <span className="absolute right-1 bottom-1 rounded-full bg-white px-1.5 text-xs font-bold shadow">×{i.quantity}</span>
                      )}
                    </span>
                    <span className="mt-1 line-clamp-2 group-hover:text-link-hover group-hover:underline">{i.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Link href="/orders" className="link mt-5 inline-block text-sm">Review or edit your recent orders ›</Link>
        </section>

        <aside aria-label="Order details" className="self-start rounded-lg bg-white p-5 text-sm">
          <p className="text-muted">Order number</p>
          <p className="font-mono text-base font-bold">{order.id}</p>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[13px]">
            {rows.map(([label, cents]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt>{label}</dt>
                <dd>{usdCents(cents)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-line pt-2 text-base font-bold text-danger">
              <dt>Order total:</dt>
              <dd>{usdCents(order.totalCents)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[13px] text-muted">
            Paid with {order.payment.brand} ending in {order.payment.last4} · {plural(order.items.length, 'product')}
          </p>
          <Link href="/" className="btn btn-plain btn-lg mt-4 w-full">Continue shopping</Link>
        </aside>
      </div>
      {/* overflow-hidden: the carousel's sr-only price text is absolutely positioned outside its scroll container */}
      <div className="mx-auto max-w-[1150px] overflow-hidden px-3 pb-6 sm:px-4">
        <ProductCarousel title={first ? 'Customers who bought items in your order also bought' : 'Best Sellers'} products={recs} />
      </div>
    </div>
  )
}

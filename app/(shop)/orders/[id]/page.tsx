import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { demoMarkDelivered, demoReceiveReturn } from '@/app/actions/orders'
import { CheckCircleIcon } from '@/components/checkout/icons'
import { AddressLines, ItemRow, OrderActions } from '@/components/orders/order-card'
import { Progress } from '@/components/orders/progress'
import { requireUser } from '@/lib/auth'
import { fullDate, usdCents } from '@/lib/format'
import { getOrder, orderView, reviewedProductIds } from '@/lib/orders'

export const metadata: Metadata = { title: 'Order Details' }

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function OrderDetailsPage({ params, searchParams }: Props) {
  const { id } = await params
  const user = await requireUser(`/orders/${encodeURIComponent(id)}`)
  const [order, reviewed] = await Promise.all([getOrder(user.id, id), reviewedProductIds(user.id)])
  if (!order) notFound()
  const { cancelled } = await searchParams
  const view = orderView(order)
  const delivered = view.status === 'delivered'
  const rows: [string, number][] = [
    ['Item(s) Subtotal:', order.itemsCents],
    ['Shipping & Handling:', order.shippingCents],
    ['Total before tax:', order.itemsCents + order.shippingCents],
    ['Estimated tax to be collected:', order.taxCents],
  ]

  return (
    <div className="mx-auto max-w-[980px] px-4 py-4">
      <nav aria-label="Breadcrumb" className="text-xs">
        <Link href="/account" className="link">Your Account</Link>
        <span className="mx-1 text-muted" aria-hidden>›</span>
        <Link href="/orders" className="link">Your Orders</Link>
        <span className="mx-1 text-muted" aria-hidden>›</span>
        <span className="text-[#c45500]" aria-current="page">Order Details</span>
      </nav>
      <h1 className="mt-2 text-[28px] leading-9 font-normal">Order Details</h1>
      <p className="mt-1 text-sm">
        Order placed {fullDate(order.placedAt)}
        <span className="mx-2 text-line" aria-hidden>|</span>
        <span className="whitespace-nowrap">Order # {order.id}</span>
      </p>
      {order.replacementFor && (
        <p className="mt-1 text-sm">
          Free replacement for <Link href={`/orders/${order.replacementFor}`} className="link">order # {order.replacementFor}</Link>
        </p>
      )}

      {cancelled && view.cancelledCents > 0 && (
        <div role="status" className="mt-4 flex gap-3 rounded-lg border border-[#0b7b3c] p-3 text-sm">
          <CheckCircleIcon className="size-5 shrink-0 text-[#0b7b3c]" />
          <p>
            <b className="block text-[#0b7b3c]">{view.status === 'cancelled' ? 'This order has been cancelled.' : 'Your items have been cancelled.'}</b>
            You won&apos;t be charged for cancelled items.
          </p>
        </div>
      )}

      <section aria-label="Order summary" className="mt-4 grid gap-4 rounded-lg border border-line p-4 text-sm md:grid-cols-3">
        <div>
          <h2 className="font-bold">Ship to</h2>
          <AddressLines shipTo={order.shipTo} />
        </div>
        <div>
          <h2 className="font-bold">Payment method</h2>
          <p>{order.payment.brand} ending in {order.payment.last4}</p>
        </div>
        <div>
          <h2 className="font-bold">Order Summary</h2>
          <dl className="space-y-0.5">
            {rows.map(([label, cents]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt>{label}</dt>
                <dd>{usdCents(cents)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 font-bold">
              <dt>Grand Total:</dt>
              <dd>{usdCents(order.totalCents)}</dd>
            </div>
            {view.status !== 'cancelled' && view.cancelledCents > 0 && (
              <div className="flex justify-between gap-2 text-muted">
                <dt>Cancelled items (not charged):</dt>
                <dd>−{usdCents(view.cancelledCents)}</dd>
              </div>
            )}
            {view.refundCents > 0 && (
              <div className="flex justify-between gap-2 font-bold text-[#0b7b3c]">
                <dt>Refund total:</dt>
                <dd>{usdCents(view.refundCents)}</dd>
              </div>
            )}
          </dl>
          {view.status === 'cancelled' && <p className="mt-1 text-xs text-muted">This order was cancelled. You were not charged.</p>}
        </div>
      </section>

      <section aria-labelledby="shipment-status" className="mt-4 rounded-lg border border-line p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="min-w-0 flex-1">
            <h2 id="shipment-status" className="text-lg font-bold">{view.headline}</h2>
            <p className="text-sm text-muted">{view.subline}</p>
            {view.step >= 0 && (
              <div className="mt-3 max-w-md">
                <Progress step={view.step} />
              </div>
            )}
            <ul className="mt-5 space-y-5">
              {view.items.map((i) => (
                <ItemRow
                  key={i.productId}
                  item={i}
                  orderId={order.id}
                  review={delivered && i.state.kind !== 'cancelled' ? { reviewed: reviewed.has(i.productId) } : undefined}
                />
              ))}
            </ul>
          </div>
          <div className="md:w-[220px]">
            <OrderActions order={order} view={view} />
          </div>
        </div>
      </section>

      {view.step >= 0 && (!delivered || view.returnPending) && (
        <section aria-label="Demo controls" className="mt-4 rounded-lg border-2 border-dashed border-[#c7c7c7] p-4">
          <form action={delivered ? demoReceiveReturn : demoMarkDelivered}>
            <input type="hidden" name="orderId" value={order.id} />
            <button type="submit" className="btn btn-plain">{delivered ? 'Demo: receive returned item' : 'Demo: mark as delivered'}</button>
            <p className="mt-1 text-xs text-muted">
              {delivered
                ? 'Deliveries here are simulated. This pretends the carrier scanned your return, so the refund is issued.'
                : 'Deliveries here are simulated. This skips ahead to delivery so you can try tracking, returns and reviews without waiting.'}
            </p>
          </form>
        </section>
      )}

      <Link href="/orders" className="link mt-4 inline-block text-sm">‹ Back to Your Orders</Link>
    </div>
  )
}

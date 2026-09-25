import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Fragment } from 'react'
import { confirmCodOrder, demoRefuseDelivery } from '@/app/actions/cod'
import { demoMarkDelivered, demoReceiveReturn } from '@/app/actions/orders'
import { CheckCircleIcon } from '@/components/checkout/icons'
import { AddressLines, Crumbs, ItemRow, OrderActions, OrderTotals } from '@/components/orders/order-card'
import { RestockReminder } from '@/components/orders/reminder'
import { Progress } from '@/components/orders/progress'
import { requireUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { fullDate, plural } from '@/lib/format'
import { getOrder, orderView, paymentLabel, reviewedProductIds } from '@/lib/orders'
import { formatMoney } from '@/lib/region'
import { getReminders, reminderWeeks } from '@/lib/reminders'

export const metadata: Metadata = { title: 'Order Details' }

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function OrderDetailsPage({ params, searchParams }: Props) {
  const { id } = await params
  const user = await requireUser(`/orders/${encodeURIComponent(id)}`)
  const [order, reviewed, reminders] = await Promise.all([getOrder(user.id, id), reviewedProductIds(user.id), getReminders(user.id)])
  if (!order) notFound()
  const { cancelled } = await searchParams
  const view = orderView(order)
  const delivered = view.status === 'delivered'

  return (
    <div className="mx-auto max-w-[980px] px-4 py-4">
      <Crumbs current="Order Details" />
      <h1 className="mt-2 text-[28px] leading-9 font-normal">Order Details</h1>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p>
          <span className="block whitespace-nowrap sm:inline">Order placed {fullDate(order.placedAt)}</span>
          <span className="mx-2 hidden text-line sm:inline" aria-hidden>|</span>
          <span className="block whitespace-nowrap sm:inline">Order # {order.id}</span>
        </p>
        <Link href={`/orders/${order.id}/invoice`} className="link">Invoice</Link>
      </div>
      {order.replacementFor && (
        <p className="mt-1 text-sm">
          Free replacement for <Link href={`/orders/${order.replacementFor}`} className="link">order # {order.replacementFor}</Link>
        </p>
      )}

      {/* phones read shipment status and its actions first, then address, payment and totals (as in Amazon's app) */}
      <div className="mt-4 flex flex-col gap-4">
        {cancelled && view.cancelledCents > 0 && (
          <div role="status" className="flex gap-3 rounded-lg border border-[#0b7b3c] p-3 text-sm">
            <CheckCircleIcon className="size-5 shrink-0 text-[#0b7b3c]" />
            {view.status === 'cancelled' ? (
              <p className="font-bold text-[#0b7b3c]">This order has been cancelled.</p>
            ) : (
              <p>
                <b className="block text-[#0b7b3c]">{plural(Number(cancelled) || 1, 'item')} cancelled.</b>
                You won&apos;t be charged for them.
              </p>
            )}
          </div>
        )}

        {/* a cash order waits for one tap before it ships: the cheap step that stops most refusals (lib/cod.ts) */}
        {order.paymentKind === 'cod' && !order.confirmedAt && !order.cancelledAt && (
          <section aria-label="Confirm this order" className="rounded-lg border border-[#e77600] bg-[#fef8f2] p-4 max-md:order-1">
            <h2 className="font-bold">Awaiting your confirmation</h2>
            <p className="mt-1 text-sm">We won&apos;t ship this cash order until you confirm you want it.</p>
            <form action={confirmCodOrder} className="mt-3">
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="btn btn-cart">Confirm this order</button>
            </form>
          </section>
        )}
        {order.refusedAt && (
          <section aria-label="Refused" className="rounded-lg border border-line bg-[#f7f8f8] p-4 text-sm max-md:order-1">
            <h2 className="font-bold">Parcel refused</h2>
            <p className="mt-1">Nothing was charged. Cash orders now ask for part of the total up front until your next delivery is taken.</p>
          </section>
        )}

        <section aria-label="Order summary" className="grid gap-4 rounded-lg border border-line p-4 text-sm max-md:order-1 md:grid-cols-3">
          <div>
            <h2 className="font-bold">Ship to</h2>
            <AddressLines shipTo={order.shipTo} />
          </div>
          <div>
            <h2 className="font-bold">Payment method</h2>
            <p>{paymentLabel(order)}</p>
            {order.paymentKind === 'cod' && order.payment.advanceCents ? (
              <p className="text-xs text-muted">{formatMoney(order.payment.advanceCents, order.currency, order.fxRate)} paid up front, the rest to the courier.</p>
            ) : null}
          </div>
          <div>
            <h2 className="font-bold">Order Summary</h2>
            <OrderTotals order={order} view={view} />
          </div>
        </section>

        <section aria-labelledby="shipment-status" className="rounded-lg border border-line p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <h2 id="shipment-status" className="text-lg font-bold">{view.headline}</h2>
              <p className="text-sm text-muted">{view.subline}</p>
              {view.pooledNote && <p className="text-sm">{view.pooledNote}</p>}
              {view.step >= 0 && (
                <div className="mt-3 max-w-md">
                  <Progress step={view.step} />
                </div>
              )}
            </div>
            {view.status !== 'cancelled' && (
              <div className="self-start md:col-start-2 md:row-span-2 md:row-start-1">
                <OrderActions order={order} view={view} />
              </div>
            )}
            <ul className="space-y-5 md:col-start-1 md:row-start-2 md:mt-1">
              {view.items.map((i) => {
                // a consumable you already have: offer the nudge once it's actually been delivered
                const weeks = delivered && i.state.kind !== 'cancelled' ? reminderWeeks(getProduct(i.productId)?.category ?? '') : 0
                return (
                  <Fragment key={i.productId}>
                    <ItemRow item={i} order={order} review={delivered && i.state.kind !== 'cancelled' ? { reviewed: reviewed.has(i.productId) } : undefined} />
                    {weeks > 0 && (
                      <li className="-mt-3 sm:pl-[102px]">
                        <RestockReminder productId={i.productId} orderId={order.id} weeks={weeks} reminder={reminders.find((r) => r.product.id === i.productId)} />
                      </li>
                    )}
                  </Fragment>
                )
              })}
            </ul>
          </div>
        </section>

        {view.step >= 0 && (!delivered || view.returnPending) && (
          <section aria-label="Demo controls" className="rounded-lg border-2 border-dashed border-[#c7c7c7] p-4">
            <form action={delivered ? demoReceiveReturn : demoMarkDelivered}>
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="btn btn-plain">{delivered ? 'Demo: receive returned item' : 'Demo: mark as delivered'}</button>
              <p className="mt-1 text-xs text-muted">
                {delivered
                  ? 'Deliveries here are simulated. This pretends the carrier scanned your return, so the refund is issued.'
                  : 'Deliveries here are simulated. This pretends you ordered yesterday and delivers it now, so you can try tracking, returns and reviews without waiting.'}
              </p>
            </form>
            {order.paymentKind === 'cod' && !delivered && !order.refusedAt && !order.cancelledAt && (
              <form action={demoRefuseDelivery} className="mt-3 border-t border-line pt-3">
                <input type="hidden" name="orderId" value={order.id} />
                <button type="submit" className="btn btn-plain">Demo: refuse delivery</button>
                <p className="mt-1 text-xs text-muted">Turns the courier away, as a shopper can with cash on delivery. Nothing is charged, and you can see what it does to your cash standing.</p>
              </form>
            )}
          </section>
        )}
      </div>

      <Link href="/orders" className="link mt-4 inline-block text-sm">‹ Back to Your Orders</Link>
    </div>
  )
}

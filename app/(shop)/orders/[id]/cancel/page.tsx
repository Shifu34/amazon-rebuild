import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CancelForm } from '@/components/orders/cancel-form'
import { requireUser } from '@/lib/auth'
import { fullDate } from '@/lib/format'
import { getOrder, orderView } from '@/lib/orders'

export const metadata: Metadata = { title: 'Cancel items' }

type Props = { params: Promise<{ id: string }> }

export default async function CancelPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser(`/orders/${encodeURIComponent(id)}/cancel`)
  const order = await getOrder(user.id, id)
  if (!order) notFound()
  const view = orderView(order)
  const back = `/orders/${order.id}`
  const items = order.items.filter((i) => !i.cancelledAt).map(({ productId, title, thumbnail, quantity }) => ({ productId, title, thumbnail, quantity }))

  return (
    <div className="mx-auto max-w-[800px] px-4 py-4">
      <nav aria-label="Breadcrumb" className="text-xs">
        <Link href="/orders" className="link">Your Orders</Link>
        <span className="mx-1 text-muted" aria-hidden>›</span>
        <Link href={back} className="link">Order Details</Link>
        <span className="mx-1 text-muted" aria-hidden>›</span>
        <span className="text-[#c45500]" aria-current="page">Cancel items</span>
      </nav>
      <h1 className="mt-2 text-[28px] leading-9 font-normal">Cancel items</h1>
      <p className="text-sm text-muted">Order # {order.id} · placed {fullDate(order.placedAt)}</p>

      <div className="mt-5">
        {view.canCancel ? (
          <CancelForm orderId={order.id} items={items} />
        ) : (
          <div role="alert" className="rounded-lg border border-[#c10015] p-4 text-sm">
            <p className="font-bold text-[#c10015]">
              {view.status === 'cancelled' ? 'This order has already been cancelled.' : "This order has already shipped and can't be cancelled."}
            </p>
            {view.status !== 'cancelled' && <p className="mt-1">You can return it after delivery.</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={back} className="btn btn-plain">Back to order</Link>
              {view.status !== 'cancelled' && <Link href={`${back}/track`} className="btn btn-cart">Track package</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

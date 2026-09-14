import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircleIcon } from '@/components/checkout/icons'
import { Thumb } from '@/components/orders/order-card'
import { ReturnForm } from '@/components/orders/return-form'
import { RETURN_METHODS } from '@/components/orders/rules'
import { requireUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { addBusinessDays } from '@/lib/delivery'
import { fullDate, longDate, usdCents } from '@/lib/format'
import { getOrder, itemRefundCents, type Order, type OrderView, orderView, returnBlocker, type ViewItem } from '@/lib/orders'

export const metadata: Metadata = { title: 'Return or replace items' }

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

function Breadcrumb({ back }: { back: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs">
      <Link href="/orders" className="link">Your Orders</Link>
      <span className="mx-1 text-muted" aria-hidden>›</span>
      <Link href={back} className="link">Order Details</Link>
      <span className="mx-1 text-muted" aria-hidden>›</span>
      <span className="text-[#c45500]" aria-current="page">Return or replace items</span>
    </nav>
  )
}

function Confirmation({ order, view, items, code }: { order: Order; view: OrderView; items: ViewItem[]; code: string }) {
  const back = `/orders/${order.id}`
  const first = items[0]
  const done = first.state.kind === 'returned'
  const pickup = first.returnMethod === 'ups-pickup'
  const refund = items.reduce((s, i) => s + (i.refundCents ?? 0), 0)
  const payment = `${order.payment.brand} ending in ${order.payment.last4}`
  const startedAt = first.returnedAt ?? new Date()

  return (
    <div className="mx-auto max-w-[700px] px-4 py-4">
      <Breadcrumb back={back} />
      <section className="mt-3 flex gap-3 rounded-lg border border-line p-5">
        <CheckCircleIcon className="mt-0.5 size-6 shrink-0 text-[#0b7b3c]" />
        <div className="min-w-0 flex-1 space-y-3 text-sm">
          <h1 className="text-lg font-bold text-[#0b7b3c]">{done ? 'Return complete' : 'Return started'}</h1>
          {!done &&
            (pickup ? (
              <p className="text-base">UPS pickup on <b>{longDate(addBusinessDays(startedAt, 1))}</b></p>
            ) : (
              first.state.kind === 'return-started' && <p className="text-base">Drop off by <b>{fullDate(first.state.dropOffBy)}</b></p>
            ))}
          <div>
            <p className="text-xs text-muted">Return code</p>
            <p className="font-mono text-[28px] leading-9 font-bold tracking-wider select-all">{code}</p>
          </div>
          {!done && (
            <p>
              <b>What to bring:</b> {pickup ? `The item. ${RETURN_METHODS['ups-pickup'].note}` : 'Only the item. No box or label needed. Show this code at The UPS Store.'}
            </p>
          )}
          {first.replacementOrderId ? (
            <p>
              Your free replacement is on its way: <Link href={`/orders/${first.replacementOrderId}`} className="link">order # {first.replacementOrderId}</Link>
            </p>
          ) : done ? (
            <p>Your refund of <b>{usdCents(refund)}</b> was issued to {payment}.</p>
          ) : (
            <p>Your refund of <b>{usdCents(refund)}</b> to {payment} will be issued after we receive your item.</p>
          )}
          <ul className="flex flex-wrap gap-2" aria-label="Items in this return">
            {items.map((i) => (
              <li key={i.productId} title={i.title}>
                <Thumb src={i.thumbnail} size="size-16" />
                <span className="sr-only">{i.title}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link href={back} className="btn btn-plain btn-lg">Back to order</Link>
            {view.canReturn && <Link href={`${back}/return`} className="link">Return another item</Link>}
          </div>
        </div>
      </section>
    </div>
  )
}

export default async function ReturnPage({ params, searchParams }: Props) {
  const { id } = await params
  const user = await requireUser(`/orders/${encodeURIComponent(id)}/return`)
  const order = await getOrder(user.id, id)
  if (!order) notFound()
  const sp = await searchParams
  const code = typeof sp.code === 'string' ? sp.code : ''
  const itemParam = Number(typeof sp.item === 'string' ? sp.item : NaN)
  const view = orderView(order)
  const back = `/orders/${order.id}`

  const started = code ? view.items.filter((i) => i.returnCode === code) : []
  if (started.length) return <Confirmation order={order} view={view} items={started} code={code} />

  const items = view.items.map((i) => ({
    productId: i.productId,
    title: i.title,
    thumbnail: i.thumbnail,
    quantity: i.quantity,
    priceCents: i.priceCents,
    refundCents: itemRefundCents(i),
    note: i.state.kind === 'open' ? `Return window closes on ${fullDate(i.state.returnBy)}` : '',
    blocker: returnBlocker(i.state),
    canReplace: (getProduct(i.productId)?.stock ?? 0) > 0,
  }))

  if (!items.some((i) => !i.blocker)) {
    const focus = items.find((i) => i.productId === itemParam) ?? items[0]
    return (
      <div className="mx-auto max-w-[700px] px-4 py-4">
        <Breadcrumb back={back} />
        <h1 className="mt-2 text-[28px] leading-9 font-normal">Return or replace items</h1>
        <div role="alert" className="mt-4 rounded-lg border border-line p-4 text-sm">
          <p className="font-bold">{view.status === 'cancelled' ? 'This order was cancelled, so there is nothing to return.' : focus?.blocker}</p>
          <Link href={back} className="btn btn-plain mt-4">Back to order</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-4">
      <Breadcrumb back={back} />
      <h1 className="mt-2 text-[28px] leading-9 font-normal">Return or replace items</h1>
      <p className="text-sm text-muted">Order # {order.id} · delivered {fullDate(view.deliveredAt)}</p>
      <div className="mt-4">
        <ReturnForm
          orderId={order.id}
          items={items}
          preselect={Number.isInteger(itemParam) ? itemParam : null}
          payment={`${order.payment.brand} ending in ${order.payment.last4}`}
        />
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deliveryName } from '@/components/checkout/summary'
import { AddressLines, orderMoney, OrderTotals } from '@/components/orders/order-card'
import { PrintButton } from '@/components/orders/print-button'
import { requireUser } from '@/lib/auth'
import { fullDate } from '@/lib/format'
import { getOrder, orderView, paymentLabel } from '@/lib/orders'

export const metadata: Metadata = { title: 'Invoice' }

type Props = { params: Promise<{ id: string }> }

// sections are separated by a rule, the way a paper invoice is, and never break across printed pages
const section = 'mt-8 break-inside-avoid border-t border-line pt-6'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

// The order as a document: a sheet with a masthead, hairline rules and figures in a column. Printing drops
// the store header, footer and the page's own chrome so only the sheet comes out (docs/design.md).
export default async function InvoicePage({ params }: Props) {
  const { id } = await params
  const user = await requireUser(`/orders/${encodeURIComponent(id)}/invoice`)
  const order = await getOrder(user.id, id)
  if (!order) notFound()
  const view = orderView(order)
  const m = orderMoney(order, view)
  const back = `/orders/${order.id}`
  // the same name checkout, the thank-you page and emails use; only US shipping is ever free
  const speed = `${order.deliverySpeed === 'standard' && !order.shippingCents && m.country === 'US' ? 'FREE ' : ''}${deliveryName(order.deliverySpeed, m.country)}`
  const shipment = view.status === 'cancelled' ? 'Cancelled' : view.step >= 1 ? `Shipped on ${fullDate(view.shippedAt)}` : 'Not Yet Shipped'

  return (
    <div className="mx-auto max-w-[760px] px-4 py-10 text-sm">
      <style>{'@media print { header, footer { display: none !important } }'}</style>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link href={back} className="link">‹ Back to Order Details</Link>
        <PrintButton />
      </div>

      <article className="card mt-6 p-8 sm:p-10 print:rounded-none print:border-0 print:p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line pb-5">
          <h1 className="text-2xl">Invoice</h1>
          <p className="font-display text-xl">nile</p>
        </div>

        <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-3">
          <Field label="Order placed">{fullDate(order.placedAt)}</Field>
          <Field label="nile order number"><span className="price">{order.id}</span></Field>
          <Field label="Status">{shipment}</Field>
        </dl>
        {/* one text node: "Order Total: <amount>" is what the region tests read */}
        <p className="mt-6 border-t border-line pt-4 font-display text-base">Order Total: <span className="price text-xl leading-7">{m.charged}</span></p>

        <section className={section}>
          <h2 className="text-base">Items ordered</h2>
          <table className="mt-3 w-full">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="pb-2 font-normal">Item</th>
                <th className="pb-2 text-right font-normal">Price</th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((i) => (
                <tr key={i.productId} className="border-b border-line align-top last:border-0">
                  <td className="py-2.5 pr-6">
                    <span className="price text-muted">{i.quantity} ×</span> {i.title}
                    {i.state.kind === 'cancelled' && !i.state.wholeOrder && <span className="text-deal"> (Cancelled)</span>}
                  </td>
                  <td className="price py-2.5 text-right whitespace-nowrap">{m.text(i.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={section}>
          <dl className="grid gap-6 sm:grid-cols-3">
            <Field label="Shipping address"><AddressLines shipTo={order.shipTo} /></Field>
            <Field label="Shipping speed">{speed}</Field>
            <Field label="Payment method">
              {order.paymentKind === 'cod' ? paymentLabel(order) : `${order.payment.brand} · last digits ${order.payment.last4}`}
            </Field>
          </dl>
        </section>

        <section className={section}>
          <h2 className="text-base">Order summary</h2>
          <div className="mt-3 sm:w-[300px] sm:max-w-full">
            <OrderTotals order={order} view={view} />
          </div>
          {view.step >= 1 && view.chargedCents > 0 && (
            <p className="mt-4 border-t border-line pt-4 text-muted">
              {order.paymentKind === 'cod' ? 'Cash on delivery' : 'Card transaction'} — {paymentLabel(order)}, {fullDate(view.shippedAt)}:{' '}
              <span className="price text-ink">{m.charged}</span>
            </p>
          )}
        </section>
      </article>

      <p className="mt-6 text-center text-muted print:hidden">
        To view the status of your order, return to <Link href={back} className="link">Order Summary</Link>.
      </p>
    </div>
  )
}

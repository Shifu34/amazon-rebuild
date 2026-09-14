import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddressLines, OrderTotals } from '@/components/orders/order-card'
import { PrintButton } from '@/components/orders/print-button'
import { requireUser } from '@/lib/auth'
import { fullDate, usdCents } from '@/lib/format'
import { getOrder, orderView } from '@/lib/orders'

export const metadata: Metadata = { title: 'Invoice' }

type Props = { params: Promise<{ id: string }> }

const box = 'mt-4 rounded-sm border border-[#999] break-inside-avoid'
const boxHead = 'border-b border-[#999] bg-[#f0f2f2] px-3 py-1.5 font-bold'

// Printable order summary, like Amazon's "Final Details for Order #". Printing hides the store header and footer.
export default async function InvoicePage({ params }: Props) {
  const { id } = await params
  const user = await requireUser(`/orders/${encodeURIComponent(id)}/invoice`)
  const order = await getOrder(user.id, id)
  if (!order) notFound()
  const view = orderView(order)
  const back = `/orders/${order.id}`
  const speed = order.deliverySpeed === 'expedited' ? 'Expedited' : order.shippingCents ? 'Standard' : 'FREE Standard'
  const shipment = view.status === 'cancelled' ? 'Cancelled' : view.step >= 1 ? `Shipped on ${fullDate(view.shippedAt)}` : 'Not Yet Shipped'

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 text-sm">
      <style>{'@media print { header, footer { display: none !important } }'}</style>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link href={back} className="link">‹ Back to Order Details</Link>
        <PrintButton />
      </div>

      <h1 className="mt-4 text-xl font-bold">Final Details for Order #{order.id}</h1>
      <p className="mt-2">Order Placed: {fullDate(order.placedAt)}</p>
      <p>nile order number: {order.id}</p>
      <p className="font-bold">Order Total: {usdCents(view.chargedCents)}</p>

      <section className={box}>
        <h2 className={boxHead}>{shipment}</h2>
        <div className="p-3">
          <table className="w-full">
            <thead>
              <tr>
                <th className="pb-1 text-left">Items Ordered</th>
                <th className="pb-1 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((i) => (
                <tr key={i.productId} className="align-top">
                  <td className="py-1 pr-4">
                    {i.quantity} of: <i>{i.title}</i>
                    {i.state.kind === 'cancelled' && !i.state.wholeOrder && <span className="text-danger"> (Cancelled)</span>}
                  </td>
                  <td className="py-1 text-right">{usdCents(i.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <b>Shipping Address:</b>
              <AddressLines shipTo={order.shipTo} />
            </div>
            <div>
              <b>Shipping Speed:</b>
              <p>{speed}</p>
            </div>
          </div>
        </div>
      </section>

      <section className={box}>
        <h2 className={boxHead}>Payment information</h2>
        <div className="grid gap-4 p-3 sm:grid-cols-2">
          <div>
            <b>Payment Method:</b>
            <p>{order.payment.brand} | Last digits: {order.payment.last4}</p>
          </div>
          <OrderTotals order={order} view={view} />
        </div>
        {view.step >= 1 && view.chargedCents > 0 && (
          <p className="border-t border-[#999] px-3 py-2">
            <b>Credit Card transactions:</b> {order.payment.brand} ending in {order.payment.last4}: {fullDate(view.shippedAt)}: {usdCents(view.chargedCents)}
          </p>
        )}
      </section>

      <p className="mt-4 text-center">
        To view the status of your order, return to <Link href={back} className="link">Order Summary</Link>.
      </p>
    </div>
  )
}

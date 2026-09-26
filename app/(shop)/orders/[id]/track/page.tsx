import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddressLines, Crumbs, Thumb } from '@/components/orders/order-card'
import { Progress } from '@/components/orders/progress'
import { requireUser } from '@/lib/auth'
import { longDate, plural, shortDate } from '@/lib/format'
import { getOrder, orderView, trackingEvents, trackingId, type TrackingEvent } from '@/lib/orders'
import { countryCodeFromName, IMPORT_FEES_NOTE } from '@/lib/region'

export const metadata: Metadata = { title: 'Track package' }

type Props = { params: Promise<{ id: string }> }

const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
const stamp = (d: Date) => `${shortDate(d)}, ${time(d)}`

export default async function TrackPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser(`/orders/${encodeURIComponent(id)}/track`)
  const order = await getOrder(user.id, id)
  if (!order) notFound()
  const now = new Date()
  const view = orderView(order, now)
  const back = `/orders/${order.id}`

  if (view.status === 'cancelled') {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <h1 className="text-2xl">This order was cancelled.</h1>
        <p className="mt-2 text-sm text-muted">Nothing will be shipped, and you have not been charged.</p>
        <Link href={back} className="btn btn-plain btn-lg mt-6">Back to order</Link>
      </div>
    )
  }

  const intl = countryCodeFromName(order.shipTo.country) === 'PK'
  const events = trackingEvents(order, now)
  const days = new Map<string, TrackingEvent[]>()
  for (const e of events) days.set(longDate(e.at), [...(days.get(longDate(e.at)) ?? []), e])
  const notes = [
    stamp(order.placedAt),
    view.step >= 1 ? stamp(view.shippedAt) : '',
    view.step >= 2 ? stamp(view.outForDeliveryAt) : '',
    view.step >= 3 ? stamp(view.deliveredAt) : `Expected ${shortDate(view.deliveredAt)}`,
  ]
  const active = view.items.filter((i) => i.state.kind !== 'cancelled')
  const latest = events[0]

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10">
      <Crumbs current="Track package" orderId={order.id} />

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <section aria-labelledby="track-headline" className="card min-w-0 self-start p-6">
          <h1 id="track-headline" className="text-[28px] leading-9">{view.headline}</h1>
          <p className="mt-0.5 text-sm text-muted">{view.subline}</p>
          <div className="mt-8">
            <Progress step={view.step} notes={notes} large />
          </div>
          {latest && (
            <p className="mt-8 text-sm">
              <span className="font-medium">Latest update:</span> {latest.label}
              {latest.place && ` · ${latest.place}`} · {stamp(latest.at)}
            </p>
          )}
          <details className="mt-6 border-t border-line pt-4">
            <summary className="link cursor-pointer text-sm">See all updates</summary>
            <div className="mt-4 space-y-5">
              {[...days].map(([day, list]) => (
                <div key={day}>
                  <h2 className="text-base">{day}</h2>
                  <ul className="mt-1.5 space-y-2 text-sm">
                    {list.map((e) => (
                      <li key={e.label} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
                        <span className="price text-muted">{time(e.at)}</span>
                        <span>
                          {e.label}
                          {e.place && <span className="block text-xs text-muted">{e.place}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </section>

        <aside aria-label="Shipment details" className="space-y-6 text-sm">
          <div className="card divide-y divide-line [&>div]:p-5">
            <div>
              <h2 className="text-base">{view.status === 'delivered' ? 'Delivered by nile' : intl ? 'Shipping internationally with nile' : 'Shipping with nile'}</h2>
              {view.step >= 1 ? (
                <p className="mt-1 text-muted">
                  Tracking ID: <span className="price text-ink select-all">{trackingId(order.id)}</span>
                </p>
              ) : (
                <p className="mt-1 text-muted">Tracking info will be available when your package ships.</p>
              )}
              {intl && <p className="mt-2 text-xs text-muted">{IMPORT_FEES_NOTE}</p>}
            </div>
            <div>
              <h2 className="mb-1 text-base">Shipping Address</h2>
              <AddressLines shipTo={order.shipTo} />
            </div>
            <div>
              <h2 className="text-base">{plural(active.length, 'item')} in this package</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {active.map((i) => (
                  <li key={i.productId}>
                    <Link href={`/dp/${i.productId}`} title={i.title} className="block rounded-[10px] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
                      <Thumb src={i.thumbnail} size="size-16" />
                      <span className="sr-only">{i.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {view.canReturn && <Link href={`${back}/return`} className="btn btn-cart w-full">Return or replace items</Link>}
            <Link href={back} className="btn btn-plain w-full">Back to order</Link>
            <Link href="/orders" className="btn btn-plain w-full">See all orders</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

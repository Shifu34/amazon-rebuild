import Link from 'next/link'
import { Fragment } from 'react'
import { CaretIcon, ChevronIcon } from '@/components/icons'
import { getProduct } from '@/lib/catalog'
import { formatAddress } from '@/lib/addresses'
import { fullDate, plural } from '@/lib/format'
import { itemRefundCents, type Order, type OrderItem, type OrderView, type ShipTo, type ViewItem } from '@/lib/orders'
import { convertCents, countryCodeFromName, formatMinor, formatMoney, IMPORT_FEES_NOTE, itemsTotal, lineMinor } from '@/lib/region'
import { BuyAgainButton } from './buy-again-button'

const small = 'btn min-h-[29px] px-3 text-xs'
const chip = 'mr-1.5 inline-block rounded-full border px-1.5 text-xs leading-4'
const green = 'text-[#0b7b3c]'

// "Your Account › Your Orders › Order Details › {current}", cut to where the page sits
export function Crumbs({ current, orderId }: { current: string; orderId?: string }) {
  const trail = [
    ['/account', 'Your Account'],
    ...(current === 'Your Orders' ? [] : [['/orders', 'Your Orders']]),
    ...(orderId ? [[`/orders/${orderId}`, 'Order Details']] : []),
  ]
  return (
    <nav aria-label="Breadcrumb" className="text-xs">
      {trail.map(([href, label]) => (
        <Fragment key={href}>
          <Link href={href} className="link">{label}</Link>
          <span className="mx-1 text-muted" aria-hidden>›</span>
        </Fragment>
      ))}
      <span className="text-[#c45500]" aria-current="page">{current}</span>
    </nav>
  )
}

export function Thumb({ src, size = 'size-[90px]' }: { src: string; size?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-1.5 ${size}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
    </span>
  )
}

export function AddressLines({ shipTo: a }: { shipTo: ShipTo }) {
  return (
    <span className="block">
      <b className="block">{a.fullName}</b>
      <span className="block">{a.line1}</span>
      {a.line2 && <span className="block">{a.line2}</span>}
      <span className="block">{formatAddress({ line1: '', line2: '', city: a.city, state: a.state, zip: a.zip, country: a.country })}</span>
      <span className="block">{a.country}</span>
    </span>
  )
}

// ship-to name; a click/keyboard disclosure with the address (not hover-only), one open at a time
function ShipToDisclosure({ shipTo }: { shipTo: ShipTo }) {
  return (
    <details name="ship-to" className="group relative">
      <summary className="link inline-flex cursor-pointer items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        {shipTo.fullName}
        <CaretIcon className="h-1.5 w-2.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute top-full left-0 z-20 mt-1 w-60 rounded-lg border border-line bg-white p-3 text-sm text-ink shadow-[0_0_14px_rgba(15,17,17,0.25)]">
        <AddressLines shipTo={shipTo} />
      </div>
    </details>
  )
}

// One item's `usdCents` (default: all of it: price, tax share and duty share) in the order's currency, adding up with its unit price
const lineOf = (order: OrderRef, i: OrderItem, usdCents?: number) => {
  const full = itemRefundCents(i, countryCodeFromName(order.shipTo.country), order)
  return lineMinor(i, full, usdCents ?? full, order.currency, order.fxRate)
}

// An order's amounts, always in the order's own currency and rate (never the shopper's current one). Each component is
// converted on its own (items as unit price × quantity) and every total is the sum of converted components, so the Order
// Summary adds up in that currency and with the prices listed.
export function orderMoney(order: Order, view: OrderView) {
  const { currency, fxRate } = order
  const show = (minor: number) => formatMinor(minor, currency)
  const items = itemsTotal(order.items, currency, fxRate).minor
  const [shipping, tax, duty, credit] = [order.shippingCents, order.taxCents, order.dutyCents, order.creditCents].map((c) => convertCents(c, currency, fxRate))
  // what came off: the whole order, or each cancelled item's price with its tax and duty share (as orderView counts cancelledCents)
  const cancelled = view.status === 'cancelled' ? items + shipping + tax + duty - credit : view.items.reduce((s, i) => s + (i.cancelledAt ? lineOf(order, i) : 0), 0)
  const refunds = (list: OrderItem[]) => list.reduce((s, i) => s + lineOf(order, i, i.refundCents ?? 0), 0)
  return {
    country: countryCodeFromName(order.shipTo.country),
    text: (cents: number) => formatMoney(cents, currency, fxRate),
    items: show(items),
    shipping: show(shipping),
    tax: show(tax),
    duty: show(duty),
    credit: show(-credit),
    beforeTax: show(items + shipping - credit),
    cancelled: show(cancelled),
    charged: show(items + shipping + tax + duty - credit - cancelled),
    refunded: show(refunds(view.items.filter((i) => i.refundedAt))),
    refund: (list: OrderItem[]) => show(refunds(list)), // the refunds stored on these items
  }
}

function Row({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between gap-2 ${className}`}>
      <dt>{label}</dt>
      <dd className="whitespace-nowrap">{value}</dd>
    </div>
  )
}

// Order Summary lines. Cancelled items come off before the Grand Total, so it is what the shopper is actually charged.
// Pakistan orders have no sales tax: the estimated import duty and its note stand where the tax lines are.
export function OrderTotals({ order, view }: { order: Order; view: OrderView }) {
  const m = orderMoney(order, view)
  return (
    <dl className="space-y-0.5">
      <Row label="Item(s) Subtotal:" value={m.items} />
      <Row label="Shipping & Handling:" value={m.shipping} />
      {order.creditCents > 0 && <Row label="Nile day credit:" value={m.credit} />}
      {m.country === 'PK' ? (
        <>
          {order.dutyCents > 0 && <Row label="Import duty (estimated):" value={m.duty} />}
          <div>
            <dt className="sr-only">Import fees:</dt>
            <dd className="text-xs text-muted">{IMPORT_FEES_NOTE}</dd>
          </div>
        </>
      ) : (
        <>
          <Row label="Total before tax:" value={m.beforeTax} />
          <Row label="Estimated tax to be collected:" value={m.tax} />
        </>
      )}
      {view.cancelledCents > 0 && <Row label={view.status === 'cancelled' ? 'Cancelled:' : 'Cancelled items:'} value={`−${m.cancelled}`} />}
      <Row label="Grand Total:" value={m.charged} className="font-bold" />
      {view.refundCents > 0 && (
        // a refund with no return behind it is price protection (lib/price-lock), so say so
        <Row
          label={view.items.filter((i) => i.refundedAt).every((i) => !i.returnedAt) ? 'Price protection refund:' : 'Refund total:'}
          value={m.refunded}
          className={`font-bold ${green}`}
        />
      )}
    </dl>
  )
}

// itemsCents and dutyCents let a line show its share of the import duty the order was charged
type OrderRef = Pick<Order, 'id' | 'currency' | 'fxRate' | 'shipTo' | 'itemsCents' | 'dutyCents'>

function ItemStatus({ item, order }: { item: ViewItem; order: OrderRef }) {
  const s = item.state
  const replacement = item.replacementOrderId && (
    <>
      {' · '}
      <Link href={`/orders/${item.replacementOrderId}`} className="link whitespace-nowrap">Replacement order # {item.replacementOrderId}</Link>
    </>
  )
  // a whole cancelled order already says so in its headline
  if (s.kind === 'cancelled') return s.wholeOrder ? null : <p className="text-sm font-bold text-danger">Cancelled</p>
  if (s.kind === 'non-returnable') return <p className="text-xs text-muted">This item is non-returnable</p>
  if (s.kind === 'closed') return <p className="text-xs text-muted">Return window closed on {fullDate(s.returnBy)}</p>
  if (s.kind === 'open') {
    const urgent = s.daysLeft <= 7
    return (
      <p className="text-xs">
        Return or replace items: Eligible through {fullDate(s.returnBy)}{' '}
        <span className={`${chip} ${urgent ? 'border-[#c45500] text-[#c45500]' : `border-[#0b7b3c] ${green}`}`}>
          {s.daysLeft < 1 ? 'Last day' : `${plural(s.daysLeft, 'day')} left`}
        </span>
      </p>
    )
  }
  if (s.kind === 'return-started') {
    return (
      <p className="text-xs">
        <span className={`${chip} border-[#0b7b3c] font-bold ${green}`}>Return started</span>
        {item.returnMethod === 'ups-pickup' ? 'Pickup scheduled' : `Drop off by ${fullDate(s.dropOffBy)}`} ·{' '}
        <Link href={`/orders/${order.id}/return?code=${item.returnCode}`} className="link whitespace-nowrap">View return code</Link>
        {replacement}
      </p>
    )
  }
  if (s.kind === 'returned') {
    return (
      <p className="text-xs">
        <span className={`${chip} border-[#0b7b3c] font-bold ${green}`}>
          {item.refundCents ? `Refund issued: ${formatMinor(lineOf(order, item, item.refundCents), order.currency)}` : 'Return complete'}
        </span>
        {replacement}
      </p>
    )
  }
  return null
}

// one ordered item: thumbnail, title, qty and unit price (in the order's currency), return status, Buy it again / View your item (/ review)
export function ItemRow({ item, order, review }: { item: ViewItem; order: OrderRef; review?: { reviewed: boolean } }) {
  const p = getProduct(item.productId)
  return (
    <li className="flex gap-3">
      {p ? (
        <Link href={`/dp/${p.id}`} tabIndex={-1} aria-hidden>
          <Thumb src={item.thumbnail} />
        </Link>
      ) : (
        <Thumb src={item.thumbnail} />
      )}
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        {p ? <Link href={`/dp/${p.id}`} className="link line-clamp-2">{item.title}</Link> : <p className="line-clamp-2">{item.title}</p>}
        <p className="text-xs text-muted">
          Qty: {item.quantity} · {item.priceCents ? formatMoney(item.priceCents, order.currency, order.fxRate) : 'Free replacement'}
          {item.quantity > 1 && item.priceCents > 0 && ' each'}
        </p>
        <ItemStatus item={item} order={order} />
        <div className="flex flex-wrap items-start gap-2 pt-1">
          {p && p.stock > 0 ? <BuyAgainButton productId={p.id} title={item.title} /> : <span className="self-center text-xs text-danger">Currently unavailable</span>}
          {p && <Link href={`/dp/${p.id}`} className={`${small} btn-plain`}>View your item</Link>}
          {p && review && <Link href={`/review/create/${p.id}`} className={`${small} btn-plain`}>{review.reviewed ? 'Edit your review' : 'Write a product review'}</Link>}
        </div>
      </div>
    </li>
  )
}

// Right-hand actions with one yellow primary chosen by state: Cancel items before it ships, Track package in transit,
// Return or replace items once delivered, otherwise the product review.
export function OrderActions({ order, view, review }: { order: Order; view: OrderView; review?: { productId: number; reviewed: boolean } }) {
  if (view.status === 'cancelled') return null
  const base = `/orders/${order.id}`
  const tone = (primary: boolean) => `btn w-full ${primary ? 'btn-cart' : 'btn-plain'}`
  return (
    <div className="flex flex-col gap-2">
      {view.canCancel && <Link href={`${base}/cancel`} className={tone(true)}>Cancel items</Link>}
      {view.canReturn && <Link href={`${base}/return`} className={tone(true)}>Return or replace items</Link>}
      <Link href={`${base}/track`} className={tone(view.status === 'shipped' || view.status === 'out-for-delivery')}>Track package</Link>
      {review && (
        <Link href={`/review/create/${review.productId}`} className={tone(view.status === 'delivered' && !view.canReturn)}>
          {review.reviewed ? 'Edit your review' : 'Write a product review'}
        </Link>
      )}
    </div>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted uppercase">{label}</p>
      <div>{children}</div>
    </div>
  )
}

// Your Orders card. Phones get a single tappable row (actions live on Order Details), like Amazon's app.
export function OrderCard({ order, view, reviewed }: { order: Order; view: OrderView; reviewed: Set<number> }) {
  const base = `/orders/${order.id}`
  const m = orderMoney(order, view)
  const reviewable = view.status === 'delivered' ? view.items.filter((i) => i.state.kind !== 'cancelled' && getProduct(i.productId)) : []
  const single = reviewable.length === 1 ? reviewable[0] : null
  const cancelledItems = view.status === 'cancelled' ? 0 : view.items.filter((i) => i.state.kind === 'cancelled').length
  // the phone row is the only list view there, so it also carries what happened after the order
  const note = [
    order.replacementFor && 'Free replacement',
    view.returnPending && 'Return started',
    view.refundCents > 0 && `Refund issued: ${m.refunded}`,
    cancelledItems > 0 && `${plural(cancelledItems, 'item')} cancelled`,
  ].filter(Boolean).join(' · ')
  return (
    <>
      <Link href={base} className="flex items-center gap-3 rounded-lg border border-line bg-white p-3 sm:hidden">
        {order.items[0] && <Thumb src={order.items[0].thumbnail} size="size-16" />}
        <span className="min-w-0 flex-1">
          <b className="block">{view.headline}</b>
          {note && <span className="block text-xs font-bold">{note}</span>}
          <span className="line-clamp-1 text-sm">{order.items.map((i) => i.title).join(', ')}</span>
          <span className="block text-xs text-muted">Order # {order.id}</span>
        </span>
        <ChevronIcon className="size-5 shrink-0 text-muted" />
      </Link>

      <article aria-label={`Order ${order.id}`} className="hidden rounded-lg border border-line sm:block">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-2 rounded-t-lg border-b border-line bg-[#f0f2f2] px-4 py-3 text-sm">
          <Meta label="Order placed">{fullDate(order.placedAt)}</Meta>
          <Meta label="Total">
            <span className="whitespace-nowrap">{m.charged}</span>
            {view.refundCents > 0 && <span className={`block text-xs whitespace-nowrap ${green}`}>Refunded {m.refunded}</span>}
          </Meta>
          <Meta label="Ship to"><ShipToDisclosure shipTo={order.shipTo} /></Meta>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted uppercase">Order # {order.id}</p>
            <p>
              <Link href={base} className="link">View order details</Link>
              <span className="mx-2 text-line" aria-hidden>|</span>
              <Link href={`${base}/invoice`} className="link">Invoice</Link>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4 md:flex-row">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{view.headline}</h2>
            <p className="text-sm text-muted">{view.subline}</p>
            {view.pooledNote && <p className="text-sm">{view.pooledNote}</p>}
            {order.replacementFor && (
              <p className="text-sm">
                Replacement for <Link href={`/orders/${order.replacementFor}`} className="link">order # {order.replacementFor}</Link>
              </p>
            )}
            <ul className="mt-3 space-y-5">
              {view.items.map((i) => (
                <ItemRow key={i.productId} item={i} order={order} review={!single && reviewable.includes(i) ? { reviewed: reviewed.has(i.productId) } : undefined} />
              ))}
            </ul>
          </div>
          <div className="md:w-[220px]">
            <OrderActions order={order} view={view} review={single ? { productId: single.productId, reviewed: reviewed.has(single.productId) } : undefined} />
          </div>
        </div>
      </article>
    </>
  )
}

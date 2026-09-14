// Orders: checkout pricing (shared by the checkout page and placeOrder), atomic order creation, reads, the simulated
// order lifecycle (status, tracking, return windows) and the post-purchase writes (cancel, return, demo controls).
import { randomInt } from 'node:crypto'
import { DROP_OFF_DAYS, type ReturnMethod } from '@/components/orders/rules'
import type { Address } from './addresses'
import { getCart, MAX_QTY } from './cart'
import { getProduct, type Product } from './catalog'
import { query } from './db'
import { EXPEDITED_SHIPPING, FREE_SHIPPING_MIN, fastestDelivery, STANDARD_SHIPPING, standardDelivery } from './delivery'
import { fullDate, toCents } from './format'
import type { Card } from './payments'

// Estimated sales tax: one flat 8.25% on items + shipping for every US address (a stand-in for per-state rates).
export const TAX_RATE = 0.0825

export type Speed = 'standard' | 'expedited'
export type OrderLine = { product: Product; quantity: number; requested: number }

// quantity is capped by stock and the 30-per-customer limit; `requested` keeps what the shopper asked for
const orderLine = (product: Product, requested: number): OrderLine => ({ product, requested, quantity: Math.min(requested, product.stock, MAX_QTY) })

// cart checkout: lines not saved for later and in stock
export async function cartLines(): Promise<OrderLine[]> {
  return (await getCart()).filter((l) => !l.savedForLater && l.product.stock > 0).map((l) => orderLine(l.product, l.quantity))
}

// buy now: just this product, the cart is untouched; null when the id is unknown or it is out of stock
export function buyNowLine(id: unknown, qty: unknown): OrderLine | null {
  const product = getProduct(Number(id))
  if (!product || product.stock <= 0) return null
  return orderLine(product, Math.max(1, Math.floor(Number(qty)) || 1))
}

// what the shopper saw (product, quantity, price); placeOrder refuses to charge anything else
export const linesKey = (lines: OrderLine[]) => lines.map((l) => `${l.product.id}x${l.quantity}@${toCents(l.product.price)}`).join(',')

export type Quote = {
  speed: Speed
  itemCount: number
  itemsCents: number
  shippingCents: number
  freeShippingCents: number
  beforeTaxCents: number
  taxCents: number
  totalCents: number
  deliverBy: Date
}

// Standard is FREE from $35 of items (else $6.99) and arrives when the slowest item does; Expedited is $9.99 and faster.
export function quote(lines: OrderLine[], speed: Speed, now = new Date()): Quote {
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0)
  const itemsCents = lines.reduce((sum, l) => sum + toCents(l.product.price) * l.quantity, 0)
  const free = speed === 'standard' && itemsCents >= toCents(FREE_SHIPPING_MIN)
  const shippingCents = toCents(speed === 'expedited' ? EXPEDITED_SHIPPING : STANDARD_SHIPPING)
  const freeShippingCents = free ? shippingCents : 0
  const beforeTaxCents = itemsCents + shippingCents - freeShippingCents
  const taxCents = Math.round(beforeTaxCents * TAX_RATE)
  const arrive = speed === 'expedited' ? fastestDelivery : standardDelivery
  const deliverBy = new Date(Math.max(now.getTime(), ...lines.map((l) => arrive(l.product, now).getTime())))
  deliverBy.setUTCHours(20, 0, 0, 0) // delivered by 8pm UTC on the arrival day
  return { speed, itemCount, itemsCents, shippingCents, freeShippingCents, beforeTaxCents, taxCents, totalCents: beforeTaxCents + taxCents, deliverBy }
}

// "113-1234567-1234567"
export const newOrderId = () => `113-${randomInt(1e6, 1e7)}-${randomInt(1e6, 1e7)}`

// ponytail: the running dev database applied db/schema.sql before these columns existed, so apply those changes lazily
// once per process; drop this once every database has run the current schema.sql
const MIGRATIONS = [
  'alter table orders add column if not exists idempotency_key text',
  'create unique index if not exists orders_idempotency_key on orders (idempotency_key)',
  'alter table orders add column if not exists replacement_for text',
  `alter table order_items add column if not exists cancelled_at timestamptz, add column if not exists cancel_reason text,
     add column if not exists return_comment text, add column if not exists return_code text, add column if not exists return_method text,
     add column if not exists return_resolution text, add column if not exists refund_cents int, add column if not exists refunded_at timestamptz,
     add column if not exists replacement_order_id text`,
]
let schemaReady: Promise<unknown> | undefined
function ensureSchema() {
  schemaReady ??= MIGRATIONS.reduce<Promise<unknown>>((p, sql) => p.then(() => query(sql)), Promise.resolve()).catch((e) => {
    schemaReady = undefined
    throw e
  })
  return schemaReady
}

export async function orderIdForKey(userId: string, key: string) {
  await ensureSchema()
  const [row] = await query<{ id: string }>('select id from orders where user_id = $1 and idempotency_key = $2', [userId, key])
  return row?.id ?? null
}

export type ShipTo = Omit<Address, 'id' | 'isDefault'>
export type PaymentSnapshot = { brand: string; last4: string; nameOnCard: string }

// Inserts the order, its items and (for cart checkouts) deletes the purchased cart lines in ONE statement, so it is
// atomic without transactions. Returns null when this idempotency key already placed an order.
export async function createOrder(o: { userId: string; key: string; address: Address; card: Card; lines: OrderLine[]; speed: Speed; fromCart: boolean }) {
  await ensureSchema()
  const q = quote(o.lines, o.speed)
  const a = o.address
  const shipTo: ShipTo = { fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, zip: a.zip, country: a.country, instructions: a.instructions }
  const payment: PaymentSnapshot = { brand: o.card.brand, last4: o.card.last4, nameOnCard: o.card.nameOnCard }
  const items = o.lines.map((l) => ({ product_id: l.product.id, title: l.product.title, thumbnail: l.product.thumbnail, price_cents: toCents(l.product.price), quantity: l.quantity }))
  const [row] = await query<{ id: string }>(
    `with o as (
       insert into orders (id, user_id, ship_to, payment, delivery_speed, items_cents, shipping_cents, tax_cents, total_cents, deliver_by, idempotency_key)
       values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11)
       on conflict (idempotency_key) do nothing
       returning id
     ), items as (
       insert into order_items (order_id, product_id, title, thumbnail, price_cents, quantity)
       select o.id, x.product_id, x.title, x.thumbnail, x.price_cents, x.quantity
       from o, jsonb_to_recordset($12::jsonb) as x(product_id int, title text, thumbnail text, price_cents int, quantity int)
     ), cleared as (
       delete from cart_items
       where $13::boolean and owner = $14 and saved_for_later = false and exists (select 1 from o)
         and product_id in (select y.product_id from jsonb_to_recordset($12::jsonb) as y(product_id int))
     )
     select id from o`,
    [newOrderId(), o.userId, JSON.stringify(shipTo), JSON.stringify(payment), o.speed, q.itemsCents, q.shippingCents - q.freeShippingCents,
      q.taxCents, q.totalCents, q.deliverBy, o.key, JSON.stringify(items), o.fromCart, `u:${o.userId}`],
  )
  return row?.id ?? null
}

export type OrderItem = {
  productId: number
  title: string
  thumbnail: string
  priceCents: number
  quantity: number
  returnReason: string | null
  returnedAt: Date | null // when the return was started
  cancelledAt: Date | null
  returnCode: string | null
  returnMethod: ReturnMethod | null
  returnResolution: 'refund' | 'replacement' | null
  refundCents: number | null // estimated at return start, issued at refundedAt
  refundedAt: Date | null
  replacementOrderId: string | null
}
export type Order = {
  id: string
  shipTo: ShipTo
  payment: PaymentSnapshot
  deliverySpeed: Speed
  itemsCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  placedAt: Date
  deliverBy: Date
  cancelledAt: Date | null
  replacementFor: string | null
  items: OrderItem[]
}

type ItemRow = Omit<OrderItem, 'returnedAt' | 'cancelledAt' | 'refundedAt'> & { returnedAt: string | null; cancelledAt: string | null; refundedAt: string | null }
type OrderRow = {
  id: string; ship_to: ShipTo; payment: PaymentSnapshot; delivery_speed: Speed; items_cents: number; shipping_cents: number; tax_cents: number
  total_cents: number; placed_at: Date; deliver_by: Date; cancelled_at: Date | null; replacement_for: string | null; items: ItemRow[]
}

const ORDER_SELECT = `
  select o.id, o.ship_to, o.payment, o.delivery_speed, o.items_cents, o.shipping_cents, o.tax_cents, o.total_cents, o.placed_at, o.deliver_by,
    o.cancelled_at, o.replacement_for,
    coalesce(json_agg(json_build_object('productId', i.product_id, 'title', i.title, 'thumbnail', i.thumbnail, 'priceCents', i.price_cents,
      'quantity', i.quantity, 'returnReason', i.return_reason, 'returnedAt', i.returned_at, 'cancelledAt', i.cancelled_at,
      'returnCode', i.return_code, 'returnMethod', i.return_method, 'returnResolution', i.return_resolution, 'refundCents', i.refund_cents,
      'refundedAt', i.refunded_at, 'replacementOrderId', i.replacement_order_id) order by i.title) filter (where i.order_id is not null), '[]') as items
  from orders o left join order_items i on i.order_id = o.id`

const toDate = (s: string | null) => (s ? new Date(s) : null)

const fromRow = (r: OrderRow): Order => ({
  id: r.id,
  shipTo: r.ship_to,
  payment: r.payment,
  deliverySpeed: r.delivery_speed,
  itemsCents: r.items_cents,
  shippingCents: r.shipping_cents,
  taxCents: r.tax_cents,
  totalCents: r.total_cents,
  placedAt: new Date(r.placed_at),
  deliverBy: new Date(r.deliver_by),
  cancelledAt: r.cancelled_at ? new Date(r.cancelled_at) : null,
  replacementFor: r.replacement_for,
  items: r.items.map((i) => ({ ...i, returnedAt: toDate(i.returnedAt), cancelledAt: toDate(i.cancelledAt), refundedAt: toDate(i.refundedAt) })),
})

// newest first, items included
export async function getOrders(userId: string): Promise<Order[]> {
  await ensureSchema()
  const rows = await query<OrderRow>(`${ORDER_SELECT} where o.user_id = $1 group by o.id order by o.placed_at desc`, [userId])
  return rows.map(fromRow)
}

// null unless the order exists and belongs to this user
export async function getOrder(userId: string, id: string): Promise<Order | null> {
  await ensureSchema()
  const [row] = await query<OrderRow>(`${ORDER_SELECT} where o.user_id = $1 and o.id = $2 group by o.id`, [userId, id])
  return row ? fromRow(row) : null
}

export type OrderStatus = 'ordered' | 'shipped' | 'out-for-delivery' | 'delivered' | 'cancelled'
export const STEPS = ['ordered', 'shipped', 'out-for-delivery', 'delivered'] as const

const HOUR = 3_600_000
const DAY = 24 * HOUR
export const RETURN_DAYS = 30

// Lifecycle, derived from timestamps (no background jobs):
//   ordered → shipped: halfway to out-for-delivery, at most 24h after placing
//   shipped → out for delivery: 8am UTC on the arrival day (at least 1h before delivery, for the demo control's
//     arbitrary delivery times), or halfway there for orders delivered sooner, so the steps always stay in order
//   out for delivery → delivered: deliver_by (8pm UTC on the arrival day)
//   cancelled: cancelled_at is set (only allowed while still 'ordered')
// Cancel is allowed before it ships; returns are open for 30 days after delivery.
export function orderStatus(o: Pick<Order, 'placedAt' | 'deliverBy' | 'cancelledAt'>, now = new Date()) {
  const deliveredAt = o.deliverBy
  const placed = o.placedAt.getTime()
  const morning = new Date(deliveredAt).setUTCHours(8, 0, 0, 0)
  const outForDeliveryAt = new Date(Math.max(Math.min(morning, deliveredAt.getTime() - HOUR), placed + Math.max(0, deliveredAt.getTime() - placed) / 2))
  const shippedAt = new Date(placed + Math.min(DAY, (outForDeliveryAt.getTime() - placed) / 2))
  const returnBy = new Date(deliveredAt.getTime() + RETURN_DAYS * DAY)
  const t = now.getTime()
  const status: OrderStatus = o.cancelledAt
    ? 'cancelled'
    : t >= deliveredAt.getTime() ? 'delivered' : t >= outForDeliveryAt.getTime() ? 'out-for-delivery' : t >= shippedAt.getTime() ? 'shipped' : 'ordered'
  return {
    status,
    shippedAt,
    outForDeliveryAt,
    deliveredAt,
    returnBy,
    canCancel: status === 'ordered',
    canReturn: status === 'delivered' && t <= returnBy.getTime(),
  }
}

// Per-item return windows come from the catalog: "30 days return policy" → 30, "No return policy" → null (non-returnable)
export function returnDays(productId: number) {
  const m = getProduct(productId)?.returnPolicy.match(/(\d+) days?/)
  return m ? Number(m[1]) : null
}

export type ItemState =
  | { kind: 'cancelled'; wholeOrder: boolean }
  | { kind: 'in-transit' }
  | { kind: 'non-returnable' }
  | { kind: 'open'; returnBy: Date; daysLeft: number }
  | { kind: 'closed'; returnBy: Date }
  | { kind: 'return-started'; dropOffBy: Date }
  | { kind: 'returned' }

const utcDay = (d: Date) => Math.floor(d.getTime() / DAY)

function itemState(i: OrderItem, status: OrderStatus, deliveredAt: Date, now: Date): ItemState {
  if (i.cancelledAt || status === 'cancelled') return { kind: 'cancelled', wholeOrder: status === 'cancelled' }
  if (i.returnedAt) return i.refundedAt ? { kind: 'returned' } : { kind: 'return-started', dropOffBy: new Date(i.returnedAt.getTime() + DROP_OFF_DAYS * DAY) }
  if (status !== 'delivered') return { kind: 'in-transit' }
  const days = returnDays(i.productId)
  if (days === null) return { kind: 'non-returnable' }
  const returnBy = new Date(deliveredAt.getTime() + days * DAY)
  return now <= returnBy ? { kind: 'open', returnBy, daysLeft: utcDay(returnBy) - utcDay(now) } : { kind: 'closed', returnBy }
}

// why an item can't be returned right now; null when it can
export function returnBlocker(s: ItemState) {
  if (s.kind === 'cancelled') return 'This item was cancelled.'
  if (s.kind === 'in-transit') return 'Returns open once your order is delivered.'
  if (s.kind === 'non-returnable') return 'This item is non-returnable.'
  if (s.kind === 'closed') return `Return window closed on ${fullDate(s.returnBy)}`
  if (s.kind === 'return-started' || s.kind === 'returned') return 'A return for this item has already started.'
  return null
}

// what a return or cancellation gives back for one line: its price plus its share of the tax
export const itemRefundCents = (i: Pick<OrderItem, 'priceCents' | 'quantity'>) => i.priceCents * i.quantity + Math.round(i.priceCents * i.quantity * TAX_RATE)

const monthDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })

function arrivingDay(d: Date, now: Date) {
  const days = utcDay(d) - utcDay(now)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return days < 7 ? d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : monthDay(d)
}

const SUBLINES: Record<OrderStatus, string> = {
  ordered: 'Not yet shipped',
  shipped: 'Shipped',
  'out-for-delivery': 'Out for delivery',
  delivered: 'Package was left near the front door or porch',
  cancelled: 'You have not been charged for this order.',
}

// Everything the order pages render: status, headline, per-item states and refunds.
export function orderView(o: Order, now = new Date()) {
  const s = orderStatus(o, now)
  const items = o.items.map((i) => ({ ...i, state: itemState(i, s.status, s.deliveredAt, now) }))
  // not charged for cancelled items (the whole total when the order is cancelled); refunds count once issued
  const cancelledCents = s.status === 'cancelled' ? o.totalCents : items.reduce((sum, i) => sum + (i.cancelledAt ? itemRefundCents(i) : 0), 0)
  const refundCents = items.reduce((sum, i) => sum + (i.refundedAt ? (i.refundCents ?? 0) : 0), 0)
  const hour = s.deliveredAt.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' }).replace(':00', '')
  const headline =
    s.status === 'cancelled' ? 'Cancelled'
    : s.status === 'delivered' ? (utcDay(now) === utcDay(s.deliveredAt) ? 'Delivered today' : `Delivered ${monthDay(s.deliveredAt)}`)
    : s.status === 'out-for-delivery' ? `Now arriving today by ${hour}`
    : `Arriving ${arrivingDay(s.deliveredAt, now)}`
  return {
    ...s,
    items,
    headline,
    subline: SUBLINES[s.status],
    step: STEPS.indexOf(s.status as (typeof STEPS)[number]), // -1 when cancelled
    // a free replacement is part of a return, so it can't be cancelled on its own (the shopper would get neither)
    canCancel: s.canCancel && !o.replacementFor,
    cancelledCents,
    chargedCents: o.totalCents - cancelledCents,
    refundCents,
    canReturn: items.some((i) => i.state.kind === 'open'),
    returnPending: items.some((i) => i.state.kind === 'return-started'),
  }
}
export type OrderView = ReturnType<typeof orderView>
export type ViewItem = OrderView['items'][number]

// "NL" + 14 digits, stable per order
export const trackingId = (orderId: string) => `NL${orderId.replace(/\D/g, '').slice(3)}`

export type TrackingEvent = { at: Date; label: string; place: string }
const ORIGIN = 'Reno, NV'

// simulated carrier scans along the same timeline as orderStatus, newest first, only those that have happened
export function trackingEvents(o: Order, now = new Date()): TrackingEvent[] {
  const s = orderStatus(o, now)
  const dest = `${o.shipTo.city}, ${o.shipTo.state}`
  const between = (a: Date, b: Date) => new Date((a.getTime() + b.getTime()) / 2)
  const events: TrackingEvent[] = o.cancelledAt
    ? [{ at: o.placedAt, label: 'Order received', place: '' }, { at: o.cancelledAt, label: 'Order cancelled', place: '' }]
    : [
        { at: o.placedAt, label: 'Order received', place: '' },
        { at: between(o.placedAt, s.shippedAt), label: 'Shipping label created, package is being prepared', place: ORIGIN },
        { at: s.shippedAt, label: 'Shipped', place: ORIGIN },
        { at: between(s.shippedAt, s.outForDeliveryAt), label: 'Package arrived at a carrier facility', place: dest },
        { at: s.outForDeliveryAt, label: 'Out for delivery', place: dest },
        { at: s.deliveredAt, label: 'Delivered', place: dest },
      ]
  return events.filter((e) => e.at.getTime() <= now.getTime()).reverse()
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newReturnCode = () => `RT-${Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')}`

// Cancels the chosen items while the order still hasn't shipped (shipsAt comes from orderStatus); the whole order is
// cancelled once no active items remain. Replacement orders are never cancelled here (see orderView.canCancel).
// One statement, so the check and the writes can't interleave. Returns the count.
export async function cancelOrderItems(userId: string, orderId: string, productIds: number[], reason: string | null, shipsAt: Date) {
  await ensureSchema()
  const [row] = await query<{ n: number }>(
    `with c as (
       update order_items i set cancelled_at = now(), cancel_reason = $4
       from orders o
       where o.id = i.order_id and o.id = $1 and o.user_id = $2 and o.cancelled_at is null and o.replacement_for is null and now() < $5::timestamptz
         and i.cancelled_at is null and i.product_id in (select value::int from jsonb_array_elements_text($3::jsonb))
       returning i.product_id
     ), whole as (
       update orders set cancelled_at = now()
       where id = $1 and user_id = $2 and exists (select 1 from c)
         and not exists (select 1 from order_items where order_id = $1 and cancelled_at is null and product_id not in (select product_id from c))
     )
     select count(*)::int as n from c`,
    [orderId, userId, JSON.stringify(productIds), reason, shipsAt],
  )
  return row?.n ?? 0
}

// Starts a return for delivered, not-yet-returned items. A replacement also creates a $0.00 order for the same items,
// in the same statement. Returns how many items the return covers (0 when nothing was eligible any more).
export async function createReturn(r: {
  userId: string; orderId: string; items: { productId: number; refundCents: number }[]; reason: string; comment: string
  method: ReturnMethod; replacement: { deliverBy: Date } | null; code: string
}) {
  await ensureSchema()
  const replacementId = r.replacement ? newOrderId() : null
  const [row] = await query<{ n: number }>(
    `with upd as (
       update order_items i set returned_at = now(), return_reason = $3, return_comment = $4, return_method = $5, return_resolution = $6,
         return_code = $7, refund_cents = x.refund_cents, replacement_order_id = $8::text
       from orders o, jsonb_to_recordset($9::jsonb) as x(product_id int, refund_cents int)
       where o.id = i.order_id and o.id = $1 and o.user_id = $2 and o.cancelled_at is null and o.deliver_by <= now()
         and i.product_id = x.product_id and i.returned_at is null and i.cancelled_at is null
       returning i.product_id, i.title, i.thumbnail, i.quantity, o.ship_to, o.payment
     ), rep as (
       insert into orders (id, user_id, ship_to, payment, delivery_speed, items_cents, shipping_cents, tax_cents, total_cents, deliver_by, replacement_for)
       select $8::text, $2::uuid, u.ship_to, u.payment, 'standard', 0, 0, 0, 0, $10::timestamptz, $1::text
       from (select ship_to, payment from upd limit 1) u
       where $8::text is not null
       returning id
     ), rep_items as (
       insert into order_items (order_id, product_id, title, thumbnail, price_cents, quantity)
       select rep.id, upd.product_id, upd.title, upd.thumbnail, 0, upd.quantity from rep, upd
     )
     select count(*)::int as n from upd`,
    [r.orderId, r.userId, r.reason, r.comment, r.method, r.replacement ? 'replacement' : 'refund', r.code, replacementId,
      JSON.stringify(r.items.map((i) => ({ product_id: i.productId, refund_cents: i.refundCents }))), r.replacement?.deliverBy ?? new Date()],
  )
  return row?.n ?? 0
}

// Demo control: the package arrives now. Only moves an undelivered, uncancelled order of this user forward. A just-placed
// order is also dated back ~30h, so the derived label, ship, facility and out-for-delivery scans spread over a
// believable day instead of all landing on the same minute.
export async function markDelivered(userId: string, orderId: string) {
  await ensureSchema()
  await query(
    `update orders set deliver_by = now(), placed_at = least(placed_at, now() - interval '30 hours 23 minutes')
     where id = $1 and user_id = $2 and cancelled_at is null and deliver_by > now()`,
    [orderId, userId],
  )
}

// Demo control: the carrier scans the returned items, so their refunds are issued.
export async function receiveReturns(userId: string, orderId: string) {
  await ensureSchema()
  await query(
    `update order_items i set refunded_at = now() from orders o
     where o.id = i.order_id and o.id = $1 and o.user_id = $2 and i.returned_at is not null and i.refunded_at is null`,
    [orderId, userId],
  )
}

export async function reviewedProductIds(userId: string) {
  const rows = await query<{ product_id: number }>('select product_id from reviews where user_id = $1', [userId])
  return new Set(rows.map((r) => r.product_id))
}

// Buy Again: distinct products from orders that weren't cancelled, most recently bought first
export function purchasedProducts(orders: Order[]) {
  const seen = new Map<number, { product: Product; times: number; lastPurchased: Date }>()
  for (const o of orders) {
    if (o.replacementFor) continue
    for (const i of o.items) {
      const product = getProduct(i.productId)
      if (i.cancelledAt || !product) continue
      const e = seen.get(i.productId)
      if (e) e.times++
      else seen.set(i.productId, { product, times: 1, lastPurchased: o.placedAt })
    }
  }
  return [...seen.values()]
}

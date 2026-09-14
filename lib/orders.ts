// Orders: checkout pricing (shared by the checkout page and placeOrder), atomic order creation, and reads plus
// the order lifecycle for Your Orders.
import { randomInt } from 'node:crypto'
import type { Address } from './addresses'
import { getCart, MAX_QTY } from './cart'
import { getProduct, type Product } from './catalog'
import { query } from './db'
import { EXPEDITED_SHIPPING, FREE_SHIPPING_MIN, fastestDelivery, STANDARD_SHIPPING, standardDelivery } from './delivery'
import { toCents } from './format'
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

// ponytail: the running dev database applied db/schema.sql before idempotency_key existed, so apply that one change
// lazily once per process; drop this once every database has run the current schema.sql
let schemaReady: Promise<unknown> | undefined
function ensureSchema() {
  schemaReady ??= query('alter table orders add column if not exists idempotency_key text')
    .then(() => query('create unique index if not exists orders_idempotency_key on orders (idempotency_key)'))
    .catch((e) => {
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

export type OrderItem = { productId: number; title: string; thumbnail: string; priceCents: number; quantity: number; returnReason: string | null; returnedAt: Date | null }
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
  items: OrderItem[]
}

type OrderRow = {
  id: string; ship_to: ShipTo; payment: PaymentSnapshot; delivery_speed: Speed; items_cents: number; shipping_cents: number; tax_cents: number
  total_cents: number; placed_at: Date; deliver_by: Date; cancelled_at: Date | null
  items: { productId: number; title: string; thumbnail: string; priceCents: number; quantity: number; returnReason: string | null; returnedAt: string | null }[]
}

const ORDER_SELECT = `
  select o.id, o.ship_to, o.payment, o.delivery_speed, o.items_cents, o.shipping_cents, o.tax_cents, o.total_cents, o.placed_at, o.deliver_by, o.cancelled_at,
    coalesce(json_agg(json_build_object('productId', i.product_id, 'title', i.title, 'thumbnail', i.thumbnail, 'priceCents', i.price_cents,
      'quantity', i.quantity, 'returnReason', i.return_reason, 'returnedAt', i.returned_at) order by i.title) filter (where i.order_id is not null), '[]') as items
  from orders o left join order_items i on i.order_id = o.id`

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
  items: r.items.map((i) => ({ ...i, returnedAt: i.returnedAt ? new Date(i.returnedAt) : null })),
})

// newest first, items included
export async function getOrders(userId: string): Promise<Order[]> {
  const rows = await query<OrderRow>(`${ORDER_SELECT} where o.user_id = $1 group by o.id order by o.placed_at desc`, [userId])
  return rows.map(fromRow)
}

// null unless the order exists and belongs to this user
export async function getOrder(userId: string, id: string): Promise<Order | null> {
  const [row] = await query<OrderRow>(`${ORDER_SELECT} where o.user_id = $1 and o.id = $2 group by o.id`, [userId, id])
  return row ? fromRow(row) : null
}

export type OrderStatus = 'ordered' | 'shipped' | 'out-for-delivery' | 'delivered' | 'cancelled'

const HOUR = 3_600_000
const DAY = 24 * HOUR
export const RETURN_DAYS = 30

// Lifecycle, derived from timestamps (no background jobs):
//   ordered → shipped: halfway to out-for-delivery, at most 24h after placing
//   shipped → out for delivery: 8am UTC on the arrival day (deliver_by minus 12h)
//   out for delivery → delivered: deliver_by (8pm UTC on the arrival day)
//   cancelled: cancelled_at is set (only allowed while still 'ordered')
// Cancel is allowed before it ships; returns are open for 30 days after delivery.
export function orderStatus(o: Pick<Order, 'placedAt' | 'deliverBy' | 'cancelledAt'>, now = new Date()) {
  const deliveredAt = o.deliverBy
  const outForDeliveryAt = new Date(deliveredAt.getTime() - 12 * HOUR)
  const shippedAt = new Date(o.placedAt.getTime() + Math.min(DAY, Math.max(0, outForDeliveryAt.getTime() - o.placedAt.getTime()) / 2))
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

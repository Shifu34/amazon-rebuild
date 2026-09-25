'use server'

import { createHash, randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { CANCEL_REASONS, RETURN_REASONS } from '@/components/orders/rules'
import { getAddress } from '@/lib/addresses'
import { hashPassword, startSession } from '@/lib/auth'
import { one, query } from '@/lib/db'
import { recordView } from '@/lib/history'
import { addToList } from '@/lib/lists'
import {
  buyNowLine, cancelOrderItems, createOrder, createReturn, getOrder, itemRefundCents, newReturnCode, orderStatus, type Order, type OrderLine, type Speed,
} from '@/lib/orders'
import { getCard } from '@/lib/payments'
import { countryCodeFromName } from '@/lib/region'

export type DemoState = { error: string } | null

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const WAIT = 'A demo account was just created from your network. Please wait a minute and try again.'

// per-instance guard against a double submit racing itself; the users table covers other instances
const inflight = new Map<string, Promise<string>>()

// "Explore with a demo account": a fresh shopper with an address, a test card, a Shopping List, browsing history and an order
// in every state, then signed in on Your Orders. The page's token makes it idempotent: a double submit, or Back and submit
// again within 10 minutes, signs into the same shopper instead of making another.
export async function startDemo(_prev: DemoState, form: FormData): Promise<DemoState> {
  const token = String(form.get('token') ?? '')
  if (!TOKEN.test(token)) return { error: 'This page has expired. Reload it and try again.' }
  const email = `demo-${token.replace(/-/g, '').slice(0, 16)}@example.com`

  const pending = inflight.get(token)
  const existing = pending ? { id: await pending } : await one<{ id: string }>("select id from users where email = $1 and created_at > now() - interval '10 minutes'", [email])
  if (existing) {
    await startSession(existing.id)
    redirect('/orders')
  }

  // One new demo per network per minute, in the database so every serverless instance sees it. Only a hash of the IP is kept.
  // ponytail: two simultaneous first requests from one network can both pass the not-exists check; fine for a demo button
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local'
  const ipHash = createHash('sha256').update(ip).digest('hex')
  await query("delete from demo_signups where created_at < now() - interval '1 day'")
  const claimed = await one(
    "insert into demo_signups (ip_hash) select $1 where not exists (select 1 from demo_signups where ip_hash = $1 and created_at > now() - interval '1 minute') returning 1",
    [ipHash],
  )
  if (!claimed) return { error: WAIT }

  const work = createDemoShopper(email)
  inflight.set(token, work)
  let userId: string
  try {
    userId = await work
  } catch {
    await query("delete from demo_signups where ip_hash = $1 and created_at > now() - interval '1 minute'", [ipHash])
    return { error: "We couldn't set up the demo account. Please try again." }
  } finally {
    inflight.delete(token)
  }
  await startSession(userId)
  redirect('/orders')
}

async function createDemoShopper(email: string) {
  const user = await one<{ id: string }>(
    'insert into users (name, email, password_hash) values ($1, $2, $3) on conflict (email) do nothing returning id',
    ['Demo Shopper', email, await hashPassword(randomBytes(24).toString('base64url'))],
  )
  if (!user) throw new Error('demo email already used') // an expired token's account: the caller asks for a reload
  const userId = user.id
  const now = new Date()

  const [addressRow] = await query<{ id: string }>(
    `insert into addresses (user_id, full_name, phone, line1, city, state, zip, instructions, is_default)
     values ($1, 'Demo Shopper', '(206) 555-0142', '410 Terry Ave N', 'Seattle', 'WA', '98109', 'Leave packages at the front desk', true) returning id`,
    [userId],
  )
  const [cardRow] = await query<{ id: string }>(
    `insert into payment_methods (user_id, brand, last4, exp_month, exp_year, name_on_card, is_default)
     values ($1, 'Visa', '4242', 12, $2, 'Demo Shopper', true) returning id`,
    [userId, now.getUTCFullYear() + 3],
  )
  const [address, card] = await Promise.all([getAddress(userId, addressRow.id), getCard(userId, cardRow.id)])
  if (!address || !card) throw new Error('demo address or card missing')

  for (const id of [51, 66, 43, 118]) await addToList(userId, id) // Shopping List
  for (const id of [17, 84, 8, 99, 103]) await recordView(userId, id) // browsing history, most recent last

  // Orders go through checkout's own createOrder (priced and quoted by lib/orders as of placedAt), back-dated so
  // orderStatus derives each state. Out for delivery runs until 8 PM UTC today, or for 50 minutes outside 08:00-19:00 UTC.
  const t = now.getTime()
  const eightPm = new Date(now).setUTCHours(20, 0, 0, 0)
  const at = (ms: number) => new Date(ms)
  const orders: { key: string; items: [id: number, qty: number][]; speed?: Speed; placedAt: Date; deliverBy?: Date; then?: (o: Order) => Promise<unknown> }[] = [
    {
      key: 'return-started', items: [[6, 1]], placedAt: at(t - 9 * DAY), deliverBy: at(t - 6 * DAY),
      then: (o) => createReturn({
        userId, orderId: o.id, items: o.items.map((i) => ({ productId: i.productId, refundCents: itemRefundCents(i, countryCodeFromName(o.shipTo.country), o) })), // drop-off returns are free
        reason: RETURN_REASONS[0], comment: '', method: 'ups-store', replacement: null, code: newReturnCode(),
      }),
    },
    { key: 'delivered', items: [[90, 1]], placedAt: at(t - 4 * DAY), deliverBy: at(t - 2 * DAY) },
    { key: 'out-for-delivery', items: [[47, 1]], speed: 'expedited', placedAt: at(t - 2 * DAY), deliverBy: at(now.getUTCHours() >= 8 && eightPm - t > HOUR ? eightPm : t + 50 * MIN) },
    { key: 'shipped', items: [[83, 1]], placedAt: at(t - 26 * HOUR) }, // ships in 3-5 days, so the quoted date is days away
    {
      key: 'cancelled', items: [[4, 1]], placedAt: at(t - 5 * HOUR),
      then: (o) => cancelOrderItems(userId, o.id, o.items.map((i) => i.productId), CANCEL_REASONS[0], orderStatus(o).shippedAt),
    },
    { key: 'not-shipped', items: [[27, 2], [34, 1]], placedAt: at(t - 20 * MIN) },
  ]
  for (const o of orders) {
    const lines = o.items.map(([id, qty]) => buyNowLine(id, qty)).filter((l): l is OrderLine => !!l)
    const id = await createOrder({ userId, key: `demo:${userId}:${o.key}`, address, card, lines, speed: o.speed ?? 'standard', fromCart: false, placedAt: o.placedAt, deliverBy: o.deliverBy })
    const order = id && o.then ? await getOrder(userId, id) : null
    if (order && o.then) await o.then(order)
  }
  return userId
}

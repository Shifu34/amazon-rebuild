// Price lock and price protection: the shopper's own price for a product.
// A lock holds today's price for 48 hours; a demo drop lowers it (the catalog is static, so a walkthrough needs a price
// that can actually move). Both are server-computed from the catalog — a price is never taken from the client.
// Every shopper-facing price goes through `priced()`, so the cart, checkout and the order all charge the same number.
import { cache } from 'react'
import { getProduct, type Product } from './catalog'
import { query } from './db'
import { toCents } from './format'

export const LOCK_HOURS = 48
const DROP_PCT = 0.1 // the demo control's cut
const DROP_DAYS = 30 // long enough that a walkthrough never watches one expire

export type ShopperPrice = { cents: number; locked: boolean; lockExpires: Date | null; dropCents: number | null }
export type ShopperPrices = Map<number, ShopperPrice>

type Row = { product_id: number; lock_cents: number | null; lock_expires: Date | null; drop_cents: number | null }

// The shopper's locks and drops in one read, cached per request. Signed out, nobody has either.
export const getShopperPrices = cache(async (userId?: string): Promise<ShopperPrices> => {
  if (!userId) return new Map()
  const rows = await query<Row>(
    `select coalesce(l.product_id, d.product_id) as product_id,
            case when l.expires_at > now() and l.used_at is null then l.price_cents end as lock_cents,
            case when l.expires_at > now() and l.used_at is null then l.expires_at end as lock_expires,
            case when d.expires_at > now() then d.price_cents end as drop_cents
     from price_locks l
     full join price_drops d on d.user_id = l.user_id and d.product_id = l.product_id
     where coalesce(l.user_id, d.user_id) = $1`,
    [userId],
  )
  const prices: ShopperPrices = new Map()
  for (const r of rows) {
    const catalog = getProduct(r.product_id)
    if (!catalog) continue
    // the lowest of what they can pay: the shelf price, the demo drop, or the price they locked
    const candidates = [toCents(catalog.price), r.drop_cents, r.lock_cents].filter((c): c is number => typeof c === 'number' && c > 0)
    const cents = Math.min(...candidates)
    prices.set(r.product_id, {
      cents,
      locked: r.lock_cents !== null && cents === r.lock_cents,
      lockExpires: r.lock_expires ? new Date(r.lock_expires) : null,
      dropCents: r.drop_cents,
    })
  }
  return prices
})

// A product as this shopper sees it. Prices stay in dollars on Product (the catalog's shape); money is cents everywhere else.
export const priced = <T extends Product>(p: T, prices: ShopperPrices): T => {
  const mine = prices.get(p.id)
  return mine && mine.cents !== toCents(p.price) ? { ...p, price: mine.cents / 100 } : p
}

export const pricedAll = <T extends Product>(list: T[], prices: ShopperPrices): T[] => list.map((p) => priced(p, prices))

// The lock the buy box shows: only while it is live and actually better than (or equal to) the shelf price.
export const activeLock = (productId: number, prices: ShopperPrices) => {
  const mine = prices.get(productId)
  return mine?.locked && mine.lockExpires ? { cents: mine.cents, expires: mine.lockExpires } : null
}

// Locks today's catalog price for LOCK_HOURS. Re-locking replaces the row, so a shopper can never stack locks.
export async function lockPrice(userId: string, productId: number) {
  const p = getProduct(productId)
  if (!p || p.stock <= 0) return null
  const [row] = await query<{ expires_at: Date }>(
    `insert into price_locks (user_id, product_id, price_cents, expires_at)
     values ($1, $2, $3, now() + ($4 || ' hours')::interval)
     on conflict (user_id, product_id) do update set price_cents = excluded.price_cents, expires_at = excluded.expires_at,
       created_at = now(), used_at = null
     returning expires_at`,
    [userId, productId, toCents(p.price), String(LOCK_HOURS)],
  )
  return row ? new Date(row.expires_at) : null
}

export async function releaseLock(userId: string, productId: number) {
  await query('delete from price_locks where user_id = $1 and product_id = $2', [userId, productId])
}

// Demo control: drop this shopper's price by DROP_PCT of whatever they'd pay now, so the drop compounds visibly.
export async function dropPrice(userId: string, productId: number) {
  const p = getProduct(productId)
  if (!p) return null
  // drops come off the shelf price lineage, never off a lock: otherwise every drop would undercut the lock it is tested against
  const prices = await getShopperPrices(userId)
  const from = prices.get(productId)?.dropCents ?? toCents(p.price)
  const cents = Math.max(1, Math.round(from * (1 - DROP_PCT)))
  await query(
    `insert into price_drops (user_id, product_id, price_cents, expires_at)
     values ($1, $2, $3, now() + ($4 || ' days')::interval)
     on conflict (user_id, product_id) do update set price_cents = excluded.price_cents, expires_at = excluded.expires_at, created_at = now()`,
    [userId, productId, cents, String(DROP_DAYS)],
  )
  return cents
}

// An order spends its locks: they are not a standing discount.
export async function spendLocks(userId: string, productIds: number[]) {
  if (!productIds.length) return
  await query('update price_locks set used_at = now() where user_id = $1 and product_id = any($2::int[]) and used_at is null', [userId, productIds])
}

// Price protection: what each line is owed if its price fell after the order was placed. Pure, so the check can run it.
export const protectionCents = (paidCents: number, quantity: number, nowCents: number) => (nowCents < paidCents ? (paidCents - nowCents) * quantity : 0)

// Group buy: a team price that unlocks when enough shoppers commit before the deadline. Nobody is charged for joining,
// and a member of a filled group pays the team price through the same `priced()` path as locks and drops (lib/price-lock).
// The one real countdown on a site with no fake urgency: it ends when the row says it ends.
import { cache } from 'react'
import { products, getProduct, type Product } from './catalog'
import { one, query } from './db'
import { toCents } from './format'

const CUT = 0.15 // off the shelf price when the group fills
const DAYS = 2 // how long a freshly seeded group stays open
const SEEDS = 6 // products carrying an open group

// ponytail: the dev server applies db/schema.sql only when it first connects, and production runs db:migrate by hand,
// so create this slice's tables once per process (the lib/reminders.ts precedent); drop it once every environment has run
// the current schema.
let ready: Promise<unknown> | undefined
const ensureSchema = () =>
  (ready ??= query(`create table if not exists group_buys (
      id uuid primary key default gen_random_uuid(),
      product_id int not null,
      price_cents int not null,
      target int not null,
      ends_at timestamptz not null,
      created_at timestamptz not null default now()
    )`)
    .then(() =>
      query(`create table if not exists group_buy_members (
        group_buy_id uuid not null references group_buys(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        joined_at timestamptz not null default now(),
        order_id text references orders(id) on delete set null,
        primary key (group_buy_id, user_id)
      )`),
    )
    .catch((e) => {
      ready = undefined
      throw e
    }))

// The slowest movers carry the groups: the whole point is shifting stock that isn't selling. Stable across deploys,
// because the catalog is static.
const seeded = new Set(
  [...products]
    .filter((p) => p.stock > 0)
    .sort((a, b) => b.stock - a.stock || a.id - b.id)
    .slice(0, SEEDS)
    .map((p) => p.id),
)

export const hasGroupBuy = (productId: number) => seeded.has(productId)

// Groups recur: each runs for DAYS, then that one closes and a fresh one opens, the way a real team deal works. The id is
// derived from the product and the current window, so seeding is an idempotent insert instead of a lookup-then-write race.
const WINDOW = DAYS * 86_400_000
const windowOf = (at = Date.now()) => Math.floor(at / WINDOW)
const groupId = (productId: number) => `00000000-0000-4000-8000-${String(windowOf() % 1000).padStart(3, '0')}${String(productId).padStart(9, '0')}`
const windowEnds = () => new Date((windowOf() + 1) * WINDOW)
const targetFor = (productId: number) => 3 + (productId % 3) // 3-5 committed buyers

export type GroupBuy = {
  id: string
  product: Product
  priceCents: number
  target: number
  joined: number
  endsAt: Date
  filled: boolean
  mine: boolean // this shopper has committed
  over: boolean // the deadline passed
}

// The open group for a product, seeded on first read. `userId` decides `mine`.
export const getGroupBuy = cache(async (productId: number, userId?: string): Promise<GroupBuy | null> => {
  const product = getProduct(productId)
  if (!product || !seeded.has(productId) || product.stock <= 0) return null
  await ensureSchema()
  await query(
    `insert into group_buys (id, product_id, price_cents, target, ends_at)
     values ($1, $2, $3, $4, $5::timestamptz) on conflict (id) do nothing`,
    [groupId(productId), productId, Math.max(1, Math.round(toCents(product.price) * (1 - CUT))), targetFor(productId), windowEnds().toISOString()],
  )
  const row = await one<{ id: string; price_cents: number; target: number; ends_at: Date; joined: string; mine: boolean }>(
    `select g.id, g.price_cents, g.target, g.ends_at,
            (select count(*) from group_buy_members m where m.group_buy_id = g.id) as joined,
            exists (select 1 from group_buy_members m where m.group_buy_id = g.id and m.user_id = $2::uuid) as mine
     from group_buys g where g.id = $1`,
    [groupId(productId), userId ?? null],
  )
  if (!row) return null
  const joined = Number(row.joined)
  return {
    id: row.id,
    product,
    priceCents: row.price_cents,
    target: row.target,
    joined,
    endsAt: new Date(row.ends_at),
    filled: joined >= row.target,
    mine: row.mine,
    over: new Date(row.ends_at).getTime() <= Date.now(),
  }
})

// Committing is free and idempotent: the primary key makes a second join a no-op.
export async function joinGroup(userId: string, productId: number) {
  await ensureSchema()
  await query(
    `insert into group_buy_members (group_buy_id, user_id)
     select g.id, $2 from group_buys g where g.id = $1 and g.ends_at > now()
     on conflict do nothing`,
    [groupId(productId), userId],
  )
}

// Leaving is only possible while the group is open and the shopper hasn't bought on it.
export async function leaveGroup(userId: string, productId: number) {
  await ensureSchema()
  await query(
    `delete from group_buy_members m using group_buys g
     where m.group_buy_id = g.id and g.id = $1 and m.user_id = $2 and m.order_id is null and g.ends_at > now()`,
    [groupId(productId), userId],
  )
}

// Demo control: there is no crowd in a demo store, so borrow accounts that already exist to fill the remaining places.
// The count stays literal — every place is a real members row — and it returns how many it could actually add.
export async function fillGroup(productId: number) {
  await ensureSchema()
  const rows = await query<{ added: number }>(
    `with g as (select id, target from group_buys where id = $1 and ends_at > now()),
     short as (select g.id, g.target - (select count(*) from group_buy_members m where m.group_buy_id = g.id) as places from g),
     picked as (
       select short.id, u.id as user_id from short
       join lateral (
         select u.id from users u
         where not exists (select 1 from group_buy_members m where m.group_buy_id = short.id and m.user_id = u.id)
         order by u.created_at limit greatest(short.places, 0)
       ) u on true
     )
     insert into group_buy_members (group_buy_id, user_id) select id, user_id from picked
     on conflict do nothing returning 1 as added`,
    [groupId(productId)],
  )
  return rows.length
}

// The team price a shopper is entitled to: committed, filled, still open. Feeds lib/price-lock's getShopperPrices.
export async function groupPrices(userId: string) {
  await ensureSchema()
  return query<{ product_id: number; price_cents: number }>(
    `select g.product_id, g.price_cents
     from group_buy_members m join group_buys g on g.id = m.group_buy_id
     where m.user_id = $1 and g.ends_at > now()
       and (select count(*) from group_buy_members x where x.group_buy_id = g.id) >= g.target`,
    [userId],
  )
}

// An order records which groups it bought on, so a member who has paid can't leave the group afterwards.
export async function recordGroupOrder(userId: string, productIds: number[], orderId: string) {
  if (!productIds.length) return
  await ensureSchema()
  await query(
    `update group_buy_members set order_id = $3
     where user_id = $1 and order_id is null and group_buy_id in (select id from group_buys where product_id = any($2::int[]))`,
    [userId, productIds, orderId],
  )
}

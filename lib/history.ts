// Browsing history for signed-in shoppers. One row per product, so it can never outgrow the catalog.
// Shoppers can pause it (users.history_paused); while paused, views aren't recorded.
import { getProduct, type Product } from './catalog'
import { one, query } from './db'

// ponytail: the dev server applies db/schema.sql only when it first connects, so re-apply this slice's
// column once per process; drop it once every environment has run the current schema.
let ready: Promise<unknown> | undefined
const ensureSchema = () => (ready ??= query('alter table users add column if not exists history_paused boolean not null default false'))

export async function recordView(userId: string, productId: number) {
  await ensureSchema()
  await query(
    `insert into browsing_history (user_id, product_id)
     select $1::uuid, $2::int where not exists (select 1 from users where id = $1::uuid and history_paused)
     on conflict (user_id, product_id) do update set viewed_at = now()`,
    [userId, productId],
  )
}

export async function getHistory(userId: string, limit = 50): Promise<{ product: Product; viewedAt: Date }[]> {
  const rows = await query<{ product_id: number; viewed_at: Date }>(
    'select product_id, viewed_at from browsing_history where user_id = $1 order by viewed_at desc limit $2',
    [userId, limit],
  )
  return rows.flatMap((r) => {
    const product = getProduct(r.product_id)
    return product ? [{ product, viewedAt: new Date(r.viewed_at) }] : []
  })
}

export async function historyPaused(userId: string) {
  await ensureSchema()
  return !!(await one('select 1 from users where id = $1 and history_paused', [userId]))
}

export async function setHistoryPaused(userId: string, paused: boolean) {
  await ensureSchema()
  await query('update users set history_paused = $2 where id = $1', [userId, paused])
}

export async function removeFromHistory(userId: string, productId: number) {
  await query('delete from browsing_history where user_id = $1 and product_id = $2', [userId, productId])
}

export async function clearHistory(userId: string) {
  await query('delete from browsing_history where user_id = $1', [userId])
}

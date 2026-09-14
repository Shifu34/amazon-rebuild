// Browsing history for signed-in shoppers. One row per product, so it can never outgrow the catalog.
import { getProduct, type Product } from './catalog'
import { query } from './db'

export async function recordView(userId: string, productId: number) {
  await query(
    'insert into browsing_history (user_id, product_id) values ($1, $2) on conflict (user_id, product_id) do update set viewed_at = now()',
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

export async function removeFromHistory(userId: string, productId: number) {
  await query('delete from browsing_history where user_id = $1 and product_id = $2', [userId, productId])
}

export async function clearHistory(userId: string) {
  await query('delete from browsing_history where user_id = $1', [userId])
}

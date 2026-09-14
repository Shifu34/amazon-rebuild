import { cache } from 'react'
import { cartOwner } from './auth'
import { getProduct, type Product } from './catalog'
import { query } from './db'

export type CartLine = { product: Product; quantity: number; savedForLater: boolean; addedAt: Date }

export const MAX_QTY = 30

export const getCart = cache(async (): Promise<CartLine[]> => {
  const owner = await cartOwner()
  if (!owner) return []
  const rows = await query<{ product_id: number; quantity: number; saved_for_later: boolean; added_at: Date }>(
    'select product_id, quantity, saved_for_later, added_at from cart_items where owner = $1 order by added_at desc',
    [owner],
  )
  return rows.flatMap((r) => {
    const product = getProduct(r.product_id)
    return product ? [{ product, quantity: r.quantity, savedForLater: r.saved_for_later, addedAt: new Date(r.added_at) }] : []
  })
})

export async function cartCount() {
  return (await getCart()).filter((l) => !l.savedForLater).reduce((n, l) => n + l.quantity, 0)
}

// subtotal in cents over lines that will be checked out (not saved for later, in stock)
export async function cartSummary() {
  const active = (await getCart()).filter((l) => !l.savedForLater && l.product.stock > 0)
  return {
    lines: active,
    count: active.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: active.reduce((sum, l) => sum + Math.round(l.product.price * 100) * l.quantity, 0),
  }
}

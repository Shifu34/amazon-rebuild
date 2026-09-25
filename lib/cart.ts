import { cache } from 'react'
import { cartOwner, getUser } from './auth'
import { getProduct, type Product } from './catalog'
import { query } from './db'
import { getShopperPrices, priced } from './price-lock'

export type CartLine = { product: Product; quantity: number; savedForLater: boolean; addedAt: Date }

export const MAX_QTY = 30

export const getCart = cache(async (): Promise<CartLine[]> => {
  const [owner, user] = await Promise.all([cartOwner(), getUser()])
  if (!owner) return []
  const [rows, prices] = await Promise.all([
    query<{ product_id: number; quantity: number; saved_for_later: boolean; added_at: Date }>(
      'select product_id, quantity, saved_for_later, added_at from cart_items where owner = $1 order by added_at desc',
      [owner],
    ),
    getShopperPrices(user?.id), // a locked or dropped price follows the product into the cart and on to checkout
  ])
  return rows.flatMap((r) => {
    const product = getProduct(r.product_id)
    return product ? [{ product: priced(product, prices), quantity: r.quantity, savedForLater: r.saved_for_later, addedAt: new Date(r.added_at) }] : []
  })
})

// productId → quantity in the cart (not saved for later), so "✓ 2 in cart" buttons survive Back and reloads
export async function cartQuantities() {
  return new Map((await getCart()).filter((l) => !l.savedForLater).map((l): [number, number] => [l.product.id, l.quantity]))
}

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

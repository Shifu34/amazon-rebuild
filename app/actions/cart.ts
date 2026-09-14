'use server'

import { refresh } from 'next/cache'
import { cartOwner } from '@/lib/auth'
import { MAX_QTY } from '@/lib/cart'
import { getProduct } from '@/lib/catalog'
import { one, query } from '@/lib/db'

export type AddToCartState = { ok: true; inCart: number } | { ok: false; error: string } | null

const product = (form: FormData) => getProduct(Number(form.get('productId')))
const qtyFrom = (form: FormData, max: number) => Math.max(1, Math.min(max, Math.floor(Number(form.get('quantity') ?? 1)) || 1))

export async function addToCart(_prev: AddToCartState, form: FormData): Promise<AddToCartState> {
  const p = product(form)
  if (!p) return { ok: false, error: 'This item is no longer available.' }
  if (p.stock <= 0) return { ok: false, error: 'This item is currently unavailable.' }
  const max = Math.min(MAX_QTY, p.stock)
  const owner = await cartOwner(true)
  const row = await one<{ quantity: number }>(
    `insert into cart_items (owner, product_id, quantity) values ($1, $2, $3)
     on conflict (owner, product_id) do update
       set quantity = least($4, case when cart_items.saved_for_later then 0 else cart_items.quantity end + excluded.quantity),
           saved_for_later = false, added_at = now()
     returning quantity`,
    [owner, p.id, qtyFrom(form, max), max],
  )
  refresh()
  return { ok: true, inCart: row?.quantity ?? 1 }
}

// quantity 0 removes the line, like Amazon's "0 (Delete)" option
export async function updateQuantity(form: FormData) {
  const p = product(form)
  const owner = await cartOwner()
  if (!p || !owner) return
  const quantity = Math.floor(Number(form.get('quantity')))
  if (!(quantity > 0)) await query('delete from cart_items where owner = $1 and product_id = $2', [owner, p.id])
  else await query('update cart_items set quantity = $3 where owner = $1 and product_id = $2', [owner, p.id, Math.min(quantity, MAX_QTY, Math.max(p.stock, 1))])
  refresh()
}

export async function removeFromCart(form: FormData) {
  const p = product(form)
  const owner = await cartOwner()
  if (!p || !owner) return
  await query('delete from cart_items where owner = $1 and product_id = $2', [owner, p.id])
  refresh()
}

export async function setSavedForLater(form: FormData) {
  const p = product(form)
  const owner = await cartOwner()
  if (!p || !owner) return
  await query('update cart_items set saved_for_later = $3 where owner = $1 and product_id = $2', [owner, p.id, form.get('saved') === 'true'])
  refresh()
}

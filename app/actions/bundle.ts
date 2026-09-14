'use server'

import { getProduct } from '@/lib/catalog'
import { addToCart } from './cart'

export type BundleState = { ok: true; ids: number[] } | { ok: false; error: string } | null

// "Add all 3 to Cart": each checked item goes through addToCart (qty 1), so cart merge and stock rules stay in one place.
export async function addBundle(_prev: BundleState, form: FormData): Promise<BundleState> {
  const ids = [...new Set(form.getAll('productId').map(Number))].filter((id) => getProduct(id)).slice(0, 5)
  if (!ids.length) return { ok: false, error: 'Select at least one item to add.' }
  const added: number[] = []
  for (const id of ids) {
    const item = new FormData()
    item.set('productId', String(id))
    if ((await addToCart(null, item))?.ok) added.push(id)
  }
  return added.length ? { ok: true, ids: added } : { ok: false, error: 'There was a problem adding these items to Cart. Please try again.' }
}

'use server'

import { getProduct, related } from '@/lib/catalog'

export type QuickLookItem = {
  id: number
  title: string
  brand: string | null
  image: string
  rating: number
  ratingCount: number
  price: number // US dollars; the dialog converts to the display currency
  alsoBought: { id: number; title: string; thumbnail: string }[]
}

// Read-only: what the Quick look dialog on product carousels needs. The id comes from the client, so anything that isn't
// a catalog product's integer id gets null.
export async function quickLook(id: number): Promise<QuickLookItem | null> {
  const p = Number.isSafeInteger(id) ? getProduct(id) : undefined
  if (!p) return null
  return {
    id: p.id,
    title: p.title,
    brand: p.brand,
    image: p.images[0] ?? p.thumbnail,
    rating: p.rating,
    ratingCount: p.ratingCount,
    price: p.price,
    alsoBought: related(p, 8).map(({ id, title, thumbnail }) => ({ id, title, thumbnail })),
  }
}

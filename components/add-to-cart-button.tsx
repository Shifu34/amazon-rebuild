'use client'

import { useActionState } from 'react'
import { addToCart, type AddToCartState } from '@/app/actions/cart'

// Compact add-to-cart for product cards and carousels; the header count refreshes from the action.
// `inCart` is the server cart's quantity, so "✓ 2 in cart" survives Back and reloads (the action's refresh() updates it).
// Without it the label only reflects adds made on this page.
export function AddToCartButton({ productId, inCart, className = '' }: { productId: number; inCart?: number; className?: string }) {
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCart, null)
  const count = inCart ?? (state?.ok ? state.inCart : 0)
  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <button type="submit" disabled={pending} className={`btn btn-cart ${className}`}>
        {pending ? 'Adding…' : count ? `✓ ${count} in cart` : 'Add to cart'}
      </button>
      {state && !state.ok && <p role="alert" className="field-error">{state.error}</p>}
    </form>
  )
}

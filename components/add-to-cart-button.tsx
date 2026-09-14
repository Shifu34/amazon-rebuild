'use client'

import { useActionState } from 'react'
import { addToCart, type AddToCartState } from '@/app/actions/cart'

// Compact add-to-cart for product cards and carousels; the header count refreshes from the action.
export function AddToCartButton({ productId, className = '' }: { productId: number; className?: string }) {
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCart, null)
  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <button type="submit" disabled={pending} className={`btn btn-cart ${className}`}>
        {pending ? 'Adding…' : state?.ok ? `✓ ${state.inCart} in cart` : 'Add to cart'}
      </button>
      {state && !state.ok && <p role="alert" className="field-error">{state.error}</p>}
    </form>
  )
}

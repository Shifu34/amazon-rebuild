'use client'

import { useActionState } from 'react'
import { addToCart, type AddToCartState } from '@/app/actions/cart'

// "Buy it again" on an order item: adds one to the cart in place; the header count refreshes from the action.
export function BuyAgainButton({ productId, title }: { productId: number; title: string }) {
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCart, null)
  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <button type="submit" disabled={pending} className="btn btn-cart min-h-[29px] px-3 text-xs">
        {pending ? 'Adding…' : state?.ok ? '✓ In cart' : 'Buy it again'}
        <span className="sr-only">: {title}</span>
      </button>
      <span role="status" className="sr-only">{state?.ok ? `Added to cart. ${state.inCart} in cart.` : ''}</span>
      {state && !state.ok && <p role="alert" className="field-error">{state.error}</p>}
    </form>
  )
}

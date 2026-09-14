'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { addToCart, type AddToCartState } from '@/app/actions/cart'
import { CaretIcon } from '@/components/icons'
import { AddedSheet, type CartTotals } from './added-sheet'

type Props = { product: { id: number; title: string; thumbnail: string }; max: number; signedIn: boolean; inCart: number; cart: CartTotals }

// Quantity, Add to Cart (opens the side sheet) and Buy Now for an in-stock product.
export function PurchaseControls({ product, max, signedIn, inCart, cart }: Props) {
  const [qty, setQty] = useState(1)
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCart, null)
  const [dismissed, setDismissed] = useState<AddToCartState>(null)

  const checkout = `/checkout?buy=${product.id}&qty=${qty}`
  const buyNow = signedIn ? checkout : `/ap/signin?return_to=${encodeURIComponent(checkout)}`

  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="productId" value={product.id} />
      <div className="select-pill relative inline-flex items-center gap-1 pr-2 has-[:focus-visible]:border-focus has-[:focus-visible]:shadow-[0_0_0_3px_#c8f3fa]">
        <span aria-hidden>Quantity:</span>
        <select
          name="quantity"
          aria-label="Quantity"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="cursor-pointer appearance-none bg-transparent pr-3 outline-none"
        >
          {Array.from({ length: max }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <CaretIcon className="pointer-events-none absolute right-2 h-1.5 w-2 text-muted" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-cart btn-lg w-full">
        {pending ? 'Adding…' : 'Add to Cart'}
      </button>
      <Link href={buyNow} className="btn btn-buy btn-lg w-full">Buy Now</Link>
      {state && !state.ok && <p role="alert" className="field-error">{state.error}</p>}
      {inCart > 0 && (
        <p className="text-[13px] text-success">
          {inCart} in your <Link href="/cart" className="link">cart</Link>
        </p>
      )}
      <AddedSheet open={!!state?.ok && dismissed !== state} onClose={() => setDismissed(state)} items={[product]} cart={cart} />
    </form>
  )
}

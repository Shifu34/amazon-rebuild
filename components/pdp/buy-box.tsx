'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'
import { addToCart } from '@/app/actions/cart'
import { CaretIcon } from '@/components/icons'
import { AddedSheet, type CartTotals } from './added-sheet'

type Item = { id: number; title: string; thumbnail: string; price: number }
type Props = { product: Item; max: number; stock: number; signedIn: boolean; inCart: number; cart: CartTotals; picks: Item[] }
type State = { ok: true; added: number; requested: number } | { ok: false; error: string } | null

// Quantity, Add to Cart (opens the side sheet) and Buy Now for an in-stock product.
// Once the cart holds the most that can be bought, Add to Cart gives way to Go to Cart instead of a silent no-op.
export function PurchaseControls({ product, max, stock, signedIn, inCart, cart, picks }: Props) {
  const [qty, setQty] = useState(1)
  const addButton = useRef<HTMLButtonElement>(null)
  const cartLink = useRef<HTMLAnchorElement>(null)
  const [dismissed, setDismissed] = useState<State>(null)
  const limit = max === stock ? `only ${max} available` : `limit ${max} per customer`
  // addToCart reports how many actually went in (clamped to the cap), measured in SQL, not from this page's last render
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, form) => {
    const result = await addToCart(null, form)
    return result?.ok ? { ok: true, added: result.added, requested: Number(form.get('quantity')) } : result
  }, null)

  const room = max - inCart
  const quantity = Math.max(1, Math.min(qty, room))
  const checkout = `/checkout?buy=${product.id}&qty=${quantity}`
  const buyNow = signedIn ? checkout : `/ap/signin?return_to=${encodeURIComponent(checkout)}`
  const close = () => {
    setDismissed(state)
    ;(addButton.current ?? cartLink.current)?.focus()
  }

  return (
    <>
      <form action={action} className="space-y-2.5">
        <input type="hidden" name="productId" value={product.id} />
        {room > 0 ? (
          <>
            <div className="select-pill relative inline-flex items-center gap-1 pr-2 has-[:focus-visible]:border-focus has-[:focus-visible]:shadow-[0_0_0_3px_#c8f3fa]">
              <span aria-hidden>Quantity:</span>
              <select
                name="quantity"
                aria-label="Quantity"
                value={quantity}
                onChange={(e) => setQty(Number(e.target.value))}
                className="cursor-pointer appearance-none bg-transparent pr-3 outline-none"
              >
                {Array.from({ length: room }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <CaretIcon className="pointer-events-none absolute right-2 h-1.5 w-2 text-muted" />
            </div>
            <button ref={addButton} type="submit" disabled={pending} className="btn btn-cart btn-lg w-full">
              {pending ? 'Adding…' : 'Add to Cart'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm">
              <b className="text-success">{inCart} in your cart</b> <span className="text-muted">({limit})</span>
            </p>
            <Link ref={cartLink} href="/cart" className="btn btn-cart btn-lg w-full">Go to Cart</Link>
          </>
        )}
        <Link href={buyNow} className="btn btn-buy btn-lg w-full">Buy Now</Link>
        {state && !state.ok && <p role="alert" className="field-error">{state.error}</p>}
        {inCart > 0 && room > 0 && (
          <p className="text-[13px] text-success">
            {inCart} in your <Link href="/cart" className="link underline">cart</Link>
          </p>
        )}
      </form>
      <AddedSheet
        open={!!state?.ok && dismissed !== state}
        onClose={close}
        items={[{ ...product, quantity: state?.ok ? state.added : 1 }]}
        note={state?.ok && state.added < state.requested ? `Only ${state.added} added: that's the most you can buy (${limit}).` : undefined}
        cart={cart}
        picks={picks}
      />
    </>
  )
}

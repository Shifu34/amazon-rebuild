'use client'

import Link from 'next/link'
import { useEffect, useId, useRef } from 'react'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { CloseIcon } from '@/components/icons'
import { Price } from '@/components/price'
import { FREE_SHIPPING_MIN } from '@/lib/delivery'
import { plural, toCents, usdCents } from '@/lib/format'

export type CartTotals = { count: number; subtotalCents: number }
type Item = { id: number; title: string; thumbnail: string; quantity?: number }
type Pick = { id: number; title: string; thumbnail: string; price: number }

export function CheckCircle({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// "Added to cart" side sheet. A native modal <dialog> brings focus trapping, Esc and the backdrop.
// `cart` comes from the server render, which the add action refreshes in the same response.
export function AddedSheet({ open, onClose, items, cart, note, picks = [] }: { open: boolean; onClose: () => void; items: Item[]; cart: CartTotals; note?: string; picks?: Pick[] }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (open && d && !d.open) d.showModal()
    if (!open && d?.open) d.close()
  }, [open])

  const count = plural(cart.count, 'item')
  const toFree = toCents(FREE_SHIPPING_MIN) - cart.subtotalCents
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-0 ms-auto h-dvh max-h-none w-[min(380px,100vw)] max-w-none bg-white p-0 text-ink shadow-[-4px_0_12px_rgba(0,0,0,0.25)] transition-transform duration-200 backdrop:bg-black/50 motion-reduce:transition-none starting:open:translate-x-full"
    >
      <div className="flex items-center justify-between border-b border-line py-2 pr-2 pl-4">
        <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold text-success">
          <CheckCircle /> Added to cart
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-page">
          <CloseIcon className="size-5" />
        </button>
      </div>
      <div className="p-4">
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 text-sm">
              <span className="flex size-15 shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2">{item.title}</span>
                {item.quantity !== undefined && <span className="text-muted">Qty: {item.quantity}</span>}
              </span>
            </li>
          ))}
        </ul>
        {note && <p className="mt-3 text-[13px] text-[#c10015]">{note}</p>}

        <div className="mt-4 text-[13px]">
          {toFree > 0 ? (
            <>
              <progress
                value={cart.subtotalCents}
                max={toCents(FREE_SHIPPING_MIN)}
                aria-label="Progress toward FREE Shipping"
                className="mb-1.5 block h-2 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-success [&::-webkit-progress-bar]:bg-[#e3e6e6] [&::-webkit-progress-value]:bg-success"
              />
              Add <b className="text-danger">{usdCents(toFree)}</b> of eligible items to your order to qualify for FREE Shipping.
            </>
          ) : (
            <p>
              <span className="text-success">Your order qualifies for FREE Shipping.</span> Choose this option at checkout.
            </p>
          )}
        </div>
        <p className="mt-3 text-lg">
          Cart subtotal <span className="text-sm text-muted">({count})</span>: <b>{usdCents(cart.subtotalCents)}</b>
        </p>
        <Link href="/checkout" className="btn btn-cart btn-lg mt-3 w-full">Proceed to checkout ({count})</Link>
        <Link href="/cart" className="btn btn-plain btn-lg mt-2 w-full">Go to Cart</Link>

        {picks.length > 0 && (
          <section aria-labelledby={`${titleId}-picks`} className="mt-6 border-t border-line pt-4">
            <h3 id={`${titleId}-picks`} className="text-base font-bold">Frequently bought with this item</h3>
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {picks.map((p) => (
                <li key={p.id} className="flex flex-col text-sm">
                  <Link href={`/dp/${p.id}`} tabIndex={-1} aria-hidden className="flex h-28 items-center justify-center rounded-sm bg-[#f7f7f7] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  </Link>
                  <Link href={`/dp/${p.id}`} className="mt-1.5 line-clamp-2 hover:text-link-hover hover:underline">{p.title}</Link>
                  <span className="text-lg leading-6"><Price value={p.price} /></span>
                  <div className="mt-auto pt-2">
                    <AddToCartButton productId={p.id} className="w-full" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </dialog>
  )
}

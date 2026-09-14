'use client'

import Link from 'next/link'
import { useEffect, useId, useRef } from 'react'
import { CloseIcon } from '@/components/icons'
import { plural, usdCents } from '@/lib/format'

export type CartTotals = { count: number; subtotalCents: number }
type Item = { id: number; title: string; thumbnail: string }

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
export function AddedSheet({ open, onClose, items, cart }: { open: boolean; onClose: () => void; items: Item[]; cart: CartTotals }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (open && d && !d.open) d.showModal()
    if (!open && d?.open) d.close()
  }, [open])

  const count = plural(cart.count, 'item')
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-0 ms-auto h-dvh max-h-none w-[min(380px,100vw)] max-w-none bg-white p-0 text-ink shadow-[-4px_0_12px_rgba(0,0,0,0.25)] transition-transform duration-200 backdrop:bg-black/50 motion-reduce:transition-none starting:open:translate-x-full"
    >
      <div className="flex items-center justify-between border-b border-line py-2 pr-2 pl-4">
        <h2 id={titleId} className="flex items-center gap-2 text-lg text-success">
          <CheckCircle /> Added to cart
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-page">
          <CloseIcon className="size-5" />
        </button>
      </div>
      <div className="p-4">
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex size-20 items-center justify-center rounded-sm bg-[#f7f7f7] p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnail} alt={item.title} className="max-h-full max-w-full object-contain mix-blend-multiply" />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-lg">
          Cart subtotal <span className="text-sm text-muted">({count})</span>: <b>{usdCents(cart.subtotalCents)}</b>
        </p>
        <Link href="/checkout" className="btn btn-cart btn-lg mt-3 w-full">Proceed to checkout ({count})</Link>
        <Link href="/cart" className="btn btn-plain btn-lg mt-2 w-full">Go to Cart</Link>
      </div>
    </dialog>
  )
}

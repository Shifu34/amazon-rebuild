'use client'

import { createContext, useCallback, useContext, useEffect, useOptimistic, useState, useTransition } from 'react'
import { addToCart, removeFromCart, setSavedForLater, updateQuantity } from '@/app/actions/cart'
import { TrashIcon } from '@/components/checkout/icons'
import { CloseIcon } from '@/components/icons'

type Toast = { key: number; text: string; undo?: () => Promise<unknown> }
const Notify = createContext<(t: Omit<Toast, 'key'>) => void>(() => {})

const form = (fields: Record<string, string | number>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, String(v))
  return f
}

// Wraps the cart page: removals and moves announce themselves in a toast with Undo (Amazon has no undo).
export function CartFeedback({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const [undoing, start] = useTransition()
  const notify = useCallback((t: Omit<Toast, 'key'>) => setToast({ ...t, key: Date.now() }), [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 8000)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <Notify value={notify}>
      {children}
      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {toast && (
          <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-lg bg-nav-light py-2.5 pr-2 pl-4 text-sm text-white shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
            <span className="line-clamp-2">{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                disabled={undoing}
                onClick={() => start(async () => { await toast.undo?.(); setToast(null) })}
                className="shrink-0 cursor-pointer rounded px-2 py-1 font-bold text-[#7fd4e0] hover:underline focus-visible:ring-2 focus-visible:ring-[#7fd4e0]"
              >
                {undoing ? 'Undoing…' : 'Undo'}
              </button>
            )}
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="shrink-0 cursor-pointer rounded p-1 focus-visible:ring-2 focus-visible:ring-[#7fd4e0]">
              <CloseIcon className="size-4" />
            </button>
          </div>
        )}
      </div>
    </Notify>
  )
}

function useCartAction() {
  const notify = useContext(Notify)
  const [pending, start] = useTransition()
  const run = (action: () => Promise<unknown>, done?: Omit<Toast, 'key'>) =>
    start(async () => {
      try {
        await action()
        if (done) notify(done)
      } catch {
        notify({ text: 'There was a problem updating your cart. Please try again.' })
      }
    })
  return { pending, run, notify }
}

const bar = <span aria-hidden className="h-3.5 w-px bg-line" />

// Stepper (trash at 1) + Delete | Save for later | Share. `max` 0 means the item can't be bought right now.
export function LineControls({ productId, title, quantity, max, maxNote }: { productId: number; title: string; quantity: number; max: number; maxNote: string }) {
  const { pending, run, notify } = useCartAction()
  const [qty, setQty] = useOptimistic(quantity)

  const remove = () =>
    run(() => removeFromCart(form({ productId })), {
      text: `${title} was removed from Shopping Cart.`,
      undo: max > 0 ? () => addToCart(null, form({ productId, quantity })) : undefined,
    })
  const change = (n: number) =>
    run(async () => {
      setQty(n)
      await updateQuantity(form({ productId, quantity: n }))
    })
  const share = async () => {
    const url = `${location.origin}/dp/${productId}`
    if (navigator.share) return navigator.share({ title, url }).catch(() => {})
    await navigator.clipboard.writeText(url)
    notify({ text: 'Link copied to clipboard.' })
  }

  return (
    <div data-pending={pending || undefined} className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
      {max > 0 && (
        <div className="inline-flex h-9 items-center rounded-full border-[3px] border-cart bg-white">
          <button
            type="button"
            onClick={() => (qty <= 1 ? remove() : change(qty - 1))}
            aria-label={qty <= 1 ? `Delete ${title}` : `Decrease quantity of ${title}`}
            className="flex h-full w-9 cursor-pointer items-center justify-center rounded-l-full hover:bg-[#f7fafa] focus-visible:ring-2 focus-visible:ring-focus"
          >
            {qty <= 1 ? <TrashIcon className="size-4" /> : <span aria-hidden className="text-lg leading-none">−</span>}
          </button>
          <span aria-live="polite" className="min-w-7 text-center text-sm font-bold">
            <span className="sr-only">Quantity </span>{qty}
          </span>
          <button
            type="button"
            onClick={() => change(qty + 1)}
            disabled={qty >= max}
            aria-label={`Increase quantity of ${title}`}
            className="flex h-full w-9 cursor-pointer items-center justify-center rounded-r-full text-lg leading-none hover:bg-[#f7fafa] focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}
      {max > 0 && qty >= max && <span className="text-xs text-muted">{maxNote}</span>}
      <button type="button" onClick={remove} className="link cursor-pointer">Delete</button>
      {bar}
      <button
        type="button"
        onClick={() => run(() => setSavedForLater(form({ productId, saved: 'true' })), { text: `${title} has been moved to Saved For Later.`, undo: () => setSavedForLater(form({ productId, saved: 'false' })) })}
        className="link cursor-pointer"
      >
        Save for later
      </button>
      {bar}
      <button type="button" onClick={share} className="link cursor-pointer">Share</button>
    </div>
  )
}

export function SavedControls({ productId, title, quantity, available }: { productId: number; title: string; quantity: number; available: boolean }) {
  const { pending, run } = useCartAction()
  return (
    <div data-pending={pending || undefined} className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
      {available && (
        <button
          type="button"
          onClick={() => run(() => setSavedForLater(form({ productId, saved: 'false' })), { text: `${title} has been moved to Cart.`, undo: () => setSavedForLater(form({ productId, saved: 'true' })) })}
          className="btn btn-plain"
        >
          Move to cart
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          run(() => removeFromCart(form({ productId })), {
            text: `${title} was removed from Saved for later.`,
            undo: available
              ? async () => {
                  await addToCart(null, form({ productId, quantity }))
                  await setSavedForLater(form({ productId, saved: 'true' }))
                }
              : undefined,
          })
        }
        aria-label={`Delete ${title} from Saved for later`}
        className="link cursor-pointer"
      >
        Delete
      </button>
    </div>
  )
}

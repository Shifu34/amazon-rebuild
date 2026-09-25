'use client'

import { useEffect, useState } from 'react'
import { demoDrop, lock, unlock } from '@/app/actions/price-lock'

type Props = {
  productId: number
  priceText: string // the price as the shopper sees it, already in their currency
  locked: { text: string; expiresAt: string } | null // expiresAt is an ISO string: the server date crosses as text
}

// Counts down to the lock's expiry. Minutes are enough — a 48 hour promise doesn't need a ticking second hand.
function useLeft(expiresAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!expiresAt) return
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [expiresAt])
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return 'expired'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return hours ? `${hours}h ${minutes}m left` : `${minutes}m left`
}

// "Lock this price for 48 hours": the shopper's answer to "should I wait?". Amazon dropped price protection years ago;
// we hold the price and refund the difference if it falls before delivery.
export function PriceLock({ productId, priceText, locked }: Props) {
  const left = useLeft(locked?.expiresAt)

  return (
    <div className="mt-3 border-t border-line pt-3 text-sm">
      {locked ? (
        <>
          <p className="font-bold text-success">Price locked at {locked.text}</p>
          <p className="text-xs text-muted">
            We&apos;ll charge this at checkout{left && left !== 'expired' ? ` · ${left}` : ''}.
          </p>
          <form action={unlock}>
            <input type="hidden" name="productId" value={productId} />
            <button type="submit" className="link mt-1 cursor-pointer text-xs">Release this lock</button>
          </form>
        </>
      ) : (
        <form action={lock}>
          <input type="hidden" name="productId" value={productId} />
          <button type="submit" className="btn btn-plain w-full">Lock this price for 48 hours</button>
          <p className="mt-1.5 text-xs text-muted">
            Hold {priceText} while you decide. We refund the difference automatically if the price drops before delivery.
          </p>
        </form>
      )}
      <form action={demoDrop} className="mt-2">
        <input type="hidden" name="productId" value={productId} />
        <button type="submit" className="link cursor-pointer text-xs">Demo: drop this price 10%</button>
      </form>
    </div>
  )
}

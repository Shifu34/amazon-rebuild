'use client'

import { useEffect, useState } from 'react'
import { demoFill, join, leave } from '@/app/actions/group-buy'

type Props = {
  productId: number
  groupId: string
  teamPrice: string // the team price in the shopper's currency
  joined: number
  target: number
  endsAt: string // ISO: the server date crosses as text
  mine: boolean
  filled: boolean
}

// Counts down to the deadline. This is the only timer on the site, and it is real: the group closes when it runs out.
function useLeft(endsAt: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const ms = new Date(endsAt).getTime() - now
  if (ms <= 0) return null
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`
  return hours ? `${hours}h ${minutes}m left` : `${minutes}m left`
}

function ShareLink({ productId, groupId }: { productId: number; groupId: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/dp/${productId}?g=${groupId}`
  const url = typeof window === 'undefined' ? path : `${window.location.origin}${path}`

  return (
    <div className="mt-2 flex gap-2">
      <input readOnly value={url} aria-label="Link to share this group buy" className="input h-8 flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => setCopied(true),
            () => {}, // a browser that refuses the clipboard still has the selectable field
          )
        }}
        className="btn btn-plain h-8 shrink-0 text-xs"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

// A team price that unlocks when enough shoppers commit. Nobody is charged for joining, and nothing ships unless it fills.
export function GroupBuy({ productId, groupId, teamPrice, joined, target, endsAt, mine, filled }: Props) {
  const left = useLeft(endsAt)
  const places = Math.max(0, target - joined)

  return (
    <section aria-label="Group buy" className="mt-3 rounded-lg border border-brand bg-[#fff8e6] p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">
          {filled ? `Group price unlocked: ${teamPrice}` : `Group price ${teamPrice}`}
        </h2>
        {left && <span className="shrink-0 text-xs text-muted">{left}</span>}
      </div>

      {/* people keep joining after it fills, so "7 of 5 joined" would read like a mistake */}
      <p className="mt-1 text-xs">
        <b>{filled ? `${joined} joined` : `${joined} of ${target} joined`}</b>
        {filled ? ` · unlocked at ${target}` : left ? ` · ${places} more to unlock` : ''}
      </p>
      {/* a plain bar: the count above is the number that matters */}
      <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round((joined / target) * 100))}%` }} />
      </span>

      {!left ? (
        <p className="mt-2 text-xs text-muted">This group closed. Nobody was charged.</p>
      ) : mine ? (
        <>
          <p className="mt-2 text-xs">
            {filled ? "You're in and it filled — this price is yours at checkout." : "You're in. Share it to fill it faster."}
          </p>
          <ShareLink productId={productId} groupId={groupId} />
          {!filled && (
            <form action={leave}>
              <input type="hidden" name="productId" value={productId} />
              <button type="submit" className="link mt-1.5 cursor-pointer text-xs">Leave this group</button>
            </form>
          )}
        </>
      ) : (
        <form action={join} className="mt-2">
          <input type="hidden" name="productId" value={productId} />
          <button type="submit" className="btn btn-cart w-full">Join this group buy</button>
          <p className="mt-1.5 text-xs text-muted">
            You pay the group price only if it fills before the deadline. If it doesn&apos;t, nothing is charged and nothing ships.
          </p>
        </form>
      )}

      {!filled && left && (
        <form action={demoFill} className="mt-2">
          <input type="hidden" name="productId" value={productId} />
          <button type="submit" className="link cursor-pointer text-xs">Demo: fill this group</button>
        </form>
      )}
    </section>
  )
}

'use client'

import { useState, useSyncExternalStore } from 'react'
import { setDataSaver } from '@/app/actions/data-saver'

const DISMISSED = 'nile:data-saver-prompt'
// Chrome's Save-Data preference, or a connection the browser itself calls 2g
type Conn = { saveData?: boolean; effectiveType?: string }

// neither the connection nor a past dismissal changes without a reload, so there is nothing to subscribe to
const subscribeToNothing = () => () => {}
const shouldOffer = () => {
  try {
    if (localStorage.getItem(DISMISSED)) return false
  } catch {} // private mode: offer it, just don't remember the answer
  const c = (navigator as Navigator & { connection?: Conn }).connection
  return Boolean(c?.saveData || c?.effectiveType === '2g' || c?.effectiveType === 'slow-2g')
}

// Offers Data saver on a slow or data-saving connection and never turns it on by itself. "Not now" is remembered, so
// nobody gets asked twice.
export function DataSaverPrompt({ on }: { on: boolean }) {
  const offer = useSyncExternalStore(subscribeToNothing, shouldOffer, () => false)
  const [dismissed, setDismissed] = useState(false)
  if (on || dismissed || !offer) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {}
    setDismissed(true)
  }

  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-nav-lighter px-3 py-2 text-[13px] text-white">
      <span>Slow connection? Data saver loads lighter pictures.</span>
      <form action={setDataSaver} onSubmit={dismiss}>
        <input type="hidden" name="on" value="1" />
        <button type="submit" className="cursor-pointer font-bold underline underline-offset-2">Turn on Data saver</button>
      </form>
      <button type="button" onClick={dismiss} className="cursor-pointer underline underline-offset-2">Not now</button>
    </div>
  )
}

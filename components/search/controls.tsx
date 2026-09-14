'use client'

import { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

const PRICE_FORM = 'price-form'

// While a navigation is in flight this renders a hidden marker; the results column dims via CSS :has([data-pending]).
export const PendingMark = ({ on }: { on: boolean }) => (on ? <span data-pending hidden /> : null)

// Put inside a <Link>
export function LinkPending() {
  return <PendingMark on={useLinkStatus().pending} />
}

const isDirty = (form: HTMLFormElement) =>
  [...form.querySelectorAll<HTMLInputElement>('input[type=number]')].some((i) => i.value.trim() !== i.defaultValue)

// Custom price. `keep` is the query string of every other filter. Without JS it is a plain GET form.
export function PriceForm({ keep, min, max }: { keep: string; min?: number; max?: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <form
      id={PRICE_FORM}
      action="/s"
      className="mt-2 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const sp = new URLSearchParams(keep)
        for (const name of ['min', 'max']) {
          const v = String(form.get(name) ?? '').trim()
          if (v) sp.set(name, v)
        }
        // like Amazon, Go with nothing typed does nothing (and empty params never reach the URL)
        if (!sp.has('min') && !sp.has('max') && min === undefined && max === undefined) return
        start(() => router.push(sp.size ? `/s?${sp}` : '/s'))
      }}
    >
      {[...new URLSearchParams(keep)].map(([name, value], idx) => (
        <input key={idx} type="hidden" name={name} value={value} />
      ))}
      <input name="min" type="number" min={0} step="any" inputMode="decimal" placeholder="$ Min" aria-label="Minimum price, in dollars" defaultValue={min} className="input w-20 text-base lg:text-sm" />
      <input name="max" type="number" min={0} step="any" inputMode="decimal" placeholder="$ Max" aria-label="Maximum price, in dollars" defaultValue={max} className="input w-20 text-base lg:text-sm" />
      <button type="submit" className="btn btn-plain">Go</button>
      <PendingMark on={pending} />
    </form>
  )
}

// Mobile drawer footer. Filter taps apply at once; a typed price is applied here too instead of being dropped.
// Remount (key) on every navigation so the label resets.
export function ShowResults({ popover, total }: { popover: string; total: number }) {
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    const onInput = (e: Event) => {
      const form = (e.target as HTMLInputElement).form
      if (form?.id === PRICE_FORM) setDirty(isDirty(form))
    }
    document.addEventListener('input', onInput)
    return () => document.removeEventListener('input', onInput)
  }, [])
  return (
    <button
      type="button"
      popoverTarget={popover}
      popoverTargetAction="hide"
      onClick={() => {
        const form = document.getElementById(PRICE_FORM)
        if (form instanceof HTMLFormElement && isDirty(form)) form.requestSubmit()
      }}
      className="btn btn-cart btn-lg"
    >
      {/* the count for a typed price isn't known until it's applied, so don't show a stale one */}
      {dirty ? 'Show results' : `Show ${total.toLocaleString('en-US')} ${total === 1 ? 'result' : 'results'}`}
    </button>
  )
}

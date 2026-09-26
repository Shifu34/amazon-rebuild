'use client'

import Link from 'next/link'
import { startTransition, useActionState, useState } from 'react'
import { cancelItems, type OrderFormState } from '@/app/actions/orders'
import { CANCEL_REASONS } from './rules'

type Item = { productId: number; title: string; thumbnail: string; quantity: number }

export function CancelForm({ orderId, items }: { orderId: string; items: Item[] }) {
  const [state, action, pending] = useActionState<OrderFormState, FormData>(cancelItems, null)
  const [picked, setPicked] = useState<number[]>(items.length === 1 ? [items[0].productId] : [])
  const [reason, setReason] = useState('')
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    // onSubmit instead of action={...}: React resets action forms after each submit, which desyncs these controlled fields
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      className="space-y-6"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <fieldset>
        <legend className="mb-3 font-display text-base font-semibold">Check the items you want to cancel</legend>
        <ul className="card divide-y divide-line">
          {items.map((i) => (
            <li key={i.productId}>
              <label className="flex cursor-pointer items-center gap-4 p-4 hover:bg-page">
                <input
                  type="checkbox"
                  name="item"
                  value={i.productId}
                  checked={picked.includes(i.productId)}
                  onChange={() => toggle(i.productId)}
                  className="size-4 shrink-0 accent-accent"
                />
                <span className="flex size-16 shrink-0 items-center justify-center rounded-[10px] bg-page p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="line-clamp-2">{i.title}</span>
                  <span className="price text-xs text-muted">Qty: {i.quantity}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div>
        <label htmlFor="cancel-reason" className="label">Reason for cancel (optional)</label>
        <select id="cancel-reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="select-pill max-w-full">
          <option value="">Select cancellation reason</option>
          {CANCEL_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg border border-danger/40 px-4 py-3 text-sm text-danger">{state.error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="btn btn-cart btn-lg">{pending ? 'Requesting…' : 'Request cancellation'}</button>
        <Link href={`/orders/${orderId}`} className="btn btn-plain btn-lg">Keep order</Link>
      </div>
      <p className="text-xs text-muted">Cancelled items are removed from your order right away, and you won&apos;t be charged for them.</p>
    </form>
  )
}

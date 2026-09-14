'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { startReturn, type OrderFormState } from '@/app/actions/orders'
import { usdCents } from '@/lib/format'
import { COMMENT_MAX, PROBLEM_REASONS, RETURN_METHODS, RETURN_REASONS, returnFeeCents, type ReturnMethod } from './rules'

export type ReturnItem = {
  productId: number
  title: string
  thumbnail: string
  quantity: number
  priceCents: number
  refundCents: number // price × qty + tax
  note: string
  blocker: string | null
  canReplace: boolean
}

type Invalid = { field: 'item' | 'reason' | 'comment'; message: string }

function RadioCard({ title, note, ...input }: { title: string; note: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={`flex gap-3 rounded-lg border p-3 text-sm ${input.checked ? 'border-link bg-[#f7fafa] shadow-[inset_0_0_0_1px_#007185]' : 'border-line'} ${input.disabled ? 'opacity-60' : 'cursor-pointer'}`}
    >
      <input type="radio" {...input} className="mt-0.5 shrink-0 accent-[#007185]" />
      <span>
        <b className="block">{title}</b>
        <span className="text-xs text-muted">{note}</span>
      </span>
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

// One page: items, reason, comment, refund or replacement, return method, and a live refund summary.
export function ReturnForm({ orderId, items, preselect, payment }: { orderId: string; items: ReturnItem[]; preselect: number | null; payment: string }) {
  const eligible = items.filter((i) => !i.blocker)
  const [state, action, pending] = useActionState<OrderFormState, FormData>(startReturn, null)
  const [picked, setPicked] = useState<number[]>(() =>
    eligible.length === 1 ? [eligible[0].productId] : eligible.filter((i) => i.productId === preselect).map((i) => i.productId),
  )
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [resolution, setResolution] = useState<'refund' | 'replacement'>('refund')
  const [method, setMethod] = useState<ReturnMethod>('ups-store')
  const [invalid, setInvalid] = useState<Invalid | null>(null)
  const serverError = useRef<HTMLParagraphElement>(null)
  useEffect(() => serverError.current?.scrollIntoView({ block: 'nearest' }), [state])
  const toggle = (id: number) => {
    setInvalid(null)
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  const chosen = eligible.filter((i) => picked.includes(i.productId))
  const problem = PROBLEM_REASONS.has(reason)
  const inStock = chosen.every((i) => i.canReplace)
  const canReplace = problem && chosen.length > 0 && inStock
  const replace = resolution === 'replacement' && canReplace
  const subtotal = chosen.reduce((s, i) => s + i.priceCents * i.quantity, 0)
  const tax = chosen.reduce((s, i) => s + i.refundCents - i.priceCents * i.quantity, 0)
  const fee = Math.min(subtotal + tax, returnFeeCents(reason, method, replace))
  const total = replace ? 0 : subtotal + tax - fee

  // the error sits under the field that failed; the field gets aria-invalid and points at it
  const errorFor = (field: Invalid['field']) =>
    invalid?.field === field && <p id={`return-${field}-error`} role="alert" className="field-error">{invalid.message}</p>
  const invalidAttrs = (field: Invalid['field']) => (invalid?.field === field ? { 'aria-invalid': true, 'aria-describedby': `return-${field}-error` } : {})

  const confirm = (className: string) => (
    <button type="submit" disabled={pending} className={`btn btn-cart btn-lg ${className}`}>{pending ? 'Confirming…' : 'Confirm your return'}</button>
  )

  return (
    // onSubmit instead of action={...}: React resets action forms after each submit, which desyncs these controlled fields
    <form
      onSubmit={(e) => {
        e.preventDefault()
        // the server repeats these checks; doing them here puts the message next to the field without a round trip
        const fail: Invalid | null =
          !chosen.length ? { field: 'item', message: 'Please select at least one item to return.' }
          : !reason ? { field: 'reason', message: 'Please select a reason for return.' }
          : problem && !comment.trim() ? { field: 'comment', message: 'Please tell us more about the problem.' }
          : null
        setInvalid(fail)
        if (fail) {
          const el = document.getElementById(`return-${fail.field}`)
          el?.scrollIntoView({ block: 'center' })
          el?.focus({ preventScroll: true })
          return
        }
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_300px] lg:pb-0"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <div className="min-w-0 space-y-6">
        <fieldset>
          <legend className="text-lg font-bold">Choose items to return</legend>
          {errorFor('item')}
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {items.map((i) => (
              <li key={i.productId}>
                <label className={`flex items-start gap-3 p-3 ${i.blocker ? '' : 'cursor-pointer hover:bg-[#f7fafa]'}`}>
                  <input
                    type="checkbox"
                    name="item"
                    value={i.productId}
                    id={i === eligible[0] ? 'return-item' : undefined}
                    disabled={!!i.blocker}
                    checked={picked.includes(i.productId)}
                    onChange={() => toggle(i.productId)}
                    {...(i.blocker ? {} : invalidAttrs('item'))}
                    className="mt-1 size-4 shrink-0 accent-[#007185]"
                  />
                  <span className={`flex size-16 shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-1 ${i.blocker ? 'opacity-60' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="line-clamp-2">{i.title}</span>
                    <span className="block text-xs text-muted">
                      Qty: {i.quantity}
                      {i.quantity > 1 && ' (all units)'} · {usdCents(i.priceCents)}
                    </span>
                    <span className={`block text-xs ${i.blocker ? 'text-danger' : 'text-muted'}`}>{i.blocker ?? i.note}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div>
          <label htmlFor="return-reason" className="label">Why are you returning this?</label>
          <select
            id="return-reason"
            name="reason"
            value={reason}
            onChange={(e) => {
              setInvalid(null)
              setReason(e.target.value)
            }}
            {...invalidAttrs('reason')}
            className="select-pill max-w-full aria-invalid:border-[#cc0c39]"
          >
            <option value="">Choose a response</option>
            {RETURN_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          {errorFor('reason')}
        </div>

        <div>
          <label htmlFor="return-comment" className="label">{problem ? 'Please tell us more' : 'Comments (optional)'}</label>
          <textarea
            id="return-comment"
            name="comment"
            rows={3}
            maxLength={COMMENT_MAX}
            value={comment}
            onChange={(e) => {
              setInvalid(null)
              setComment(e.target.value)
            }}
            aria-required={problem}
            aria-invalid={invalid?.field === 'comment' || undefined}
            aria-describedby={invalid?.field === 'comment' ? 'return-comment-error return-comment-count' : 'return-comment-count'}
            placeholder={problem ? 'What went wrong?' : undefined}
            className="input"
          />
          <div className="flex justify-between gap-2">
            {errorFor('comment') || <span />}
            <p id="return-comment-count" className="mt-1 text-xs text-muted">{comment.length}/{COMMENT_MAX}</p>
          </div>
        </div>

        <fieldset>
          <legend className="text-lg font-bold">How can we make it right?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <RadioCard name="resolution" value="refund" checked={!replace} onChange={() => setResolution('refund')} title="Refund" note={`To ${payment}, 3-5 business days after we receive your item`} />
            <RadioCard
              name="resolution"
              value="replacement"
              checked={replace}
              disabled={!canReplace}
              onChange={() => setResolution('replacement')}
              title="Replace with exact item"
              note={
                canReplace ? 'Free. We ship a new one now, before you send this one back.'
                : problem && !inStock ? "This item is out of stock, so it can't be replaced."
                : 'Available when an item arrived damaged, defective or wrong.'
              }
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-bold">How would you like to return your item?</legend>
          <div className="mt-2 grid gap-2">
            {(Object.keys(RETURN_METHODS) as ReturnMethod[]).map((key) => {
              const m = RETURN_METHODS[key]
              const cost = !m.feeCents ? 'Free' : returnFeeCents(reason, key, replace) ? `${usdCents(m.feeCents)} return shipping, taken from your refund` : 'Free (fee waived for this reason)'
              return <RadioCard key={key} name="method" value={key} checked={method === key} onChange={() => setMethod(key)} title={m.label} note={`${m.note} · ${cost}`} />
            })}
          </div>
        </fieldset>
      </div>

      <aside aria-label="Refund summary" className="self-start rounded-lg border border-line p-4 lg:sticky lg:top-4">
        <h2 className="text-lg font-bold">{replace ? 'Replacement summary' : 'Refund summary'}</h2>
        <dl className="mt-2 space-y-1 text-sm">
          {replace ? (
            <Row label="Replacement order" value={usdCents(0)} />
          ) : (
            <>
              <Row label="Refund subtotal" value={usdCents(subtotal)} />
              <Row label="Tax refund" value={usdCents(tax)} />
              <Row label="Return shipping" value={fee ? `−${usdCents(fee)}` : usdCents(0)} />
            </>
          )}
          <div className="flex justify-between gap-2 border-t border-line pt-2 text-base font-bold">
            <dt>Total estimated refund</dt>
            <dd>{usdCents(total)}</dd>
          </div>
        </dl>
        {!chosen.length && <p className="mt-2 text-xs text-muted">Select an item to see your refund.</p>}
        {state?.error && (
          <p ref={serverError} role="alert" className="mt-3 scroll-mb-24 rounded-lg border border-[#c10015] px-3 py-2 text-sm text-[#c10015] lg:scroll-mb-0">
            {state.error}
          </p>
        )}
        {confirm('mt-4 hidden w-full lg:flex')}
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 shadow-[0_-1px_2px_rgba(15,17,17,0.08)] lg:hidden">
        <p className="text-sm">
          Estimated refund <b className="block text-base">{usdCents(total)}</b>
        </p>
        {confirm('')}
      </div>
    </form>
  )
}

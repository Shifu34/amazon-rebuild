'use client'

import { useState } from 'react'
import { addCard, type CardState } from '@/app/actions/payments'
import { Field, Problem, useFormAction } from './address-form'

// display-only brand detection while typing; the server re-detects and validates in lib/payments.ts
const BRANDS: [string, RegExp][] = [
  ['Visa', /^4/],
  ['Mastercard', /^(5[1-5]|2[2-7])/],
  ['American Express', /^3[47]/],
  ['Discover', /^(6011|65|64[4-9])/],
]

type Props = {
  returnTo?: string // redirect here after saving
  onSaved?: (id: string) => void // or hand the new card id back
  onCancel?: () => void
}

export function CardForm({ returnTo, onSaved, onCancel }: Props) {
  const { state, pending, ref, onSubmit } = useFormAction<CardState>(async (prev, form) => {
    const next = await addCard(prev, form)
    if (next?.id) onSaved?.(next.id)
    return next
  }, null)
  const [brand, setBrand] = useState<string | null>(null)
  const e = state?.errors ?? {}
  const year = new Date().getFullYear()

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="space-y-3.5">
      {state?.problem && <Problem>{state.problem}</Problem>}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

      <p className="rounded-lg border border-[#246fb6] bg-[#f3f8fc] px-3 py-2 text-[13px]">
        <b>Demo store: nothing is charged.</b> Use <span className="font-mono whitespace-nowrap">4242 4242 4242 4242</span> with any future date and any 3-digit
        security code. Cards ending in <span className="font-mono">0002</span> are declined at checkout.
      </p>

      <div>
        <p className="mb-1 text-xs text-muted">nile accepts all major credit and debit cards:</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Accepted cards">
          {BRANDS.map(([name]) => (
            <li key={name} className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${brand === name ? 'border-link bg-[#e6f4f6] text-link' : 'border-line text-muted'}`}>
              {name}
            </li>
          ))}
        </ul>
      </div>

      <Field label="Card number" error={e.number}>
        {(a) => (
          <input
            {...a}
            name="number"
            className="input"
            autoComplete="cc-number"
            inputMode="numeric"
            maxLength={23}
            onChange={(ev) => setBrand(BRANDS.find(([, re]) => re.test(ev.target.value.replace(/\D/g, '')))?.[0] ?? null)}
          />
        )}
      </Field>
      <Field label="Name on card" error={e.nameOnCard}>
        {(a) => <input {...a} name="nameOnCard" className="input" autoComplete="cc-name" maxLength={80} />}
      </Field>
      <div className="flex flex-wrap gap-x-6 gap-y-3.5">
        <fieldset aria-describedby={e.exp ? 'card-exp-error' : undefined}>
          <legend className="label">Expiration date</legend>
          <div className="flex gap-2">
            <select name="expMonth" aria-label="Expiration month" aria-invalid={!!e.exp} className="input w-20" autoComplete="cc-exp-month" defaultValue="">
              <option value="" disabled>MM</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
              ))}
            </select>
            <select name="expYear" aria-label="Expiration year" aria-invalid={!!e.exp} className="input w-24" autoComplete="cc-exp-year" defaultValue="">
              <option value="" disabled>YYYY</option>
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={year + i}>{year + i}</option>
              ))}
            </select>
          </div>
          {e.exp && <p id="card-exp-error" className="field-error">{e.exp}</p>}
        </fieldset>
        <Field label="Security code (CVV)" error={e.cvv} className="w-40">
          {(a) => <input {...a} name="cvv" className="input" autoComplete="cc-csc" inputMode="numeric" maxLength={4} />}
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="makeDefault" className="size-4 accent-link" />
        Set as default payment method
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn btn-cart btn-lg">{pending ? 'Adding…' : 'Add your card'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn btn-plain btn-lg">Cancel</button>}
      </div>
    </form>
  )
}

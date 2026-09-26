'use client'

import { useState } from 'react'
import { addCard, type CardState } from '@/app/actions/payments'
import { Field, FieldError, FormProblem, useFormAction } from './address-form'
import { BRANDS, cardBrand, cardDigits, cardNumberError, TEST_CARD_ERROR } from './checkout/cards'

type Props = {
  returnTo?: string // redirect here after saving
  onSaved?: (id: string) => void // or hand the new card id back
  onCancel?: () => void
  defaultName?: string // e.g. the delivery address name at checkout
}

export function CardForm({ returnTo, onSaved, onCancel, defaultName }: Props) {
  const { state, pending, ref, onSubmit } = useFormAction<CardState>(async (prev, form) => {
    // a real (Luhn-valid, not a test) card number is refused here, so it never leaves the browser; the server checks again
    if (cardNumberError(cardDigits(form.get('number'))) === TEST_CARD_ERROR) return { errors: { number: TEST_CARD_ERROR } }
    const next = await addCard(prev, form)
    if (next?.id) onSaved?.(next.id)
    return next
  }, null)
  const [brand, setBrand] = useState<string | null>(null)
  const e = state?.errors ?? {}
  const year = new Date().getFullYear()

  const fillTestCard = () => {
    const field = (name: string) => ref.current?.elements.namedItem(name) as HTMLInputElement
    field('number').value = '4242 4242 4242 4242'
    if (!field('nameOnCard').value) field('nameOnCard').value = defaultName || 'Test Shopper'
    field('expMonth').value = '12'
    field('expYear').value = String(year + 3)
    field('cvv').value = '123'
    setBrand('Visa')
  }

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="space-y-3.5">
      <FormProblem problem={state?.problem} errors={e} />
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

      <div className="rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            <b>Demo store: nothing is charged.</b> Only test cards work, such as <span className="font-mono whitespace-nowrap">4242 4242 4242 4242</span> with any
            future date and any 3-digit security code.
          </p>
          <button type="button" onClick={fillTestCard} className="btn btn-plain shrink-0">Use test card</button>
        </div>
        <details className="mt-1">
          <summary className="link cursor-pointer">More test cards</summary>
          <ul className="mt-1 space-y-0.5">
            <li>Visa debit <span className="font-mono">4000 0566 5566 5556</span></li>
            <li>Mastercard <span className="font-mono">5555 5555 5555 4444</span></li>
            <li>American Express <span className="font-mono">3782 822463 10005</span> (4-digit security code)</li>
            <li>Discover <span className="font-mono">6011 1111 1111 1117</span></li>
            <li>Declined at checkout <span className="font-mono">4000 0000 0000 0002</span></li>
          </ul>
        </details>
      </div>

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
            onChange={(ev) => setBrand(cardBrand(cardDigits(ev.target.value)))}
          />
        )}
      </Field>
      <Field label="Name on card" error={e.nameOnCard}>
        {(a) => <input {...a} name="nameOnCard" className="input" autoComplete="cc-name" maxLength={80} defaultValue={defaultName} />}
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
          {e.exp && <FieldError id="card-exp-error">{e.exp}</FieldError>}
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

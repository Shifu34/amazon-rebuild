'use client'

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react'
import { saveAddress, type AddressState } from '@/app/actions/addresses'
import { useRegion } from '@/components/region-provider'
import type { Address } from '@/lib/addresses'
import { COUNTRIES, countryCodeFromName, type CountryCode } from '@/lib/region'

type A11y = { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }

// Label + control + inline error (linked with aria-describedby) or hint. Shared with the card form.
export function Field({ label, error, hint, className, children }: { label: string; error?: string; hint?: string; className?: string; children: (a11y: A11y) => React.ReactNode }) {
  const id = useId()
  const note = error || hint ? `${id}-note` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': note })}
      {error ? <FieldError id={note}>{error}</FieldError> : hint && <p id={note} className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="field-error flex items-start gap-1.5">
      <span aria-hidden className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-[#cc0c39] text-[10px] font-bold text-white">!</span>
      {children}
    </p>
  )
}

// "There was a problem": the server's message, or how many fields need fixing
export function FormProblem({ problem, errors }: { problem?: string; errors: object }) {
  const n = Object.keys(errors).length
  if (!problem && !n) return null
  return <Problem>{problem ?? `Please correct the ${n === 1 ? 'highlighted field' : `${n} highlighted fields`} below.`}</Problem>
}

export function Problem({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="mb-4 rounded-lg border border-[#cc0c39] px-4 py-3 shadow-[0_0_0_4px_#fcf4f4_inset]">
      <p className="font-bold text-[#cc0c39]">There was a problem</p>
      <p className="text-[13px]">{children}</p>
    </div>
  )
}

// Submit without React's automatic form reset, so typed values survive validation errors; then focus the first error.
export function useFormAction<S>(action: (prev: Awaited<S>, form: FormData) => Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [state])
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    startTransition(() => dispatch(form))
  }
  return { state, pending, ref, onSubmit }
}

type Props = {
  address?: Address // edit this address instead of adding one
  returnTo?: string // redirect here after saving (pages rendered on the server)
  onSaved?: (id: string) => void // or hand the id back (client parents such as checkout)
  onCancel?: () => void
  submitLabel?: string
  openInstructions?: boolean // open and focus delivery instructions (the address book's "Add delivery instructions" link)
  defaultName?: string // prefill Full name on a new address
}

// what changes with the country; everything else in the form is shared, so typed values survive a switch
const PHONE: Record<CountryCode, { placeholder: string; hint: string }> = {
  US: { placeholder: '(206) 555-0100', hint: 'May be used to assist delivery' },
  PK: { placeholder: '0300 1234567', hint: 'Mobile (03XX XXXXXXX or +92 3XX XXXXXXX) or landline. May be used to assist delivery' },
}

export function AddressForm({ address, returnTo, onSaved, onCancel, submitLabel = address ? 'Save changes' : 'Add address', openInstructions = false, defaultName }: Props) {
  const { state, pending, ref, onSubmit } = useFormAction<AddressState>(async (prev, form) => {
    const next = await saveAddress(prev, form)
    if (next?.id) onSaved?.(next.id)
    return next
  }, null)
  const e = state?.errors ?? {}
  // a new address starts in the shopper's delivery country, like Amazon's form
  const region = useRegion()
  const saved = address ? countryCodeFromName(address.country) : null
  const [code, setCode] = useState<CountryCode>(saved ?? region.country)
  const country = COUNTRIES[code]

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="space-y-3.5">
      <FormProblem problem={state?.problem} errors={e} />
      {address && <input type="hidden" name="id" value={address.id} />}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

      <Field label="Country/Region">
        {(a) => (
          <select {...a} name="country" className="input" autoComplete="country" value={code} onChange={(ev) => setCode(ev.target.value as CountryCode)}>
            {Object.values(COUNTRIES).map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Full name (First and Last name)" error={e.fullName}>
        {(a) => <input {...a} name="fullName" className="input" autoComplete="name" defaultValue={address?.fullName ?? defaultName} maxLength={80} />}
      </Field>
      <Field label="Phone number" error={e.phone} hint={PHONE[code].hint}>
        {(a) => <input {...a} name="phone" type="tel" className="input" autoComplete="tel" inputMode="tel" placeholder={PHONE[code].placeholder} defaultValue={address?.phone} maxLength={30} />}
      </Field>
      <Field label="Address" error={e.line1}>
        {(a) => (
          <>
            <input {...a} name="line1" className="input" autoComplete="address-line1" placeholder="Street address or P.O. Box" defaultValue={address?.line1} maxLength={120} />
            <input name="line2" aria-label="Address line 2" className="input mt-2" autoComplete="address-line2" placeholder="Apt, suite, unit, building, floor, etc." defaultValue={address?.line2} maxLength={120} />
          </>
        )}
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-[1fr_1fr_120px]">
        <Field label="City" error={e.city}>
          {(a) => <input {...a} name="city" className="input" autoComplete="address-level2" defaultValue={address?.city} maxLength={60} />}
        </Field>
        <Field label={country.regionLabel} error={e.state}>
          {(a) => (
            // keyed by country: a US state is no answer for Pakistan, so the choice resets on a switch
            <select key={code} {...a} name="state" className="input" autoComplete="address-level1" defaultValue={code === saved ? address?.state : ''}>
              <option value="">Select</option>
              {country.regions.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label={country.postalLabel} error={e.zip}>
          {(a) => <input {...a} name="zip" className="input" autoComplete="postal-code" inputMode="numeric" defaultValue={address?.zip} maxLength={code === 'PK' ? 5 : 10} />}
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="makeDefault" defaultChecked={address?.isDefault} className="size-4 accent-link" />
        Make this my default address
      </label>

      <details open={!!address?.instructions || openInstructions} className="text-sm">
        <summary className="link cursor-pointer">Add preferences, notes, access codes and more</summary>
        <Field label="Delivery instructions (optional)" className="mt-2">
          {(a) => (
            <textarea {...a} name="instructions" className="input" maxLength={500} autoFocus={openInstructions} defaultValue={address?.instructions} placeholder="Gate code, where to leave packages, best time to deliver" />
          )}
        </Field>
      </details>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn btn-cart btn-lg">{pending ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn btn-plain btn-lg">Cancel</button>}
      </div>
    </form>
  )
}

'use client'

import Link from 'next/link'
import { useActionState, useState, type InputHTMLAttributes } from 'react'
import { authenticate, type AuthState } from '@/app/actions/auth'

type Props = { returnTo: string; start: 'email' | 'create' }

// "Change" on the email restarts the flow by remounting with fresh action state
export function AuthForm(props: Props) {
  const [attempt, setAttempt] = useState(0)
  return <Flow key={attempt} {...props} restart={() => setAttempt((n) => n + 1)} start={attempt ? 'email' : props.start} />
}

function Flow({ returnTo, start, restart }: Props & { restart: () => void }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, { step: start, email: '' })
  const { step, email, errors = {} } = state
  const emailEditable = step === 'email' || (step === 'create' && (start === 'create' || !!errors.email))
  const signInHref = `/ap/signin${returnTo !== '/' ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`

  return (
    <>
      {errors.form && (
        <div role="alert" className="mb-4 rounded-lg border border-[#cc0c39] p-4 shadow-[0_0_0_4px_#fcf4f4_inset]">
          <h2 className="text-[17px] font-normal text-[#cc0c39]">There was a problem</h2>
          <p className="text-[13px]">{errors.form}</p>
        </div>
      )}
      <div className="rounded-lg border border-[#ddd] px-5 py-5">
        <h1 className="mb-3 text-[28px] leading-9 font-normal">
          {step === 'email' ? 'Sign in or create account' : step === 'password' ? 'Sign in' : 'Create account'}
        </h1>

        {step === 'create' && start === 'email' && !errors.email && (
          <p className="mb-3 text-[13px]">Looks like you&apos;re new to nile. Let&apos;s create your account.</p>
        )}

        <form action={action} noValidate className="space-y-3.5">
          <input type="hidden" name="step" value={step} />
          <input type="hidden" name="return_to" value={returnTo} />

          {emailEditable ? (
            <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={email} error={errors.email} autoFocus={step === 'email'} />
          ) : (
            <p className="text-sm">
              <input type="hidden" name="email" value={email} />
              <span className="break-all">{email}</span>{' '}
              <button type="button" onClick={restart} className="link cursor-pointer">Change</button>
            </p>
          )}

          {step === 'create' && (
            <Field label="Your name" name="name" autoComplete="name" placeholder="First and last name" defaultValue={state.name} error={errors.name} autoFocus={!emailEditable} />
          )}

          {step !== 'email' && (
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={step === 'create' ? 'new-password' : 'current-password'}
              placeholder={step === 'create' ? 'At least 6 characters' : undefined}
              hint={step === 'create' ? 'Passwords must be at least 6 characters.' : undefined}
              error={errors.password}
              autoFocus={step === 'password'}
            />
          )}

          {step === 'create' && <Field label="Re-enter password" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />}

          <button type="submit" disabled={pending} className="btn btn-cart w-full">
            {pending ? 'Please wait…' : step === 'email' ? 'Continue' : step === 'password' ? 'Sign in' : 'Create your nile account'}
          </button>
        </form>

        <p className="mt-5 text-xs leading-[18px]">
          By continuing, you agree to nile&apos;s Conditions of Use and Privacy Notice. This is a demo store: no real orders or charges.
        </p>

        {step === 'create' && (
          <p className="mt-5 border-t border-[#e7e7e7] pt-4 text-[13px]">
            Already a customer?{' '}
            {start === 'create' ? <Link href={signInHref} className="link">Sign in</Link> : <button type="button" onClick={restart} className="link cursor-pointer">Sign in</button>}
          </p>
        )}
      </div>
    </>
  )
}

function Field({ label, error, hint, name, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string }) {
  const id = `field-${name}`
  const note = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={name} className="input" aria-invalid={!!error} aria-describedby={note} {...props} />
      {error ? (
        <p id={note} className="field-error flex items-center gap-1.5">
          <span aria-hidden className="flex size-3.5 items-center justify-center rounded-full bg-[#cc0c39] text-[10px] font-bold text-white">!</span>
          {error}
        </p>
      ) : (
        hint && <p id={note} className="mt-1 text-xs text-muted">ⓘ {hint}</p>
      )}
    </div>
  )
}

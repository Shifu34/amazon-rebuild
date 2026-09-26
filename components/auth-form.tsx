'use client'

import Link from 'next/link'
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { authenticate, type AuthState } from '@/app/actions/auth'

type Props = { returnTo: string; start: 'email' | 'create' }

// "Change" restarts the flow by remounting with fresh action state; the typed email comes along
export function AuthForm(props: Props) {
  const [attempt, setAttempt] = useState({ n: 0, email: '' })
  return (
    <Flow
      key={attempt.n}
      {...props}
      email={attempt.email}
      start={attempt.n ? 'email' : props.start}
      restart={(email) => setAttempt((a) => ({ n: a.n + 1, email }))}
    />
  )
}

function Flow({ returnTo, start, email: initialEmail, restart }: Props & { email: string; restart: (email: string) => void }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, { step: start, email: initialEmail })
  const { step, email, errors = {} } = state
  const emailEditable = step === 'email' || (step === 'create' && (start === 'create' || !!errors.email))
  const query = returnTo !== '/' ? `?return_to=${encodeURIComponent(returnTo)}` : ''
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [state])

  // Dispatching in our own transition skips React's post-action form reset, so typed values survive an error.
  // `action` stays on the form for submits before hydration.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => action(data))
  }

  // keys: the fields swap places between steps, and an unkeyed swap would reuse the email <input> (and its value) for the name
  const emailField = emailEditable ? (
    <Field key="email" label="Email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={email} error={errors.email} autoFocus={step === 'email'} />
  ) : (
    <p key="email" className="text-sm">
      <input type="hidden" name="email" value={email} />
      <span className="break-all">{email}</span>{' '}
      <button type="button" onClick={() => restart(email)} className="link cursor-pointer">Change</button>
    </p>
  )
  const nameField = step === 'create' && (
    <Field key="name" label="Your name" name="name" autoComplete="name" placeholder="First and last name" defaultValue={state.name} error={errors.name} autoFocus />
  )

  return (
    <>
      {errors.form && (
        <div role="alert" className="mb-5 rounded-lg border border-danger bg-danger/5 p-4">
          <h2 className="text-base text-danger">There was a problem</h2>
          <p className="mt-1 text-sm">{errors.form}</p>
        </div>
      )}
      <div className="card px-6 py-7">
        <h1 className="mb-4 text-[26px] leading-8">
          {step === 'email' ? 'Sign in or create account' : step === 'password' ? 'Sign in' : 'Create account'}
        </h1>

        {step === 'create' && start === 'email' && !errors.email && (
          <p className="mb-4 text-sm text-muted">Looks like you&apos;re new here. Let&apos;s make your account.</p>
        )}

        <form ref={formRef} action={action} onSubmit={onSubmit} noValidate className="space-y-4">
          <input type="hidden" name="step" value={step} />
          <input type="hidden" name="return_to" value={returnTo} />

          {/* Create account starts with the name, like Amazon's form; elsewhere the email leads */}
          {emailEditable ? <>{nameField}{emailField}</> : <>{emailField}{nameField}</>}

          {step !== 'email' && (
            <Field
              label="Password"
              name="password"
              type="password"
              reveal
              aside={step === 'password' && <Link href={`/ap/forgotpassword${query}`} className="link text-sm">Forgot password?</Link>}
              autoComplete={step === 'create' ? 'new-password' : 'current-password'}
              placeholder={step === 'create' ? 'At least 6 characters' : undefined}
              hint={step === 'create' ? 'Passwords must be at least 6 characters.' : undefined}
              error={errors.password}
              autoFocus={step === 'password'}
            />
          )}

          {step === 'create' && <Field label="Re-enter password" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />}

          <button type="submit" disabled={pending} className="btn btn-cart btn-lg w-full">
            {pending ? 'Please wait…' : step === 'email' ? 'Continue' : step === 'password' ? 'Sign in' : 'Create your nile account'}
          </button>
        </form>

        <p className="mt-6 text-xs leading-5 text-muted">
          By continuing you agree to nile&apos;s conditions of use and privacy notice. This is a demo store: nothing is charged and nothing ships.
        </p>

        {step === 'email' && (
          <details className="mt-4 text-sm">
            <summary className="link w-fit cursor-pointer">Need help?</summary>
            <Link href={`/ap/forgotpassword${query}`} className="link mt-2 ml-4 block w-fit">Forgot your password?</Link>
          </details>
        )}

        {step === 'create' && (
          <p className="mt-6 border-t border-line pt-5 text-sm">
            Already a customer?{' '}
            {start === 'create' ? (
              <Link href={`/ap/signin${query}`} className="link">Sign in</Link>
            ) : (
              <button type="button" onClick={() => restart(email)} className="link cursor-pointer">Sign in</button>
            )}
          </p>
        )}
      </div>
    </>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string; aside?: ReactNode; reveal?: boolean }

// reveal: a "Show" toggle inside the input (no aria-label, so getByLabel('Password') still finds only the input)
function Field({ label, error, hint, name, aside, reveal, type, ...props }: FieldProps) {
  const [shown, setShown] = useState(false)
  const id = `field-${name}`
  const note = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label">{label}</label>
        {aside}
      </div>
      <div className="relative">
        <input id={id} name={name} type={shown ? 'text' : type} className={reveal ? 'input pr-14' : 'input'} aria-invalid={!!error} aria-describedby={note} {...props} />
        {reveal && (
          <button type="button" onClick={() => setShown(!shown)} aria-pressed={shown} aria-controls={id} className="link absolute inset-y-0 right-0 cursor-pointer px-3 text-sm">
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error ? (
        <p id={note} className="field-error flex items-center gap-1.5">
          <span aria-hidden className="flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">!</span>
          {error}
        </p>
      ) : (
        hint && <p id={note} className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}

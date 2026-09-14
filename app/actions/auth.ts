'use server'

import { redirect } from 'next/navigation'
import { endSession, hashPassword, safeReturnTo, startSession, verifyPassword } from '@/lib/auth'
import { one } from '@/lib/db'

export type AuthState = {
  step: 'email' | 'password' | 'create'
  email: string
  name?: string
  errors?: Partial<Record<'email' | 'password' | 'name' | 'confirm' | 'form', string>>
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const ALREADY = 'You already have an account with this email address. Sign in instead.'

// One form, three steps like Amazon's "Sign in or create account": email first, then password or create-account.
export async function authenticate(prev: AuthState, form: FormData): Promise<AuthState> {
  const step = (['email', 'password', 'create'].includes(String(form.get('step'))) ? form.get('step') : 'email') as AuthState['step']
  const email = String(form.get('email') ?? prev.email).trim().toLowerCase()
  const returnTo = safeReturnTo(form.get('return_to'))

  const emailError = EMAIL.test(email) ? undefined : email ? 'Invalid email address.' : 'Enter your email address.'
  if (emailError && step !== 'create') return { step: 'email', email, errors: { email: emailError } }

  if (step === 'email') {
    const exists = await one('select 1 from users where email = $1', [email])
    return { step: exists ? 'password' : 'create', email }
  }

  if (step === 'password') {
    const password = String(form.get('password') ?? '')
    if (!password) return { step, email, errors: { password: 'Enter your password.' } }
    const user = await one<{ id: string; password_hash: string }>('select id, password_hash from users where email = $1', [email])
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return { step, email, errors: { password: 'Your password is incorrect.' } }
    }
    await startSession(user.id)
    redirect(returnTo)
  }

  const name = String(form.get('name') ?? '').trim()
  const password = String(form.get('password') ?? '')
  const confirm = String(form.get('confirm') ?? '')
  const errors: AuthState['errors'] = {} // every create-account field error at once, not one per submit
  if (!name) errors.name = 'Enter your name.'
  if (emailError) errors.email = emailError
  if (password.length < 6) errors.password = 'Minimum 6 characters required.'
  else if (password !== confirm) errors.confirm = 'Passwords must match.'
  if (Object.keys(errors).length) return { step: 'create', email, name, errors }

  const user = await one<{ id: string }>(
    'insert into users (name, email, password_hash) values ($1, $2, $3) on conflict (email) do nothing returning id',
    [name.slice(0, 80), email, await hashPassword(password)],
  )
  if (!user) return { step: 'password', email, errors: { form: ALREADY } }
  await startSession(user.id)
  redirect(returnTo)
}

export async function signOut() {
  await endSession()
  redirect('/')
}

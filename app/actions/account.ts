'use server'

import { createHash } from 'node:crypto'
import { refresh } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { endSession, getUser, hashPassword, verifyPassword } from '@/lib/auth'
import { one, query } from '@/lib/db'
import { clearHistory, removeFromHistory, setHistoryPaused } from '@/lib/history'
import { deleteAddress, setDefaultAddress } from './addresses'
import { removeCard, setDefaultCard } from './payments'

export type SecurityField = 'name' | 'email' | 'password'
export type SecurityErrors = Partial<Record<'name' | 'email' | 'current' | 'password' | 'confirm', string>>
export type SecurityState = { saved?: SecurityField; errors?: SecurityErrors } | null

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ // same rule as sign-up (app/actions/auth.ts)

async function signedIn() {
  const user = await getUser()
  if (!user) redirect('/ap/signin?return_to=%2Faccount%2Fsecurity')
  return user
}

// null when the password is right, otherwise the message to show under "Current password"
async function passwordProblem(userId: string, password: string) {
  if (!password) return 'Enter your password.'
  const row = await one<{ password_hash: string }>('select password_hash from users where id = $1', [userId])
  return row && (await verifyPassword(password, row.password_hash)) ? null : 'Your password is incorrect.'
}

// After an email or password change every other device must sign in again; this one stays signed in.
async function endOtherSessions(userId: string) {
  const token = (await cookies()).get('session')?.value ?? '' // cookie name and hashing mirror lib/auth.ts
  await query('delete from sessions where user_id = $1 and token_hash <> $2', [userId, createHash('sha256').update(token).digest('hex')])
}

export async function updateName(_prev: SecurityState, form: FormData): Promise<SecurityState> {
  const user = await signedIn()
  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ')
  if (!name) return { errors: { name: 'Enter your name.' } }
  if (name.length > 80) return { errors: { name: 'Name can be at most 80 characters.' } }
  await query('update users set name = $2 where id = $1', [user.id, name])
  refresh()
  return { saved: 'name' }
}

export async function updateEmail(_prev: SecurityState, form: FormData): Promise<SecurityState> {
  const user = await signedIn()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const errors: SecurityErrors = {}
  if (!email) errors.email = 'Enter your new email address.'
  else if (!EMAIL.test(email) || email.length > 254) errors.email = 'Invalid email address.'
  else if (email === user.email) errors.email = 'This is already the email address on your account.'
  const wrong = await passwordProblem(user.id, String(form.get('current') ?? ''))
  if (wrong) errors.current = wrong
  if (Object.keys(errors).length) return { errors }

  // only reveal that an address is taken to someone who knows this account's password
  const row = await one('update users set email = $2 where id = $1 and not exists (select 1 from users where email = $2) returning id', [user.id, email])
  if (!row) return { errors: { email: 'Email address already in use. Enter a different email address.' } }
  await endOtherSessions(user.id)
  refresh()
  return { saved: 'email' }
}

export async function updatePassword(_prev: SecurityState, form: FormData): Promise<SecurityState> {
  const user = await signedIn()
  const password = String(form.get('password') ?? '')
  const confirm = String(form.get('confirm') ?? '')
  const errors: SecurityErrors = {}
  const wrong = await passwordProblem(user.id, String(form.get('current') ?? ''))
  if (wrong) errors.current = wrong
  if (password.length < 6) errors.password = 'Minimum 6 characters required.'
  else if (password.length > 128) errors.password = 'Passwords can be at most 128 characters.'
  else if (!confirm) errors.confirm = 'Type your password again.'
  else if (password !== confirm) errors.confirm = 'Passwords must match.'
  if (Object.keys(errors).length) return { errors }

  await query('update users set password_hash = $2 where id = $1', [user.id, await hashPassword(password)])
  await endOtherSessions(user.id)
  refresh()
  return { saved: 'password' }
}

export async function signOutEverywhere() {
  const user = await getUser()
  if (user) await query('delete from sessions where user_id = $1', [user.id])
  await endSession()
  redirect('/ap/signin?return_to=%2Faccount')
}

// Address book and wallet buttons (field: id): the shared checkout actions, then back with the confirmation alert.
export async function removeAddress(form: FormData) {
  await deleteAddress(form)
  redirect('/account/addresses?alert=removed')
}

export async function makeDefaultAddress(form: FormData) {
  await setDefaultAddress(form)
  redirect('/account/addresses?alert=default')
}

export async function removeWalletCard(form: FormData) {
  await removeCard(form)
  redirect('/account/payments?alert=removed')
}

export async function makeDefaultCard(form: FormData) {
  await setDefaultCard(form)
  redirect('/account/payments?alert=default')
}

// Browsing history. Field: productId.
export async function removeViewed(form: FormData) {
  const user = await getUser()
  const productId = Number(form.get('productId'))
  if (!user || !Number.isInteger(productId)) return
  await removeFromHistory(user.id, productId)
  refresh()
}

export async function clearViewed() {
  const user = await getUser()
  if (!user) return
  await clearHistory(user.id)
  refresh()
}

// Field: paused ("true" | "false").
export async function pauseHistory(form: FormData) {
  const user = await getUser()
  if (!user) return
  await setHistoryPaused(user.id, form.get('paused') === 'true')
  refresh()
}

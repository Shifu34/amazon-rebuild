// Email + password accounts: scrypt hashes, random session tokens stored hashed, httpOnly cookies.
// Functions that set cookies (startSession, endSession, cartOwner(true)) only work in Server Actions and Route Handlers.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { one, query } from './db'

const scrypt = promisify(scryptCb) as (password: string, salt: string, keylen: number) => Promise<Buffer>
const SESSION = 'session'
const GUEST = 'guest'
const cookieBase = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' } as const

export type User = { id: string; name: string; email: string }

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual = await scrypt(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// same-site paths only, so return_to can't become an open redirect
export const safeReturnTo = (v: unknown) => {
  const s = typeof v === 'string' ? v : ''
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : '/'
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION)?.value
  if (!token) return null
  const user = await one<User>(
    'select u.id, u.name, u.email from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()',
    [sha256(token)],
  )
  return user ?? null
})

export async function requireUser(returnTo: string): Promise<User> {
  const user = await getUser()
  if (!user) redirect(`/ap/signin?return_to=${encodeURIComponent(returnTo)}`)
  return user
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  await query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '30 days')", [sha256(token), userId])
  const jar = await cookies()
  jar.set(SESSION, token, { ...cookieBase, maxAge: 60 * 60 * 24 * 30 })

  // a guest cart follows the shopper into their account; quantities add up, capped at 30
  const guest = jar.get(GUEST)?.value
  if (guest) {
    await query(
      `with moved as (delete from cart_items where owner = $2 returning product_id, quantity, saved_for_later, added_at)
       insert into cart_items (owner, product_id, quantity, saved_for_later, added_at)
       select $1, product_id, quantity, saved_for_later, added_at from moved
       on conflict (owner, product_id) do update set quantity = least(30, cart_items.quantity + excluded.quantity), saved_for_later = false`,
      [`u:${userId}`, `g:${guest}`],
    )
    jar.delete(GUEST)
  }
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(SESSION)?.value
  if (token) await query('delete from sessions where token_hash = $1', [sha256(token)])
  jar.delete(SESSION)
}

// Cart key for the current visitor. Pass create=true (Server Actions only) to mint a guest cookie on first add.
export async function cartOwner(create = false): Promise<string | null> {
  const user = await getUser()
  if (user) return `u:${user.id}`
  const jar = await cookies()
  let guest = jar.get(GUEST)?.value
  if (!guest && create) {
    guest = randomBytes(16).toString('base64url')
    jar.set(GUEST, guest, { ...cookieBase, maxAge: 60 * 60 * 24 * 90 })
  }
  return guest ? `g:${guest}` : null
}

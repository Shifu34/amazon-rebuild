'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { getUser, safeReturnTo } from '@/lib/auth'
import { one, query } from '@/lib/db'
import { validateCard, type CardErrors } from '@/lib/payments'

export type CardState = { id?: string; errors?: CardErrors; problem?: string } | null

// Validates the full number (Luhn, brand), expiry and CVV, then stores only brand, last 4, expiry and name.
export async function addCard(_prev: CardState, form: FormData): Promise<CardState> {
  const user = await getUser()
  if (!user) return { problem: 'Your session has ended. Please sign in again.' }
  const { input, errors } = validateCard(form)
  if (Object.keys(errors).length) return { errors }

  const dupe = await one('select 1 from payment_methods where user_id = $1 and brand = $2 and last4 = $3 and exp_month = $4 and exp_year = $5', [
    user.id, input.brand, input.last4, input.expMonth, input.expYear,
  ])
  if (dupe) return { errors: { number: 'This card is already in your wallet.' } }

  const row = await one<{ id: string }>(
    `with cleared as (update payment_methods set is_default = false where user_id = $1 and $7 and is_default)
     insert into payment_methods (user_id, brand, last4, exp_month, exp_year, name_on_card, is_default)
     values ($1, $2, $3, $4, $5, $6, $7 or not exists (select 1 from payment_methods where user_id = $1))
     returning id`,
    [user.id, input.brand, input.last4, input.expMonth, input.expYear, input.nameOnCard, input.makeDefault],
  )
  refresh()
  if (form.get('return_to')) redirect(safeReturnTo(form.get('return_to')))
  return { id: row?.id }
}

// removing the default promotes the newest remaining card that hasn't expired (same rule as isExpired, in UTC)
export async function removeCard(form: FormData) {
  const user = await getUser()
  if (!user) return
  const now = new Date()
  await query(
    `with gone as (delete from payment_methods where user_id = $1 and id::text = $2 returning is_default)
     update payment_methods set is_default = true
     where id = (select id from payment_methods where user_id = $1 and id::text <> $2 and exp_year * 12 + exp_month >= $3
                 order by created_at desc limit 1)
       and exists (select 1 from gone where is_default)`,
    [user.id, String(form.get('id') ?? ''), now.getUTCFullYear() * 12 + now.getUTCMonth() + 1],
  )
  refresh()
}

export async function setDefaultCard(form: FormData) {
  const user = await getUser()
  if (!user) return
  await query(
    'update payment_methods set is_default = (id::text = $2) where user_id = $1 and exists (select 1 from payment_methods where user_id = $1 and id::text = $2)',
    [user.id, String(form.get('id') ?? '')],
  )
  refresh()
}

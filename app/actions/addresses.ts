'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { validateAddress, type AddressErrors } from '@/lib/addresses'
import { getUser, safeReturnTo } from '@/lib/auth'
import { one, query } from '@/lib/db'

export type AddressState = { id?: string; errors?: AddressErrors; problem?: string } | null

const SIGNED_OUT = 'Your session has ended. Please sign in again.'

// Create (no `id`) or update (`id`) an address. Optional `return_to` redirects after saving; otherwise returns the id.
export async function saveAddress(_prev: AddressState, form: FormData): Promise<AddressState> {
  const user = await getUser()
  if (!user) return { problem: SIGNED_OUT }
  const { input, errors } = validateAddress(form)
  if (Object.keys(errors).length) return { errors }

  const id = String(form.get('id') ?? '')
  const params = [user.id, input.fullName, input.phone, input.line1, input.line2, input.city, input.state, input.zip, input.instructions, input.makeDefault]
  // one statement each, so there is never a moment with two defaults
  const row = id
    ? await one<{ id: string }>(
        `with cleared as (
           update addresses set is_default = false
           where user_id = $1 and $10 and is_default and id::text <> $11 and exists (select 1 from addresses where user_id = $1 and id::text = $11)
         )
         update addresses set full_name = $2, phone = $3, line1 = $4, line2 = $5, city = $6, state = $7, zip = $8, instructions = $9, is_default = is_default or $10
         where user_id = $1 and id::text = $11 returning id`,
        [...params, id],
      )
    : await one<{ id: string }>(
        `with cleared as (update addresses set is_default = false where user_id = $1 and $10 and is_default)
         insert into addresses (user_id, full_name, phone, line1, line2, city, state, zip, instructions, is_default)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10 or not exists (select 1 from addresses where user_id = $1))
         returning id`,
        params,
      )
  if (!row) return { problem: "We couldn't find that address. It may have been removed." }
  refresh()
  if (form.get('return_to')) redirect(safeReturnTo(form.get('return_to')))
  return { id: row.id }
}

// removing the default promotes the newest remaining address
export async function deleteAddress(form: FormData) {
  const user = await getUser()
  if (!user) return
  await query(
    `with gone as (delete from addresses where user_id = $1 and id::text = $2 returning is_default)
     update addresses set is_default = true
     where id = (select id from addresses where user_id = $1 and id::text <> $2 order by created_at desc limit 1)
       and exists (select 1 from gone where is_default)`,
    [user.id, String(form.get('id') ?? '')],
  )
  refresh()
}

export async function setDefaultAddress(form: FormData) {
  const user = await getUser()
  if (!user) return
  await query(
    'update addresses set is_default = (id::text = $2) where user_id = $1 and exists (select 1 from addresses where user_id = $1 and id::text = $2)',
    [user.id, String(form.get('id') ?? '')],
  )
  refresh()
}

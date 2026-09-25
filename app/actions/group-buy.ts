'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { fillGroup, joinGroup, leaveGroup } from '@/lib/group-buy'

// The product id is the only thing the client sends; the team price comes from the group row on the server.
const idOf = (form: FormData) => {
  const id = Number(form.get('productId'))
  return Number.isInteger(id) && id > 0 ? id : null
}

async function shopper(id: number) {
  const user = await getUser()
  if (!user) redirect(`/ap/signin?return_to=${encodeURIComponent(`/dp/${id}`)}`)
  return user
}

export async function join(form: FormData) {
  const id = idOf(form)
  if (!id) return
  await joinGroup((await shopper(id)).id, id)
  refresh()
}

export async function leave(form: FormData) {
  const id = idOf(form)
  if (!id) return
  await leaveGroup((await shopper(id)).id, id)
  refresh()
}

// Demo control, like "Demo: mark as delivered": a demo store has no crowd, so this commits the accounts that exist.
export async function demoFill(form: FormData) {
  const id = idOf(form)
  if (!id) return
  await shopper(id)
  await fillGroup(id)
  refresh()
}

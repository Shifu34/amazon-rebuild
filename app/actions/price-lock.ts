'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { dropPrice, lockPrice, releaseLock } from '@/lib/price-lock'

// The product id is the only thing the client sends; every amount is computed on the server from the catalog.
const idOf = (form: FormData) => {
  const id = Number(form.get('productId'))
  return Number.isInteger(id) && id > 0 ? id : null
}

async function shopper(id: number) {
  const user = await getUser()
  if (!user) redirect(`/ap/signin?return_to=${encodeURIComponent(`/dp/${id}`)}`)
  return user
}

export async function lock(form: FormData) {
  const id = idOf(form)
  if (!id) return
  await lockPrice((await shopper(id)).id, id)
  refresh()
}

export async function unlock(form: FormData) {
  const id = idOf(form)
  if (!id) return
  await releaseLock((await shopper(id)).id, id)
  refresh()
}

// Demo control, like "Demo: mark as delivered": the catalog never moves, so this moves it for one shopper.
export async function demoDrop(form: FormData) {
  const id = idOf(form)
  if (!id) return
  await dropPrice((await shopper(id)).id, id)
  refresh()
}

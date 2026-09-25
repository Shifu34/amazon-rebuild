'use server'

import { refresh } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { confirmOrder, refuseOrder } from '@/lib/cod'

const orderIdFrom = (form: FormData) => String(form.get('orderId') ?? '').slice(0, 40)

// "Confirm this order": a cash order waits for this before it ships. Scoped to the signed-in shopper in SQL.
export async function confirmCodOrder(form: FormData) {
  const id = orderIdFrom(form)
  const user = await requireUser(`/orders/${encodeURIComponent(id)}`)
  await confirmOrder(user.id, id)
  refresh()
}

// Demo control: the shopper turned the courier away. Nothing is charged and their cash standing changes.
export async function demoRefuseDelivery(form: FormData) {
  const id = orderIdFrom(form)
  const user = await requireUser(`/orders/${encodeURIComponent(id)}`)
  await refuseOrder(user.id, id)
  refresh()
}

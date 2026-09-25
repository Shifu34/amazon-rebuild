'use server'

import { refresh } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { siteOrigin } from '@/lib/email'
import { cancelReminder, demoDueNow, isConsumable, sendDueReminders, setReminder, WEEK_CHOICES } from '@/lib/reminders'

// "Remind me when this runs out" on a delivered order, and Change on Your Account. Every write is scoped to the
// signed-in shopper in SQL.
export async function saveReminder(form: FormData) {
  const productId = Number(form.get('productId'))
  const weeks = Number(form.get('weeks'))
  const user = await requireUser('/account')
  if (!isConsumable(productId) || !WEEK_CHOICES.includes(weeks)) return
  const orderId = String(form.get('orderId') ?? '').slice(0, 40) || null
  await setReminder(user.id, productId, weeks, orderId)
  refresh()
}

export async function dropReminder(form: FormData) {
  const user = await requireUser('/account')
  await cancelReminder(user.id, String(form.get('id') ?? '').slice(0, 40))
  refresh()
}

// Demo control: nobody waits three weeks in a walkthrough. Only this shopper's own reminders move.
export async function demoSendReminders() {
  const user = await requireUser('/account')
  const origin = await siteOrigin() // request headers are readable here, not inside the send loop
  await demoDueNow(user.id)
  await sendDueReminders(origin, user.id)
  refresh()
}

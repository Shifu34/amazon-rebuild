'use server'

import { refresh } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isNileDay } from '@/lib/delivery'
import { setNileDay } from '@/lib/nile-day'

// Your nile day, set from Your Account or from the delivery options at checkout. An empty (or unknown) day turns it off,
// so the next order ships as soon as it is ready.
export async function saveNileDay(form: FormData) {
  const user = await requireUser('/account')
  // an empty value is "turn it off"; Number('') is 0, which is a perfectly good Sunday, so check the string first
  const raw = form.get('day')
  const day = typeof raw === 'string' && raw !== '' ? Number(raw) : NaN
  await setNileDay(user.id, isNileDay(day) ? day : null)
  refresh()
}

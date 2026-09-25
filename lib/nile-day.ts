// Your nile day: the weekday a shopper pools their week's orders onto (the day maths is in lib/delivery.ts, which client
// components can import). One van trip instead of four is the cheapest delivery we can make, so the shipping it saves is
// credited back on the pooled order. Nothing is pooled without the shopper choosing the day.
import { isNileDay } from './delivery'
import { one, query } from './db'

// null: ship as ordered
export async function getNileDay(userId: string) {
  const row = await one<{ delivery_day: number | null }>('select delivery_day from users where id = $1', [userId])
  return isNileDay(row?.delivery_day) ? row.delivery_day : null
}

export async function setNileDay(userId: string, day: number | null) {
  await query('update users set delivery_day = $2 where id = $1', [userId, isNileDay(day) ? day : null])
}

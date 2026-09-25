// Cash on delivery, with reliability that is personal rather than blanket. COD is what most shoppers here trust, and it
// is where the money leaks: a refused parcel ships back at our cost. So take delivery of what you order and cash stays
// free and unlimited; refuse one and we ask for part of it up front until the next parcel is taken.
import { query } from './db'
import { ensureSchema } from './orders' // the cash columns ride on the same lazy migration list

export const ADVANCE_RATE = 0.3

export type CodStanding = {
  taken: number // cash parcels delivered
  refused: number // cash parcels sent back
  advanceRate: number // 0 while in good standing
  headline: string
  detail: string
}

// what we take up front on a cash order, in US cents
export const advanceCents = (totalCents: number, rate: number) => Math.round(totalCents * rate)

// The shopper's own history decides: one refusal is enough to ask for an advance, and the next parcel taken clears it.
// ponytail: last-refusal-wins, not a score; a real one would weigh value and recency.
export async function codStanding(userId: string): Promise<CodStanding> {
  await ensureSchema()
  const [row] = await query<{ taken: number; refused: number; owing: number }>(
    `select
       count(*) filter (where refused_at is null and cancelled_at is null and deliver_by <= now()) as taken,
       count(*) filter (where refused_at is not null) as refused,
       count(*) filter (where refused_at is not null
         and not exists (select 1 from orders later
           where later.user_id = o.user_id and later.payment_kind = 'cod' and later.refused_at is null
             and later.cancelled_at is null and later.deliver_by <= now() and later.placed_at > o.placed_at)) as owing
     from orders o where o.user_id = $1 and o.payment_kind = 'cod'`,
    [userId],
  )
  const taken = Number(row?.taken ?? 0)
  const refused = Number(row?.refused ?? 0)
  const advanceRate = Number(row?.owing ?? 0) > 0 ? ADVANCE_RATE : 0
  const parcels = (n: number) => `${n} ${n === 1 ? 'parcel' : 'parcels'}`
  return {
    taken,
    refused,
    advanceRate,
    headline: advanceRate ? `Cash on delivery: ${Math.round(advanceRate * 100)}% up front` : 'Cash on delivery: open',
    detail: advanceRate
      ? `${refused === 1 ? 'A parcel was' : `${parcels(refused)} were`} refused, so we ask for ${Math.round(advanceRate * 100)}% up front on cash orders. Take your next delivery and it goes back to nothing.`
      : taken
        ? `You've taken ${parcels(taken)} paid in cash, so cash orders need nothing up front.`
        : 'Pay the courier when it arrives. Nothing up front.',
  }
}

// A cash order ships once the shopper confirms it: the cheap step that stops most refusals. Their own order only.
export async function confirmOrder(userId: string, orderId: string) {
  await ensureSchema()
  const rows = await query(
    `update orders set confirmed_at = now()
     where id = $1 and user_id = $2 and payment_kind = 'cod' and confirmed_at is null and cancelled_at is null returning id`,
    [orderId, userId],
  )
  return rows.length > 0
}

// Demo control: the parcel came back. Nothing was charged, so the order is cancelled and the refusal counts against
// their standing. Only an undelivered cash order of this user's.
export async function refuseOrder(userId: string, orderId: string) {
  await ensureSchema()
  const rows = await query(
    `update orders set refused_at = now(), cancelled_at = now()
     where id = $1 and user_id = $2 and payment_kind = 'cod' and refused_at is null and cancelled_at is null returning id`,
    [orderId, userId],
  )
  return rows.length > 0
}

// Restock reminders: one email when a consumable is likely to run out, then the row is closed. Never a subscription,
// never a charge — the shopper reorders (or doesn't) from the email. One row per shopper and product (db/schema.sql),
// replaced when they set it again; `sent_at` closes it and `cancelled_at` records a stop.
import { getProduct, type Product } from './catalog'
import { one, query } from './db'
import { sendEmail } from './email'
import { restockEmail } from './email-templates'

// Categories you use up and re-buy, with how long a pack typically lasts. A watch or a laptop never gets a nudge.
const WEEKS: Record<string, number> = { groceries: 3, beauty: 8, 'skin-care': 6, fragrances: 12 }
export const WEEK_CHOICES = [3, 4, 6, 8, 12]
export const MAX_SEND = 200 // one run's ceiling, so a backlog can't blow the send caps in lib/email.ts

export const reminderWeeks = (category: string) => (Object.hasOwn(WEEKS, category) ? WEEKS[category] : 0)
export const isConsumable = (productId: number) => reminderWeeks(getProduct(productId)?.category ?? '') > 0

export type Reminder = { id: string; product: Product; dueAt: Date; weeks: number }

// ponytail: the dev server applies db/schema.sql only when it first connects, and production runs db:migrate by hand,
// so create this slice's table once per process; drop it once every environment has run the current schema.
let ready: Promise<unknown> | undefined
const ensureSchema = () =>
  (ready ??= query(`create table if not exists reminders (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      product_id int not null,
      order_id text references orders(id) on delete set null,
      due_at timestamptz not null,
      created_at timestamptz not null default now(),
      sent_at timestamptz,
      cancelled_at timestamptz
    )`)
    .then(() => query('create unique index if not exists reminders_user_product on reminders (user_id, product_id)'))
    .catch((e) => {
      ready = undefined
      throw e
    }))

const WEEK = 7 * 86_400_000
const weeksBetween = (dueAt: Date) => Math.max(1, Math.round((dueAt.getTime() - Date.now()) / WEEK))

// Active reminders (not sent, not cancelled), soonest first. Rows whose product left the catalog are dropped.
export async function getReminders(userId: string): Promise<Reminder[]> {
  await ensureSchema()
  const rows = await query<{ id: string; product_id: number; due_at: Date }>(
    'select id, product_id, due_at from reminders where user_id = $1 and sent_at is null and cancelled_at is null order by due_at',
    [userId],
  )
  return rows.flatMap((r) => {
    const product = getProduct(r.product_id)
    const dueAt = new Date(r.due_at)
    return product ? [{ id: r.id, product, dueAt, weeks: weeksBetween(dueAt) }] : []
  })
}

// Set or move a reminder. One statement: the unique index makes "set it again" an update, which also revives a row the
// shopper cancelled or one we already sent.
export async function setReminder(userId: string, productId: number, weeks: number, orderId: string | null) {
  await ensureSchema()
  await query(
    `insert into reminders (user_id, product_id, order_id, due_at)
     values ($1, $2, $3, now() + ($4 || ' weeks')::interval)
     on conflict (user_id, product_id)
     do update set due_at = excluded.due_at, order_id = excluded.order_id, created_at = now(), sent_at = null, cancelled_at = null`,
    [userId, productId, orderId, String(weeks)],
  )
}

// Owner only. Returns what was stopped, so the email's link can say which product.
export async function cancelReminder(userId: string, id: string) {
  await ensureSchema()
  return one<{ product_id: number }>(
    "update reminders set cancelled_at = now() where id::text = $2 and user_id = $1 and cancelled_at is null returning product_id",
    [userId, id],
  )
}

// The email's one-click stop: the row id is the token, so it works without signing in.
export async function stopByToken(id: string) {
  await ensureSchema()
  return one<{ product_id: number }>(
    "update reminders set cancelled_at = now() where id::text = $1 and cancelled_at is null returning product_id",
    [id],
  )
}

// Demo control: bring this shopper's pending reminders forward so a walkthrough doesn't wait three weeks.
export async function demoDueNow(userId: string) {
  await ensureSchema()
  const rows = await query<{ id: string }>(
    'update reminders set due_at = now() where user_id = $1 and sent_at is null and cancelled_at is null returning id',
    [userId],
  )
  return rows.length
}

type Due = { id: string; product_id: number; name: string; email: string; user_id: string }

// Sends every reminder that has come due and closes each row as it goes, so a repeat call (cron retry, demo button
// pressed twice) never sends twice. `userId` scopes it to one shopper for the demo control.
export async function sendDueReminders(origin: string, userId?: string) {
  await ensureSchema()
  const rows = await query<Due>(
    `select r.id, r.product_id, r.user_id, u.name, u.email
     from reminders r join users u on u.id = r.user_id
     where r.sent_at is null and r.cancelled_at is null and r.due_at <= now() ${userId ? 'and r.user_id = $2' : ''}
     order by r.due_at limit $1`,
    userId ? [MAX_SEND, userId] : [MAX_SEND],
  )
  let sent = 0
  for (const r of rows) {
    const product = getProduct(r.product_id)
    // claim the row first: sendEmail never throws, but a crash mid-run must not re-send on the next call
    const claimed = await one<{ id: string }>('update reminders set sent_at = now() where id = $1 and sent_at is null returning id', [r.id])
    if (!claimed || !product) continue
    const mail = restockEmail({ product, name: r.name, origin, stopUrl: `${origin}/api/reminders/stop?id=${r.id}` })
    await sendEmail({ ...mail, to: r.email, kind: 'restock', userId: r.user_id })
    sent++
  }
  return sent
}

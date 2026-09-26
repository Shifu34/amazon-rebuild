import { dropReminder, saveReminder } from '@/app/actions/reminders'
import { fullDate } from '@/lib/format'
import type { Reminder } from '@/lib/reminders'
import { WEEK_CHOICES } from '@/lib/reminders'

const small = 'btn min-h-8 px-3 text-xs'
const NO_LOCK_IN = "We'll email you once. No subscription, no card charged."

function Weeks({ name = 'weeks', value }: { name?: string; value: number }) {
  return (
    <select name={name} defaultValue={value} aria-label="Remind me in" className="select-pill">
      {WEEK_CHOICES.map((w) => (
        <option key={w} value={w}>in {w} weeks</option>
      ))}
    </select>
  )
}

// On a delivered consumable: set the nudge, or show and change the one that's set. `weeks` is the category's default.
export function RestockReminder({ productId, orderId, weeks, reminder }: { productId: number; orderId: string; weeks: number; reminder?: Reminder }) {
  return (
    <div className="mt-3 rounded-[10px] bg-page p-4 text-xs">
      {reminder ? (
        <>
          <p className="text-sm">Reminder set for <b className="font-medium">{fullDate(reminder.dueAt)}</b></p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <form action={saveReminder} className="flex items-center gap-2">
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="orderId" value={orderId} />
              <Weeks value={reminder.weeks} />
              <button type="submit" className={`${small} btn-plain`}>Change</button>
            </form>
            <form action={dropReminder}>
              <input type="hidden" name="id" value={reminder.id} />
              <button type="submit" className={`${small} btn-plain`}>Cancel reminder</button>
            </form>
          </div>
        </>
      ) : (
        <form action={saveReminder} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="orderId" value={orderId} />
          <span className="text-sm">Remind me when this runs out</span>
          <Weeks value={weeks} />
          <button type="submit" className={`${small} btn-plain`}>Remind me</button>
        </form>
      )}
      <p className="mt-2 text-muted">{NO_LOCK_IN}</p>
    </div>
  )
}

// Your Account: everything the shopper has set, with the demo control that brings them due now.
export function ReminderList({ reminders, demo }: { reminders: Reminder[]; demo: React.ReactNode }) {
  return (
    <section aria-labelledby="reminders-heading">
      <h2 id="reminders-heading" className="text-lg">Restock reminders</h2>
      <p className="mt-1 max-w-[70ch] text-sm text-muted">{NO_LOCK_IN} Set one from a delivered order.</p>
      {reminders.length === 0 ? (
        <p className="mt-4 text-sm text-muted">You have no reminders set.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {reminders.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0 text-sm">
                <p className="line-clamp-2">{r.product.title}</p>
                <p className="price text-xs text-muted">Due {fullDate(r.dueAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <form action={saveReminder} className="flex items-center gap-2">
                  <input type="hidden" name="productId" value={r.product.id} />
                  <Weeks value={r.weeks} />
                  <button type="submit" className={`${small} btn-plain`}>Change</button>
                </form>
                <form action={dropReminder}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className={`${small} btn-plain`}>Cancel</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {reminders.length > 0 && demo}
    </section>
  )
}

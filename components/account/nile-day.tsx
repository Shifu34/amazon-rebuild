import { saveNileDay } from '@/app/actions/nile-day'
import { DAY_NAMES, DEFAULT_DAY } from '@/lib/delivery'

// Your nile day on Your Account: the same one bit checkout sets. Plain forms, so it works without JavaScript.
export function NileDay({ day }: { day: number | null }) {
  return (
    <section aria-labelledby="nile-day">
      <h2 id="nile-day" className="text-lg">Your nile day</h2>
      <p className="mt-1 max-w-[70ch] text-sm text-muted">
        Pick one day a week and we&apos;ll bring the week&apos;s orders together: fewer vans, fewer boxes, and the shipping we save
        comes back to you as a credit. Anything urgent can still go Expedited at checkout.
      </p>
      <form action={saveNileDay} className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="nile-day-select" className="text-sm">Deliver my week on</label>
        {/* keyed by the saved day: an uncontrolled select keeps its own value, so it would drift after a change */}
        <select key={day} id="nile-day-select" name="day" defaultValue={day ?? DEFAULT_DAY} className="select-pill">
          {DAY_NAMES.map((name, i) => (
            <option key={name} value={i}>{name}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-plain">{day === null ? 'Turn on' : 'Change day'}</button>
      </form>
      {day !== null && (
        <form action={saveNileDay} className="mt-3">
          <input type="hidden" name="day" value="" />
          <p className="text-sm text-muted">
            On: your orders arrive on <b className="font-medium text-ink">{DAY_NAMES[day]}</b>.{' '}
            <button type="submit" className="link cursor-pointer">Turn off</button>
          </p>
        </form>
      )}
    </section>
  )
}

const LABELS = ['Ordered', 'Shipped', 'Out for delivery', 'Delivered']
const GREEN = 'bg-[#0b7b3c]'

// Ordered → Shipped → Out for delivery → Delivered. `step` is the last reached step (0-3); `notes` sit under each label.
// The large variant (Track package) turns into a vertical stepper on phones.
export function Progress({ step, notes, large = false }: { step: number; notes?: string[]; large?: boolean }) {
  const sr = (i: number) => (i < step ? ', completed' : i === step ? ', current step' : ', not yet')
  const dot = (i: number, size: string) =>
    `relative z-10 shrink-0 rounded-full ${size} ${i <= step ? GREEN : 'border-2 border-[#d5d9d9] bg-white'} ${i === step ? 'ring-4 ring-[#0b7b3c]/25' : ''}`

  const horizontal = (
    <ol aria-label="Shipment progress" className={`${large ? 'hidden sm:grid' : 'grid'} grid-cols-4`}>
      {LABELS.map((label, i) => (
        <li key={label} className="relative flex flex-col items-center px-1 text-center">
          {i > 0 && <span aria-hidden className={`absolute right-1/2 h-1 w-full ${large ? 'top-[7px]' : 'top-1'} ${i <= step ? GREEN : 'bg-[#d5d9d9]'}`} />}
          <span aria-hidden className={dot(i, large ? 'size-[18px]' : 'size-3')} />
          <span className={`mt-1.5 ${large ? 'text-sm font-bold' : 'text-xs leading-4'}`}>
            {label}
            <span className="sr-only">{sr(i)}</span>
          </span>
          {notes?.[i] && <span className="text-xs text-muted">{notes[i]}</span>}
        </li>
      ))}
    </ol>
  )
  if (!large) return horizontal

  return (
    <>
      {horizontal}
      <ol aria-label="Shipment progress" className="sm:hidden">
        {LABELS.map((label, i) => (
          <li key={label} className="relative flex gap-3 pb-5 last:pb-0">
            {i < LABELS.length - 1 && <span aria-hidden className={`absolute top-[18px] left-[7px] h-full w-1 ${i < step ? GREEN : 'bg-[#d5d9d9]'}`} />}
            <span aria-hidden className={dot(i, 'size-[18px]')} />
            <span className="text-sm">
              <b>{label}</b>
              <span className="sr-only">{sr(i)}</span>
              {notes?.[i] && <span className="block text-xs text-muted">{notes[i]}</span>}
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

const LABELS = ['Ordered', 'Shipped', 'Out for delivery', 'Delivered']

// Ordered → Shipped → Out for delivery → Delivered. `step` is the last reached step (0-3); `notes` sit under each label.
// The large variant (Track package) turns into a vertical stepper on phones.
// Reached steps take the accent, the rest stay a hairline: the line itself says where you are (docs/design.md).
export function Progress({ step, notes, large = false }: { step: number; notes?: string[]; large?: boolean }) {
  const sr = (i: number) => (i < step ? ', completed' : i === step ? ', current step' : ', not yet')
  const dot = (i: number, size: string) =>
    `relative z-10 shrink-0 rounded-full ${size} ${i <= step ? 'bg-accent' : 'border border-line bg-surface'} ${i === step ? 'ring-4 ring-accent/15' : ''}`

  const horizontal = (
    <ol aria-label="Shipment progress" className={`${large ? 'hidden sm:grid' : 'grid'} grid-cols-4`}>
      {LABELS.map((label, i) => (
        <li key={label} className="relative flex flex-col items-center px-1 text-center">
          {i > 0 && <span aria-hidden className={`absolute right-1/2 h-0.5 w-full ${large ? 'top-[8px]' : 'top-[5px]'} ${i <= step ? 'bg-accent' : 'bg-line'}`} />}
          <span aria-hidden className={dot(i, large ? 'size-[18px]' : 'size-3')} />
          <span className={`mt-2 ${large ? 'text-sm font-medium' : 'text-xs leading-4'} ${i <= step ? '' : 'text-muted'}`}>
            {label}
            <span className="sr-only">{sr(i)}</span>
          </span>
          {notes?.[i] && <span className="price text-xs text-muted">{notes[i]}</span>}
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
          <li key={label} className="relative flex gap-3 pb-6 last:pb-0">
            {i < LABELS.length - 1 && <span aria-hidden className={`absolute top-[18px] left-[8px] h-full w-0.5 ${i < step ? 'bg-accent' : 'bg-line'}`} />}
            <span aria-hidden className={dot(i, 'size-[18px]')} />
            <span className={`text-sm ${i <= step ? '' : 'text-muted'}`}>
              <span className="font-medium">{label}</span>
              <span className="sr-only">{sr(i)}</span>
              {notes?.[i] && <span className="price block text-xs text-muted">{notes[i]}</span>}
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}

const bar = 'rounded bg-[#f0f2f2]'

// Skeleton in the results page's own geometry, so nothing jumps when results paint
export default function Loading() {
  return (
    <div aria-busy="true" className="animate-pulse pb-10 motion-reduce:animate-none">
      <p role="status" className="sr-only">Loading results…</p>
      <div className="border-b border-line">
        <div className="mx-auto flex h-[45px] max-w-[1500px] items-center justify-between px-4">
          <div className={`h-4 w-56 ${bar}`} />
          <div className={`h-7 w-40 ${bar}`} />
        </div>
      </div>
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 pt-4">
        <div className="hidden w-60 shrink-0 space-y-3 lg:block">
          {[70, 55, 80, 45, 60, 75, 50, 65, 40, 70].map((w, i) => (
            <div key={i} className={`h-4 ${bar}`} style={{ width: `${w}%` }} />
          ))}
        </div>
        <ul className="grid flex-1 grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <div className="aspect-square rounded-lg bg-[#f0f2f2]" />
              <div className={`mt-3 h-4 ${bar}`} />
              <div className={`mt-2 h-4 w-3/4 ${bar}`} />
              <div className={`mt-3 h-7 w-2/5 ${bar}`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

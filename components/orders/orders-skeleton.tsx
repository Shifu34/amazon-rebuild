const bar = 'rounded bg-page'

// Your Orders placeholder while orders load; the list page's own Suspense fallback (not loading.tsx, so the sign-in gate redirects before streaming)
export function OrdersSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1120px] animate-pulse px-4 py-10 motion-reduce:animate-none">
      <p role="status" className="sr-only">Loading your orders…</p>
      <div className={`h-3 w-40 ${bar}`} />
      <div className={`mt-3 h-8 w-48 ${bar}`} />
      <div className={`mt-5 h-6 w-full max-w-md ${bar}`} />
      {[0, 1].map((i) => (
        <div key={i} className="card mt-6 overflow-hidden">
          <div className="h-14 border-b border-line bg-surface" />
          <div className="flex gap-4 p-5">
            <div className={`size-[90px] shrink-0 ${bar}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-5 w-1/3 ${bar}`} />
              <div className={`h-4 w-2/3 ${bar}`} />
              <div className={`h-7 w-40 ${bar}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const bar = 'rounded bg-[#f0f2f2]'

// Your Orders placeholder while orders load; the list page's own Suspense fallback (not loading.tsx, so the sign-in gate redirects before streaming)
export function OrdersSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[980px] animate-pulse px-4 py-4 motion-reduce:animate-none">
      <p role="status" className="sr-only">Loading your orders…</p>
      <div className={`h-3 w-40 ${bar}`} />
      <div className={`mt-3 h-8 w-48 ${bar}`} />
      <div className={`mt-5 h-6 w-full max-w-md ${bar}`} />
      {[0, 1].map((i) => (
        <div key={i} className="mt-4 overflow-hidden rounded-lg border border-line">
          <div className="h-14 bg-[#f0f2f2]" />
          <div className="flex gap-3 p-4">
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

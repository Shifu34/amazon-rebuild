'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// A signed-in page brought back by the Back button (HTTP cache or bfcache) re-renders from the server, so after
// Sign Out it goes to sign-in instead of showing the last shopper's data. Production responses are already no-store;
// dev (no-cache) and bfcache restores are not covered by that.
export function FreshOnBack() {
  const router = useRouter()
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type === 'back_forward' && nav.name === location.href) router.refresh()
    const onShow = (e: PageTransitionEvent) => e.persisted && router.refresh()
    addEventListener('pageshow', onShow)
    return () => removeEventListener('pageshow', onShow)
  }, [router])
  return null
}

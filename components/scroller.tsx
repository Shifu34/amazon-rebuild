'use client'

import { useRef } from 'react'
import { ChevronIcon } from './icons'

// Horizontal row with Amazon's tall arrow buttons on desktop; touch devices just swipe.
export function Scroller({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null)
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' })
  const arrow = 'absolute top-1/2 z-10 hidden h-24 w-11 -translate-y-1/2 cursor-pointer items-center justify-center bg-white/95 shadow-[0_1px_3px_rgba(15,17,17,0.3)] opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 md:flex'
  return (
    <div className="group relative">
      <ul ref={ref} className="relative flex snap-x gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">{children}</ul>
      <button type="button" onClick={() => page(-1)} aria-label={`Previous items: ${label}`} className={`${arrow} left-0 rounded-r-md`}>
        <ChevronIcon className="size-6 rotate-180" />
      </button>
      <button type="button" onClick={() => page(1)} aria-label={`Next items: ${label}`} className={`${arrow} right-0 rounded-l-md`}>
        <ChevronIcon className="size-6" />
      </button>
    </div>
  )
}

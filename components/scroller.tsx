'use client'

import { useEffect, useRef } from 'react'
import { ChevronIcon } from './icons'

// Horizontal row with quiet round arrows on desktop, matching the department reels (docs/design.md); the row keeps a gutter
// under each arrow so no card is ever covered. Touch devices swipe.
export function Scroller({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null)

  // Cards past the right edge are lazy images, which the browser only fetches once scrolled to, so they popped in while
  // scrolling. When the row comes within reach of the screen, fetch the whole row so every card is ready before a scroll.
  useEffect(() => {
    const list = ref.current
    if (!list) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        list.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
          img.loading = 'eager'
        })
        observer.disconnect()
      },
      { rootMargin: '800px 0px' },
    )
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' })
  const arrow =
    'absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[0_2px_8px_rgba(25,23,19,0.08)] hover:bg-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:flex'
  return (
    <div className="relative">
      <ul ref={ref} className="relative flex snap-x gap-5 overflow-x-auto pb-3 [scrollbar-width:thin] md:scroll-px-12 md:px-12">{children}</ul>
      <button type="button" onClick={() => page(-1)} aria-label={`Previous items: ${label}`} className={`${arrow} -left-1`}>
        <ChevronIcon className="size-5 rotate-180" />
      </button>
      <button type="button" onClick={() => page(1)} aria-label={`Next items: ${label}`} className={`${arrow} -right-1`}>
        <ChevronIcon className="size-5" />
      </button>
    </div>
  )
}

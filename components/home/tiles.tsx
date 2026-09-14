'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ChevronIcon } from '@/components/icons'

export type PictureTile = { title: string; subtitle?: string; href: string; bg: string; images: string[] }

// The tall picture tiles across the top of the home page. Scrolling is native (snap points, swipe, shift+wheel, and focus
// scrolls a tile into view); the arrows page the row on pointer devices, and each hides at its end of the row.
// The tiles are above the fold, so their images load eagerly.
export function PictureTiles({ tiles }: { tiles: PictureTile[] }) {
  const ref = useRef<HTMLUListElement>(null)
  const [at, setAt] = useState({ start: true, end: false })
  const update = () => {
    const el = ref.current
    if (el) setAt({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }
  // snap-mandatory settles the scroll on the nearest tile start, so the next page opens on a whole tile
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9 })
  const arrow =
    'absolute top-1/2 z-10 hidden h-[100px] w-[50px] -translate-y-1/2 cursor-pointer items-center justify-center border-line bg-white shadow-[0_1px_4px_rgba(15,17,17,0.2)] hover:bg-[#f7fafa] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink md:flex [&_path]:[stroke-width:1.5]'

  return (
    <div className="relative">
      <ul ref={ref} onScroll={update} aria-label="Shop by department" className="flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 [scrollbar-width:none] motion-safe:scroll-smooth">
        {tiles.map(({ title, subtitle, href, bg, images: [main, left, right] }, i) => (
          <li key={href} className="w-[min(285px,64vw)] shrink-0 snap-start">
            <Link
              href={href}
              style={{ backgroundColor: bg }}
              className="flex aspect-[285/455] flex-col overflow-hidden rounded-xl px-3 pt-4 text-ink focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ink"
            >
              <span className="font-display text-[29px] leading-8 font-extrabold">{title}</span>
              {subtitle && <span className="mt-1 text-lg leading-6">{subtitle}</span>}
              {/* product shots on white multiply into the tile colour; the big one sits behind the two smaller ones */}
              <span aria-hidden className="relative -mx-3 mt-2 flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={main} alt="" fetchPriority={i === 0 ? 'high' : undefined} className="absolute bottom-[15%] left-1/2 w-full max-w-none -translate-x-1/2 mix-blend-multiply" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {left && <img src={left} alt="" className="absolute -bottom-[3%] -left-[5%] w-[54%] mix-blend-multiply" />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {right && <img src={right} alt="" className="absolute -right-[5%] -bottom-[1%] w-[52%] mix-blend-multiply" />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" hidden={at.start} onClick={() => page(-1)} aria-label="Scroll departments left" className={`${arrow} left-0 rounded-r-lg border border-l-0`}>
        <ChevronIcon className="size-9 rotate-180" />
      </button>
      <button type="button" hidden={at.end} onClick={() => page(1)} aria-label="Scroll departments right" className={`${arrow} right-0 rounded-l-lg border border-r-0`}>
        <ChevronIcon className="size-9" />
      </button>
    </div>
  )
}

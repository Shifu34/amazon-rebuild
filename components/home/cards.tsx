import Link from 'next/link'
import { ChevronIcon } from '@/components/icons'

export type Tile = { label: string; href: string; image: string }
export type Card = { title: string; href: string; tiles: Tile[] }

const focus = 'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// Amazon's bordered home card: a heavy headline linking to the whole collection over a 2x2 grid of picture links.
// Cards in a grid row stretch to the tallest one and the picture rows share the extra height, so captions line up.
export function QuadCard({ title, href, tiles, tint, eager = false }: Card & { tint: string; eager?: boolean }) {
  return (
    // Amazon's cards keep one height (370x526 at 1536px) whatever the title length; a short title leaves the picture rows more room
    <div className="flex aspect-[370/526] flex-col self-stretch rounded-lg border border-line bg-white p-3 pt-4">
      <h2 className="font-display text-[22px] leading-6 font-black tracking-[-0.01em]">
        <Link href={href} className={`group flex items-start justify-between gap-4 ${focus}`}>
          <span className="group-hover:underline">{title}</span>
          <ChevronIcon className="-mt-0.5 -mr-1 size-7 shrink-0 [&_path]:[stroke-width:1.5]" />
        </Link>
      </h2>
      <ul className="mt-[11px] grid flex-1 grid-cols-2 gap-2">
        {tiles.map((t) => (
          <li key={t.href + t.label}>
            <Link href={t.href} className={`group block ${focus}`}>
              <span className="flex aspect-square items-center justify-center overflow-hidden rounded p-0.5" style={{ backgroundColor: tint }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image} alt="" loading={eager ? 'eager' : 'lazy'} className="max-h-full max-w-full object-contain mix-blend-multiply" />
              </span>
              <span className="mt-[5px] line-clamp-2 h-10 text-sm leading-5 group-hover:underline">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

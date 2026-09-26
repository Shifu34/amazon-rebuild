import Image from 'next/image'
import Link from 'next/link'
import { dataSaver } from '@/app/actions/data-saver'
import { shot } from '@/components/product-card'

export type Tile = { label: string; href: string; image: string }
export type Card = { title: string; href: string; tiles: Tile[] }

const focus = 'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// A collection: a serif heading over four pictures of what is inside it (docs/design.md). No border and no fixed height —
// the heading and the whitespace do the separating, so a page of these reads as a catalogue rather than a wall of boxes.
export async function QuadCard({ title, href, tiles, eager = false }: Card & { eager?: boolean }) {
  const saver = await dataSaver()
  return (
    <div className="flex flex-col">
      {/* two lines of room at desktop widths, so a long title never pushes its pictures out of line with the row */}
      <h2 className="font-display text-xl leading-7 sm:min-h-14">
        <Link href={href} className={`group inline-flex items-baseline gap-1.5 ${focus}`}>
          <span className="group-hover:underline">{title}</span>
          <span aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5">›</span>
        </Link>
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <li key={t.href + t.label}>
            <Link href={t.href} prefetch={saver ? false : undefined} className={`group block ${focus}`}>
              <span className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-page p-3">
                {saver ? (
                  <Image src={t.image} alt="" width={220} height={220} quality={40} loading={eager ? 'eager' : 'lazy'} className={shot} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt="" loading={eager ? 'eager' : 'lazy'} className={shot} />
                )}
              </span>
              <span className="mt-2 block truncate text-[13px] text-muted group-hover:text-ink">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

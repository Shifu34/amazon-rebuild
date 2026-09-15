'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronIcon } from '@/components/icons'

// `shots`: each product's angle photos, played in order as the tile's reel
export type PictureTile = { title: string; subtitle?: string; href: string; bg: string; shots: string[][] }

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
        {tiles.map((tile, i) => (
          <Tile key={tile.href} tile={tile} first={i === 0} />
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

const FRAME = 1100 // ms each photo holds
const FADE = 400
const ZOOM = 1.06

type Playback = 'idle' | 'playing' | 'paused' | 'ended'

// Amazon's tiles are short videos that end on a replay button. The catalog has photos, not footage, so the reel plays one
// photo at a time: each product's angles crossfade while the product slowly zooms in. It plays only while the mouse is over
// the tile and pauses when it leaves; keyboard and touch use the Play button. Only the previous (fading out), current and
// next (preloading) photos are mounted.
function Tile({ tile: { title, subtitle, href, bg, shots }, first }: { tile: PictureTile; first: boolean }) {
  const frames = shots.flatMap((s, g) => s.map((src, k) => ({ src, k, len: s.length, g })))
  const [state, setState] = useState<Playback>('idle')
  const [cur, setCur] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const area = useRef<HTMLSpanElement>(null)
  const next = (cur + 1) % frames.length

  useEffect(() => {
    if (state !== 'playing') return
    const t = setTimeout(() => {
      setPrev(cur)
      setCur(next)
      if (next === 0) setState('ended') // rest on the first photo
    }, FRAME)
    return () => clearTimeout(t)
  }, [state, cur, next])

  // pausing freezes the zoom (a CSS transition) where it is; crossfades already under way finish
  const zooms = () => area.current?.getAnimations({ subtree: true }).filter((a) => a instanceof CSSTransition && a.transitionProperty === 'transform') ?? []
  const pause = () => {
    zooms().forEach((a) => a.pause())
    setState('paused')
  }
  const play = () => {
    zooms().forEach((a) => a.play())
    setState('playing') // from 'ended' this replays from the first photo
  }
  // a mouse over the tile plays it, never with reduced motion; touch "hover" is a tap, which follows the link instead
  const hover = (e: React.PointerEvent, on: boolean) => {
    if (e.pointerType === 'touch' || frames.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (on && state !== 'playing') play()
    else if (!on && state === 'playing') pause()
  }
  const verb = state === 'playing' ? 'Pause' : state === 'ended' ? 'Replay' : 'Play'

  // a product's zoom runs across all its angles: each photo starts at the scale the previous one had reached
  const scaleAt = (k: number, len: number) => 1 + ((ZOOM - 1) * k * FRAME) / (len * FRAME + FADE)
  // the outgoing photo fades out before the next one fades in, so two products never show at once; it keeps zooming as it goes
  const out = `opacity ${FADE / 2}ms ease`
  const into = `opacity ${FADE - 150}ms ease 150ms`
  const style = (i: number): React.CSSProperties => {
    const { k, len } = frames[i]
    const zoom = `transform ${(len - k) * FRAME + FADE}ms linear`
    if (i === prev && i !== cur) return { opacity: 0, transform: `scale(${ZOOM})`, transition: `${out}, ${zoom}` }
    if (i !== cur) return { opacity: 0, transform: `scale(${scaleAt(k, len)})`, transition: out }
    if (state === 'idle' || state === 'ended') return { opacity: 1, transform: 'scale(1)', transition: into }
    return { opacity: 1, transform: `scale(${ZOOM})`, transition: `${into}, ${zoom}` }
  }
  const mounted = [...new Set([prev, cur, next])].filter((i): i is number => i !== null && i < frames.length).sort((a, b) => a - b)

  return (
    <li onPointerEnter={(e) => hover(e, true)} onPointerLeave={(e) => hover(e, false)} className="relative w-[min(285px,64vw)] shrink-0 snap-start">
      <Link
        href={href}
        style={{ backgroundColor: bg }}
        className="flex aspect-[285/457] flex-col overflow-hidden rounded-xl px-3 pt-4 text-ink focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ink"
      >
        <span className="font-display text-[29px] leading-[33px] font-black tracking-[-0.01em]">{title}</span>
        {subtitle && <span className="mt-1 text-lg leading-6">{subtitle}</span>}
        {/* product shots on white multiply into the tile colour */}
        <span ref={area} aria-hidden className="relative -mx-3 mt-2 flex-1">
          {mounted.map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={frames[i].src}
              alt=""
              fetchPriority={i === 0 && first ? 'high' : i === cur ? undefined : 'low'}
              style={style(i)}
              className="absolute top-1 left-3 h-[calc(100%-48px)] w-[calc(100%-24px)] max-w-none object-contain mix-blend-multiply"
            />
          ))}
        </span>
      </Link>
      {frames.length > 1 && (
        <button
          type="button"
          onClick={() => (state === 'playing' ? pause() : play())}
          aria-label={`${verb} ${title}`}
          className="absolute bottom-3 left-3 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black text-white hover:bg-[#333] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            {verb === 'Pause' ? (
              <path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            ) : verb === 'Play' ? (
              <path d="M5.5 3.2v9.6l7.5-4.8z" fill="currentColor" />
            ) : (
              <>
                <path d="M3.2 8a4.8 4.8 0 1 0 1.6-3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4.3 1.6v3.3h3.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
          </svg>
        </button>
      )}
    </li>
  )
}

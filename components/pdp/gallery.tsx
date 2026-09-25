'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { ChevronIcon, CloseIcon } from '@/components/icons'

const ZOOM = 2.5
const LENS = 1 / ZOOM // lens side as a fraction of the main image tile

// Desktop: thumbnail strip (hover or focus swaps) + main image; hovering draws a lens and a zoom pane over the center column; click opens the viewer.
// Mobile: a swipeable scroll-snap strip with dots; tap opens the viewer.
export function Gallery({ images, title, saver = false }: { images: string[]; title: string; saver?: boolean }) {
  const [index, setIndex] = useState(0)
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null) // lens top-left as fractions of the tile, while the mouse is over it
  const [zoomed, setZoomed] = useState<string | null>(null) // transform-origin when zoomed in the viewer
  const dialog = useRef<HTMLDialogElement>(null)
  const n = images.length
  const many = n > 1
  // Data saver: every picture on the page goes through Next's optimiser at a lower quality. Default mode keeps the raw
  // CDN file, byte for byte. `size` is the box the picture sits in, so the optimiser fetches roughly that.
  const shot = (
    src: string,
    alt: string,
    size: number,
    className: string,
    o: { priority?: boolean; loading?: 'eager' | 'lazy'; style?: React.CSSProperties } = {},
  ) =>
    saver ? (
      <Image src={src} alt={alt} width={size} height={size} quality={40} priority={o.priority} loading={o.priority ? undefined : o.loading} style={o.style} className={className} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} fetchPriority={o.priority ? 'high' : undefined} loading={o.loading} style={o.style} className={className} />
    )

  const openViewer = (i: number) => {
    setIndex(i)
    setZoomed(null)
    dialog.current?.showModal()
  }
  const go = (dir: 1 | -1) => {
    setZoomed(null)
    setIndex((i) => (i + dir + n) % n)
  }
  const origin = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`
  }

  return (
    <div>
      <div className="hidden gap-3 md:flex">
        {many && (
          <ul className="flex w-11 shrink-0 flex-col gap-2.5" aria-label="Product images">
            {images.map((src, i) => (
              <li key={src}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onFocus={() => setIndex(i)}
                  onClick={() => setIndex(i)}
                  aria-label={`Image ${i + 1} of ${n}`}
                  aria-current={i === index}
                  className={`block size-11 cursor-pointer overflow-hidden rounded-lg border bg-[#f7f7f7] p-0.5 focus-visible:outline-2 focus-visible:outline-focus ${i === index ? 'border-[#e77600] shadow-[0_0_3px_2px_rgba(228,121,17,0.5)]' : 'border-[#a2a6ac] hover:border-[#e77600]'}`}
                >
                  {shot(src, '', 44, 'size-full object-contain mix-blend-multiply')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openViewer(index)}
            onPointerMove={(e) => {
              if (e.pointerType !== 'mouse') return
              const r = e.currentTarget.getBoundingClientRect()
              const at = (v: number) => Math.min(1 - LENS, Math.max(0, v - LENS / 2))
              setLens({ x: at((e.clientX - r.left) / r.width), y: at((e.clientY - r.top) / r.height) })
            }}
            onPointerLeave={() => setLens(null)}
            aria-label="Open full-screen image viewer"
            className="relative flex aspect-square max-h-[560px] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-sm bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-focus"
          >
            {shot(images[index], title, 560, 'max-h-full max-w-full object-contain mix-blend-multiply', { priority: true })}
            {lens && (
              <span
                aria-hidden
                className="pointer-events-none absolute border border-[#6f7373] bg-white/40"
                style={{ left: `${lens.x * 100}%`, top: `${lens.y * 100}%`, width: `${LENS * 100}%`, height: `${LENS * 100}%` }}
              />
            )}
          </button>
          <p className="mt-2 text-center text-xs text-muted">Roll over image to zoom in · Click to see full view</p>
          {lens && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-full z-30 ml-8 aspect-square w-full border border-line bg-[#f7f7f7] bg-no-repeat bg-blend-multiply shadow-[0_0_14px_rgba(15,17,17,0.35)]"
              style={{
                backgroundImage: `url("${images[index]}")`,
                backgroundSize: `${ZOOM * 100}%`,
                backgroundPosition: `${(lens.x / (1 - LENS)) * 100}% ${(lens.y / (1 - LENS)) * 100}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="md:hidden">
        <ul
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          aria-label="Product images"
        >
          {images.map((src, i) => (
            <li key={src} className="w-full shrink-0 snap-center">
              <button type="button" onClick={() => openViewer(i)} aria-label={`Image ${i + 1} of ${n}, open full-screen viewer`} className="flex aspect-square w-full items-center justify-center bg-[#f7f7f7] p-4">
                {shot(src, i === 0 ? title : '', 390, 'max-h-full max-w-full object-contain mix-blend-multiply', { loading: 'eager' })}
              </button>
            </li>
          ))}
        </ul>
        {many && (
          <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
            {images.map((src, i) => (
              <span key={src} className={`size-2 rounded-full ${i === index ? 'bg-ink' : 'bg-line'}`} />
            ))}
          </div>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-label={`Images: ${title}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && many) go(1)
          if (e.key === 'ArrowLeft' && many) go(-1)
        }}
        className="m-auto h-dvh max-h-none w-screen max-w-none bg-white p-0 text-ink backdrop:bg-black/60 md:h-[90vh] md:w-[min(1200px,95vw)] md:rounded-lg"
      >
        <div className="flex h-full flex-col md:flex-row">
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 md:p-8">
            <button
              type="button"
              onClick={(e) => setZoomed(zoomed ? null : origin(e))}
              aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
              className={`flex size-full items-center justify-center ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            >
              {shot(images[index], `${title}, image ${index + 1} of ${n}`, 1000, 'max-h-full max-w-full object-contain transition-transform', {
                style: zoomed ? { transform: 'scale(2.5)', transformOrigin: zoomed } : undefined,
              })}
            </button>
            {many && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-white/90 shadow">
                  <ChevronIcon className="size-6 rotate-180" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-white/90 shadow">
                  <ChevronIcon className="size-6" />
                </button>
              </>
            )}
          </div>
          <aside className="shrink-0 border-t border-line p-4 md:w-72 md:border-t-0 md:border-l">
            <div className="flex items-start gap-3">
              <p className="line-clamp-2 flex-1 text-sm">{title}</p>
              <form method="dialog">
                <button type="submit" aria-label="Close" className="-m-2 flex size-11 cursor-pointer items-center justify-center">
                  <CloseIcon className="size-5" />
                </button>
              </form>
            </div>
            {many && (
              <ul className="mt-3 flex gap-2 overflow-x-auto md:grid md:grid-cols-4">
                {images.map((src, i) => (
                  <li key={src} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setZoomed(null)
                        setIndex(i)
                      }}
                      aria-label={`Show image ${i + 1} of ${n}`}
                      aria-current={i === index}
                      className={`block size-14 cursor-pointer rounded-lg border-2 bg-[#f7f7f7] p-1 ${i === index ? 'border-[#e77600]' : 'border-transparent hover:border-line'}`}
                    >
                      {shot(src, '', 56, 'size-full object-contain mix-blend-multiply', { loading: 'lazy' })}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </dialog>
    </div>
  )
}

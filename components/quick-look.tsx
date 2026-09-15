'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { quickLook, type QuickLookItem } from '@/app/actions/quick-look'
import { CloseIcon } from '@/components/icons'
import { useRegion } from '@/components/region-provider'
import { Stars } from '@/components/stars'
import { formatDollars } from '@/lib/region'

type Known = { id: number; title: string; thumbnail: string }

// one request per product per page load, shared by every card; a failed request is dropped so the next open retries
const cache = new Map<number, Promise<QuickLookItem | null>>()
function load(id: number) {
  let item = cache.get(id)
  if (!item) {
    item = quickLook(id).catch(() => {
      cache.delete(id)
      return null
    })
    cache.set(id, item)
  }
  return item
}

const Bar = ({ className }: { className: string }) => <span aria-hidden className={`block animate-pulse rounded bg-[#e3e6e6] motion-reduce:animate-none ${className}`} />

// Amazon's "Quick look" on carousel cards: a pill over the bottom of the image, shown while the card is hovered or has
// keyboard focus and never on touch screens. It opens the product in a dialog with "Customers also bought".
export function QuickLook(product: Known) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Quick look: ${product.title}`}
        onClick={() => setOpen(true)}
        className="absolute inset-x-[10%] bottom-2.5 h-8 cursor-pointer rounded-full border border-[#888c8c] bg-white text-[13px] opacity-0 shadow-[0_1px_2px_rgba(15,17,17,0.15)] transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100 hover:bg-[#f7fafa] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none motion-reduce:transition-none [@media(hover:none)]:hidden"
      >
        Quick look
      </button>
      {open && <QuickLookDialog product={product} onClose={() => setOpen(false)} />}
    </>
  )
}

// Native modal <dialog>: focus trap, Esc, and focus back on the Quick look button when it closes. Opens at once with the
// card's title and picture; a thumbnail switches the product in place, and the strip stays the opened product's.
function QuickLookDialog({ product, onClose }: { product: Known; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { currency, rate } = useRegion()
  const [current, setCurrent] = useState(product.id)
  const [loaded, setLoaded] = useState(() => new Map<number, QuickLookItem | null>())

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal()
  }, [])
  useEffect(() => {
    for (const id of new Set([product.id, current])) load(id).then((item) => setLoaded((m) => new Map(m).set(id, item)))
  }, [product.id, current])

  const root = loaded.get(product.id)
  const strip: Known[] = root ? [product, ...root.alsoBought] : []
  const known = strip.find((k) => k.id === current) ?? product
  const item = loaded.get(current) // undefined while loading, null when it couldn't be loaded
  const close = () => ref.current?.close()

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(1000px,calc(100vw-32px))] max-w-none overflow-y-auto rounded-xl bg-white p-0 text-ink shadow-[0_0_14px_rgba(15,17,17,0.5)] backdrop:bg-black/50"
    >
      <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-page focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
        <CloseIcon className="size-5" />
      </button>
      <div className="grid items-center gap-6 px-6 pt-14 pb-6 md:grid-cols-2 md:gap-10 md:px-10 md:pt-10 md:pb-8">
        <div className="flex h-[240px] items-center justify-center md:h-[400px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item?.image ?? known.thumbnail} alt={item?.title ?? known.title} className="max-h-full max-w-full object-contain" />
        </div>
        <div className="min-w-0 md:pr-8">
          {item === undefined ? <Bar className="mb-2 h-5 w-24" /> : item?.brand && <p className="text-lg text-muted">{item.brand}</p>}
          <h2 id={titleId} className="line-clamp-3 text-2xl leading-8 md:text-[28px] md:leading-9">{item?.title ?? known.title}</h2>
          {item === null ? (
            <p role="alert" className="mt-3 text-danger">We couldn&apos;t load this item.</p>
          ) : item ? (
            <>
              <p className="mt-2 flex items-center gap-1.5">
                <Stars rating={item.rating} className="h-5" />
                <span className="text-link">{item.ratingCount.toLocaleString('en-US')}</span>
              </p>
              <p className="mt-6 text-[28px] leading-9">{formatDollars(item.price, currency, rate)}</p>
              <Link href={`/dp/${item.id}`} onClick={close} className="btn btn-cart mt-6 h-11 w-full max-w-[330px] text-base">
                See product details
              </Link>
            </>
          ) : (
            <span className="mt-3 block space-y-5">
              <Bar className="h-5 w-40" />
              <Bar className="h-8 w-28" />
              <Bar className="h-11 w-full max-w-[330px] rounded-full" />
            </span>
          )}
        </div>
      </div>
      {root !== null && (
        <div className="bg-[#f3f3f3] pt-4">
          <h3 className="px-12 text-center text-xl text-muted">Customers also bought</h3>
          <ul className="flex gap-3 overflow-x-auto px-6 pt-3 pb-4 [scrollbar-width:thin]">
            {root
              ? strip.map((k) => (
                  <li key={k.id} className="w-[124px] shrink-0">
                    <button type="button" onClick={() => setCurrent(k.id)} aria-label={k.title} aria-current={k.id === current || undefined} className="group/thumb flex w-full cursor-pointer flex-col focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
                      <span className="flex h-[124px] items-center justify-center bg-white p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={k.thumbnail} alt="" className="max-h-full max-w-full object-contain" />
                      </span>
                      <span aria-hidden className={`mt-2 h-1 w-full ${k.id === current ? 'bg-muted' : 'group-hover/thumb:bg-[#c7c9c9]'}`} />
                    </button>
                  </li>
                ))
              : Array.from({ length: 7 }, (_, i) => <li key={i} aria-hidden className="mb-3 h-[124px] w-[124px] shrink-0 animate-pulse bg-[#e3e6e6] motion-reduce:animate-none" />)}
          </ul>
        </div>
      )}
    </dialog>
  )
}

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

const Bar = ({ className }: { className: string }) => <span aria-hidden className={`block animate-pulse rounded bg-page motion-reduce:animate-none ${className}`} />

// A quiet button over the bottom of a card's picture, shown while the card is hovered or has keyboard focus and never on
// touch screens. It opens the product in a dialog with "Customers also bought".
export function QuickLook(product: Known) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Quick look: ${product.title}`}
        onClick={() => setOpen(true)}
        className="absolute inset-x-3 bottom-3 h-9 cursor-pointer rounded-md border border-line bg-surface/95 text-sm opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none [@media(hover:none)]:hidden"
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
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(960px,calc(100vw-32px))] max-w-none overflow-y-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_rgba(25,23,19,0.25)] backdrop:bg-black/40"
    >
      <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <CloseIcon className="size-5" />
      </button>
      <div className="grid items-center gap-6 px-6 pt-14 pb-6 md:grid-cols-2 md:gap-10 md:px-10 md:pt-10 md:pb-8">
        <div className="flex h-[240px] items-center justify-center rounded-[10px] bg-page p-6 md:h-[380px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item?.image ?? known.thumbnail} alt={item?.title ?? known.title} className="max-h-full max-w-full object-contain" />
        </div>
        <div className="min-w-0 md:pr-8">
          {item === undefined ? <Bar className="mb-2 h-5 w-24" /> : item?.brand && <p className="text-sm tracking-wide text-muted">{item.brand}</p>}
          <h2 id={titleId} className="mt-1 line-clamp-3 text-[26px] leading-9">{item?.title ?? known.title}</h2>
          {item === null ? (
            <p role="alert" className="mt-3 text-danger">We couldn&apos;t load this item.</p>
          ) : item ? (
            <>
              <p className="mt-3 flex items-center gap-2">
                <Stars rating={item.rating} className="h-4" />
                <span className="price text-sm text-muted">{item.ratingCount.toLocaleString('en-US')}</span>
              </p>
              <p className="price font-display mt-6 text-[30px] leading-9">{formatDollars(item.price, currency, rate)}</p>
              <Link href={`/dp/${item.id}`} onClick={close} className="btn btn-cart btn-lg mt-7 w-full max-w-[320px]">
                See product details
              </Link>
            </>
          ) : (
            <span className="mt-3 block space-y-5">
              <Bar className="h-5 w-40" />
              <Bar className="h-8 w-28" />
              <Bar className="h-12 w-full max-w-[320px] rounded-md" />
            </span>
          )}
        </div>
      </div>
      {root !== null && (
        <div className="border-t border-line bg-paper pt-6">
          <h3 className="px-12 text-center text-lg">Customers also bought</h3>
          <ul className="flex gap-3 overflow-x-auto px-6 pt-4 pb-5 [scrollbar-width:thin]">
            {root
              ? strip.map((k) => (
                  <li key={k.id} className="w-[124px] shrink-0">
                    <button type="button" onClick={() => setCurrent(k.id)} aria-label={k.title} aria-current={k.id === current || undefined} className="group/thumb flex w-full cursor-pointer flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                      <span className="flex h-[124px] items-center justify-center rounded-md bg-surface p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={k.thumbnail} alt="" className="max-h-full max-w-full object-contain" />
                      </span>
                      <span aria-hidden className={`mt-2 h-0.5 w-full ${k.id === current ? 'bg-accent' : 'group-hover/thumb:bg-line'}`} />
                    </button>
                  </li>
                ))
              : Array.from({ length: 7 }, (_, i) => <li key={i} aria-hidden className="mb-3 h-[124px] w-[124px] shrink-0 animate-pulse rounded-md bg-page motion-reduce:animate-none" />)}
          </ul>
        </div>
      )}
    </dialog>
  )
}

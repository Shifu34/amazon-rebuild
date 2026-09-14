'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { moveListItem, removeListItem, restoreListItem } from '@/app/actions/lists'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { CaretIcon } from '@/components/icons'
import { Price } from '@/components/price'
import { Stars } from '@/components/stars'
import type { Product } from '@/lib/catalog'
import { fullDate, usd } from '@/lib/format'

export type ListRowItem = Pick<Product, 'id' | 'title' | 'brand' | 'thumbnail' | 'price' | 'listPrice' | 'rating' | 'ratingCount' | 'stock'> & { addedAt: string }
type ListRef = { id: string; name: string }
// A row that was just deleted (undo = its added date) or moved; it stays collapsed in place after the server drops it.
type Ghost = { item: ListRowItem; movedTo?: ListRef; undo?: string }

const fields = (values: Record<string, string | number>) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(values)) form.set(k, String(v))
  return form
}

export function ListItems({ listId, items, otherLists, empty }: { listId: string; items: ListRowItem[]; otherLists: ListRef[]; empty: React.ReactNode }) {
  const [ghosts, setGhosts] = useState<Map<number, Ghost>>(new Map())
  const setGhost = (id: number, ghost: Ghost | null) =>
    setGhosts((prev) => {
      const next = new Map(prev)
      if (ghost) next.set(id, ghost)
      else next.delete(id)
      return next
    })

  const rows = [...items, ...[...ghosts.values()].map((g) => g.item).filter((g) => !items.some((i) => i.id === g.id))].sort((a, b) =>
    b.addedAt.localeCompare(a.addedAt),
  )
  if (rows.length === 0) return empty

  return (
    <ul className="divide-y divide-line">
      {rows.map((item) => {
        const ghost = ghosts.get(item.id)
        return (
          <li key={item.id}>
            {ghost ? (
              <GhostRow ghost={ghost} listId={listId} onRestored={() => setGhost(item.id, null)} />
            ) : (
              <Row item={item} listId={listId} otherLists={otherLists} onGone={(g) => setGhost(item.id, g)} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Row({ item: p, listId, otherLists, onGone }: { item: ListRowItem; listId: string; otherLists: ListRef[]; onGone: (g: Ghost) => void }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const href = `/dp/${p.id}`

  const remove = () =>
    start(async () => {
      const removed = await removeListItem(fields({ listId, productId: p.id }))
      onGone({ item: p, undo: removed?.addedAt })
    })
  const move = (to: ListRef) =>
    start(async () => {
      const moved = await moveListItem(fields({ listId, toListId: to.id, productId: p.id }))
      if (moved) onGone({ item: p, movedTo: moved })
      else setError('There was a problem moving this item. Please try again.')
    })

  return (
    <div className="flex gap-4 py-4">
      <Link href={href} tabIndex={-1} aria-hidden className="flex size-[100px] shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-2 sm:size-[135px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-base leading-6 font-normal">
            <Link href={href} className="line-clamp-2 hover:text-link-hover hover:underline">{p.title}</Link>
          </h3>
          {p.brand && <p className="text-xs text-muted">by {p.brand}</p>}
          <p className="flex items-center gap-1 text-sm">
            <Stars rating={p.rating} />
            <span className="text-link">{p.ratingCount.toLocaleString('en-US')}</span>
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl"><Price value={p.price} /></span>
            {p.listPrice && (
              <span className="text-xs text-muted">
                List: <s>{usd(p.listPrice)}</s>
              </span>
            )}
          </p>
          <p className="text-xs text-muted">Item added {fullDate(new Date(p.addedAt))}</p>
          {p.stock > 0 ? <p className="text-xs text-success">In Stock</p> : <p className="text-sm text-danger">Currently unavailable.</p>}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:w-44 sm:items-stretch">
          {p.stock > 0 && <AddToCartButton productId={p.id} className="w-full" />}
          <div className="flex items-center gap-4 text-sm">
            {otherLists.length > 0 && <MoveMenu title={p.title} lists={otherLists} disabled={pending} onPick={move} />}
            <button type="button" onClick={remove} disabled={pending} aria-label={`Delete ${p.title}`} className="link cursor-pointer disabled:opacity-50">
              Delete
            </button>
          </div>
          {error && <p role="alert" className="field-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function MoveMenu({ title, lists, disabled, onPick }: { title: string; lists: ListRef[]; disabled: boolean; onPick: (to: ListRef) => void }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    wrap.current?.querySelector<HTMLElement>('[data-list]')?.focus()
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      wrap.current?.querySelector('button')?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-expanded={open} aria-label={`Move ${title}`} className="link flex cursor-pointer items-center gap-1 disabled:opacity-50">
        Move <CaretIcon className="h-1.5 w-2" />
      </button>
      {open && (
        <div role="group" aria-label="Move to" className="absolute top-full left-0 z-30 mt-1 w-56 rounded-lg border border-line bg-white py-2 shadow-[0_0_14px_rgba(15,17,17,0.35)]">
          <p className="px-3 pb-1 text-xs text-muted">Move to</p>
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              data-list
              onClick={() => {
                setOpen(false)
                onPick(l)
              }}
              className="block w-full cursor-pointer truncate px-3 py-2 text-left hover:bg-[#f0f2f2] focus-visible:bg-[#f0f2f2] focus-visible:outline-none"
            >
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GhostRow({ ghost: { item, movedTo, undo }, listId, onRestored }: { ghost: Ghost; listId: string; onRestored: () => void }) {
  const [pending, start] = useTransition()
  const restore = () =>
    start(async () => {
      await restoreListItem(fields({ listId, productId: item.id, addedAt: undo ?? '' }))
      onRestored()
    })
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 py-4 text-sm">
      <p className="min-w-0">
        <b>{movedTo ? `Moved to ${movedTo.name}` : 'Deleted'}</b> <span className="text-muted">{item.title}</span>
      </p>
      {movedTo ? (
        <Link href={`/lists/${movedTo.id}`} className="link">View list</Link>
      ) : (
        undo && (
          <button type="button" onClick={restore} disabled={pending} className="link cursor-pointer font-bold">
            {pending ? 'Undoing…' : 'Undo'}
          </button>
        )
      )}
    </div>
  )
}

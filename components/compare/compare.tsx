'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createContext, use, useState } from 'react'
import { CloseIcon } from '@/components/icons'
import { COMPARE_COOKIE, COMPARE_MAX } from './ids'

export type CompareItem = { id: number; title: string; thumbnail: string }

type Selection = {
  items: CompareItem[]
  toggle: (item: CompareItem) => void
  remove: (id: number) => void
  clear: () => void
}

const CompareContext = createContext<Selection>({ items: [], toggle: () => {}, remove: () => {}, clear: () => {} })
const useCompare = () => use(CompareContext)

// a preference, not a secret, kept a month (app/actions/region.ts writes its cookies the same way)
function save(items: CompareItem[]) {
  const secure = location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${COMPARE_COOKIE}=${items.map((i) => i.id).join(',')}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${secure}`
}

// Selection state for the whole shop: the layout seeds it from the cookie, ticking a card writes the cookie straight back
// so /compare (a server page) sees the change without an action round trip.
export function CompareProvider({ initial, children }: { initial: CompareItem[]; children: React.ReactNode }) {
  const [items, setItems] = useState(initial)
  const router = useRouter()
  const put = (next: CompareItem[], reload = false) => {
    setItems(next)
    save(next)
    if (reload) router.refresh() // the compare table is server-rendered from the cookie
  }
  const value: Selection = {
    items,
    toggle: (item) => put(items.some((i) => i.id === item.id) ? items.filter((i) => i.id !== item.id) : [...items, item].slice(0, COMPARE_MAX)),
    remove: (id) => put(items.filter((i) => i.id !== id), true),
    clear: () => put([], true),
  }
  return <CompareContext value={value}>{children}</CompareContext>
}

// On a result card: hidden until the card is hovered or focused, then stays visible while anything is selected (and always
// on touch, where there is no hover to reveal it).
export function CompareCheckbox({ id, title, thumbnail }: CompareItem) {
  const { items, toggle } = useCompare()
  const checked = items.some((i) => i.id === id)
  const full = !checked && items.length >= COMPARE_MAX
  const shown = checked || items.length > 0
  return (
    <label
      className={`absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-md border border-line bg-white/95 px-2 py-1 text-xs shadow-[0_1px_2px_rgba(15,17,17,0.15)] transition-opacity motion-reduce:transition-none [@media(hover:none)]:opacity-100 ${
        shown ? 'opacity-100' : 'opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100'
      } ${full ? 'text-muted' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={full}
        onChange={() => toggle({ id, title, thumbnail })}
        aria-label={full ? `Compare ${title} (compare up to ${COMPARE_MAX} items)` : `Compare ${title}`}
        className="size-3.5 accent-link"
      />
      Compare
    </label>
  )
}

// Docked bar with what is selected. The spacer keeps it off the footer; "Compare" is not prefetched so the table is always
// rendered with the current cookie.
export function CompareTray() {
  const { items, remove, clear } = useCompare()
  if (!items.length) return null
  return (
    <>
      <div aria-hidden className="h-[84px]" />
      <section aria-label="Compare" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white shadow-[0_-2px_8px_rgba(15,17,17,0.15)]">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2">
          <ul className="flex flex-1 gap-2 overflow-x-auto">
            {items.map((i) => (
              <li key={i.id} className="relative shrink-0">
                <span className="flex size-[60px] items-center justify-center rounded-sm border border-line bg-[#f7f7f7] p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.thumbnail} alt={i.title} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                </span>
                <button
                  type="button"
                  onClick={() => remove(i.id)}
                  aria-label={`Remove ${i.title} from compare`}
                  className="absolute -top-1.5 -right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full border border-line bg-white hover:bg-[#f7fafa] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                >
                  <CloseIcon className="size-2.5" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={clear} className="link cursor-pointer text-sm">Clear</button>
          <Link href="/compare" prefetch={false} className="btn btn-cart shrink-0">Compare ({items.length})</Link>
        </div>
      </section>
    </>
  )
}

// On the compare table: dropping a column re-renders the server page from the cookie.
export function CompareRemove({ id, title }: { id: number; title: string }) {
  const { remove } = useCompare()
  return (
    <button
      type="button"
      onClick={() => remove(id)}
      aria-label={`Remove ${title} from compare`}
      className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-page focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
    >
      <CloseIcon className="size-3.5" />
    </button>
  )
}

// Rows the server marked data-same (every column identical) hide while this is on.
export function DiffOnly({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false)
  return (
    <>
      <label className="mb-3 flex w-fit items-center gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-link" />
        Show differences only
      </label>
      <div className={on ? '[&_tr[data-same=true]]:hidden' : ''}>{children}</div>
    </>
  )
}

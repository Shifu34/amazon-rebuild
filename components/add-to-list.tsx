'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { addToList, type AddToListState } from '@/app/actions/lists'
import { CaretIcon } from './icons'

type ListOption = { id: string; name: string; isDefault: boolean }

// Split button: the main part saves to the default "Shopping List"; the caret picks another list or creates one.
export function AddToList({ productId, lists, signedIn }: { productId: number; lists: ListOption[]; signedIn: boolean }) {
  if (!signedIn) {
    return <Link href={`/ap/signin?return_to=${encodeURIComponent(`/dp/${productId}`)}`} className="btn btn-plain w-full">Add to List</Link>
  }
  return <ListPicker productId={productId} lists={lists} />
}

function ListPicker({ productId, lists }: { productId: number; lists: ListOption[] }) {
  const [menu, setMenu] = useState(false)
  const [dismissed, setDismissed] = useState<AddToListState>(null)
  const [state, action, pending] = useActionState<AddToListState, FormData>(async (prev, form) => {
    const result = await addToList(prev, form)
    if (result?.ok) setMenu(false)
    return result
  }, null)
  const wrap = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setMenu(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const productField = <input type="hidden" name="productId" value={productId} />
  const nameError = state && !state.ok && state.field === 'name' ? state.error : undefined

  return (
    <div ref={wrap}>
      {/* the menu anchors to this row, so it opens under the caret even when the status box is showing */}
      <div className="relative flex">
        <form action={action} className="min-w-0 flex-1">
          {productField}
          <button type="submit" disabled={pending} className="btn btn-plain w-full rounded-r-none">
            {pending ? 'Saving…' : 'Add to List'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-controls={menuId}
          aria-label="Choose a list"
          className="btn btn-plain rounded-l-none border-l-0 px-3"
        >
          <CaretIcon className="h-1.5 w-2" />
        </button>

      {menu && (
        <div id={menuId} className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-line bg-white py-2 text-sm shadow-[0_0_14px_rgba(15,17,17,0.35)]">
          {lists.length > 0 && (
            <form action={action}>
              {productField}
              <ul>
                {lists.map((l) => (
                  <li key={l.id}>
                    <button type="submit" name="listId" value={l.id} disabled={pending} className="block w-full cursor-pointer px-3 py-2 text-left hover:bg-[#f0f2f2] focus-visible:bg-[#f0f2f2] focus-visible:outline-none">
                      <span className="block truncate">{l.name}</span>
                      {l.isDefault && <span className="block text-xs text-muted">Default List</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </form>
          )}
          <form action={action} className={`px-3 pt-2 ${lists.length ? 'mt-1 border-t border-line' : ''}`}>
            {productField}
            <label htmlFor={`${menuId}-name`} className="label">Create another list</label>
            <div className="flex gap-2">
              <input
                id={`${menuId}-name`}
                name="newList"
                maxLength={50}
                placeholder="List name"
                aria-invalid={!!nameError}
                aria-describedby={nameError ? `${menuId}-error` : undefined}
                className="input min-w-0"
              />
              <button type="submit" disabled={pending} className="btn btn-cart px-3">Create</button>
            </div>
            {nameError && <p id={`${menuId}-error`} role="alert" className="field-error">{nameError}</p>}
          </form>
        </div>
      )}
      </div>

      {state?.ok && dismissed !== state && (
        <div role="status" className="mt-2 rounded-lg border border-[#0b7b3c] p-3 text-sm">
          <p className="font-bold break-words text-success">✓ {state.added ? '1 item added to' : 'Already in'} {state.listName}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
            <Link href={`/lists/${state.listId}`} className="link whitespace-nowrap">View your list</Link>
            <button type="button" onClick={() => setDismissed(state)} className="link cursor-pointer whitespace-nowrap">Continue shopping</button>
          </p>
        </div>
      )}
      {state && !state.ok && !state.field && <p role="alert" className="field-error">{state.error}</p>}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createNamedList, deleteList, renameList, type ListFormState } from '@/app/actions/lists'
import { ConfirmDialog, Modal } from '@/components/account/modal'
import { Field, useFormAction } from '@/components/address-form'

type NameFormProps = {
  action: (prev: ListFormState, form: FormData) => Promise<ListFormState>
  submit: string
  listId?: string
  defaultName?: string
  onCancel: () => void
  onDone?: () => void
}

function ListNameForm({ action, submit, listId, defaultName, onCancel, onDone }: NameFormProps) {
  const { state, pending, ref, onSubmit } = useFormAction<ListFormState>(async (prev, form) => {
    const next = await action(prev, form)
    if (next?.ok) onDone?.()
    return next
  }, null)
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate>
      {listId && <input type="hidden" name="listId" value={listId} />}
      <Field label="List name" error={state && !state.ok ? state.error : undefined}>
        {(a) => <input {...a} name="name" className="input" maxLength={50} defaultValue={defaultName} required />}
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-plain">Cancel</button>
        <button type="submit" disabled={pending} className="btn btn-cart">{pending ? 'Saving…' : submit}</button>
      </div>
    </form>
  )
}

// Open while the URL has ?create=1 (header "Create a List" links there); a new list opens on its own page.
export function CreateListDialog({ open, closeHref }: { open: boolean; closeHref: string }) {
  const router = useRouter()
  const close = () => router.replace(closeHref, { scroll: false })
  return (
    <Modal open={open} onClose={close} title="Create a new list">
      <ListNameForm action={createNamedList} submit="Create List" onCancel={close} />
    </Modal>
  )
}

// Rename and delete, for lists other than the default one.
export function ListActions({ id, name, itemCount }: { id: string; name: string; itemCount: number }) {
  const [renaming, setRenaming] = useState(false)
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setRenaming(true)} aria-haspopup="dialog" className="btn btn-plain">Rename list</button>
      <ConfirmDialog label="Delete list" triggerClassName="btn btn-plain" title="Delete list" action={deleteList} fields={{ listId: id }} confirm="Delete" cancel="Cancel">
        <p className="break-words">
          Delete <b>{name}</b>?{' '}
          {itemCount === 0 ? 'The list is empty.' : itemCount === 1 ? 'This removes the 1 item on it.' : `This removes all ${itemCount} items on it.`}
        </p>
      </ConfirmDialog>
      <Modal open={renaming} onClose={() => setRenaming(false)} title="Rename list">
        <ListNameForm action={renameList} submit="Save" listId={id} defaultName={name} onCancel={() => setRenaming(false)} onDone={() => setRenaming(false)} />
      </Modal>
    </div>
  )
}

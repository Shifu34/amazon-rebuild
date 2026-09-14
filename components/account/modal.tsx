'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CloseIcon } from '@/components/icons'

// Native modal <dialog> (focus trap, Esc, backdrop) driven by `open`. onClose runs for Esc, the X and a backdrop click.
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      d.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select')?.focus()
    } else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => open && onClose()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(450px,calc(100vw-32px))] rounded-lg p-0 text-ink shadow-[0_0_14px_rgba(15,17,17,0.5)] backdrop:bg-[rgba(15,17,17,0.5)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-[#f0f2f2] py-1 pr-1 pl-4">
        <h2 id={titleId} className="text-base">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-[#e3e6e6] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
          <CloseIcon className="size-4" />
        </button>
      </div>
      <div className="p-4">{open && children}</div>
    </dialog>
  )
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn btn-cart">
      {pending ? 'Please wait…' : children}
    </button>
  )
}

type ConfirmProps = {
  label: string // trigger text
  ariaLabel?: string // trigger name with context, e.g. "Remove address for Jane Doe"
  triggerClassName?: string
  title: string
  action: (form: FormData) => Promise<void>
  fields?: Record<string, string> // hidden inputs sent to the action
  confirm?: string
  cancel?: string
  children: React.ReactNode // the question
}

// A trigger button that asks before running a destructive Server Action.
export function ConfirmDialog({ label, ariaLabel, triggerClassName = 'link cursor-pointer', title, action, fields = {}, confirm = 'Yes', cancel = 'No', children }: ConfirmProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={ariaLabel} className={triggerClassName}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <form
          action={async (form) => {
            await action(form)
            setOpen(false)
          }}
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="text-sm">{children}</div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-plain">{cancel}</button>
            <Submit>{confirm}</Submit>
          </div>
        </form>
      </Modal>
    </>
  )
}

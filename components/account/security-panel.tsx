'use client'

import { useEffect, useRef, useState } from 'react'
import { updateEmail, updateName, updatePassword, type SecurityField, type SecurityState } from '@/app/actions/account'
import { Field, useFormAction } from '@/components/address-form'
import { Notice } from './ui'

const SAVED: Record<SecurityField, string> = {
  name: 'Your name has been updated.',
  email: 'Your email address has been updated. Other devices will need to sign in again.',
  password: 'Your password has been changed. Other devices will need to sign in again.',
}

type Done = { onDone: () => void; onCancel: () => void }

// Name, Email and Password rows; "Edit" opens the form in place and a save shows the success box.
export function SecurityPanel({ name, email }: { name: string; email: string }) {
  const [editing, setEditing] = useState<SecurityField | null>(null)
  const [saved, setSaved] = useState<SecurityField | null>(null)
  const props = (field: SecurityField) => ({
    editing: editing === field,
    onEdit: () => {
      setEditing(field)
      setSaved(null)
    },
  })
  const done = (field: SecurityField): Done => ({
    onDone: () => {
      setEditing(null)
      setSaved(field)
    },
    onCancel: () => setEditing(null),
  })

  return (
    <>
      {saved && <Notice>{SAVED[saved]}</Notice>}
      <div className="card divide-y divide-line">
        <Row label="Name" value={name} {...props('name')}>
          <NameForm name={name} {...done('name')} />
        </Row>
        <Row label="Email" value={email} {...props('email')}>
          <EmailForm email={email} {...done('email')} />
        </Row>
        <Row label="Password" value="********" {...props('password')}>
          <PasswordForm {...done('password')} />
        </Row>
      </div>
    </>
  )
}

function Row({ label, value, editing, onEdit, children }: { label: string; value: string; editing: boolean; onEdit: () => void; children: React.ReactNode }) {
  const button = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (wasEditing.current && !editing) button.current?.focus() // back to "Edit" after save or cancel
    wasEditing.current = editing
  }, [editing])

  return (
    <section className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base">{label}</h2>
          {!editing && <p className="mt-0.5 text-sm break-words text-muted">{value}</p>}
        </div>
        {!editing && (
          <button ref={button} type="button" onClick={onEdit} aria-label={`Edit ${label.toLowerCase()}`} className="btn btn-plain w-24 shrink-0">
            Edit
          </button>
        )}
      </div>
      {editing && <div className="mt-4 max-w-md">{children}</div>}
    </section>
  )
}

function Buttons({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button type="submit" disabled={pending} className="btn btn-cart">{pending ? 'Saving…' : 'Save changes'}</button>
      <button type="button" onClick={onCancel} className="btn btn-plain">Cancel</button>
    </div>
  )
}

function useSecurityForm(action: (prev: SecurityState, form: FormData) => Promise<SecurityState>, onDone: () => void) {
  return useFormAction<SecurityState>(async (prev, form) => {
    const next = await action(prev, form)
    if (next?.saved) onDone()
    return next
  }, null)
}

function NameForm({ name, onDone, onCancel }: Done & { name: string }) {
  const { state, pending, ref, onSubmit } = useSecurityForm(updateName, onDone)
  const e = state?.errors ?? {}
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="space-y-3">
      <Field label="New name" error={e.name}>
        {(a) => <input {...a} name="name" className="input" autoComplete="name" maxLength={80} defaultValue={name} autoFocus />}
      </Field>
      <Buttons pending={pending} onCancel={onCancel} />
    </form>
  )
}

function EmailForm({ email, onDone, onCancel }: Done & { email: string }) {
  const { state, pending, ref, onSubmit } = useSecurityForm(updateEmail, onDone)
  const e = state?.errors ?? {}
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="space-y-3">
      <p className="text-sm">
        Current email address: <b className="font-medium break-all">{email}</b>
      </p>
      <Field label="New email address" error={e.email}>
        {(a) => <input {...a} name="email" type="email" className="input" autoComplete="email" inputMode="email" maxLength={254} autoFocus />}
      </Field>
      <Field label="Current password" error={e.current} hint="For your security, confirm your password.">
        {(a) => <input {...a} name="current" type="password" className="input" autoComplete="current-password" />}
      </Field>
      <Buttons pending={pending} onCancel={onCancel} />
    </form>
  )
}

function PasswordForm({ onDone, onCancel }: Done) {
  const { state, pending, ref, onSubmit } = useSecurityForm(updatePassword, onDone)
  const [show, setShow] = useState(false)
  const type = show ? 'text' : 'password'
  const e = state?.errors ?? {}
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="space-y-3">
      <Field label="Current password" error={e.current}>
        {(a) => <input {...a} name="current" type={type} className="input" autoComplete="current-password" autoFocus />}
      </Field>
      <Field label="New password" error={e.password} hint="Passwords must be at least 6 characters.">
        {(a) => <input {...a} name="password" type={type} className="input" autoComplete="new-password" maxLength={128} />}
      </Field>
      <Field label="Reenter new password" error={e.confirm}>
        {(a) => <input {...a} name="confirm" type={type} className="input" autoComplete="new-password" maxLength={128} />}
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={show} onChange={(ev) => setShow(ev.target.checked)} className="size-4 accent-accent" />
        Show passwords
      </label>
      <Buttons pending={pending} onCancel={onCancel} />
    </form>
  )
}

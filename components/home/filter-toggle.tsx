'use client'

import { useId, useState } from 'react'
import { CaretIcon } from '@/components/icons'

// Filter rails collapse behind a button on phones and tablets, and are always open from lg up.
export function FilterToggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="btn btn-plain lg:hidden">
        {label} <CaretIcon className={`h-1.5 w-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={id} className={`${open ? 'mt-3' : 'hidden'} lg:mt-0 lg:block`}>
        {children}
      </div>
    </>
  )
}

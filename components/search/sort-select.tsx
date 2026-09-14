'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CaretIcon } from '@/components/icons'
import { PendingMark } from './controls'

// Compact "Sort by: Featured ⌄" pill sized to the chosen label: a native <select> sits invisibly on top of it.
// Hrefs come precomputed from the server so the client never needs the catalog or URL rules. Remount via key when sort changes.
export function SortSelect({ value, options }: { value: string; options: { key: string; label: string; href: string }[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState(value)
  const [pending, start] = useTransition()
  return (
    <label className="select-pill relative inline-flex shrink-0 items-center gap-1 pr-6 text-[13px] whitespace-nowrap focus-within:border-focus focus-within:shadow-[0_0_0_3px_#c8f3fa]">
      Sort by: {options.find((o) => o.key === selected)?.label}
      <select
        aria-label="Sort by:"
        value={selected}
        onChange={(e) => {
          const href = options.find((o) => o.key === e.target.value)?.href
          setSelected(e.target.value)
          if (href) start(() => router.push(href))
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <CaretIcon className="pointer-events-none absolute right-2 h-1.5 w-2 text-muted" />
      <PendingMark on={pending} />
    </label>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { CaretIcon } from '@/components/icons'

// Hrefs come precomputed from the server so the client never needs the catalog or URL rules. Remount via key when sort changes.
export function SortSelect({ value, options }: { value: string; options: { key: string; label: string; href: string }[] }) {
  const router = useRouter()
  return (
    <label className="select-pill relative inline-flex items-center gap-1 pr-7 focus-within:border-focus focus-within:shadow-[0_0_0_3px_#c8f3fa]">
      <span>Sort by:</span>
      <select
        defaultValue={value}
        onChange={(e) => {
          const href = options.find((o) => o.key === e.target.value)?.href
          if (href) router.push(href)
        }}
        className="cursor-pointer appearance-none bg-transparent outline-none"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <CaretIcon className="pointer-events-none absolute right-2.5 h-1.5 w-2 text-muted" />
    </label>
  )
}

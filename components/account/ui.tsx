import Link from 'next/link'
import { ClearAlert } from './clear-alert'

// "Your Account › Your Addresses": every crumb but the last is a link.
export function Crumbs({ trail }: { trail: [label: string, href?: string][] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 text-[13px]">
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map(([label, href], i) => (
          <li key={label} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-muted">›</span>}
            {href ? <Link href={href} className="link">{label}</Link> : <span aria-current="page" className="text-[#c7511f]">{label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Green confirmation box after a change ("Address saved"); role=status so it is announced.
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="mb-4 flex items-center gap-3 rounded-lg border border-[#0b7b3c] px-4 py-3 shadow-[0_0_0_4px_#e8f5ed_inset]">
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0b7b3c] text-xs font-bold text-white">✓</span>
      <p className="font-bold text-[#0b7b3c]">{children}</p>
      <ClearAlert />
    </div>
  )
}

// Turns ?alert=<key> into its message; unknown keys show nothing.
export function alertFrom(alerts: Record<string, string>, value: string | string[] | undefined) {
  return typeof value === 'string' && Object.hasOwn(alerts, value) ? alerts[value] : null
}

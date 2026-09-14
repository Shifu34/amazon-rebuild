type P = { className?: string }

export function Logo({ className = '', tone = 'light' }: P & { tone?: 'light' | 'dark' }) {
  return (
    <span className={`inline-flex flex-col items-start leading-none ${tone === 'dark' ? 'text-ink' : 'text-white'} ${className}`}>
      <span className="text-[26px] font-black tracking-[-0.05em]">nile</span>
      <svg viewBox="0 0 56 12" className="-mt-1 ml-0.5 h-[9px] w-[44px]" aria-hidden>
        <path d="M2 3q26 11 48 1" fill="none" stroke="#ff9900" strokeWidth="3" strokeLinecap="round" />
        <path d="M45 1l6 2.6-4 5" fill="none" stroke="#ff9900" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function CartIcon({ className }: P) {
  return (
    <svg viewBox="0 0 40 32" className={className} aria-hidden>
      <path d="M2 5h6.5l5 16h19l4.5-12H11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15.5" cy="27" r="2.4" fill="currentColor" />
      <circle cx="29.5" cy="27" r="2.4" fill="currentColor" />
    </svg>
  )
}

export function PinIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor" />
    </svg>
  )
}

export function SearchIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function MenuIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function CloseIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function UserIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" />
    </svg>
  )
}

export function CaretIcon({ className }: P) {
  return (
    <svg viewBox="0 0 10 6" className={className} aria-hidden>
      <path d="M0 0h10L5 6z" fill="currentColor" />
    </svg>
  )
}

export function ChevronIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

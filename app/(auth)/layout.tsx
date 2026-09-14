import Link from 'next/link'
import { Logo } from '@/components/icons'

// Amazon's sign-in pages drop the store header: just the logo, the form and a thin footer.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <Link href="/" aria-label="nile home" className="mt-3 mb-3 rounded-sm px-2 py-1 focus-visible:ring-2 focus-visible:ring-focus">
        <Logo tone="dark" />
      </Link>
      <div className="w-full max-w-[350px] flex-1 px-4 sm:px-0">{children}</div>
      <footer className="mt-10 w-full border-t border-line bg-gradient-to-b from-[#f7f7f7] to-white py-6 text-center text-[11px] text-muted">
        <p>© 2026 nile, a working rebuild of Amazon.com. Not affiliated with Amazon.</p>
      </footer>
    </div>
  )
}

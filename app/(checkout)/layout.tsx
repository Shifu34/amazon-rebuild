import Link from 'next/link'
import { LockIcon } from '@/components/checkout/icons'
import { CartIcon, Logo } from '@/components/icons'

// Amazon's checkout drops the store header: logo, "Secure checkout" and a way back to the cart.
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-[#f0f2f2]">
      <header className="border-b border-line bg-gradient-to-b from-white to-[#f3f3f3]">
        <div className="mx-auto grid h-[60px] max-w-[1150px] grid-cols-[auto_1fr_auto] items-center gap-2 px-4">
          <Link href="/" aria-label="nile home" className="rounded-sm px-1 pt-1 focus-visible:ring-2 focus-visible:ring-focus">
            <Logo tone="dark" />
          </Link>
          <h1 className="flex items-center justify-center gap-2 text-lg font-normal sm:text-2xl">
            Secure checkout <LockIcon className="size-4 text-muted" />
          </h1>
          <Link href="/cart" aria-label="Cart" className="flex items-end gap-1 rounded-sm px-1 text-sm font-bold hover:text-link-hover focus-visible:ring-2 focus-visible:ring-focus">
            <CartIcon className="h-7 w-9" />
            <span aria-hidden className="hidden sm:inline">Cart</span>
          </Link>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-line bg-white px-4 py-5 text-center text-[11px] text-muted">
        © 2026 nile, a working rebuild of Amazon.com. Not affiliated with Amazon. Demo store: no real orders or charges.
      </footer>
    </div>
  )
}

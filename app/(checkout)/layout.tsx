import Link from 'next/link'
import { LockIcon } from '@/components/checkout/icons'
import { BagIcon } from '@/components/icons'
import { RegionProvider } from '@/components/region-provider'
import { getRegion } from '@/lib/region-server'

// Checkout drops the shop chrome: the wordmark, where you are, and a way back to the bag (docs/design.md).
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const { currency, rate, country } = await getRegion()
  return (
    <RegionProvider currency={currency} rate={rate} country={country}>
      <div className="flex flex-1 flex-col bg-paper">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto grid h-[72px] max-w-[1120px] grid-cols-[auto_1fr_auto] items-center gap-2 px-4">
            <Link href="/" aria-label="nile home" className="rounded-sm px-1 focus-visible:ring-2 focus-visible:ring-focus">
              <span className="font-display text-[26px] leading-none tracking-[-0.02em]">nile<span className="text-accent">.</span></span>
            </Link>
            <h1 className="flex items-center justify-center gap-2 text-lg font-normal sm:text-xl">
              Secure checkout <LockIcon className="size-4 text-muted" />
            </h1>
            <Link href="/cart" aria-label="Cart" className="flex items-center gap-1.5 rounded-sm px-1 text-sm font-medium hover:text-link-hover focus-visible:ring-2 focus-visible:ring-focus">
              <BagIcon className="size-6" />
              <span aria-hidden className="hidden sm:inline">Bag</span>
            </Link>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-line bg-surface px-4 py-6 text-center text-xs text-muted">
          © 2026 nile. A demo store: nothing is charged and nothing ships.
        </footer>
      </div>
    </RegionProvider>
  )
}

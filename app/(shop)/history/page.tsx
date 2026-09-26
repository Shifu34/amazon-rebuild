import type { Metadata } from 'next'
import Link from 'next/link'
import { clearViewed, pauseHistory, removeViewed } from '@/app/actions/account'
import { FreshOnBack } from '@/components/account/fresh-on-back'
import { ConfirmDialog } from '@/components/account/modal'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { ProductCard } from '@/components/product-card'
import { requireUser } from '@/lib/auth'
import { cartQuantities } from '@/lib/cart'
import { getHistory, historyPaused } from '@/lib/history'

export const metadata: Metadata = { title: 'Your Browsing History' }

export default async function HistoryPage() {
  const user = await requireUser('/history')
  const [items, paused, inCart] = await Promise.all([getHistory(user.id, 200), historyPaused(user.id), cartQuantities()])

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-[28px] leading-9">Your Browsing History</h1>
          <p className="mt-1 max-w-[70ch] text-sm text-muted">These items were viewed recently. We use them to personalize recommendations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <form action={pauseHistory} className="flex items-center gap-2">
            <input type="hidden" name="paused" value={String(!paused)} />
            <span id="history-switch">Browsing history</span>
            <button
              type="submit"
              role="switch"
              aria-checked={!paused}
              aria-labelledby="history-switch"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full p-0.5 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
            >
              <span aria-hidden className={`relative h-6 w-11 rounded-full transition-colors ${paused ? 'bg-line' : 'bg-accent'}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-surface shadow-[0_1px_2px_rgba(25,23,19,0.25)] transition-all ${paused ? 'left-0.5' : 'left-[22px]'}`} />
              </span>
              <b aria-hidden className="w-6 text-left font-medium">{paused ? 'Off' : 'On'}</b>
            </button>
          </form>
          {items.length > 0 && !paused && (
            <ConfirmDialog label="Remove all items" title="Remove all items" action={clearViewed} confirm="Remove all" cancel="Cancel">
              Remove all items from your browsing history? This can&apos;t be undone.
            </ConfirmDialog>
          )}
        </div>
      </div>

      {paused ? (
        <Empty title="Browsing history is turned off. Items you view won't appear here.">
          Turn browsing history back on to find your way back to products you&apos;ve looked at.
        </Empty>
      ) : items.length === 0 ? (
        <Empty title="You have no recently viewed items.">
          After viewing product detail pages, look here to find an easy way to navigate back to pages you are interested in.
        </Empty>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map(({ product: p }, i) => (
            <li key={p.id}>
              <ProductCard product={p} priority={i < 5}>
                <div className="space-y-2">
                  {p.stock > 0 && <AddToCartButton productId={p.id} inCart={inCart.get(p.id)} />}
                  <form action={removeViewed}>
                    <input type="hidden" name="productId" value={p.id} />
                    <button type="submit" aria-label={`Remove ${p.title} from view`} className="link cursor-pointer text-sm">Remove from view</button>
                  </form>
                </div>
              </ProductCard>
            </li>
          ))}
        </ul>
      )}
      <FreshOnBack />
    </div>
  )
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h2 className="text-xl">{title}</h2>
      <p className="mt-2 text-sm text-muted">{children}</p>
      <Link href="/" className="btn btn-cart btn-lg mt-6">Continue shopping</Link>
    </div>
  )
}

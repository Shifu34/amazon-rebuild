import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Checkout } from '@/components/checkout/checkout'
import { formatAddress, getAddresses } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'
import { getCart, MAX_QTY } from '@/lib/cart'
import { getProduct } from '@/lib/catalog'
import { deliveryPromise } from '@/lib/delivery'
import { buyNowLine, cartLines, linesKey, quote, type OrderLine } from '@/lib/orders'
import { getShopperPrices } from '@/lib/price-lock'
import { cardExpiry, cardLabel, getCards } from '@/lib/payments'
import { countryCodeFromName, type CountryCode } from '@/lib/region'

export const metadata: Metadata = { title: 'Secure checkout' }

// Two modes: the cart's in-stock lines (default) or ?buy=<productId>&qty=<n> for just that item (cart untouched).
// The shopper's picks (?address, ?card, ?speed) are kept in the URL by the client so they survive Back.
export default async function CheckoutPage({ searchParams }: PageProps<'/checkout'>) {
  const sp = await searchParams
  const buy = typeof sp.buy === 'string' ? sp.buy : null
  const qty = typeof sp.qty === 'string' ? sp.qty : '1'
  const user = await requireUser(buy ? `/checkout?buy=${encodeURIComponent(buy)}&qty=${encodeURIComponent(qty)}` : '/checkout')

  let lines: OrderLine[]
  const notices: string[] = []
  if (buy) {
    const line = buyNowLine(buy, qty, await getShopperPrices(user.id))
    if (!line) return <Unavailable productId={getProduct(Number(buy))?.id} />
    lines = [line]
  } else {
    lines = await cartLines()
    if (!lines.length) redirect('/cart')
    for (const l of await getCart()) {
      if (!l.savedForLater && l.product.stock <= 0) notices.push(`${l.product.title} is currently unavailable and isn't included in this order.`)
    }
  }
  for (const l of lines) {
    if (l.quantity < l.requested) notices.push(`Only ${l.quantity} of ${l.product.title} can be ordered, so we changed the quantity to ${l.quantity}.`)
  }

  const [addresses, cards] = await Promise.all([getAddresses(user.id), getCards(user.id)])
  const now = new Date()
  // both countries up front: the client switches dates, fees and tax with the selected address, no round trip
  const arrives = (p: OrderLine['product'], c: CountryCode) => {
    const { standard, expedited } = deliveryPromise(p, now, c)
    return { standard, expedited }
  }
  const quotes = (c: CountryCode) => ({ standard: quote(lines, 'standard', now, c), expedited: quote(lines, 'expedited', now, c) })
  return (
    <Checkout
      token={randomUUID()}
      buy={buy ? { id: buy, qty: lines[0].quantity } : null}
      lines={lines.map(({ product: p, quantity }) => ({
        // each line's own date, from the same promise as the product page and quote() (whose deliverBy is the latest of these)
        id: p.id, title: p.title, thumbnail: p.thumbnail, price: p.price, quantity, stock: p.stock, max: Math.min(p.stock, MAX_QTY),
        arrives: { US: arrives(p, 'US'), PK: arrives(p, 'PK') },
      }))}
      linesKey={linesKey(lines)}
      quotes={{ US: quotes('US'), PK: quotes('PK') }}
      addresses={addresses.map((a) => ({ ...a, oneLine: [formatAddress(a), countryCodeFromName(a.country) !== 'US' && a.country].filter(Boolean).join(', ') }))}
      cards={cards.map((c) => ({ ...c, label: cardLabel(c), expiry: cardExpiry(c) }))}
      notices={notices}
    />
  )
}

function Unavailable({ productId }: { productId?: number }) {
  return (
    <div className="mx-auto w-full max-w-[600px] px-4 py-10">
      <div className="rounded-lg border border-line bg-white p-6 text-center">
        <h2 className="text-xl">{productId ? 'This item is currently unavailable.' : "We couldn't find that item."}</h2>
        <p className="mt-2 text-sm text-muted">
          {productId ? "We don't know when or if this item will be back in stock." : 'The link may be broken, or the item is no longer sold on nile.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {productId && <Link href={`/dp/${productId}`} className="btn btn-plain">View item</Link>}
          <Link href="/" className="btn btn-cart">Continue shopping</Link>
        </div>
      </div>
    </div>
  )
}

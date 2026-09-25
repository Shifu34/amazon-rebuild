import type { Metadata } from 'next'
import Link from 'next/link'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { CartFeedback, LineControls, SavedControls } from '@/components/cart/cart-controls'
import { CheckCircleIcon } from '@/components/checkout/icons'
import { CartIcon } from '@/components/icons'
import { ProductCarousel } from '@/components/product-carousel'
import { Badge } from '@/components/product-card'
import { getUser } from '@/lib/auth'
import { getCart, MAX_QTY, type CartLine } from '@/lib/cart'
import { deals, related, type Product } from '@/lib/catalog'
import { deliveryPromise, relativeDay, shippingRates } from '@/lib/delivery'
import { plural, toCents } from '@/lib/format'
import { getHistory } from '@/lib/history'
import { cartLines, quote } from '@/lib/orders'
import { COUNTRIES, formatDollars, formatMinor, formatMoney, itemsTotal, summarize } from '@/lib/region'
import { getRegion, type RequestRegion } from '@/lib/region-server'

export const metadata: Metadata = { title: 'Shopping Cart' }

export default async function CartPage() {
  const [user, lines, buyable, region] = await Promise.all([getUser(), getCart(), cartLines(), getRegion()])
  const { currency, rate, country } = region
  const active = lines.filter((l) => !l.savedForLater)
  const saved = lines.filter((l) => l.savedForLater)
  const unavailable = active.filter((l) => l.product.stock <= 0)
  const { itemCount, itemsCents, dutyCents } = quote(buyable, 'standard', undefined, country)
  // unit prices as shown × quantities, so the lines add up to the subtotal in PKR too
  const items = itemsTotal(buyable.map((l) => ({ priceCents: toCents(l.product.price), quantity: l.quantity })), currency, rate)
  const subtotal = (
    <>
      Subtotal ({plural(itemCount, 'item')}): <b className="whitespace-nowrap">{formatMinor(items.minor, currency)}</b>
      {/* landed cost: the duty is charged with the order, so say the amount here rather than surprising them at the door */}
      {dutyCents > 0 && (
        <span className="mt-0.5 block text-xs text-muted">
          + {formatMoney(dutyCents, currency, rate)} import duty, included at checkout. Nothing to pay on delivery.
        </span>
      )}
    </>
  )
  const inCart = new Set(lines.map((l) => l.product.id))
  const recs = (active[0] ? related(active[0].product, 20) : deals(20)).filter((p) => !inCart.has(p.id)).slice(0, 12)
  // null: this country never ships free (Pakistan). The amount left is the converted threshold minus the converted subtotal,
  // so it adds up with the subtotal shown
  const freeMin = shippingRates(country).freeMin
  const toFree = freeMin === null ? null : summarize([{ label: 'free', usdCents: toCents(freeMin) }, { label: 'subtotal', usdCents: -itemsCents, minor: -items.minor }], currency, rate).total
  // an empty cart fills its rail with what the shopper looked at recently, like Amazon
  const viewed = user && !active.length ? (await getHistory(user.id, 12)).map((h) => h.product).filter((p) => p.stock > 0 && !inCart.has(p.id)).slice(0, 4) : []

  return (
    <CartFeedback>
      <div className="bg-page">
        <div className={`mx-auto grid max-w-[1500px] gap-4 px-3 py-4 sm:px-4 lg:gap-5 lg:py-5 ${active.length || viewed.length ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
          {/* first in the page so phones, keyboards and screen readers reach the subtotal first; the rail on desktop */}
          {active.length > 0 && (
            <aside aria-label="Cart subtotal" className="self-start rounded-lg bg-white p-4 sm:p-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1">
              {itemCount > 0 && !toFree && (
                <p className="mb-3 text-[13px]">
                  Ships to {COUNTRIES[country].name} · <span className="text-muted">International shipping calculated at checkout</span>
                </p>
              )}
              {itemCount > 0 && toFree && toFree.usdCents <= 0 && (
                <p className="mb-3 flex gap-2 text-[13px]">
                  <CheckCircleIcon className="size-5 shrink-0 text-success" />
                  <span>
                    <span className="text-success">Your order qualifies for FREE Shipping.</span> Choose this option at checkout.
                  </span>
                </p>
              )}
              {itemCount > 0 && toFree && toFree.usdCents > 0 && (
                <div className="mb-3 text-[13px]">
                  <progress
                    value={itemsCents}
                    max={itemsCents + toFree.usdCents}
                    aria-label="Progress toward FREE Shipping"
                    className="mb-1.5 block h-2 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-success [&::-webkit-progress-bar]:bg-[#e3e6e6] [&::-webkit-progress-value]:bg-success"
                  />
                  Add <b className="whitespace-nowrap text-danger">{toFree.text}</b> of eligible items to your order to qualify for FREE Shipping.
                </div>
              )}
              <p className="text-lg">{subtotal}</p>
              {itemCount > 0 ? (
                <Link href="/checkout" className="btn btn-cart btn-lg mt-3 w-full">Proceed to checkout</Link>
              ) : (
                <>
                  <button type="button" disabled className="btn btn-cart btn-lg mt-3 w-full">Proceed to checkout</button>
                  <p className="mt-2 text-xs text-muted">None of the items in your cart can be ordered right now.</p>
                </>
              )}
            </aside>
          )}

          <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1 lg:space-y-5">
            <section className="rounded-lg bg-white p-4 sm:p-5">
              {unavailable.length > 0 && (
                <div className="mb-4 rounded-lg border border-[#ffb14a] px-4 py-3 shadow-[0_0_0_4px_#fffaf3_inset]">
                  <h2 className="text-[15px]">Important messages about items in your Cart:</h2>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px]">
                    {unavailable.map((l) => (
                      <li key={l.product.id}>
                        <b>{l.product.title}</b> is currently unavailable, so it isn&apos;t included in your subtotal. Save it for later or delete it.
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {active.length > 0 ? (
                <>
                  <div className="flex items-end justify-between border-b border-line pb-1">
                    <h1 className="text-[28px] leading-9 font-normal">Shopping Cart</h1>
                    <span className="hidden text-sm text-muted sm:block">Price</span>
                  </div>
                  <ul>
                    {active.map((l, i) => (
                      <Line key={l.product.id} line={l} eager={i < 3} region={region} />
                    ))}
                  </ul>
                  <p className="border-t border-line pt-3 text-right text-lg">{subtotal}</p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-6 py-4 text-center sm:flex-row sm:items-center sm:text-left">
                  <CartIcon className="h-32 w-40 shrink-0 text-[#c8cccc]" />
                  <div>
                    <h1 className="text-2xl leading-8">Your nile Cart is empty</h1>
                    {user ? (
                      <p className="mt-1 text-sm">
                        {saved.length > 0 && 'Your Saved for later items are below. '}
                        Continue shopping on the <Link href="/" className="link">nile homepage</Link>, learn about{' '}
                        <Link href="/deals" className="link">today&apos;s deals</Link>, or visit your <Link href="/lists" className="link">Wish List</Link>.
                      </p>
                    ) : (
                      <>
                        <Link href="/deals" className="link text-sm">Shop today&apos;s deals</Link>
                        <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
                          <Link href="/ap/signin?return_to=%2Fcart" className="btn btn-cart">Sign in to your account</Link>
                          <Link href="/ap/register?return_to=%2Fcart" className="btn btn-plain">Sign up now</Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>

            {saved.length > 0 && (
              <section aria-labelledby="saved-heading" className="rounded-lg bg-white p-4 sm:p-5">
                <h2 id="saved-heading" className="border-b border-line pb-2 text-xl">Saved for later ({plural(saved.length, 'item')})</h2>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-6 pt-4 sm:grid-cols-3 xl:grid-cols-5">
                  {saved.map((l) => (
                    <SavedItem key={l.product.id} line={l} region={region} />
                  ))}
                </ul>
              </section>
            )}

            <p className="px-1 text-xs text-muted">
              The price and availability of items at nile are subject to change. The Cart is a temporary place to store a list of your items and reflects each
              item&apos;s most recent price.
            </p>
          </div>

          {viewed.length > 0 && (
            <aside aria-labelledby="viewed-heading" className="self-start rounded-lg bg-white p-4">
              <h2 id="viewed-heading" className="text-lg leading-6 font-bold">Your recently viewed items</h2>
              <ul className="mt-3 space-y-4">
                {viewed.map((p) => (
                  <li key={p.id} className="flex gap-3">
                    <Thumb product={p} eager className="size-20" />
                    <div className="min-w-0 text-sm">
                      <Link href={`/dp/${p.id}`} className="link line-clamp-2">{p.title}</Link>
                      <p className="font-bold">{formatDollars(p.price, currency, rate)}</p>
                      <AddToCartButton productId={p.id} className="mt-1" />
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
        {recs.length > 0 && (
          // overflow-hidden: the carousel's sr-only price text is absolutely positioned outside its scroll container
          <div className="mx-auto max-w-[1500px] overflow-hidden px-3 pb-6 sm:px-4">
            <ProductCarousel title={active[0] ? 'Customers who bought items in your cart also bought' : "Today's Deals"} products={recs} loading={active[0] ? 'lazy' : 'eager'} />
          </div>
        )}
      </div>
    </CartFeedback>
  )
}

// eager for images visible when the page opens; the rest load lazily
function Thumb({ product: p, eager, className }: { product: Product; eager?: boolean; className: string }) {
  return (
    <Link href={`/dp/${p.id}`} aria-hidden tabIndex={-1} className={`flex shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-1.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.thumbnail} alt="" loading={eager ? undefined : 'lazy'} className="max-h-full max-w-full object-contain mix-blend-multiply" />
    </Link>
  )
}

function StockLine({ product: p }: { product: Product }) {
  if (p.stock <= 0) return <p className="text-sm text-danger">Currently unavailable.</p>
  if (p.stock < 10) return <p className="text-xs text-danger">Only {p.stock} left in stock - order soon.</p>
  return <p className="text-xs text-success">In Stock</p>
}

// phones: image and details side by side, controls full width underneath; desktop: controls under the details
function Line({ line: { product: p, quantity }, eager, region: { currency, rate, country } }: { line: CartLine; eager: boolean; region: RequestRegion }) {
  const available = p.stock > 0
  const max = Math.min(p.stock, MAX_QTY)
  return (
    <li className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 border-b border-line py-4 transition-opacity last:border-0 has-[[data-pending]]:opacity-50 sm:grid-cols-[176px_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-5">
      <Thumb product={p} eager={eager} className="size-24 sm:row-span-2 sm:size-44" />
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-6">
          <h3 className="text-base leading-6 font-normal sm:text-lg">
            <Link href={`/dp/${p.id}`} className="line-clamp-3 hover:text-link-hover hover:underline">{p.title}</Link>
          </h3>
          {available && (
            <div className="shrink-0 sm:text-right">
              <p className="text-lg leading-6 font-bold">{formatDollars(p.price, currency, rate)}</p>
              {p.listPrice && <p className="text-xs text-muted">List: <s>{formatDollars(p.listPrice, currency, rate)}</s></p>}
            </div>
          )}
        </div>
        {p.badge && <Badge badge={p.badge} />}
        <StockLine product={p} />
        {available && (
          <p className="text-xs">
            Arrives <b>{relativeDay(deliveryPromise(p, undefined, country).standard)}</b>
            {country === 'US' ? ' · Eligible for FREE Shipping' : ` · Ships to ${COUNTRIES[country].name}`}
          </p>
        )}
        {available && quantity > max && <p className="text-xs text-danger">Only {max} available, so {max} will be ordered at checkout.</p>}
      </div>
      <div className="col-span-2 sm:col-span-1 sm:col-start-2">
        <LineControls productId={p.id} title={p.title} quantity={quantity} max={available ? max : 0} maxNote={max === MAX_QTY ? `Limit ${MAX_QTY} per customer` : `Only ${max} available`} />
      </div>
    </li>
  )
}

function SavedItem({ line: { product: p, quantity }, region: { currency, rate } }: { line: CartLine; region: RequestRegion }) {
  return (
    <li className="flex min-w-0 flex-col transition-opacity has-[[data-pending]]:opacity-50">
      <Thumb product={p} className="aspect-square w-full p-3" />
      <Link href={`/dp/${p.id}`} className="mt-2 line-clamp-2 text-sm hover:text-link-hover hover:underline">{p.title}</Link>
      {p.stock > 0 && <p className="font-bold">{formatDollars(p.price, currency, rate)}</p>}
      <StockLine product={p} />
      <SavedControls productId={p.id} title={p.title} quantity={quantity} available={p.stock > 0} />
    </li>
  )
}

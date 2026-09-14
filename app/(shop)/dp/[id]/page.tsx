import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { AddToList } from '@/components/add-to-list'
import { PinIcon } from '@/components/icons'
import { LocationPicker } from '@/components/nav-drawer'
import { BoughtTogether } from '@/components/pdp/bought-together'
import { PurchaseControls } from '@/components/pdp/buy-box'
import { Gallery } from '@/components/pdp/gallery'
import { RatingBreakdown, ReviewCard, WriteReviewPrompt } from '@/components/pdp/reviews'
import { Price } from '@/components/price'
import { Badge } from '@/components/product-card'
import { ProductCarousel } from '@/components/product-carousel'
import { Scroller } from '@/components/scroller'
import { Stars } from '@/components/stars'
import { getUser } from '@/lib/auth'
import { cartSummary, MAX_QTY } from '@/lib/cart'
import { boughtTogether, categoryName, DEPARTMENTS, getProduct, inCategory, isDeal, popularity, products, related, type Product } from '@/lib/catalog'
import { one } from '@/lib/db'
import { deliveryPromise, deliveryText, relativeDay } from '@/lib/delivery'
import { compactCount, fullDate, longDate, plural } from '@/lib/format'
import { getHistory, recordView } from '@/lib/history'
import { getLists } from '@/lib/lists'
import { formatDollars, IMPORT_FEES_NOTE } from '@/lib/region'
import { getRegion } from '@/lib/region-server'
import { productReviews, sortReviews } from '@/lib/reviews'

type Props = { params: Promise<{ id: string }> }

const findProduct = (id: string) => (/^\d{1,9}$/.test(id) ? getProduct(Number(id)) : undefined)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = findProduct((await params).id)
  return p ? { title: p.title, description: p.description } : { title: 'Page not found' }
}

const DAY = 86_400_000

const dayLabel = (d: Date) => {
  const rel = relativeDay(d)
  return rel === 'Today' || rel === 'Tomorrow' ? `${rel}, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}` : longDate(d)
}

const titleCase = (s: string) => s.replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase())

function aboutBullets(p: Product): [string, string][] {
  const sentences = (p.description.match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).map((s) => s.trim()).filter(Boolean)
  return [
    ...sentences.map((s): [string, string] => ['', s]),
    ...(p.tags.length ? [['PRODUCT TYPE', p.tags.map(titleCase).join(', ')] as [string, string]] : []),
    ['WARRANTY', `${p.warranty}.`],
    ['SHIPPING', `${p.shipping}.`],
    ['RETURNS', `${p.returnPolicy}.`],
  ]
}

// Native popover: click to open, Esc or click outside to close, no JS.
function InfoPopover({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <>
      <button type="button" popoverTarget={id} aria-label={label} className="ml-1 inline-flex size-4 cursor-pointer items-center justify-center rounded-full border border-muted align-[-2px] text-[10px] leading-none text-muted hover:border-link-hover hover:text-link-hover">
        i
      </button>
      <span id={id} popover="auto" className="m-auto w-[min(360px,90vw)] rounded-lg border border-line bg-white p-4 text-sm text-ink shadow-[0_0_14px_rgba(15,17,17,0.5)]">
        {children}
      </span>
    </>
  )
}

function InfoTable({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div>
      <h3 className="mb-2 text-lg">{title}</h3>
      <table className="w-full border-t border-line text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-line">
              <th scope="row" className="w-2/5 bg-[#f0f2f2] px-3 py-2 text-left align-top">{k}</th>
              <td className="px-3 py-2 break-words">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const slim = ({ id, title, thumbnail, price }: Product) => ({ id, title, thumbnail, price })

export default async function ProductPage({ params }: Props) {
  const p = findProduct((await params).id)
  if (!p) notFound()

  const user = await getUser()
  const [cart, address, lists, { reviews, summary, mine }, history, { currency, rate, country, countryName }, jar] = await Promise.all([
    cartSummary(),
    user
      ? one<{ full_name: string; city: string; zip: string }>('select full_name, city, zip from addresses where user_id = $1 order by is_default desc, created_at desc limit 1', [user.id])
      : undefined,
    user ? getLists(user.id) : [],
    productReviews(p, user?.id),
    user ? getHistory(user.id, 21) : [],
    getRegion(),
    cookies(),
  ])
  if (user) after(() => recordView(user.id, p.id))

  const dept = DEPARTMENTS.find((d) => d.categories.includes(p.category))
  const category = categoryName(p.category)
  const inStock = p.stock > 0
  const promise = deliveryPromise(p, new Date(), country)
  const { standard, fastest, within } = promise
  const { label, note } = deliveryText(promise, currency, rate)
  const zip = jar.get('zip')?.value
  const deliverTo = address
    ? `Deliver to ${address.full_name.split(' ')[0]} - ${address.city} ${address.zip}`
    : `Deliver to ${country === 'US' && zip && /^\d{5}$/.test(zip) ? zip : countryName}`
  const pin = (
    <>
      <PinIcon className="size-4 shrink-0" />
      {deliverTo}
    </>
  )
  const countdown = within && (
    <>
      . Order within <span className="whitespace-nowrap text-success">{within}</span>
    </>
  )
  const returnDays = Number(p.returnPolicy.match(/\d+/)?.[0] ?? 0)
  const cartTotals = { count: cart.count, subtotalCents: cart.subtotalCents }
  const inCart = cart.lines.find((l) => l.product.id === p.id)?.quantity ?? 0
  const rank = inCategory(p.category).sort((a, b) => b.boughtPastMonth - a.boughtPastMonth || b.ratingCount - a.ratingCount).findIndex((x) => x.id === p.id) + 1
  const pairs = inStock ? boughtTogether(p) : []
  const relatedItems = products
    .filter((x) => dept?.categories.includes(x.category) && x.category !== p.category && x.stock > 0 && !pairs.includes(x))
    .sort((a, b) => popularity(b) - popularity(a))
    .slice(0, 12)
  const topReviews = sortReviews(reviews, 'helpful').slice(0, 8)
  const recent = history.filter((h) => h.product.id !== p.id).slice(0, 20)
  // The catalog's weight and dimensions are unitless demo numbers (a 4 "pound" mascara), so they stay off the page.
  const specs: [string, string][] = [
    ['Brand', p.brand ?? 'Generic'],
    ['Category', category],
    ['SKU', p.sku],
    ['Warranty', p.warranty],
  ]
  const signInHere = `/ap/signin?return_to=${encodeURIComponent(`/dp/${p.id}`)}`
  const jump = 'flex h-10 items-center hover:text-link-hover hover:underline'

  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-3">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {dept && (
            <>
              <li><Link href={`/s?i=${dept.slug}`} className="hover:text-link-hover hover:underline">{dept.name}</Link></li>
              <li aria-hidden>›</li>
            </>
          )}
          <li><Link href={`/s?i=${p.category}`} className="hover:text-link-hover hover:underline">{category}</Link></li>
        </ol>
      </nav>

      {/* DOM order is gallery, title, price, buy box, specs so focus follows the columns; on phones the title moves above the gallery. */}
      <div className="mt-3 grid gap-x-8 gap-y-4 pb-6 md:grid-cols-2 md:grid-rows-[auto_auto_auto_1fr] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(240px,270px)] lg:grid-rows-[auto_auto_1fr]">
        <div className="md:sticky md:top-3 md:col-start-1 md:row-span-4 md:row-start-1 md:self-start lg:row-span-3">
          <Gallery images={p.images.length ? p.images : [p.thumbnail]} title={p.title} />
        </div>

        <div className="max-md:order-first md:col-start-2 md:row-start-1">
          <h1 className="text-xl leading-7 font-normal md:text-2xl md:leading-8">{p.title}</h1>
          {p.brand && <Link href={`/s?brand=${encodeURIComponent(p.brand)}`} className="link text-sm">Visit the {p.brand} Store</Link>}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm">
            <span>{summary.average.toFixed(1)}</span>
            <Stars rating={summary.average} />
            <Link href="#reviews" className="link">{plural(summary.total, 'rating')}</Link>
          </div>
          {p.badge === 'best-seller' && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-sm bg-[#c45500] px-1.5 py-0.5 font-bold text-white">#1 Best Seller</span>
              <Link href={`/s?i=${p.category}&sort=bestsellers`} className="link">in {category}</Link>
            </p>
          )}
          {p.badge === 'amazons-choice' && (
            <p className="mt-1.5 text-xs">
              <Badge badge={p.badge} />
              <InfoPopover id="choice-info" label="About nile's Choice">nile&apos;s Choice highlights highly rated, well-priced products available to ship immediately.</InfoPopover>
            </p>
          )}
          {p.boughtPastMonth > 0 && (
            <p className="mt-1.5 text-sm text-muted"><b className="text-ink">{compactCount(p.boughtPastMonth)} bought</b> in past month</p>
          )}
        </div>

        {inStock && (
          <div className="border-t border-line pt-3 md:col-start-2 md:row-start-2">
            {isDeal(p) && <span className="rounded-sm bg-deal px-1.5 py-0.5 text-xs font-bold text-white">Deal</span>}
            <div className="mt-1 flex items-start gap-2">
              {p.discount > 0 && <span className="text-[28px] leading-8 font-light text-deal">-{p.discount}%</span>}
              <span className="text-[28px] leading-8"><Price value={p.price} currency={currency} rate={rate} /></span>
            </div>
            {p.listPrice && (
              <p className="mt-1 text-xs text-muted">
                List Price: <s>{formatDollars(p.listPrice, currency, rate)}</s>
                <InfoPopover id="list-price-info" label="About List Price">
                  The List Price is the suggested retail price of a new product as provided by a manufacturer, supplier, or seller.
                </InfoPopover>
              </p>
            )}
          </div>
        )}

        {/* lg:z-30: sticky makes the aside a stacking context, so without it the Add to List menu would sit under the sticky nav below */}
        <aside aria-label="Buy box" className="rounded-lg border border-line p-4 md:col-start-2 md:row-start-3 lg:sticky lg:top-3 lg:z-30 lg:col-start-3 lg:row-span-3 lg:row-start-1 lg:self-start">
          {inStock ? (
            <>
              <div className="mb-2 hidden text-[28px] leading-8 lg:block"><Price value={p.price} currency={currency} rate={rate} /></div>
              <div className="space-y-2 text-sm">
                <p>
                  {label} <b>{dayLabel(standard)}</b>
                  {!fastest && countdown}
                </p>
                {note && <p className="text-xs text-muted">{note}</p>}
                {fastest && (
                  <p>
                    Or fastest delivery <b>{dayLabel(fastest)}</b> for <b className="whitespace-nowrap">{formatDollars(promise.expeditedFeeUsd, currency, rate)}</b>
                    {countdown}
                  </p>
                )}
                {country === 'PK' && (
                  <p>
                    <b>Ships to {countryName}</b>
                    <span className="block text-xs text-muted">{IMPORT_FEES_NOTE}</span>
                  </p>
                )}
              </div>
              {/* signed in: the address book; guests: the header's location dialog (sign in or pick a place) */}
              {user ? (
                <Link href="/account/addresses" className="link mt-3 flex items-center gap-1 text-xs">{pin}</Link>
              ) : (
                <LocationPicker className="link mt-3 flex cursor-pointer items-center gap-1 text-left text-xs">{pin}</LocationPicker>
              )}
              <p className={`mt-3 text-lg ${p.stock < 10 ? 'text-[#c10015]' : 'text-success'}`}>
                {p.stock < 10 ? `Only ${p.stock} left in stock - order soon.` : 'In Stock'}
              </p>
              <div className="mt-3">
                <PurchaseControls product={slim(p)} max={Math.min(p.stock, MAX_QTY)} stock={p.stock} signedIn={!!user} inCart={inCart} cart={cartTotals} picks={pairs.map(slim)} />
              </div>
              <table className="mt-4 w-full text-xs">
                <tbody>
                  <tr><th scope="row" className="w-20 py-0.5 pr-2 text-left align-top font-normal text-muted">Ships from</th><td>nile</td></tr>
                  <tr><th scope="row" className="py-0.5 pr-2 text-left align-top font-normal text-muted">Sold by</th><td>nile</td></tr>
                  <tr>
                    <th scope="row" className="py-0.5 pr-2 text-left align-top font-normal text-muted">Returns</th>
                    <td>
                      {returnDays ? `Returnable until ${fullDate(new Date(standard.getTime() + returnDays * DAY))}` : 'Non-returnable'}
                      <InfoPopover id="returns-info" label="Return policy details">
                        {returnDays ? `Eligible for Return, Refund or Replacement within ${returnDays} days of receipt.` : 'This item is non-returnable.'}
                      </InfoPopover>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-0.5 pr-2 text-left align-top font-normal text-muted">Payment</th>
                    <td>
                      <button type="button" popoverTarget="payment-info" className="link cursor-pointer">Secure transaction</button>
                      <span id="payment-info" popover="auto" className="m-auto w-[min(360px,90vw)] rounded-lg border border-line bg-white p-4 text-sm text-ink shadow-[0_0_14px_rgba(15,17,17,0.5)]">
                        Your transaction is secure. This is a demo store: payments are simulated, nothing is charged, and full card numbers are never stored.
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : (
            <>
              <p className="text-lg text-[#c10015]">Currently unavailable.</p>
              <p className="mt-1 text-sm">We don&apos;t know when or if this item will be back in stock.</p>
            </>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <AddToList productId={p.id} lists={lists.map(({ id, name, isDefault }) => ({ id, name, isDefault }))} signedIn={!!user} />
          </div>
        </aside>

        <div className="border-t border-line pt-4 md:col-start-2 md:row-start-4 lg:row-start-3">
          <table className="text-sm">
            <tbody>
              {specs.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row" className="py-1 pr-6 text-left align-top">{k}</th>
                  <td className="py-1 break-words">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 id="about" className="mt-4 scroll-mt-12 border-t border-line pt-4 text-base">About this item</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {aboutBullets(p).map(([lead, text]) => (
              <li key={lead + text}>{lead && <b>{lead}: </b>}{text}</li>
            ))}
          </ul>
          <Link href="#product-details" className="link mt-2 inline-block text-sm">› See more product details</Link>
        </div>
      </div>

      {/* In flow under the hero, then sticks to the top while the long lower page scrolls. */}
      <nav aria-label="On this page" className="sticky top-0 z-20 -mx-4 -mb-px flex items-center gap-6 border-y border-line bg-white px-4 text-[13px] sm:text-sm">
        <ul className="flex min-w-0 flex-1 gap-4 overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:gap-5">
          <li className="max-sm:hidden"><a href="#" className={jump}>↑ Top</a></li>
          <li><a href="#about" className={jump}>About this item</a></li>
          <li><a href="#similar" className={jump}>Similar</a></li>
          <li><a href="#product-details" className={jump}>Product information</a></li>
          <li><a href="#reviews" className={jump}>Reviews</a></li>
        </ul>
        <div className="hidden max-w-72 min-w-0 items-center gap-2 md:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumbnail} alt="" loading="lazy" className="size-8 shrink-0 object-contain mix-blend-multiply" />
          <span className="line-clamp-2 text-xs">{p.title}</span>
        </div>
      </nav>

      {pairs.length > 0 && <BoughtTogether items={[p, ...pairs].map(slim)} cart={cartTotals} />}

      {relatedItems.length > 0 && (
        <div id="similar" className="-mx-4 scroll-mt-10 overflow-hidden border-t border-line">
          <ProductCarousel title="Products related to this item" products={relatedItems} />
        </div>
      )}

      <section id="product-details" aria-labelledby="product-info-title" className="scroll-mt-10 border-t border-line py-6">
        <h2 id="product-info-title" className="text-xl">Product information</h2>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <InfoTable title="Technical Details" rows={[...specs, ['Manufacturer', p.brand ?? 'Generic']]} />
          <InfoTable
            title="Additional Information"
            rows={[
              ['nile item number', String(p.id)],
              ['Customer Reviews', <span key="r" className="flex flex-wrap items-center gap-1.5">{summary.average.toFixed(1)} <Stars rating={summary.average} /> <Link href="#reviews" className="link">{plural(summary.total, 'rating')}</Link></span>],
              ['Best Sellers Rank', <span key="b">#{rank} in {category} (<Link href={`/s?i=${p.category}&sort=bestsellers`} className="link">See Top 100 in {category}</Link>)</span>],
              ['Date First Available', fullDate(new Date(p.createdAt))],
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="description-title" className="border-t border-line py-6">
        <h2 id="description-title" className="text-xl">Product Description</h2>
        <p className="mt-2 max-w-4xl text-sm">{p.description}</p>
      </section>

      {/* Phones read summary, reviews, then the write prompt; on desktop the prompt sits under the histogram. */}
      <section id="reviews" aria-labelledby="reviews-title" className="grid scroll-mt-10 gap-x-8 gap-y-6 border-t border-line py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] lg:grid-rows-[auto_1fr]">
        <div>
          <h2 id="reviews-title" className="mb-2 text-2xl">Customer reviews</h2>
          <RatingBreakdown summary={summary} productId={p.id} />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <h3 className="text-lg">Top reviews from the United States</h3>
          {topReviews.length ? (
            <div className="divide-y divide-line">
              {topReviews.map((r) => (
                <ReviewCard key={r.id} review={r} productId={p.id} signedIn={!!user} returnTo={`/dp/${p.id}#reviews`} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm">No customer reviews</p>
          )}
          {reviews.length > topReviews.length && <Link href={`/product-reviews/${p.id}`} className="link mt-2 inline-block font-bold">See more reviews ›</Link>}
        </div>
        <div className="border-t border-line pt-6 lg:col-start-1 lg:row-start-2 lg:self-start">
          <WriteReviewPrompt productId={p.id} hasReview={!!mine} />
        </div>
      </section>

      <div id={relatedItems.length ? undefined : 'similar'} className="-mx-4 scroll-mt-10 overflow-hidden border-t border-line">
        <ProductCarousel title="Customers who viewed this item also viewed" products={related(p, 12)} />
      </div>

      {user ? (
        recent.length > 0 && (
          <section aria-labelledby="history-title" className="border-t border-line py-6">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-4">
              <h2 id="history-title" className="text-xl">Your Browsing History</h2>
              <Link href="/history" className="link text-sm">View or edit your browsing history ›</Link>
            </div>
            <Scroller label="Your Browsing History">
              {recent.map(({ product }) => (
                <li key={product.id} className="w-[120px] shrink-0 snap-start">
                  <Link href={`/dp/${product.id}`} aria-label={product.title} className="flex h-[120px] items-center justify-center rounded-sm bg-[#f7f7f7] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  </Link>
                </li>
              ))}
            </Scroller>
          </section>
        )
      ) : (
        <section className="border-t border-line py-8 text-center">
          <p className="text-sm">See personalized recommendations</p>
          <Link href={signInHere} className="btn btn-cart mt-2 w-56">Sign in</Link>
          <p className="mt-1.5 text-xs">
            New customer? <Link href={signInHere} className="link">Start here.</Link>
          </p>
        </section>
      )}
    </div>
  )
}

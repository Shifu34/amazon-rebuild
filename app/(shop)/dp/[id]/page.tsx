import type { Metadata } from 'next'
import Image from 'next/image'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { dataSaver } from '@/app/actions/data-saver'
import { AddToList } from '@/components/add-to-list'
import { PinIcon } from '@/components/icons'
import { LocationPicker } from '@/components/nav-drawer'
import { BoughtTogether } from '@/components/pdp/bought-together'
import { PurchaseControls } from '@/components/pdp/buy-box'
import { GroupBuy } from '@/components/pdp/group-buy'
import { PriceLock } from '@/components/pdp/price-lock'
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
import { deliveryPromise, deliveryText, relativeDay, shippingRates } from '@/lib/delivery'
import { compactCount, fullDate, longDate, plural, toCents } from '@/lib/format'
import { getHistory, recordView } from '@/lib/history'
import { getLists } from '@/lib/lists'
import { dutyCentsFor, formatDollars, formatMoney, IMPORT_FEES_NOTE, itemsTotal } from '@/lib/region'
import { getGroupBuy } from '@/lib/group-buy'
import { getShopperPrices, activeLock, priced } from '@/lib/price-lock'
import { getRegion } from '@/lib/region-server'
import { ReviewDigest } from '@/components/reviews/digest'
import { aspectDigest, isAspect, mentionsAspect, pinnedReviews, productReviews, sortReviews, verifiedByDefault } from '@/lib/reviews'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

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
    ...(p.tags.length ? [['Product type', p.tags.map(titleCase).join(', ')] as [string, string]] : []),
    ['Warranty', `${p.warranty}.`],
    ['Shipping', `${p.shipping}.`],
    ['Returns', `${p.returnPolicy}.`],
  ]
}

// Native popover: click to open, Esc or click outside to close, no JS.
function InfoPopover({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <>
      <button type="button" popoverTarget={id} aria-label={label} className="ml-1 inline-flex size-4 cursor-pointer items-center justify-center rounded-full border border-line align-[-2px] text-[10px] leading-none text-muted hover:border-accent hover:text-accent">
        i
      </button>
      <span id={id} popover="auto" className="card m-auto w-[min(380px,90vw)] p-4 text-sm text-ink shadow-[0_12px_30px_rgba(25,23,19,0.18)]">
        {children}
      </span>
    </>
  )
}

// Specs read as a definition list with hairlines — no grey header cells, no table chrome (docs/design.md)
function Facts({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div>
      <h3 className="mb-3 text-lg">{title}</h3>
      <dl className="text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-6 border-t border-line py-2.5 last:border-b">
            <dt className="w-2/5 shrink-0 text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const slim = ({ id, title, thumbnail, price }: Product) => ({ id, title, thumbnail, price })

export default async function ProductPage({ params, searchParams }: Props) {
  const catalogProduct = findProduct((await params).id)
  if (!catalogProduct) notFound()
  const sp = await searchParams
  const param = (k: string) => (typeof sp[k] === 'string' ? sp[k] : '')

  const user = await getUser()
  // every price on this page is the shopper's own: a locked price, a demo drop, or the shelf price
  const shopperPrices = await getShopperPrices(user?.id)
  const p = priced(catalogProduct, shopperPrices)
  const lock = activeLock(p.id, shopperPrices)
  const group = await getGroupBuy(catalogProduct.id, user?.id)
  const [cart, lists, { reviews, summary, mine }, history, { currency, rate, country, countryName, address }, jar, saver] = await Promise.all([
    cartSummary(),
    user ? getLists(user.id) : [],
    productReviews(p, user?.id),
    user ? getHistory(user.id, 21) : [],
    getRegion(),
    cookies(),
    dataSaver(),
  ])
  if (user) after(() => recordView(user.id, p.id))

  const dept = DEPARTMENTS.find((d) => d.categories.includes(p.category))
  const category = categoryName(p.category)
  const inStock = p.stock > 0
  const promise = deliveryPromise(p, new Date(), country)
  const { standard, fastest, within } = promise
  const { label, note } = deliveryText(promise, currency, rate)
  // landed cost: what an international shopper actually pays, said here instead of sprung on them at checkout
  const dutyCents = dutyCentsFor(country, p.category, toCents(p.price))
  const shipCents = toCents(shippingRates(country).standard)
  const zip = jar.get('zip')?.value
  const deliverTo = address
    ? `Deliver to ${address.fullName.split(' ')[0]} - ${address.city} ${address.zip}`
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
  const cartTotals = {
    count: cart.count,
    subtotalCents: cart.subtotalCents,
    subtotalMinor: itemsTotal(cart.lines.map((l) => ({ priceCents: toCents(l.product.price), quantity: l.quantity })), currency, rate).minor,
  }
  const inCart = cart.lines.find((l) => l.product.id === p.id)?.quantity ?? 0
  const rank = inCategory(p.category).sort((a, b) => b.boughtPastMonth - a.boughtPastMonth || b.ratingCount - a.ratingCount).findIndex((x) => x.id === p.id) + 1
  const pairs = inStock ? boughtTogether(p) : []
  const relatedItems = products
    .filter((x) => dept?.categories.includes(x.category) && x.category !== p.category && x.stock > 0 && !pairs.includes(x))
    .sort((a, b) => popularity(b) - popularity(a))
    .slice(0, 12)
  // Reviews: the digest counts the same set the list shows, so every bar clicks through to exactly those reviews (lib/reviews)
  const mentions = isAspect(param('mentions')) ? param('mentions') : ''
  const verifiedCount = reviews.filter((r) => r.verified).length
  const verifiedOnly = param('verified') ? param('verified') === 'only' : verifiedByDefault(reviews)
  const aspects = aspectDigest(verifiedOnly ? reviews.filter((r) => r.verified) : reviews)
  const shown = reviews.filter((r) => (!mentions || mentionsAspect(r, mentions)) && (!verifiedOnly || r.verified))
  const topReviews = sortReviews(shown, 'helpful').slice(0, 8)
  const reviewLink = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    const next = { mentions, verified: param('verified'), ...patch }
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v)
    return `/dp/${p.id}${q.size ? `?${q}` : ''}#reviews`
  }
  const recent = history.filter((h) => h.product.id !== p.id).slice(0, 20)
  // The catalog's weight and dimensions are unitless demo numbers (a 4 "pound" mascara), so they stay off the page.
  const specs: [string, string][] = [
    ['Brand', p.brand ?? 'Generic'],
    ['Category', category],
    ['SKU', p.sku],
    ['Warranty', p.warranty],
  ]
  const signInHere = `/ap/signin?return_to=${encodeURIComponent(`/dp/${p.id}`)}`
  const jump = 'flex h-11 items-center text-muted hover:text-ink'
  const section = 'border-t border-line py-12'

  return (
    <div className="mx-auto max-w-[1120px] px-4 pt-4 md:px-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {dept && (
            <>
              <li><Link href={`/s?i=${dept.slug}`} className="hover:text-ink hover:underline">{dept.name}</Link></li>
              <li aria-hidden>/</li>
            </>
          )}
          <li><Link href={`/s?i=${p.category}`} className="hover:text-ink hover:underline">{category}</Link></li>
        </ol>
      </nav>

      {/* Two columns: the picture and the detail on the left, everything you decide with in one column on the right.
          On a phone it stacks picture → decision → detail, so the price is never below a wall of bullets. */}
      <div className="mt-6 grid gap-x-16 gap-y-10 pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Gallery images={p.images.length ? p.images : [p.thumbnail]} title={p.title} saver={saver} />
        </div>

        {/* The decision column: title, price, promise, then the actions, read top to bottom. */}
        <aside aria-label="Buy box" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-[420px]">
          <h1 className="text-[28px] leading-9 md:text-[32px] md:leading-10">{p.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5">
              <Stars rating={summary.average} />
              <span className="price">{summary.average.toFixed(1)}</span>
            </span>
            <Link href="#reviews" className="link">{plural(summary.total, 'rating')}</Link>
            {p.brand && (
              <>
                <span aria-hidden className="text-line">·</span>
                <Link href={`/s?brand=${encodeURIComponent(p.brand)}`} className="link">{p.brand}</Link>
              </>
            )}
          </div>

          {(p.badge || p.boughtPastMonth > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              {p.badge === 'best-seller' && (
                <>
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[13px] font-medium text-accent">#1 Best Seller</span>
                  <Link href={`/s?i=${p.category}&sort=bestsellers`} className="link text-[13px]">in {category}</Link>
                </>
              )}
              {p.badge === 'amazons-choice' && (
                <span className="text-[13px]">
                  <Badge badge={p.badge} />
                  <InfoPopover id="choice-info" label="About nile's Choice">nile&apos;s Choice highlights highly rated, well-priced products available to ship immediately.</InfoPopover>
                </span>
              )}
              {p.boughtPastMonth > 0 && <span className="text-[13px] text-muted">{compactCount(p.boughtPastMonth)} bought in the past month</span>}
            </div>
          )}

          {inStock ? (
            <>
              <div className="mt-6 border-t border-line pt-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="price font-display text-[34px] leading-10"><Price value={p.price} currency={currency} rate={rate} /></span>
                  {p.discount > 0 && <span className="price text-lg text-deal">−{p.discount}%</span>}
                  {isDeal(p) && <span className="rounded-full bg-deal/10 px-2.5 py-0.5 text-[13px] font-medium text-deal">Deal</span>}
                </div>
                {p.listPrice && (
                  <p className="mt-1.5 text-sm text-muted">
                    List price: <s className="price">{formatDollars(p.listPrice, currency, rate)}</s>
                    <InfoPopover id="list-price-info" label="About List Price">
                      The List Price is the suggested retail price of a new product as provided by a manufacturer, supplier, or seller.
                    </InfoPopover>
                  </p>
                )}
                {dutyCents > 0 && (
                  <p className="mt-2 text-[15px]">
                    <b className="price font-semibold">{formatMoney(toCents(p.price) + dutyCents + shipCents, currency, rate)} to your door</b>
                    <InfoPopover id="landed-cost-info" label="About the delivered price">
                      Includes {formatMoney(dutyCents, currency, rate)} estimated import duty and {formatMoney(shipCents, currency, rate)} international shipping, so nothing is collected on delivery.
                    </InfoPopover>
                  </p>
                )}
              </div>

              <div className="mt-6 space-y-1.5 border-t border-line pt-6 text-sm">
                <p>
                  {label} <b className="font-semibold">{dayLabel(standard)}</b>
                  {!fastest && countdown}
                </p>
                {note && <p className="text-muted">{note}</p>}
                {fastest && (
                  <p>
                    Or fastest delivery <b className="font-semibold">{dayLabel(fastest)}</b> for <b className="price whitespace-nowrap font-semibold">{formatDollars(promise.expeditedFeeUsd, currency, rate)}</b>
                    {countdown}
                  </p>
                )}
                {country === 'PK' && (
                  <p className="pt-1">
                    <b className="font-semibold">Ships to {countryName}</b>
                    <span className="block text-muted">{IMPORT_FEES_NOTE}</span>
                  </p>
                )}
                {/* signed in: the address book; guests: the header's location dialog (sign in or pick a place) */}
                {user ? (
                  <Link href="/account/addresses" className="link flex items-center gap-1.5 pt-1">{pin}</Link>
                ) : (
                  <LocationPicker className="link flex cursor-pointer items-center gap-1.5 pt-1 text-left">{pin}</LocationPicker>
                )}
                <p className={`pt-2 text-base ${p.stock < 10 ? 'text-deal' : 'text-success'}`}>
                  {p.stock < 10 ? `Only ${p.stock} left in stock — order soon.` : 'In stock'}
                </p>
              </div>

              <div className="mt-6">
                <PurchaseControls saver={saver} product={slim(p)} max={Math.min(p.stock, MAX_QTY)} stock={p.stock} signedIn={!!user} inCart={inCart} cart={cartTotals} picks={pairs.map(slim)} />
                <PriceLock
                  productId={p.id}
                  priceText={formatMoney(toCents(p.price), currency, rate)}
                  locked={lock ? { text: formatMoney(lock.cents, currency, rate), expiresAt: lock.expires.toISOString() } : null}
                />
                {group && !group.over && (
                  <GroupBuy
                    productId={group.product.id}
                    groupId={group.id}
                    teamPrice={formatMoney(group.priceCents, currency, rate)}
                    joined={group.joined}
                    target={group.target}
                    endsAt={group.endsAt.toISOString()}
                    mine={group.mine}
                    filled={group.filled}
                  />
                )}
              </div>

              <dl className="mt-6 space-y-1.5 border-t border-line pt-6 text-[13px] text-muted">
                <div className="flex gap-3"><dt className="w-20 shrink-0">Ships from</dt><dd className="text-ink">nile</dd></div>
                <div className="flex gap-3"><dt className="w-20 shrink-0">Sold by</dt><dd className="text-ink">nile</dd></div>
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0">Returns</dt>
                  <dd className="text-ink">
                    {returnDays ? `Returnable until ${fullDate(new Date(standard.getTime() + returnDays * DAY))}` : 'Non-returnable'}
                    <InfoPopover id="returns-info" label="Return policy details">
                      {returnDays ? `Eligible for Return, Refund or Replacement within ${returnDays} days of receipt.` : 'This item is non-returnable.'}
                    </InfoPopover>
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0">Payment</dt>
                  <dd className="text-ink">
                    <button type="button" popoverTarget="payment-info" className="link cursor-pointer">Secure transaction</button>
                    <span id="payment-info" popover="auto" className="card m-auto w-[min(380px,90vw)] p-4 text-sm text-ink shadow-[0_12px_30px_rgba(25,23,19,0.18)]">
                      Your transaction is secure. This is a demo store: payments are simulated, nothing is charged, and full card numbers are never stored.
                    </span>
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="mt-6 border-t border-line pt-6">
              <p className="text-lg text-deal">Currently unavailable.</p>
              <p className="mt-1 text-sm text-muted">We don&apos;t know when or if this item will be back in stock.</p>
            </div>
          )}

          <div className="mt-6 border-t border-line pt-6">
            <AddToList productId={p.id} lists={lists.map(({ id, name, isDefault }) => ({ id, name, isDefault }))} signedIn={!!user} />
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <h2 id="about" className="scroll-mt-14 text-xl">About this item</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {aboutBullets(p).map(([lead, text]) => (
              <li key={lead + text} className="flex gap-3">
                <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-muted" />
                <span>{lead && <b className="font-semibold">{lead}: </b>}{text}</span>
              </li>
            ))}
          </ul>
          <Link href="#product-details" className="link mt-4 inline-block text-sm">See full product information</Link>
        </div>
      </div>

      {/* In flow under the hero, then sticks to the top while the long lower page scrolls. */}
      <nav aria-label="On this page" className="sticky top-0 z-20 -mx-4 flex items-center gap-6 border-y border-line bg-paper px-4 text-sm md:-mx-6 md:px-6">
        <ul className="flex min-w-0 flex-1 gap-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
          <li className="max-sm:hidden"><a href="#" className={jump}>Top</a></li>
          <li><a href="#about" className={jump}>About this item</a></li>
          <li><a href="#similar" className={jump}>Similar</a></li>
          <li><a href="#product-details" className={jump}>Product information</a></li>
          <li><a href="#reviews" className={jump}>Reviews</a></li>
        </ul>
        <div className="hidden max-w-72 min-w-0 items-center gap-2 md:flex">
          {saver ? (
            <Image src={p.thumbnail} alt="" width={32} height={32} quality={40} className="size-8 shrink-0 object-contain mix-blend-multiply" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnail} alt="" loading="lazy" className="size-8 shrink-0 object-contain mix-blend-multiply" />
          )}
          <span className="line-clamp-2 text-xs text-muted">{p.title}</span>
        </div>
      </nav>

      {pairs.length > 0 && <BoughtTogether items={[p, ...pairs].map(slim)} cart={cartTotals} saver={saver} />}

      {relatedItems.length > 0 && (
        <div id="similar" className="-mx-4 scroll-mt-14 overflow-hidden border-t border-line md:-mx-6">
          <ProductCarousel title="Products related to this item" products={relatedItems} />
        </div>
      )}

      <section id="product-details" aria-labelledby="product-info-title" className={`scroll-mt-14 ${section}`}>
        <h2 id="product-info-title" className="text-2xl">Product information</h2>
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <Facts title="Technical details" rows={[...specs, ['Manufacturer', p.brand ?? 'Generic']]} />
          <Facts
            title="Additional information"
            rows={[
              ['nile item number', String(p.id)],
              ['Customer reviews', <span key="r" className="flex flex-wrap items-center gap-1.5"><span className="price">{summary.average.toFixed(1)}</span> <Stars rating={summary.average} /> <Link href="#reviews" className="link">{plural(summary.total, 'rating')}</Link></span>],
              ['Best sellers rank', <span key="b">#{rank} in {category} (<Link href={`/s?i=${p.category}&sort=bestsellers`} className="link">see the top 100</Link>)</span>],
              ['Date first available', fullDate(new Date(p.createdAt))],
            ]}
          />
        </div>
        <div className="mt-10">
          <h3 className="text-lg">Product description</h3>
          <p className="mt-3 max-w-2xl text-[15px] text-muted">{p.description}</p>
        </div>
      </section>

      {/* Reviews lead with the digest: it is the most trustworthy thing on the page, so it gets the full width. */}
      <section id="reviews" aria-labelledby="reviews-title" className={`scroll-mt-14 ${section}`}>
        <h2 id="reviews-title" className="text-2xl">Customer reviews</h2>

        <div className="mt-6">
          <ReviewDigest
            aspects={aspects}
            pinned={pinnedReviews(reviews)}
            verified={{ only: verifiedOnly, count: verifiedCount, total: reviews.length }}
            mentions={mentions}
            filtered={!!mentions || verifiedOnly}
            link={reviewLink}
            productId={p.id}
            signedIn={!!user}
            returnTo={reviewLink({})}
          />
        </div>

        <div className="mt-12 grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="space-y-10 lg:self-start">
            <RatingBreakdown summary={summary} productId={p.id} />
            <div className="border-t border-line pt-8">
              <WriteReviewPrompt productId={p.id} hasReview={!!mine} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h3 className="text-lg">
                {mentions || verifiedOnly ? `${plural(shown.length, 'review')}` : 'Top reviews'}
                {mentions && ` mentioning ${mentions}`}
                {verifiedOnly && ' from verified purchases'}
              </h3>
              {(mentions || (verifiedOnly && param('verified'))) && (
                <Link href={reviewLink({ mentions: undefined, verified: verifiedOnly ? 'all' : undefined })} className="link text-sm">Clear filter</Link>
              )}
            </div>
            {topReviews.length ? (
              <div className="divide-y divide-line">
                {topReviews.map((r) => (
                  <ReviewCard key={r.id} review={r} productId={p.id} signedIn={!!user} returnTo={reviewLink({})} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No customer reviews match this filter.</p>
            )}
            {/* carries the digest's filter through, so a capped aspect still lands on exactly its reviews (reviewerType is the reviews page's name for it) */}
            {shown.length > topReviews.length && (
              <Link href={`/product-reviews/${p.id}?${new URLSearchParams({ ...(mentions ? { mentions } : {}), reviewerType: verifiedOnly ? 'avp_only_reviews' : 'all_reviews' })}`} className="link mt-4 inline-block font-medium">
                See more reviews
              </Link>
            )}
          </div>
        </div>
      </section>

      <div id={relatedItems.length ? undefined : 'similar'} className="-mx-4 scroll-mt-14 overflow-hidden border-t border-line md:-mx-6">
        <ProductCarousel title="Customers who viewed this item also viewed" products={related(p, 12)} />
      </div>

      {user ? (
        recent.length > 0 && (
          <section aria-labelledby="history-title" className={section}>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-4">
              <h2 id="history-title" className="text-xl">Your Browsing History</h2>
              <Link href="/history" className="link text-sm">View or edit</Link>
            </div>
            <Scroller label="Your Browsing History">
              {recent.map(({ product }) => (
                <li key={product.id} className="w-[120px] shrink-0 snap-start">
                  <Link href={`/dp/${product.id}`} aria-label={product.title} className="flex h-[120px] items-center justify-center rounded-lg bg-page p-2">
                    {saver ? (
                      <Image src={product.thumbnail} alt="" width={120} height={120} quality={40} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    )}
                  </Link>
                </li>
              ))}
            </Scroller>
          </section>
        )
      ) : (
        <section className={`${section} text-center`}>
          <p className="text-[15px]">Sign in to see recommendations picked from what you have looked at.</p>
          <Link href={signInHere} className="btn btn-cart mt-4 w-56">Sign in</Link>
          <p className="mt-2 text-sm text-muted">
            New here? <Link href={signInHere} className="link">Create an account</Link>
          </p>
        </section>
      )}
    </div>
  )
}

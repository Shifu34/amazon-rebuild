import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReviewFilters } from '@/components/pdp/review-filters'
import { RatingBreakdown, ReviewCard, WriteReviewPrompt } from '@/components/pdp/reviews'
import { getUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { plural } from '@/lib/format'
import { ReviewDigest } from '@/components/reviews/digest'
import { aspectDigest, isAspect, mentionsAspect, pinnedReviews, productReviews, sortReviews, STAR_FILTERS, verifiedByDefault } from '@/lib/reviews'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const PER_PAGE = 10
const findProduct = (id: string) => (/^\d{1,9}$/.test(id) ? getProduct(Number(id)) : undefined)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = findProduct((await params).id)
  return { title: p ? `Customer reviews: ${p.title}` : 'Page not found' }
}

export default async function ProductReviewsPage({ params, searchParams }: Props) {
  const p = findProduct((await params).id)
  if (!p) notFound()

  const sp = await searchParams
  const param = (k: string) => (typeof sp[k] === 'string' ? sp[k] : '')
  const star = Object.hasOwn(STAR_FILTERS, param('filterByStar')) ? param('filterByStar') : 'all_stars'
  const sort = param('sortBy') === 'recent' ? 'recent' : 'helpful'
  const keyword = param('filterByKeyword').trim().slice(0, 100)
  const mentions = isAspect(param('mentions')) ? param('mentions') : ''

  const user = await getUser()
  const { reviews, summary, mine } = await productReviews(p, user?.id)
  // verified-only is the default once a product has enough verified reviews to leave a list behind (lib/reviews)
  const verifiedOnly = param('reviewerType') ? param('reviewerType') === 'avp_only_reviews' : verifiedByDefault(reviews)
  const stars = STAR_FILTERS[star].stars
  const needle = keyword.toLowerCase()
  const matches = sortReviews(
    reviews.filter(
      (r) =>
        stars.includes(r.rating) &&
        (!verifiedOnly || r.verified) &&
        (!mentions || mentionsAspect(r, mentions)) &&
        (!needle || `${r.headline}\n${r.body}`.toLowerCase().includes(needle)),
    ),
    sort,
  )
  const pages = Math.max(1, Math.ceil(matches.length / PER_PAGE))
  const page = Math.min(pages, Math.max(1, Math.floor(Number(param('pageNumber'))) || 1))
  const shown = matches.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const base = `/product-reviews/${p.id}`
  const href = (pageNumber: number) => {
    const q = new URLSearchParams()
    if (star !== 'all_stars') q.set('filterByStar', star)
    if (mentions) q.set('mentions', mentions)
    q.set('reviewerType', verifiedOnly ? 'avp_only_reviews' : 'all_reviews')
    if (sort === 'recent') q.set('sortBy', 'recent')
    if (keyword) q.set('filterByKeyword', keyword)
    if (pageNumber > 1) q.set('pageNumber', String(pageNumber))
    return q.size ? `${base}?${q}` : base
  }
  const filtered = star !== 'all_stars' || verifiedOnly || !!keyword || !!mentions
  const chip = 'rounded-full border border-line bg-surface px-2.5 py-0.5'

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 md:px-6">
      {/* Phones read summary, reviews, then the write prompt; on desktop the prompt sits under the histogram. */}
      <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <aside className="space-y-6">
          <Link href={`/dp/${p.id}`} className="group flex items-center gap-3">
            <span className="flex size-20 shrink-0 items-center justify-center rounded-[10px] bg-page p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-3 text-sm group-hover:underline">{p.title}</span>
              {p.brand && <span className="block text-xs text-muted">by {p.brand}</span>}
            </span>
          </Link>
          <div>
            <h1 className="mb-4 text-2xl">Customer reviews</h1>
            <RatingBreakdown summary={summary} productId={p.id} activeStar={star} />
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <ReviewDigest
            aspects={aspectDigest(verifiedOnly ? reviews.filter((r) => r.verified) : reviews)}
            pinned={pinnedReviews(reviews)}
            verified={{ only: verifiedOnly, count: reviews.filter((r) => r.verified).length, total: reviews.length }}
            mentions={mentions}
            filtered={filtered}
            link={(patch) => {
              const q = new URLSearchParams()
              const next: Record<string, string | undefined> = { mentions, reviewerType: verifiedOnly ? 'avp_only_reviews' : 'all_reviews', ...patch }
              if ('verified' in patch) next.reviewerType = patch.verified === 'only' ? 'avp_only_reviews' : 'all_reviews'
              delete next.verified
              if (star !== 'all_stars') next.filterByStar = star
              if (keyword) next.filterByKeyword = keyword
              if (sort === 'recent') next.sortBy = sort
              for (const [k, v] of Object.entries(next)) if (v) q.set(k, v)
              return q.size ? `${base}?${q}` : base
            }}
            productId={p.id}
            signedIn={!!user}
            returnTo={href(page)}
          />
          <div className="mt-8" />
          <ReviewFilters
            productId={p.id}
            star={star}
            starOptions={Object.entries(STAR_FILTERS).map(([key, f]) => [key, f.label])}
            verifiedOnly={verifiedOnly}
            sort={sort}
            keyword={keyword}
            mentions={mentions}
          />
          <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-3 text-[13px]" aria-live="polite">
            {filtered && (
              <>
                <span className="font-medium text-muted">Filtered by</span>
                {star !== 'all_stars' && <span className={chip}>{STAR_FILTERS[star].label}</span>}
                {verifiedOnly && <span className={chip}>Verified purchase only</span>}
                {mentions && <span className={chip}>mentions &ldquo;{mentions}&rdquo;</span>}
                {keyword && <span className={chip}>&ldquo;{keyword}&rdquo;</span>}
                <Link href={base} className="link">Clear filter</Link>
                <span aria-hidden className="text-line">|</span>
              </>
            )}
            <span className="text-muted">
              {plural(summary.total, 'total rating')}, {reviews.length.toLocaleString('en-US')} with reviews
              {filtered && ` · ${plural(matches.length, 'matching review')}`}
            </span>
          </div>

          {shown.length ? (
            <div className="divide-y divide-line">
              {shown.map((r) => (
                <ReviewCard key={r.id} review={r} productId={p.id} signedIn={!!user} returnTo={href(page)} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-base">Sorry, no reviews match your current selections.</p>
              <p className="text-sm text-muted">Try clearing or changing some filters.</p>
              <Link href={base} className="btn btn-plain mt-3">Show all reviews</Link>
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Review pages" className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {page > 1 ? <Link href={href(page - 1)} className="btn btn-plain">← Previous page</Link> : <span aria-disabled="true" className="btn btn-plain opacity-50">← Previous page</span>}
              <span className="text-sm text-muted">Page {page} of {pages}</span>
              {page < pages ? <Link href={href(page + 1)} className="btn btn-plain">Next page →</Link> : <span aria-disabled="true" className="btn btn-plain opacity-50">Next page →</span>}
            </nav>
          )}
        </div>

        <div className="border-t border-line pt-8 lg:col-start-1 lg:row-start-2 lg:self-start">
          <WriteReviewPrompt productId={p.id} hasReview={!!mine} />
        </div>
      </div>
    </div>
  )
}

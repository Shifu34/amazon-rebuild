import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReviewFilters } from '@/components/pdp/review-filters'
import { RatingBreakdown, ReviewCard, WriteReviewPrompt } from '@/components/pdp/reviews'
import { getUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { plural } from '@/lib/format'
import { productReviews, sortReviews, STAR_FILTERS } from '@/lib/reviews'

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
  const verifiedOnly = param('reviewerType') === 'avp_only_reviews'
  const sort = param('sortBy') === 'recent' ? 'recent' : 'helpful'
  const keyword = param('filterByKeyword').trim().slice(0, 100)

  const user = await getUser()
  const { reviews, summary, mine } = await productReviews(p, user?.id)
  const stars = STAR_FILTERS[star].stars
  const needle = keyword.toLowerCase()
  const matches = sortReviews(
    reviews.filter((r) => stars.includes(r.rating) && (!verifiedOnly || r.verified) && (!needle || `${r.headline}\n${r.body}`.toLowerCase().includes(needle))),
    sort,
  )
  const pages = Math.max(1, Math.ceil(matches.length / PER_PAGE))
  const page = Math.min(pages, Math.max(1, Math.floor(Number(param('pageNumber'))) || 1))
  const shown = matches.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const base = `/product-reviews/${p.id}`
  const href = (pageNumber: number) => {
    const q = new URLSearchParams()
    if (star !== 'all_stars') q.set('filterByStar', star)
    if (verifiedOnly) q.set('reviewerType', 'avp_only_reviews')
    if (sort === 'recent') q.set('sortBy', 'recent')
    if (keyword) q.set('filterByKeyword', keyword)
    if (pageNumber > 1) q.set('pageNumber', String(pageNumber))
    return q.size ? `${base}?${q}` : base
  }
  const filtered = star !== 'all_stars' || verifiedOnly || !!keyword
  const chip = 'rounded-full bg-[#f0f2f2] px-2.5 py-0.5'

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6">
      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Link href={`/dp/${p.id}`} className="group flex items-center gap-3">
            <span className="flex size-20 shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-3 text-sm group-hover:text-link-hover group-hover:underline">{p.title}</span>
              {p.brand && <span className="block text-xs text-muted">by {p.brand}</span>}
            </span>
          </Link>
          <div>
            <h1 className="mb-2 text-2xl">Customer reviews</h1>
            <RatingBreakdown summary={summary} productId={p.id} activeStar={star} />
          </div>
          <div className="border-t border-line pt-6">
            <WriteReviewPrompt productId={p.id} hasReview={!!mine} />
          </div>
        </aside>

        <div className="min-w-0">
          <ReviewFilters
            productId={p.id}
            star={star}
            starOptions={Object.entries(STAR_FILTERS).map(([key, f]) => [key, f.label])}
            verifiedOnly={verifiedOnly}
            sort={sort}
            keyword={keyword}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-line py-2 text-[13px]" aria-live="polite">
            {filtered && (
              <>
                <span className="font-bold text-muted">FILTERED BY</span>
                {star !== 'all_stars' && <span className={chip}>{STAR_FILTERS[star].label}</span>}
                {verifiedOnly && <span className={chip}>Verified purchase only</span>}
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
      </div>
    </div>
  )
}

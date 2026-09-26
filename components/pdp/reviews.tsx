import Link from 'next/link'
import { UserIcon } from '@/components/icons'
import { Stars } from '@/components/stars'
import { fullDate, plural } from '@/lib/format'
import { starFilterKey, type RatingSummary, type ReviewItem } from '@/lib/reviews'
import { FeedbackButton, ReadMore } from './review-actions'

// Average, global ratings and the 5-row histogram; each row links to the reviews page filtered to that star.
export function RatingBreakdown({ summary, productId, activeStar }: { summary: RatingSummary; productId: number; activeStar?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Stars rating={summary.average} className="h-5" />
        <span className="price text-lg">{summary.average.toFixed(1)} out of 5</span>
      </div>
      <p className="mt-1 text-sm text-muted">{plural(summary.total, 'global rating')}</p>
      <ul className="mt-4 space-y-2.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const pct = summary.percents[star - 1]
          const key = starFilterKey(star)
          return (
            <li key={star}>
              <Link
                href={`/product-reviews/${productId}?filterByStar=${key}`}
                aria-label={`${star} stars represent ${pct}% of rating`}
                aria-current={activeStar === key ? 'true' : undefined}
                className="group flex items-center gap-3 rounded text-sm text-muted hover:text-ink aria-[current]:font-medium aria-[current]:text-ink"
              >
                <span className="w-12 shrink-0 group-hover:underline">{star} star</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-star" style={{ width: `${pct}%` }} />
                </span>
                <span className="price w-10 shrink-0 text-right">{pct}%</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <details className="mt-4 text-sm">
        <summary className="link cursor-pointer">How are ratings calculated?</summary>
        <p className="mt-2 text-muted">
          The star rating is the average of every rating this item has received, and the bars show how those ratings split by star. Ratings from nile shoppers count as soon as they are submitted.
        </p>
      </details>
    </div>
  )
}

export function WriteReviewPrompt({ productId, hasReview }: { productId: number; hasReview: boolean }) {
  return (
    <div>
      <h3 className="text-lg">Review this product</h3>
      <p className="mt-1 text-sm text-muted">Share what you thought with other shoppers.</p>
      <Link href={`/review/create/${productId}`} className="btn btn-plain mt-3 w-full">
        {hasReview ? 'Edit your review' : 'Write a customer review'}
      </Link>
    </div>
  )
}

export function ReviewCard({ review, productId, signedIn, returnTo }: { review: ReviewItem; productId: number; signedIn: boolean; returnTo: string }) {
  const signIn = `/ap/signin?return_to=${encodeURIComponent(returnTo)}`
  return (
    <article className="py-4">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="flex size-8 items-center justify-center rounded-full bg-page">
          <UserIcon className="size-5 text-muted" />
        </span>
        {review.author}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Stars rating={review.rating} />
        <h4 className="text-[15px] font-medium break-words">{review.headline}</h4>
      </div>
      <p className="mt-0.5 text-[13px] text-muted">Reviewed in the United States on {fullDate(review.date)}</p>
      {review.verified && <p className="text-xs font-medium text-accent">Verified Purchase</p>}
      {review.body && <ReadMore text={review.body} />}
      <div className="mt-2 text-[13px] text-muted">
        {review.helpful > 0 && <p>{review.helpful === 1 ? 'One person found this helpful' : `${review.helpful.toLocaleString('en-US')} people found this helpful`}</p>}
        {review.own ? (
          <p className="mt-1.5">
            Your review · <Link href={`/review/create/${productId}`} className="link underline">Edit</Link>
          </p>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {review.voted ? (
              <p className="text-success">✓ Thank you for your feedback.</p>
            ) : signedIn ? (
              <FeedbackButton reviewId={review.id} kind="helpful" />
            ) : (
              <Link href={signIn} className="btn btn-plain px-5">Helpful</Link>
            )}
            <span aria-hidden className="h-4 border-l border-line" />
            {review.reported ? (
              <p>Reported</p>
            ) : signedIn ? (
              <FeedbackButton reviewId={review.id} kind="report" />
            ) : (
              <Link href={signIn} className="hover:text-link-hover hover:underline">Report</Link>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

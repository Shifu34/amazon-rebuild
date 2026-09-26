import Link from 'next/link'
import { ReviewCard } from '@/components/pdp/reviews'
import { plural } from '@/lib/format'
import type { Aspect, ReviewItem } from '@/lib/reviews'

type Props = {
  aspects: Aspect[]
  pinned: { positive?: ReviewItem; critical?: ReviewItem }
  verified: { only: boolean; count: number; total: number }
  mentions: string
  filtered: boolean // any filter on the list below: the pinned pair belongs to the unfiltered view
  link: (patch: Record<string, string | undefined>) => string // both pages keep their own URL shape
  productId: number
  signedIn: boolean
  returnTo: string
}

// "What buyers say": the verified share, what reviewers bring up, and the most helpful praise and complaint. Every
// number is a link to the reviews behind it, so nothing here has to be taken on trust. Links only, no client JS.
// It is the page's headline feature, so it gets width and air rather than a bordered box (docs/design.md).
export function ReviewDigest({ aspects, pinned, verified, mentions, filtered, link, productId, signedIn, returnTo }: Props) {
  const pins = [
    ['Most helpful positive', pinned.positive],
    ['Most helpful critical', pinned.critical],
  ] as const

  return (
    <section aria-labelledby="buyers-say" className="rounded-[10px] bg-page px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 id="buyers-say" className="text-xl">What buyers say</h3>
        <p className="text-sm text-muted">
          {verified.count
            ? `${verified.count} of ${plural(verified.total, 'review')} ${verified.count === 1 ? 'is' : 'are'} from verified purchases.`
            : `No verified purchases yet, showing all ${plural(verified.total, 'review')}.`}{' '}
          {verified.count > 0 && (
            <Link href={link({ verified: verified.only ? 'all' : 'only' })} className="link">
              {verified.only ? `Show all ${verified.total}` : 'Verified purchases only'}
            </Link>
          )}
        </p>
      </div>

      {aspects.length > 0 && (
        <ul className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {aspects.map((a) => {
            const on = a.key === mentions
            const share = Math.round((a.positive / a.mentions) * 100)
            return (
              <li key={a.key}>
                {/* clicking filters the list to exactly the reviews counted here; clicking again clears it */}
                <Link
                  href={link({ mentions: on ? undefined : a.key })}
                  aria-current={on || undefined}
                  className={`group block rounded-md px-2 py-1.5 -mx-2 ${on ? 'bg-accent-soft' : 'hover:bg-surface'}`}
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={`font-medium ${on ? 'text-accent' : ''}`}>{a.key}</span>
                    <span className="price shrink-0 text-muted">{a.positive} of {a.mentions} positive</span>
                  </span>
                  <span aria-hidden className="mt-2 block h-1 rounded-full bg-line">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* the pinned pair is the unfiltered view's job; once a filter is on, the list below is the answer */}
      {!filtered && (pinned.positive || pinned.critical) && (
        <div className="mt-6 grid gap-x-10 border-t border-line sm:grid-cols-2">
          {pins.map(([label, review]) =>
            review ? (
              <div key={label} className="min-w-0">
                <h4 className="pt-5 text-sm font-medium text-muted">{label}</h4>
                <ReviewCard review={review} productId={productId} signedIn={signedIn} returnTo={returnTo} />
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}

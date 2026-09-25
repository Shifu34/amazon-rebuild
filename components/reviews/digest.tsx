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
export function ReviewDigest({ aspects, pinned, verified, mentions, filtered, link, productId, signedIn, returnTo }: Props) {
  const pins = [
    ['Most helpful positive', pinned.positive],
    ['Most helpful critical', pinned.critical],
  ] as const

  return (
    <section aria-labelledby="buyers-say" className="mb-5 rounded-lg border border-line p-4">
      <h3 id="buyers-say" className="text-lg">What buyers say</h3>

      <p className="mt-1 text-sm text-muted">
        {verified.count
          ? `${verified.count} of ${plural(verified.total, 'review')} ${verified.count === 1 ? 'is' : 'are'} from verified purchases.`
          : `No verified purchases yet, showing all ${plural(verified.total, 'review')}.`}{' '}
        {verified.count > 0 && (
          <Link href={link({ verified: verified.only ? 'all' : 'only' })} className="link">
            {verified.only ? `Show all ${verified.total}` : 'Verified purchases only'}
          </Link>
        )}
      </p>

      {aspects.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {aspects.map((a) => {
            const on = a.key === mentions
            const share = Math.round((a.positive / a.mentions) * 100)
            return (
              <li key={a.key}>
                {/* clicking filters the list to exactly the reviews counted here; clicking again clears it */}
                <Link
                  href={link({ mentions: on ? undefined : a.key })}
                  aria-current={on || undefined}
                  className={`block rounded-md px-2 py-1.5 hover:bg-[#f7fafa] ${on ? 'bg-[#f0f2f2] ring-1 ring-ink' : ''}`}
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-bold">{a.key}</span>
                    <span className="text-muted">{a.positive} of {a.mentions} positive</span>
                  </span>
                  <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-[#e3e6e6]">
                    <span className="block h-full rounded-full bg-[#007600]" style={{ width: `${share}%` }} />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* the pinned pair is the unfiltered view's job; once a filter is on, the list below is the answer */}
      {!filtered && (pinned.positive || pinned.critical) && (
        <div className="mt-3 grid gap-x-6 border-t border-line sm:grid-cols-2 sm:divide-x sm:divide-line">
          {pins.map(([label, review]) =>
            review ? (
              <div key={label} className="min-w-0 sm:not-first:pl-6">
                <h4 className="pt-3 text-sm font-bold">{label}</h4>
                <ReviewCard review={review} productId={productId} signedIn={signedIn} returnTo={returnTo} />
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}

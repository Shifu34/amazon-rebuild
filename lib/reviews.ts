// Product reviews: the catalog's seed reviews merged with shoppers' reviews from the database, and a
// 5-star histogram derived deterministically from the catalog's average and rating count.
import { getProduct, type Product } from './catalog'
import { one, query } from './db'

export type ReviewItem = {
  id: string // uuid for shopper reviews, seed-{productId}-{index} for catalog reviews
  author: string
  rating: number
  headline: string
  body: string
  date: Date
  verified: boolean
  helpful: number
  fromShopper: boolean
  own: boolean // written by the viewer
  voted: boolean // the viewer already marked it helpful
  reported: boolean // the viewer already reported it
}

export type RatingSummary = { average: number; total: number; counts: number[]; percents: number[] } // index 0 = 1 star

export const STAR_FILTERS: Record<string, { label: string; stars: number[] }> = {
  all_stars: { label: 'All stars', stars: [1, 2, 3, 4, 5] },
  five_star: { label: '5 star only', stars: [5] },
  four_star: { label: '4 star only', stars: [4] },
  three_star: { label: '3 star only', stars: [3] },
  two_star: { label: '2 star only', stars: [2] },
  one_star: { label: '1 star only', stars: [1] },
  positive: { label: 'All positive', stars: [4, 5] },
  critical: { label: 'All critical', stars: [1, 2, 3] },
}
export const starFilterKey = (star: number) => ['one_star', 'two_star', 'three_star', 'four_star', 'five_star'][star - 1]

// ponytail: the dev server applies db/schema.sql only when it first connects, so re-apply this slice's
// additions once per process; drop it once every environment has run the current schema.
let ready: Promise<unknown> | undefined
const ensureSchema = () =>
  (ready ??= query(
    `create table if not exists review_votes (
       review_id uuid not null references reviews(id) on delete cascade,
       user_id uuid not null references users(id) on delete cascade,
       created_at timestamptz not null default now(),
       primary key (review_id, user_id)
     )`,
  ).then(() =>
    // helpful votes on catalog reviews, and reports on any review; review_key is a shopper review's uuid or seed-{productId}-{index}
    query(
      `create table if not exists review_feedback (
         review_key text not null,
         user_id uuid not null references users(id) on delete cascade,
         kind text not null check (kind in ('helpful', 'report')),
         created_at timestamptz not null default now(),
         primary key (review_key, user_id, kind)
       )`,
    ),
  ))

// Largest-remainder rounding: integers proportional to `weights` that add up to exactly `total`.
function apportion(weights: number[], total: number) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const exact = weights.map((w) => (w / sum) * total)
  const out = exact.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  for (const i of exact.map((x, i) => i).sort((a, b) => exact[b] - out[b] - (exact[a] - out[a]))) if (left-- > 0) out[i]++
  return out
}

// Star shares proportional to e^(t * star), with t bisected so the mean equals the average.
function starShares(average: number) {
  const shares = (t: number) => [1, 2, 3, 4, 5].map((s) => Math.exp(t * s))
  const mean = (w: number[]) => w.reduce((a, x, i) => a + x * (i + 1), 0) / w.reduce((a, b) => a + b, 0)
  let lo = -20
  let hi = 20
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (mean(shares(mid)) < average) lo = mid
    else hi = mid
  }
  return shares(lo)
}

export function summarize(p: Product, shopperRatings: number[]): RatingSummary {
  const counts = apportion(starShares(p.rating), p.ratingCount)
  for (const r of shopperRatings) counts[r - 1]++
  const total = p.ratingCount + shopperRatings.length
  const sum = p.rating * p.ratingCount + shopperRatings.reduce((a, b) => a + b, 0)
  return {
    average: total ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    counts,
    percents: total ? apportion(counts, 100) : [0, 0, 0, 0, 0],
  }
}

type Row = { id: string; user_id: string; name: string; rating: number; headline: string; body: string; created_at: Date; helpful: number; verified: boolean; voted: boolean; reported: boolean }
type SeedFeedback = { review_key: string; helpful: number; voted: boolean; reported: boolean }

export async function productReviews(p: Product, viewerId?: string) {
  await ensureSchema()
  const viewer = viewerId ?? null
  const [rows, feedback] = await Promise.all([
    query<Row>(
      `select r.id, r.user_id, u.name, r.rating, r.headline, r.body, r.created_at, r.helpful,
         exists (select 1 from order_items oi join orders o on o.id = oi.order_id
                 where o.user_id = r.user_id and oi.product_id = r.product_id and o.cancelled_at is null and oi.cancelled_at is null) as verified,
         exists (select 1 from review_votes v where v.review_id = r.id and v.user_id = $2) as voted,
         exists (select 1 from review_feedback f where f.review_key = r.id::text and f.user_id = $2 and f.kind = 'report') as reported
       from reviews r join users u on u.id = r.user_id
       where r.product_id = $1`,
      [p.id, viewer],
    ),
    query<SeedFeedback>(
      `select review_key, (count(*) filter (where kind = 'helpful'))::int as helpful,
         coalesce(bool_or(kind = 'helpful' and user_id = $2), false) as voted,
         coalesce(bool_or(kind = 'report' and user_id = $2), false) as reported
       from review_feedback where review_key like $1 group by review_key`,
      [`seed-${p.id}-%`, viewer],
    ),
  ])
  const shopper = rows.map((r): ReviewItem => ({
    id: r.id,
    author: r.name,
    rating: r.rating,
    headline: r.headline,
    body: r.body,
    date: new Date(r.created_at),
    verified: r.verified,
    helpful: r.helpful,
    fromShopper: true,
    own: r.user_id === viewerId,
    voted: r.voted,
    reported: r.reported,
  }))
  const byKey = new Map(feedback.map((f) => [f.review_key, f]))
  const seed = p.reviews.map((r, i): ReviewItem => {
    const id = `seed-${p.id}-${i}`
    const f = byKey.get(id)
    return {
      id,
      author: r.reviewerName,
      rating: r.rating,
      headline: r.comment,
      body: '',
      date: new Date(r.date),
      verified: false,
      helpful: f?.helpful ?? 0,
      fromShopper: false,
      own: false,
      voted: f?.voted ?? false,
      reported: f?.reported ?? false,
    }
  })
  return { reviews: [...shopper, ...seed], summary: summarize(p, shopper.map((r) => r.rating)), mine: shopper.find((r) => r.own) }
}

export function sortReviews(list: ReviewItem[], sort: 'helpful' | 'recent') {
  const byDate = (a: ReviewItem, b: ReviewItem) => b.date.getTime() - a.date.getTime()
  return [...list].sort(sort === 'recent' ? byDate : (a, b) => b.helpful - a.helpful || Number(b.verified) - Number(a.verified) || byDate(a, b))
}

export const ownReview = (userId: string, productId: number) =>
  one<{ rating: number; headline: string; body: string }>('select rating, headline, body from reviews where user_id = $1 and product_id = $2', [userId, productId])

// One review per shopper per product: saving again edits it. Verified when they have a non-cancelled order with the item.
export async function saveReview(userId: string, productId: number, rating: number, headline: string, body: string) {
  await query(
    `insert into reviews (user_id, product_id, rating, headline, body, verified)
     values ($1, $2, $3, $4, $5, exists (select 1 from order_items oi join orders o on o.id = oi.order_id
                                         where o.user_id = $1 and oi.product_id = $2 and o.cancelled_at is null and oi.cancelled_at is null))
     on conflict (user_id, product_id) do update
       set rating = excluded.rating, headline = excluded.headline, body = excluded.body, verified = excluded.verified, created_at = now()`,
    [userId, productId, rating, headline, body],
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "Helpful" and "Report": idempotent per shopper, never on their own review. False when the review doesn't exist.
export async function reviewFeedback(userId: string, key: string, kind: 'helpful' | 'report') {
  await ensureSchema()
  const seed = key.match(/^seed-(\d{1,9})-(\d{1,2})$/)
  if (seed) {
    if (Number(seed[2]) >= (getProduct(Number(seed[1]))?.reviews.length ?? 0)) return false
    await query('insert into review_feedback (review_key, user_id, kind) values ($1, $2, $3) on conflict do nothing', [key, userId, kind])
    return true
  }
  if (!UUID.test(key)) return false
  if (kind === 'report') {
    await query(
      `insert into review_feedback (review_key, user_id, kind)
       select id::text, $2::uuid, 'report' from reviews where id = $1::uuid and user_id <> $2::uuid
       on conflict do nothing`,
      [key, userId],
    )
    return true
  }
  await query(
    `with target as (select id from reviews where id = $1 and user_id <> $2),
          vote as (insert into review_votes (review_id, user_id) select id, $2 from target on conflict do nothing returning review_id)
     update reviews set helpful = helpful + 1 where id in (select review_id from vote)`,
    [key, userId],
  )
  return true
}
